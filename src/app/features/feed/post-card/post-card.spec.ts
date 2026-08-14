import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PostCard } from './post-card';
import type { PostListItem } from '../../../core/data-access/community/community.types';

/**
 * Lo que estas pruebas fijan.
 *
 * Dos cosas que no se ven leyendo: que **sin perfil público no se puede
 * reaccionar** —el contrato exige el perfil y no lo deduce de la sesión— y que
 * la reacción es **optimista con reversión**. Lo segundo importa: si el
 * servidor falla y el conteo se queda subido, la pantalla miente.
 */
describe('PostCard', () => {
  let fixture: ComponentFixture<PostCard>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const post: PostListItem = {
    id: 'p-1',
    authorPublicProfileId: 'abcdef01-2345-6789-abcd-ef0123456789',
    postTypeConceptId: 'c-tipo',
    bodyText: 'Un hallazgo de la consulta de hoy.',
    publishedAt: new Date('2026-08-14T09:00:00.000Z'),
  };

  const montar = (actorProfileId: string | null): void => {
    fixture = TestBed.createComponent(PostCard);
    fixture.componentRef.setInput('post', post);
    fixture.componentRef.setInput('actorProfileId', actorProfileId);
    fixture.detectChanges();
  };

  const pulsar = (etiqueta: string): void => {
    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    botones.find((b) => b.textContent!.includes(etiqueta))!.click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostCard],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('pinta el cuerpo de la publicación', () => {
    montar('pp-1');
    expect(texto()).toContain('Un hallazgo de la consulta de hoy.');
  });

  /**
   * Sin perfil público el contrato no acepta la reacción: `actorProfileId` es
   * obligatorio y es la mitad de la clave del upsert. Se dice, no se ofrece un
   * botón que va a fallar.
   */
  it('sin perfil público no ofrece reaccionar: lo explica', () => {
    montar(null);

    expect(texto()).toContain('Creá tu perfil público para reaccionar');
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('reaccionar manda el upsert con los cuatro campos', () => {
    montar('pp-1');
    pulsar('Me sirve');

    const req = http.expectOne((r) => r.url === '/community/reactions');
    // PUT y no POST: reaccionar de nuevo cambia la reacción, no agrega otra.
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      actorProfileId: 'pp-1',
      reactableType: 'POST',
      reactableRefId: 'p-1',
      reactionType: 'LIKE',
    });

    req.flush({ id: 'r-1' });
  });

  it('el conteo sube antes de que el servidor conteste', () => {
    montar('pp-1');
    pulsar('Me sirve');

    // Todavía sin respuesta: el gesto ya se siente.
    expect(texto()).toContain('1');

    http.expectOne((r) => r.url === '/community/reactions').flush({ id: 'r-1' });
  });

  /**
   * Lo que hace honesto al optimismo. Si el servidor falla y el conteo se queda
   * subido, la pantalla afirma algo que no ocurrió.
   */
  it('si el servidor falla, el conteo vuelve atrás y se avisa', () => {
    montar('pp-1');
    pulsar('Me sirve');

    http
      .expectOne((r) => r.url === '/community/reactions')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos guardar tu reacción');
    // El conteo volvió a cero: no queda un «1» que nadie guardó.
    const conteo = fixture.nativeElement.querySelector('.publicacion__conteo');
    expect(conteo).toBeNull();
  });

  it('marca cuál reacción es la propia', () => {
    montar('pp-1');
    pulsar('Me hizo pensar');

    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const pensar = botones.find((b) => b.textContent!.includes('Me hizo pensar'))!;
    const sirve = botones.find((b) => b.textContent!.includes('Me sirve'))!;

    expect(pensar.getAttribute('aria-pressed')).toBe('true');
    expect(sirve.getAttribute('aria-pressed')).toBe('false');

    http.expectOne((r) => r.url === '/community/reactions').flush({ id: 'r-1' });
  });
});
