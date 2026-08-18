import { RESPONSE_INIT, runInInjectionContext, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type { PublicProfileDetail } from '@core/data-access/public-directory/public-directory.types';

import { perfilPublicoResolver } from './public-profile.resolver';

/**
 * Lo que estas pruebas fijan.
 *
 * Las dos mitades del comportamiento ante un slug que no resuelve, que son
 * contradictorias sólo en apariencia: **la pantalla no es un error** —se pinta
 * un mensaje, no la pantalla de recuperación— y **la respuesta sí es un 404**,
 * porque sin el estado correcto un rastreador indexa el enlace muerto como una
 * ficha válida del directorio.
 */
describe('perfilPublicoResolver', () => {
  const perfil = { slug: 'doctor-uno-e2e', displayName: 'Dra. Uno' } as PublicProfileDetail;

  /** Una ruta con su slug y su tipo, como la declara `app.routes`. */
  function ruta(slug: string, kind = 'PRACTITIONER'): ActivatedRouteSnapshot {
    return {
      paramMap: { get: (clave: string) => (clave === 'slug' ? slug : null) },
      data: { kind },
    } as unknown as ActivatedRouteSnapshot;
  }

  /** Corre el resolver con un cliente controlado y, si se pide, un RESPONSE_INIT. */
  function correr(
    cliente: Partial<PublicDirectoryClient>,
    respuesta: ResponseInit | null = null,
  ) {
    TestBed.configureTestingModule({
      providers: [
        { provide: PublicDirectoryClient, useValue: cliente },
        { provide: RESPONSE_INIT, useValue: respuesta },
      ],
    });
    const injector = TestBed.inject(Injector);
    return runInInjectionContext(injector, () =>
      perfilPublicoResolver(ruta('doctor-uno-e2e'), {} as never),
    );
  }

  it('devuelve la ficha cuando la API responde', async () => {
    const resuelto = await firstValueFrom(
      correr({ getProfile: () => of(perfil) } as Partial<PublicDirectoryClient>) as never,
    );

    expect(resuelto).toBe(perfil);
  });

  /**
   * Un 404 es una respuesta esperada de una URL que cualquiera puede escribir:
   * si la excepción subiera, la navegación moriría y el router mandaría a la
   * pantalla de recuperación —«algo falló, recargá»— cuando lo que pasó es que
   * ese perfil no está.
   */
  it('convierte el fallo en null en vez de dejar que rompa la navegación', async () => {
    const resuelto = await firstValueFrom(
      correr({
        getProfile: () => throwError(() => new Error('404')),
      } as Partial<PublicDirectoryClient>) as never,
    );

    expect(resuelto).toBeNull();
  });

  /**
   * Y marca la respuesta del servidor como 404. `RESPONSE_INIT` es el mismo
   * objeto que el motor de SSR usa para construir la respuesta después de
   * renderizar, así que mutarlo durante el render llega a tiempo.
   */
  it('marca la respuesta del servidor como 404 cuando no hay ficha', async () => {
    const respuesta: ResponseInit = { status: 200 };

    await firstValueFrom(
      correr(
        { getProfile: () => throwError(() => new Error('404')) } as Partial<PublicDirectoryClient>,
        respuesta,
      ) as never,
    );

    expect(respuesta.status).toBe(404);
  });

  it('no toca el estado cuando la ficha existe', async () => {
    const respuesta: ResponseInit = { status: 200 };

    await firstValueFrom(
      correr({ getProfile: () => of(perfil) } as Partial<PublicDirectoryClient>, respuesta) as never,
    );

    expect(respuesta.status).toBe(200);
  });

  /**
   * En el navegador el token no existe. Si el resolver no lo inyectara
   * `optional`, cada navegación del lado del cliente a un slug inexistente
   * moriría con un error de inyección en vez de mostrar la pantalla.
   */
  it('funciona sin RESPONSE_INIT, que es lo que pasa en el navegador', async () => {
    const resuelto = await firstValueFrom(
      correr(
        { getProfile: () => throwError(() => new Error('404')) } as Partial<PublicDirectoryClient>,
        null,
      ) as never,
    );

    expect(resuelto).toBeNull();
  });
});
