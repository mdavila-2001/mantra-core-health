import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';

import { toFacilityCard } from './facility-card.mapper';

function organizacion(extra: Partial<PublicSearchResult> = {}): PublicSearchResult {
  return {
    kind: 'ORGANIZATION',
    slug: 'hospital-japones',
    displayName: 'Hospital Japonés',
    headline: 'Hospital de tercer nivel',
    city: 'Santa Cruz de la Sierra',
    avatarUrl: null,
    verified: true,
    ratingAverage: 4.6,
    ratingCount: 12,
    coverUrl: null,
    address: 'Av. Japón s/n',
    location: null,
    hasPublishedAgenda: false,
    nextAvailableDate: null,
    ...extra,
  };
}

describe('toFacilityCard', () => {
  it('enlaza a la ficha pública real, `/o/:slug` (AC-06-13)', () => {
    expect(toFacilityCard(organizacion()).profileLink).toBe('/o/hospital-japones');
  });

  it('sin imagen degrada al degradado del tema y las iniciales (AC-06-3)', () => {
    const { card } = toFacilityCard(organizacion());

    expect(card.portada).toBeNull();
    expect(card.logo).toBeNull();
    expect(card.iniciales).toBe('HJ');
  });

  it('expone las coordenadas cuando la ficha las publicó, y `null` si no', () => {
    expect(toFacilityCard(organizacion()).location).toBeNull();
    expect(
      toFacilityCard(organizacion({ location: { lat: -17.78, lng: -63.18 } })).location,
    ).toEqual({ lat: -17.78, lng: -63.18 });
  });

  it('explica por qué no hay «Cómo llegar» cuando falta la ubicación', () => {
    const { details } = toFacilityCard(organizacion());

    expect(details.find((fila) => fila.label === 'Ubicación')?.value).toContain(
      'no publicó su ubicación',
    );
  });

  it('con ubicación no repite el aviso', () => {
    const { details } = toFacilityCard(organizacion({ location: { lat: -17.78, lng: -63.18 } }));

    expect(details.map((fila) => fila.label)).not.toContain('Ubicación');
  });

  it('rotula lo declarado como declarado: sin sello se leería como verificado', () => {
    const { details } = toFacilityCard(organizacion({ verified: false }));

    expect(details.find((fila) => fila.label === 'Identidad')?.value).toContain('sin verificar');
  });

  it('sin reseñas no escribe una calificación de cero (AC-06-19)', () => {
    const { details, card } = toFacilityCard(
      organizacion({ ratingAverage: null, ratingCount: 0 }),
    );

    expect(details.map((fila) => fila.label)).not.toContain('Calificación');
    expect(card.atributos.map((atributo) => atributo.clave)).not.toContain('puntuacion');
  });

  it('sin dirección ni ciudad no dibuja renglones vacíos (AC-06-19)', () => {
    const { details, card } = toFacilityCard(organizacion({ address: null, city: null }));

    const rotulos = details.map((fila) => fila.label);
    expect(rotulos).not.toContain('Dirección');
    expect(rotulos).not.toContain('Ciudad');
    expect(card.donde).toBeNull();
  });

  it('cuando hay agenda publicada la lleva al desplegable', () => {
    const { details } = toFacilityCard(
      organizacion({ hasPublishedAgenda: true, nextAvailableDate: null }),
    );

    expect(details.find((fila) => fila.label === 'Agenda')?.value).toBe('Con agenda publicada');
  });
});
