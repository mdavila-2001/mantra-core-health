import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';

import { ActivateAccount } from './activate-account';

/**
 * V01-08. Esta pantalla **repara un flujo que estaba roto**: el alta asistida
 * entregaba un token de activación y no existía ningún lugar donde usarlo.
 *
 * Lo que las pruebas fijan es lo propio de un token de un solo uso: que las dos
 * formas de traerlo funcionen, y que un token gastado se explique en vez de
 * invitar a reintentar.
 */
const RESPUESTA = { userId: 'u-1', status: 'ACTIVE' };

describe('ActivateAccount', () => {
  let harness: RouterTestingHarness;
  let componente: ActivateAccount;
  let http: HttpTestingController;

  async function montar(url = '/auth/activate') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'auth/activate', component: ActivateAccount }, { path: '**', children: [] }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(url, ActivateAccount);
  }

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function completar(valores: { activationToken?: string; newPassword?: string } = {}) {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({
      activationToken: valores.activationToken ?? 'tok-abc-123',
      newPassword: valores.newPassword ?? 'S3cret-passw0rd',
    });
  }

  function enviar() {
    interno<() => void>('submit')();
  }

  /* ---- las dos formas de traer el token ----------------------------------- */

  /**
   * Por la URL cuando alguien manda el enlace armado; a mano cuando el token se
   * pasó por teléfono o en papel, que es el caso que el alta asistida
   * contempla. Obligar a construir una URL sería devolverle el problema a quien
   * menos herramientas tiene.
   */
  it('toma el token del enlace y no vuelve a pedirlo', async () => {
    await montar('/auth/activate?token=tok-del-enlace');

    expect(interno<boolean>('tokenEnLaUrl')).toBe(true);
    expect(
      interno<{ getRawValue: () => { activationToken: string } }>('form').getRawValue()
        .activationToken,
    ).toBe('tok-del-enlace');
  });

  it('sin token en el enlace, lo pide en el formulario', async () => {
    await montar();

    expect(interno<boolean>('tokenEnLaUrl')).toBe(false);
  });

  it('sin token no envía nada, aunque la contraseña sea válida', async () => {
    await montar();
    completar({ activationToken: '' });
    enviar();

    // `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('con una contraseña de menos de 8 no envía', async () => {
    await montar();
    completar({ newPassword: 'corta' });
    enviar();

    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  /* ---- el envío ------------------------------------------------------------ */

  it('manda el token recortado y la contraseña que eligió su dueño', async () => {
    await montar();
    completar({ activationToken: '  tok-abc-123  ' });
    enviar();

    const req = http.expectOne('/iam/auth/activate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      activationToken: 'tok-abc-123',
      newPassword: 'S3cret-passw0rd',
    });

    req.flush(RESPUESTA);
  });

  it('al activarse muestra el final del camino, no el formulario', async () => {
    await montar();
    completar();
    enviar();
    http.expectOne('/iam/auth/activate').flush(RESPUESTA);
    harness.detectChanges();

    expect(interno<() => boolean>('done')()).toBe(true);
  });

  it('no se envía dos veces mientras la primera está en vuelo', async () => {
    await montar();
    completar();
    enviar();
    enviar();

    // `expectOne` falla si hubo dos.
    http.expectOne('/iam/auth/activate').flush(RESPUESTA);
  });

  it('al activar la cuenta, goToLogin redirige a login con returnUrl para completar perfil', async () => {
    await montar();
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigate');

    interno<() => void>('goToLogin')();

    expect(spy).toHaveBeenCalledWith(['/auth'], {
      queryParams: { returnUrl: '/my-account/profile/edit' },
    });
  });

  /* ---- el token gastado ---------------------------------------------------- */

  /**
   * Un token de un solo uso **puede haberse consumido en un intento anterior**,
   * que es un caso que la persona no tiene forma de adivinar. Reintentar no
   * sirve: hay que pedir uno nuevo a quien creó la cuenta.
   */
  it('un token inexistente se explica, no se muestra como error genérico', async () => {
    await montar();
    completar();
    enviar();

    http
      .expectOne('/iam/auth/activate')
      .flush({ code: 'NOT_FOUND', message: 'no existe' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();

    expect(interno<() => boolean>('tokenInvalido')()).toBe(true);
    // No se pinta además el error general: sería decir dos cosas del mismo fallo.
    expect(interno<() => string | null>('errorMessage')()).toBeNull();
  });

  it('un token ya usado también cae en la explicación del token', async () => {
    await montar();
    completar();
    enviar();

    http
      .expectOne('/iam/auth/activate')
      .flush(
        { code: 'CONFLICT', message: 'El token ya fue usado' },
        { status: 409, statusText: 'Conflict' },
      );
    harness.detectChanges();

    expect(interno<() => boolean>('tokenInvalido')()).toBe(true);
  });

  /**
   * **Verificado contra la API viva el 2026-08-08:** el backend responde `401
   * UNAUTHENTICATED` a un token inválido, vencido o ya usado — no `404` ni
   * `409`. La traducción general manda ese código a S9 porque asume que un
   * `401` es una sesión agotada; en una pantalla pública eso no puede pasar.
   *
   * Sin esta prueba, el mensaje cuidado de «pedí otro código» no se disparaba
   * nunca y la persona veía un error inesperado con un identificador de
   * petición.
   */
  it('el 401 real del backend se explica como token rechazado, no como error inesperado', async () => {
    await montar();
    completar();
    enviar();

    http.expectOne('/iam/auth/activate').flush(
      { code: 'UNAUTHENTICATED', message: 'Token de activación inválido' },
      { status: 401, statusText: 'Unauthorized' },
    );
    harness.detectChanges();

    expect(interno<() => boolean>('tokenInvalido')()).toBe(true);
    expect(interno<() => string | null>('errorMessage')()).toBeNull();
  });

  it('un fallo de red NO se confunde con un token malo', async () => {
    await montar();
    completar();
    enviar();

    http.expectOne('/iam/auth/activate').error(new ProgressEvent('error'), { status: 0 });
    harness.detectChanges();

    // Acá reintentar sí sirve, así que no puede decir «pedí otro código».
    expect(interno<() => boolean>('tokenInvalido')()).toBe(false);
    expect(interno<() => string | null>('errorMessage')()).toContain('conectarnos');
  });
});
