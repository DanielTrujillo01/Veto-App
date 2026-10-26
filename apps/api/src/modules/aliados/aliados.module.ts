import { Module } from '@nestjs/common';

/**
 * Módulo aliados: Clínicas, veterinarios independientes, tiendas y fundaciones; veterinarios y sedes.
 *
 * Tablas propias: aliado, veterinario, sede, aliado_especie
 * Historias:      HU-007, 012–016, 021, 078
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({})
export class AliadosModule {}
