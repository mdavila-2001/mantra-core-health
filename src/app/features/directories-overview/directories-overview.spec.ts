import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { DirectoriesOverview } from './directories-overview';

@Component({ template: '' })
class Vacio {}

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

describe('DirectoriesOverview', () => {
  let fixture: ComponentFixture<DirectoriesOverview>;
  let session: SessionStore;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function abrirSesion(roles: readonly string[], tenants: readonly string[] = ['t-1']) {
    session.start({ accessToken: jwt({ sub: 'u-1', roles, tenants }), refreshToken: 'r' });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Vacio }]),
      ],
    });

    session = TestBed.inject(SessionStore);
    session.clear();
    const router = TestBed.inject(Router);
    void router.navigateByUrl('/directories');
  });

  function crear(): void {
    fixture = TestBed.createComponent(DirectoriesOverview);
    fixture.detectChanges();
  }

  it('un paciente ve los cuatro directorios, cada uno con su descripción y su enlace', () => {
    abrirSesion(['PATIENT']);
    crear();

    const enlaces = [...root().querySelectorAll<HTMLAnchorElement>('.rejilla__tarjeta')];
    expect(enlaces.length).toBe(4);

    const medicos = enlaces.find((enlace) => enlace.getAttribute('href') === '/directory');
    expect(medicos).toBeDefined();
    expect(medicos?.textContent).toContain('Directorio de médicos');
    expect(medicos?.textContent).toContain('agrupados por especialidad');
  });

  it('quien ejerce también ve el nodo del directorio de médicos (24/09/2026)', () => {
    abrirSesion(['PRACTITIONER']);
    crear();

    const enlaces = [...root().querySelectorAll<HTMLAnchorElement>('.rejilla__tarjeta')];
    expect(enlaces.some((enlace) => enlace.getAttribute('href') === '/directory')).toBe(true);
    expect(enlaces.length).toBe(4);
  });

  it('quien sólo administra no ve el nodo del directorio de médicos', () => {
    abrirSesion(['SECURITY_ADMIN']);
    crear();

    const enlaces = [...root().querySelectorAll<HTMLAnchorElement>('.rejilla__tarjeta')];
    expect(enlaces.some((enlace) => enlace.getAttribute('href') === '/directory')).toBe(false);
  });

  it('el nodo central es decorativo: no es un enlace ni compite con los cuatro', () => {
    abrirSesion(['PATIENT']);
    crear();

    const centro = root().querySelector('.mapa__centro');
    expect(centro?.getAttribute('aria-hidden')).toBe('true');
    expect(centro?.querySelector('a')).toBeNull();
  });

  describe('la barra de búsqueda (19/09/2026)', () => {
    it('la portada tiene la misma barra que los directorios, encima de los nodos', () => {
      abrirSesion(['PRACTITIONER']);
      crear();

      const barra = root().querySelector('app-filter-bar app-search-field');
      expect(barra).not.toBeNull();
      expect(barra?.textContent).toContain('médicos, laboratorios, clínicas y farmacias');
      expect(root().querySelector('.mapa__nodos')).not.toBeNull();
    });

    it('un término busca en los cuatro directorios y agrupa lo encontrado por directorio', async () => {
      abrirSesion(['PRACTITIONER']);
      await TestBed.inject(Router).navigateByUrl('/directories?q=central');
      crear();

      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne((pedido) => pedido.url.endsWith('/public/search/practitioners'))
        .flush(PAGINA_VACIA);
      http
        .expectOne((pedido) => pedido.url.endsWith('/diagnostic-units/search'))
        .flush({ items: [], total: 0, limit: 50, offset: 0 });
      http
        .expectOne((pedido) => pedido.url.endsWith('/public/search/organizations'))
        .flush({ items: [], nextCursor: null, totalHint: 0, generatedAt: '2026-09-19T00:00:00Z' });
      const farmacias = http.expectOne((pedido) =>
        pedido.url.endsWith('/public/search/pharmacies'),
      );
      expect(farmacias.request.params.get('q')).toBe('central');
      farmacias.flush({
        items: [
          {
            kind: 'PHARMACY',
            slug: 'farmacia-central',
            displayName: 'Farmacia Central',
            headline: null,
            city: 'Sucre',
            avatarUrl: null,
            verified: true,
            ratingAverage: null,
            ratingCount: 0,
            coverUrl: null,
            address: null,
            location: null,
            hasPublishedAgenda: false,
            nextAvailableDate: null,
            category: null,
          },
        ],
        nextCursor: null,
        totalHint: 1,
        generatedAt: '2026-09-19T00:00:00Z',
      });
      fixture.detectChanges();

      expect(root().querySelector('.mapa__nodos')).toBeNull();
      const rotulos = [...root().querySelectorAll('.directorio__rotulo')];
      expect(rotulos.map((rotulo) => rotulo.textContent)).toEqual([
        expect.stringContaining('Directorio de farmacias'),
      ]);
      const tarjeta = root().querySelector<HTMLAnchorElement>('li[app-result-card] a');
      expect(tarjeta?.getAttribute('href')).toBe('/pharmacies-directory/farmacia-central');
    });
  });

  describe('el desplegable de directorio (24/09/2026)', () => {
    function opciones(): string[] {
      const select = root().querySelector<HTMLSelectElement>('app-filter-bar select');
      return [...(select?.options ?? [])]
        .filter((opcion) => !opcion.hidden)
        .map((opcion) => opcion.textContent?.trim() ?? '');
    }

    it('va en la misma fila que el buscador, con «Todos» y los cuatro directorios', () => {
      abrirSesion(['PRACTITIONER']);
      crear();

      const controles = root().querySelector('app-filter-bar .filter-bar__controls');
      expect(controles?.querySelector('app-search-field')).not.toBeNull();
      expect(controles?.querySelector('select')).not.toBeNull();
      expect(opciones()).toEqual([
        'Todos los directorios',
        'Médicos',
        'Laboratorios',
        'Clínicas',
        'Farmacias',
      ]);
    });

    it('con un directorio elegido, el término busca sólo en ése', async () => {
      abrirSesion(['PRACTITIONER']);
      await TestBed.inject(Router).navigateByUrl(
        '/directories?q=central&directorio=laboratory-directory',
      );
      crear();

      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne((pedido) => pedido.url.endsWith('/diagnostic-units/search'))
        .flush({ items: [], total: 0, limit: 50, offset: 0 });
      http.expectNone((pedido) => pedido.url.includes('/public/search/'));
      http.verify();

      expect(root().querySelector('app-search-field')?.textContent).toContain(
        'Buscar laboratorios por nombre',
      );
    });

    it('sin término, el directorio elegido deja sólo su nodo', async () => {
      abrirSesion(['PATIENT']);
      await TestBed.inject(Router).navigateByUrl('/directories?directorio=pharmacies-directory');
      crear();

      const enlaces = [...root().querySelectorAll<HTMLAnchorElement>('.rejilla__tarjeta')];
      expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toEqual([
        '/pharmacies-directory',
      ]);
    });

    it('un valor que no es un directorio de la sesión se lee como «todos»', async () => {
      abrirSesion(['PATIENT']);
      await TestBed.inject(Router).navigateByUrl('/directories?directorio=no-existe');
      crear();

      expect(root().querySelectorAll('.rejilla__tarjeta').length).toBe(4);
    });
  });
});

const PAGINA_VACIA = {
  items: [],
  nextCursor: null,
  totalHint: 0,
  generatedAt: '2026-09-19T00:00:00Z',
};
