SET search_path TO veto, public;

CREATE TYPE tipo_media_adopcion AS ENUM ('FOTO', 'VIDEO');

CREATE TABLE mascota_adopcion_media (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mascota_adopcion_id uuid NOT NULL REFERENCES mascota_adopcion(id) ON DELETE CASCADE,
    tipo                tipo_media_adopcion NOT NULL,
    url                 text NOT NULL CHECK (url ~ '^https?://'),
    posicion            smallint NOT NULL CHECK (posicion > 0),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (mascota_adopcion_id, tipo, posicion)
);

CREATE UNIQUE INDEX mascota_adopcion_un_video
    ON mascota_adopcion_media (mascota_adopcion_id)
    WHERE tipo = 'VIDEO';

INSERT INTO mascota_adopcion_media (mascota_adopcion_id, tipo, url, posicion)
SELECT id, 'FOTO', foto_url, 1
  FROM mascota_adopcion
 WHERE foto_url IS NOT NULL;

DROP VIEW v_catalogo_adopcion;
CREATE VIEW v_catalogo_adopcion AS
SELECT m.id, m.nombre, e.nombre AS especie, m.especie_id, m.edad_meses, m.sexo, m.tamano,
       m.ubicacion, m.descripcion,
       COALESCE(media.fotos, ARRAY[]::text[]) AS fotos,
       media.video_url
  FROM mascota_adopcion m
  JOIN especie e ON e.id = m.especie_id
  JOIN aliado f  ON f.id = m.fundacion_id
  LEFT JOIN LATERAL (
      SELECT array_agg(mm.url ORDER BY mm.posicion, mm.id)
                 FILTER (WHERE mm.tipo = 'FOTO') AS fotos,
             max(mm.url) FILTER (WHERE mm.tipo = 'VIDEO') AS video_url
        FROM mascota_adopcion_media mm
       WHERE mm.mascota_adopcion_id = m.id
  ) media ON true
 WHERE m.estado = 'DISPONIBLE' AND f.estado = 'ACTIVO';