SET search_path TO veto, public;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS totp_secreto text,
  ADD COLUMN IF NOT EXISTS totp_activado_en timestamptz;

CREATE TABLE IF NOT EXISTS desafio_2fa (
    token_hash  text PRIMARY KEY,
    usuario_id  uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    expira_en   timestamptz NOT NULL,
    creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS desafio_2fa_expira_idx ON desafio_2fa (expira_en);