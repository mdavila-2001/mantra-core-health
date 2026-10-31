import { consentEncounter } from './consent-encounter';

describe('consentEncounter', () => {
  const appointments = [
    { id: 'cerrada', etiqueta: 'Ayer', enCurso: false },
    { id: 'abierta', etiqueta: 'Hoy', enCurso: true },
  ];

  it('prefiere el encuentro del propio ítem', () => {
    expect(consentEncounter('del-item', 'contexto', appointments)).toBe('del-item');
  });

  it('sin el del ítem, el del contexto; sin contexto, la cita en curso', () => {
    expect(consentEncounter(undefined, 'contexto', appointments)).toBe('contexto');
    expect(consentEncounter(null, null, appointments)).toBe('abierta');
  });

  it('una cita cerrada no se elige sola: sin atención abierta, null', () => {
    expect(consentEncounter(null, [appointments[0]!])).toBeNull();
    expect(consentEncounter()).toBeNull();
  });
});
