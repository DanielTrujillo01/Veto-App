import { NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { ClinicaModule } from '../src/modules/clinica/clinica.module';
import { ConsultasRepository } from '../src/modules/clinica/consultas.repository';
import { ConsultasService } from '../src/modules/clinica/consultas.service';
import { IdentidadModule } from '../src/modules/identidad/identidad.module';
import { hashContrasena } from '../src/modules/identidad/seguridad';
import type { Consultor, DatabaseService } from '../src/database/database.service';
import {
  COOKIE,
  TUTOR,
  crearApp,
  crearBdFalsa,
  type Fila,
  type Manejador,
  type UsuarioPrueba,
} from './utilidades';

const VET1_USUARIO: UsuarioPrueba = {
  id: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
  nombre: 'Dra. Vet Uno',
  correo: 'vet1@mail.com',
  celular: '3003334455',
  rol: 'VETERINARIO',
};
const VET2_USUARIO: UsuarioPrueba = {
  id: 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
  nombre: 'Dr. Vet Dos',
  correo: 'vet2@mail.com',
  celular: '3003334466',
  rol: 'VETERINARIO',
};
const INDEPENDIENTE_USUARIO: UsuarioPrueba = {
  id: 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
  nombre: 'Dr. Independiente',
  correo: 'indep@mail.com',
  celular: '3003334477',
  rol: 'ALIADO',
};
const EQUIPO_VETO: UsuarioPrueba = {
  id: 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
  nombre: 'Equipo Veto',
  correo: 'admin@veto.co',
  celular: '3006667788',
  rol: 'EQUIPO_VETO',
};

const VET1 = '33333333-3333-4333-8333-333333333331';
const VET2 = '33333333-3333-4333-8333-333333333332';
const VET_INDEP = '33333333-3333-4333-8333-333333333333';
const ALIADO1 = '44444444-4444-4444-8444-444444444441';

const C1 = '55555555-5555-4555-8555-555555555551'; // de VET1, abierta, la más reciente
const C2 = '55555555-5555-4555-8555-555555555552'; // de VET1, cerrada
const C3 = '55555555-5555-4555-8555-555555555553'; // de VET2

function sesionVet(id: string, extra: Fila = {}): Fila {
  return {
    id,
    aliado_id: ALIADO1,
    aliado_nombre: 'Clínica Patitas',
    aliado_tipo: 'CLINICA',
    estado_aliado: 'ACTIVO',
    foto_url: null,
    descripcion: 'Medicina general',
    activo: true,
    ...extra,
  };
}

function consulta(id: string, veterinarioId: string, extra: Fila = {}): Fila {
  return {
    id,
    cita_id: '66666666-6666-4666-8666-666666666666',
    veterinario_id: veterinarioId,
    cita_inicio: new Date('2026-03-02T15:00:00Z'),
    cita_fin: new Date('2026-03-02T15:30:00Z'),
    servicio: 'Consulta general',
    mascota_id: '77777777-7777-4777-8777-777777777777',
    mascota_nombre: 'Firulais',
    especie: 'Perro',
    motivo_consulta: 'Vómito y decaimiento',
    descripcion_propietario: 'Lleva dos días sin comer',
    estado_mental: 'Alerta',
    condicion_corporal: 'Ideal',
    comportamiento: 'Tranquilo',
    estado_general: 'Regular',
    estado: 'ABIERTA',
    cerrada_en: null,
    creado_en: new Date('2026-03-02T15:05:00Z'),
    ...extra,
  };
}

const CONSULTAS: Fila[] = [
  consulta(C1, VET1),
  consulta(C2, VET1, {
    estado: 'CERRADA',
    cerrada_en: new Date('2026-03-01T16:00:00Z'),
    cita_inicio: new Date('2026-03-01T15:00:00Z'),
    motivo_consulta: 'Control de vacunas',
  }),
  consulta(C3, VET2, { motivo_consulta: 'Cojera' }),
];

/**
 * Simula veterinario y v_consulta_detalle. `perfiles` dice qué cuenta tiene qué perfil de
 * veterinario; las consultas se filtran por el veterinario_id que recibe el SQL, igual que la
 * base real, así que una prueba solo pasa si la API le pasa el veterinario correcto.
 */
function clinicaEnBd(
  perfiles: Record<string, Fila>,
  extra: Manejador = () => undefined,
): Manejador {
  const filtrar = (veterinarioId: unknown, estado: unknown) =>
    CONSULTAS.filter(
      (c) => c.veterinario_id === veterinarioId && (estado === null || c.estado === estado),
    ).sort((a, b) => +(b.cita_inicio as Date) - +(a.cita_inicio as Date));

  return (sql, valores) => {
    const r = extra(sql, valores);
    if (r) return r;
    if (sql.includes('FROM veterinario v')) {
      const perfil = perfiles[valores[0] as string];
      return { rows: perfil ? [perfil] : [] };
    }
    if (sql.includes('count(*)') && sql.includes('v_consulta_detalle')) {
      return { rows: [{ total: filtrar(valores[0], valores[1]).length }] };
    }
    if (sql.includes('LIMIT') && sql.includes('v_consulta_detalle')) {
      const [vet, estado, limite, desplazamiento] = valores as [unknown, unknown, number, number];
      return { rows: filtrar(vet, estado).slice(desplazamiento, desplazamiento + limite) };
    }
    if (sql.includes('id = $1 AND veterinario_id = $2')) {
      return {
        rows: CONSULTAS.filter((c) => c.id === valores[0] && c.veterinario_id === valores[1]),
      };
    }
  };
}

const PERFILES = {
  [VET1_USUARIO.id]: sesionVet(VET1),
  [VET2_USUARIO.id]: sesionVet(VET2),
};

describe('HU-014 · el veterinario ingresa con su propia cuenta', () => {
  let hash: string;
  beforeAll(async () => {
    hash = await hashContrasena('clave-segura-1');
  });

  const cuenta = () => ({ ...VET1_USUARIO, password_hash: hash });
  const manejador: Manejador = (sql) => {
    if (sql.includes('password_hash') && sql.includes('FROM usuario')) return { rows: [cuenta()] };
  };

  it('inicia sesión con correo y contraseña y recibe una cookie de sesión segura', async () => {
    const { db, consultas } = crearBdFalsa(manejador, null);
    const app = await crearApp([IdentidadModule], db);
    const r = await request(app.getHttpServer())
      .post('/api/identidad/login')
      .send({ correo: VET1_USUARIO.correo, contrasena: 'clave-segura-1' })
      .expect(201);

    expect(r.body.usuario).toMatchObject({ id: VET1_USUARIO.id, rol: 'VETERINARIO' });
    expect(r.body.usuario).not.toHaveProperty('password_hash');
    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toMatch(/^veto_session=.+; HttpOnly; Path=\/; SameSite=Lax/);
    expect(consultas.some((c) => c.sql.includes('INSERT INTO sesion'))).toBe(true);
    await app.close();
  });

  it('con una contraseña incorrecta no se crea sesión', async () => {
    const { db, consultas } = crearBdFalsa(manejador, null);
    const app = await crearApp([IdentidadModule], db);
    const r = await request(app.getHttpServer())
      .post('/api/identidad/login')
      .send({ correo: VET1_USUARIO.correo, contrasena: 'otra-clave-1' })
      .expect(401);
    expect(r.headers['set-cookie']).toBeUndefined();
    expect(consultas.some((c) => c.sql.includes('INSERT INTO sesion'))).toBe(false);
    await app.close();
  });

  it('una cuenta inactiva o eliminada no ingresa (la consulta exige estado ACTIVA)', async () => {
    const { db, consultas } = crearBdFalsa(() => ({ rows: [] }), null);
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .post('/api/identidad/login')
      .send({ correo: VET1_USUARIO.correo, contrasena: 'clave-segura-1' })
      .expect(401);
    const login = consultas.find((c) => c.sql.includes('FROM usuario'));
    expect(login?.sql).toContain("estado = 'ACTIVA'");
    expect(login?.sql).toContain('eliminado_en IS NULL');
    await app.close();
  });
});

describe('HU-014 · perfil del veterinario autenticado', () => {
  it('sin sesión responde 401', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), null);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get('/api/veterinarios/me').expect(401);
    await app.close();
  });

  it('devuelve el perfil de la cuenta con la que se inició sesión', async () => {
    const { db, consultas } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/veterinarios/me')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toEqual({
      id: VET1,
      usuario: {
        id: VET1_USUARIO.id,
        nombre: VET1_USUARIO.nombre,
        correo: VET1_USUARIO.correo,
        celular: VET1_USUARIO.celular,
      },
      aliado: { id: ALIADO1, nombre: 'Clínica Patitas', tipo: 'CLINICA' },
      fotoUrl: null,
      descripcion: 'Medicina general',
    });
    // El perfil se busca por la cuenta de la sesión, no por un dato del cliente
    const busqueda = consultas.find((c) => c.sql.includes('FROM veterinario v'));
    expect(busqueda?.valores).toEqual([VET1_USUARIO.id]);
    await app.close();
  });

  it('el veterinario independiente (cuenta ALIADO con perfil de veterinario) también entra', async () => {
    const perfiles = {
      [INDEPENDIENTE_USUARIO.id]: sesionVet(VET_INDEP, { aliado_tipo: 'VET_INDEPENDIENTE' }),
    };
    const { db } = crearBdFalsa(clinicaEnBd(perfiles), INDEPENDIENTE_USUARIO);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/veterinarios/me')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.aliado.tipo).toBe('VET_INDEPENDIENTE');
    await app.close();
  });

  it.each([
    ['un tutor', TUTOR, PERFILES, 'no tiene un perfil de veterinario'],
    ['el Equipo Veto', EQUIPO_VETO, PERFILES, 'no tiene un perfil de veterinario'],
    [
      'un veterinario desactivado',
      VET1_USUARIO,
      { [VET1_USUARIO.id]: sesionVet(VET1, { activo: false }) },
      'desactivado',
    ],
    [
      'un veterinario de una clínica suspendida',
      VET1_USUARIO,
      { [VET1_USUARIO.id]: sesionVet(VET1, { estado_aliado: 'SUSPENDIDO' }) },
      'no está activo',
    ],
    [
      'un veterinario de una clínica aún pendiente de autorización',
      VET1_USUARIO,
      { [VET1_USUARIO.id]: sesionVet(VET1, { estado_aliado: 'PENDIENTE' }) },
      'no está activo',
    ],
  ])('responde 403 a %s', async (_quien, usuario, perfiles, mensaje) => {
    const { db } = crearBdFalsa(clinicaEnBd(perfiles), usuario);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/veterinarios/me')
      .set('Cookie', COOKIE)
      .expect(403);
    expect(r.body.message).toContain(mensaje);
    await app.close();
  });
});

describe('HU-014 · lista de consultas del veterinario', () => {
  it('sin sesión responde 401', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), null);
    const app = await crearApp([ClinicaModule], db);
    await request(app.getHttpServer()).get('/api/veterinarios/me/consultas').expect(401);
    await app.close();
  });

  it.each([
    ['un tutor', TUTOR],
    ['el Equipo Veto', EQUIPO_VETO],
  ])('responde 403 a %s y no consulta la base de consultas', async (_quien, usuario) => {
    const { db, consultas } = crearBdFalsa(clinicaEnBd(PERFILES), usuario);
    const app = await crearApp([ClinicaModule], db);
    await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas')
      .set('Cookie', COOKIE)
      .expect(403);
    expect(consultas.some((c) => c.sql.includes('v_consulta_detalle'))).toBe(false);
    await app.close();
  });

  it('un veterinario desactivado ya no ve consultas', async () => {
    const perfiles = { [VET1_USUARIO.id]: sesionVet(VET1, { activo: false }) };
    const { db } = crearBdFalsa(clinicaEnBd(perfiles), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas')
      .set('Cookie', COOKIE)
      .expect(403);
    await app.close();
  });

  it('muestra únicamente sus consultas, de la más reciente a la más antigua', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas')
      .set('Cookie', COOKIE)
      .expect(200);

    expect(r.body.items.map((c: { id: string }) => c.id)).toEqual([C1, C2]);
    expect(r.body).toMatchObject({ total: 2, pagina: 1, limite: 20 });
    expect(r.body.items[0]).toEqual({
      id: C1,
      citaId: '66666666-6666-4666-8666-666666666666',
      fecha: '2026-03-02T15:00:00.000Z',
      servicio: 'Consulta general',
      mascota: {
        id: '77777777-7777-4777-8777-777777777777',
        nombre: 'Firulais',
        especie: 'Perro',
      },
      motivoConsulta: 'Vómito y decaimiento',
      estado: 'ABIERTA',
      cerradaEn: null,
    });
    expect(r.body.items[1].cerradaEn).toBe('2026-03-01T16:00:00.000Z');
    await app.close();
  });

  it('otro veterinario ve solo las suyas', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), VET2_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.items.map((c: { id: string }) => c.id)).toEqual([C3]);
    await app.close();
  });

  it('no se puede pedir las consultas de otro veterinario por la URL', async () => {
    const { db, consultas } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const r = await request(app.getHttpServer())
      .get(`/api/veterinarios/me/consultas?veterinarioId=${VET2}&veterinario_id=${VET2}`)
      .set('Cookie', COOKIE)
      .set('X-Veterinario-Id', VET2)
      .expect(200);

    expect(r.body.items.map((c: { id: string }) => c.id)).toEqual([C1, C2]);
    for (const c of consultas.filter((c) => c.sql.includes('v_consulta_detalle'))) {
      expect(c.valores[0]).toBe(VET1);
      expect(c.valores).not.toContain(VET2);
    }
    await app.close();
  });

  it('el SQL siempre filtra por el veterinario de la sesión', async () => {
    const { db, consultas } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas')
      .set('Cookie', COOKIE)
      .expect(200);
    const lecturas = consultas.filter((c) => c.sql.includes('v_consulta_detalle'));
    expect(lecturas).toHaveLength(2); // la página y el total
    for (const c of lecturas) expect(c.sql).toContain('WHERE veterinario_id = $1');
    await app.close();
  });

  it('filtra por estado', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const abiertas = await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas?estado=ABIERTA')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(abiertas.body.items.map((c: { id: string }) => c.id)).toEqual([C1]);
    expect(abiertas.body.total).toBe(1);

    const cerradas = await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas?estado=CERRADA')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(cerradas.body.items.map((c: { id: string }) => c.id)).toEqual([C2]);
    await app.close();
  });

  it('pagina los resultados y conserva el total', async () => {
    const { db, consultas } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas?pagina=2&limite=1')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.items.map((c: { id: string }) => c.id)).toEqual([C2]);
    expect(r.body).toMatchObject({ total: 2, pagina: 2, limite: 1 });
    const pagina = consultas.find((c) => c.sql.includes('LIMIT'));
    expect(pagina?.valores.slice(2)).toEqual([1, 1]); // limite 1, desplazamiento 1
    await app.close();
  });

  it('una página sin resultados responde vacía, no error', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas?pagina=9')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toMatchObject({ items: [], total: 2, pagina: 9 });
    await app.close();
  });

  it.each([
    ['estado inexistente', 'estado=PENDIENTE', 'estado'],
    ['página 0', 'pagina=0', 'pagina'],
    ['límite sobre el máximo', 'limite=500', 'limite'],
    ['límite no numérico', 'limite=muchos', 'limite'],
  ])('responde 400 con %s', async (_caso, query, campo) => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const r = await request(app.getHttpServer())
      .get(`/api/veterinarios/me/consultas?${query}`)
      .set('Cookie', COOKIE)
      .expect(400);
    expect(r.body.errores).toHaveProperty(campo);
    await app.close();
  });
});

describe('HU-014 · detalle de una consulta propia', () => {
  it('sin sesión responde 401', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), null);
    const app = await crearApp([ClinicaModule], db);
    await request(app.getHttpServer()).get(`/api/veterinarios/me/consultas/${C1}`).expect(401);
    await app.close();
  });

  it('un tutor recibe 403', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), TUTOR);
    const app = await crearApp([ClinicaModule], db);
    await request(app.getHttpServer())
      .get(`/api/veterinarios/me/consultas/${C1}`)
      .set('Cookie', COOKIE)
      .expect(403);
    await app.close();
  });

  it('devuelve la consulta propia con su anamnesis', async () => {
    const { db, consultas } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const r = await request(app.getHttpServer())
      .get(`/api/veterinarios/me/consultas/${C1}`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toMatchObject({
      id: C1,
      estado: 'ABIERTA',
      motivoConsulta: 'Vómito y decaimiento',
      descripcionPropietario: 'Lleva dos días sin comer',
      estadoMental: 'Alerta',
      condicionCorporal: 'Ideal',
      comportamiento: 'Tranquilo',
      estadoGeneral: 'Regular',
      citaFin: '2026-03-02T15:30:00.000Z',
      mascota: { nombre: 'Firulais', especie: 'Perro' },
    });
    const lectura = consultas.find((c) => c.sql.includes('id = $1 AND veterinario_id = $2'));
    expect(lectura?.valores).toEqual([C1, VET1]);
    await app.close();
  });

  it('la consulta de otro veterinario responde 404 (no se revela que existe)', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const ajena = await request(app.getHttpServer())
      .get(`/api/veterinarios/me/consultas/${C3}`)
      .set('Cookie', COOKIE)
      .expect(404);
    const inexistente = await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas/99999999-9999-4999-8999-999999999999')
      .set('Cookie', COOKIE)
      .expect(404);
    // Misma respuesta para "ajena" e "inexistente": no se puede explorar ids de colegas
    expect(ajena.body.message).toBe(inexistente.body.message);
    await app.close();
  });

  it('un id que no es UUID responde 400', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    await request(app.getHttpServer())
      .get('/api/veterinarios/me/consultas/no-es-un-uuid')
      .set('Cookie', COOKIE)
      .expect(400);
    await app.close();
  });

  it('no existe ninguna ruta para modificar o borrar consultas de este recurso', async () => {
    const { db } = crearBdFalsa(clinicaEnBd(PERFILES), VET1_USUARIO);
    const app = await crearApp([ClinicaModule], db);
    const ruta = `/api/veterinarios/me/consultas/${C1}`;
    const servidor = app.getHttpServer();
    await request(servidor).post(ruta).set('Cookie', COOKIE).expect(404);
    await request(servidor).put(ruta).set('Cookie', COOKIE).expect(404);
    await request(servidor).patch(ruta).set('Cookie', COOKIE).expect(404);
    await request(servidor).delete(ruta).set('Cookie', COOKIE).expect(404);
    await app.close();
  });
});

describe('ConsultasService.exigirPropia (para HU-037 y HU-042)', () => {
  function servicioCon(esPropia: boolean) {
    const query = jest.fn(async () => ({ rows: [{ ok: esPropia }], rowCount: 1 }));
    const db = { query } as unknown as Consultor;
    return {
      db,
      query,
      servicio: new ConsultasService(db as DatabaseService, new ConsultasRepository()),
    };
  }

  it('deja pasar si la consulta es del veterinario', async () => {
    const { db, query, servicio } = servicioCon(true);
    await expect(servicio.exigirPropia(db, VET1, C1)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('veterinario_id = $2'), [C1, VET1]);
  });

  it('lanza 404 si la consulta es de otro veterinario o no existe', async () => {
    const { db, servicio } = servicioCon(false);
    await expect(servicio.exigirPropia(db, VET1, C3)).rejects.toBeInstanceOf(NotFoundException);
  });
});
