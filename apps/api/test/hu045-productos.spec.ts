import request from 'supertest';
import { ComercioModule } from '../src/modules/comercio/comercio.module';
import { crearApp, crearBdFalsa, type Fila } from './utilidades';

const CATEGORIAS = [
  { id: 1, nombre: 'Alimentos' },
  { id: 2, nombre: 'Accesorios' },
];

const PRODUCTOS: Fila[] = [
  {
    id: '00000000-0000-4000-8000-000000000701',
    aliado_id: '00000000-0000-4000-8000-000000000103',
    aliado: 'Tienda Demo',
    categoria_id: 1,
    categoria: 'Alimentos',
    nombre: 'Croquetas Árbol   Norte',
    descripcion: 'Alimento de prueba',
    precio: 1000,
    stock: 0,
    activo: true,
    moderacion: 'PUBLICADO',
    aliado_estado: 'ACTIVO',
    creado_en: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: '00000000-0000-4000-8000-000000000702',
    aliado_id: '00000000-0000-4000-8000-000000000103',
    aliado: 'Tienda Demo',
    categoria_id: 1,
    categoria: 'Alimentos',
    nombre: 'Alimento balanceado demo',
    descripcion: null,
    precio: 5000,
    stock: 10,
    activo: true,
    moderacion: 'PUBLICADO',
    aliado_estado: 'ACTIVO',
    creado_en: new Date('2026-01-02T00:00:00Z'),
  },
  {
    id: '00000000-0000-4000-8000-000000000703',
    aliado_id: '00000000-0000-4000-8000-000000000103',
    aliado: 'Tienda Demo',
    categoria_id: 2,
    categoria: 'Accesorios',
    nombre: 'Juguete para mascotas demo',
    descripcion: null,
    precio: 18000,
    stock: 35,
    activo: true,
    moderacion: 'PUBLICADO',
    aliado_estado: 'ACTIVO',
    creado_en: new Date('2026-01-03T00:00:00Z'),
  },
  {
    id: '00000000-0000-4000-8000-000000000704',
    aliado_id: '00000000-0000-4000-8000-000000000103',
    aliado: 'Tienda Demo',
    categoria_id: 1,
    categoria: 'Alimentos',
    nombre: 'Producto inactivo',
    descripcion: null,
    precio: 1,
    stock: 1,
    activo: false,
    moderacion: 'PUBLICADO',
    aliado_estado: 'ACTIVO',
    creado_en: new Date('2026-01-04T00:00:00Z'),
  },
  {
    id: '00000000-0000-4000-8000-000000000705',
    aliado_id: '00000000-0000-4000-8000-000000000103',
    aliado: 'Tienda Demo',
    categoria_id: 1,
    categoria: 'Alimentos',
    nombre: 'Producto oculto',
    descripcion: null,
    precio: 1,
    stock: 1,
    activo: true,
    moderacion: 'OCULTO',
    aliado_estado: 'ACTIVO',
    creado_en: new Date('2026-01-05T00:00:00Z'),
  },
  {
    id: '00000000-0000-4000-8000-000000000706',
    aliado_id: '00000000-0000-4000-8000-000000000103',
    aliado: 'Tienda Demo',
    categoria_id: 1,
    categoria: 'Alimentos',
    nombre: 'Producto de tienda suspendida',
    descripcion: null,
    precio: 1,
    stock: 1,
    activo: true,
    moderacion: 'PUBLICADO',
    aliado_estado: 'SUSPENDIDO',
    creado_en: new Date('2026-01-06T00:00:00Z'),
  },
];

const FOTOS: { producto_id: string; url: string; moderacion: string }[] = [
  {
    producto_id: PRODUCTOS[0].id as string,
    url: 'https://example.test/croquetas-publicada.jpg',
    moderacion: 'PUBLICADO',
  },
  {
    producto_id: PRODUCTOS[0].id as string,
    url: 'https://example.test/croquetas-oculta.jpg',
    moderacion: 'OCULTO',
  },
];

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
}

function bd(categorias = CATEGORIAS) {
  return crearBdFalsa((sql, valores) => {
    if (sql.includes('FROM categoria_producto')) return { rows: categorias };
    if (sql.includes('FROM producto_foto')) {
      const ids = valores[0] as string[];
      return {
        rows: FOTOS.filter(
          (foto) => ids.includes(foto.producto_id) && foto.moderacion === 'PUBLICADO',
        ),
      };
    }
    if (sql.includes('FROM producto p')) {
      const [categoriaId, nombre] = valores;
      const termino = nombre == null ? '' : normalizar(String(nombre));
      let filas = PRODUCTOS.filter(
        (producto) =>
          producto.activo === true &&
          producto.moderacion === 'PUBLICADO' &&
          producto.aliado_estado === 'ACTIVO' &&
          (categoriaId == null || producto.categoria_id === Number(categoriaId)) &&
          (!termino || normalizar(String(producto.nombre)).includes(termino)),
      );
      if (sql.includes('ORDER BY p.precio ASC')) {
        filas = [...filas].sort((a, b) => Number(a.precio) - Number(b.precio));
      } else if (sql.includes('ORDER BY p.precio DESC')) {
        filas = [...filas].sort((a, b) => Number(b.precio) - Number(a.precio));
      } else {
        filas = [...filas].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
      }
      return { rows: filas };
    }
    return { rows: [] };
  }, null);
}

describe('HU-045 · catálogo de productos por categoría y nombre', () => {
  it('lista categorías persistidas en orden de ID sin requerir sesión', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ComercioModule], db);
    const respuesta = await request(app.getHttpServer())
      .get('/api/productos/categorias')
      .expect(200);
    expect(respuesta.body).toEqual(CATEGORIAS);
    expect(consultas[0].sql).toContain('FROM categoria_producto ORDER BY id');
    await app.close();
  });

  it('devuelve arreglo vacío cuando no hay categorías', async () => {
    const app = await crearApp([ComercioModule], bd([]).db);
    await request(app.getHttpServer()).get('/api/productos/categorias').expect(200, []);
    await app.close();
  });

  it('conserva el catálogo completo, el contrato y los productos con stock cero', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ComercioModule], db);
    const respuesta = await request(app.getHttpServer()).get('/api/productos').expect(200);
    expect(respuesta.body).toHaveLength(3);
    const croquetas = respuesta.body.find(
      (producto: { nombre: string }) => producto.nombre === 'Croquetas Árbol   Norte',
    );
    expect(croquetas).toMatchObject({
      aliado: 'Tienda Demo',
      categoriaId: 1,
      categoria: 'Alimentos',
      stock: 0,
      fotos: ['https://example.test/croquetas-publicada.jpg'],
    });
    expect(consultas[0].sql).toContain(
      "p.activo AND p.moderacion = 'PUBLICADO' AND a.estado = 'ACTIVO'",
    );
    expect(consultas[0].valores).toEqual([null, null]);
    await app.close();
  });

  it('filtra solo por categoría y una categoría válida sin productos devuelve []', async () => {
    const { db } = bd();
    const app = await crearApp([ComercioModule], db);
    const categoria = await request(app.getHttpServer())
      .get('/api/productos?categoriaId=1')
      .expect(200);
    expect(categoria.body).toHaveLength(2);
    expect(
      categoria.body.every((producto: { categoriaId: number }) => producto.categoriaId === 1),
    ).toBe(true);
    await request(app.getHttpServer()).get('/api/productos?categoriaId=32767').expect(200, []);
    await app.close();
  });

  it('busca parcialmente por nombre ignorando mayúsculas, acentos y espacios redundantes', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ComercioModule], db);
    const respuesta = await request(app.getHttpServer())
      .get('/api/productos')
      .query({ nombre: '  croquetas   arbol  ' })
      .expect(200);
    expect(respuesta.body.map((producto: { id: string }) => producto.id)).toEqual([
      PRODUCTOS[0].id,
    ]);
    const consulta = consultas.find((c) => c.sql.includes('FROM producto p'));
    expect(consulta?.valores).toEqual([null, 'croquetas   arbol']);
    expect(consulta?.sql).toContain('public.unaccent');
    expect(consulta?.sql).toContain("'[[:space:]]+'");
    await app.close();
  });

  it('combina nombre y categoría con AND; el texto vacío equivale a filtro ausente', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ComercioModule], db);
    const combinado = await request(app.getHttpServer())
      .get('/api/productos?categoriaId=1&nombre=arbol')
      .expect(200);
    expect(combinado.body.map((producto: { id: string }) => producto.id)).toEqual([
      PRODUCTOS[0].id,
    ]);
    const sinCoincidencia = await request(app.getHttpServer())
      .get('/api/productos?categoriaId=2&nombre=arbol')
      .expect(200, []);
    expect(sinCoincidencia.body).toEqual([]);
    const soloCategoria = await request(app.getHttpServer())
      .get('/api/productos?categoriaId=1&nombre=%20%20%20')
      .expect(200);
    expect(soloCategoria.body).toHaveLength(2);
    expect(consultas[0].sql).toContain('p.categoria_id = $1');
    await app.close();
  });

  it('devuelve arreglo vacío si el nombre no coincide y trata el texto como dato SQL', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ComercioModule], db);
    await request(app.getHttpServer())
      .get('/api/productos')
      .query({ nombre: "' OR 1=1 --" })
      .expect(200, []);
    const consulta = consultas.find((c) => c.sql.includes('FROM producto p'));
    expect(consulta?.valores[1]).toBe("' OR 1=1 --");
    expect(consulta?.sql).not.toContain("' OR 1=1 --");
    await app.close();
  });

  it('conserva las opciones de orden junto con los filtros', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ComercioModule], db);
    const ascendente = await request(app.getHttpServer())
      .get('/api/productos?categoriaId=1&orden=precio_asc')
      .expect(200);
    expect(ascendente.body[0].precio).toBe(1000);
    expect(consultas[0].sql).toContain('ORDER BY p.precio ASC, p.nombre, p.id');
    await request(app.getHttpServer()).get('/api/productos?orden=precio_desc').expect(200);
    expect(consultas[2].sql).toContain('ORDER BY p.precio DESC, p.nombre, p.id');
    await app.close();
  });

  it.each([['abc'], ['0'], ['-1'], ['1.5'], ['32768']])(
    'rechaza categoriaId=%s con 400',
    async (categoriaId) => {
      const app = await crearApp([ComercioModule], bd().db);
      await request(app.getHttpServer())
        .get(`/api/productos?categoriaId=${categoriaId}`)
        .expect(400);
      await app.close();
    },
  );

  it('rechaza un orden no admitido con 400', async () => {
    const app = await crearApp([ComercioModule], bd().db);
    await request(app.getHttpServer()).get('/api/productos?orden=aleatorio').expect(400);
    await app.close();
  });

  it.each([
    ['/api/productos/categorias', 'FROM categoria_producto'],
    ['/api/productos', 'FROM producto p'],
  ])('responde 500 si falla la consulta de %s', async (ruta, consultaFallida) => {
    const db = crearBdFalsa((sql) => {
      if (sql.includes(consultaFallida)) throw new Error('fallo de base de datos');
      return { rows: [] };
    }, null).db;
    const app = await crearApp([ComercioModule], db);
    await request(app.getHttpServer()).get(ruta).expect(500);
    await app.close();
  });

  it('responde 500 si falla la consulta de fotos publicadas', async () => {
    const db = crearBdFalsa((sql) => {
      if (sql.includes('FROM producto p')) return { rows: PRODUCTOS.slice(0, 1) };
      if (sql.includes('FROM producto_foto')) throw new Error('fallo de base de datos');
      return { rows: [] };
    }, null).db;
    const app = await crearApp([ComercioModule], db);
    await request(app.getHttpServer()).get('/api/productos').expect(500);
    await app.close();
  });
});
