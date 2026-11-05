SET search_path TO veto, public;

-- HU-023 (parte 1 de 2): estado «pendiente de aceptación» de la cita.
-- Una cita AGENDADA es una cita confirmada. PENDIENTE es la que espera la aceptación del aliado.
--
-- Va en un archivo aparte porque PostgreSQL no deja usar un valor de ENUM en la misma transacción
-- en que se agrega; la migración 0005 ya puede usarlo.
ALTER TYPE estado_cita ADD VALUE IF NOT EXISTS 'PENDIENTE' BEFORE 'AGENDADA';
