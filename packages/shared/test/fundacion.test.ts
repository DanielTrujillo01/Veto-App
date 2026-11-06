import { describe, expect, it } from 'vitest';
import { registroFundacionSchema } from '../src';

const valido = {
  nombre: 'Fundación Huellas',
  ciudad: 'Cali',
  contacto: 'contacto@huellas.org',
  descripcion: 'Rescate y rehabilitación de animales abandonados',
  ubicacion: 'Calle 5 # 38-10',
  anioFundacion: 2015,
  celular: '3005556677',
  correo: 'fundacion@huellas.org',
  contrasena: 'password123',
};

function errores(datos: unknown): Record<string, string> {
  const r = registroFundacionSchema.safeParse(datos);
  if (r.success) return {};
  const campos: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const campo = issue.path.join('.');
    if (!(campo in campos)) campos[campo] = issue.message;
  }
  return campos;
}

describe('HU-078 · registro de fundación', () => {
  it('acepta los datos obligatorios; el logo y el representante son opcionales', () => {
    const r = registroFundacionSchema.parse(valido);
    expect(r.logoUrl).toBeUndefined();
    expect(r.representante).toBeUndefined();
    expect(r.anioFundacion).toBe(2015);
  });

  it('acepta el logo cuando viene y lo trata como ausente si llega vacío o null', () => {
    expect(
      registroFundacionSchema.parse({ ...valido, logoUrl: 'https://cdn.veto.co/logo.png' }).logoUrl,
    ).toBe('https://cdn.veto.co/logo.png');
    expect(registroFundacionSchema.parse({ ...valido, logoUrl: '' }).logoUrl).toBeUndefined();
    expect(registroFundacionSchema.parse({ ...valido, logoUrl: '  ' }).logoUrl).toBeUndefined();
    expect(registroFundacionSchema.parse({ ...valido, logoUrl: null }).logoUrl).toBeUndefined();
  });

  it('recorta espacios y acepta el año como texto de formulario', () => {
    const r = registroFundacionSchema.parse({
      ...valido,
      nombre: '  Fundación Huellas  ',
      ciudad: ' Cali ',
      anioFundacion: ' 2015 ',
      representante: ' Ana Pérez ',
    });
    expect(r.nombre).toBe('Fundación Huellas');
    expect(r.ciudad).toBe('Cali');
    expect(r.anioFundacion).toBe(2015);
    expect(r.representante).toBe('Ana Pérez');
  });

  it.each([
    ['nombre', 'El nombre de la fundación es obligatorio'],
    ['ciudad', 'La ciudad es obligatoria'],
    ['contacto', 'El contacto es obligatorio'],
    ['descripcion', 'La descripción es obligatoria'],
    ['ubicacion', 'La ubicación es obligatoria'],
    ['anioFundacion', 'El año de fundación es obligatorio'],
    ['celular', 'El celular es obligatorio'],
    ['correo', 'El correo es obligatorio'],
    ['contrasena', 'La contraseña es obligatoria'],
  ])('si falta %s dice «%s»', (campo, mensaje) => {
    const { [campo]: _quitado, ...resto } = valido as Record<string, unknown>;
    expect(errores(resto)).toEqual({ [campo]: mensaje });
  });

  it.each(['nombre', 'ciudad', 'contacto', 'descripcion', 'ubicacion'])(
    'un %s en blanco cuenta como faltante',
    (campo) => {
      expect(Object.keys(errores({ ...valido, [campo]: '   ' }))).toEqual([campo]);
    },
  );

  it('informa todos los campos con error a la vez, cada uno con su mensaje', () => {
    const e = errores({ ...valido, nombre: '', ciudad: '', anioFundacion: 1800, correo: 'x' });
    expect(Object.keys(e).sort()).toEqual(['anioFundacion', 'ciudad', 'correo', 'nombre']);
  });

  it.each([
    [1899, 'anterior a 1900'],
    [new Date().getFullYear() + 1, 'posterior al año actual'],
    [2015.5, 'número entero'],
    ['abc', 'debe ser un número'],
    [true, 'debe ser un número'],
  ])('rechaza el año %s', (anio, fragmento) => {
    expect(errores({ ...valido, anioFundacion: anio }).anioFundacion).toContain(fragmento);
  });

  it('acepta los extremos del año: 1900 y el año actual', () => {
    expect(registroFundacionSchema.safeParse({ ...valido, anioFundacion: 1900 }).success).toBe(
      true,
    );
    expect(
      registroFundacionSchema.safeParse({ ...valido, anioFundacion: new Date().getFullYear() })
        .success,
    ).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:image/png;base64,AAA', 'logo.png', 'ftp://x.co/a.png'])(
    'rechaza un logo que no es una URL http(s): %s',
    (logo) => {
      expect(errores({ ...valido, logoUrl: logo })).toHaveProperty('logoUrl');
    },
  );

  it('respeta los largos máximos', () => {
    expect(errores({ ...valido, nombre: 'n'.repeat(161) })).toHaveProperty('nombre');
    expect(errores({ ...valido, ciudad: 'c'.repeat(121) })).toHaveProperty('ciudad');
    expect(errores({ ...valido, contacto: 'c'.repeat(161) })).toHaveProperty('contacto');
    expect(errores({ ...valido, ubicacion: 'u'.repeat(251) })).toHaveProperty('ubicacion');
    expect(errores({ ...valido, descripcion: 'd'.repeat(2001) })).toHaveProperty('descripcion');
    expect(errores({ ...valido, representante: 'r'.repeat(121) })).toHaveProperty('representante');
  });

  it('ignora el tipo y el estado: no se pueden elegir al registrarse', () => {
    const r = registroFundacionSchema.parse({ ...valido, tipo: 'CLINICA', estado: 'ACTIVO' });
    expect(r).not.toHaveProperty('tipo');
    expect(r).not.toHaveProperty('estado');
  });
});
