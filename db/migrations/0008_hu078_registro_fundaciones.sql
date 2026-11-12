-- HU-078: registro de fundaciones.
-- 0001 ya exige que una fundación tenga ciudad, ubicación, contacto, año y descripción
-- (NOT NULL). Aquí se cierran los huecos que dejaba: textos en blanco, años futuros y logos
-- que no son una URL web. Las restricciones nacen NOT VALID: se aplican a todo lo que se
-- inserte o modifique desde ahora, sin rechazar filas que ya existían.

ALTER TABLE aliado ADD CONSTRAINT aliado_fundacion_texto_valido CHECK (
    tipo <> 'FUNDACION' OR (
        btrim(nombre) <> '' AND btrim(ciudad) <> '' AND btrim(ubicacion) <> ''
        AND btrim(contacto) <> '' AND btrim(descripcion) <> ''
    )
) NOT VALID;

-- El logo es opcional, pero si viene debe ser una URL http(s): la web lo muestra tal cual.
ALTER TABLE aliado ADD CONSTRAINT aliado_logo_url_valida CHECK (
    logo_url IS NULL OR logo_url ~* '^https?://[^[:space:]]+$'
) NOT VALID;

-- Una fundación no puede haberse fundado en el futuro. El año actual no es inmutable, así que
-- no cabe en un CHECK: se revisa con un trigger. Se usa UTC para no rechazar de más.
CREATE FUNCTION fn_fundacion_anio_valido() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.anio_fundacion IS NOT NULL
       AND NEW.anio_fundacion > EXTRACT(YEAR FROM (now() AT TIME ZONE 'UTC'))::int THEN
        RAISE EXCEPTION 'El año de fundación (%) no puede ser posterior al año actual', NEW.anio_fundacion
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_fundacion_anio_valido
    BEFORE INSERT OR UPDATE OF anio_fundacion ON aliado
    FOR EACH ROW EXECUTE FUNCTION fn_fundacion_anio_valido();
