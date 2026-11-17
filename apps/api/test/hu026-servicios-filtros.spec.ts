import request from 'supertest';
import { ServiciosModule } from '../src/modules/servicios/servicios.module';
import { crearApp, crearBdFalsa, type Fila } from './utilidades';

const FILAS: Fila[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    aliado_id: '10000000-0000-4000-8000-000000000001',
    tipo_servicio_id: 1,
    tipo_servicio: 'Consulta general',
    nombre: 'Consulta domicilio',
    descripcion: null,
    modalidad: 'A_DOMICILIO',
    sede_id: null,
    duracion_min: 30,
    precio_base: 60000,
    activo: true,
    creado_en: new Date('2026-01-01T00:00:00Z'),
    precio_desde: 60000,
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    aliado_id: '10000000-0000-4000-8000-000000000002',
    tipo_servicio_id: 2,
    tipo_servicio: 'Baño',
    nombre: 'Baño en sede',
    descripcion: null,
    modalidad: 'EN_SEDE',
    sede_id: '20000000-0000-4000-8000-000000000002',
    duracion_min: 30,
    precio_base: 40000,
    activo: true,
    creado_en: new Date('2026-01-01T00:00:00Z'),
    precio_desde: 40000,
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    aliado_id: '10000000-0000-4000-8000-000000000003',
    tipo_servicio_id: 2,
    tipo_servicio: 'Baño',
    nombre: 'Baño a domicilio',
    descripcion: null,
    modalidad: 'A_DOMICILIO',
    sede_id: null,
    duracion_min: 30,
    precio_base: 45000,
    activo: true,
    creado_en: new Date('2026-01-01T00:00:00Z'),
    precio_desde: 45000,
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    aliado_id: '10000000-0000-4000-8000-000000000004',
    tipo_servicio_id: 1,
    tipo_servicio: 'Consulta general',
    nombre: 'Consulta inactiva',
    descripcion: null,
    modalidad: 'EN_SEDE',
    sede_id: '20000000-0000-4000-8000-000000000004',
    duracion_min: 30,
    precio_base: 30000,
    activo: false,
    creado_en: new Date('2026-01-01T00:00:00Z'),
    precio_desde: 30000,
  },
];

const ESPECIES_POR_ALIADO: Record<string, number[]> = {
  '10000000-0000-4000-8000-000000000001': [1],
  '10000000-0000-4000-8000-000000000002': [2],
  '10000000-0000-4000-8000-000000000003': [1],
  '10000000-0000-4000-8000-000000000004': [1],
};

function bd() {
  return crearBdFalsa((sql, valores) => {
    if (sql.includes('WITH disponibles')) {
      const [especieId, tipoServicioId, modalidad] = valores;
      const rows = FILAS.filter((fila) => {
        const especies = ESPECIES_POR_ALIADO[fila.aliado_id as string] ?? [];
        if (fila.activo !== true) return false;
        if (especieId !== null && !especies.includes(Number(especieId))) return false;
        if (tipoServicioId !== null && fila.tipo_servicio_id !== Number(tipoServicioId))
          return false;
        if (modalidad !== null && fila.modalidad !== modalidad) return false;
        return true;
      });
      return { rows };
    }
    if (sql.includes('FROM servicio_regla_precio') && sql.includes('ANY($1::uuid[])')) {
      return { rows: [] };
    }
    return { rows: [] };
  }, null);
}

describe('HU-026 · filtros del catálogo global de servicios', () => {
  it('combina especie, tipo y modalidad mediante AND', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/servicios?especieId=1&tipoServicioId=2&modalidad=A_DOMICILIO')
      .expect(200);
    expect(r.body.map((servicio: { id: string }) => servicio.id)).toEqual([
      '00000000-0000-4000-8000-000000000003',
    ]);
    expect(consultas[0].valores).toEqual([1, 2, 'A_DOMICILIO']);
    expect(consultas[0].sql).toContain('FROM aliado_especie ae');
    await app.close();
  });

  it('filtra solo por especie atendida por el aliado y preserva disponibilidad', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get('/api/servicios?especieId=1').expect(200);
    expect(r.body.map((servicio: { nombre: string }) => servicio.nombre)).toEqual([
      'Consulta domicilio',
      'Baño a domicilio',
    ]);
    expect(consultas[0].sql).toContain(
      "a.estado = 'ACTIVO' AND s.activo AND s.moderacion = 'PUBLICADO'",
    );
    expect(consultas[0].sql).toContain(
      'WHERE se.id = s.sede_id AND se.aliado_id = s.aliado_id AND se.activa',
    );
    await app.close();
  });

  it('filtra tipo y modalidad por separado', async () => {
    const { db } = bd();
    const app = await crearApp([ServiciosModule], db);
    const tipo = await request(app.getHttpServer())
      .get('/api/servicios?tipoServicioId=2')
      .expect(200);
    expect(tipo.body.map((servicio: { nombre: string }) => servicio.nombre)).toEqual([
      'Baño en sede',
      'Baño a domicilio',
    ]);
    const modalidad = await request(app.getHttpServer())
      .get('/api/servicios?modalidad=EN_SEDE')
      .expect(200);
    expect(modalidad.body.map((servicio: { nombre: string }) => servicio.nombre)).toEqual([
      'Baño en sede',
    ]);
    await app.close();
  });

  it('sin filtros conserva la lista y el orden por defecto', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get('/api/servicios').expect(200);
    expect(r.body).toHaveLength(3);
    expect(consultas[0].valores).toEqual([null, null, null]);
    expect(consultas[0].sql).toContain('ORDER BY d.nombre, d.id');
    await request(app.getHttpServer()).get('/api/servicios?orden=precio_desc').expect(200);
    expect(consultas[2].sql).toContain('ORDER BY precio_desde DESC, d.nombre, d.id');
    await request(app.getHttpServer()).get('/api/servicios?edad=2&ubicacion=Bogota').expect(200);
    expect(consultas[4].valores).toEqual([null, null, null]);
    await app.close();
  });

  it('un identificador válido sin coincidencias devuelve arreglo vacío', async () => {
    const app = await crearApp([ServiciosModule], bd().db);
    const r = await request(app.getHttpServer()).get('/api/servicios?especieId=3').expect(200);
    expect(r.body).toEqual([]);
    await app.close();
  });

  it.each([
    ['especieId', 'abc'],
    ['especieId', '0'],
    ['especieId', '1.5'],
    ['especieId', '32768'],
    ['tipoServicioId', '-1'],
    ['tipoServicioId', '0'],
    ['tipoServicioId', '1.5'],
    ['tipoServicioId', '32768'],
    ['modalidad', 'REMOTO'],
  ])('rechaza %s=%s con 400', async (campo, valor) => {
    const app = await crearApp([ServiciosModule], bd().db);
    await request(app.getHttpServer()).get(`/api/servicios?${campo}=${valor}`).expect(400);
    await app.close();
  });
});
