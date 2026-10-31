import { describe, expect, it } from 'vitest';

import { estadosElegibles, motivoValido, pideMotivo, textoAfectados } from './error-rows';

describe('error-rows', () => {
  it('desde un estado se ofrece cualquiera menos el actual', () => {
    expect(estadosElegibles('NEW')).toEqual(['SEEN', 'RESOLVED', 'IGNORED']);
    expect(estadosElegibles('RESOLVED')).toEqual(['NEW', 'SEEN', 'IGNORED']);
  });

  it('resolver o ignorar piden motivo de al menos 3 caracteres útiles; ver no lo pide', () => {
    expect(pideMotivo('RESOLVED')).toBe(true);
    expect(pideMotivo('IGNORED')).toBe(true);
    expect(pideMotivo('SEEN')).toBe(false);
    expect(motivoValido('SEEN', '')).toBe(true);
    expect(motivoValido('RESOLVED', '')).toBe(false);
    expect(motivoValido('RESOLVED', '  ab ')).toBe(false);
    expect(motivoValido('IGNORED', 'ruido')).toBe(true);
  });

  it('personas afectadas: null no es 0, y dice por qué no se mide', () => {
    expect(textoAfectados({ affectedActors24h: 12, affectedActors24hReason: null })).toBe('12');
    expect(textoAfectados({ affectedActors24h: null, affectedActors24hReason: 'MUESTRA_INSUFICIENTE' })).toBe('Muestra insuficiente');
    expect(textoAfectados({ affectedActors24h: null, affectedActors24hReason: 'ACTOR_HASH_NOT_AVAILABLE' })).toBe('No se mide');
  });
});
