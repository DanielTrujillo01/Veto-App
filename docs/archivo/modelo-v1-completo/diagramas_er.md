### Vista general (entidades principales, sin columnas)

```mermaid
erDiagram
    aliado ||--o{ miembro_aliado : ""
    usuario ||--o{ miembro_aliado : ""
    miembro_aliado ||--o{ veterinario : ""
    aliado ||--o{ sede : ""
    aliado ||--o| fundacion_perfil : ""
    usuario ||--o{ mascota : ""
    especie ||--o{ mascota : ""
    aliado ||--o{ servicio : ""
    sede |o--o{ servicio : ""
    servicio ||--o{ servicio_regla_precio : ""
    especie |o--o{ servicio_regla_precio : ""
    aliado ||--o{ horario_atencion : ""
    sede |o--o{ horario_atencion : ""
    veterinario |o--o{ horario_atencion : ""
    usuario ||--o{ cita : ""
    aliado ||--o{ cita : ""
    mascota ||--o{ cita : ""
    servicio ||--o{ cita : ""
    sede |o--o{ cita : ""
    veterinario |o--o{ cita : ""
    cita ||--o| consulta : ""
    veterinario ||--o{ consulta : ""
    consulta ||--o| signos_vitales : ""
    aliado ||--o{ producto : ""
    usuario ||--o{ pedido : ""
    aliado ||--o{ pedido : ""
    pedido ||--o{ pedido_item : ""
    producto ||--o{ pedido_item : ""
    plan ||--o{ suscripcion : ""
    aliado |o--o{ suscripcion : ""
    usuario |o--o{ suscripcion : ""
    usuario ||--o{ pago : ""
    cita |o--o{ pago : ""
    pedido |o--o{ pago : ""
    suscripcion |o--o{ pago : ""
    pago ||--o{ factura_electronica : ""
    aliado |o--o{ factura_electronica : ""
    cita ||--o{ resena : ""
    aliado ||--o{ mascota_adopcion : ""
    especie ||--o{ mascota_adopcion : ""
    mascota_adopcion ||--o{ solicitud_adopcion : ""
    usuario ||--o{ solicitud_adopcion : ""
    usuario ||--o{ conversacion : ""
    aliado ||--o{ conversacion : ""
    conversacion ||--o{ mensaje : ""
    usuario ||--o{ mensaje : ""
    usuario ||--o{ notificacion : ""
    usuario ||--o{ pqrs : ""
    cita |o--o{ pqrs : ""
    pedido |o--o{ pqrs : ""
```

### 1 · Cuentas y acceso

```mermaid
erDiagram
    consentimiento {
        uuid id PK
        uuid usuario_id FK
        tipo_consentimiento tipo
        text version
        bool aceptado
        inet ip
        timestamptz registrado_en
    }
    equipo_veto {
        uuid usuario_id PK,FK
        rol_equipo_veto rol
        bool activo
    }
    identidad_externa {
        uuid id PK
        uuid usuario_id FK
        text proveedor
        text sujeto
    }
    parametro_plataforma {
        text clave PK
        jsonb valor
        text descripcion
        uuid actualizado_por FK
    }
    token_verificacion {
        uuid id PK
        uuid usuario_id FK
        proposito_token proposito
        text codigo_hash
        timestamptz expira_en
        timestamptz usado_en
        int2 intentos
    }
    usuario {
        uuid id PK
        text nombre_completo
        text celular
        citext correo UK
        text cedula UK
        text direccion
        text password_hash
        bool segundo_factor_activo
        text segundo_factor_secreto_cifrado
        timestamptz correo_verificado_en
        estado_cuenta estado
        bool acepta_publicidad
        bool acepta_whatsapp
        timestamptz ultimo_acceso_en
        timestamptz eliminado_en
    }
    usuario |o--o{ parametro_plataforma : "actualizado_por"
    usuario ||--o{ identidad_externa : "usuario_id"
    usuario ||--o{ token_verificacion : "usuario_id"
    usuario ||--o| equipo_veto : "usuario_id"
    usuario ||--o{ consentimiento : "usuario_id"
```

### 2 · Aliados, sedes y veterinarios

```mermaid
erDiagram
    aliado {
        uuid id PK
        tipo_aliado tipo
        text nombre_comercial
        text razon_social
        text documento UK
        text descripcion
        text logo_url
        text telefono_contacto
        citext correo_contacto
        estado_verificacion estado_verificacion
        uuid verificado_por FK
        timestamptz verificado_en
        text motivo_rechazo
        estado_operativo estado_operativo
        bool confirmacion_automatica
        bool cobro_por_plataforma
    }
    aliado_documento {
        uuid id PK
        uuid aliado_id FK
        tipo_doc_aliado tipo
        text archivo_clave
        estado_verificacion estado
        uuid revisado_por FK
        timestamptz revisado_en
        text observacion
    }
    aliado_especie {
        uuid aliado_id PK,FK
        int2 especie_id PK,FK
    }
    especie {
        int2 id PK
        text nombre UK
        bool activa
    }
    fundacion_perfil {
        uuid aliado_id PK,FK
        text ciudad
        text ubicacion
        text contacto_nombre
        text contacto_telefono
        citext contacto_correo
        int2 anio_fundacion
    }
    miembro_aliado {
        uuid id PK
        uuid aliado_id FK
        uuid usuario_id FK
        rol_aliado rol
        bool activo
    }
    sede {
        uuid id PK
        uuid aliado_id FK
        text nombre
        text direccion
        text ciudad
        text localidad
        numeric latitud
        numeric longitud
        text telefono
        bool activa
    }
    usuario {
        uuid id PK
    }
    veterinario {
        uuid id PK
        uuid aliado_id FK
        uuid usuario_id FK
        text matricula_profesional UK
        text foto_url
        text descripcion
        bool activo
    }
    usuario |o--o{ aliado : "verificado_por"
    aliado ||--o{ aliado_documento : "aliado_id"
    usuario |o--o{ aliado_documento : "revisado_por"
    aliado ||--o{ miembro_aliado : "aliado_id"
    usuario ||--o{ miembro_aliado : "usuario_id"
    miembro_aliado ||--o{ veterinario : "aliado_id+usuario_id"
    aliado ||--o{ sede : "aliado_id"
    aliado ||--o| fundacion_perfil : "aliado_id"
    aliado ||--o{ aliado_especie : "aliado_id"
    especie ||--o{ aliado_especie : "especie_id"
```

### 3 · Mascotas, servicios y disponibilidad

```mermaid
erDiagram
    aliado {
        uuid id PK
    }
    especie {
        int2 id PK
        text nombre UK
        bool activa
    }
    excepcion_agenda {
        uuid id PK
        uuid aliado_id FK
        uuid veterinario_id FK
        text tipo
        timestamptz inicio
        timestamptz fin
        text motivo
        uuid creado_por FK
    }
    horario_atencion {
        uuid id PK
        uuid aliado_id FK
        uuid sede_id FK
        uuid veterinario_id FK
        int2 dia_semana
        time hora_inicio
        time hora_fin
        date vigente_desde
        date vigente_hasta
        uuid agenda_clave
        tsrange franja
        daterange vigencia
    }
    mascota {
        uuid id PK
        uuid tutor_id FK
        text nombre
        int2 especie_id FK
        sexo_animal sexo
        text raza
        date fecha_nacimiento
        int2 edad_aproximada_meses
        text color
        numeric peso_kg
        text chip UK
        bool activa
        timestamptz anonimizada_en
    }
    mascota_foto {
        uuid id PK
        uuid mascota_id FK
        text url
        int2 orden
    }
    sede {
        uuid id PK
    }
    servicio {
        uuid id PK
        uuid aliado_id FK
        int2 tipo_servicio_id FK
        text nombre
        text descripcion
        modalidad_servicio modalidad
        uuid sede_id FK
        int2 duracion_min
        numeric precio_base
        bool activo
        estado_moderacion moderacion
    }
    servicio_regla_precio {
        uuid id PK
        uuid servicio_id FK
        int2 especie_id FK
        numeric peso_min_kg
        numeric peso_max_kg
        int4 edad_min_meses
        int4 edad_max_meses
        numeric precio
        int2 prioridad
    }
    tipo_servicio {
        int2 id PK
        text nombre UK
        bool genera_historia_clinica
        bool activo
    }
    usuario {
        uuid id PK
    }
    veterinario {
        uuid id PK
    }
    usuario ||--o{ mascota : "tutor_id"
    especie ||--o{ mascota : "especie_id"
    mascota ||--o{ mascota_foto : "mascota_id"
    aliado ||--o{ servicio : "aliado_id"
    tipo_servicio ||--o{ servicio : "tipo_servicio_id"
    sede |o--o{ servicio : "sede_id+aliado_id"
    servicio ||--o{ servicio_regla_precio : "servicio_id"
    especie |o--o{ servicio_regla_precio : "especie_id"
    aliado ||--o{ horario_atencion : "aliado_id"
    sede |o--o{ horario_atencion : "sede_id+aliado_id"
    veterinario |o--o{ horario_atencion : "veterinario_id+aliado_id"
    aliado ||--o{ excepcion_agenda : "aliado_id"
    usuario |o--o{ excepcion_agenda : "creado_por"
    veterinario |o--o{ excepcion_agenda : "veterinario_id+aliado_id"
```

### 4 · Citas e historia clínica

```mermaid
erDiagram
    aliado {
        uuid id PK
    }
    cita {
        uuid id PK
        uuid tutor_id FK
        uuid mascota_id FK
        uuid aliado_id FK
        uuid servicio_id FK
        uuid sede_id FK
        uuid veterinario_id FK
        timestamptz inicio
        timestamptz fin
        modalidad_servicio modalidad
        text direccion_domicilio
        varchar motivo
        estado_cita estado
        numeric precio_acordado
        text recomendaciones
        uuid cerrada_por FK
        timestamptz cerrada_en
        uuid cancelada_por FK
        timestamptz cancelada_en
        text motivo_cancelacion
        numeric penalidad
        int2 reprogramada_veces
        text clave_idempotencia
    }
    condicion_corporal {
        int2 id PK
        text nombre UK
    }
    consulta {
        uuid id PK
        uuid cita_id FK,UK
        uuid mascota_id FK
        uuid veterinario_id FK
        timestamptz fecha
        jsonb propietario_snapshot
        text motivo_consulta
        text descripcion_propietario
        int2 estado_mental_id FK
        int2 condicion_corporal_id FK
        text comportamiento
        text estado_general
        text lista_problemas
        text diagnostico_presuntivo
        text tratamiento
        text examenes
        text observaciones
        estado_consulta estado
        timestamptz cerrada_en
        uuid cerrada_por FK
    }
    consulta_anexo {
        uuid id PK
        uuid consulta_id FK
        text nombre_archivo
        text mime_type
        int8 tamano_bytes
        text clave_almacenamiento
        uuid subido_por FK
    }
    consulta_anotacion {
        uuid id PK
        uuid consulta_id FK
        uuid autor_id FK
        text campo
        text texto
    }
    control_seguimiento {
        uuid id PK
        uuid consulta_id FK
        uuid mascota_id FK
        date fecha_control
        text nota
        estado_control estado
        uuid cita_id FK
    }
    estado_mental {
        int2 id PK
        text nombre UK
    }
    mascota {
        uuid id PK
    }
    sede {
        uuid id PK
    }
    servicio {
        uuid id PK
    }
    signos_vitales {
        uuid consulta_id PK,FK
        numeric peso_kg
        numeric temperatura_c
        int2 frecuencia_cardiaca
        int2 frecuencia_respiratoria
        int2 pulso
        text mucosas
        numeric llenado_capilar_seg
        numeric glucemia_mg_dl
        int2 presion_sistolica
        int2 presion_diastolica
    }
    usuario {
        uuid id PK
    }
    veterinario {
        uuid id PK
    }
    usuario ||--o{ cita : "tutor_id"
    aliado ||--o{ cita : "aliado_id"
    usuario |o--o{ cita : "cerrada_por"
    usuario |o--o{ cita : "cancelada_por"
    mascota ||--o{ cita : "mascota_id+tutor_id"
    servicio ||--o{ cita : "servicio_id+aliado_id"
    sede |o--o{ cita : "sede_id+aliado_id"
    veterinario |o--o{ cita : "veterinario_id+aliado_id"
    cita ||--o| consulta : "cita_id"
    veterinario ||--o{ consulta : "veterinario_id"
    estado_mental |o--o{ consulta : "estado_mental_id"
    condicion_corporal |o--o{ consulta : "condicion_corporal_id"
    usuario |o--o{ consulta : "cerrada_por"
    cita ||--o{ consulta : "cita_id+mascota_id"
    consulta ||--o| signos_vitales : "consulta_id"
    consulta ||--o{ consulta_anexo : "consulta_id"
    usuario |o--o{ consulta_anexo : "subido_por"
    cita |o--o{ control_seguimiento : "cita_id"
    consulta ||--o{ control_seguimiento : "consulta_id+mascota_id"
    consulta ||--o{ consulta_anotacion : "consulta_id"
    usuario ||--o{ consulta_anotacion : "autor_id"
```

### 5 · Productos y pedidos

```mermaid
erDiagram
    aliado {
        uuid id PK
    }
    categoria_producto {
        int2 id PK
        text nombre UK
        int2 padre_id FK
    }
    pedido {
        uuid id PK
        uuid tutor_id FK
        uuid aliado_id FK
        estado_pedido estado
        metodo_entrega metodo_entrega
        text direccion_entrega
        text referencia_envio
        numeric subtotal
        numeric impuestos
        numeric total
        text notas
        text motivo_cancelacion
        text clave_idempotencia
        timestamptz despachado_en
        timestamptz entregado_en
        timestamptz cancelado_en
    }
    pedido_item {
        uuid id PK
        uuid pedido_id FK
        uuid producto_id FK
        text nombre_producto
        int4 cantidad
        numeric precio_unitario
        numeric impuesto_pct
    }
    producto {
        uuid id PK
        uuid aliado_id FK
        int2 categoria_id FK
        text nombre
        text descripcion
        numeric precio
        numeric impuesto_pct
        int4 stock
        bool es_medicamento
        bool requiere_formula
        bool activo
        estado_moderacion moderacion
    }
    producto_foto {
        uuid id PK
        uuid producto_id FK
        text url
        int2 orden
        estado_moderacion moderacion
    }
    usuario {
        uuid id PK
    }
    categoria_producto |o--o{ categoria_producto : "padre_id"
    aliado ||--o{ producto : "aliado_id"
    categoria_producto ||--o{ producto : "categoria_id"
    producto ||--o{ producto_foto : "producto_id"
    usuario ||--o{ pedido : "tutor_id"
    aliado ||--o{ pedido : "aliado_id"
    pedido ||--o{ pedido_item : "pedido_id"
    producto ||--o{ pedido_item : "producto_id"
```

### 6 · Planes, suscripciones, pagos y facturación

```mermaid
erDiagram
    aliado {
        uuid id PK
    }
    cita {
        uuid id PK
    }
    comision {
        uuid id PK
        uuid pago_id FK,UK
        uuid aliado_id FK
        numeric base
        numeric porcentaje
        numeric monto
    }
    comision_config {
        uuid id PK
        text aplica_a
        uuid aliado_id FK
        numeric porcentaje
        date vigente_desde
        date vigente_hasta
        uuid creado_por FK
    }
    factura_electronica {
        uuid id PK
        uuid pago_id FK
        uuid emisor_aliado_id FK
        text proveedor
        text prefijo
        text numero
        text cufe UK
        estado_factura estado
        text receptor_nombre
        text receptor_documento
        numeric subtotal
        numeric impuestos
        numeric total
        text pdf_url
        text xml_url
        jsonb respuesta_proveedor
        timestamptz emitida_en
    }
    pago {
        uuid id PK
        uuid pagador_id FK
        uuid cita_id FK
        uuid pedido_id FK
        uuid suscripcion_id FK
        numeric monto
        bpchar moneda
        estado_pago estado
        text pasarela
        text referencia_pasarela
        text metodo
        timestamptz aprobado_en
    }
    pedido {
        uuid id PK
    }
    plan {
        uuid id PK
        text codigo UK
        text nombre
        destinatario_plan destinatario
        numeric precio_mensual
        jsonb beneficios
        bool activo
        date vigente_desde
        date vigente_hasta
        uuid creado_por FK
    }
    reembolso {
        uuid id PK
        uuid pago_id FK
        numeric monto
        text motivo
        estado_reembolso estado
        text referencia_pasarela
        uuid solicitado_por FK
    }
    suscripcion {
        uuid id PK
        uuid plan_id FK
        uuid aliado_id FK
        uuid usuario_id FK
        estado_suscripcion estado
        timestamptz inicio_en
        timestamptz periodo_actual_inicio
        timestamptz periodo_actual_fin
        bool cancelar_al_finalizar
        timestamptz cancelada_en
    }
    usuario {
        uuid id PK
    }
    usuario |o--o{ plan : "creado_por"
    plan ||--o{ suscripcion : "plan_id"
    aliado |o--o{ suscripcion : "aliado_id"
    usuario |o--o{ suscripcion : "usuario_id"
    usuario ||--o{ pago : "pagador_id"
    cita |o--o{ pago : "cita_id"
    pedido |o--o{ pago : "pedido_id"
    suscripcion |o--o{ pago : "suscripcion_id"
    pago ||--o{ reembolso : "pago_id"
    usuario |o--o{ reembolso : "solicitado_por"
    aliado |o--o{ comision_config : "aliado_id"
    usuario |o--o{ comision_config : "creado_por"
    pago ||--o| comision : "pago_id"
    aliado ||--o{ comision : "aliado_id"
    pago ||--o{ factura_electronica : "pago_id"
    aliado |o--o{ factura_electronica : "emisor_aliado_id"
```

### 7 · Reseñas, chat, notificaciones y PQRS

```mermaid
erDiagram
    aliado {
        uuid id PK
    }
    cita {
        uuid id PK
    }
    conversacion {
        uuid id PK
        uuid tutor_id FK
        uuid aliado_id FK
    }
    mensaje {
        uuid id PK
        uuid conversacion_id FK
        uuid emisor_id FK
        text cuerpo
        timestamptz leido_en
    }
    notificacion {
        uuid id PK
        uuid usuario_id FK
        text tipo
        canal_notificacion canal
        text asunto
        text cuerpo
        jsonb datos
        text referencia_tipo
        uuid referencia_id
        bool es_publicidad
        estado_notificacion estado
        timestamptz programada_para
        timestamptz enviada_en
        timestamptz leida_en
        int2 intentos
        text ultimo_error
        text clave_dedupe UK
    }
    pedido {
        uuid id PK
    }
    pqrs {
        uuid id PK
        int8 radicado UK
        uuid usuario_id FK
        tipo_pqrs tipo
        text asunto
        text descripcion
        uuid cita_id FK
        uuid pedido_id FK
        estado_pqrs estado
        uuid asignada_a FK
        timestamptz cerrada_en
    }
    pqrs_seguimiento {
        uuid id PK
        uuid pqrs_id FK
        uuid autor_id FK
        text mensaje
        bool visible_usuario
    }
    resena {
        uuid id PK
        uuid cita_id FK,UK
        uuid tutor_id FK
        uuid aliado_id FK
        int2 calificacion
        text comentario
        estado_moderacion moderacion
    }
    usuario {
        uuid id PK
    }
    cita ||--o{ resena : "cita_id+tutor_id+aliado_id"
    usuario ||--o{ conversacion : "tutor_id"
    aliado ||--o{ conversacion : "aliado_id"
    conversacion ||--o{ mensaje : "conversacion_id"
    usuario ||--o{ mensaje : "emisor_id"
    usuario ||--o{ notificacion : "usuario_id"
    usuario ||--o{ pqrs : "usuario_id"
    cita |o--o{ pqrs : "cita_id"
    pedido |o--o{ pqrs : "pedido_id"
    usuario |o--o{ pqrs : "asignada_a"
    pqrs ||--o{ pqrs_seguimiento : "pqrs_id"
    usuario ||--o{ pqrs_seguimiento : "autor_id"
```

### 8 · Adopción

```mermaid
erDiagram
    adopcion_media {
        uuid id PK
        uuid mascota_adopcion_id FK
        tipo_media tipo
        text url
        int2 orden
        estado_moderacion moderacion
    }
    aliado {
        uuid id PK
    }
    especie {
        int2 id PK
        text nombre UK
        bool activa
    }
    fundacion_perfil {
        uuid aliado_id PK,FK
        text ciudad
        text ubicacion
        text contacto_nombre
        text contacto_telefono
        citext contacto_correo
        int2 anio_fundacion
    }
    mascota_adopcion {
        uuid id PK
        uuid fundacion_id FK
        text nombre
        int2 especie_id FK
        int2 edad_meses
        sexo_animal sexo
        tamano_mascota tamano
        text ciudad
        text zona
        text descripcion
        estado_adopcion estado
        bool pausada
    }
    solicitud_adopcion {
        uuid id PK
        uuid mascota_adopcion_id FK
        uuid tutor_id FK
        estado_solicitud_adopcion estado
        int2 version_formulario
        jsonb datos_personales
        jsonb hogar_experiencia
        text motivacion
        int2 calificacion
        text motivo_decision
        uuid decidido_por FK
        timestamptz decidido_en
        text clave_idempotencia
    }
    usuario {
        uuid id PK
    }
    aliado ||--o| fundacion_perfil : "aliado_id"
    aliado ||--o{ mascota_adopcion : "fundacion_id"
    especie ||--o{ mascota_adopcion : "especie_id"
    mascota_adopcion ||--o{ adopcion_media : "mascota_adopcion_id"
    mascota_adopcion ||--o{ solicitud_adopcion : "mascota_adopcion_id"
    usuario ||--o{ solicitud_adopcion : "tutor_id"
    usuario |o--o{ solicitud_adopcion : "decidido_por"
```

### 9 · Administración y auditoría

```mermaid
erDiagram
    accion_administrativa {
        uuid id PK
        uuid admin_id FK
        text objetivo_tipo
        uuid objetivo_id
        accion_moderacion accion
        text motivo
    }
    auditoria {
        int8 id PK
        text tabla
        text registro_id
        bpchar accion
        uuid usuario_id
        jsonb datos_antes
        jsonb datos_despues
    }
    historial_estado {
        int8 id PK
        text entidad
        uuid entidad_id
        text estado_anterior
        text estado_nuevo
        uuid cambiado_por FK
        text motivo
        timestamptz cambiado_en
    }
    usuario {
        uuid id PK
    }
    usuario |o--o{ historial_estado : "cambiado_por"
    usuario ||--o{ accion_administrativa : "admin_id"
```
