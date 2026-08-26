import { TestBed } from '@angular/core/testing';

import { PublicProfileCard } from './public-profile-card';
import { jsonLdDePerfil } from '../public-profile.jsonld';
import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';

/**
 * El JSON-LD de la ficha (B3 del plan de UX del 22/08/2026).
 *
 * Lo que se fija acá es la regla de la dirección: qué se declara y qué no. Un
 * dato de mapa mal declarado no se ve en la aplicación — se ve en el buscador,
 * meses después, cuando alguien llega a la puerta equivocada.
 */
describe('jsonLdDePerfil · dónde atiende', () => {
  const BASE: PublicProfileDetail = {
    kind: 'PRACTITIONER',
    slug: 'dra-lucia-salas',
    displayName: 'Dra. Lucía Salas',
    headline: null,
    biography: null,
    avatarUrl: null,
    coverUrl: null,
    verified: true,
    city: null,
    address: null,
    location: null,
    specialties: [],
    ratingAverage: null,
    ratingCount: 0,
    acceptsReviews: false,
    posts: [],
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  it('sin calle ni ciudad no declara ninguna dirección', () => {
    // Un `PostalAddress` vacío es un resultado de mapa que manda a alguien a
    // ninguna parte.
    expect(jsonLdDePerfil(BASE, 'https://alovida.app')['address']).toBeUndefined();
  });

  it('con la ciudad sola declara la localidad', () => {
    // Antes hacía falta la calle para declarar nada, así que una ficha que dice
    // «Cochabamba» aparecía en el buscador sin ninguna localidad — y «dónde
    // atiende» es media búsqueda de un médico.
    const datos = jsonLdDePerfil({ ...BASE, city: 'Cochabamba' }, 'https://alovida.app');

    expect(datos['address']).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Cochabamba',
    });
  });

  it('con calle y ciudad declara las dos', () => {
    const datos = jsonLdDePerfil(
      { ...BASE, city: 'La Paz', address: 'Av. Arce 2345' },
      'https://alovida.app',
    );

    expect(datos['address']).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Av. Arce 2345',
      addressLocality: 'La Paz',
    });
  });

  it('una ciudad vacía no cuenta como ciudad', () => {
    expect(jsonLdDePerfil({ ...BASE, city: '' }, 'https://alovida.app')['address']).toBeUndefined();
  });
});

/**
 * El mapa (`app-map`, Leaflet): cuándo hay un pin que dibujar.
 *
 * Sin coordenadas no hay nada que mostrar — a diferencia de un *embed* de
 * Google, Leaflet no busca por texto, así que la dirección o la ciudad solas
 * no alcanzan para dibujar un pin.
 */
describe('PublicProfileCard · pines', () => {
  const BASE: PublicProfileDetail = {
    kind: 'PRACTITIONER',
    slug: 'dra-lucia-salas',
    displayName: 'Dra. Lucía Salas',
    headline: null,
    biography: null,
    avatarUrl: null,
    coverUrl: null,
    verified: true,
    city: null,
    address: null,
    location: null,
    specialties: [],
    ratingAverage: null,
    ratingCount: 0,
    acceptsReviews: false,
    posts: [],
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  function crear(perfil: PublicProfileDetail) {
    const fixture = TestBed.createComponent(PublicProfileCard);
    fixture.componentRef.setInput('perfil', perfil);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('sin coordenadas no dibuja ningún pin', () => {
    expect(crear(BASE)['pines']()).toEqual([]);
  });

  it('con dirección y ciudad pero sin coordenadas, tampoco dibuja nada', () => {
    const perfil = { ...BASE, address: 'Av. Arce 2345', city: 'La Paz' };

    expect(crear(perfil)['pines']()).toEqual([]);
  });

  it('con coordenadas dibuja un pin en el punto exacto', () => {
    const pines = crear({ ...BASE, location: { lat: -17.78, lng: -63.18 } })['pines']();

    expect(pines).toEqual([
      { id: 'ubicacion', lat: -17.78, lng: -63.18, titulo: 'Dra. Lucía Salas' },
    ]);
  });
});
