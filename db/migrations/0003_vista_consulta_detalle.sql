SET search_path TO veto, public;

-- HU-014: lectura de consultas para el módulo clinica.
-- Une la consulta con los datos de la cita, el servicio y la mascota que el veterinario necesita
-- ver, sin que el módulo clinica haga SQL sobre tablas de otros módulos. Es solo de lectura.
-- Siempre se consulta filtrando por veterinario_id (el veterinario de la sesión).
CREATE VIEW v_consulta_detalle AS
SELECT k.id,
       k.cita_id,
       k.veterinario_id,
       k.mascota_id,
       k.motivo_consulta,
       k.descripcion_propietario,
       k.estado_mental,
       k.condicion_corporal,
       k.comportamiento,
       k.estado_general,
       k.estado,
       k.cerrada_en,
       k.creado_en,
       c.aliado_id,
       c.inicio AS cita_inicio,
       c.fin    AS cita_fin,
       s.nombre AS servicio,
       m.nombre AS mascota_nombre,
       e.nombre AS especie
  FROM consulta k
  JOIN cita c     ON c.id = k.cita_id
  JOIN servicio s ON s.id = c.servicio_id
  JOIN mascota m  ON m.id = k.mascota_id
  JOIN especie e  ON e.id = m.especie_id;
