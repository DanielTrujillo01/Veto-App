SET search_path TO veto, public;

-- HU-022: horario de atención y calendario de disponibilidad del aliado Vet.
--
-- El horario semanal ya existe (tabla `horario`, HU-016). Esta migración agrega lo que falta
-- para que el calendario sea confiable:
--
--   1. `bloqueo_agenda`: intervalos concretos en que el veterinario NO atiende (vacaciones,
--      permisos, un día libre). Un bloqueo le gana al horario semanal.
--   2. Una cita nueva no puede caer dentro de un bloqueo.
--   3. No se puede bloquear un intervalo ni recortar el horario si eso deja citas vigentes
--      (PENDIENTE o AGENDADA) fuera de la atención: primero se reprograman o cancelan.
--
-- Las tres reglas viven en la base para que se cumplan igual venga la escritura de donde venga.

-- 1. Bloqueos del calendario -------------------------------------------------------------
CREATE TABLE bloqueo_agenda (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aliado_id       uuid NOT NULL REFERENCES aliado(id),
    veterinario_id  uuid NOT NULL,
    inicio          timestamptz NOT NULL,
    fin             timestamptz NOT NULL,
    motivo          text CHECK (motivo IS NULL OR length(motivo) <= 200),   -- solo lo ve el aliado
    creado_en       timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (veterinario_id, aliado_id) REFERENCES veterinario(id, aliado_id),
    CHECK (fin > inicio),
    CONSTRAINT bloqueo_sin_solapamiento EXCLUDE USING gist
        (veterinario_id WITH =, tstzrange(inicio, fin) WITH &&)
);
CREATE INDEX ON bloqueo_agenda (aliado_id);
CREATE INDEX ON bloqueo_agenda (veterinario_id, fin);

-- Candado por veterinario: serializa "reservar", "bloquear" y "cambiar el horario" del mismo
-- veterinario. Sin él, dos transacciones simultáneas no verían los cambios sin confirmar de la
-- otra y podrían dejar una cita dentro de un bloqueo o fuera del horario.
CREATE FUNCTION fn_candado_agenda(p_veterinario uuid) RETURNS void LANGUAGE sql AS $$
    SELECT pg_advisory_xact_lock(hashtextextended('agenda:' || p_veterinario::text, 0));
$$;

-- 2. Una cita no puede caer en un bloqueo --------------------------------------------------
CREATE FUNCTION fn_cita_fuera_de_bloqueo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.veterinario_id IS NULL OR NEW.estado NOT IN ('PENDIENTE', 'AGENDADA') THEN
        RETURN NEW;
    END IF;
    PERFORM fn_candado_agenda(NEW.veterinario_id);
    IF EXISTS (SELECT 1 FROM bloqueo_agenda b
                WHERE b.veterinario_id = NEW.veterinario_id
                  AND tstzrange(b.inicio, b.fin) && tstzrange(NEW.inicio, NEW.fin)) THEN
        RAISE EXCEPTION 'El veterinario no atiende en ese horario (agenda bloqueada)'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_cita_fuera_de_bloqueo
    BEFORE INSERT OR UPDATE OF inicio, fin, veterinario_id, estado ON cita
    FOR EACH ROW EXECUTE FUNCTION fn_cita_fuera_de_bloqueo();

-- Misma validación de 0001 (la cita cabe en el horario semanal), ahora con el candado para
-- que un cambio de horario simultáneo no deje pasar una cita fuera de él.
CREATE OR REPLACE FUNCTION fn_cita_dentro_del_horario() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_dia smallint := extract(isodow FROM NEW.inicio)::smallint;
    v_fecha date := NEW.inicio::date;
    v_inicio time := NEW.inicio::time;
    v_fin time := NEW.fin::time;
BEGIN
    IF NEW.veterinario_id IS NOT NULL THEN
        PERFORM fn_candado_agenda(NEW.veterinario_id);
    END IF;
    IF NEW.veterinario_id IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM veterinario v
            WHERE v.id = NEW.veterinario_id AND v.aliado_id = NEW.aliado_id
       )
       AND NOT EXISTS (
        SELECT 1 FROM horario h
         WHERE h.aliado_id = NEW.aliado_id AND h.veterinario_id = NEW.veterinario_id
           AND h.dia_semana = v_dia AND h.vigencia @> v_fecha
           AND h.hora_inicio <= v_inicio AND h.hora_fin >= v_fin
    ) THEN
        RAISE EXCEPTION 'La cita está fuera del horario configurado del veterinario'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

-- 3a. No se bloquea un intervalo que tiene citas vigentes -----------------------------------
CREATE FUNCTION fn_bloqueo_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_citas integer;
BEGIN
    IF NEW.fin <= NEW.inicio THEN
        RAISE EXCEPTION 'El fin del bloqueo debe ser posterior al inicio' USING ERRCODE = '23514';
    END IF;
    IF NEW.fin <= now() THEN
        RAISE EXCEPTION 'No se puede bloquear un intervalo que ya terminó' USING ERRCODE = '23514';
    END IF;
    PERFORM fn_candado_agenda(NEW.veterinario_id);
    SELECT count(*) INTO v_citas FROM cita c
     WHERE c.veterinario_id = NEW.veterinario_id
       AND c.estado IN ('PENDIENTE', 'AGENDADA')
       AND tstzrange(c.inicio, c.fin) && tstzrange(NEW.inicio, NEW.fin);
    IF v_citas > 0 THEN
        RAISE EXCEPTION 'Hay % cita(s) vigente(s) en ese intervalo: reprográmalas o cancélalas antes de bloquearlo', v_citas
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_bloqueo_validar
    BEFORE INSERT OR UPDATE OF inicio, fin ON bloqueo_agenda
    FOR EACH ROW EXECUTE FUNCTION fn_bloqueo_validar();

-- 3b. No se recorta el horario por debajo de las citas vigentes -----------------------------
-- Se evalúa al confirmar la transacción (DEFERRABLE INITIALLY DEFERRED): así el horario puede
-- reemplazarse completo (borrar todo y volver a insertar) y solo importa cómo queda al final.
CREATE FUNCTION fn_horario_cubre_citas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_vet      uuid;
    v_sin_cubrir integer;
    v_primera  timestamptz;
BEGIN
    FOREACH v_vet IN ARRAY ARRAY[NEW.veterinario_id, OLD.veterinario_id] LOOP
        CONTINUE WHEN v_vet IS NULL;
        PERFORM fn_candado_agenda(v_vet);
        SELECT count(*), min(c.inicio) INTO v_sin_cubrir, v_primera
          FROM cita c
         WHERE c.veterinario_id = v_vet
           AND c.estado IN ('PENDIENTE', 'AGENDADA')
           AND c.inicio > now()
           AND NOT EXISTS (
               SELECT 1 FROM horario h
                WHERE h.aliado_id = c.aliado_id AND h.veterinario_id = c.veterinario_id
                  AND h.dia_semana = extract(isodow FROM c.inicio)::smallint
                  AND h.vigencia @> c.inicio::date
                  AND h.hora_inicio <= c.inicio::time AND h.hora_fin >= c.fin::time);
        IF v_sin_cubrir > 0 THEN
            RAISE EXCEPTION 'El horario deja % cita(s) vigente(s) fuera de la atención (la primera: %): reprográmalas o cancélalas antes',
                v_sin_cubrir, to_char(v_primera, 'YYYY-MM-DD HH24:MI') USING ERRCODE = '23514';
        END IF;
    END LOOP;
    RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_horario_cubre_citas
    AFTER INSERT OR UPDATE OR DELETE ON horario
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_horario_cubre_citas();
