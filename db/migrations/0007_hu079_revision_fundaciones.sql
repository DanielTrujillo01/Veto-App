-- HU-079: distinguir las fundaciones rechazadas y auditar cada decisión del Equipo Veto.
ALTER TYPE estado_aliado ADD VALUE IF NOT EXISTS 'RECHAZADO';
ALTER TYPE tipo_accion_admin ADD VALUE IF NOT EXISTS 'APROBAR_FUNDACION';
ALTER TYPE tipo_accion_admin ADD VALUE IF NOT EXISTS 'RECHAZAR_FUNDACION';
