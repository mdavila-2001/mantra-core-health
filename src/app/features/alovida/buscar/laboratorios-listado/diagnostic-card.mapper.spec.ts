import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';

import { toDiagnosticCard } from './diagnostic-card.mapper';

function laboratorio(extra: Partial<PublicSearchResult> = {}): PublicSearchResult {
  return {
    kind: 'DIAGNOSTIC_UNIT',
    slug: 'laboratorio-central',
    displayName: 'Laboratorio Central',
    headline: 'Análisis clínicos y resonancia',
    city: 'Cochabamba',
    avatarUrl: null,
    verified: true,
    ratingAverage: 4.1,
    ratingCount: 3,
    coverUrl: null,
    address: 'Calle Sucre 220',
    location: null,
    hasPublishedAgenda: true,
    nextAvailableDate: null,
    category: null,
    ...extra,
  };
}

describe('toDiagnosticCard', () => {
  it('enlaza a la ficha pública, `/l/:slug`', () => {
    expect(toDiagnosticCard(laboratorio()).profileLink).toBe('/l/laboratorio-central');
  });

  it('el turno encabeza la fila: a un laboratorio se va con fecha (AC-06-4)', () => {
    const { card } = toDiagnosticCard(laboratorio());

    expect(card.atributos[0]?.clave).toBe('turno');
  });

  it('sin agenda publicada no promete un turno que no existe (AC-06-19)', () => {
    const { card, details } = toDiagnosticCard(laboratorio({ hasPublishedAgenda: false }));

    expect(card.atributos.map((atributo) => atributo.clave)).not.toContain('turno');
    expect(details.map((fila) => fila.label)).not.toContain('Turnos');
  });

  it('lleva al desplegable lo que el centro publicó sobre su oferta', () => {
    const { details } = toDiagnosticCard(laboratorio());

    expect(details.find((fila) => fila.label === 'Qué ofrece')?.value).toBe(
      'Análisis clínicos y resonancia',
    );
  });

  it('sin imagen degrada al degradado del tema y las iniciales (AC-06-3)', () => {
    const { card } = toDiagnosticCard(laboratorio());

    expect(card.portada).toBeNull();
    expect(card.logo).toBeNull();
    expect(card.iniciales).toBe('LC');
  });
});
