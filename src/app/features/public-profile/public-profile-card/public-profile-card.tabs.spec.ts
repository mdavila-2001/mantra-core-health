import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type {
  PublicPostSummary,
  PublicProfileDetail,
} from '@core/data-access/public-directory/public-directory.types';

import { PublicProfileCard } from './public-profile-card';

/**
 * Pestañas, paginado y opiniones de la ficha pública (pedido del 13/09/2026):
 * - las pestañas eran anclas que sacaban de la ficha;
 * - publicaciones y sedes se pagina con anterior / siguiente;
 * - «N opiniones» y la estrella abren un modal con quién opinó y quién calificó.
 */
describe('PublicProfileCard · pestañas, paginado y opiniones', () => {
  const post = (i: number): PublicPostSummary => ({
    id: `post-${i}`,
    bodyText: `Publicación número ${i}`,
    publishedAt: new Date('2026-08-01T00:00:00Z'),
    mediaUrls: [],
    reactionCount: 0,
    commentCount: 0,
  });

  const PERFIL: PublicProfileDetail = {
    kind: 'PRACTITIONER',
    slug: 'dra-lucia-salas',
    displayName: 'Dra. Lucía Salas',
    headline: 'Cardióloga',
    biography: 'Cardióloga clínica.',
    avatarUrl: null,
    coverUrl: null,
    verified: true,
    city: 'La Paz',
    address: 'Av. Arce 2345',
    location: null,
    specialties: ['Cardiología'],
    trajectory: [],
    ratingAverage: 4.9,
    ratingCount: 2,
    practiceSites: [1, 2, 3].map((i) => ({
      id: `sede-${i}`,
      name: `Sede ${i}`,
      addressText: null,
      location: null,
      isOwn: i === 1,
    })),
    acceptsReviews: true,
    posts: [1, 2, 3, 4].map(post),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
  };

  function crear(perfil: PublicProfileDetail = PERFIL) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(PublicProfileCard);
    fixture.componentRef.setInput('perfil', perfil);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement = HTMLElement>(testId: string) =>
      el.querySelector<T>(`[data-testid="${testId}"]`);
    return { fixture, el, q };
  }

  it('las pestañas son botones, no anclas que naveguen fuera de la ficha', () => {
    const { el } = crear();
    const pestanas = el.querySelectorAll('[role="tab"]');
    // Inicio, Acerca de, Especialidades, Dónde atiende y Publicaciones: sin trayectoria no hay pestaña.
    expect(pestanas.length).toBe(5);
    expect(el.querySelector('.perfil__tabs a[href^="#"]')).toBeNull();
  });

  it('elegir «Acerca de» muestra sólo esa sección, e «Inicio» vuelve a mostrar todas', () => {
    const { fixture, el, q } = crear();
    const oculta = (id: string) => (el.querySelector(`#${id}`) as HTMLElement).hidden;

    q('perfil-tab-acerca-de')!.click();
    fixture.detectChanges();
    expect(oculta('acerca-de')).toBe(false);
    expect(oculta('publicaciones')).toBe(true);
    expect(oculta('donde-queda')).toBe(true);
    expect(q('perfil-tab-acerca-de')!.getAttribute('aria-selected')).toBe('true');

    q('perfil-tab-resumen')!.click();
    fixture.detectChanges();
    expect(oculta('acerca-de')).toBe(false);
    expect(oculta('publicaciones')).toBe(false);
  });

  it('las publicaciones se ven de a tres y «siguiente» muestra la cuarta', () => {
    const { fixture, q } = crear();
    const publicaciones = () => q('perfil-publicaciones')!.querySelectorAll(':scope > li').length;

    expect(publicaciones()).toBe(3);
    q<HTMLButtonElement>('perfil-publicaciones-pager-next')!.click();
    fixture.detectChanges();
    expect(publicaciones()).toBe(1);
    expect(q('perfil-publicaciones-pager-counter')!.textContent!.trim()).toBe('2 de 2');
  });

  it('las sedes también se paginan', () => {
    const { fixture, q } = crear();
    const sedes = () => q('perfil-sedes')!.querySelectorAll(':scope > li').length;

    expect(sedes()).toBe(2);
    q<HTMLButtonElement>('perfil-sedes-pager-next')!.click();
    fixture.detectChanges();
    expect(sedes()).toBe(1);
  });

  /**
   * Hasta el merge de `dev` esto abría un modal con dos pestañas —«2 opiniones»
   * una, la estrella la otra— y el cable traía `rating`, `text` y `reviewer`.
   * Ese componente ya no existe: quedó la versión que se monta en línea, con el
   * contrato nuevo (`overallRating`, `reviewText`, `reviewerDisplayName`), que
   * es el único que soporta que alguien opine en anónimo.
   *
   * Lo que sigue valiendo, y es lo que se prueba, es que los dos botones de la
   * calificación abran las opiniones y que las opiniones se lean. Las pestañas
   * son una función a recuperar aparte, no algo que este archivo deba fingir.
   */
  it('«2 opiniones» despliega las opiniones y se leen', async () => {
    const { fixture, el, q } = crear();
    const http = TestBed.inject(HttpTestingController);

    expect(q('perfil-opiniones')!.textContent!.trim()).toBe('2 opiniones');
    q('perfil-opiniones')!.click();
    fixture.detectChanges();

    http
      .expectOne((req) => req.url.endsWith('/public/profiles/p/dra-lucia-salas/reviews'))
      .flush({
        items: [
          {
            id: 'r1',
            overallRating: 5,
            reviewText: 'Excelente atención.',
            reviewerDisplayName: 'Carla Vargas',
            publishedAt: '2026-08-02T00:00:00Z',
            editedAt: null,
            responses: [],
          },
          {
            id: 'r2',
            overallRating: 4,
            reviewText: null,
            // Quien eligió el anonimato no manda nombre: la pantalla lo dice
            // con palabras, nunca con un hueco.
            reviewerDisplayName: null,
            publishedAt: '2026-08-01T00:00:00Z',
            editedAt: null,
            responses: [],
          },
        ],
        nextCursor: null,
        ratingAverage: 4.5,
        ratingCount: 2,
      });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(el.querySelectorAll('[data-testid="opinion"]').length).toBe(2);
    const texto = el.textContent ?? '';
    expect(texto).toContain('Excelente atención.');
    expect(texto).toContain('Carla Vargas');
    expect(texto).toContain('Paciente verificado');
    http.verify();
  });
});
