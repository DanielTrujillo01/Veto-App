import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Fundacion, FundacionPropia, PerfilUsuario, RegistroFundacion } from '@veto/shared';
import { esErrorPg, PG } from '../../common/validacion';
import { DatabaseService } from '../../database/database.service';
import { IdentidadService } from '../identidad/identidad.service';
import { hashContrasena } from '../identidad/seguridad';

type FilaFundacion = {
  id: string;
  nombre: string;
  ciudad: string;
  contacto: string;
  descripcion: string;
  ubicacion: string;
  anio_fundacion: number;
  logo_url: string | null;
  estado: Fundacion['estado'];
  creado_en: Date | string;
};

const COLUMNAS = `a.id, a.nombre, a.ciudad, a.contacto, a.descripcion, a.ubicacion,
                  a.anio_fundacion, a.logo_url, a.estado, a.creado_en`;

function aFundacion(fila: FilaFundacion): Fundacion {
  return {
    id: fila.id,
    tipo: 'FUNDACION',
    nombre: fila.nombre,
    ciudad: fila.ciudad,
    contacto: fila.contacto,
    descripcion: fila.descripcion,
    ubicacion: fila.ubicacion,
    anioFundacion: fila.anio_fundacion,
    logoUrl: fila.logo_url,
    estado: fila.estado,
    creadoEn: new Date(fila.creado_en).toISOString(),
  };
}

/** HU-078: una fundación se registra como aliado de tipo FUNDACION y consulta lo que guardó. */
@Injectable()
export class RegistroFundacionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly identidad: IdentidadService,
  ) {}

  /**
   * Crea la cuenta y la fundación en una sola transacción: si algo falla no queda una cuenta
   * sin fundación. La fundación nace PENDIENTE; el Equipo Veto la aprueba en HU-079.
   */
  async registrar(
    datos: RegistroFundacion,
  ): Promise<{ usuario: PerfilUsuario; fundacion: Fundacion }> {
    const passwordHash = await hashContrasena(datos.contrasena);
    try {
      return await this.database.withUser(null, async (client) => {
        const usuario = await this.identidad.insertUser(
          client,
          {
            nombre: datos.representante ?? datos.nombre,
            celular: datos.celular,
            correo: datos.correo,
          },
          passwordHash,
          'ALIADO',
        );
        const r = await client.query<FilaFundacion>(
          `INSERT INTO aliado (usuario_id, tipo, nombre, ciudad, contacto, descripcion,
                               ubicacion, anio_fundacion, logo_url)
           VALUES ($1, 'FUNDACION', $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, nombre, ciudad, contacto, descripcion, ubicacion, anio_fundacion,
                     logo_url, estado, creado_en`,
          [
            usuario.id,
            datos.nombre,
            datos.ciudad,
            datos.contacto,
            datos.descripcion,
            datos.ubicacion,
            datos.anioFundacion,
            datos.logoUrl ?? null,
          ],
        );
        return { usuario, fundacion: aFundacion(r.rows[0]) };
      });
    } catch (error) {
      if (esErrorPg(error, PG.UNICO)) {
        throw new ConflictException('Ya existe una cuenta con ese correo');
      }
      if (esErrorPg(error, PG.CHECK)) {
        // La base protege lo mismo que el formulario: se responde como un dato inválido.
        throw new BadRequestException({
          message: 'Revisa los datos ingresados',
          errores: { _: (error as Error).message },
        });
      }
      throw error;
    }
  }

  /** La fundación consulta los datos que guardó, sea cual sea su estado de aprobación. */
  async consultarPropia(usuarioId: string): Promise<FundacionPropia> {
    return this.database.withUser(usuarioId, async (client) => {
      const r = await client.query<
        FilaFundacion & { representante: string; correo: string; celular: string }
      >(
        `SELECT ${COLUMNAS}, u.nombre AS representante, u.correo, u.celular
           FROM aliado a JOIN usuario u ON u.id = a.usuario_id
          WHERE a.usuario_id = $1 AND a.tipo = 'FUNDACION'`,
        [usuarioId],
      );
      const fila = r.rows[0];
      if (!fila) throw new NotFoundException('No tienes una solicitud de fundación');
      return {
        ...aFundacion(fila),
        representante: fila.representante,
        correo: fila.correo,
        celular: fila.celular,
      };
    });
  }
}
