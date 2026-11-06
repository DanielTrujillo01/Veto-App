SET search_path TO veto, public;

-- HU-003: inicio de sesión con Google (OAuth 2.0 / OpenID Connect, flujo de código con PKCE).
--
-- Una cuenta de Google (su identificador estable `sub`, no el correo) se vincula a una sola
-- cuenta de Veto, y una cuenta de Veto tiene como máximo una cuenta de Google. Así no se
-- crean usuarios duplicados ni dos personas comparten una cuenta.

CREATE TABLE cuenta_google (
    google_sub    text PRIMARY KEY CHECK (length(google_sub) BETWEEN 1 AND 255),
    usuario_id    uuid NOT NULL UNIQUE REFERENCES usuario(id) ON DELETE CASCADE,
    correo        citext NOT NULL,                 -- el que Google informó al vincular (solo informativo)
    vinculado_en  timestamptz NOT NULL DEFAULT now()
);

-- Estado de cada intento de inicio de sesión: se crea al salir hacia Google y se consume una
-- sola vez al volver (state anti-CSRF, nonce anti-repetición y verificador PKCE).
CREATE TABLE google_estado_oauth (
    state_hash     text PRIMARY KEY,               -- hash del state; el valor va en una cookie del navegador
    nonce          text NOT NULL,
    code_verifier  text NOT NULL,
    usuario_id     uuid REFERENCES usuario(id) ON DELETE CASCADE,   -- solo en una reautenticación
    expira_en      timestamptz NOT NULL,
    creado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX google_estado_oauth_expira_idx ON google_estado_oauth (expira_en);

-- Quien entra solo con Google no tiene contraseña con la que confirmar acciones delicadas
-- (eliminar la cuenta). Vuelve a pasar por Google y, si es la misma cuenta, recibe esta
-- constancia de pocos minutos y de un solo uso.
CREATE TABLE google_reautenticacion (
    token_hash  text PRIMARY KEY,
    usuario_id  uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    expira_en   timestamptz NOT NULL,
    creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX google_reautenticacion_usuario_idx ON google_reautenticacion (usuario_id);

-- Google autenticó a la persona, pero falta un paso antes de abrir sesión:
--   VINCULAR  el correo ya tiene cuenta en Veto: debe demostrar que es suya con su contraseña.
--   REGISTRO  no hay cuenta: debe completar los datos que Google no entrega (el celular).
CREATE TABLE google_pendiente (
    token_hash  text PRIMARY KEY,
    tipo        text NOT NULL CHECK (tipo IN ('VINCULAR', 'REGISTRO')),
    google_sub  text NOT NULL,
    correo      citext NOT NULL,
    nombre      text NOT NULL,
    usuario_id  uuid REFERENCES usuario(id) ON DELETE CASCADE,
    intentos    smallint NOT NULL DEFAULT 0,
    expira_en   timestamptz NOT NULL,
    creado_en   timestamptz NOT NULL DEFAULT now(),
    CHECK ((tipo = 'VINCULAR') = (usuario_id IS NOT NULL))
);
CREATE INDEX google_pendiente_expira_idx ON google_pendiente (expira_en);

-- Al eliminar la cuenta (baja lógica, HU-006) se suelta la cuenta de Google: ya no puede
-- abrir sesión con ella y puede volver a registrarse como una cuenta nueva.
CREATE FUNCTION fn_cuenta_google_baja() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM cuenta_google WHERE usuario_id = NEW.id;
    DELETE FROM google_pendiente WHERE usuario_id = NEW.id;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_cuenta_google_baja
    AFTER UPDATE OF estado ON usuario
    FOR EACH ROW WHEN (NEW.estado = 'ELIMINADA' AND OLD.estado IS DISTINCT FROM NEW.estado)
    EXECUTE FUNCTION fn_cuenta_google_baja();
