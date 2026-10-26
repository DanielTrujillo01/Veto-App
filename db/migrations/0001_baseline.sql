-- =============================================================================
-- VETO · Modelo de datos relacional (PostgreSQL 15+)
-- Alcance: SOLO las 55 historias de usuario ESENCIALES del Product Backlog.
-- (Condicionales y opcionales quedaron fuera; ver docs/modelo-de-datos.md.)
--
-- Convenciones
--   * Esquema `veto`, nombres en español, snake_case, singular.
--   * PK uuid; catálogos pequeños con smallint identity.
--   * Archivos (fotos) viven en almacenamiento externo: aquí solo la URL.
--   * La app debe ejecutar al inicio de cada transacción:
--         SET LOCAL app.usuario_id = '<uuid del usuario autenticado>';
--     para que el historial de estados sepa quién hizo el cambio.
--   * Conexión de la app:  SET search_path TO veto, public;
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS citext     WITH SCHEMA public;  -- correo sin distinguir mayúsculas
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;  -- evitar solapamientos
CREATE EXTENSION IF NOT EXISTS pg_trgm    WITH SCHEMA public;  -- búsqueda por palabra clave

CREATE SCHEMA IF NOT EXISTS veto;
SET search_path TO veto, public;

-- =============================================================================
-- 1. TIPOS ENUMERADOS
-- =============================================================================
CREATE TYPE rol_usuario        AS ENUM ('TUTOR','ALIADO','VETERINARIO','EQUIPO_VETO');
CREATE TYPE estado_cuenta      AS ENUM ('ACTIVA','SUSPENDIDA','ELIMINADA');
CREATE TYPE tipo_aliado        AS ENUM ('CLINICA','VET_INDEPENDIENTE','TIENDA','FUNDACION');
CREATE TYPE estado_aliado      AS ENUM ('PENDIENTE','ACTIVO','SUSPENDIDO');
CREATE TYPE sexo_animal        AS ENUM ('MACHO','HEMBRA');
CREATE TYPE tamano_mascota     AS ENUM ('PEQUENO','MEDIANO','GRANDE');
CREATE TYPE modalidad_servicio AS ENUM ('EN_SEDE','A_DOMICILIO');
CREATE TYPE estado_moderacion  AS ENUM ('PUBLICADO','MARCADO','OCULTO');
CREATE TYPE estado_cita        AS ENUM ('AGENDADA','FINALIZADA','NO_ASISTIO','CANCELADA');
CREATE TYPE estado_consulta    AS ENUM ('ABIERTA','CERRADA');
CREATE TYPE estado_pedido      AS ENUM ('PENDIENTE','CONFIRMADO','DESPACHADO','ENTREGADO','CANCELADO');
CREATE TYPE estado_mascota_adopcion AS ENUM ('DISPONIBLE','PAUSADA','EN_PROCESO','ADOPTADA','RETIRADA');
CREATE TYPE estado_solicitud   AS ENUM ('ENVIADA','EN_REVISION','ENTREVISTA','APROBADA',
                                        'RECHAZADA','ADOPCION_COMPLETADA','CANCELADA');
CREATE TYPE tipo_accion_admin  AS ENUM ('ACTIVAR','SUSPENDER','REACTIVAR','OCULTAR','MARCAR','PUBLICAR');

-- =============================================================================
-- 2. CATÁLOGOS
-- =============================================================================
CREATE TABLE especie (
    id      smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre  text NOT NULL UNIQUE
);

CREATE TABLE tipo_servicio (                       -- consulta general, baño y peluquería, esterilización...
    id      smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre  text NOT NULL UNIQUE
);

CREATE TABLE categoria_producto (
    id      smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre  text NOT NULL UNIQUE
);

-- =============================================================================
-- 3. USUARIOS Y ALIADOS                      (E01, E04 · HU-001..002, 006..007, 012..016, 078)
-- =============================================================================
CREATE TABLE usuario (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre         text   NOT NULL,
    celular        text   NOT NULL CHECK (celular ~ '^[0-9]{10}$'),
    correo         citext NOT NULL UNIQUE CHECK (correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    password_hash  text   NOT NULL,                 -- nunca la contraseña en texto plano
    rol            rol_usuario   NOT NULL DEFAULT 'TUTOR',
    estado         estado_cuenta NOT NULL DEFAULT 'ACTIVA',   -- HU-006 eliminar, HU-067 suspender
    eliminado_en   timestamptz,
    creado_en      timestamptz NOT NULL DEFAULT now()
);

-- Clínica, veterinario independiente, tienda o fundación (HU-007, HU-078).
CREATE TABLE aliado (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      uuid NOT NULL UNIQUE REFERENCES usuario(id),   -- cuenta que administra el aliado
    tipo            tipo_aliado NOT NULL,
    nombre          text NOT NULL,
    descripcion     text,
    logo_url        text,
    contacto        text,
    estado          estado_aliado NOT NULL DEFAULT 'PENDIENTE',    -- HU-065 suspender / reactivar
    -- Solo fundaciones (HU-078); el logo es opcional
    ciudad          text,
    ubicacion       text,
    anio_fundacion  smallint CHECK (anio_fundacion BETWEEN 1900 AND 2100),
    creado_en       timestamptz NOT NULL DEFAULT now(),
    CHECK (tipo <> 'FUNDACION' OR (ciudad IS NOT NULL AND ubicacion IS NOT NULL
                                   AND contacto IS NOT NULL AND anio_fundacion IS NOT NULL
                                   AND descripcion IS NOT NULL))
);

-- Perfil de veterinario (HU-012, 013, 014). Un veterinario independiente tiene el suyo.
CREATE TABLE veterinario (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id    uuid NOT NULL REFERENCES aliado(id),
    usuario_id   uuid NOT NULL UNIQUE REFERENCES usuario(id),   -- ingresa con su propia cuenta
    foto_url     text,
    descripcion  text,
    activo       boolean NOT NULL DEFAULT true,
    creado_en    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, aliado_id)
);

CREATE TABLE sede (                                 -- HU-015
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id  uuid NOT NULL REFERENCES aliado(id),
    nombre     text NOT NULL,
    direccion  text NOT NULL,
    ciudad     text NOT NULL,
    activa     boolean NOT NULL DEFAULT true,       -- desactivar en vez de borrar
    UNIQUE (id, aliado_id)
);

CREATE TABLE aliado_especie (                       -- HU-021
    aliado_id   uuid     NOT NULL REFERENCES aliado(id),
    especie_id  smallint NOT NULL REFERENCES especie(id),
    PRIMARY KEY (aliado_id, especie_id)
);

-- =============================================================================
-- 4. MASCOTAS DEL TUTOR                                   (E02 · HU-008..011)
-- =============================================================================
CREATE TABLE mascota (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id          uuid NOT NULL REFERENCES usuario(id),
    nombre            text NOT NULL,
    especie_id        smallint NOT NULL REFERENCES especie(id),
    sexo              sexo_animal NOT NULL,
    raza              text,
    fecha_nacimiento  date,
    edad_meses        smallint CHECK (edad_meses >= 0),        -- si no se conoce la fecha
    color             text,
    peso_kg           numeric(6,2) CHECK (peso_kg > 0),
    chip              text UNIQUE,
    creado_en         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, tutor_id)
);

CREATE TABLE mascota_foto (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mascota_id  uuid NOT NULL REFERENCES mascota(id) ON DELETE CASCADE,
    url         text NOT NULL
);

-- =============================================================================
-- 5. SERVICIOS Y HORARIOS                                (E05 · HU-016, 018..022)
-- =============================================================================
CREATE TABLE servicio (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id         uuid NOT NULL REFERENCES aliado(id),
    tipo_servicio_id  smallint NOT NULL REFERENCES tipo_servicio(id),
    nombre            text NOT NULL,
    descripcion       text,
    modalidad         modalidad_servicio NOT NULL,       -- en sede o a domicilio
    sede_id           uuid,                              -- ubicación (obligatoria si es en sede)
    duracion_min      smallint NOT NULL DEFAULT 30 CHECK (duracion_min > 0),
    precio_base       numeric(12,2) NOT NULL CHECK (precio_base >= 0),
    activo            boolean NOT NULL DEFAULT true,     -- desactivar en vez de borrar (HU-018)
    moderacion        estado_moderacion NOT NULL DEFAULT 'PUBLICADO',   -- HU-066
    creado_en         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, aliado_id),
    FOREIGN KEY (sede_id, aliado_id) REFERENCES sede(id, aliado_id),
    CHECK (modalidad = 'A_DOMICILIO' OR sede_id IS NOT NULL)
);

-- Precio según peso, edad o especie (HU-020). NULL = "cualquiera".
-- Gana la regla de mayor prioridad que aplique; si ninguna aplica, precio_base.
CREATE TABLE servicio_regla_precio (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    servicio_id     uuid NOT NULL REFERENCES servicio(id) ON DELETE CASCADE,
    especie_id      smallint REFERENCES especie(id),
    peso_min_kg     numeric(6,2),
    peso_max_kg     numeric(6,2),
    edad_min_meses  integer,
    edad_max_meses  integer,
    precio          numeric(12,2) NOT NULL CHECK (precio >= 0),
    prioridad       smallint NOT NULL DEFAULT 0,
    CHECK (peso_min_kg IS NULL OR peso_max_kg IS NULL OR peso_min_kg <= peso_max_kg),
    CHECK (edad_min_meses IS NULL OR edad_max_meses IS NULL OR edad_min_meses <= edad_max_meses)
);

-- Horario semanal del veterinario (HU-016) o del aliado en general (HU-022).
-- Diario = una fila; semanal = varias filas; mensual = vigencia entre fechas.
CREATE TABLE horario (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id       uuid NOT NULL REFERENCES aliado(id),
    veterinario_id  uuid,                                -- NULL = horario general del aliado
    dia_semana      smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),   -- 1 = lunes
    hora_inicio     time NOT NULL,
    hora_fin        time NOT NULL,
    vigente_desde   date NOT NULL DEFAULT current_date,
    vigente_hasta   date,
    -- columnas calculadas para impedir franjas solapadas
    agenda_clave    uuid GENERATED ALWAYS AS (COALESCE(veterinario_id, aliado_id)) STORED,
    franja          tsrange GENERATED ALWAYS AS
                    (tsrange(DATE '2000-01-03' + hora_inicio, DATE '2000-01-03' + hora_fin)) STORED,
    vigencia        daterange GENERATED ALWAYS AS (daterange(vigente_desde, vigente_hasta, '[]')) STORED,
    CHECK (hora_fin > hora_inicio),
    CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
    FOREIGN KEY (veterinario_id, aliado_id) REFERENCES veterinario(id, aliado_id),
    CONSTRAINT horario_sin_solapamiento EXCLUDE USING gist
        (agenda_clave WITH =, dia_semana WITH =, franja WITH &&, vigencia WITH &&)
);

-- =============================================================================
-- 6. CITAS                                               (E07 · HU-029, 031, 032, 034)
-- =============================================================================
CREATE TABLE cita (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id         uuid NOT NULL REFERENCES usuario(id),
    mascota_id       uuid NOT NULL,
    aliado_id        uuid NOT NULL REFERENCES aliado(id),
    servicio_id      uuid NOT NULL,
    veterinario_id   uuid,
    inicio           timestamptz NOT NULL,
    fin              timestamptz NOT NULL,
    estado           estado_cita NOT NULL DEFAULT 'AGENDADA',
    precio           numeric(12,2) NOT NULL CHECK (precio >= 0),   -- precio al momento de reservar
    recomendaciones  text,                                         -- se muestran en el historial (HU-011, 054)
    creado_en        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, mascota_id),
    FOREIGN KEY (mascota_id, tutor_id)      REFERENCES mascota(id, tutor_id),
    FOREIGN KEY (servicio_id, aliado_id)    REFERENCES servicio(id, aliado_id),
    FOREIGN KEY (veterinario_id, aliado_id) REFERENCES veterinario(id, aliado_id),
    CHECK (fin > inicio),
    -- Un veterinario no puede tener dos citas vigentes al mismo tiempo
    CONSTRAINT cita_sin_solapamiento EXCLUDE USING gist
        (veterinario_id WITH =, tstzrange(inicio, fin) WITH &&)
        WHERE (veterinario_id IS NOT NULL AND estado = 'AGENDADA')
);
-- Evita citas duplicadas por doble clic o reintento (HU-031)
CREATE UNIQUE INDEX cita_sin_duplicado ON cita (tutor_id, mascota_id, servicio_id, inicio)
    WHERE estado = 'AGENDADA';

-- Quién cambió el estado, cuándo y de qué a qué (citas, pedidos, solicitudes de adopción...).
CREATE TABLE historial_estado (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entidad          text NOT NULL,                      -- 'cita', 'pedido', ...
    entidad_id       uuid NOT NULL,
    estado_anterior  text,
    estado_nuevo     text NOT NULL,
    cambiado_por     uuid REFERENCES usuario(id),
    motivo           text,
    cambiado_en      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 7. REGISTRO DE CONSULTA                            (E09 · HU-017, 037, 042, 043)
--    El "historial clínico" de una mascota es el conjunto de sus consultas.
-- =============================================================================
CREATE TABLE consulta (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id                  uuid NOT NULL UNIQUE,
    mascota_id               uuid NOT NULL,
    veterinario_id           uuid NOT NULL REFERENCES veterinario(id),   -- responsable (HU-017)
    -- Anamnesis (HU-037)
    motivo_consulta          text NOT NULL,
    descripcion_propietario  text,
    estado_mental            text,
    condicion_corporal       text,
    comportamiento           text,
    estado_general           text,
    -- Cierre (HU-042)
    estado                   estado_consulta NOT NULL DEFAULT 'ABIERTA',
    cerrada_en               timestamptz,
    cerrada_por              uuid REFERENCES usuario(id),
    creado_en                timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (cita_id, mascota_id) REFERENCES cita(id, mascota_id),
    CHECK (estado = 'ABIERTA' OR (cerrada_en IS NOT NULL AND cerrada_por IS NOT NULL))
);

-- Correcciones a una consulta cerrada: solo se agregan, nunca se editan ni borran.
CREATE TABLE consulta_anotacion (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id  uuid NOT NULL REFERENCES consulta(id),
    autor_id     uuid NOT NULL REFERENCES usuario(id),
    campo        text,                                   -- campo que se corrige
    texto        text NOT NULL,
    creado_en    timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 8. PRODUCTOS Y PEDIDOS                                 (E11 · HU-044..050)
-- =============================================================================
CREATE TABLE producto (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id     uuid NOT NULL REFERENCES aliado(id),
    categoria_id  smallint NOT NULL REFERENCES categoria_producto(id),
    nombre        text NOT NULL,
    descripcion   text,
    precio        numeric(12,2) NOT NULL CHECK (precio >= 0),
    stock         integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
    activo        boolean NOT NULL DEFAULT true,          -- desactivar en vez de borrar
    moderacion    estado_moderacion NOT NULL DEFAULT 'PUBLICADO',   -- HU-066
    creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE producto_foto (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id  uuid NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    url          text NOT NULL,
    moderacion   estado_moderacion NOT NULL DEFAULT 'PUBLICADO'
);

-- Un pedido pertenece a un solo aliado.
CREATE TABLE pedido (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id   uuid NOT NULL REFERENCES usuario(id),
    aliado_id  uuid NOT NULL REFERENCES aliado(id),
    estado     estado_pedido NOT NULL DEFAULT 'PENDIENTE',
    total      numeric(12,2) NOT NULL CHECK (total >= 0),
    creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pedido_item (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id        uuid NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
    producto_id      uuid NOT NULL REFERENCES producto(id),
    cantidad         integer NOT NULL CHECK (cantidad > 0),
    precio_unitario  numeric(12,2) NOT NULL CHECK (precio_unitario >= 0),   -- precio al comprar
    UNIQUE (pedido_id, producto_id)
);

-- =============================================================================
-- 9. ADOPCIÓN                                          (E19..E23 · HU-078, 080, 082, 083, 087, 090, 092..094)
-- =============================================================================
-- Privacidad: el catálogo público debe leerse desde v_catalogo_adopcion,
-- que no expone a la fundación (HU-087).
CREATE TABLE mascota_adopcion (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fundacion_id  uuid NOT NULL REFERENCES aliado(id),
    nombre        text NOT NULL,
    especie_id    smallint NOT NULL REFERENCES especie(id),
    edad_meses    smallint NOT NULL CHECK (edad_meses >= 0),
    sexo          sexo_animal NOT NULL,
    tamano        tamano_mascota NOT NULL,
    ubicacion     text NOT NULL,                          -- ciudad o zona
    descripcion   text,
    foto_url      text,
    estado        estado_mascota_adopcion NOT NULL DEFAULT 'DISPONIBLE',   -- HU-082 pausar, HU-083
    creado_en     timestamptz NOT NULL DEFAULT now()
);

-- Formulario por pasos (HU-090). Las respuestas se guardan como JSON: el formulario
-- puede cambiar sin migrar la base.
CREATE TABLE solicitud_adopcion (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mascota_adopcion_id  uuid NOT NULL REFERENCES mascota_adopcion(id),
    tutor_id             uuid NOT NULL REFERENCES usuario(id),
    estado               estado_solicitud NOT NULL DEFAULT 'ENVIADA',
    datos_personales     jsonb NOT NULL,
    hogar_experiencia    jsonb NOT NULL,
    motivacion           text  NOT NULL,
    calificacion         smallint CHECK (calificacion BETWEEN 1 AND 5),    -- HU-094
    motivo_decision      text,
    decidido_por         uuid REFERENCES usuario(id),
    decidido_en          timestamptz,
    creado_en            timestamptz NOT NULL DEFAULT now(),
    CHECK (estado <> 'RECHAZADA' OR motivo_decision IS NOT NULL)
);
-- Un tutor no puede tener dos solicitudes activas para la misma mascota
CREATE UNIQUE INDEX solicitud_activa_unica ON solicitud_adopcion (mascota_adopcion_id, tutor_id)
    WHERE estado NOT IN ('CANCELADA','RECHAZADA');

-- =============================================================================
-- 10. NOTIFICACIONES INTERNAS Y ADMINISTRACIÓN         (HU-048, 052, 054, 065..067)
-- =============================================================================
CREATE TABLE notificacion (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id     uuid NOT NULL REFERENCES usuario(id),
    tipo           text NOT NULL,                         -- 'CITA_FINALIZADA', 'PEDIDO_ESTADO', ...
    mensaje        text NOT NULL,
    referencia_id  uuid,                                  -- cita, pedido, solicitud...
    leida_en       timestamptz,
    creado_en      timestamptz NOT NULL DEFAULT now()
);

-- Acciones del Equipo Veto con responsable, fecha y motivo (suspender aliado,
-- cambiar estado de cuenta, moderar contenido).
CREATE TABLE accion_admin (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id       uuid NOT NULL REFERENCES usuario(id),
    objetivo_tipo  text NOT NULL,                         -- 'aliado', 'usuario', 'servicio', 'producto', 'producto_foto'
    objetivo_id    uuid NOT NULL,
    accion         tipo_accion_admin NOT NULL,
    motivo         text,
    creado_en      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 11. ÍNDICES
-- =============================================================================
CREATE INDEX ON veterinario (aliado_id);
CREATE INDEX ON sede (aliado_id);
CREATE INDEX ON mascota (tutor_id);
CREATE INDEX ON servicio (aliado_id) WHERE activo;
CREATE INDEX ON servicio (tipo_servicio_id) WHERE activo;
CREATE INDEX ON servicio USING gin (nombre gin_trgm_ops);       -- búsqueda por palabra clave (HU-025)
CREATE INDEX ON aliado   USING gin (nombre gin_trgm_ops);
CREATE INDEX ON producto (aliado_id) WHERE activo;
CREATE INDEX ON producto (categoria_id) WHERE activo;
CREATE INDEX ON producto USING gin (nombre gin_trgm_ops);
CREATE INDEX ON horario (aliado_id);
CREATE INDEX ON cita (tutor_id, inicio DESC);
CREATE INDEX ON cita (aliado_id, inicio);
CREATE INDEX ON cita (mascota_id);
CREATE INDEX ON consulta (mascota_id);
CREATE INDEX ON consulta_anotacion (consulta_id);
CREATE INDEX ON pedido (tutor_id, creado_en DESC);
CREATE INDEX ON pedido (aliado_id, estado);
CREATE INDEX ON mascota_adopcion (fundacion_id);
CREATE INDEX ON mascota_adopcion (especie_id, tamano) WHERE estado = 'DISPONIBLE';
CREATE INDEX ON solicitud_adopcion (mascota_adopcion_id);
CREATE INDEX ON solicitud_adopcion (tutor_id);
CREATE INDEX ON notificacion (usuario_id, creado_en DESC);
CREATE INDEX ON historial_estado (entidad, entidad_id, cambiado_en);
CREATE INDEX ON accion_admin (objetivo_tipo, objetivo_id);

-- =============================================================================
-- 12. REGLAS EN LA BASE DE DATOS (funciones y triggers)
-- =============================================================================

-- 12.1 Tablas de solo inserción: no se editan ni se borran
CREATE FUNCTION fn_solo_insertar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es de solo inserción: no admite %', TG_TABLE_NAME, TG_OP
        USING ERRCODE = '55000';
END $$;

CREATE TRIGGER trg_historial_inmutable   BEFORE UPDATE OR DELETE ON historial_estado
    FOR EACH ROW EXECUTE FUNCTION fn_solo_insertar();
CREATE TRIGGER trg_anotacion_inmutable   BEFORE UPDATE OR DELETE ON consulta_anotacion
    FOR EACH ROW EXECUTE FUNCTION fn_solo_insertar();
CREATE TRIGGER trg_accion_admin_inmutable BEFORE UPDATE OR DELETE ON accion_admin
    FOR EACH ROW EXECUTE FUNCTION fn_solo_insertar();

-- 12.2 Historial de estados (quién, cuándo, de qué a qué). Uso: fn_registrar_estado('cita')
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

CREATE TRIGGER trg_cita_historial AFTER INSERT OR UPDATE ON cita
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('cita');
CREATE TRIGGER trg_pedido_historial AFTER INSERT OR UPDATE ON pedido
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('pedido');
CREATE TRIGGER trg_solicitud_historial AFTER INSERT OR UPDATE ON solicitud_adopcion
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('solicitud_adopcion');
CREATE TRIGGER trg_mascota_adopcion_historial AFTER INSERT OR UPDATE ON mascota_adopcion
    FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado('mascota_adopcion');

-- 12.3 El aliado debe ser del tipo correcto (la tienda no ofrece servicios, solo la
--      fundación publica mascotas en adopción). Args: (columna_aliado, 'TIPO1,TIPO2', ['activo'])
CREATE FUNCTION fn_validar_tipo_aliado() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_tipo   tipo_aliado;
    v_estado estado_aliado;
BEGIN
    SELECT tipo, estado INTO v_tipo, v_estado
      FROM aliado WHERE id = (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
    IF NOT FOUND OR v_tipo::text <> ALL (string_to_array(TG_ARGV[1], ',')) THEN
        RAISE EXCEPTION 'Un aliado de tipo % no puede registrar datos en %', v_tipo, TG_TABLE_NAME
            USING ERRCODE = '23514';
    END IF;
    IF TG_ARGV[2] = 'activo' AND v_estado <> 'ACTIVO' THEN
        RAISE EXCEPTION 'El aliado debe estar activo (autorizado) para publicar' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_servicio_tipo BEFORE INSERT OR UPDATE OF aliado_id ON servicio
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('aliado_id', 'CLINICA,VET_INDEPENDIENTE');
CREATE TRIGGER trg_veterinario_tipo BEFORE INSERT OR UPDATE OF aliado_id ON veterinario
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('aliado_id', 'CLINICA,VET_INDEPENDIENTE');
CREATE TRIGGER trg_producto_tipo BEFORE INSERT OR UPDATE OF aliado_id ON producto
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('aliado_id', 'TIENDA');
CREATE TRIGGER trg_mascota_adopcion_tipo BEFORE INSERT OR UPDATE OF fundacion_id ON mascota_adopcion
    FOR EACH ROW EXECUTE FUNCTION fn_validar_tipo_aliado('fundacion_id', 'FUNDACION', 'activo');

-- 12.4 Reglas de la cita: reservar solo a futuro, con un servicio disponible y una especie
--      que el aliado atiende; transiciones válidas; solo el aliado finaliza (HU-029..034).
CREATE FUNCTION fn_cita_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_ok      boolean;
    v_usuario uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado <> 'AGENDADA' THEN
            RAISE EXCEPTION 'Una cita nueva inicia como AGENDADA' USING ERRCODE = '23514';
        END IF;
        IF NEW.inicio <= now() THEN
            RAISE EXCEPTION 'No se pueden agendar citas en el pasado' USING ERRCODE = '23514';
        END IF;
        SELECT s.activo AND s.moderacion = 'PUBLICADO' AND a.estado = 'ACTIVO' INTO v_ok
          FROM servicio s JOIN aliado a ON a.id = s.aliado_id WHERE s.id = NEW.servicio_id;
        IF NOT COALESCE(v_ok, false) THEN
            RAISE EXCEPTION 'El servicio no está disponible para reservas' USING ERRCODE = '23514';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM mascota m JOIN aliado_especie ae ON ae.especie_id = m.especie_id
                        WHERE m.id = NEW.mascota_id AND ae.aliado_id = NEW.aliado_id) THEN
            RAISE EXCEPTION 'El aliado no atiende la especie de esta mascota' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    IF OLD.estado <> 'AGENDADA' AND (NEW.estado <> OLD.estado OR NEW.inicio <> OLD.inicio OR NEW.fin <> OLD.fin) THEN
        RAISE EXCEPTION 'La cita está en estado final (%) y no admite cambios', OLD.estado USING ERRCODE = '55000';
    END IF;

    IF NEW.estado IN ('FINALIZADA','NO_ASISTIO') AND OLD.estado = 'AGENDADA' THEN
        IF v_usuario IS NULL OR NOT (
               EXISTS (SELECT 1 FROM aliado WHERE id = NEW.aliado_id AND usuario_id = v_usuario)
            OR EXISTS (SELECT 1 FROM veterinario WHERE aliado_id = NEW.aliado_id AND usuario_id = v_usuario AND activo)) THEN
            RAISE EXCEPTION 'Solo el aliado puede marcar la cita como %', NEW.estado USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Reprogramación: se conserva la fecha anterior en el historial (HU-034)
    IF NEW.inicio <> OLD.inicio THEN
        IF NEW.inicio <= now() THEN
            RAISE EXCEPTION 'No se puede reprogramar al pasado' USING ERRCODE = '23514';
        END IF;
        INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, cambiado_por, motivo)
        VALUES ('cita', NEW.id, OLD.estado::text, NEW.estado::text, v_usuario,
                'Reprogramada: ' || OLD.inicio || ' -> ' || NEW.inicio);
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_cita_validar BEFORE INSERT OR UPDATE ON cita
    FOR EACH ROW EXECUTE FUNCTION fn_cita_validar();

-- 12.5 Consulta: el veterinario debe ser del aliado de la cita; una consulta cerrada
--      no se edita ni se borra (se corrige con consulta_anotacion, HU-042).
CREATE FUNCTION fn_consulta_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cita c JOIN veterinario v ON v.aliado_id = c.aliado_id
                    WHERE c.id = NEW.cita_id AND v.id = NEW.veterinario_id) THEN
        RAISE EXCEPTION 'El veterinario responsable debe pertenecer al aliado de la cita' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_consulta_validar BEFORE INSERT ON consulta
    FOR EACH ROW EXECUTE FUNCTION fn_consulta_validar();

CREATE FUNCTION fn_consulta_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Las consultas clínicas no se eliminan' USING ERRCODE = '55000';
    END IF;
    IF OLD.estado = 'CERRADA' THEN
        RAISE EXCEPTION 'La consulta está cerrada: registre una anotación de corrección' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_consulta_inmutable BEFORE UPDATE OR DELETE ON consulta
    FOR EACH ROW EXECUTE FUNCTION fn_consulta_inmutable();

-- 12.6 Pedidos: al agregar un ítem se valida el producto y se descuenta el stock
--      (si no alcanza, el CHECK de stock aborta); al cancelar se devuelve (HU-046, 049).
CREATE FUNCTION fn_pedido_item() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM producto p JOIN pedido d ON d.id = NEW.pedido_id
                    WHERE p.id = NEW.producto_id AND p.aliado_id = d.aliado_id
                      AND p.activo AND p.moderacion = 'PUBLICADO') THEN
        RAISE EXCEPTION 'El producto no está disponible' USING ERRCODE = '23514';
    END IF;
    UPDATE producto SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_pedido_item BEFORE INSERT ON pedido_item
    FOR EACH ROW EXECUTE FUNCTION fn_pedido_item();

CREATE FUNCTION fn_pedido_estado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;
    IF NOT ((OLD.estado = 'PENDIENTE'  AND NEW.estado IN ('CONFIRMADO','CANCELADO'))
         OR (OLD.estado = 'CONFIRMADO' AND NEW.estado IN ('DESPACHADO','CANCELADO'))
         OR (OLD.estado = 'DESPACHADO' AND NEW.estado = 'ENTREGADO')) THEN
        RAISE EXCEPTION 'Transición de pedido no permitida: % -> %', OLD.estado, NEW.estado USING ERRCODE = '23514';
    END IF;
    IF NEW.estado = 'CANCELADO' THEN
        UPDATE producto p SET stock = p.stock + i.cantidad
          FROM pedido_item i WHERE i.pedido_id = NEW.id AND p.id = i.producto_id;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_pedido_estado BEFORE UPDATE OF estado ON pedido
    FOR EACH ROW EXECUTE FUNCTION fn_pedido_estado();

-- 12.7 Precio de un servicio para una mascota concreta (HU-020).
--      Si faltan datos de la mascota o no hay regla aplicable → precio_base.
CREATE FUNCTION fn_precio_servicio(p_servicio uuid, p_mascota uuid) RETURNS numeric
LANGUAGE sql STABLE AS $$
    WITH m AS (
        SELECT especie_id, peso_kg,
               CASE WHEN fecha_nacimiento IS NOT NULL
                    THEN (EXTRACT(YEAR  FROM age(current_date, fecha_nacimiento)) * 12
                        + EXTRACT(MONTH FROM age(current_date, fecha_nacimiento)))::int
                    ELSE edad_meses END AS edad_meses
          FROM mascota WHERE id = p_mascota
    )
    SELECT COALESCE(
        (SELECT r.precio FROM servicio_regla_precio r, m
          WHERE r.servicio_id = p_servicio
            AND (r.especie_id     IS NULL OR r.especie_id = m.especie_id)
            AND (r.peso_min_kg    IS NULL OR m.peso_kg    >= r.peso_min_kg)
            AND (r.peso_max_kg    IS NULL OR m.peso_kg    <= r.peso_max_kg)
            AND (r.edad_min_meses IS NULL OR m.edad_meses >= r.edad_min_meses)
            AND (r.edad_max_meses IS NULL OR m.edad_meses <= r.edad_max_meses)
          ORDER BY r.prioridad DESC, r.precio DESC LIMIT 1),
        (SELECT precio_base FROM servicio WHERE id = p_servicio));
$$;

-- =============================================================================
-- 13. VISTAS
-- =============================================================================

-- Historial de la mascota para el tutor (HU-011, 043): citas finalizadas + su consulta.
CREATE VIEW v_historial_mascota AS
SELECT c.mascota_id, c.id AS cita_id, c.inicio AS fecha, s.nombre AS servicio,
       a.nombre AS aliado, c.recomendaciones, k.id AS consulta_id, k.estado AS estado_consulta
  FROM cita c
  JOIN servicio s ON s.id = c.servicio_id
  JOIN aliado a   ON a.id = c.aliado_id
  LEFT JOIN consulta k ON k.cita_id = c.id
 WHERE c.estado = 'FINALIZADA';

-- Catálogo público de adopción (HU-087): NO incluye a la fundación.
CREATE VIEW v_catalogo_adopcion AS
SELECT m.id, m.nombre, e.nombre AS especie, m.especie_id, m.edad_meses, m.sexo, m.tamano,
       m.ubicacion, m.descripcion, m.foto_url
  FROM mascota_adopcion m
  JOIN especie e ON e.id = m.especie_id
  JOIN aliado f  ON f.id = m.fundacion_id
 WHERE m.estado = 'DISPONIBLE' AND f.estado = 'ACTIVO';

-- Base de dashboards y reportes de citas (HU-070, 073, 074): una fila por cita con
-- todas las dimensiones de filtro (fecha, servicio, aliado, especie, estado).
-- Para horas locales use: SET TIME ZONE 'America/Bogota';
CREATE VIEW v_citas_reporte AS
SELECT c.id AS cita_id, c.inicio, c.inicio::date AS fecha,
       extract(hour FROM c.inicio)::int AS hora, extract(isodow FROM c.inicio)::int AS dia_semana,
       c.estado, c.precio,
       s.id AS servicio_id, s.nombre AS servicio, ts.nombre AS tipo_servicio,
       a.id AS aliado_id, a.nombre AS aliado,
       e.nombre AS especie, c.tutor_id, c.mascota_id
  FROM cita c
  JOIN servicio s       ON s.id  = c.servicio_id
  JOIN tipo_servicio ts ON ts.id = s.tipo_servicio_id
  JOIN aliado a         ON a.id  = c.aliado_id
  JOIN mascota m        ON m.id  = c.mascota_id
  JOIN especie e        ON e.id  = m.especie_id;

-- Ventas de productos por aliado (HU-073: productos más vendidos, ingresos).
CREATE VIEW v_ventas_productos AS
SELECT d.id AS pedido_id, d.creado_en::date AS fecha, d.estado, d.aliado_id, d.tutor_id,
       p.id AS producto_id, p.nombre AS producto, i.cantidad, i.precio_unitario,
       i.cantidad * i.precio_unitario AS subtotal
  FROM pedido d
  JOIN pedido_item i ON i.pedido_id = d.id
  JOIN producto p    ON p.id = i.producto_id;

-- =============================================================================
-- 14. DATOS SEMILLA (ejemplos; el backlog no lista los valores exactos)
-- =============================================================================
INSERT INTO especie (nombre) VALUES ('Perro'), ('Gato'), ('Ave'), ('Conejo'), ('Otra');
INSERT INTO tipo_servicio (nombre) VALUES ('Consulta general'), ('Baño y peluquería'), ('Esterilización');
INSERT INTO categoria_producto (nombre) VALUES ('Alimentos'), ('Accesorios'), ('Higiene');
