import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';

import { toInsurerCard } from './insurer-card.mapper';

function aseguradora(extra: Partial<PublicSearchResult> = {}): PublicSearchResult {
  return {
    kind: 'INSURER',
    slug: 'nacional-seguros',
    displayName: 'Nacional Seguros',
    headline: 'Seguros de salud y vida',
    city: 'Santa Cruz de la Sierra',
    avatarUrl: null,
    verified: false,
    ratingAverage: null,
    ratingCount: 0,
    coverUrl: null,
    address: 'Av. Cristo Redentor 100',
    location: null,
    // Una aseguradora no da turnos. Si el índice llegara a devolver esto en
    // `true`, la tarjeta **no** debe pintarlo.
    hasPublishedAgenda: true,
    nextAvailableDate: '2026-09-10',
    ...extra,
  };
}

describe('toInsurerCard', () => {
  it('enlaza a la ficha pública, `/s/:slug`', () => {
    expect(toInsurerCard(aseguradora()).profileLink).toBe('/s/nacional-seguros');
  });

  it('NUNCA muestra turno: una aseguradora no da citas (AC-06-4)', () => {
    const { card } = toInsurerCard(aseguradora());

    expect(card.atributos.map((atributo) => atributo.clave)).not.toContain('turno');
  });

  it('el dato del vertical es el ramo que la ficha publicó', () => {
    const { card } = toInsurerCard(aseguradora());

    const ramo = card.atributos.find((atributo) => atributo.clave === 'ramo');
    expect(ramo?.texto).toBe('Seguros de salud y vida');
  });

  it('sin ramo publicado no inventa uno (AC-06-19)', () => {
    const { card } = toInsurerCard(aseguradora({ headline: null }));

    expect(card.atributos.map((atributo) => atributo.clave)).not.toContain('ramo');
    expect(card.titular).toBeNull();
  });

  it('sin logo degrada a las iniciales, no a un logo de archivo (AC-06-3)', () => {
    const { card } = toInsurerCard(aseguradora());

    expect(card.logo).toBeNull();
    expect(card.portada).toBeNull();
    expect(card.iniciales).toBe('NS');
  });

  it('lo declarado se rotula como declarado', () => {
    expect(toInsurerCard(aseguradora()).card.sellos).toEqual([
      { texto: 'Declarada', tono: 'neutro' },
    ]);
    expect(toInsurerCard(aseguradora({ verified: true })).card.sellos).toEqual([
      { texto: 'Verificada', tono: 'ok' },
    ]);
  });

  it('con reseñas suma la calificación, con su etiqueta hablada', () => {
    const { card } = toInsurerCard(aseguradora({ ratingAverage: 4.2, ratingCount: 5 }));

    const puntuacion = card.atributos.find((atributo) => atributo.clave === 'puntuacion');
    expect(puntuacion?.texto).toBe('4,2 (5)');
    expect(puntuacion?.etiqueta).toBe('4,2 de 5, sobre 5 reseñas');
  });
});
