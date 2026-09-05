import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { AlovidaPublicShell } from './alovida-public-shell';

/**
 * El marco de las fichas públicas, mirado por alguien que YA tiene sesión.
 *
 * Las cinco fichas —`/p`, `/o`, `/f`, `/l`, `/s`— cuelgan de este marco y están
 * declaradas FUERA del armazón autenticado. Eso está bien: son enlaces
 * compartibles y tienen que abrir sin sesión. Lo que no estaba bien es que el
 * marco diera por sentado que nadie la tiene: las guías de clínicas y de
 * farmacias viven en el menú de la app y enlazan acá, así que abrir una clínica
 * mostraba «Entrar / Crear cuenta» a quien ya había entrado y ponía el logo a
 * apuntar al buscador público. La sesión seguía viva; todo lo visible decía lo
 * contrario.
 */
describe('AlovidaPublicShell', () => {
  function montar(conSesion: boolean): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { isAuthenticated: signal(conSesion), displayName: signal('Dra. Ana Paz') },
        },
      ],
    });
    const fixture = TestBed.createComponent(AlovidaPublicShell);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('sin sesión ofrece entrar y crear cuenta', () => {
    const host = montar(false);

    expect(host.textContent).toContain('Entrar');
    expect(host.textContent).toContain('Crear cuenta');
    expect(host.textContent).not.toContain('Volver a mi panel');
  });

  it('con sesión ofrece volver a la app, no entrar', () => {
    const host = montar(true);

    expect(host.textContent).toContain('Volver a mi panel');
    // Lo que hacía creer que la sesión se había caído.
    expect(host.textContent).not.toContain('Crear cuenta');
  });

  it('la marca lleva al panel con sesión y al buscador sin ella', () => {
    const conSesion = montar(true).querySelector('.app-public-header__marca');
    expect(conSesion?.getAttribute('href')).toBe('/dashboard');

    TestBed.resetTestingModule();
    const sinSesion = montar(false).querySelector('.app-public-header__marca');
    expect(sinSesion?.getAttribute('href')).toBe('/search');
  });
});
