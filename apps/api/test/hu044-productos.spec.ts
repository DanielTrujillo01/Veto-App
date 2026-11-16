import request from 'supertest';
import { PG } from '../src/common/validacion';
import { ComercioModule } from '../src/modules/comercio/comercio.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa, errorPg, type Fila } from './utilidades';

const TIENDA_ID = '44444444-4444-4444-8444-444444444444';
const PRODUCTO_ID = '55555555-5555-4555-8555-555555555555';
const PRODUCTO_AJENO_ID = '66666666-6666-4666-8666-666666666666';

const datos = {
  nombre: 'Concentrado gato 2 kg',
  categoriaId: 1,
  precio: 45_000,
  stock: 10,
  descripcion: 'Para gatos adultos.',
  fotos: ['https://i.postimg.cc/a.jpg', 'https://i.postimg.cc/b.jpg', 'https://x.co/c.png'],
};

type Escenario = {
  tipo?: string;
  estado?: string;
  dueno?: string;
  productos?: Fila[];
  errorAlGuardar?: Error;
};

const filaProducto = (extra: Fila = {}): Fila => ({
  id: PRODUCTO_ID,
  aliado_id: TIENDA_ID,
  categoria_id: 1,
  categoria: 'Alimentos',
  nombre: 'Concentrado gato 2 kg',
  descripcion: null,
  precio: '45000',
  stock: 10,
  fotos: ['https://i.postimg.cc/a.jpg'],
  activo: true,
  moderacion: 'PUBLICADO',
  creado_en: '2026-11-16T10:00:00Z',
  ...extra,
});

/** Base simulada con los productos de la tienda en memoria. */
function bd(e: Escenario = {}, usuario = ALIADO) {
  const productos = e.productos ?? [filaProducto()];
  return crearBdFalsa((sql, valores) => {
    if (sql.includes('FROM aliado a JOIN usuario u')) {
      return {
        rows: [
          {
            tipo: e.tipo ?? 'TIENDA',
            estado: e.estado ?? 'ACTIVO',
            usuario_id: e.dueno ?? ALIADO.id,
            rol: 'ALIADO',
            estado_cuenta: 'ACTIVA',
          },
        ],
      };
    }
    if (sql.includes('FROM categoria_producto ORDER BY')) {
      return {
        rows: [
          { id: 2, nombre: 'Accesorios' },
          { id: 1, nombre: 'Alimentos' },
        ],
      };
    }
    if (sql.includes('INSERT INTO producto ')) {
      if (e.errorAlGuardar) throw e.errorAlGuardar;
      productos.push(filaProducto({ nombre: valores[2], activo: true }));
      return { rows: [{ id: PRODUCTO_ID }] };
    }
    if (sql.includes('UPDATE producto SET activo')) {
      const p = productos.find((x) => x.id === valores[0] && x.aliado_id === valores[1]);
      if (p) p.activo = valores[2];
      return { rows: [] };
    }
    if (sql.includes('UPDATE producto')) {
      if (e.errorAlGuardar) throw e.errorAlGuardar;
      const p = productos.find((x) => x.id === valores[0] && x.aliado_id === valores[1]);
      if (p) Object.assign(p, { nombre: valores[3], precio: valores[5], stock: valores[6] });
      return { rows: [] };
    }
    if (sql.includes('FROM producto WHERE id = $1 AND aliado_id = $2 FOR UPDATE')) {
      return { rows: productos.filter((x) => x.id === valores[0] && x.aliado_id === valores[1]) };
    }
    if (sql.includes('WHERE p.id = $1 AND p.aliado_id = $2')) {
      return { rows: productos.filter((x) => x.id === valores[0] && x.aliado_id === valores[1]) };
    }
    if (sql.includes('WHERE p.aliado_id = $1')) {
      return { rows: productos.filter((x) => x.aliado_id === valores[0]) };
    }
    return undefined;
  }, usuario);
}

const base = `/api/aliados/${TIENDA_ID}/productos`;

describe('HU-044 · crear, editar y desactivar productos', () => {
  it('categorías públicas para el formulario y la tienda', async () => {
    const { db } = bd({}, TUTOR);
    const app = await crearApp([ComercioModule], db);
    const res = await request(app.getHttpServer()).get('/api/productos/categorias').expect(200);
    expect(res.body).toEqual([
      { id: 2, nombre: 'Accesorios' },
      { id: 1, nombre: 'Alimentos' },
    ]);
    await app.close();
  });

  it('crea un producto válido con 3 fotos, activo y con la primera como portada', async () => {
    const { db, consultas } = bd({ productos: [] });
    const app = await crearApp([ComercioModule], db);
    const res = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send(datos)
      .expect(201);

    expect(res.body).toMatchObject({ id: PRODUCTO_ID, activo: true, precio: 45000 });
    const fotos = consultas.filter((c) => c.sql.includes('INSERT INTO producto_foto'));
    expect(fotos.map((c) => c.valores.slice(1))).toEqual([
      ['https://i.postimg.cc/a.jpg', 1],
      ['https://i.postimg.cc/b.jpg', 2],
      ['https://x.co/c.png', 3],
    ]);
    // Toda la escritura va en la transacción del usuario (auditoría por app.usuario_id).
    expect(consultas.find((c) => c.sql.includes('INSERT INTO producto '))?.usuarioTx).toBe(
      ALIADO.id,
    );
    await app.close();
  });

  it.each([
    [{ precio: 0 }, 'precio'],
    [{ stock: -1 }, 'stock'],
    [{ stock: 1.5 }, 'stock'],
    [{ nombre: '' }, 'nombre'],
  ])('rechaza %j con error junto al campo y no guarda', async (cambio, campo) => {
    const { db, consultas } = bd();
    const app = await crearApp([ComercioModule], db);
    const res = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send({ ...datos, ...cambio })
      .expect(400);
    expect(res.body.errores).toHaveProperty(campo);
    expect(consultas.some((c) => c.sql.includes('INSERT INTO producto'))).toBe(false);
    await app.close();
  });

  it('una categoría inexistente se informa en su campo', async () => {
    const { db } = bd({ errorAlGuardar: errorPg(PG.LLAVE_FORANEA) });
    const app = await crearApp([ComercioModule], db);
    const res = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send({ ...datos, categoriaId: 99 })
      .expect(400);
    expect(res.body.errores).toEqual({ categoriaId: 'La categoría no existe' });
    await app.close();
  });

  it('edita precio y stock; las fotos enviadas reemplazan a las anteriores', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ComercioModule], db);
    const res = await request(app.getHttpServer())
      .put(`${base}/${PRODUCTO_ID}`)
      .set('Cookie', COOKIE)
      .send({ ...datos, precio: 50_000, stock: 3, fotos: ['https://x.co/nueva.jpg'] })
      .expect(200);
    expect(res.body).toMatchObject({ precio: 50000, stock: 3 });
    const borrado = consultas.findIndex((c) => c.sql.includes('DELETE FROM producto_foto'));
    const insercion = consultas.findIndex((c) => c.sql.includes('INSERT INTO producto_foto'));
    expect(borrado).toBeGreaterThan(-1);
    expect(insercion).toBeGreaterThan(borrado);
    // Los pedidos guardan su propio precio_unitario: editar no los toca.
    expect(consultas.some((c) => c.sql.includes('pedido'))).toBe(false);
    await app.close();
  });

  it('desactiva y reactiva; un producto inactivo se puede editar', async () => {
    const { db } = bd();
    const app = await crearApp([ComercioModule], db);
    const servidor = app.getHttpServer();
    const des = await request(servidor)
      .patch(`${base}/${PRODUCTO_ID}/desactivar`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(des.body.activo).toBe(false);

    await request(servidor)
      .put(`${base}/${PRODUCTO_ID}`)
      .set('Cookie', COOKIE)
      .send(datos)
      .expect(200);

    const act = await request(servidor)
      .patch(`${base}/${PRODUCTO_ID}/activar`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(act.body.activo).toBe(true);
    await app.close();
  });

  it('lista del panel: muestra si moderación lo ocultó y pasa búsqueda y estado a la consulta', async () => {
    const { db, consultas } = bd({ productos: [filaProducto({ moderacion: 'OCULTO' })] });
    const app = await crearApp([ComercioModule], db);
    const res = await request(app.getHttpServer())
      .get(`${base}?q=Gato%25&estado=inactivos`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(res.body[0]).toMatchObject({
      ocultoPorVeto: true,
      fotos: ['https://i.postimg.cc/a.jpg'],
    });
    const lista = consultas.find((c) => c.sql.includes('WHERE p.aliado_id = $1'));
    expect(lista?.sql).toContain('NOT p.activo');
    expect(lista?.sql).toContain('ORDER BY p.creado_en DESC');
    expect(lista?.valores).toEqual([TIENDA_ID, '%Gato\\%%']);
    await app.close();
  });

  it('un producto de otra tienda responde "no encontrado"', async () => {
    const { db } = bd({ productos: [filaProducto({ id: PRODUCTO_AJENO_ID, aliado_id: 'otra' })] });
    const app = await crearApp([ComercioModule], db);
    const servidor = app.getHttpServer();
    await request(servidor).get(`${base}/${PRODUCTO_AJENO_ID}`).set('Cookie', COOKIE).expect(404);
    await request(servidor)
      .put(`${base}/${PRODUCTO_AJENO_ID}`)
      .set('Cookie', COOKIE)
      .send(datos)
      .expect(404);
    await request(servidor)
      .patch(`${base}/${PRODUCTO_AJENO_ID}/desactivar`)
      .set('Cookie', COOKIE)
      .expect(404);
    await app.close();
  });

  it.each([
    ['una clínica', { tipo: 'CLINICA' }],
    ['el administrador de otra tienda', { dueno: 'otro-usuario' }],
    ['una tienda suspendida', { estado: 'SUSPENDIDO' }],
  ])('%s no puede crear productos', async (_, escenario) => {
    const { db, consultas } = bd(escenario);
    const app = await crearApp([ComercioModule], db);
    await request(app.getHttpServer()).post(base).set('Cookie', COOKIE).send(datos).expect(403);
    expect(consultas.some((c) => c.sql.includes('INSERT INTO producto'))).toBe(false);
    await app.close();
  });

  it('sin sesión o con rol tutor no se gestiona nada', async () => {
    const sinSesion = bd({}, null as never);
    let app = await crearApp([ComercioModule], sinSesion.db);
    await request(app.getHttpServer()).get(base).expect(401);
    await app.close();

    const tutor = bd({}, TUTOR);
    app = await crearApp([ComercioModule], tutor.db);
    await request(app.getHttpServer()).get(base).set('Cookie', COOKIE).expect(403);
    await app.close();
  });
});
