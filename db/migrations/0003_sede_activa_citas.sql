SET search_path TO veto, public;

CREATE FUNCTION fn_cita_sede_activa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM servicio s
          LEFT JOIN sede se ON se.id = s.sede_id AND se.aliado_id = s.aliado_id
         WHERE s.id = NEW.servicio_id
           AND s.modalidad = 'EN_SEDE'
           AND NOT COALESCE(se.activa, false)
    ) THEN
        RAISE EXCEPTION 'La sede del servicio no está disponible para reservas'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_cita_sede_activa
    BEFORE INSERT OR UPDATE OF servicio_id ON cita
    FOR EACH ROW EXECUTE FUNCTION fn_cita_sede_activa();
