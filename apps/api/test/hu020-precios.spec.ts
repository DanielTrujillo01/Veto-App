import request from 'supertest';
import { ServiciosModule } from '../src/modules/servicios/servicios.module';
import {
  ALIADO,
  COOKIE,
  TUTOR,
  crearApp,
  crearBdFalsa,
  errorPg,
  type Fila,
  type Manejador,
} from './utilidades';

const ALIADO_ID = '77777777-7777-4777-8777-777777777777';
const SERVICIO_ID = '88888888-8888-4888-8888-888888888888';
const MASCOTA_ID = '99999999-9999-4999-8999-999999999999';
const ESPECIE_ID = 1;
const PRECIO_BASE = 60_000;

const servicio = {
  id: SERVICIO_ID,
  aliado_id: ALIADO_ID,
  tipo_servicio_id: 1,
  tipo_servicio: 'Consulta general',
  nombre: 'Consulta general',
  descripcion: null,
  modalidad: 'A_DOMICILIO',
  sede_id: null,
  duracion_min: 30,
  precio_base: PRECIO_BASE,
  activo: true,
  creado_en: new Date('2026-01-01T00:00:00Z'),
};

const reglaDeFila = (fila: Fila) => ({
  id: fila.id,
  especie_id: fila.especie_id ?? null,
  peso_min_kg: fila.peso_min_kg ?? null,
  peso_max_kg: fila.peso_max_kg ?? null,
  edad_min_meses: fila.edad_min_meses ?? null,
  edad_max_meses: fila.edad_max_meses ?? null,
  precio: fila.precio,
  prioridad: fila.prioridad ?? 0,
});

function crearEscenario(
  options: {
    usuario?: typeof ALIADO | typeof TUTOR | null;
    administrador?: boolean;
    servicioExiste?: boolean;
    mascotaExiste?: boolean;
    especieInexistente?: boolean;
    precioCotizado?: number;
  } = {},
) {
  const reglas: Fila[] = [];
  let secuencia = 0;
  let llamadasPrecio = 0;
  const handler: Manejador = (sql, valores) => {
    if (sql.includes('FROM aliado a JOIN usuario u')) {
      return {
        rows: [
          {
            tipo: 'CLINICA',
            estado: 'ACTIVO',
            usuario_id: options.administrador === false ? TUTOR.id : ALIADO.id,
            rol: 'ALIADO',
            estado_cuenta: 'ACTIVA',
          },
        ],
      };
    }
    if (sql.includes('FROM servicio_regla_precio') && sql.includes('SELECT id')) {
      return { rows: reglas.map(reglaDeFila) };
    }
    if (sql.includes('DELETE FROM servicio_regla_precio')) {
      reglas.splice(0, reglas.length);
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO servicio_regla_precio')) {
      const [
        _servicioId,
        especieId,
        pesoMinKg,
        pesoMaxKg,
        edadMinMeses,
        edadMaxMeses,
        precio,
        prioridad,
      ] = valores;
      if (options.especieInexistente && especieId !== null) throw errorPg('23503');
      reglas.push({
        id: `rule-${++secuencia}`,
        especie_id: especieId,
        peso_min_kg: pesoMinKg,
        peso_max_kg: pesoMaxKg,
        edad_min_meses: edadMinMeses,
        edad_max_meses: edadMaxMeses,
        precio,
        prioridad,
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('FROM servicio s')) {
      const isAvailableLookup = sql.includes('JOIN aliado a');
      if (options.servicioExiste === false) return { rows: [] };
      if (isAvailableLookup && (servicio.activo !== true || !sql.includes("a.estado = 'ACTIVO'"))) {
        return { rows: [] };
      }
      return { rows: [servicio] };
    }
    if (sql.includes('FROM mascota m')) {
      if (options.mascotaExiste === false || valores[0] !== MASCOTA_ID || valores[1] !== TUTOR.id) {
        return { rows: [] };
      }
      return {
        rows: [
          {
            id: MASCOTA_ID,
            nombre: 'Luna',
            especie_id: ESPECIE_ID,
            especie: 'Perro',
            sexo: 'HEMBRA',
            raza: null,
            fecha_nacimiento: null,
            edad_meses: null,
            color: null,
            peso_kg: null,
            chip: null,
            fotos: [],
            creado_en: new Date('2026-01-01T00:00:00Z'),
          },
        ],
      };
    }
    if (sql.includes('fn_precio_servicio')) {
      llamadasPrecio += 1;
      return { rows: [{ precio: options.precioCotizado ?? PRECIO_BASE }] };
    }
  };
  const { db, consultas } = crearBdFalsa(handler, options.usuario ?? ALIADO);
  return {
    db,
    consultas,
    reglas,
    get llamadasPrecio() {
      return llamadasPrecio;
    },
  };
}

const reglasPath = `/api/aliados/${ALIADO_ID}/servicios/${SERVICIO_ID}/reglas-precio`;
const reglasGuardadas = {
  reglas: [
    { especieId: ESPECIE_ID, precio: 70_000 },
    { pesoMinKg: 10, pesoMaxKg: 25, precio: 85_000, prioridad: 2 },
    { edadMinMeses: 0, edadMaxMeses: 12, precio: 50_000 },
  ],
};

describe('HU-020 · configurar reglas de precio', () => {
  it('el aliado dueño reemplaza y consulta las reglas persistidas', async () => {
    const escenario = crearEscenario();
    const app = await crearApp([ServiciosModule], escenario.db);
    const guardadas = await request(app.getHttpServer())
      .put(reglasPath)
      .set('Cookie', COOKIE)
      .send(reglasGuardadas)
      .expect(200);

    expect(guardadas.body).toHaveLength(3);
    expect(guardadas.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ especieId: ESPECIE_ID, precio: 70_000 }),
        expect.objectContaining({ pesoMinKg: 10, pesoMaxKg: 25, prioridad: 2 }),
      ]),
    );
    expect(
      escenario.consultas.some((q) => q.sql.includes('DELETE FROM servicio_regla_precio')),
    ).toBe(true);
    expect(
      escenario.consultas
        .filter((q) => q.sql.includes('INSERT INTO servicio_regla_precio'))
        .every((q) => q.usuarioTx === ALIADO.id),
    ).toBe(true);

    const consulta = await request(app.getHttpServer())
      .get(reglasPath)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(consulta.body).toHaveLength(3);

    await request(app.getHttpServer())
      .put(reglasPath)
      .set('Cookie', COOKIE)
      .send({ reglas: [] })
      .expect(200)
      .expect(({ body }) => expect(body).toEqual([]));
    await app.close();
  });

  it('rechaza la falta de sesión, el rol incorrecto y el aliado ajeno', async () => {
    const sinSesion = await crearApp([ServiciosModule], crearEscenario({ usuario: null }).db);
    await request(sinSesion.getHttpServer()).get(reglasPath).expect(401);
    await sinSesion.close();

    const tutor = await crearApp([ServiciosModule], crearEscenario({ usuario: TUTOR }).db);
    await request(tutor.getHttpServer()).get(reglasPath).set('Cookie', COOKIE).expect(403);
    await tutor.close();

    const ajeno = crearEscenario({ administrador: false });
    const app = await crearApp([ServiciosModule], ajeno.db);
    await request(app.getHttpServer())
      .put(reglasPath)
      .set('Cookie', COOKIE)
      .send(reglasGuardadas)
      .expect(403);
    expect(ajeno.consultas.some((q) => q.sql.includes('DELETE FROM servicio_regla_precio'))).toBe(
      false,
    );
    await app.close();
  });

  it('rechaza servicios de otro aliado y reglas con rangos inválidos', async () => {
    const otroServicio = crearEscenario({ servicioExiste: false });
    const app = await crearApp([ServiciosModule], otroServicio.db);
    await request(app.getHttpServer())
      .put(reglasPath)
      .set('Cookie', COOKIE)
      .send(reglasGuardadas)
      .expect(404);
    await request(app.getHttpServer())
      .put(reglasPath)
      .set('Cookie', COOKIE)
      .send({ reglas: [{ pesoMinKg: 20, pesoMaxKg: 10, precio: 50_000 }] })
      .expect(400);
    expect(
      otroServicio.consultas.some((q) => q.sql.includes('DELETE FROM servicio_regla_precio')),
    ).toBe(false);
    await app.close();
  });

  it('rechaza una especie que no existe en el catálogo', async () => {
    const escenario = crearEscenario({ especieInexistente: true });
    const app = await crearApp([ServiciosModule], escenario.db);
    const response = await request(app.getHttpServer())
      .put(reglasPath)
      .set('Cookie', COOKIE)
      .send({ reglas: [{ especieId: 32_767, precio: 70_000 }] })
      .expect(400);

    expect(response.body.errores).toHaveProperty('especieId');
    await app.close();
  });
});

describe('HU-020 · cotizar servicio para mascota', () => {
  const cotizacionPath = `/api/servicios/${SERVICIO_ID}/cotizacion?mascotaId=${MASCOTA_ID}`;

  it('devuelve el precio calculado por la regla aplicable', async () => {
    const escenario = crearEscenario({ usuario: TUTOR, precioCotizado: 85_000 });
    const app = await crearApp([ServiciosModule], escenario.db);
    const resultado = await request(app.getHttpServer())
      .get(cotizacionPath)
      .set('Cookie', COOKIE)
      .expect(200);

    expect(resultado.body).toEqual({
      servicioId: SERVICIO_ID,
      mascotaId: MASCOTA_ID,
      precioBase: PRECIO_BASE,
      precio: 85_000,
    });
    expect(escenario.llamadasPrecio).toBe(1);
    await app.close();
  });

  it('devuelve precio base cuando la función indica que no aplica una regla o faltan datos', async () => {
    const escenario = crearEscenario({ usuario: TUTOR });
    const app = await crearApp([ServiciosModule], escenario.db);
    const resultado = await request(app.getHttpServer())
      .get(cotizacionPath)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(resultado.body.precio).toBe(PRECIO_BASE);
    await app.close();
  });

  it('requiere un tutor autenticado y no cotiza con una mascota ajena o inexistente', async () => {
    const sinSesion = await crearApp([ServiciosModule], crearEscenario({ usuario: null }).db);
    await request(sinSesion.getHttpServer()).get(cotizacionPath).expect(401);
    await sinSesion.close();

    const aliado = await crearApp([ServiciosModule], crearEscenario({ usuario: ALIADO }).db);
    await request(aliado.getHttpServer()).get(cotizacionPath).set('Cookie', COOKIE).expect(403);
    await aliado.close();

    const mascotaAjena = crearEscenario({ usuario: TUTOR, mascotaExiste: false });
    const app = await crearApp([ServiciosModule], mascotaAjena.db);
    await request(app.getHttpServer()).get(cotizacionPath).set('Cookie', COOKIE).expect(404);
    expect(mascotaAjena.llamadasPrecio).toBe(0);
    await app.close();
  });
});
