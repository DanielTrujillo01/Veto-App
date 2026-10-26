### Vista general (entidades principales, sin columnas)

```mermaid
erDiagram
    usuario ||--o| aliado : ""
    aliado ||--o{ veterinario : ""
    usuario ||--o| veterinario : ""
    aliado ||--o{ sede : ""
    usuario ||--o{ mascota : ""
    especie ||--o{ mascota : ""
    aliado ||--o{ servicio : ""
    tipo_servicio ||--o{ servicio : ""
    sede |o--o{ servicio : ""
    servicio ||--o{ servicio_regla_precio : ""
    especie |o--o{ servicio_regla_precio : ""
    aliado ||--o{ horario : ""
    veterinario |o--o{ horario : ""
    usuario ||--o{ cita : ""
    aliado ||--o{ cita : ""
    mascota ||--o{ cita : ""
    servicio ||--o{ cita : ""
    veterinario |o--o{ cita : ""
    veterinario ||--o{ consulta : ""
    cita ||--o{ consulta : ""
    consulta ||--o{ consulta_anotacion : ""
    usuario ||--o{ consulta_anotacion : ""
    aliado ||--o{ producto : ""
    categoria_producto ||--o{ producto : ""
    usuario ||--o{ pedido : ""
    aliado ||--o{ pedido : ""
    pedido ||--o{ pedido_item : ""
    producto ||--o{ pedido_item : ""
    aliado ||--o{ mascota_adopcion : ""
    especie ||--o{ mascota_adopcion : ""
    mascota_adopcion ||--o{ solicitud_adopcion : ""
    usuario ||--o{ solicitud_adopcion : ""
    usuario ||--o{ notificacion : ""
    usuario ||--o{ accion_admin : ""
```

### 1 · Usuarios, aliados y veterinarios

```mermaid
erDiagram
    aliado {
        uuid id PK
        uuid usuario_id FK,UK
        tipo_aliado tipo
        text nombre
        text descripcion
        text logo_url
        text contacto
        estado_aliado estado
        text ciudad
        text ubicacion
        int2 anio_fundacion
    }
    aliado_especie {
        uuid aliado_id PK,FK
        int2 especie_id PK,FK
    }
    especie {
        int2 id PK
        text nombre UK
    }
    sede {
        uuid id PK
        uuid aliado_id FK
        text nombre
        text direccion
        text ciudad
        bool activa
    }
    usuario {
        uuid id PK
        text nombre
        text celular
        citext correo UK
        text password_hash
        rol_usuario rol
        estado_cuenta estado
        timestamptz eliminado_en
    }
    veterinario {
        uuid id PK
        uuid aliado_id FK
        uuid usuario_id FK,UK
        text foto_url
        text descripcion
        bool activo
    }
    usuario ||--o| aliado : "usuario_id"
    aliado ||--o{ veterinario : "aliado_id"
    usuario ||--o| veterinario : "usuario_id"
    aliado ||--o{ sede : "aliado_id"
    aliado ||--o{ aliado_especie : "aliado_id"
    especie ||--o{ aliado_especie : "especie_id"
```

### 2 · Mascotas, servicios y horarios

```mermaid
erDiagram
    aliado {
        uuid id PK
    }
    especie {
        int2 id PK
        text nombre UK
    }
    horario {
        uuid id PK
        uuid aliado_id FK
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
        int2 edad_meses
        text color
        numeric peso_kg
        text chip UK
    }
    mascota_foto {
        uuid id PK
        uuid mascota_id FK
        text url
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
    aliado ||--o{ horario : "aliado_id"
    veterinario |o--o{ horario : "veterinario_id+aliado_id"
```

### 3 · Citas y registro de consulta

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
        uuid veterinario_id FK
        timestamptz inicio
        timestamptz fin
        estado_cita estado
        numeric precio
        text recomendaciones
    }
    consulta {
        uuid id PK
        uuid cita_id FK,UK
        uuid mascota_id FK
        uuid veterinario_id FK
        text motivo_consulta
        text descripcion_propietario
        text estado_mental
        text condicion_corporal
        text comportamiento
        text estado_general
        estado_consulta estado
        timestamptz cerrada_en
        uuid cerrada_por FK
    }
    consulta_anotacion {
        uuid id PK
        uuid consulta_id FK
        uuid autor_id FK
        text campo
        text texto
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
    mascota {
        uuid id PK
    }
    servicio {
        uuid id PK
    }
    usuario {
        uuid id PK
    }
    veterinario {
        uuid id PK
    }
    usuario ||--o{ cita : "tutor_id"
    aliado ||--o{ cita : "aliado_id"
    mascota ||--o{ cita : "mascota_id+tutor_id"
    servicio ||--o{ cita : "servicio_id+aliado_id"
    veterinario |o--o{ cita : "veterinario_id+aliado_id"
    usuario |o--o{ historial_estado : "cambiado_por"
    veterinario ||--o{ consulta : "veterinario_id"
    usuario |o--o{ consulta : "cerrada_por"
    cita ||--o{ consulta : "cita_id+mascota_id"
    consulta ||--o{ consulta_anotacion : "consulta_id"
    usuario ||--o{ consulta_anotacion : "autor_id"
```

### 4 · Productos y pedidos

```mermaid
erDiagram
    aliado {
        uuid id PK
    }
    categoria_producto {
        int2 id PK
        text nombre UK
    }
    pedido {
        uuid id PK
        uuid tutor_id FK
        uuid aliado_id FK
        estado_pedido estado
        numeric total
    }
    pedido_item {
        uuid id PK
        uuid pedido_id FK
        uuid producto_id FK
        int4 cantidad
        numeric precio_unitario
    }
    producto {
        uuid id PK
        uuid aliado_id FK
        int2 categoria_id FK
        text nombre
        text descripcion
        numeric precio
        int4 stock
        bool activo
        estado_moderacion moderacion
    }
    producto_foto {
        uuid id PK
        uuid producto_id FK
        text url
        estado_moderacion moderacion
    }
    usuario {
        uuid id PK
    }
    aliado ||--o{ producto : "aliado_id"
    categoria_producto ||--o{ producto : "categoria_id"
    producto ||--o{ producto_foto : "producto_id"
    usuario ||--o{ pedido : "tutor_id"
    aliado ||--o{ pedido : "aliado_id"
    pedido ||--o{ pedido_item : "pedido_id"
    producto ||--o{ pedido_item : "producto_id"
```

### 5 · Adopción

```mermaid
erDiagram
    aliado {
        uuid id PK
    }
    especie {
        int2 id PK
        text nombre UK
    }
    mascota_adopcion {
        uuid id PK
        uuid fundacion_id FK
        text nombre
        int2 especie_id FK
        int2 edad_meses
        sexo_animal sexo
        tamano_mascota tamano
        text ubicacion
        text descripcion
        text foto_url
        estado_mascota_adopcion estado
    }
    solicitud_adopcion {
        uuid id PK
        uuid mascota_adopcion_id FK
        uuid tutor_id FK
        estado_solicitud estado
        jsonb datos_personales
        jsonb hogar_experiencia
        text motivacion
        int2 calificacion
        text motivo_decision
        uuid decidido_por FK
        timestamptz decidido_en
    }
    usuario {
        uuid id PK
    }
    aliado ||--o{ mascota_adopcion : "fundacion_id"
    especie ||--o{ mascota_adopcion : "especie_id"
    mascota_adopcion ||--o{ solicitud_adopcion : "mascota_adopcion_id"
    usuario ||--o{ solicitud_adopcion : "tutor_id"
    usuario |o--o{ solicitud_adopcion : "decidido_por"
```

### 6 · Notificaciones y administración

```mermaid
erDiagram
    accion_admin {
        uuid id PK
        uuid admin_id FK
        text objetivo_tipo
        uuid objetivo_id
        tipo_accion_admin accion
        text motivo
    }
    notificacion {
        uuid id PK
        uuid usuario_id FK
        text tipo
        text mensaje
        uuid referencia_id
        timestamptz leida_en
    }
    usuario {
        uuid id PK
    }
    usuario ||--o{ notificacion : "usuario_id"
    usuario ||--o{ accion_admin : "admin_id"
```
