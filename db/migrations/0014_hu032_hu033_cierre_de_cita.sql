SET search_path TO veto, public;

-- HU-032 (marcar la cita como finalizada o no asistió) y HU-033 (recomendaciones al cerrarla).
--
-- Casi todo ya existe en el modelo y NO se vuelve a implementar aquí:
--   * fn_cita_validar (0005) ya exige que solo el aliado (su administrador o un veterinario
--     activo) pase una cita AGENDADA a FINALIZADA o NO_ASISTIO, rechaza hacerlo desde PENDIENTE
--     y deja FINALIZADA, NO_ASISTIO y CANCELADA como estados finales.
--   * El trigger trg_cita_historial escribe cada cambio de estado en historial_estado con el
--     estado anterior, el nuevo, la fecha, el responsable (app.usuario_id) y la observación
--     (app.motivo); la tabla es de solo inserción.
--   * La tabla notificacion y la columna cita.recomendaciones ya están en 0001.
-- La hora de la cita la comprueba la API contra el reloj de la base (now()): si fuera un trigger
-- no se podrían cerrar citas futuras en las pruebas ni en cargas de datos históricos.

-- 1. Recomendaciones del aliado (HU-033): texto de 1 a 2000 caracteres, o NULL si no hay.
ALTER TABLE cita
    ADD CONSTRAINT cita_recomendaciones_largo
        CHECK (recomendaciones IS NULL OR char_length(recomendaciones) BETWEEN 1 AND 2000);

-- 2. El detalle de la cita muestra las recomendaciones al tutor y al aliado (HU-033).
--    (Una columna nueva al final: la vista de 0013 sigue igual.)
CREATE OR REPLACE VIEW v_cita_detalle AS
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
       uv.nombre AS veterinario_nombre,
       c.recomendaciones
  FROM cita c
  JOIN usuario ut      ON ut.id = c.tutor_id
  JOIN mascota m       ON m.id = c.mascota_id
  JOIN especie e       ON e.id = m.especie_id
  JOIN aliado a        ON a.id = c.aliado_id
  JOIN servicio s      ON s.id = c.servicio_id
  LEFT JOIN veterinario v ON v.id = c.veterinario_id
  LEFT JOIN usuario uv    ON uv.id = v.usuario_id;
