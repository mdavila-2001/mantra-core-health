import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { PublicProfileReviews } from './public-profile-reviews';

const RESEÑAS = '/public/profiles/p/dra-perez/reviews';

/** Una opinión tal como llega por el cable. */
const enCable = (over: Record<string, unknown> = {}) => ({
  id: 'r-1',
  overallRating: 5,
  reviewText: 'Me explicó todo con calma.',
  reviewerDisplayName: 'Ana Quispe',
  publishedAt: '2026-08-01T10:00:00.000Z',
  editedAt: null,
  responses: [],
  ...over,
});

/**
 * Monta el bloque con o sin perfil de paciente en la sesión.
 *
 * El claim decide si aparece «Calificar mi atención», así que es lo primero
 * que hay que poder controlar.
 */
async function montar(patientProfileId: string | null = null) {
  await TestBed.configureTestingModule({
    imports: [PublicProfileReviews],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { patientProfileId: signal(patientProfileId) } },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<PublicProfileReviews> =
    TestBed.createComponent(PublicProfileReviews);
  fixture.componentRef.setInput('kind', 'PRACTITIONER');
  fixture.componentRef.setInput('slug', 'dra-perez');
  fixture.componentRef.setInput('professionalName', 'Dra. Pérez');
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

describe('PublicProfileReviews (P31)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('muestra el promedio del PERFIL, no el de la página que se está mirando', async () => {
    const { fixture, http } = await montar();
    // Una sola opinión de 5 en la página; el perfil promedia 4,6 sobre 12.
    http.expectOne((r) => r.url === RESEÑAS).flush({
      items: [enCable()],
      nextCursor: null,
      ratingAverage: 4.6,
      ratingCount: 12,
    });
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('4,6');
    expect(texto).toContain('12 opiniones');
    http.verify();
  });

  it('sin opiniones dice «Sin calificaciones», nunca un cero', async () => {
    // Cero estrellas sería una calificación pésima; que nadie haya opinado
    // todavía no lo es.
    const { fixture, http } = await montar();
    http.expectOne((r) => r.url === RESEÑAS).flush({
      items: [],
      nextCursor: null,
      ratingAverage: null,
      ratingCount: 0,
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="opiniones-sin-calificar"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('0 de 5');
    expect(
      fixture.nativeElement.querySelector('[data-testid="opiniones-vacio"]'),
    ).not.toBeNull();
    http.verify();
  });

  it('la opinión anónima se firma con palabras, no con un hueco', async () => {
    const { fixture, http } = await montar();
    http.expectOne((r) => r.url === RESEÑAS).flush({
      items: [enCable({ id: 'r-anon', reviewerDisplayName: null })],
      nextCursor: null,
      ratingAverage: 5,
      ratingCount: 1,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Paciente verificado');
    http.verify();
  });

  it('dice el puntaje en palabras para quien no ve las estrellas', async () => {
    const { fixture, http } = await montar();
    http.expectOne((r) => r.url === RESEÑAS).flush({
      items: [enCable({ overallRating: 3 })],
      nextCursor: null,
      ratingAverage: 3,
      ratingCount: 1,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('3 de 5 estrellas');
    http.verify();
  });

  it('«Ver más» ACUMULA en vez de reemplazar: quien venía leyendo no vuelve al principio', async () => {
    const { fixture, http } = await montar();
    http.expectOne((r) => r.url === RESEÑAS).flush({
      items: [enCable({ id: 'r-1' })],
      nextCursor: 'cursor-2',
      ratingAverage: 4.6,
      ratingCount: 12,
    });
    fixture.detectChanges();

    const mas = fixture.nativeElement.querySelector('[data-testid="opiniones-mas"]');
    expect(mas).not.toBeNull();
    mas.click();
    fixture.detectChanges();

    const segunda = http.expectOne((r) => r.url === RESEÑAS);
    expect(segunda.request.params.get('cursor')).toBe('cursor-2');
    segunda.flush({
      items: [enCable({ id: 'r-2' })],
      nextCursor: null,
      ratingAverage: 4.6,
      ratingCount: 12,
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="opinion"]').length,
    ).toBe(2);
    // Sin más páginas, el botón deja de ofrecerse.
    expect(fixture.nativeElement.querySelector('[data-testid="opiniones-mas"]')).toBeNull();
    http.verify();
  });

  it('sólo ofrece calificar a una sesión con perfil de paciente', async () => {
    const anonimo = await montar(null);
    anonimo.http.expectOne((r) => r.url === RESEÑAS).flush({
      items: [],
      nextCursor: null,
      ratingAverage: null,
      ratingCount: 0,
    });
    anonimo.fixture.detectChanges();
    expect(
      anonimo.fixture.nativeElement.querySelector('[data-testid="opiniones-calificar"]'),
    ).toBeNull();
    anonimo.http.verify();
    TestBed.resetTestingModule();

    const paciente = await montar('pat-1');
    paciente.http.expectOne((r) => r.url === RESEÑAS).flush({
      items: [],
      nextCursor: null,
      ratingAverage: null,
      ratingCount: 0,
    });
    paciente.fixture.detectChanges();
    expect(
      paciente.fixture.nativeElement.querySelector('[data-testid="opiniones-calificar"]'),
    ).not.toBeNull();
    paciente.http.verify();
  });

  it('un fallo se dice y se puede reintentar, sin dejar la sección muda', async () => {
    const { fixture, http } = await montar();
    http
      .expectOne((r) => r.url === RESEÑAS)
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="opiniones-error"]'),
    ).not.toBeNull();
    http.verify();
  });
});
