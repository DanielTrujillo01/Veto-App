SET search_path TO veto, public;

-- Documento de identidad del tutor (registro y perfil). Es opcional en la tabla porque las cuentas
-- existentes, las creadas con Google (HU-003) y las de aliados y veterinarios no lo tienen; el
-- registro de tutores con contraseña lo exige desde la aplicación.
ALTER TABLE usuario
    ADD COLUMN tipo_documento   text CHECK (tipo_documento IN ('CC', 'CE', 'TI', 'PA', 'PPT')),
    ADD COLUMN numero_documento text CHECK (numero_documento ~ '^[A-Z0-9]{5,15}$'),
    -- Tipo y número van siempre juntos.
    ADD CONSTRAINT usuario_documento_completo
        CHECK ((tipo_documento IS NULL) = (numero_documento IS NULL));

-- Un mismo documento no puede pertenecer a dos cuentas.
CREATE UNIQUE INDEX usuario_documento_unico
    ON usuario (tipo_documento, numero_documento)
    WHERE numero_documento IS NOT NULL;
