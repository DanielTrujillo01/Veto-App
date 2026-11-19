import request from 'supertest';
import { ReservasModule } from '../src/modules/reservas/reservas.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa, type UsuarioPrueba } from './utilidades';

/**
 * HU-032 · Agenda de citas del aliado y del veterinario (GET /api/citas).
 * El administrador del aliado ve las citas de su aliado; un veterinario activo, las suyas.
 */

const VETERINARIO: UsuarioPrueba = {
  ...ALIADO,
  id: '44444444-4444-4444-8444-444444444444',
  nombre: 'Dra. Ana',
  rol: 'VETERINARIO',
};

const fila = (id: string, estado: string) => ({
  id,
  estado,
  inicio: new Date('2099-06-03T13:00:00Z'),
  fin: new Date('2099-06-03T14:00:00Z'),
  precio: '50000',
  motivo: 'Control',
  recomendaciones: null,
  creado_en: new Date('2099-06-01T10:00:00Z'),
  tutor_id: TUTOR.id,
  tutor_nombre: 'Ana Tutor',
  mascota_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  mascota_nombre: 'Pepo',
  especie: 'Gato',
  aliado_id: '77777777-7777-4777-8777-777777777777',
  aliado_nombre: 'clinicaprueba',
  servicio_id: '55555555-5555-4555-8555-555555555555',
  servicio_nombre: 'Consulta1',
  veterinario_id: 'v1',
  veterinario_nombre: 'Dra. Ana',
});

function bd(usuario: UsuarioPrueba | null, filas = [fila('c1', 'AGENDADA')]) {
  return crearBdFalsa((sql) => {
    if (sql.includes('FROM v_cita_detalle d')) return { rows: filas };
  }, usuario);
}

describe('HU-032 · agenda de citas', () => {
  it('el veterinario ve sus citas y la consulta filtra por él', async () => {
    const { db, consultas } = bd(VETERINARIO);
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/citas')
      .set('Cookie', COOKIE)
      .expect(200);

    expect(r.body).toEqual([
      expect.objectContaining({
        id: 'c1',
        estado: 'AGENDADA',
        precio: 50000,
        mascota: expect.objectContaining({ nombre: 'Pepo' }),
        servicio: expect.objectContaining({ nombre: 'Consulta1' }),
      }),
    ]);
    const lectura = consultas.find((c) => c.sql.includes('FROM v_cita_detalle d'));
    // Pregunta por la persona que mira (admin del aliado o veterinario asignado), sin filtro
    // de estado y con el límite por defecto.
    expect(lectura?.sql).toContain('d.aliado_usuario_id = $1');
    expect(lectura?.sql).toContain('v.id = d.veterinario_id AND v.usuario_id = $1');
    expect(lectura?.valores).toEqual([VETERINARIO.id, null, 100]);
    await app.close();
  });

  it('el administrador del aliado puede filtrar por estado y acotar el límite', async () => {
    const { db, consultas } = bd(ALIADO);
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer())
      .get('/api/citas?estado=PENDIENTE&limite=20')
      .set('Cookie', COOKIE)
      .expect(200);
    const lectura = consultas.find((c) => c.sql.includes('FROM v_cita_detalle d'));
    expect(lectura?.valores).toEqual([ALIADO.id, 'PENDIENTE', 20]);
    await app.close();
  });

  it('rechaza un estado o un límite no válidos', async () => {
    const { db } = bd(ALIADO);
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer())
      .get('/api/citas?estado=OTRO')
      .set('Cookie', COOKIE)
      .expect(400);
    await request(app.getHttpServer()).get('/api/citas?limite=0').set('Cookie', COOKIE).expect(400);
    await request(app.getHttpServer())
      .get('/api/citas?limite=500')
      .set('Cookie', COOKIE)
      .expect(400);
    await app.close();
  });

  it('el tutor no tiene agenda (403) y sin sesión responde 401', async () => {
    const tutor = bd(TUTOR);
    const app = await crearApp([ReservasModule], tutor.db);
    await request(app.getHttpServer()).get('/api/citas').set('Cookie', COOKIE).expect(403);
    await app.close();

    const sinSesion = bd(null);
    const app2 = await crearApp([ReservasModule], sinSesion.db);
    await request(app2.getHttpServer()).get('/api/citas').expect(401);
    await app2.close();
  });
});
