import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import type {
  FiltrarServicios,
  GuardarReglasPrecio,
  GuardarServicio,
  ReglaPrecio,
  Servicio,
  TipoAliado,
} from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { esErrorPg, PG } from '../../common/validacion';
import { AliadoEspeciesService } from '../aliados/aliado-especies.service';
import { AliadosService } from '../aliados/aliados.service';
import { CitasService } from '../citas/citas.service';
import { MascotasService } from '../mascotas/mascotas.service';
import { ServiciosRepository } from './servicios.repository';

/** Solo clínicas y veterinarios independientes ofrecen servicios (la BD también lo exige). */
const TIPOS_CON_SERVICIOS: TipoAliado[] = ['CLINICA', 'VET_INDEPENDIENTE'];
const NO_ENCONTRADO = 'El servicio no existe o no pertenece a este aliado';

function errorDeCampo(campo: string, mensaje: string) {
  return new BadRequestException({
    message: 'Revisa los datos ingresados',
    errores: { [campo]: mensaje },
  });
}

@Injectable()
export class ServiciosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: ServiciosRepository,
    private readonly aliados: AliadosService,
    private readonly especies: AliadoEspeciesService,
    private readonly citas: CitasService,
    private readonly mascotas: MascotasService,
  ) {}

  /** HU-018: crea un servicio del aliado administrado por el usuario. */
  async crear(usuarioId: string, aliadoId: string, datos: GuardarServicio): Promise<Servicio> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_SERVICIOS);
      await this.validarSede(client, aliadoId, datos);
      const id = await this.traducirErrores(() => this.repo.insertar(client, aliadoId, datos));
      return (await this.repo.buscar(client, id, aliadoId)) as Servicio;
    });
  }

  /**
   * HU-018: edita un servicio. Las citas guardan su propio precio y horario, así que editar no
   * las altera; pero si ya tiene citas no se permite cambiar el tipo ni la modalidad, porque
   * cambiaría lo que se prestó en esas citas (se debe crear un servicio nuevo).
   */
  async actualizar(
    usuarioId: string,
    aliadoId: string,
    servicioId: string,
    datos: GuardarServicio,
  ): Promise<Servicio> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_SERVICIOS);
      const actual = await this.repo.buscar(client, servicioId, aliadoId, true);
      if (!actual) throw new NotFoundException(NO_ENCONTRADO);
      await this.validarSede(client, aliadoId, datos);

      const cambiaNaturaleza =
        actual.tipoServicioId !== datos.tipoServicioId || actual.modalidad !== datos.modalidad;
      if (cambiaNaturaleza && (await this.citas.servicioTieneCitas(client, servicioId))) {
        throw new ConflictException(
          'El servicio ya tiene citas: no se puede cambiar su tipo ni su modalidad. ' +
            'Desactívalo y crea un servicio nuevo.',
        );
      }
      await this.traducirErrores(() => this.repo.actualizar(client, servicioId, aliadoId, datos));
      return (await this.repo.buscar(client, servicioId, aliadoId)) as Servicio;
    });
  }

  /**
   * HU-018: desactiva o reactiva un servicio (nunca se borra). Un servicio inactivo deja de
   * listarse como disponible y la BD rechaza nuevas reservas; las citas existentes no cambian.
   */
  async cambiarActivo(
    usuarioId: string,
    aliadoId: string,
    servicioId: string,
    activo: boolean,
  ): Promise<Servicio> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_SERVICIOS);
      if (!(await this.repo.buscar(client, servicioId, aliadoId, true))) {
        throw new NotFoundException(NO_ENCONTRADO);
      }
      await this.repo.cambiarActivo(client, servicioId, aliadoId, activo);
      return (await this.repo.buscar(client, servicioId, aliadoId)) as Servicio;
    });
  }

  /** Gestión: todos los servicios del aliado, activos e inactivos. */
  async listarGestion(usuarioId: string, aliadoId: string): Promise<Servicio[]> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_SERVICIOS);
      return this.repo.listar(client, aliadoId, false);
    });
  }

  /** Detalle de un servicio para el aliado que lo administra. */
  async obtenerGestion(usuarioId: string, aliadoId: string, servicioId: string): Promise<Servicio> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_SERVICIOS);
      const servicio = await this.repo.buscar(client, servicioId, aliadoId);
      if (!servicio) throw new NotFoundException(NO_ENCONTRADO);
      return servicio;
    });
  }

  /** HU-020: consulta las reglas configuradas por el aliado propietario del servicio. */
  async listarReglasPrecio(
    usuarioId: string,
    aliadoId: string,
    servicioId: string,
  ): Promise<ReglaPrecio[]> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_SERVICIOS);
      if (!(await this.repo.buscar(client, servicioId, aliadoId))) {
        throw new NotFoundException(NO_ENCONTRADO);
      }
      return this.repo.listarReglasPrecio(client, servicioId);
    });
  }

  /**
   * HU-020: reemplaza toda la configuración en una transacción. Si una regla es inválida en
   * PostgreSQL, se revierte también el borrado inicial y se conserva la configuración anterior.
   */
  async guardarReglasPrecio(
    usuarioId: string,
    aliadoId: string,
    servicioId: string,
    datos: GuardarReglasPrecio,
  ): Promise<ReglaPrecio[]> {
    try {
      return await this.db.withUser(usuarioId, async (client) => {
        await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_SERVICIOS);
        if (!(await this.repo.buscar(client, servicioId, aliadoId, true))) {
          throw new NotFoundException(NO_ENCONTRADO);
        }
        await this.repo.reemplazarReglasPrecio(client, servicioId, datos);
        return this.repo.listarReglasPrecio(client, servicioId);
      });
    } catch (error) {
      if (esErrorPg(error, PG.LLAVE_FORANEA)) {
        throw errorDeCampo('especieId', 'La especie no existe');
      }
      throw error;
    }
  }

  /** HU-020: cotiza un servicio disponible usando únicamente los datos de una mascota propia. */
  async cotizarParaMascota(
    tutorId: string,
    servicioId: string,
    mascotaId: string,
  ): Promise<{ servicioId: string; mascotaId: string; precioBase: number; precio: number }> {
    const servicio = await this.obtenerDisponible(servicioId);
    await this.mascotas.obtener(tutorId, mascotaId);
    const precio = await this.repo.precioParaMascota(this.db, servicioId, mascotaId);
    return { servicioId, mascotaId, precioBase: servicio.precioBase, precio };
  }

  /**
   * Público: solo los servicios disponibles para nuevas reservas de un aliado activo.
   * HU-021: con `especieId`, solo cuenta si el aliado atiende esa especie; si no, no hay
   * servicios compatibles (lista vacía, no error).
   */
  async listarDisponibles(aliadoId: string, filtros: FiltrarServicios = {}): Promise<Servicio[]> {
    if (!(await this.aliados.estaActivo(this.db, aliadoId))) {
      throw new NotFoundException('El aliado no existe');
    }
    if (
      filtros.especieId !== undefined &&
      !(await this.especies.atiendeEspecie(this.db, aliadoId, filtros.especieId))
    ) {
      return [];
    }
    return this.repo.listar(this.db, aliadoId, true);
  }

  /** Detalle público de un servicio disponible. */
  async obtenerDisponible(servicioId: string): Promise<Servicio> {
    const servicio = await this.repo.buscarDisponible(this.db, servicioId);
    if (!servicio) throw new NotFoundException('No se encontró un servicio disponible.');
    return servicio;
  }

  listarTipos() {
    return this.repo.listarTipos(this.db);
  }

  private async validarSede(client: PoolClient, aliadoId: string, datos: GuardarServicio) {
    if (datos.sedeId && !(await this.aliados.sedeActivaDelAliado(client, datos.sedeId, aliadoId))) {
      throw errorDeCampo('sedeId', 'La sede no existe, no está activa o es de otro aliado');
    }
  }

  private async traducirErrores<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (esErrorPg(error, PG.LLAVE_FORANEA)) {
        throw errorDeCampo('tipoServicioId', 'El tipo de servicio no existe');
      }
      throw error;
    }
  }
}
