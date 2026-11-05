import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { EspecieAtendida, GuardarEspecies, TipoAliado } from '@veto/shared';
import { DatabaseService, type Consultor } from '../../database/database.service';
import { esErrorPg, PG } from '../../common/validacion';
import { MascotasService } from '../mascotas/mascotas.service';
import { AliadosService } from './aliados.service';

/** Aliados Vet: las clínicas y los veterinarios independientes (los que atienden animales). */
const TIPOS_QUE_ATIENDEN: TipoAliado[] = ['CLINICA', 'VET_INDEPENDIENTE'];

/** HU-021: especies que atiende cada aliado Vet (tabla aliado_especie). */
@Injectable()
export class AliadoEspeciesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly aliados: AliadosService,
    private readonly mascotas: MascotasService,
  ) {}

  /** Público (ficha del aliado): especies de un aliado activo, por orden alfabético. */
  async listarPublicas(aliadoId: string): Promise<EspecieAtendida[]> {
    if (!(await this.aliados.estaActivo(this.db, aliadoId))) {
      throw new NotFoundException('El aliado no existe');
    }
    return this.especiesDe(this.db, aliadoId);
  }

  /**
   * Guarda la selección completa de especies del aliado: agrega las nuevas y quita las que ya
   * no atiende, en una sola transacción. Solo el administrador de un aliado Vet activo.
   *
   * Quitar una especie no toca las citas ya agendadas (igual que desactivar un servicio): solo
   * impide nuevas reservas para esa especie.
   */
  async guardar(
    usuarioId: string,
    aliadoId: string,
    datos: GuardarEspecies,
  ): Promise<EspecieAtendida[]> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_QUE_ATIENDEN);
      try {
        await client.query(
          'DELETE FROM aliado_especie WHERE aliado_id = $1 AND NOT (especie_id = ANY($2::smallint[]))',
          [aliadoId, datos.especieIds],
        );
        await client.query(
          `INSERT INTO aliado_especie (aliado_id, especie_id)
           SELECT $1, unnest($2::smallint[])
           ON CONFLICT DO NOTHING`,
          [aliadoId, datos.especieIds],
        );
      } catch (error) {
        if (esErrorPg(error, PG.LLAVE_FORANEA)) {
          throw new BadRequestException({
            message: 'Revisa los datos ingresados',
            errores: { especieIds: 'Alguna de las especies no existe' },
          });
        }
        throw error;
      }
      return this.especiesDe(client, aliadoId);
    });
  }

  /**
   * Regla de compatibilidad para búsquedas y filtros (HU-025, 026): ¿el aliado atiende esta
   * especie? Un aliado sin especies configuradas no es compatible con ninguna. La base de datos
   * aplica la misma regla al reservar (una cita exige que el aliado atienda la especie).
   */
  async atiendeEspecie(db: Consultor, aliadoId: string, especieId: number): Promise<boolean> {
    const r = await db.query<{ ok: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM aliado_especie WHERE aliado_id = $1 AND especie_id = $2) AS ok',
      [aliadoId, especieId],
    );
    return Boolean(r.rows[0]?.ok);
  }

  /** Los ids salen de aliado_especie (tabla propia); los nombres, del catálogo del módulo mascotas. */
  private async especiesDe(db: Consultor, aliadoId: string): Promise<EspecieAtendida[]> {
    const ids = await db.query<{ especie_id: number }>(
      'SELECT especie_id FROM aliado_especie WHERE aliado_id = $1',
      [aliadoId],
    );
    const atendidas = new Set(ids.rows.map((fila) => fila.especie_id));
    const catalogo = await this.mascotas.listarEspecies();
    return catalogo
      .filter((especie) => atendidas.has(especie.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
}
