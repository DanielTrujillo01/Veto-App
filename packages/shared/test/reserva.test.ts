import { describe, expect, it } from 'vitest';
import {
  MOTIVO_CITA_MAX_CARACTERES,
  caracteresRestantesDelMotivo,
  completarReservaSchema,
  contarCaracteres,
  motivoCitaSchema,
} from '../src';

const MASCOTA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('HU-030 · motivoCitaSchema', () => {
  it('el límite es de 500 caracteres', () => {
    expect(MOTIVO_CITA_MAX_CARACTERES).toBe(500);
  });

  it('acepta texto libre y recorta los espacios de las puntas', () => {
    expect(motivoCitaSchema.parse('  Vómito y decaimiento desde ayer  ')).toBe(
      'Vómito y decaimiento desde ayer',
    );
  });

  it('acepta justo el límite y rechaza un carácter más con el número escrito', () => {
    expect(motivoCitaSchema.parse('a'.repeat(500))).toHaveLength(500);
    const r = motivoCitaSchema.safeParse('a'.repeat(501));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        'El motivo admite máximo 500 caracteres (escribiste 501)',
      );
    }
  });

  it('el aviso dice cuántos caracteres escribió la persona', () => {
    const r = motivoCitaSchema.safeParse('b'.repeat(742));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain('(escribiste 742)');
  });

  it('los espacios de las puntas no cuentan para el límite', () => {
    expect(motivoCitaSchema.parse(` ${'a'.repeat(500)} `)).toHaveLength(500);
  });

  it('cuenta caracteres como los ve la persona: un emoji es uno', () => {
    expect(contarCaracteres('😀')).toBe(1);
    expect(contarCaracteres('á')).toBe(1);
    expect(motivoCitaSchema.parse('😀'.repeat(500))).toBe('😀'.repeat(500));
    expect(motivoCitaSchema.safeParse('😀'.repeat(501)).success).toBe(false);
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '    '],
    ['solo saltos de línea', '\n\r\n'],
  ])('un texto %s significa sin motivo (null)', (_caso, texto) => {
    expect(motivoCitaSchema.parse(texto)).toBeNull();
  });

  it('normaliza los saltos de línea de Windows y conserva los demás', () => {
    expect(motivoCitaSchema.parse('línea 1\r\nlínea 2\rlínea 3\nlínea 4')).toBe(
      'línea 1\nlínea 2\nlínea 3\nlínea 4',
    );
  });

  it('acepta tabulaciones y símbolos, pero no caracteres de control como el nulo', () => {
    expect(motivoCitaSchema.parse('¿Dolor?\tSí / no — "a veces"')).toBe(
      '¿Dolor?\tSí / no — "a veces"',
    );
    expect(motivoCitaSchema.safeParse('hola\u0000mundo').success).toBe(false);
    expect(motivoCitaSchema.safeParse('hola\u0007mundo').success).toBe(false);
  });

  it.each([[123], [true], [{}], [['a']], [undefined]])('rechaza %j (no es texto)', (valor) => {
    expect(motivoCitaSchema.safeParse(valor).success).toBe(false);
  });
});

describe('HU-030 · contador de caracteres', () => {
  it('dice cuántos caracteres le quedan al motivo', () => {
    expect(caracteresRestantesDelMotivo('')).toBe(500);
    expect(caracteresRestantesDelMotivo('hola')).toBe(496);
    expect(caracteresRestantesDelMotivo('a'.repeat(500))).toBe(0);
  });

  it('nunca es negativo, aunque el texto se pase', () => {
    expect(caracteresRestantesDelMotivo('a'.repeat(600))).toBe(0);
  });
});

describe('HU-030 y HU-031 · completarReservaSchema', () => {
  it('acepta la mascota, el motivo o ambos', () => {
    expect(completarReservaSchema.parse({ mascotaId: MASCOTA })).toEqual({ mascotaId: MASCOTA });
    expect(completarReservaSchema.parse({ motivo: ' Control ' })).toEqual({ motivo: 'Control' });
    expect(completarReservaSchema.parse({ mascotaId: MASCOTA, motivo: 'Vacuna' })).toEqual({
      mascotaId: MASCOTA,
      motivo: 'Vacuna',
    });
  });

  it('un motivo null o vacío quita el motivo (pero sigue siendo un cambio válido)', () => {
    expect(completarReservaSchema.parse({ motivo: null })).toEqual({ motivo: null });
    expect(completarReservaSchema.parse({ motivo: '   ' })).toEqual({ motivo: null });
  });

  it('exige indicar al menos la mascota o el motivo', () => {
    const r = completarReservaSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success)
      expect(r.error.issues[0].message).toBe('Indica la mascota o el motivo de la cita');
  });

  it.each([
    ['mascota que no es un id', { mascotaId: 'firulais' }, 'mascotaId'],
    ['mascota nula', { mascotaId: null }, 'mascotaId'],
    ['motivo demasiado largo', { motivo: 'a'.repeat(501) }, 'motivo'],
    ['motivo que no es texto', { motivo: 7 }, 'motivo'],
  ])('rechaza %s', (_caso, cuerpo, campo) => {
    const r = completarReservaSchema.safeParse(cuerpo);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain(campo);
  });

  it('ignora lo que no le corresponde (el estado o el precio no se piden al cliente)', () => {
    const r = completarReservaSchema.parse({ motivo: 'x', estado: 'FINALIZADA', precio: 1 });
    expect(r).toEqual({ motivo: 'x' });
  });
});
