import { splitUpcomingAndPast, type TimedItem } from './upcoming-and-past';

interface Cita extends TimedItem {
  readonly id: string;
}

const NOW = new Date('2026-09-18T10:00:00-04:00');

function cita(id: string, inicio: string | null, fin: string | null = null): Cita {
  return {
    id,
    cuando: inicio === null ? null : new Date(inicio),
    hasta: fin === null ? null : new Date(fin),
  };
}

function ids(lista: readonly Cita[]): string[] {
  return lista.map((c) => c.id);
}

describe('splitUpcomingAndPast', () => {
  it('pone las próximas primero de la más cercana a la más lejana', () => {
    const { upcoming } = splitUpcomingAndPast(
      [
        cita('lejana', '2026-10-01T09:00:00-04:00'),
        cita('cercana', '2026-09-18T15:00:00-04:00'),
        cita('media', '2026-09-20T09:00:00-04:00'),
      ],
      NOW,
    );
    expect(ids(upcoming)).toEqual(['cercana', 'media', 'lejana']);
  });

  it('ordena las anteriores de la más reciente a la más vieja', () => {
    // Es el orden del servidor (ascendente) el que enterraba la próxima (H-04).
    const { past } = splitUpcomingAndPast(
      [
        cita('agosto', '2026-08-27T08:00:00-04:00', '2026-08-27T08:30:00-04:00'),
        cita('septiembre', '2026-09-09T15:00:00-04:00', '2026-09-09T15:20:00-04:00'),
        cita('ayer', '2026-09-17T16:30:00-04:00', '2026-09-17T17:00:00-04:00'),
      ],
      NOW,
    );
    expect(ids(past)).toEqual(['ayer', 'septiembre', 'agosto']);
  });

  it('una consulta en curso sigue siendo próxima', () => {
    const { upcoming, past } = splitUpcomingAndPast(
      [cita('en-curso', '2026-09-18T09:30:00-04:00', '2026-09-18T10:30:00-04:00')],
      NOW,
    );
    expect(ids(upcoming)).toEqual(['en-curso']);
    expect(past).toEqual([]);
  });

  it('sin fin, decide por el inicio', () => {
    const { upcoming, past } = splitUpcomingAndPast(
      [cita('antes', '2026-09-18T09:59:00-04:00'), cita('despues', '2026-09-18T10:01:00-04:00')],
      NOW,
    );
    expect(ids(upcoming)).toEqual(['despues']);
    expect(ids(past)).toEqual(['antes']);
  });

  it('la cita sin horario va con las próximas, al final', () => {
    const { upcoming, past } = splitUpcomingAndPast(
      [cita('sin-horario', null), cita('manana', '2026-09-19T09:00:00-04:00')],
      NOW,
    );
    expect(ids(upcoming)).toEqual(['manana', 'sin-horario']);
    expect(past).toEqual([]);
  });

  it('no pierde ni duplica citas y no muta la entrada', () => {
    const entrada = [
      cita('a', '2026-08-01T09:00:00-04:00'),
      cita('b', null),
      cita('c', '2026-12-01T09:00:00-04:00'),
    ];
    const copia = [...entrada];
    const { upcoming, past } = splitUpcomingAndPast(entrada, NOW);
    expect([...ids(upcoming), ...ids(past)].sort()).toEqual(['a', 'b', 'c']);
    expect(entrada).toEqual(copia);
  });

  it('respeta el orden de llegada ante el mismo inicio', () => {
    const { upcoming } = splitUpcomingAndPast(
      [cita('primera', '2026-09-19T09:00:00-04:00'), cita('segunda', '2026-09-19T09:00:00-04:00')],
      NOW,
    );
    expect(ids(upcoming)).toEqual(['primera', 'segunda']);
  });
});
