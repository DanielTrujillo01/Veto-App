import { describe, expect, it } from 'vitest';
import { filtrarProductosGestionSchema, guardarProductoSchema, MAX_FOTOS_PRODUCTO } from '../src';

const valido = {
  nombre: ' Concentrado gato 2 kg ',
  categoriaId: 1,
  precio: 45_000,
  stock: 10,
  descripcion: ' Para gatos adultos.\nSabor pollo. ',
  fotos: ['https://i.postimg.cc/a.jpg', 'https://i.postimg.cc/b.jpg', 'https://x.co/c.png'],
};

function errorDe(datos: unknown) {
  const r = guardarProductoSchema.safeParse(datos);
  if (r.success) return undefined;
  // Como la API (validar): el primer mensaje de cada campo.
  const errores: Record<string, string> = {};
  for (const i of r.error.issues) errores[i.path.join('.')] ??= i.message;
  return errores;
}

describe('HU-044 · validar producto', () => {
  it('acepta un producto válido, quita espacios exteriores y conserva el orden de las fotos', () => {
    const datos = guardarProductoSchema.parse(valido);
    expect(datos.nombre).toBe('Concentrado gato 2 kg');
    expect(datos.descripcion).toBe('Para gatos adultos.\nSabor pollo.');
    expect(datos.fotos[0]).toBe('https://i.postimg.cc/a.jpg');
  });

  it('descripción y fotos son opcionales; una descripción vacía no se guarda', () => {
    const datos = guardarProductoSchema.parse({ ...valido, descripcion: '   ', fotos: undefined });
    expect(datos.descripcion).toBeUndefined();
    expect(datos.fotos).toEqual([]);
  });

  it.each([
    [{ precio: 0 }, 'precio', 'El precio debe ser mayor que 0'],
    [{ precio: 1500.5 }, 'precio', 'El precio va en pesos, sin decimales'],
    [{ stock: -1 }, 'stock', 'El stock no puede ser negativo'],
    [{ stock: 2.5 }, 'stock', 'El stock debe ser un número entero'],
    [{ nombre: '  ' }, 'nombre', 'El nombre es obligatorio'],
    [{ nombre: 'A' }, 'nombre', 'El nombre debe tener al menos 2 caracteres'],
    [{ categoriaId: undefined }, 'categoriaId', 'La categoría es obligatoria'],
    [{ descripcion: 'x'.repeat(2001) }, 'descripcion', expect.stringContaining('2000')],
  ])('rechaza %j con error en %s', (cambio, campo, mensaje) => {
    expect(errorDe({ ...valido, ...cambio })?.[campo]).toEqual(mensaje);
  });

  it('cuenta tildes y emojis como un carácter', () => {
    expect(errorDe({ ...valido, nombre: 'ñ'.repeat(120) })).toBeUndefined();
    expect(errorDe({ ...valido, descripcion: '🐶'.repeat(2000) })).toBeUndefined();
  });

  it('acepta hasta 5 fotos, sin repetidas y solo enlaces web', () => {
    const fotos = Array.from({ length: MAX_FOTOS_PRODUCTO + 1 }, (_, i) => `https://x.co/${i}.jpg`);
    expect(errorDe({ ...valido, fotos })?.fotos).toBe('Máximo 5 fotos');
    expect(errorDe({ ...valido, fotos: ['https://x.co/a.jpg', 'https://x.co/a.jpg'] })?.fotos).toBe(
      'Hay fotos repetidas',
    );
    expect(errorDe({ ...valido, fotos: ['javascript:alert(1)'] })?.['fotos.0']).toBeDefined();
  });
});

describe('HU-044 · filtros de la lista del panel', () => {
  it('por defecto muestra todos y sin texto', () => {
    expect(filtrarProductosGestionSchema.parse({})).toEqual({ q: undefined, estado: 'todos' });
  });

  it('un estado inválido en la URL se ignora', () => {
    expect(filtrarProductosGestionSchema.parse({ estado: 'borrados', q: ' gato ' })).toEqual({
      q: 'gato',
      estado: 'todos',
    });
  });
});
