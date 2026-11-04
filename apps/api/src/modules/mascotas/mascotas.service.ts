import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { ActualizarMascota, CrearMascota, Mascota } from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { esErrorPg, PG } from '../../common/validacion';
import { MascotasRepository } from './mascotas.repository';

const NO_ENCONTRADA = 'La mascota no existe o no pertenece a tu cuenta';

@Injectable()
export class MascotasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: MascotasRepository,
  ) {}

  /** HU-008: crea la mascota asociada al tutor autenticado. */
  async crear(tutorId: string, datos: CrearMascota): Promise<Mascota> {
    return this.db.withUser(tutorId, (client) =>
      this.traducirErrores(async () => {
        const id = await this.repo.insertar(client, tutorId, datos);
        await this.repo.reemplazarFotos(client, id, datos.fotos ?? []);
        return (await this.repo.buscarDelTutor(client, id, tutorId)) as Mascota;
      }),
    );
  }

  /**
   * HU-010: reemplaza los campos editables (mismas reglas que la creación). Solo el tutor
   * dueño puede editar; para cualquier otro la mascota "no existe" (404).
   */
  async actualizar(tutorId: string, id: string, datos: ActualizarMascota): Promise<Mascota> {
    return this.db.withUser(tutorId, (client) =>
      this.traducirErrores(async () => {
        if (!(await this.repo.actualizar(client, id, tutorId, datos))) {
          throw new NotFoundException(NO_ENCONTRADA);
        }
        await this.repo.reemplazarFotos(client, id, datos.fotos ?? []);
        return (await this.repo.buscarDelTutor(client, id, tutorId)) as Mascota;
      }),
    );
  }

  listar(tutorId: string): Promise<Mascota[]> {
    return this.repo.listarDelTutor(this.db, tutorId);
  }

  async obtener(tutorId: string, id: string): Promise<Mascota> {
    const mascota = await this.repo.buscarDelTutor(this.db, id, tutorId);
    if (!mascota) throw new NotFoundException(NO_ENCONTRADA);
    return mascota;
  }

  listarEspecies() {
    return this.repo.listarEspecies(this.db);
  }

  /** Para otros módulos (p. ej. reservar una cita): ¿la mascota es de este tutor? */
  async perteneceAlTutor(client: PoolClient, mascotaId: string, tutorId: string) {
    return (await this.repo.buscarDelTutor(client, mascotaId, tutorId)) !== null;
  }

  private async traducirErrores<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (esErrorPg(error, PG.UNICO)) {
        throw new ConflictException('Ya existe una mascota registrada con ese chip');
      }
      if (esErrorPg(error, PG.LLAVE_FORANEA)) {
        throw new BadRequestException({
          message: 'Revisa los datos ingresados',
          errores: { especieId: 'La especie no existe' },
        });
      }
      throw error;
    }
  }
}
