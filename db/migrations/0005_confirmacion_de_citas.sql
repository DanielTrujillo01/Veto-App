SET search_path TO veto, public;

-- HU-023 (parte 2 de 2): el aliado Vet elige si sus citas se confirman solas o si él las acepta.
--
--   AUTOMATICA → una reserva válida nace AGENDADA (confirmada).   [valor por defecto]
--   MANUAL     → una reserva válida nace PENDIENTE hasta que el aliado la acepta (AGENDADA)
--                o la rechaza (CANCELADA). El tutor puede cancelarla mientras espera.
--
-- El estado inicial lo decide la base de datos con la configuración vigente, no quien reserva:
-- así el estado que ve el tutor siempre coincide con la configuración del aliado.

CREATE TYPE modo_confirmacion AS ENUM ('AUTOMATICA', 'MANUAL');

ALTER TABLE aliado
    ADD COLUMN modo_confirmacion modo_confirmacion NOT NULL DEFAULT 'AUTOMATICA';

-- Una cita PENDIENTE también ocupa el espacio: sin esto, dos tutores podrían pedir la misma hora
-- mientras el aliado decide, o un doble clic generaría dos solicitudes.
ALTER TABLE cita DROP CONSTRAINT cita_sin_solapamiento;
ALTER TABLE cita ADD CONSTRAINT cita_sin_solapamiento EXCLUDE USING gist
    (veterinario_id WITH =, tstzrange(inicio, fin) WITH &&)
    WHERE (veterinario_id IS NOT NULL AND estado IN ('PENDIENTE', 'AGENDADA'));

DROP INDEX cita_sin_duplicado;
CREATE UNIQUE INDEX cita_sin_duplicado ON cita (tutor_id, mascota_id, servicio_id, inicio)
    WHERE estado IN ('PENDIENTE', 'AGENDADA');

-- Validación de la cita (reemplaza a la de 0001): estado inicial según la configuración y
-- transiciones de la cita pendiente.
CREATE OR REPLACE FUNCTION fn_cita_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_ok        boolean;
    v_modo      modo_confirmacion;
    v_usuario   uuid := nullif(current_setting('app.usuario_id', true), '')::uuid;
    v_es_aliado boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.estado NOT IN ('AGENDADA', 'PENDIENTE') THEN
            RAISE EXCEPTION 'Una cita nueva inicia como AGENDADA o PENDIENTE' USING ERRCODE = '23514';
        END IF;
        IF NEW.inicio <= now() THEN
            RAISE EXCEPTION 'No se pueden agendar citas en el pasado' USING ERRCODE = '23514';
        END IF;
        SELECT s.activo AND s.moderacion = 'PUBLICADO' AND a.estado = 'ACTIVO' INTO v_ok
          FROM servicio s JOIN aliado a ON a.id = s.aliado_id WHERE s.id = NEW.servicio_id;
        IF NOT COALESCE(v_ok, false) THEN
            RAISE EXCEPTION 'El servicio no está disponible para reservas' USING ERRCODE = '23514';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM mascota m JOIN aliado_especie ae ON ae.especie_id = m.especie_id
                        WHERE m.id = NEW.mascota_id AND ae.aliado_id = NEW.aliado_id) THEN
            RAISE EXCEPTION 'El aliado no atiende la especie de esta mascota' USING ERRCODE = '23514';
        END IF;
        -- HU-023: el estado inicial lo fija la configuración del aliado, se pida lo que se pida.
        SELECT modo_confirmacion INTO v_modo FROM aliado WHERE id = NEW.aliado_id;
        IF v_modo = 'MANUAL' THEN
            NEW.estado := 'PENDIENTE'::estado_cita;
        ELSE
            NEW.estado := 'AGENDADA'::estado_cita;
        END IF;
        RETURN NEW;
    END IF;

    IF OLD.estado NOT IN ('AGENDADA', 'PENDIENTE')
       AND (NEW.estado <> OLD.estado OR NEW.inicio <> OLD.inicio OR NEW.fin <> OLD.fin) THEN
        RAISE EXCEPTION 'La cita está en estado final (%) y no admite cambios', OLD.estado USING ERRCODE = '55000';
    END IF;

    v_es_aliado := v_usuario IS NOT NULL AND (
           EXISTS (SELECT 1 FROM aliado WHERE id = NEW.aliado_id AND usuario_id = v_usuario)
        OR EXISTS (SELECT 1 FROM veterinario WHERE aliado_id = NEW.aliado_id AND usuario_id = v_usuario AND activo));

    -- HU-023: aceptar o rechazar una cita pendiente
    IF NEW.estado = 'PENDIENTE' AND OLD.estado <> 'PENDIENTE' THEN
        RAISE EXCEPTION 'Una cita no vuelve a estar pendiente' USING ERRCODE = '23514';
    END IF;
    IF OLD.estado = 'PENDIENTE' AND NEW.estado IN ('FINALIZADA', 'NO_ASISTIO') THEN
        RAISE EXCEPTION 'La cita debe aceptarse antes de marcarla como %', NEW.estado USING ERRCODE = '23514';
    END IF;
    IF OLD.estado = 'PENDIENTE' AND NEW.estado = 'AGENDADA' THEN
        IF NOT v_es_aliado THEN
            RAISE EXCEPTION 'Solo el aliado puede aceptar la cita' USING ERRCODE = '42501';
        END IF;
        IF OLD.inicio <= now() THEN
            RAISE EXCEPTION 'La cita ya pasó y no se puede aceptar' USING ERRCODE = '23514';
        END IF;
    END IF;

    IF NEW.estado IN ('FINALIZADA', 'NO_ASISTIO') AND OLD.estado = 'AGENDADA' AND NOT v_es_aliado THEN
        RAISE EXCEPTION 'Solo el aliado puede marcar la cita como %', NEW.estado USING ERRCODE = '42501';
    END IF;

    -- Reprogramación: se conserva la fecha anterior en el historial (HU-034)
    IF NEW.inicio <> OLD.inicio THEN
        IF NEW.inicio <= now() THEN
            RAISE EXCEPTION 'No se puede reprogramar al pasado' USING ERRCODE = '23514';
        END IF;
        INSERT INTO historial_estado (entidad, entidad_id, estado_anterior, estado_nuevo, cambiado_por, motivo)
        VALUES ('cita', NEW.id, OLD.estado::text, NEW.estado::text, v_usuario,
                'Reprogramada: ' || OLD.inicio || ' -> ' || NEW.inicio);
    END IF;
    RETURN NEW;
END $$;

-- Una consulta clínica solo se registra sobre una cita aceptada.
CREATE OR REPLACE FUNCTION fn_consulta_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cita c JOIN veterinario v ON v.aliado_id = c.aliado_id
                    WHERE c.id = NEW.cita_id AND v.id = NEW.veterinario_id) THEN
        RAISE EXCEPTION 'El veterinario responsable debe pertenecer al aliado de la cita' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM cita WHERE id = NEW.cita_id AND estado = 'PENDIENTE') THEN
        RAISE EXCEPTION 'La cita está pendiente de aceptación' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
