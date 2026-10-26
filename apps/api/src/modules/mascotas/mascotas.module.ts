import { Module } from '@nestjs/common';

/**
 * Módulo mascotas: Mascotas del tutor y su historial.
 *
 * Tablas propias: mascota, mascota_foto, especie
 * Historias:      HU-008–011
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({})
export class MascotasModule {}
