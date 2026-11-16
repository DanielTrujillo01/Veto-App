import { Injectable } from '@nestjs/common';
import {
  BUSQUEDA_MAX_RESULTADOS_POR_CATEGORIA,
  type CategoriaBusqueda,
  type RespuestaBusquedaGeneral,
} from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import type { QueryResultRow } from 'pg';

interface FilaResultado extends QueryResultRow {
  categoria: CategoriaBusqueda;
  id: string;
  nombre: string;
}

const LIMITE = BUSQUEDA_MAX_RESULTADOS_POR_CATEGORIA;

const normalizar = (columna: string) =>
  `lower(public.unaccent(regexp_replace(btrim(${columna}), '[[:space:]]+', ' ', 'g'))) `;

const BUSQUEDA = `
  WITH coincidencias AS (
    SELECT 'CLINICA'::text AS categoria, a.id, a.nombre
      FROM aliado a
     WHERE a.estado = 'ACTIVO' AND a.tipo = 'CLINICA'
       AND strpos(${normalizar('a.nombre')}, ${normalizar('$1::text')}) > 0
    UNION ALL
    SELECT 'VET_INDEPENDIENTE'::text, a.id, a.nombre
      FROM aliado a
     WHERE a.estado = 'ACTIVO' AND a.tipo = 'VET_INDEPENDIENTE'
       AND strpos(${normalizar('a.nombre')}, ${normalizar('$1::text')}) > 0
    UNION ALL
    SELECT 'TIENDA'::text, a.id, a.nombre
      FROM aliado a
     WHERE a.estado = 'ACTIVO' AND a.tipo = 'TIENDA'
       AND strpos(${normalizar('a.nombre')}, ${normalizar('$1::text')}) > 0
    UNION ALL
    SELECT 'VETERINARIO'::text, v.id, u.nombre
      FROM veterinario v
      JOIN usuario u ON u.id = v.usuario_id
      JOIN aliado a ON a.id = v.aliado_id
     WHERE v.activo AND u.estado = 'ACTIVA' AND a.estado = 'ACTIVO'
       AND a.tipo IN ('CLINICA', 'VET_INDEPENDIENTE')
       AND strpos(${normalizar('u.nombre')}, ${normalizar('$1::text')}) > 0
    UNION ALL
    SELECT 'PRODUCTO'::text, p.id, p.nombre
      FROM producto p
      JOIN aliado a ON a.id = p.aliado_id
     WHERE p.activo AND p.moderacion = 'PUBLICADO'
       AND a.estado = 'ACTIVO' AND a.tipo = 'TIENDA'
       AND strpos(${normalizar('p.nombre')}, ${normalizar('$1::text')}) > 0
    UNION ALL
    SELECT 'SERVICIO'::text, s.id, s.nombre
      FROM servicio s
      JOIN aliado a ON a.id = s.aliado_id
     WHERE s.activo AND s.moderacion = 'PUBLICADO'
       AND a.estado = 'ACTIVO' AND a.tipo IN ('CLINICA', 'VET_INDEPENDIENTE')
       AND (s.modalidad <> 'EN_SEDE' OR EXISTS (
         SELECT 1 FROM sede se
          WHERE se.id = s.sede_id AND se.aliado_id = s.aliado_id AND se.activa
       ))
       AND strpos(${normalizar('s.nombre')}, ${normalizar('$1::text')}) > 0
  ),
  numeradas AS (
    SELECT categoria, id, nombre,
           row_number() OVER (PARTITION BY categoria ORDER BY nombre COLLATE "C", id) AS posicion
      FROM coincidencias
  )
  SELECT categoria, id, nombre
    FROM numeradas
   WHERE posicion <= $2
   ORDER BY categoria COLLATE "C", nombre COLLATE "C", id`;

@Injectable()
export class BusquedaRepository {
  constructor(private readonly database: DatabaseService) {}

  async buscarPorNombre(nombre: string): Promise<RespuestaBusquedaGeneral> {
    const resultado = await this.database.query<FilaResultado>(BUSQUEDA, [nombre, LIMITE]);
    const grupos = new Map<CategoriaBusqueda, { id: string; nombre: string }[]>();
    for (const fila of resultado.rows) {
      const elementos = grupos.get(fila.categoria) ?? [];
      elementos.push({ id: fila.id, nombre: fila.nombre });
      grupos.set(fila.categoria, elementos);
    }
    return {
      resultadosPorCategoria: [...grupos].map(([categoria, resultados]) => ({
        categoria,
        resultados,
      })),
    };
  }
}
