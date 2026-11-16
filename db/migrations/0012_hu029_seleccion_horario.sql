SET search_path TO veto, public;

-- HU-029: fecha y hora que el tutor eligió en el calendario del aliado.
--
-- Se guarda para que la elección se conserve mientras la persona avanza en el flujo de reserva
-- (motivo, confirmación) o recarga la página, y para que el paso que crea la cita (HU-031) parta
-- de lo que el calendario ofreció. Es un borrador por tutor: elegir otro horario reemplaza el
-- anterior. NO reserva el espacio: quien lo ocupa de verdad es el INSERT de la cita, que
-- sigue validando horario, bloqueos y solapamientos (0001, 0007), así que dos tutores pueden
-- tener elegido el mismo espacio y solo uno logra reservarlo.
CREATE TABLE seleccion_horario (
    tutor_id        uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
    aliado_id       uuid NOT NULL,
    servicio_id     uuid NOT NULL,
    veterinario_id  uuid NOT NULL,
    inicio          timestamptz NOT NULL,
    fin             timestamptz NOT NULL,
    actualizado_en  timestamptz NOT NULL DEFAULT now(),
    expira_en       timestamptz NOT NULL,
    -- Si el servicio o el veterinario se borran, la elección deja de tener sentido
    FOREIGN KEY (servicio_id, aliado_id)    REFERENCES servicio(id, aliado_id)    ON DELETE CASCADE,
    FOREIGN KEY (veterinario_id, aliado_id) REFERENCES veterinario(id, aliado_id) ON DELETE CASCADE,
    CHECK (fin > inicio),
    CHECK (expira_en > actualizado_en)
);
CREATE INDEX seleccion_horario_expira_idx ON seleccion_horario (expira_en);
