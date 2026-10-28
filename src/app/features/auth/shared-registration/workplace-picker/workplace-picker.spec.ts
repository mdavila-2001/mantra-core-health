import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { HttpErrorResponse } from '@angular/common/http';

import { aseguradorasInactivas, lugaresDelBorrador, WorkplacePicker } from './workplace-picker';

/**
 * El selector de instituciones y aseguradoras del alta de médico.
 *
 * Lo que fijan: busca en el directorio público, elige de a una sin repetir y
 * muestra los DOS sellos por institución (el suyo y el del vínculo, que todavía
 * no existe); las aseguradoras salen del catálogo público y su caída no tumba
 * el alta.
 */
describe('WorkplacePicker', () => {
  let fixture: ComponentFixture<WorkplacePicker>;
  let http: HttpTestingController;

  const CATALOGO = {
    carriers: [
      { id: 'car-cns', code: 'CNS', name: 'CNS', legalName: 'Caja', isPublic: true, plans: [] },
      {
        id: 'car-and',
        code: 'AND',
        name: 'Seguros Andina',
        legalName: 'Andina',
        isPublic: false,
        plans: [],
      },
    ],
  };

  const RESULTADO = {
    kind: 'ORGANIZATION',
    slug: 'clinica-foianini',
    displayName: 'Clínica Foianini',
    headline: null,
    city: 'Santa Cruz',
    avatarUrl: null,
    verified: true,
    ratingAverage: null,
    ratingCount: 0,
  };

  function montar(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WorkplacePicker);
    fixture.detectChanges();
  }

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function porTestId(id: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  }

  function buscarYElegir(): void {
    interno<(q: string) => void>('buscar')('foia');
    const req = http.expectOne((r) => r.url === '/public/search/organizations');
    expect(req.request.params.get('q')).toBe('foia');
    req.flush({ items: [RESULTADO], nextCursor: null });
    interno<(o: { value: string; label: string } | null) => void>('elegir')({
      value: 'clinica-foianini',
      label: 'Clínica Foianini',
    });
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('las aseguradoras salen del catálogo público: privadas primero, públicas rotuladas', () => {
    montar();
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    fixture.detectChanges();

    const opciones = interno<() => readonly { label: string }[]>('opcionesDeSeguro')();
    expect(opciones.map((o) => o.label)).toEqual(['Seguros Andina', 'CNS (seguro público)']);
  });

  it('elegir una institución la suma con su sello y el aviso de que el vínculo todavía no está confirmado', () => {
    montar();
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    buscarYElegir();

    expect(fixture.componentInstance.institutions()).toEqual([
      { slug: 'clinica-foianini', name: 'Clínica Foianini', city: 'Santa Cruz', verified: true },
    ]);
    const fila = porTestId('registro-pro-institucion-clinica-foianini')!;
    expect(fila.textContent).toContain('Institución verificada');
    expect(fila.textContent).toContain('sin confirmar todavía');
  });

  it('la ya elegida no se vuelve a ofrecer ni se duplica', () => {
    montar();
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    buscarYElegir();

    expect(interno<() => readonly unknown[]>('opciones')()).toEqual([]);
    interno<(o: { value: string; label: string }) => void>('elegir')({
      value: 'clinica-foianini',
      label: 'Clínica Foianini',
    });
    expect(fixture.componentInstance.institutions()).toHaveLength(1);
  });

  it('quitar la saca de la lista', () => {
    montar();
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    buscarYElegir();

    (porTestId('registro-pro-quitar-institucion-clinica-foianini') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.institutions()).toEqual([]);
  });

  it('sin catálogo de aseguradoras ofrece reintentar y el reintento lo recupera', () => {
    montar();
    http.expectOne('/insurance-carrier-catalog').flush(null, { status: 503, statusText: 'Caída' });
    fixture.detectChanges();
    expect(porTestId('registro-pro-seguros-error')).not.toBeNull();

    (porTestId('registro-pro-seguros-reintentar') as HTMLButtonElement).click();
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    fixture.detectChanges();

    expect(porTestId('registro-pro-seguros-error')).toBeNull();
    expect(porTestId('registro-pro-seguros')).not.toBeNull();
  });

  it('una búsqueda nueva cancela la anterior: una respuesta vieja no pisa la vigente', () => {
    montar();
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);

    interno<(q: string) => void>('buscar')('cl');
    const vieja = http.expectOne((r) => r.url === '/public/search/organizations');
    interno<(q: string) => void>('buscar')('clínica foi');
    const vigente = http.expectOne(
      (r) => r.url === '/public/search/organizations' && r.params.get('q') === 'clínica foi',
    );
    expect(vieja.cancelled).toBe(true);

    vigente.flush({ items: [RESULTADO], nextCursor: null });
    expect(interno<() => readonly { value: string }[]>('opciones')().map((o) => o.value)).toEqual([
      'clinica-foianini',
    ]);
    expect(interno<() => boolean>('buscando')()).toBe(false);
  });

  it('lo restaurado que ya no está en el catálogo no viaja; sin catálogo, no viaja nada', () => {
    montar();
    fixture.componentInstance.insurerIds.set(['car-and', 'car-dada-de-baja']);
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    expect(fixture.componentInstance.insurerIds()).toEqual(['car-and']);

    montar();
    fixture.componentInstance.insurerIds.set(['car-and']);
    http.expectOne('/insurance-carrier-catalog').flush(null, { status: 503, statusText: 'Caída' });
    expect(fixture.componentInstance.insurerIds()).toEqual([]);
  });

  it('con una sola letra no busca: la pista pide dos', () => {
    montar();
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    interno<(q: string) => void>('buscar')('c');
    http.expectNone((r) => r.url === '/public/search/organizations');
  });

  it('el borrador se valida entrada por entrada, no con un `as`', () => {
    expect(
      lugaresDelBorrador({
        institucionesElegidas: [
          { slug: 'a', name: 'A', city: null, verified: true },
          { name: 'sin slug' },
          7,
        ],
        aseguradorasElegidas: ['car-and', 3, null],
      }),
    ).toEqual({
      institutions: [{ slug: 'a', name: 'A', city: null, verified: true }],
      insurerIds: ['car-and'],
    });
    expect(lugaresDelBorrador({})).toEqual({ institutions: [], insurerIds: [] });
  });

  it('un 422 del alta con aseguradoras inactivas dice cuáles quitar', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: {
        statusCode: 422,
        code: 'PRECONDITION_FAILED',
        message: 'inactiva',
        details: { carrierIds: ['car-x'] },
      },
    });
    expect(aseguradorasInactivas(error)).toEqual(['car-x']);
    expect(aseguradorasInactivas(new HttpErrorResponse({ status: 500 }))).toEqual([]);
  });

  it('una búsqueda caída avisa sin borrar lo ya elegido', () => {
    montar();
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    buscarYElegir();

    interno<(q: string) => void>('buscar')('hosp');
    http
      .expectOne((r) => r.url === '/public/search/organizations')
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(porTestId('registro-pro-instituciones-error')).not.toBeNull();
    expect(fixture.componentInstance.institutions()).toHaveLength(1);
  });
});
