import request from 'supertest';
import { AdminModule } from '../src/modules/admin/admin.module';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { COOKIE, TUTOR, crearApp, crearBdFalsa, type Fila, type UsuarioPrueba } from './utilidades';

const EQUIPO_VETO: UsuarioPrueba = {
  id: 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
  nombre: 'Equipo Veto',
  correo: 'admin@veto.co',
  celular: '3006667788',
  rol: 'EQUIPO_VETO',
};
const ALIADO_FUNDACION: UsuarioPrueba = {
  id: 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5',
  nombre: 'Fundación Huellas',
  correo: 'fundacion@huellas.org',
  celular: '3005556677',
  rol: 'ALIADO',
};
const FUNDACION_ID = '77777777-7777-4777-8777-777777777779';
const RUTA_ADMIN = '/api/admin/fundaciones';

type Estado = 'PENDIENTE' | 'ACTIVO' | 'RECHAZADO';

function filaFundacion(estado: Estado = 'PENDIENTE'): Fila {
  return {
    id: FUNDACION_ID,
    nombre: 'Fundación Huellas',
    descripcion: 'Rescate y cuidado de animales',
    logo_url: 'https://cdn.veto.co/huellas.jpg',
    contacto: 'contacto@huellas.org',
    ciudad: 'Bogotá',
    ubicacion: 'Dirección enviada',
    anio_fundacion: 2015,
    estado,
    creado_en: new Date('2026-01-03T12:00:00Z'),
    representante: 'Representante',
    correo: 'fundacion@huellas.org',
    celular: '3005556677',
  };
}

function baseDeDatos(usuario: UsuarioPrueba = EQUIPO_VETO, estadoInicial: Estado = 'PENDIENTE') {
  let estado: Estado = estadoInicial;
  const auditoria: unknown[][] = [];
  const { db, consultas } = crearBdFalsa((sql, valores) => {
    if (sql.includes('UPDATE aliado') && sql.includes('SET estado = $2')) {
      if (estado !== 'PENDIENTE') return { rows: [] };
      estado = valores[1] as Estado;
      return { rows: [{ id: FUNDACION_ID, nombre: 'Fundación Huellas', estado }] };
    }
    if (sql.includes('SELECT estado FROM aliado WHERE id = $1')) {
      return { rows: [{ estado }] };
    }
    if (sql.includes('INSERT INTO accion_admin')) {
      auditoria.push(valores);
      return { rows: [] };
    }
    if (sql.includes('FROM aliado a JOIN usuario u')) {
      if (sql.includes('WHERE a.id = $1') && valores[0] !== FUNDACION_ID) {
        return { rows: [] };
      }
      if (sql.includes('a.estado =')) {
        return {
          rows:
            estado === 'PENDIENTE'
              ? [{ ...filaFundacion(estado), creadoEn: filaFundacion().creado_en }]
              : [],
        };
      }
      return {
        rows: [
          {
            ...filaFundacion(estado),
            creadoEn: filaFundacion().creado_en,
            logoUrl: 'https://cdn.veto.co/huellas.jpg',
            anioFundacion: 2015,
          },
        ],
      };
    }
    if (sql.includes('FROM aliado WHERE usuario_id = $1')) {
      return {
        rows: usuario.id === ALIADO_FUNDACION.id ? [{ id: FUNDACION_ID, estado }] : [],
      };
    }
  }, usuario);
  return { db, consultas, auditoria, obtenerEstado: () => estado };
}

describe('HU-079 · revisión de fundaciones por Equipo Veto', () => {
  it('lista solicitudes pendientes y permite abrir los datos enviados', async () => {
    const { db } = baseDeDatos();
    const app = await crearApp([AdminModule], db);

    const listado = await request(app.getHttpServer())
      .get(`${RUTA_ADMIN}/pendientes`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(listado.body).toEqual({ fundaciones: [expect.objectContaining({ id: FUNDACION_ID })] });

    const detalle = await request(app.getHttpServer())
      .get(`${RUTA_ADMIN}/${FUNDACION_ID}`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(detalle.body.fundacion).toMatchObject({
      nombre: 'Fundación Huellas',
      descripcion: 'Rescate y cuidado de animales',
      logoUrl: 'https://cdn.veto.co/huellas.jpg',
      contacto: 'contacto@huellas.org',
      ciudad: 'Bogotá',
      ubicacion: 'Dirección enviada',
      anioFundacion: 2015,
    });
    await app.close();
  });

  it.each([
    ['aprueba', 'aprobar', 'ACTIVO', 'APROBAR_FUNDACION'],
    ['rechaza', 'rechazar', 'RECHAZADO', 'RECHAZAR_FUNDACION'],
  ] as const)(
    'el Equipo Veto %s y registra la decisión',
    async (_accion, ruta, destino, accionAdmin) => {
      const escenario = baseDeDatos();
      const app = await crearApp([AdminModule], escenario.db);
      const respuesta = await request(app.getHttpServer())
        .patch(`${RUTA_ADMIN}/${FUNDACION_ID}/${ruta}`)
        .set('Cookie', COOKIE)
        .expect(200);

      expect(escenario.obtenerEstado()).toBe(destino);
      expect(respuesta.body).toEqual({
        fundacion: { id: FUNDACION_ID, estado: destino },
      });
      expect(escenario.auditoria).toEqual([[EQUIPO_VETO.id, FUNDACION_ID, accionAdmin]]);
      expect(
        escenario.consultas.find(
          (consulta) =>
            consulta.sql.includes('UPDATE aliado') && consulta.sql.includes('SET estado = $2'),
        )?.usuarioTx,
      ).toBe(EQUIPO_VETO.id);
      await app.close();
    },
  );

  it('no permite una segunda decisión sobre una solicitud ya resuelta', async () => {
    const escenario = baseDeDatos();
    const app = await crearApp([AdminModule], escenario.db);
    await request(app.getHttpServer())
      .patch(`${RUTA_ADMIN}/${FUNDACION_ID}/aprobar`)
      .set('Cookie', COOKIE)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`${RUTA_ADMIN}/${FUNDACION_ID}/rechazar`)
      .set('Cookie', COOKIE)
      .expect(409);
    expect(escenario.auditoria).toHaveLength(1);
    await app.close();
  });

  it.each([TUTOR, ALIADO_FUNDACION])(
    'rechaza a usuarios que no son Equipo Veto (%s)',
    async (usuario) => {
      const { db } = baseDeDatos(usuario);
      const app = await crearApp([AdminModule], db);
      await request(app.getHttpServer())
        .get(`${RUTA_ADMIN}/pendientes`)
        .set('Cookie', COOKIE)
        .expect(403);
      await app.close();
    },
  );

  it('responde 404 cuando la fundación no existe', async () => {
    const { db } = baseDeDatos();
    const app = await crearApp([AdminModule], db);
    await request(app.getHttpServer())
      .get('/api/admin/fundaciones/88888888-8888-4888-8888-888888888888')
      .set('Cookie', COOKIE)
      .expect(404);
    await app.close();
  });

  it('rechaza un id inválido', async () => {
    const { db } = baseDeDatos();
    const app = await crearApp([AdminModule], db);
    await request(app.getHttpServer())
      .get('/api/admin/fundaciones/no-es-uuid')
      .set('Cookie', COOKIE)
      .expect(400);
    await app.close();
  });
});

describe('HU-079 · consulta propia del resultado', () => {
  it.each(['PENDIENTE', 'ACTIVO', 'RECHAZADO'] as const)(
    'la fundación consulta su estado %s',
    async (estado) => {
      const { db } = baseDeDatos(ALIADO_FUNDACION, estado);
      const app = await crearApp([AliadosModule], db);
      const respuesta = await request(app.getHttpServer())
        .get('/api/aliados/me/fundacion')
        .set('Cookie', COOKIE)
        .expect(200);
      expect(respuesta.body).toEqual({ fundacion: { id: FUNDACION_ID, estado } });
      await app.close();
    },
  );

  it('no expone el resultado a un usuario sin fundación propia', async () => {
    const { db } = baseDeDatos(TUTOR);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .get('/api/aliados/me/fundacion')
      .set('Cookie', COOKIE)
      .expect(403);
    await app.close();
  });
});
