import { describe, expect, it } from 'vitest';
import {
  OBSERVACION_CITA_MAX_CARACTERES,
  RECOMENDACIONES_MAX_CARACTERES,
  finalizarCitaSchema,
  noAsistioCitaSchema,
  observacionCitaSchema,
  recomendacionesCitaSchema,
} from '../src';

describe('HU-032 · observacionCitaSchema', () => {
  it('el límite es de 500 caracteres', () => {
    expect(OBSERVACION_CITA_MAX_CARACTERES).toBe(500);
  });

  it('recorta los espacios de las puntas y toma el texto vacío como ausente', () => {
    expect(observacionCitaSchema.parse('  Atención realizada.  ')).toBe('Atención realizada.');
    expect(observacionCitaSchema.parse('   ')).toBeNull();
  });

  it('acepta justo el límite y rechaza uno más diciendo cuántos escribió', () => {
    expect(observacionCitaSchema.parse('a'.repeat(500))).toHaveLength(500);
    const r = observacionCitaSchema.safeParse('a'.repeat(501));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        'La observación admite máximo 500 caracteres (escribiste 501)',
      );
    }
  });

  it('rechaza lo que no es texto y los caracteres de control', () => {
    expect(observacionCitaSchema.safeParse(5).success).toBe(false);
    const nulo = observacionCitaSchema.safeParse('a\u0000b');
    expect(nulo.success).toBe(false);
    if (!nulo.success) {
      expect(nulo.error.issues[0].message).toBe(
        'La observación tiene caracteres que no se permiten',
      );
    }
  });
});

describe('HU-033 · recomendacionesCitaSchema', () => {
  it('el límite es de 2000 caracteres', () => {
    expect(RECOMENDACIONES_MAX_CARACTERES).toBe(2000);
  });

  it('acepta texto largo con saltos de línea', () => {
    const texto = 'Reposo por 3 días.\r\nDieta blanda.\r\nControl en una semana.';
    expect(recomendacionesCitaSchema.parse(texto)).toBe(
      'Reposo por 3 días.\nDieta blanda.\nControl en una semana.',
    );
  });

  it('acepta justo el límite y rechaza uno más con el aviso y el número', () => {
    expect(recomendacionesCitaSchema.parse('a'.repeat(2000))).toHaveLength(2000);
    const r = recomendacionesCitaSchema.safeParse('a'.repeat(2001));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        'Las recomendaciones admiten máximo 2000 caracteres (escribiste 2001)',
      );
    }
  });

  it('cuenta caracteres, no unidades: 2000 emojis caben', () => {
    expect(recomendacionesCitaSchema.safeParse('🐶'.repeat(2000)).success).toBe(true);
    expect(recomendacionesCitaSchema.safeParse('🐶'.repeat(2001)).success).toBe(false);
  });

  it('vacías significan sin recomendaciones', () => {
    expect(recomendacionesCitaSchema.parse('')).toBeNull();
  });
});

describe('HU-032 y HU-033 · cuerpos de finalizar y no-asistio', () => {
  it('finalizar acepta un cuerpo vacío', () => {
    expect(finalizarCitaSchema.parse({})).toEqual({});
  });

  it('finalizar acepta recomendaciones', () => {
    expect(finalizarCitaSchema.parse({ recomendaciones: ' Reposo ' })).toEqual({
      recomendaciones: 'Reposo',
    });
  });

  it('finalizar no lleva observación: si llega, se ignora', () => {
    expect(
      finalizarCitaSchema.parse({ observacion: 'Todo bien', recomendaciones: 'Reposo' }),
    ).toEqual({
      recomendaciones: 'Reposo',
    });
    expect(finalizarCitaSchema.parse({ observacion: 'a'.repeat(900) })).toEqual({});
  });

  it('finalizar toma null y vacío como ausentes', () => {
    expect(finalizarCitaSchema.parse({ recomendaciones: '' })).toEqual({ recomendaciones: null });
    expect(finalizarCitaSchema.parse({ recomendaciones: null })).toEqual({ recomendaciones: null });
  });

  it.each([
    ['recomendaciones demasiado largas', { recomendaciones: 'a'.repeat(2001) }],
    ['recomendaciones que no son texto', { recomendaciones: 5 }],
  ])('finalizar rechaza %s', (_caso, cuerpo) => {
    const r = finalizarCitaSchema.safeParse(cuerpo);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain('recomendaciones');
  });

  it('no-asistio acepta un cuerpo vacío o con observación y no lleva recomendaciones', () => {
    expect(noAsistioCitaSchema.parse({})).toEqual({});
    expect(noAsistioCitaSchema.parse({ observacion: 'No se presentó' })).toEqual({
      observacion: 'No se presentó',
    });
    expect(noAsistioCitaSchema.parse({ observacion: 'x', recomendaciones: 'y' })).toEqual({
      observacion: 'x',
    });
  });

  it('no-asistio rechaza una observación demasiado larga', () => {
    expect(noAsistioCitaSchema.safeParse({ observacion: 'a'.repeat(501) }).success).toBe(false);
  });
});
