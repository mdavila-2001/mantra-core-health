import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';

import { PublicProfile } from './public-profile';

/**
 * Lo que estas pruebas protegen.
 *
 * El criterio duro del carril es que el **HTML del servidor** traiga el nombre.
 * Eso ya se rompió una vez de la forma más silenciosa posible: el perfil
 * llegaba como `input.required` ligado por el router, `withComponentInputBinding()`
 * no estaba activo, y el servidor devolvía **200 con el cascarón vacío** y dos
 * `NG0950` en un log que nadie mira. La página parecía funcionar.
 *
 * Así que lo que se fija acá es que el componente pinta el nombre a partir de
 * lo que hay en `ActivatedRoute.data`, y que el estado vacío no distingue un
 * slug inexistente de uno despublicado.
 */
describe('PublicProfile', () => {
  const perfil: PublicProfileDetail = {
    kind: 'PRACTITIONER',
    slug: 'doctor-uno-e2e',
    displayName: 'Dra. Marisol Quispe Ticona',
    headline: 'Cardióloga · Hospital del Norte',
    biography: 'Veinte años de práctica clínica.',
    avatarUrl: null,
    coverUrl: null,
    verified: false,
    city: null,
    address: null,
    location: null,
    specialties: [],
    ratingAverage: null,
    ratingCount: 0,
    acceptsReviews: true,
    posts: [],
    updatedAt: new Date('2026-08-17T22:13:00.252Z'),
  };

  /** Monta el componente con la ficha que el resolver habría dejado. */
  function montar(resuelto: PublicProfileDetail | null) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: { data: of({ perfil: resuelto }) } },
      ],
    });
    const fixture = TestBed.createComponent(PublicProfile);
    fixture.detectChanges();
    return fixture;
  }

  it('pinta el nombre del profesional en el encabezado', () => {
    const fixture = montar(perfil);
    const h1: HTMLElement | null = fixture.nativeElement.querySelector('h1');

    expect(h1?.textContent).toContain('Dra. Marisol Quispe Ticona');
  });

  /**
   * El título es lo que ve una vista previa de enlace y lo que indexa un
   * buscador. Se fija en `ngOnInit` para que exista antes de que el servidor
   * serialice; si alguien lo mueve a un efecto, esto falla.
   */
  it('fija el título de la página con el nombre', () => {
    montar(perfil);

    expect(TestBed.inject(Title).getTitle()).toBe('Dra. Marisol Quispe Ticona — AloVida');
  });

  it('muestra el titular cuando viene', () => {
    const fixture = montar(perfil);

    expect(fixture.nativeElement.textContent).toContain('Cardióloga · Hospital del Norte');
  });

  /**
   * Sin reseñas se escribe «Sin calificar» y no «0»: un profesional que nadie
   * calificó no está calificado con cero, y la diferencia decide a quién elige
   * alguien que compara dos fichas.
   */
  it('no muestra cero cuando todavía no hay calificaciones', () => {
    const fixture = montar(perfil);
    const texto: string = fixture.nativeElement.textContent;

    expect(texto).toContain('Sin calificar');
  });

  /** Sin foto van las iniciales reales, no un icono genérico ni un roto. */
  it('degrada a las iniciales cuando no hay foto', () => {
    const fixture = montar(perfil);
    const figura: HTMLElement | null =
      fixture.nativeElement.querySelector('.perfil__retrato');

    expect(figura?.textContent?.trim()).toBe('MQ');
    expect(fixture.nativeElement.querySelector('img.perfil__retrato')).toBeNull();
  });

  /**
   * Un slug inexistente y uno despublicado llegan los dos como `null` y tienen
   * que producir **la misma pantalla**. Distinguirlos —«este perfil es
   * privado»— confirmaría que existe, que es justo lo que el 404 idéntico del
   * servidor evita.
   */
  it('muestra el mismo estado vacío cuando no hay ficha', () => {
    const fixture = montar(null);
    const h1: HTMLElement | null = fixture.nativeElement.querySelector('h1');

    expect(h1?.textContent).toContain('Ese perfil no está disponible');
    expect(fixture.nativeElement.textContent).not.toContain('privado');
    expect(TestBed.inject(Title).getTitle()).toBe('AloVida — perfil no encontrado');
  });
});
