import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { PublicProfilePreview } from './public-profile-preview';

/**
 * La vitrina pública propia.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **`null` es un estado listo, no un error.** No tener vitrina es el punto
 *    de partida de cualquiera; la pantalla lo distingue de una carga o un fallo.
 * 2. **Es un `PUT` idempotente**, el mismo formulario sirva para crear o editar.
 * 3. **El slug se valida en el cliente** con la misma regla que el backend, para
 *    no gastar una petición en un valor que va a rebotar.
 */

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('PublicProfilePreview', () => {
  let componente: PublicProfilePreview;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
  });

  afterEach(() => http.verify());

  function montar(): void {
    componente = TestBed.createComponent(PublicProfilePreview).componentInstance;
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  it('null es un estado listo: no tener vitrina no es un error', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    expect(interno<() => { status: string }>('perfil')().status).toBe('ready');
    expect(interno<() => boolean>('tieneVitrina')()).toBe(false);
  });

  it('con vitrina existente, siembra el formulario', () => {
    montar();
    http.expectOne('/community/profiles/me').flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: 'Cardióloga',
      biography: null,
      acceptsReviews: true,
      verificationStatusConceptId: null,
      statusConceptId: 'st-activo',
    });

    expect(señal<string>('slug')()).toBe('dra-salas');
    expect(señal<string>('headline')()).toBe('Cardióloga');
    expect(interno<() => boolean>('tieneVitrina')()).toBe(true);
  });

  /** La misma regla que valida el backend: minúsculas, números y guiones. */
  it('un slug con mayúsculas o espacios no es válido', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    señal<string>('slug').set('Dra Salas');
    expect(interno<() => boolean>('slugValido')()).toBe(false);

    señal<string>('slug').set('dra-salas');
    expect(interno<() => boolean>('slugValido')()).toBe(true);
  });

  it('sin nombre visible no se puede guardar', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    señal<string>('slug').set('dra-salas');
    señal<string>('displayName').set('');
    expect(interno<() => boolean>('puedeGuardar')()).toBe(false);
  });

  it('guardar manda un PUT idempotente con la organización activa', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    señal<string>('slug').set('dra-salas');
    señal<string>('displayName').set('Dra. Salas');
    interno<() => void>('guardar')();

    const req = http.expectOne('/community/profiles/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: undefined,
      biography: undefined,
      acceptsReviews: true,
    });
    req.flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: null,
      biography: null,
      acceptsReviews: true,
      verificationStatusConceptId: null,
      statusConceptId: 'st-activo',
    });

    expect(interno<() => boolean>('tieneVitrina')()).toBe(true);
  });

  /** Fabrica un evento `change` de `<input type="file">` con un solo archivo. */
  function eventoDeArchivo(archivo: File): Event {
    return { target: { files: [archivo], value: '' } } as unknown as Event;
  }

  it('subir una foto sin vitrina guardada no manda nada', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    interno<(e: Event) => void>('alElegirFoto')(
      eventoDeArchivo(new File(['x'], 'foto.png', { type: 'image/png' })),
    );

    http.verify();
  });

  it('subir una foto con vitrina guardada la sube y la cuelga de la vitrina', () => {
    montar();
    http.expectOne('/community/profiles/me').flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: null,
      biography: null,
      acceptsReviews: true,
      verificationStatusConceptId: null,
      avatarFileId: null,
      statusConceptId: 'st-activo',
    });
    expect(interno<() => boolean>('tieneVitrina')()).toBe(true);
    expect(interno<() => boolean>('sinFoto')()).toBe(true);

    interno<(e: Event) => void>('alElegirFoto')(
      eventoDeArchivo(new File(['x'], 'foto.png', { type: 'image/png' })),
    );

    const subida = http.expectOne('/common/files/upload');
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'f-1' } as never);

    const put = http.expectOne('/community/profiles/me');
    expect(put.request.body).toMatchObject({ avatarFileId: 'f-1' });
    put.flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: null,
      biography: null,
      acceptsReviews: true,
      verificationStatusConceptId: null,
      avatarFileId: 'f-1',
      statusConceptId: 'st-activo',
    });

    expect(interno<() => { avatarUrl: string | null }>('vistaPrevia')().avatarUrl).toBe(
      '/public/media/f-1',
    );
  });

  it('la vista previa refleja lo que se está escribiendo, antes de guardar', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    señal<string>('displayName').set('Dra. Salas');
    señal<string>('headline').set('Cardióloga');

    expect(interno<() => { displayName: string; headline: string }>('vistaPrevia')()).toMatchObject({
      displayName: 'Dra. Salas',
      headline: 'Cardióloga',
    });
  });

  /* -- La portada: espejo de la foto, columna independiente ------------------ */

  it('sin cover, la vista previa muestra el degradado de respaldo', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    expect(interno<() => { coverUrl: string | null }>('vistaPrevia')().coverUrl).toBeNull();
  });

  it('subir una portada sin vitrina guardada no manda nada', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    interno<(e: Event) => void>('alElegirPortada')(
      eventoDeArchivo(new File(['x'], 'portada.png', { type: 'image/png' })),
    );

    http.verify();
  });

  it('subir una portada con vitrina guardada la sube y la cuelga de la vitrina', () => {
    montar();
    http.expectOne('/community/profiles/me').flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: null,
      biography: null,
      acceptsReviews: true,
      verificationStatusConceptId: null,
      avatarFileId: null,
      coverFileId: null,
      statusConceptId: 'st-activo',
    });
    expect(interno<() => boolean>('sinPortada')()).toBe(true);

    interno<(e: Event) => void>('alElegirPortada')(
      eventoDeArchivo(new File(['x'], 'portada.png', { type: 'image/png' })),
    );

    const subida = http.expectOne('/common/files/upload');
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'c-1' } as never);

    const put = http.expectOne('/community/profiles/me');
    // El avatar no se menciona: la portada no pisa lo que ya haya del avatar.
    expect(put.request.body).toMatchObject({ coverFileId: 'c-1' });
    expect(put.request.body).not.toHaveProperty('avatarFileId');
    put.flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: null,
      biography: null,
      acceptsReviews: true,
      verificationStatusConceptId: null,
      avatarFileId: null,
      coverFileId: 'c-1',
      statusConceptId: 'st-activo',
    });

    expect(interno<() => { coverUrl: string | null }>('vistaPrevia')().coverUrl).toBe(
      '/public/media/c-1',
    );
    expect(interno<() => boolean>('sinPortada')()).toBe(false);
  });

  it('quitar la portada manda coverFileId en null y vuelve al degradado', () => {
    montar();
    http.expectOne('/community/profiles/me').flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: null,
      biography: null,
      acceptsReviews: true,
      verificationStatusConceptId: null,
      avatarFileId: null,
      coverFileId: 'c-1',
      statusConceptId: 'st-activo',
    });
    expect(interno<() => boolean>('sinPortada')()).toBe(false);

    interno<() => void>('quitarPortada')();

    const put = http.expectOne('/community/profiles/me');
    expect(put.request.body).toMatchObject({ coverFileId: null });
    put.flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: null,
      biography: null,
      acceptsReviews: true,
      verificationStatusConceptId: null,
      avatarFileId: null,
      coverFileId: null,
      statusConceptId: 'st-activo',
    });

    expect(interno<() => { coverUrl: string | null }>('vistaPrevia')().coverUrl).toBeNull();
    expect(interno<() => boolean>('sinPortada')()).toBe(true);
  });

  it('quitar la portada sin vitrina no manda nada', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    interno<() => void>('quitarPortada')();

    http.verify();
  });
});
