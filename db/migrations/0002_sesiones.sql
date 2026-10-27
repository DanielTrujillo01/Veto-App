SET search_path TO veto, public;

CREATE TABLE sesion (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash  text NOT NULL UNIQUE,
    usuario_id  uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    expira_en   timestamptz NOT NULL,
    creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sesion_usuario_expira_idx ON sesion (usuario_id, expira_en);
