import { isWaitingForSlots, summarizeDay } from './day-summary';

describe('summarizeDay', () => {
  const LOADING = 'Cargando los horarios de este día…';

  it('says the read failed when the day is not waiting for its slots', () => {
    const failed = 'No se pudieron cargar las citas de este día.';
    expect(summarizeDay('error', [], null)).toBe(failed);
    expect(summarizeDay('error', ['sin-cargar'], null)).toBe(failed);
  });

  it('while loading with no blocks says it is loading, not "No atiende"', () => {
    expect(summarizeDay('loading', [], null)).toBe(LOADING);
  });

  it('while loading with only visits, busy stretches or nothing from the slots, says loading', () => {
    expect(summarizeDay('loading', ['visita'], null)).toBe(LOADING);
    expect(summarizeDay('loading', ['ocupado'], null)).toBe(LOADING);
    expect(summarizeDay('loading', ['aire'], null)).toBe(LOADING);
  });

  it('while loading with slots already drawn (same-day reload) counts what is there', () => {
    expect(summarizeDay('loading', ['cita', 'libre'], null)).toBe('1 de 2 horarios reservados.');
    expect(summarizeDay('loading', ['libre'], null)).toBe('1 horarios publicados, ninguno reservado.');
  });

  it('when ready and empty says "No atiende este día" or the flexible range', () => {
    expect(summarizeDay('ready', [], null)).toBe('No atiende este día.');
    expect(summarizeDay('ready', [], '09:00 a 13:00')).toBe(
      'Horario flexible de 09:00 a 13:00: sin citas pedidas todavía.',
    );
  });

  it('adds up slots and busy stretches', () => {
    expect(summarizeDay('ready', ['libre', 'ocupado', 'ocupado'], null)).toBe(
      '1 horarios publicados, ninguno reservado · 2 ratos ocupados.',
    );
  });
});

describe('isWaitingForSlots', () => {
  it('is only true while loading and without blocks that come from the slots', () => {
    expect(isWaitingForSlots('loading', [])).toBe(true);
    expect(isWaitingForSlots('loading', ['visita', 'ocupado'])).toBe(true);
    expect(isWaitingForSlots('loading', ['sin-cargar'])).toBe(false);
    expect(isWaitingForSlots('ready', [])).toBe(false);
    expect(isWaitingForSlots('error', [])).toBe(false);
  });
});
