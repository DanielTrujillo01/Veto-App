SET search_path TO veto, public;

CREATE TABLE recuperacion_contrasena (
    usuario_id   uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
    codigo_hash  text,
    token_hash   text,
    expira_en    timestamptz NOT NULL,
    intentos     smallint NOT NULL DEFAULT 0 CHECK (intentos BETWEEN 0 AND 5),
    creado_en    timestamptz NOT NULL DEFAULT now(),
    CHECK (codigo_hash IS NOT NULL OR token_hash IS NOT NULL)
);

CREATE INDEX recuperacion_contrasena_expira_idx ON recuperacion_contrasena (expira_en);
