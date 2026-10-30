import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { crearBuscadorDePersonas } from './people-search';

const PAGINA = (nombre: string) => ({
  items: [{ id: `u-${nombre}`, displayName: nombre, emailVerified: true, createdAt: '2026-01-01T00:00:00Z' }],
  count: 1,
  limit: 10,
  nextCursor: null,
});

describe('crearBuscadorDePersonas', () => {
  let http: HttpTestingController;
  let buscador: ReturnType<typeof crearBuscadorDePersonas>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    buscador = TestBed.runInInjectionContext(() => crearBuscadorDePersonas(10));
  });

  afterEach(() => http.verify());

  it('traduce la página a opciones y apaga la carga', () => {
    buscador.buscar('ana');
    expect(buscador.buscando()).toBe(true);

    http.expectOne('/iam/users/search').flush(PAGINA('Ana'));

    expect(buscador.candidatos()).toEqual([{ value: 'u-Ana', label: 'Ana' }]);
    expect(buscador.buscando()).toBe(false);
    expect(buscador.error()).toBeNull();
  });

  it('un 403 no es «ninguna cuenta coincide»: deja el motivo y ninguna opción', () => {
    buscador.buscar('ana');
    http
      .expectOne('/iam/users/search')
      .flush({ code: 'FORBIDDEN', message: 'Sin permiso' }, { status: 403, statusText: 'Forbidden' });

    expect(buscador.candidatos()).toEqual([]);
    expect(buscador.error()).toContain('No pudimos buscar personas');
  });

  it('un 500 lleva el código de la petición', () => {
    buscador.buscar('ana');
    http
      .expectOne('/iam/users/search')
      .flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-9' }, { status: 500, statusText: 'Error' });

    expect(buscador.error()).toContain('req-9');
  });

  it('un corte de red se dice como tal', () => {
    buscador.buscar('ana');
    http.expectOne('/iam/users/search').error(new ProgressEvent('error'), { status: 0 });

    expect(buscador.error()).toContain('revise su conexión');
  });

  it('la última tecla manda: la respuesta de una búsqueda vieja no pisa la nueva', () => {
    buscador.buscar('an');
    const vieja = http.expectOne((r) => r.body?.q === 'an');
    buscador.buscar('ana');
    const nueva = http.expectOne((r) => r.body?.q === 'ana');

    expect(vieja.cancelled).toBe(true);
    nueva.flush(PAGINA('Ana'));
    expect(buscador.candidatos().map((o) => o.label)).toEqual(['Ana']);
  });

  it('una búsqueda nueva borra el error de la anterior', () => {
    buscador.buscar('ana');
    http.expectOne('/iam/users/search').flush({}, { status: 500, statusText: 'Error' });
    expect(buscador.error()).not.toBeNull();

    buscador.buscar('anabel');
    expect(buscador.error()).toBeNull();
    http.expectOne('/iam/users/search').flush(PAGINA('Anabel'));
  });

  it('el texto vacío limpia sin salir a la red', () => {
    buscador.buscar('');
    http.expectNone('/iam/users/search');
    expect(buscador.candidatos()).toEqual([]);
    expect(buscador.buscando()).toBe(false);
  });
});
