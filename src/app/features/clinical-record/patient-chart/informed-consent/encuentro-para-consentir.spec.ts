import { encuentroParaConsentir } from './encuentro-para-consentir';

describe('encuentroParaConsentir', () => {
  const citas = [
    { id: 'cerrada', etiqueta: 'Ayer', enCurso: false },
    { id: 'abierta', etiqueta: 'Hoy', enCurso: true },
  ];

  it('prefiere el encuentro del propio ítem', () => {
    expect(encuentroParaConsentir('del-item', 'contexto', citas)).toBe('del-item');
  });

  it('sin el del ítem, el del contexto; sin contexto, la cita en curso', () => {
    expect(encuentroParaConsentir(undefined, 'contexto', citas)).toBe('contexto');
    expect(encuentroParaConsentir(null, null, citas)).toBe('abierta');
  });

  it('una cita cerrada no se elige sola: sin atención abierta, null', () => {
    expect(encuentroParaConsentir(null, [citas[0]!])).toBeNull();
    expect(encuentroParaConsentir()).toBeNull();
  });
});
