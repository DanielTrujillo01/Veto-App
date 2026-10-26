import { Module } from '@nestjs/common';

/**
 * Módulo servicios: Servicios, precios, horarios y búsqueda/descubrimiento.
 *
 * Tablas propias: servicio, servicio_regla_precio, horario, tipo_servicio
 * Historias:      HU-018–022, 024–028
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({})
export class ServiciosModule {}
