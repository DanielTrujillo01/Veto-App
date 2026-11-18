SET search_path TO veto, public;

-- HU-044 (crear, editar y desactivar productos de una tienda).
--
-- Ya existe en 0001 y NO se vuelve a implementar aquí:
--   * producto.activo: desactivar en vez de borrar (los pedidos conservan su producto).
--   * pedido_item.precio_unitario: el precio al que se compró; editar el precio no lo altera.
--   * trg_producto_tipo: solo un aliado TIENDA tiene productos.
--   * stock >= 0 y precio >= 0.

-- 1. Orden de las fotos: la primera es la portada (§2.7). Las fotos que ya existían quedan en el
--    orden en que se guardaron.
ALTER TABLE producto_foto ADD COLUMN posicion smallint;

UPDATE producto_foto f
   SET posicion = o.n
  FROM (SELECT id, row_number() OVER (PARTITION BY producto_id ORDER BY id) AS n
          FROM producto_foto) o
 WHERE o.id = f.id;

ALTER TABLE producto_foto
    ALTER COLUMN posicion SET NOT NULL,
    ADD CONSTRAINT producto_foto_posicion CHECK (posicion BETWEEN 1 AND 5),
    ADD CONSTRAINT producto_foto_posicion_unica UNIQUE (producto_id, posicion),
    ADD CONSTRAINT producto_foto_url CHECK (url ~ '^https?://');

-- 2. Datos del producto (mismas reglas que @veto/shared): nombre de 2 a 120 caracteres,
--    descripción de hasta 2000, precio en pesos sin decimales y mayor que 0.
--    NOT VALID: se exige a partir de ahora sin revisar filas antiguas.
ALTER TABLE producto
    ADD CONSTRAINT producto_nombre_largo CHECK (char_length(nombre) BETWEEN 2 AND 120) NOT VALID,
    ADD CONSTRAINT producto_descripcion_largo
        CHECK (descripcion IS NULL OR char_length(descripcion) BETWEEN 1 AND 2000) NOT VALID,
    ADD CONSTRAINT producto_precio_entero CHECK (precio > 0 AND precio = trunc(precio)) NOT VALID;

-- 3. Lista del panel: los productos de la tienda, más recientes primero.
CREATE INDEX producto_aliado_recientes ON producto (aliado_id, creado_en DESC);
