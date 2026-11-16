import request from 'supertest';
import { ComercioModule } from '../src/modules/comercio/comercio.module';
import { crearApp, crearBdFalsa, type Fila } from './utilidades';

const PRODUCTO_ID = '55555555-5555-4555-8555-555555555555';
const TIENDA_ID = '44444444-4444-4444-8444-444444444444';

type Producto = Fila & { activo: boolean; moderacion: string; estado_tienda: string };

const producto = (extra: Partial<Producto> = {}): Producto => ({
  id: PRODUCTO_ID,
  aliado_id: TIENDA_ID,
  aliado: 'PetShop',
  categoria_id: 1,
  categoria: 'Alimentos',
  nombre: 'Concentrado gato 2 kg',
  descripcion: 'Sabor pollo.',
  precio: 45000,
  stock: 3,
  creado_en: '2026-11-16T10:00:00Z',
  activo: true,
  moderacion: 'PUBLICADO',
  estado_tienda: 'ACTIVO',
  ...extra,
});

/** Simula la condición de "producto visible" de la consulta real. */
function bd(p: Producto | null) {
  return crearBdFalsa((sql, valores) => {
    if (sql.includes('FROM producto p') && sql.includes('p.id = $1')) {
      expect(sql).toContain("p.activo AND p.moderacion = 'PUBLICADO' AND a.estado = 'ACTIVO'");
      const visible =
        p &&
        p.id === valores[0] &&
        p.activo &&
        p.moderacion === 'PUBLICADO' &&
        p.estado_tienda === 'ACTIVO';
      return { rows: visible ? [p] : [] };
    }
    if (sql.includes('FROM producto_foto')) {
      expect(sql).toContain('ORDER BY posicion');
      return {
        rows: [
          { producto_id: PRODUCTO_ID, url: 'https://x.co/portada.jpg' },
          { producto_id: PRODUCTO_ID, url: 'https://x.co/2.jpg' },
        ],
      };
    }
    return undefined;
  }, null);
}

describe('HU-046 · detalle público de un producto', () => {
  it('sin sesión devuelve el producto visible con sus fotos en orden y su stock', async () => {
    const { db } = bd(producto());
    const app = await crearApp([ComercioModule], db);
    const res = await request(app.getHttpServer()).get(`/api/productos/${PRODUCTO_ID}`).expect(200);
    expect(res.body).toMatchObject({
      id: PRODUCTO_ID,
      aliadoId: TIENDA_ID,
      aliado: 'PetShop',
      precio: 45000,
      stock: 3,
      fotos: ['https://x.co/portada.jpg', 'https://x.co/2.jpg'],
    });
    await app.close();
  });

  it.each([
    ['desactivado', producto({ activo: false })],
    ['ocultado por moderación', producto({ moderacion: 'OCULTO' })],
    ['de una tienda suspendida', producto({ estado_tienda: 'SUSPENDIDO' })],
    ['inexistente', null],
  ])('un producto %s responde 404 "ya no está disponible"', async (_, p) => {
    const { db } = bd(p);
    const app = await crearApp([ComercioModule], db);
    const res = await request(app.getHttpServer()).get(`/api/productos/${PRODUCTO_ID}`).expect(404);
    expect(res.body.message).toBe('Este producto ya no está disponible');
    await app.close();
  });

  it('un id que no es uuid se rechaza sin consultar la base', async () => {
    const { db, consultas } = bd(producto());
    const app = await crearApp([ComercioModule], db);
    await request(app.getHttpServer()).get('/api/productos/no-es-un-id').expect(400);
    expect(consultas).toHaveLength(0);
    await app.close();
  });

  it('la ruta de categorías no se confunde con un id de producto', async () => {
    const { db } = bd(producto());
    const app = await crearApp([ComercioModule], db);
    await request(app.getHttpServer()).get('/api/productos/categorias').expect(200);
    await app.close();
  });
});
