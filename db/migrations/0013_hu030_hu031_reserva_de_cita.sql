SET search_path TO veto, public;

-- HU-030 (motivo de la cita) y HU-031 (reservar y confirmar).
--
-- La reserva se arma en pasos (fecha y hora → mascota y motivo → confirmar). El borrador de
-- `seleccion_horario` (0012) guarda lo que la persona va eligiendo; al confirmar, la API crea la
-- cita con esos datos y deja el borrador apuntando a ella (`cita_id`). Gracias a ese vínculo, un
-- doble clic o un reintento de la confirmación devuelve la misma cita en vez de crear otra.

-- 1. Motivo de la cita (HU-030) -------------------------------------------------------------
-- Texto libre de 1 a 500 caracteres (se cuentan caracteres, no bytes). Sin motivo es NULL: la
-- API convierte el texto vacío en NULL. 500 es el límite que ya traía el modelo original.
ALTER TABLE cita
    ADD COLUMN motivo text CONSTRAINT cita_motivo_largo
        CHECK (motivo IS NULL OR char_length(motivo) BETWEEN 1 AND 500);

-- 2. El borrador guarda mascota y motivo, y a qué cita terminó ------------------------------
ALTER TABLE seleccion_horario
    ADD COLUMN mascota_id uuid,
    ADD COLUMN motivo     text CONSTRAINT seleccion_motivo_largo
        CHECK (motivo IS NULL OR char_length(motivo) BETWEEN 1 AND 500),
    ADD COLUMN cita_id    uuid REFERENCES cita(id) ON DELETE SET NULL,
    -- La mascota debe ser del mismo tutor; si la mascota se borra, solo se suelta ella
    -- (la columna tutor_id es la llave primaria y no puede quedar nula).
    ADD FOREIGN KEY (mascota_id, tutor_id) REFERENCES mascota(id, tutor_id)
        ON DELETE SET NULL (mascota_id);

-- 3. Detalle de una cita para quienes tienen permiso de verla (HU-030, HU-031) ---------------
-- Une la cita con los nombres que se muestran (tutor, mascota, aliado, servicio, veterinario)
-- para que el módulo citas no haga SQL sobre tablas de otros módulos. Es solo de lectura.
-- Siempre se consulta filtrando por la persona autorizada: el tutor de la cita, el
-- administrador del aliado o un veterinario activo de ese aliado.
CREATE VIEW v_cita_detalle AS
SELECT c.id,
       c.estado,
       c.inicio,
       c.fin,
       c.precio,
       c.motivo,
       c.creado_en,
       c.tutor_id,
       ut.nombre AS tutor_nombre,
       c.mascota_id,
       m.nombre  AS mascota_nombre,
       e.nombre  AS especie,
       c.aliado_id,
       a.nombre  AS aliado_nombre,
       a.usuario_id AS aliado_usuario_id,
       c.servicio_id,
       s.nombre  AS servicio_nombre,
       c.veterinario_id,
       uv.nombre AS veterinario_nombre
  FROM cita c
  JOIN usuario ut      ON ut.id = c.tutor_id
  JOIN mascota m       ON m.id = c.mascota_id
  JOIN especie e       ON e.id = m.especie_id
  JOIN aliado a        ON a.id = c.aliado_id
  JOIN servicio s      ON s.id = c.servicio_id
  LEFT JOIN veterinario v ON v.id = c.veterinario_id
  LEFT JOIN usuario uv    ON uv.id = v.usuario_id;
