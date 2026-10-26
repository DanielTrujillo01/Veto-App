-- =============================================================================
-- VETO · Modelo de datos relacional (PostgreSQL 15+)
-- Piloto Bogotá · Basado en Product Backlog (HU-001 a HU-095) y checklist de
-- levantamiento de requisitos del cliente.
--
-- Convenciones
--   * Esquema `veto`. Nombres en español, snake_case, singular.
--   * PK uuid (gen_random_uuid) para entidades de negocio; smallint identity
--     para catálogos pequeños.
--   * Estados cerrados = tipos ENUM (máquinas de estado estables).
--     Listas que el negocio puede ampliar = tablas catálogo.
--   * Fechas/horas en timestamptz (se muestran en America/Bogota).
--   * Dinero en numeric(12,2), moneda COP. NUNCA se guardan datos de tarjeta.
--   * Archivos (fotos, anexos, PDFs) viven en almacenamiento de objetos; aquí
--     solo URL o clave de almacenamiento.
--   * La app debe ejecutar, por transacción:
--         SET LOCAL app.usuario_id = '<uuid del usuario autenticado>';
--     para que auditoría e historial de estados sepan quién hizo el cambio.
--   * Conexión de la app:  SET search_path TO veto, public;
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext     WITH SCHEMA public;  -- correo sin distinguir mayúsculas
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;  -- anti-solapamiento de agenda
CREATE EXTENSION IF NOT EXISTS pg_trgm    WITH SCHEMA public;  -- búsqueda por palabra clave

CREATE SCHEMA IF NOT EXISTS veto;
SET search_path TO veto, public;

-- =============================================================================
-- 1. TIPOS ENUMERADOS
-- =============================================================================
CREATE TYPE estado_cuenta        AS ENUM ('PENDIENTE','ACTIVA','SUSPENDIDA','ELIMINADA');
CREATE TYPE rol_equipo_veto      AS ENUM ('ADMIN','VERIFICADOR','SOPORTE');
CREATE TYPE tipo_aliado          AS ENUM ('CLINICA','VET_INDEPENDIENTE','TIENDA','FUNDACION');
CREATE TYPE estado_verificacion  AS ENUM ('PENDIENTE','APROBADO','RECHAZADO');
CREATE TYPE estado_operativo     AS ENUM ('ACTIVO','SUSPENDIDO');
CREATE TYPE rol_aliado           AS ENUM ('ADMIN','VETERINARIO','OPERADOR');
CREATE TYPE tipo_doc_aliado      AS ENUM ('RUT','CAMARA_COMERCIO','REGISTRO_MERCANTIL',
                                          'TARJETA_PROFESIONAL','CEDULA','VERIFICACION_FACIAL','OTRO');
CREATE TYPE proposito_token      AS ENUM ('RECUPERAR_PASSWORD','SEGUNDO_FACTOR','VERIFICAR_CORREO');
CREATE TYPE tipo_consentimiento  AS ENUM ('TRATAMIENTO_DATOS','TERMINOS_CONDICIONES',
                                          'POLITICA_PRIVACIDAD','PUBLICIDAD','WHATSAPP');
CREATE TYPE sexo_animal          AS ENUM ('MACHO','HEMBRA');
CREATE TYPE tamano_mascota       AS ENUM ('PEQUENO','MEDIANO','GRANDE');
CREATE TYPE modalidad_servicio   AS ENUM ('EN_SEDE','A_DOMICILIO','AMBAS');
CREATE TYPE estado_moderacion    AS ENUM ('PUBLICADO','MARCADO','OCULTO');
CREATE TYPE estado_cita          AS ENUM ('SOLICITADA','CONFIRMADA','EN_CURSO','FINALIZADA','CANCELADA','NO_ASISTIO');
CREATE TYPE estado_consulta      AS ENUM ('ABIERTA','CERRADA');
CREATE TYPE estado_control       AS ENUM ('PROGRAMADO','REALIZADO','CANCELADO');
CREATE TYPE estado_pedido        AS ENUM ('PENDIENTE_PAGO','PAGADO','CONFIRMADO','EN_PREPARACION',
                                          'DESPACHADO','ENTREGADO','CANCELADO');
CREATE TYPE metodo_entrega       AS ENUM ('RECOGER_EN_SEDE','DOMICILIO');
CREATE TYPE estado_pago          AS ENUM ('PENDIENTE','APROBADO','RECHAZADO','REEMBOLSADO','ANULADO');
CREATE TYPE estado_reembolso     AS ENUM ('PENDIENTE','COMPLETADO','FALLIDO');
CREATE TYPE estado_factura       AS ENUM ('PENDIENTE','EMITIDA','RECHAZADA_DIAN','ANULADA');
CREATE TYPE destinatario_plan    AS ENUM ('ALIADO','TUTOR');
CREATE TYPE estado_suscripcion   AS ENUM ('PENDIENTE_PAGO','ACTIVA','CANCELADA','VENCIDA');
CREATE TYPE estado_adopcion      AS ENUM ('DISPONIBLE','EN_PROCESO','ADOPTADA','RETIRADA');
CREATE TYPE estado_solicitud_adopcion AS ENUM ('ENVIADA','EN_REVISION','ENTREVISTA','APROBADA',
                                          'RECHAZADA','ADOPCION_COMPLETADA','CANCELADA');
CREATE TYPE tipo_media           AS ENUM ('FOTO','VIDEO');
CREATE TYPE canal_notificacion   AS ENUM ('CORREO','IN_APP','WHATSAPP');
CREATE TYPE estado_notificacion  AS ENUM ('PENDIENTE','ENVIADA','FALLIDA','CANCELADA');
CREATE TYPE tipo_pqrs            AS ENUM ('PETICION','QUEJA','RECLAMO','SUGERENCIA');
CREATE TYPE estado_pqrs          AS ENUM ('RECIBIDA','EN_PROCESO','RESPONDIDA','CERRADA');
CREATE TYPE accion_moderacion    AS ENUM ('APROBAR','RECHAZAR','SUSPENDER','REACTIVAR','OCULTAR','MARCAR','RESTAURAR');

-- =============================================================================
-- 2. CATÁLOGOS
-- =============================================================================
CREATE TABLE especie (
    id      smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre  text    NOT NULL UNIQUE,
    activa  boolean NOT NULL DEFAULT true
);

CREATE TABLE tipo_servicio (
    id                      smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre                  text    NOT NULL UNIQUE,
    -- true: el servicio produce un registro de consulta (historia clínica).
    -- false: baño/peluquería y similares, que solo generan cita.
    genera_historia_clinica boolean NOT NULL DEFAULT true,
    activo                  boolean NOT NULL DEFAULT true
);

CREATE TABLE categoria_producto (
    id        smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre    text NOT NULL UNIQUE,
    padre_id  smallint REFERENCES categoria_producto(id)
);

-- Listas cerradas de la anamnesis (valores propuestos; el cliente debe confirmarlos).
CREATE TABLE estado_mental (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre text NOT NULL UNIQUE
);
CREATE TABLE condicion_corporal (
    id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre text NOT NULL UNIQUE
);

-- Parámetros configurables sin tocar código (recordatorios, límites, flags).
CREATE TABLE parametro_plataforma (
    clave           text PRIMARY KEY,
    valor           jsonb       NOT NULL,
    descripcion     text,
    actualizado_por uuid,       -- FK se agrega después de crear `usuario`
    actualizado_en  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. USUARIOS, AUTENTICACIÓN Y CONSENTIMIENTOS      (E01 · HU-001..006)
-- =============================================================================
CREATE TABLE usuario (
    id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo                 text    NOT NULL,
    celular                         text    CHECK (celular ~ '^[0-9]{10}$'),
    correo                          citext  NOT NULL UNIQUE
                                    CHECK (correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    cedula                          text    UNIQUE,            -- opcional al registrarse; se exige en la historia clínica
    direccion                       text,
    password_hash                   text,                      -- NULL si solo entra con Google. Nunca texto plano.
    segundo_factor_activo           boolean NOT NULL DEFAULT false,
    segundo_factor_secreto_cifrado  text,
    correo_verificado_en            timestamptz,
    estado                          estado_cuenta NOT NULL DEFAULT 'PENDIENTE',
    acepta_publicidad               boolean NOT NULL DEFAULT false,   -- única notificación desactivable (9.5)
    acepta_whatsapp                 boolean NOT NULL DEFAULT false,
    ultimo_acceso_en                timestamptz,
    eliminado_en                    timestamptz,
    creado_en                       timestamptz NOT NULL DEFAULT now(),
    actualizado_en                  timestamptz NOT NULL DEFAULT now(),
    CHECK (estado = 'ELIMINADA' OR celular IS NOT NULL),
    CHECK (NOT segundo_factor_activo OR segundo_factor_secreto_cifrado IS NOT NULL)
);

ALTER TABLE parametro_plataforma
    ADD CONSTRAINT parametro_plataforma_actualizado_por_fk
    FOREIGN KEY (actualizado_por) REFERENCES usuario(id);

-- Inicio de sesión con Google u otro proveedor (HU-003): evita usuarios duplicados.
CREATE TABLE identidad_externa (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    proveedor   text NOT NULL CHECK (proveedor IN ('GOOGLE')),
    sujeto      text NOT NULL,                 -- `sub` del proveedor
    creado_en   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (proveedor, sujeto),
    UNIQUE (usuario_id, proveedor)
);

-- Códigos/enlaces de un solo uso: recuperar contraseña, segundo factor (HU-004/005).
CREATE TABLE token_verificacion (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    proposito    proposito_token NOT NULL,
    codigo_hash  text        NOT NULL,         -- se guarda el hash, no el código
    expira_en    timestamptz NOT NULL,
    usado_en     timestamptz,
    intentos     smallint    NOT NULL DEFAULT 0,
    creado_en    timestamptz NOT NULL DEFAULT now()
);

-- Quién del Equipo Veto es qué (verificador, soporte, admin).
CREATE TABLE equipo_veto (
    usuario_id  uuid PRIMARY KEY REFERENCES usuario(id),
    rol         rol_equipo_veto NOT NULL,
    activo      boolean NOT NULL DEFAULT true,
    creado_en   timestamptz NOT NULL DEFAULT now()
);

-- Ley 1581/2012: evidencia de autorización de tratamiento de datos y T&C.
CREATE TABLE consentimiento (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   uuid NOT NULL REFERENCES usuario(id),
    tipo         tipo_consentimiento NOT NULL,
    version      text    NOT NULL,             -- versión del documento aceptado
    aceptado     boolean NOT NULL,
    ip           inet,
    registrado_en timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. ALIADOS (clínica · veterinario independiente · tienda · fundación)
--                                                    (HU-007, 012..016, 078, 079)
-- =============================================================================
CREATE TABLE aliado (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                    tipo_aliado NOT NULL,          -- no cambia después del registro
    nombre_comercial        text   NOT NULL,
    razon_social            text,
    documento               text   NOT NULL UNIQUE,        -- NIT o cédula
    descripcion             text,
    logo_url                text,
    telefono_contacto       text,
    correo_contacto         citext,
    -- Verificación (la hace el Equipo Veto antes de que el aliado publique)
    estado_verificacion     estado_verificacion NOT NULL DEFAULT 'PENDIENTE',
    verificado_por          uuid REFERENCES usuario(id),
    verificado_en           timestamptz,
    motivo_rechazo          text,
    -- Estado operativo (suspensión por incumplimientos, HU-065)
    estado_operativo        estado_operativo NOT NULL DEFAULT 'ACTIVO',
    -- Configuración
    confirmacion_automatica boolean NOT NULL DEFAULT false, -- HU-023
    cobro_por_plataforma    boolean NOT NULL DEFAULT false, -- 5.5: ¿Veto cobra o solo conecta?
    creado_en               timestamptz NOT NULL DEFAULT now(),
    actualizado_en          timestamptz NOT NULL DEFAULT now(),
    CHECK (estado_verificacion <> 'RECHAZADO' OR motivo_rechazo IS NOT NULL),
    CHECK (estado_verificacion = 'PENDIENTE' OR (verificado_por IS NOT NULL AND verificado_en IS NOT NULL))
);

-- Documentos que respaldan la verificación (RUT, Cámara de Comercio, tarjeta profesional...)
CREATE TABLE aliado_documento (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id    uuid NOT NULL REFERENCES aliado(id) ON DELETE CASCADE,
    tipo         tipo_doc_aliado NOT NULL,
    archivo_clave text NOT NULL,                   -- clave en almacenamiento privado
    estado       estado_verificacion NOT NULL DEFAULT 'PENDIENTE',
    revisado_por uuid REFERENCES usuario(id),
    revisado_en  timestamptz,
    observacion  text,
    creado_en    timestamptz NOT NULL DEFAULT now()
);

-- Qué usuarios pertenecen a qué aliado y con qué rol (administrador de la clínica, etc.)
CREATE TABLE miembro_aliado (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id   uuid NOT NULL REFERENCES aliado(id) ON DELETE CASCADE,
    usuario_id  uuid NOT NULL REFERENCES usuario(id),
    rol         rol_aliado NOT NULL,
    activo      boolean NOT NULL DEFAULT true,
    creado_en   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (aliado_id, usuario_id)
);

CREATE TABLE veterinario (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id             uuid NOT NULL,
    usuario_id            uuid NOT NULL,
    matricula_profesional text NOT NULL UNIQUE,
    foto_url              text,                    -- HU-013
    descripcion           text,
    activo                boolean NOT NULL DEFAULT true,
    creado_en             timestamptz NOT NULL DEFAULT now(),
    actualizado_en        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, aliado_id),
    UNIQUE (aliado_id, usuario_id),
    FOREIGN KEY (aliado_id, usuario_id) REFERENCES miembro_aliado(aliado_id, usuario_id)
);

CREATE TABLE sede (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id   uuid NOT NULL REFERENCES aliado(id) ON DELETE CASCADE,
    nombre      text NOT NULL,
    direccion   text NOT NULL,
    ciudad      text NOT NULL DEFAULT 'Bogotá',
    localidad   text,
    latitud     numeric(9,6) CHECK (latitud  BETWEEN -90  AND 90),
    longitud    numeric(9,6) CHECK (longitud BETWEEN -180 AND 180),
    telefono    text,
    activa      boolean NOT NULL DEFAULT true,
    creado_en   timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, aliado_id)
);

-- Datos propios de la fundación (el nombre, logo y descripción están en `aliado`).
CREATE TABLE fundacion_perfil (
    aliado_id        uuid PRIMARY KEY REFERENCES aliado(id) ON DELETE CASCADE,
    ciudad           text NOT NULL,
    ubicacion        text NOT NULL,                -- PRIVADA: nunca sale en el catálogo público
    contacto_nombre  text NOT NULL,
    contacto_telefono text,
    contacto_correo  citext,
    anio_fundacion   smallint NOT NULL CHECK (anio_fundacion BETWEEN 1900 AND 2100),
    CHECK (contacto_telefono IS NOT NULL OR contacto_correo IS NOT NULL)
);

-- Especies que atiende cada aliado (HU-021, regla 5.1)
CREATE TABLE aliado_especie (
    aliado_id   uuid     NOT NULL REFERENCES aliado(id) ON DELETE CASCADE,
    especie_id  smallint NOT NULL REFERENCES especie(id),
    PRIMARY KEY (aliado_id, especie_id)
);

-- =============================================================================
-- 5. MASCOTAS DEL TUTOR                                   (E02 · HU-008..011)
-- =============================================================================
CREATE TABLE mascota (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id               uuid NOT NULL REFERENCES usuario(id),
    nombre                 text NOT NULL,
    especie_id             smallint NOT NULL REFERENCES especie(id),
    sexo                   sexo_animal NOT NULL,
    raza                   text,
    fecha_nacimiento       date,
    edad_aproximada_meses  smallint CHECK (edad_aproximada_meses >= 0),   -- si no se sabe la fecha
    color                  text,
    peso_kg                numeric(6,2) CHECK (peso_kg > 0),
    chip                   text UNIQUE,
    activa                 boolean NOT NULL DEFAULT true,
    anonimizada_en         timestamptz,
    creado_en              timestamptz NOT NULL DEFAULT now(),
    actualizado_en         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, tutor_id)
);

CREATE TABLE mascota_foto (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mascota_id  uuid NOT NULL REFERENCES mascota(id) ON DELETE CASCADE,
    url         text NOT NULL,
    orden       smallint NOT NULL DEFAULT 0
);

-- =============================================================================
-- 6. SERVICIOS, PRECIOS Y DISPONIBILIDAD        (E04/E05 · HU-016, 018..023)
-- =============================================================================
CREATE TABLE servicio (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id         uuid NOT NULL REFERENCES aliado(id),
    tipo_servicio_id  smallint NOT NULL REFERENCES tipo_servicio(id),
    nombre            text NOT NULL,
    descripcion       text,
    modalidad         modalidad_servicio NOT NULL,
    sede_id           uuid,                         -- ubicación; NULL si es solo a domicilio
    duracion_min      smallint NOT NULL DEFAULT 30 CHECK (duracion_min > 0),
    precio_base       numeric(12,2) NOT NULL CHECK (precio_base >= 0),
    activo            boolean NOT NULL DEFAULT true,  -- "desactivar" en vez de borrar (7.6)
    moderacion        estado_moderacion NOT NULL DEFAULT 'PUBLICADO',
    creado_en         timestamptz NOT NULL DEFAULT now(),
    actualizado_en    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, aliado_id),
    FOREIGN KEY (sede_id, aliado_id) REFERENCES sede(id, aliado_id),
    CHECK (modalidad = 'A_DOMICILIO' OR sede_id IS NOT NULL)
);

-- Precio variable por peso, edad o especie (HU-020). NULL = "cualquiera".
-- Gana la regla de mayor prioridad que aplique; si ninguna aplica, precio_base.
CREATE TABLE servicio_regla_precio (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    servicio_id      uuid NOT NULL REFERENCES servicio(id) ON DELETE CASCADE,
    especie_id       smallint REFERENCES especie(id),
    peso_min_kg      numeric(6,2),
    peso_max_kg      numeric(6,2),
    edad_min_meses   integer,
    edad_max_meses   integer,
    precio           numeric(12,2) NOT NULL CHECK (precio >= 0),
    prioridad        smallint NOT NULL DEFAULT 0,
    CHECK (peso_min_kg IS NULL OR peso_max_kg IS NULL OR peso_min_kg <= peso_max_kg),
    CHECK (edad_min_meses IS NULL OR edad_max_meses IS NULL OR edad_min_meses <= edad_max_meses)
);

-- Horario semanal recurrente del veterinario (si veterinario_id) o de la sede/aliado.
-- Cubre "diario, semanal, mensual" con vigencias; los casos puntuales van en excepcion_agenda.
CREATE TABLE horario_atencion (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id       uuid NOT NULL REFERENCES aliado(id) ON DELETE CASCADE,
    sede_id         uuid,
    veterinario_id  uuid,
    dia_semana      smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),   -- ISO: 1 = lunes
    hora_inicio     time NOT NULL,
    hora_fin        time NOT NULL,
    vigente_desde   date NOT NULL DEFAULT current_date,
    vigente_hasta   date,
    -- columnas calculadas para impedir franjas solapadas
    agenda_clave    uuid GENERATED ALWAYS AS (COALESCE(veterinario_id, sede_id, aliado_id)) STORED,
    franja          tsrange GENERATED ALWAYS AS
                    (tsrange(DATE '2000-01-03' + hora_inicio, DATE '2000-01-03' + hora_fin)) STORED,
    vigencia        daterange GENERATED ALWAYS AS (daterange(vigente_desde, vigente_hasta, '[]')) STORED,
    CHECK (hora_fin > hora_inicio),
    CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
    FOREIGN KEY (sede_id, aliado_id)        REFERENCES sede(id, aliado_id),
    FOREIGN KEY (veterinario_id, aliado_id) REFERENCES veterinario(id, aliado_id),
    CONSTRAINT horario_sin_solapamiento EXCLUDE USING gist
        (agenda_clave WITH =, dia_semana WITH =, franja WITH &&, vigencia WITH &&)
);

-- Bloqueos (vacaciones, incapacidad) o aperturas extra sobre el horario recurrente.
CREATE TABLE excepcion_agenda (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id       uuid NOT NULL REFERENCES aliado(id) ON DELETE CASCADE,
    veterinario_id  uuid,
    tipo            text NOT NULL CHECK (tipo IN ('BLOQUEO','APERTURA_EXTRA')),
    inicio          timestamptz NOT NULL,
    fin             timestamptz NOT NULL,
    motivo          text,
    creado_por      uuid REFERENCES usuario(id),
    creado_en       timestamptz NOT NULL DEFAULT now(),
    CHECK (fin > inicio),
    FOREIGN KEY (veterinario_id, aliado_id) REFERENCES veterinario(id, aliado_id)
);

-- =============================================================================
-- 7. CITAS                                             (E07 · HU-029..036)
-- =============================================================================
CREATE TABLE cita (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id          uuid NOT NULL REFERENCES usuario(id),
    mascota_id        uuid NOT NULL,
    aliado_id         uuid NOT NULL REFERENCES aliado(id),
    servicio_id       uuid NOT NULL,
    sede_id           uuid,
    veterinario_id    uuid,
    inicio            timestamptz NOT NULL,
    fin               timestamptz NOT NULL,
    modalidad         modalidad_servicio NOT NULL CHECK (modalidad <> 'AMBAS'),
    direccion_domicilio text,
    motivo            varchar(500),                  -- límite de caracteres por definir (HU-030)
    estado            estado_cita NOT NULL DEFAULT 'SOLICITADA',
    precio_acordado   numeric(12,2) NOT NULL CHECK (precio_acordado >= 0),  -- foto del precio al reservar
    recomendaciones   text,                          -- las escribe el aliado al cerrar (HU-033)
    cerrada_por       uuid REFERENCES usuario(id),   -- aliado que marcó FINALIZADA / NO_ASISTIO
    cerrada_en        timestamptz,
    cancelada_por     uuid REFERENCES usuario(id),
    cancelada_en      timestamptz,
    motivo_cancelacion text,
    penalidad         numeric(12,2) NOT NULL DEFAULT 0 CHECK (penalidad >= 0),
    reprogramada_veces smallint NOT NULL DEFAULT 0,
    clave_idempotencia text,                         -- evita duplicados por doble clic (HU-031)
    creado_en         timestamptz NOT NULL DEFAULT now(),
    actualizado_en    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, mascota_id),
    UNIQUE (id, tutor_id, aliado_id),
    UNIQUE (tutor_id, clave_idempotencia),
    FOREIGN KEY (mascota_id, tutor_id)      REFERENCES mascota(id, tutor_id),
    FOREIGN KEY (servicio_id, aliado_id)    REFERENCES servicio(id, aliado_id),
    FOREIGN KEY (sede_id, aliado_id)        REFERENCES sede(id, aliado_id),
    FOREIGN KEY (veterinario_id, aliado_id) REFERENCES veterinario(id, aliado_id),
    CHECK (fin > inicio),
    CHECK (modalidad <> 'A_DOMICILIO' OR direccion_domicilio IS NOT NULL),
    CHECK (modalidad <> 'EN_SEDE'     OR sede_id IS NOT NULL),
    CHECK (estado NOT IN ('FINALIZADA','NO_ASISTIO') OR (cerrada_por IS NOT NULL AND cerrada_en IS NOT NULL)),
    CHECK (estado <> 'CANCELADA' OR cancelada_en IS NOT NULL),
    -- Un veterinario no puede tener dos citas vigentes al mismo tiempo
    CONSTRAINT cita_sin_solapamiento EXCLUDE USING gist
        (veterinario_id WITH =, tstzrange(inicio, fin) WITH &&)
        WHERE (veterinario_id IS NOT NULL AND estado IN ('SOLICITADA','CONFIRMADA','EN_CURSO'))
);

-- Bitácora de cambios de estado de cita, pedido, pago, etc. (12.7). La llena un trigger.
CREATE TABLE historial_estado (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entidad          text NOT NULL,                  -- 'cita', 'pedido', 'pago', ...
    entidad_id       uuid NOT NULL,
    estado_anterior  text,
    estado_nuevo     text NOT NULL,
    cambiado_por     uuid REFERENCES usuario(id),
    motivo           text,
    cambiado_en      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 8. HISTORIA CLÍNICA / REGISTRO DE CONSULTA                  (E09 · HU-017, 037..043)
--    "Historia clínica" de una mascota = conjunto de sus consultas (v_historial_mascota).
-- =============================================================================
CREATE TABLE consulta (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id                  uuid NOT NULL UNIQUE REFERENCES cita(id),
    mascota_id               uuid NOT NULL,
    veterinario_id           uuid NOT NULL REFERENCES veterinario(id),   -- responsable (HU-017)
    fecha                    timestamptz NOT NULL DEFAULT now(),
    propietario_snapshot     jsonb,    -- nombre, cédula, celular, dirección, correo al momento de la consulta
    -- Anamnesis (HU-037)
    motivo_consulta          text NOT NULL,
    descripcion_propietario  text,
    estado_mental_id         smallint REFERENCES estado_mental(id),
    condicion_corporal_id    smallint REFERENCES condicion_corporal(id),
    comportamiento           text,
    estado_general           text,
    -- Registro clínico (HU-039)
    lista_problemas          text,
    diagnostico_presuntivo   text,
    tratamiento              text,
    examenes                 text,
    observaciones            text,
    -- Cierre (HU-042)
    estado                   estado_consulta NOT NULL DEFAULT 'ABIERTA',
    cerrada_en               timestamptz,
    cerrada_por              uuid REFERENCES usuario(id),
    creado_en                timestamptz NOT NULL DEFAULT now(),
    actualizado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, mascota_id),
    FOREIGN KEY (cita_id, mascota_id) REFERENCES cita(id, mascota_id),
    -- Para cerrar hacen falta: motivo, diagnóstico presuntivo y fecha (6.2)
    CHECK (estado = 'ABIERTA' OR (diagnostico_presuntivo IS NOT NULL
                                  AND cerrada_en IS NOT NULL AND cerrada_por IS NOT NULL))
);

CREATE TABLE signos_vitales (
    consulta_id             uuid PRIMARY KEY REFERENCES consulta(id),
    peso_kg                 numeric(6,2)  CHECK (peso_kg > 0),
    temperatura_c           numeric(4,1)  CHECK (temperatura_c BETWEEN 25 AND 45),
    frecuencia_cardiaca     smallint      CHECK (frecuencia_cardiaca > 0),
    frecuencia_respiratoria smallint      CHECK (frecuencia_respiratoria > 0),
    pulso                   smallint      CHECK (pulso > 0),
    mucosas                 text,
    llenado_capilar_seg     numeric(3,1)  CHECK (llenado_capilar_seg >= 0),
    glucemia_mg_dl          numeric(6,1)  CHECK (glucemia_mg_dl >= 0),     -- referencia (Recorvet)
    presion_sistolica       smallint      CHECK (presion_sistolica > 0),   -- referencia (Recorvet)
    presion_diastolica      smallint      CHECK (presion_diastolica > 0)
);

CREATE TABLE consulta_anexo (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id        uuid NOT NULL REFERENCES consulta(id),
    nombre_archivo     text NOT NULL,
    mime_type          text NOT NULL,
    tamano_bytes       bigint NOT NULL CHECK (tamano_bytes > 0),
    clave_almacenamiento text NOT NULL,              -- bucket privado, nunca URL pública (HU-040)
    subido_por         uuid REFERENCES usuario(id),
    creado_en          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE control_seguimiento (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id   uuid NOT NULL,
    mascota_id    uuid NOT NULL,
    fecha_control date NOT NULL,
    nota          text,
    estado        estado_control NOT NULL DEFAULT 'PROGRAMADO',
    cita_id       uuid REFERENCES cita(id),          -- cita en que se realizó el control
    creado_en     timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (consulta_id, mascota_id) REFERENCES consulta(id, mascota_id)
);

-- Correcciones a una consulta cerrada: solo se agregan, nunca se editan ni borran.
CREATE TABLE consulta_anotacion (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id uuid NOT NULL REFERENCES consulta(id),
    autor_id    uuid NOT NULL REFERENCES usuario(id),
    campo       text,                                 -- campo corregido, p. ej. 'tratamiento'
    texto       text NOT NULL,
    creado_en   timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 9. PRODUCTOS Y PEDIDOS                                 (E11 · HU-044..050)
-- =============================================================================
CREATE TABLE producto (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id        uuid NOT NULL REFERENCES aliado(id),
    categoria_id     smallint NOT NULL REFERENCES categoria_producto(id),
    nombre           text NOT NULL,
    descripcion      text,
    precio           numeric(12,2) NOT NULL CHECK (precio >= 0),
    impuesto_pct     numeric(4,2)  NOT NULL DEFAULT 0 CHECK (impuesto_pct BETWEEN 0 AND 100),
    stock            integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
    es_medicamento   boolean NOT NULL DEFAULT false,
    requiere_formula boolean NOT NULL DEFAULT false,  -- regla 5.7: pendiente de definición aparte
    activo           boolean NOT NULL DEFAULT true,
    moderacion       estado_moderacion NOT NULL DEFAULT 'PUBLICADO',
    creado_en        timestamptz NOT NULL DEFAULT now(),
    actualizado_en   timestamptz NOT NULL DEFAULT now(),
    CHECK (NOT requiere_formula OR es_medicamento)
);

CREATE TABLE producto_foto (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id  uuid NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    url          text NOT NULL,
    orden        smallint NOT NULL DEFAULT 0,
    moderacion   estado_moderacion NOT NULL DEFAULT 'PUBLICADO'
);

-- Un pedido pertenece a un solo aliado (si el carrito mezcla aliados, se divide en pedidos).
CREATE TABLE pedido (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id           uuid NOT NULL REFERENCES usuario(id),
    aliado_id          uuid NOT NULL REFERENCES aliado(id),
    estado             estado_pedido NOT NULL DEFAULT 'PENDIENTE_PAGO',
    metodo_entrega     metodo_entrega NOT NULL,       -- logística por definir (HU-050)
    direccion_entrega  text,
    referencia_envio   text,                          -- guía / transportadora
    subtotal           numeric(12,2) NOT NULL CHECK (subtotal >= 0),
    impuestos          numeric(12,2) NOT NULL DEFAULT 0 CHECK (impuestos >= 0),
    total              numeric(12,2) NOT NULL,
    notas              text,
    motivo_cancelacion text,
    clave_idempotencia text,
    despachado_en      timestamptz,
    entregado_en       timestamptz,
    cancelado_en       timestamptz,
    creado_en          timestamptz NOT NULL DEFAULT now(),
    actualizado_en     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tutor_id, clave_idempotencia),
    CHECK (total = subtotal + impuestos),
    CHECK (metodo_entrega <> 'DOMICILIO' OR direccion_entrega IS NOT NULL)
);

CREATE TABLE pedido_item (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id        uuid NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
    producto_id      uuid NOT NULL REFERENCES producto(id),
    nombre_producto  text NOT NULL,                   -- foto histórica: el producto puede cambiar
    cantidad         integer NOT NULL CHECK (cantidad > 0),
    precio_unitario  numeric(12,2) NOT NULL CHECK (precio_unitario >= 0),
    impuesto_pct     numeric(4,2)  NOT NULL DEFAULT 0,
    UNIQUE (pedido_id, producto_id)
);

-- =============================================================================
-- 10. PLANES, SUSCRIPCIONES, PAGOS Y FACTURACIÓN            (E15 · HU-055..060)
-- =============================================================================
CREATE TABLE plan (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo           text NOT NULL UNIQUE,
    nombre           text NOT NULL,
    destinatario     destinatario_plan NOT NULL,       -- ALIADO (suscripción) o TUTOR (Pro)
    precio_mensual   numeric(12,2) NOT NULL CHECK (precio_mensual >= 0),
    beneficios       jsonb NOT NULL DEFAULT '{}',      -- descuentos Pro: por definir (HU-058)
    activo           boolean NOT NULL DEFAULT true,
    vigente_desde    date NOT NULL DEFAULT current_date,
    vigente_hasta    date,
    creado_por       uuid REFERENCES usuario(id),
    creado_en        timestamptz NOT NULL DEFAULT now(),
    actualizado_en   timestamptz NOT NULL DEFAULT now(),
    CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);

CREATE TABLE suscripcion (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id               uuid NOT NULL REFERENCES plan(id),
    aliado_id             uuid REFERENCES aliado(id),
    usuario_id            uuid REFERENCES usuario(id),     -- tutor Pro
    estado                estado_suscripcion NOT NULL DEFAULT 'PENDIENTE_PAGO',
    inicio_en             timestamptz NOT NULL DEFAULT now(),
    periodo_actual_inicio timestamptz,
    periodo_actual_fin    timestamptz,
    cancelar_al_finalizar boolean NOT NULL DEFAULT false,
    cancelada_en          timestamptz,
    creado_en             timestamptz NOT NULL DEFAULT now(),
    actualizado_en        timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(aliado_id, usuario_id) = 1)
);
-- Una sola suscripción vigente por aliado o por tutor (evita duplicados, HU-055)
CREATE UNIQUE INDEX suscripcion_unica_aliado  ON suscripcion(aliado_id)
    WHERE aliado_id  IS NOT NULL AND estado IN ('PENDIENTE_PAGO','ACTIVA');
CREATE UNIQUE INDEX suscripcion_unica_usuario ON suscripcion(usuario_id)
    WHERE usuario_id IS NOT NULL AND estado IN ('PENDIENTE_PAGO','ACTIVA');

-- El pago apunta a UNA sola cosa: una cita, un pedido o una suscripción.
-- No guarda datos de tarjeta: solo la referencia de la pasarela (Wompi, PayU, ...).
CREATE TABLE pago (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pagador_id          uuid NOT NULL REFERENCES usuario(id),
    cita_id             uuid REFERENCES cita(id),
    pedido_id           uuid REFERENCES pedido(id),
    suscripcion_id      uuid REFERENCES suscripcion(id),
    monto               numeric(12,2) NOT NULL CHECK (monto > 0),
    moneda              char(3) NOT NULL DEFAULT 'COP',
    estado              estado_pago NOT NULL DEFAULT 'PENDIENTE',
    pasarela            text NOT NULL,
    referencia_pasarela text,
    metodo              text,                          -- 'PSE', 'TARJETA', 'NEQUI'... sin números
    aprobado_en         timestamptz,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (pasarela, referencia_pasarela),
    CHECK (num_nonnulls(cita_id, pedido_id, suscripcion_id) = 1)
);

CREATE TABLE reembolso (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pago_id             uuid NOT NULL REFERENCES pago(id),
    monto               numeric(12,2) NOT NULL CHECK (monto > 0),
    motivo              text NOT NULL,
    estado              estado_reembolso NOT NULL DEFAULT 'PENDIENTE',
    referencia_pasarela text,
    solicitado_por      uuid REFERENCES usuario(id),
    creado_en           timestamptz NOT NULL DEFAULT now()
);

-- Porcentaje de comisión vigente (2 % a 5 %). General o por aliado (HU-056/059).
CREATE TABLE comision_config (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aplica_a       text NOT NULL CHECK (aplica_a IN ('VENTA','SERVICIO')),
    aliado_id      uuid REFERENCES aliado(id),         -- NULL = tarifa general
    porcentaje     numeric(4,2) NOT NULL CHECK (porcentaje BETWEEN 2 AND 5),
    vigente_desde  date NOT NULL,
    vigente_hasta  date,
    creado_por     uuid REFERENCES usuario(id),
    creado_en      timestamptz NOT NULL DEFAULT now(),
    CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
    CONSTRAINT comision_sin_solapamiento EXCLUDE USING gist
        (aplica_a WITH =,
         (COALESCE(aliado_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
         daterange(vigente_desde, vigente_hasta, '[]') WITH &&)
);

-- Comisión realmente cobrada sobre un pago. Se verifica base × porcentaje (redondeo a 2 decimales).
CREATE TABLE comision (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pago_id     uuid NOT NULL UNIQUE REFERENCES pago(id),
    aliado_id   uuid NOT NULL REFERENCES aliado(id),
    base        numeric(12,2) NOT NULL CHECK (base > 0),
    porcentaje  numeric(4,2)  NOT NULL CHECK (porcentaje BETWEEN 2 AND 5),
    monto       numeric(12,2) NOT NULL,
    creado_en   timestamptz NOT NULL DEFAULT now(),
    CHECK (monto = round(base * porcentaje / 100, 2))
);

-- Factura electrónica emitida a través de un proveedor tecnológico autorizado por la DIAN.
CREATE TABLE factura_electronica (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pago_id              uuid NOT NULL REFERENCES pago(id),
    emisor_aliado_id     uuid REFERENCES aliado(id),    -- NULL = factura emitida por Veto
    proveedor            text NOT NULL,
    prefijo              text,
    numero               text,
    cufe                 text UNIQUE,
    estado               estado_factura NOT NULL DEFAULT 'PENDIENTE',
    receptor_nombre      text NOT NULL,
    receptor_documento   text NOT NULL,
    subtotal             numeric(12,2) NOT NULL,
    impuestos            numeric(12,2) NOT NULL DEFAULT 0,
    total                numeric(12,2) NOT NULL,
    pdf_url              text,
    xml_url              text,
    respuesta_proveedor  jsonb,
    emitida_en           timestamptz,
    creado_en            timestamptz NOT NULL DEFAULT now(),
    CHECK (total = subtotal + impuestos),
    CHECK (estado <> 'EMITIDA' OR (cufe IS NOT NULL AND numero IS NOT NULL AND emitida_en IS NOT NULL))
);
CREATE UNIQUE INDEX factura_numero_unico ON factura_electronica
    ((COALESCE(emisor_aliado_id, '00000000-0000-0000-0000-000000000000'::uuid)), prefijo, numero)
    WHERE numero IS NOT NULL;

-- =============================================================================
-- 11. RESEÑAS                                               (E16 · HU-061..064)
-- =============================================================================
CREATE TABLE resena (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id      uuid NOT NULL UNIQUE,                 -- una reseña por cita
    tutor_id     uuid NOT NULL,
    aliado_id    uuid NOT NULL,
    calificacion smallint NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
    comentario   text,
    moderacion   estado_moderacion NOT NULL DEFAULT 'PUBLICADO',
    creado_en    timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (cita_id, tutor_id, aliado_id) REFERENCES cita(id, tutor_id, aliado_id)
);

-- =============================================================================
-- 12. ADOPCIÓN                                            (E19..E24 · HU-078..095)
-- =============================================================================
-- Privacidad: la fundación y su dirección NUNCA aparecen en el catálogo público.
-- La app pública debe leer v_catalogo_adopcion, que no expone `fundacion_id`.
CREATE TABLE mascota_adopcion (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fundacion_id    uuid NOT NULL REFERENCES aliado(id),
    nombre          text NOT NULL,
    especie_id      smallint NOT NULL REFERENCES especie(id),
    edad_meses      smallint NOT NULL CHECK (edad_meses >= 0),
    sexo            sexo_animal NOT NULL,
    tamano          tamano_mascota NOT NULL,
    ciudad          text NOT NULL,                     -- pública
    zona            text,                              -- pública (barrio/localidad), nunca la dirección
    descripcion     text,
    estado          estado_adopcion NOT NULL DEFAULT 'DISPONIBLE',
    pausada         boolean NOT NULL DEFAULT false,    -- HU-082: pausar publicación
    creado_en       timestamptz NOT NULL DEFAULT now(),
    actualizado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE adopcion_media (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mascota_adopcion_id  uuid NOT NULL REFERENCES mascota_adopcion(id) ON DELETE CASCADE,
    tipo                 tipo_media NOT NULL DEFAULT 'FOTO',
    url                  text NOT NULL,
    orden                smallint NOT NULL DEFAULT 0,
    moderacion           estado_moderacion NOT NULL DEFAULT 'PUBLICADO'
);

-- Formulario por pasos (HU-090). Las respuestas viven en JSONB porque el formulario
-- puede evolucionar sin migraciones; `version_formulario` dice con qué campos se llenó.
CREATE TABLE solicitud_adopcion (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mascota_adopcion_id  uuid NOT NULL REFERENCES mascota_adopcion(id),
    tutor_id             uuid NOT NULL REFERENCES usuario(id),
    estado               estado_solicitud_adopcion NOT NULL DEFAULT 'ENVIADA',
    version_formulario   smallint NOT NULL DEFAULT 1,
    datos_personales     jsonb NOT NULL,
    hogar_experiencia    jsonb NOT NULL,
    motivacion           text  NOT NULL,
    calificacion         smallint CHECK (calificacion BETWEEN 1 AND 5),   -- puntaje de la fundación
    motivo_decision      text,
    decidido_por         uuid REFERENCES usuario(id),
    decidido_en          timestamptz,
    clave_idempotencia   text,
    creado_en            timestamptz NOT NULL DEFAULT now(),
    actualizado_en       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tutor_id, clave_idempotencia),
    CHECK (estado <> 'RECHAZADA' OR motivo_decision IS NOT NULL)
);
-- Un tutor no puede tener dos solicitudes activas para la misma mascota
CREATE UNIQUE INDEX solicitud_adopcion_activa_unica
    ON solicitud_adopcion(mascota_adopcion_id, tutor_id)
    WHERE estado NOT IN ('CANCELADA','RECHAZADA');

-- =============================================================================
-- 13. COMUNICACIÓN: chat, notificaciones, PQRS     (E13/E17 · HU-051..054, 068..069)
-- =============================================================================
CREATE TABLE conversacion (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id   uuid NOT NULL REFERENCES usuario(id),
    aliado_id  uuid NOT NULL REFERENCES aliado(id),
    creado_en  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tutor_id, aliado_id)
);

CREATE TABLE mensaje (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id  uuid NOT NULL REFERENCES conversacion(id) ON DELETE CASCADE,
    emisor_id        uuid NOT NULL REFERENCES usuario(id),
    cuerpo           text NOT NULL CHECK (length(cuerpo) BETWEEN 1 AND 2000),
    creado_en        timestamptz NOT NULL DEFAULT now(),
    leido_en         timestamptz
);

-- Cola de notificaciones: sirve para correo, in-app y WhatsApp, y para recordatorios
-- programados (`programada_para`). Un recordatorio obsoleto se pasa a CANCELADA.
CREATE TABLE notificacion (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id       uuid NOT NULL REFERENCES usuario(id),
    tipo             text NOT NULL,                    -- 'CITA_AGENDADA', 'RECORDATORIO_CITA', ...
    canal            canal_notificacion NOT NULL,
    asunto           text,
    cuerpo           text NOT NULL,
    datos            jsonb NOT NULL DEFAULT '{}',
    referencia_tipo  text,                             -- 'cita', 'pedido', ...
    referencia_id    uuid,
    es_publicidad    boolean NOT NULL DEFAULT false,
    estado           estado_notificacion NOT NULL DEFAULT 'PENDIENTE',
    programada_para  timestamptz NOT NULL DEFAULT now(),
    enviada_en       timestamptz,
    leida_en         timestamptz,
    intentos         smallint NOT NULL DEFAULT 0,
    ultimo_error     text,
    clave_dedupe     text UNIQUE,                      -- 'recordatorio:<cita_id>' evita duplicados
    creado_en        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pqrs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    radicado         bigint GENERATED ALWAYS AS IDENTITY UNIQUE,   -- número de seguimiento
    usuario_id       uuid NOT NULL REFERENCES usuario(id),
    tipo             tipo_pqrs NOT NULL,
    asunto           text NOT NULL,
    descripcion      text NOT NULL,
    cita_id          uuid REFERENCES cita(id),
    pedido_id        uuid REFERENCES pedido(id),
    estado           estado_pqrs NOT NULL DEFAULT 'RECIBIDA',
    asignada_a       uuid REFERENCES usuario(id),
    cerrada_en       timestamptz,
    creado_en        timestamptz NOT NULL DEFAULT now(),
    actualizado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pqrs_seguimiento (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pqrs_id          uuid NOT NULL REFERENCES pqrs(id) ON DELETE CASCADE,
    autor_id         uuid NOT NULL REFERENCES usuario(id),
    mensaje          text NOT NULL,
    visible_usuario  boolean NOT NULL DEFAULT true,    -- false = nota interna
    creado_en        timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 14. ADMINISTRACIÓN Y AUDITORÍA                          (E17 · HU-063, 065..067)
-- =============================================================================
-- Acciones del Equipo Veto: suspender aliado, moderar reseña/servicio/producto, etc.
CREATE TABLE accion_administrativa (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id       uuid NOT NULL REFERENCES usuario(id),
    objetivo_tipo  text NOT NULL,                      -- 'aliado', 'resena', 'servicio', 'producto', 'usuario'...
    objetivo_id    uuid NOT NULL,
    accion         accion_moderacion NOT NULL,
    motivo         text,
    creado_en      timestamptz NOT NULL DEFAULT now()
);

-- Auditoría de cambios campo a campo (antes/después). La llena un trigger.
-- Los datos personales y secretos se redactan para poder cumplir la Ley 1581.
CREATE TABLE auditoria (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tabla          text NOT NULL,
    registro_id    text NOT NULL,
    accion         char(1) NOT NULL CHECK (accion IN ('I','U','D')),
    usuario_id     uuid,
    datos_antes    jsonb,
    datos_despues  jsonb,
    creado_en      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 15. ÍNDICES
-- =============================================================================
CREATE INDEX ON miembro_aliado (usuario_id);
CREATE INDEX ON sede (aliado_id);
CREATE INDEX ON sede (localidad) WHERE activa;
CREATE INDEX ON mascota (tutor_id);
CREATE INDEX ON servicio (aliado_id) WHERE activo;
CREATE INDEX ON servicio (tipo_servicio_id) WHERE activo;
CREATE INDEX ON servicio USING gin (nombre gin_trgm_ops);
CREATE INDEX ON aliado  USING gin (nombre_comercial gin_trgm_ops);
CREATE INDEX ON producto (aliado_id) WHERE activo;
CREATE INDEX ON producto (categoria_id) WHERE activo;
CREATE INDEX ON producto USING gin (nombre gin_trgm_ops);
CREATE INDEX ON horario_atencion (aliado_id);
CREATE INDEX ON excepcion_agenda (aliado_id, inicio);
CREATE INDEX ON cita (tutor_id, inicio DESC);
CREATE INDEX ON cita (aliado_id, inicio);
CREATE INDEX ON cita (veterinario_id, inicio);
CREATE INDEX ON cita (mascota_id);
CREATE INDEX ON cita (estado, inicio);
CREATE INDEX ON consulta (mascota_id, fecha DESC);
CREATE INDEX ON consulta (veterinario_id);
CREATE INDEX ON consulta_anotacion (consulta_id);
CREATE INDEX ON control_seguimiento (mascota_id, fecha_control) WHERE estado = 'PROGRAMADO';
CREATE INDEX ON pedido (tutor_id, creado_en DESC);
CREATE INDEX ON pedido (aliado_id, estado);
CREATE INDEX ON pago (cita_id)        WHERE cita_id IS NOT NULL;
CREATE INDEX ON pago (pedido_id)      WHERE pedido_id IS NOT NULL;
CREATE INDEX ON pago (suscripcion_id) WHERE suscripcion_id IS NOT NULL;
CREATE INDEX ON resena (aliado_id) WHERE moderacion = 'PUBLICADO';
CREATE INDEX ON mascota_adopcion (fundacion_id);
CREATE INDEX ON mascota_adopcion (especie_id, tamano) WHERE estado = 'DISPONIBLE' AND NOT pausada;
CREATE INDEX ON solicitud_adopcion (mascota_adopcion_id);
CREATE INDEX ON solicitud_adopcion (tutor_id);
CREATE INDEX ON mensaje (conversacion_id, creado_en);
CREATE INDEX ON notificacion (usuario_id, creado_en DESC);
CREATE INDEX ON notificacion (programada_para) WHERE estado = 'PENDIENTE';
CREATE INDEX ON pqrs (usuario_id);
CREATE INDEX ON pqrs (estado) WHERE estado <> 'CERRADA';
CREATE INDEX ON historial_estado (entidad, entidad_id, cambiado_en);
CREATE INDEX ON auditoria (tabla, registro_id);
CREATE INDEX ON auditoria (creado_en);
CREATE INDEX ON accion_administrativa (objetivo_tipo, objetivo_id);

-- =============================================================================
-- 16. FUNCIONES Y TRIGGERS (reglas de negocio que la base de datos garantiza)
-- =============================================================================

-- 16.1 Fecha de modificación automática (todas las tablas con `actualizado_en`)
CREATE FUNCTION fn_set_actualizado_en() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.columns
             WHERE table_schema = 'veto' AND column_name = 'actualizado_en'
    LOOP
        EXECUTE format('CREATE TRIGGER trg_%1$s_actualizado BEFORE UPDATE ON %1$I
                        FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en()', t);
    END LOOP;
END $$;

-- 16.2 Tablas de solo inserción (no se editan ni borran)
CREATE FUNCTION fn_solo_insertar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo inserción: no admite % ', TG_TABLE_NAME, TG_OP
        USING ERRCODE = '55000';
END $$;

CREATE TRIGGER trg_auditoria_inmutable      BEFORE UPDATE OR DELETE ON auditoria
    FOR EACH ROW EXECUTE FUNCTION fn_solo_insertar();
CREATE TRIGGER trg_historial_estado_inmutable BEFORE UPDATE OR DELETE ON historial_estado
    FOR EACH ROW EXECUTE FUNCTION fn_solo_insertar();
CREATE TRIGGER trg_consulta_anotacion_inmutable BEFORE UPDATE OR DELETE ON consulta_anotacion
    FOR EACH ROW EXECUTE FUNCTION fn_solo_insertar();
CREATE TRIGGER trg_accion_admin_inmutable   BEFORE UPDATE OR DELETE ON accion_administrativa
    FOR EACH ROW EXECUTE FUNCTION fn_solo_insertar();
CREATE TRIGGER trg_consentimiento_inmutable BEFORE UPDATE OR DELETE ON consentimiento
    FOR EACH ROW EXECUTE FUNCTION fn_solo_insertar();

-- 16.3 Historial de estados (quién, cuándo, de qué a qué). Uso: EXECUTE FUNCTION fn_registrar_estado('cita')
CREATE FUNCTION fn_registrar_estado() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_nuevo text := to_jsonb(NEW)->>'estado';
    v_viejo text;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        v_viejo := to_jsonb(OLD)->>'estado';
        IF v_viejo IS NOT DISTINCT FROM v_nuevo THEN RETURN NEW; END IF;
    END IF;
    INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, cambiado_por, motivo)
    VALUES (TG_ARGV[0], (to_jsonb(NEW)->>'id')::uuid, v_viejo, v_nuevo,
            nullif(current_setting('app.usuario_id', true), '')::uuid,
            nullif(current_setting('app.motivo', true), ''));
    RETURN NEW;
END $$;

CREATE TRIGGER trg_cita_historial   AFTER INSERT OR UPDATE ON cita
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('cita');
CREATE TRIGGER trg_pedido_historial AFTER INSERT OR UPDATE ON pedido
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('pedido');
CREATE TRIGGER trg_pago_historial   AFTER INSERT OR UPDATE ON pago
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('pago');
CREATE TRIGGER trg_suscripcion_historial AFTER INSERT OR UPDATE ON suscripcion
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('suscripcion');
CREATE TRIGGER trg_solicitud_adopcion_historial AFTER INSERT OR UPDATE ON solicitud_adopcion
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('solicitud_adopcion');
CREATE TRIGGER trg_mascota_adopcion_historial AFTER INSERT OR UPDATE ON mascota_adopcion
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('mascota_adopcion');
CREATE TRIGGER trg_pqrs_historial   AFTER INSERT OR UPDATE ON pqrs
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('pqrs');

-- 16.4 Auditoría campo a campo. Args: (columna_pk, 'col1,col2' a redactar)
CREATE FUNCTION fn_auditar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_pk       text   := COALESCE(TG_ARGV[0], 'id');
    v_redactar text[] := string_to_array(COALESCE(TG_ARGV[1], ''), ',');
    v_antes    jsonb;
    v_despues  jsonb;
BEGIN
    IF TG_OP IN ('UPDATE','DELETE') THEN v_antes   := to_jsonb(OLD) - v_redactar; END IF;
    IF TG_OP IN ('INSERT','UPDATE') THEN v_despues := to_jsonb(NEW) - v_redactar; END IF;
    INSERT INTO auditoria (tabla, registro_id, accion, usuario_id, datos_antes, datos_despues)
    VALUES (TG_TABLE_NAME, COALESCE(v_despues, v_antes)->>v_pk, left(TG_OP, 1),
            nullif(current_setting('app.usuario_id', true), '')::uuid, v_antes, v_despues);
    RETURN NULL;
END $$;

CREATE TRIGGER trg_usuario_auditoria AFTER INSERT OR UPDATE OR DELETE ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_auditar('id',
        'password_hash,segundo_factor_secreto_cifrado,nombre_completo,celular,correo,cedula,direccion');
CREATE TRIGGER trg_aliado_auditoria  AFTER INSERT OR UPDATE OR DELETE ON aliado
    FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER trg_cita_auditoria    AFTER INSERT OR UPDATE OR DELETE ON cita
    FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER trg_consulta_auditoria AFTER INSERT OR UPDATE OR DELETE ON consulta
    FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER trg_signos_auditoria  AFTER INSERT OR UPDATE OR DELETE ON signos_vitales
    FOR EACH ROW EXECUTE FUNCTION fn_auditar('consulta_id');
CREATE TRIGGER trg_pedido_auditoria  AFTER INSERT OR UPDATE OR DELETE ON pedido
    FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER trg_pago_auditoria    AFTER INSERT OR UPDATE OR DELETE ON pago
    FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER trg_suscripcion_auditoria AFTER INSERT OR UPDATE OR DELETE ON suscripcion
    FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER trg_plan_auditoria    AFTER INSERT OR UPDATE OR DELETE ON plan
    FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER trg_comision_config_auditoria AFTER INSERT OR UPDATE OR DELETE ON comision_config
    FOR EACH ROW EXECUTE FUNCTION fn_auditar();
CREATE TRIGGER trg_parametro_auditoria AFTER INSERT OR UPDATE OR DELETE ON parametro_plataforma
    FOR EACH ROW EXECUTE FUNCTION fn_auditar('clave');
CREATE TRIGGER trg_solicitud_adopcion_auditoria AFTER INSERT OR UPDATE OR DELETE ON solicitud_adopcion
    FOR EACH ROW EXECUTE FUNCTION fn_auditar();

-- 16.5 El aliado debe ser del tipo correcto (p. ej. la tienda no ofrece servicios de salud, 5.7)
--      Args: (columna_aliado, 'TIPO1,TIPO2', ['verificado'])
CREATE FUNCTION fn_validar_tipo_aliado() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_aliado uuid := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
    v_tipo   tipo_aliado;
    v_verif  estado_verificacion;
BEGIN
    SELECT tipo, estado_verificacion INTO v_tipo, v_verif FROM aliado WHERE id = v_aliado;
    IF NOT FOUND OR v_tipo::text <> ALL (string_to_array(TG_ARGV[1], ',')) THEN
        RAISE EXCEPTION 'Un aliado de tipo % no puede registrar datos en %', v_tipo, TG_TABLE_NAME
            USING ERRCODE = '23514';
    END IF;
    IF TG_ARGV[2] = 'verificado' AND v_verif <> 'APROBADO' THEN
        RAISE EXCEPTION 'El aliado debe estar aprobado por el Equipo Veto antes de publicar'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_servicio_tipo_aliado BEFORE INSERT OR UPDATE OF aliado_id ON servicio
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('aliado_id', 'CLINICA,VET_INDEPENDIENTE');
CREATE TRIGGER trg_veterinario_tipo_aliado BEFORE INSERT OR UPDATE OF aliado_id ON veterinario
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('aliado_id', 'CLINICA,VET_INDEPENDIENTE');
CREATE TRIGGER trg_producto_tipo_aliado BEFORE INSERT OR UPDATE OF aliado_id ON producto
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('aliado_id', 'CLINICA,VET_INDEPENDIENTE,TIENDA');
CREATE TRIGGER trg_fundacion_perfil_tipo BEFORE INSERT OR UPDATE OF aliado_id ON fundacion_perfil
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('aliado_id', 'FUNDACION');
CREATE TRIGGER trg_mascota_adopcion_tipo BEFORE INSERT OR UPDATE OF fundacion_id ON mascota_adopcion
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('fundacion_id', 'FUNDACION', 'verificado');
CREATE TRIGGER trg_conversacion_tipo_aliado BEFORE INSERT OR UPDATE OF aliado_id ON conversacion
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('aliado_id', 'CLINICA,VET_INDEPENDIENTE,TIENDA');

-- Un veterinario independiente tiene un único perfil de veterinario
CREATE FUNCTION fn_veterinario_independiente_unico() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM aliado WHERE id = NEW.aliado_id AND tipo = 'VET_INDEPENDIENTE')
       AND EXISTS (SELECT 1 FROM veterinario WHERE aliado_id = NEW.aliado_id AND id <> NEW.id) THEN
        RAISE EXCEPTION 'Un veterinario independiente solo puede tener un perfil de veterinario'
            USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_veterinario_unico BEFORE INSERT ON veterinario
    FOR EACH ROW EXECUTE FUNCTION fn_veterinario_independiente_unico();

-- 16.6 Reglas de la cita: disponibilidad del servicio, especie atendida, ciclo de estados,
--      y "solo el aliado puede finalizar" (5.4)
CREATE FUNCTION fn_cita_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_ok boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado NOT IN ('SOLICITADA','CONFIRMADA') THEN
            RAISE EXCEPTION 'Una cita nueva solo puede iniciar como SOLICITADA o CONFIRMADA' USING ERRCODE = '23514';
        END IF;
        IF NEW.inicio <= now() THEN
            RAISE EXCEPTION 'No se pueden agendar citas en el pasado' USING ERRCODE = '23514';
        END IF;
        SELECT s.activo AND s.moderacion = 'PUBLICADO'
               AND a.estado_verificacion = 'APROBADO' AND a.estado_operativo = 'ACTIVO'
          INTO v_ok
          FROM servicio s JOIN aliado a ON a.id = s.aliado_id
         WHERE s.id = NEW.servicio_id;
        IF NOT COALESCE(v_ok, false) THEN
            RAISE EXCEPTION 'El servicio no está disponible para reservas' USING ERRCODE = '23514';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM mascota m
                       JOIN aliado_especie ae ON ae.especie_id = m.especie_id
                       WHERE m.id = NEW.mascota_id AND m.activa AND ae.aliado_id = NEW.aliado_id) THEN
            RAISE EXCEPTION 'El aliado no atiende la especie de esta mascota' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF OLD.estado IN ('FINALIZADA','CANCELADA','NO_ASISTIO')
       AND (NEW.estado <> OLD.estado OR NEW.inicio <> OLD.inicio OR NEW.fin <> OLD.fin) THEN
        RAISE EXCEPTION 'La cita está en estado final (%) y no admite más cambios', OLD.estado
            USING ERRCODE = '55000';
    END IF;

    IF NEW.estado <> OLD.estado THEN
        IF NOT ((OLD.estado = 'SOLICITADA' AND NEW.estado IN ('CONFIRMADA','CANCELADA'))
             OR (OLD.estado = 'CONFIRMADA' AND NEW.estado IN ('EN_CURSO','FINALIZADA','CANCELADA','NO_ASISTIO'))
             OR (OLD.estado = 'EN_CURSO'   AND NEW.estado IN ('FINALIZADA','CANCELADA'))) THEN
            RAISE EXCEPTION 'Transición de estado no permitida: % -> %', OLD.estado, NEW.estado
                USING ERRCODE = '23514';
        END IF;
        IF NEW.estado IN ('FINALIZADA','NO_ASISTIO') THEN
            IF NEW.cerrada_por IS NULL OR NOT EXISTS (
                   SELECT 1 FROM miembro_aliado
                    WHERE aliado_id = NEW.aliado_id AND usuario_id = NEW.cerrada_por AND activo) THEN
                RAISE EXCEPTION 'Solo un usuario del aliado puede marcar la cita como % ', NEW.estado
                    USING ERRCODE = '42501';
            END IF;
            NEW.cerrada_en := COALESCE(NEW.cerrada_en, now());
        ELSIF NEW.estado = 'CANCELADA' THEN
            NEW.cancelada_en := COALESCE(NEW.cancelada_en, now());
        END IF;
    END IF;

    IF NEW.inicio <> OLD.inicio THEN
        NEW.reprogramada_veces := OLD.reprogramada_veces + 1;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_cita_validar BEFORE INSERT OR UPDATE ON cita
    FOR EACH ROW EXECUTE FUNCTION fn_cita_validar();

-- 16.7 Reglas de la consulta clínica
CREATE FUNCTION fn_consulta_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_cita_aliado uuid;
    v_estado      estado_cita;
    v_genera      boolean;
BEGIN
    SELECT c.aliado_id, c.estado, t.genera_historia_clinica
      INTO v_cita_aliado, v_estado, v_genera
      FROM cita c
      JOIN servicio s ON s.id = c.servicio_id
      JOIN tipo_servicio t ON t.id = s.tipo_servicio_id
     WHERE c.id = NEW.cita_id;
    IF NOT COALESCE(v_genera, false) THEN
        RAISE EXCEPTION 'El tipo de servicio de la cita no genera historia clínica' USING ERRCODE = '23514';
    END IF;
    IF v_estado NOT IN ('CONFIRMADA','EN_CURSO','FINALIZADA') THEN
        RAISE EXCEPTION 'La cita debe estar confirmada, en curso o finalizada para registrar la consulta'
            USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM veterinario WHERE id = NEW.veterinario_id AND aliado_id = v_cita_aliado) THEN
        RAISE EXCEPTION 'El veterinario responsable debe pertenecer al aliado que atiende la cita'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_consulta_validar BEFORE INSERT ON consulta
    FOR EACH ROW EXECUTE FUNCTION fn_consulta_validar();

-- Una consulta cerrada no se edita ni se borra; se corrige con consulta_anotacion (HU-042).
-- Una consulta abierta tampoco se borra: la historia clínica no se elimina.
CREATE FUNCTION fn_consulta_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Las consultas clínicas no se eliminan' USING ERRCODE = '55000';
    END IF;
    IF OLD.estado = 'CERRADA' THEN
        RAISE EXCEPTION 'La consulta % está cerrada: registre una anotación de corrección', OLD.id
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_consulta_inmutable BEFORE UPDATE OR DELETE ON consulta
    FOR EACH ROW EXECUTE FUNCTION fn_consulta_inmutable();

-- Signos vitales y anexos congelados cuando la consulta se cierra.
CREATE FUNCTION fn_consulta_hijos_inmutables() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_consulta uuid;
BEGIN
    v_consulta := CASE WHEN TG_OP = 'DELETE' THEN OLD.consulta_id ELSE NEW.consulta_id END;
    IF EXISTS (SELECT 1 FROM consulta WHERE id = v_consulta AND estado = 'CERRADA') THEN
        RAISE EXCEPTION 'La consulta está cerrada: use una anotación de corrección' USING ERRCODE = '55000';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER trg_signos_inmutables BEFORE INSERT OR UPDATE OR DELETE ON signos_vitales
    FOR EACH ROW EXECUTE FUNCTION fn_consulta_hijos_inmutables();
CREATE TRIGGER trg_anexo_inmutable BEFORE INSERT OR UPDATE OR DELETE ON consulta_anexo
    FOR EACH ROW EXECUTE FUNCTION fn_consulta_hijos_inmutables();

-- 16.8 Reseña: solo sobre una cita FINALIZADA (HU-061)
CREATE FUNCTION fn_resena_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cita WHERE id = NEW.cita_id AND estado = 'FINALIZADA') THEN
        RAISE EXCEPTION 'Solo se puede reseñar una cita finalizada' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_resena_validar BEFORE INSERT ON resena
    FOR EACH ROW EXECUTE FUNCTION fn_resena_validar();

-- 16.9 Pedido: no se cancela después de despachado (HU-049) y el stock se descuenta al
--      pagar y se devuelve si se cancela antes del despacho.
CREATE FUNCTION fn_pedido_estado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;

    IF NEW.estado = 'CANCELADO' AND OLD.estado IN ('DESPACHADO','ENTREGADO','CANCELADO') THEN
        RAISE EXCEPTION 'Un pedido en estado % no se puede cancelar', OLD.estado USING ERRCODE = '23514';
    END IF;
    IF OLD.estado = 'CANCELADO' THEN
        RAISE EXCEPTION 'Un pedido cancelado no se puede reactivar' USING ERRCODE = '23514';
    END IF;

    IF OLD.estado = 'PENDIENTE_PAGO' AND NEW.estado = 'PAGADO' THEN
        -- Si no hay stock suficiente, el CHECK (stock >= 0) aborta la transacción.
        UPDATE producto p SET stock = p.stock - i.cantidad
          FROM pedido_item i WHERE i.pedido_id = NEW.id AND p.id = i.producto_id;
    ELSIF NEW.estado = 'CANCELADO' AND OLD.estado <> 'PENDIENTE_PAGO' THEN
        UPDATE producto p SET stock = p.stock + i.cantidad
          FROM pedido_item i WHERE i.pedido_id = NEW.id AND p.id = i.producto_id;
    END IF;

    IF NEW.estado = 'DESPACHADO' THEN NEW.despachado_en := COALESCE(NEW.despachado_en, now()); END IF;
    IF NEW.estado = 'ENTREGADO'  THEN NEW.entregado_en  := COALESCE(NEW.entregado_en,  now()); END IF;
    IF NEW.estado = 'CANCELADO'  THEN NEW.cancelado_en  := COALESCE(NEW.cancelado_en,  now()); END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_pedido_estado BEFORE UPDATE OF estado ON pedido
    FOR EACH ROW EXECUTE FUNCTION fn_pedido_estado();

-- 16.10 Precio de un servicio para una mascota concreta (HU-020).
--       Datos faltantes en la mascota (p. ej. sin peso) → la regla no aplica → precio_base.
CREATE FUNCTION fn_precio_servicio(p_servicio uuid, p_mascota uuid) RETURNS numeric
LANGUAGE sql STABLE AS $$
    WITH m AS (
        SELECT especie_id, peso_kg,
               CASE WHEN fecha_nacimiento IS NOT NULL
                    THEN (EXTRACT(YEAR  FROM age(current_date, fecha_nacimiento)) * 12
                        + EXTRACT(MONTH FROM age(current_date, fecha_nacimiento)))::int
                    ELSE edad_aproximada_meses END AS edad_meses
          FROM mascota WHERE id = p_mascota
    )
    SELECT COALESCE(
        (SELECT r.precio
           FROM servicio_regla_precio r, m
          WHERE r.servicio_id = p_servicio
            AND (r.especie_id     IS NULL OR r.especie_id = m.especie_id)
            AND (r.peso_min_kg    IS NULL OR m.peso_kg    >= r.peso_min_kg)
            AND (r.peso_max_kg    IS NULL OR m.peso_kg    <= r.peso_max_kg)
            AND (r.edad_min_meses IS NULL OR m.edad_meses >= r.edad_min_meses)
            AND (r.edad_max_meses IS NULL OR m.edad_meses <= r.edad_max_meses)
          ORDER BY r.prioridad DESC, r.precio DESC
          LIMIT 1),
        (SELECT precio_base FROM servicio WHERE id = p_servicio));
$$;

-- 16.11 Eliminación de cuenta con anonimización (Ley 1581, regla 7.6): se borran los datos
--       personales pero las citas y consultas finalizadas se conservan.
CREATE FUNCTION fn_anonimizar_usuario(p_usuario uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE usuario SET
        nombre_completo = 'Usuario eliminado',
        correo          = 'eliminado-' || id || '@veto.invalid',
        celular = NULL, cedula = NULL, direccion = NULL,
        password_hash = NULL, segundo_factor_activo = false, segundo_factor_secreto_cifrado = NULL,
        acepta_publicidad = false, acepta_whatsapp = false,
        estado = 'ELIMINADA', eliminado_en = now()
     WHERE id = p_usuario;
    DELETE FROM identidad_externa   WHERE usuario_id = p_usuario;
    DELETE FROM token_verificacion  WHERE usuario_id = p_usuario;
    UPDATE notificacion SET estado = 'CANCELADA' WHERE usuario_id = p_usuario AND estado = 'PENDIENTE';
    UPDATE mascota SET activa = false, chip = NULL, anonimizada_en = now() WHERE tutor_id = p_usuario;
    DELETE FROM mascota_foto WHERE mascota_id IN (SELECT id FROM mascota WHERE tutor_id = p_usuario);
END $$;

-- =============================================================================
-- 17. VISTAS (consultas que usarán el portal, los dashboards y los reportes)
-- =============================================================================

-- Historial de la mascota para el tutor (HU-011, 035): citas finalizadas + consulta + recomendaciones.
CREATE VIEW v_historial_mascota AS
SELECT c.mascota_id, c.id AS cita_id, c.inicio AS fecha, ts.nombre AS tipo_servicio,
       s.nombre AS servicio, a.nombre_comercial AS aliado, c.recomendaciones,
       k.id AS consulta_id, k.diagnostico_presuntivo, k.estado AS estado_consulta
  FROM cita c
  JOIN servicio s       ON s.id  = c.servicio_id
  JOIN tipo_servicio ts ON ts.id = s.tipo_servicio_id
  JOIN aliado a         ON a.id  = c.aliado_id
  LEFT JOIN consulta k  ON k.cita_id = c.id
 WHERE c.estado = 'FINALIZADA';

-- Calificación pública de cada aliado (HU-062, 064); excluye reseñas ocultas o marcadas.
CREATE VIEW v_calificacion_aliado AS
SELECT aliado_id, round(avg(calificacion), 2) AS promedio, count(*) AS total_resenas
  FROM resena WHERE moderacion = 'PUBLICADO'
 GROUP BY aliado_id;

-- Oferta de servicios para búsqueda/filtros (HU-024..028): solo aliados verificados y activos.
CREATE VIEW v_oferta_servicios AS
SELECT s.id AS servicio_id, s.nombre, s.descripcion, s.modalidad, s.precio_base, s.duracion_min,
       ts.id AS tipo_servicio_id, ts.nombre AS tipo_servicio,
       a.id AS aliado_id, a.nombre_comercial AS aliado, a.tipo AS tipo_aliado,
       sd.id AS sede_id, sd.direccion, sd.localidad, sd.latitud, sd.longitud,
       cal.promedio AS calificacion, cal.total_resenas,
       ARRAY(SELECT ae.especie_id FROM aliado_especie ae WHERE ae.aliado_id = a.id) AS especies_ids
  FROM servicio s
  JOIN tipo_servicio ts ON ts.id = s.tipo_servicio_id
  JOIN aliado a         ON a.id = s.aliado_id
  LEFT JOIN sede sd     ON sd.id = s.sede_id AND sd.activa
  LEFT JOIN v_calificacion_aliado cal ON cal.aliado_id = a.id
 WHERE s.activo AND s.moderacion = 'PUBLICADO'
   AND a.estado_verificacion = 'APROBADO' AND a.estado_operativo = 'ACTIVO';

-- Catálogo público de adopción (HU-087..089). NO incluye fundacion_id ni su ubicación.
CREATE VIEW v_catalogo_adopcion AS
SELECT m.id, m.nombre, e.nombre AS especie, m.especie_id, m.edad_meses, m.sexo, m.tamano,
       m.ciudad, m.zona, m.descripcion,
       (SELECT am.url FROM adopcion_media am
         WHERE am.mascota_adopcion_id = m.id AND am.tipo = 'FOTO' AND am.moderacion = 'PUBLICADO'
         ORDER BY am.orden LIMIT 1) AS foto_principal
  FROM mascota_adopcion m
  JOIN especie e ON e.id = m.especie_id
  JOIN aliado f  ON f.id = m.fundacion_id
 WHERE m.estado = 'DISPONIBLE' AND NOT m.pausada
   AND f.estado_verificacion = 'APROBADO' AND f.estado_operativo = 'ACTIVO';

-- Indicadores de éxito del piloto (HU-071). Las definiciones exactas las debe aprobar el cliente.
CREATE VIEW v_kpi_piloto AS
SELECT
  (SELECT count(*) FROM aliado WHERE estado_verificacion = 'APROBADO' AND estado_operativo = 'ACTIVO'
                                 AND tipo <> 'FUNDACION')                          AS aliados_activos,
  (SELECT count(*) FROM cita)                                                      AS citas_agendadas,
  (SELECT count(*) FROM cita WHERE estado = 'FINALIZADA')                          AS citas_finalizadas,
  (SELECT count(*) FROM (SELECT tutor_id FROM cita WHERE estado = 'FINALIZADA'
                          GROUP BY tutor_id HAVING count(*) >= 2) r)               AS tutores_recurrentes,
  (SELECT round(avg(calificacion), 2) FROM resena WHERE moderacion = 'PUBLICADO')  AS satisfaccion_promedio,
  (SELECT count(DISTINCT aliado_id) FROM suscripcion
    WHERE estado = 'ACTIVA' AND aliado_id IS NOT NULL)                             AS aliados_que_pagan;

-- Servicios más solicitados por mes (HU-070, 073).
CREATE VIEW v_servicios_mas_solicitados AS
SELECT date_trunc('month', c.inicio AT TIME ZONE 'America/Bogota')::date AS mes,
       ts.nombre AS tipo_servicio, s.nombre AS servicio, a.nombre_comercial AS aliado,
       count(*) AS citas, count(*) FILTER (WHERE c.estado = 'FINALIZADA') AS finalizadas,
       COALESCE(sum(c.precio_acordado) FILTER (WHERE c.estado = 'FINALIZADA'), 0) AS ingresos
  FROM cita c
  JOIN servicio s       ON s.id = c.servicio_id
  JOIN tipo_servicio ts ON ts.id = s.tipo_servicio_id
  JOIN aliado a         ON a.id = c.aliado_id
 WHERE c.estado <> 'CANCELADA'
 GROUP BY 1, 2, 3, 4;

-- Días y horas más ocupados (HU-070).
CREATE VIEW v_ocupacion_citas AS
SELECT extract(isodow FROM c.inicio AT TIME ZONE 'America/Bogota')::int AS dia_semana,
       extract(hour   FROM c.inicio AT TIME ZONE 'America/Bogota')::int AS hora,
       count(*) AS citas
  FROM cita c WHERE c.estado <> 'CANCELADA'
 GROUP BY 1, 2;

-- =============================================================================
-- 18. DATOS SEMILLA (catálogos y parámetros iniciales)
-- =============================================================================
INSERT INTO especie (nombre) VALUES
    ('Perro'),('Gato'),('Ave'),('Conejo'),('Roedor'),('Reptil'),('Otra');

INSERT INTO tipo_servicio (nombre, genera_historia_clinica) VALUES
    ('Consulta general', true),
    ('Esterilización',   true),
    ('Vacunación',       true),
    ('Desparasitación',  true),
    ('Cirugía',          true),
    ('Exámenes de laboratorio', true),
    ('Baño y peluquería', false);

INSERT INTO categoria_producto (nombre) VALUES
    ('Alimentos'),('Medicamentos'),('Accesorios'),('Baño y peluquería');

INSERT INTO estado_mental (nombre) VALUES
    ('Alerta'),('Deprimido'),('Excitado'),('Estupor'),('Coma');

INSERT INTO condicion_corporal (nombre) VALUES
    ('Caquéctico'),('Delgado'),('Ideal'),('Sobrepeso'),('Obeso');

INSERT INTO parametro_plataforma (clave, valor, descripcion) VALUES
    ('zona_horaria',              '"America/Bogota"', 'Zona horaria de operación'),
    ('ciudades_activas',          '["Bogotá"]',       'Ciudades habilitadas en el piloto'),
    ('recordatorio_cita_horas',   '24',               'Horas antes de la cita para enviar el recordatorio (HU-053)'),
    ('motivo_cita_max_caracteres','500',              'Límite del motivo de la cita (HU-030), por confirmar'),
    ('comision_activa',           'false',            'Activar solo cuando estén listas la pasarela y los términos legales (HU-056)');
