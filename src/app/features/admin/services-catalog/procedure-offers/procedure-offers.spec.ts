import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { HealthcareServiceOffer } from '../../../../core/data-access/healthcare-services/healthcare-services.types';
import { ProcedureOffers } from './procedure-offers';

const ROUTE = '/administration/services-catalog/procedure-offers';
const PRACTICES = [
  { id: 'pr1', code: 'P1', name: 'Centro Norte' },
  { id: 'pr2', code: 'P2', name: 'Centro Sur' },
];
const SITES = [
  { id: 'si1', name: 'Sede 1', code: 'S1' },
  { id: 'si2', name: 'Sede 2', code: 'S2' },
];

function offer(overrides: Partial<HealthcareServiceOffer> = {}): HealthcareServiceOffer {
  return {
    id: 'o1',
    practiceSiteId: 'si1',
    serviceConceptId: 'c1',
    serviceDisplay: 'Endoscopía digestiva alta',
    serviceCatalogId: 'sc1',
    price: 350,
    currencyConceptId: null,
    referencePrice: 20,
    referenceUnit: 'UMA',
    overMargin: null,
    visibleInSearch: true,
    active: true,
    ...overrides,
  };
}

const NOMENCLATURE_ITEM = {
  conceptId: 'c2',
  code: 'SCZ-0001',
  display: 'Colonoscopía total',
  specialty: 'Gastroenterología',
  group: 'Gastroenterología',
  referencePrice: '25',
  priceUnit: 'UMA',
  ocrSuspect: false,
};

describe('ProcedureOffers', () => {
  let harness: RouterTestingHarness;
  let component: ProcedureOffers;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/services-catalog/procedure-offers', component: ProcedureOffers }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl(ROUTE, ProcedureOffers);
  });

  afterEach(() => http.verify());

  function internal<T>(name: string): T {
    const value = (component as unknown as Record<string, unknown>)[name];
    return (typeof value === 'function' ? value.bind(component) : value) as T;
  }

  const sitesState = (): { status: string; message?: string } => internal<() => { status: string }>('sitesState')();
  const offersState = (): { status: string } => internal<() => { status: string }>('offersState')();
  const publishState = (): { status: string; issues?: { message: string }[] } =>
    internal<() => { status: string }>('publishState')();
  const items = (): HealthcareServiceOffer[] => internal<() => HealthcareServiceOffer[]>('offerItems')();

  function answerPractices(list: unknown[] = PRACTICES): void {
    http.expectOne((r) => r.url === '/practices').flush(list);
    harness.detectChanges();
  }

  function answerSites(practiceId: string, list: unknown[] = SITES): void {
    http.expectOne((r) => r.url === `/practices/${practiceId}/sites`).flush(list);
    harness.detectChanges();
  }

  function offersRequest(practiceId: string) {
    return http.expectOne((r) => r.url === `/practices/${practiceId}/healthcare-services` && r.method === 'GET');
  }

  /** Deja la pantalla con la sede 1 de la práctica 1 y sus procedimientos cargados. */
  function load(published: HealthcareServiceOffer[] = [offer()]): void {
    answerPractices();
    answerSites('pr1');
    offersRequest('pr1').flush({ items: published });
    harness.detectChanges();
  }

  function choose(): void {
    internal<(q: string) => void>('searchProcedures')('colon');
    http
      .expectOne((r) => r.url === '/billing/service-catalog/procedures')
      .flush({ items: [NOMENCLATURE_ITEM], nextCursor: null });
    internal<(o: { value: string; label: string }) => void>('chooseProcedure')({
      value: 'c2',
      label: 'Colonoscopía total',
    });
  }

  it('sin sedes cargadas no pide procedimientos; al elegir la sede pide los suyos', () => {
    answerPractices();
    http.expectNone((r) => r.url.endsWith('/healthcare-services'));

    answerSites('pr1');
    const req = offersRequest('pr1');
    expect(req.request.params.get('practiceSiteId')).toBe('si1');
    req.flush({ items: [] });
  });

  it('cambiar de sede pide la lista de la nueva sede', () => {
    load();
    internal<(id: string) => void>('changeSite')('si2');
    harness.detectChanges();

    const req = offersRequest('pr1');
    expect(req.request.params.get('practiceSiteId')).toBe('si2');
    req.flush({ items: [] });
  });

  it('pinta cada fila con su referencia con unidad y «No aparece en búsquedas» si no hay precio', () => {
    load([
      offer(),
      offer({
        id: 'o2',
        serviceDisplay: 'Colonoscopía',
        serviceCatalogId: null,
        price: null,
        visibleInSearch: false,
        referencePrice: null,
        referenceUnit: null,
      }),
    ]);

    const root = harness.routeNativeElement as HTMLElement;
    const rows = root.querySelectorAll('[data-testid="procedure-offer-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0]?.textContent).toContain('Referencia: 20 UMA');
    expect(rows[0]?.textContent).toContain('350 Bs');
    expect(rows[0]?.querySelector('[data-testid="procedure-offer-visibility"]')).toBeNull();
    expect(rows[1]?.textContent).toContain('Sin referencia');
    expect(rows[1]?.querySelector('[data-testid="procedure-offer-visibility"]')?.textContent).toContain(
      'No aparece en búsquedas',
    );
    expect(root.querySelector('[data-testid="procedure-offer-over-margin"]')).toBeNull();
  });

  it('con overMargin en true pinta el aviso; en null no pinta nada', () => {
    load([offer({ overMargin: true })]);
    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="procedure-offer-over-margin"]')).not.toBeNull();
  });

  it('una organización sin sedes es S3 con próxima acción', () => {
    answerPractices();
    answerSites('pr1', []);
    expect(sitesState().status).toBe('empty');
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Dar de alta una sede');
  });

  it('un 403 de otra organización es S5 (prohibido), no S6', () => {
    answerPractices();
    http
      .expectOne((r) => r.url === '/practices/pr1/sites')
      .flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'No administra esta organización', error: 'Forbidden' },
        { status: 403, statusText: 'Forbidden' },
      );
    harness.detectChanges();

    expect(sitesState().status).toBe('forbidden');
  });

  it('el buscador sólo consulta el nomenclador y no deja publicar sin elegir uno', () => {
    load();
    internal<() => void>('publish')();
    http.expectNone((r) => r.method === 'POST');
    expect(internal<() => boolean>('procedureMissing')()).toBe(true);

    choose();
    expect(internal<() => { conceptId: string } | null>('chosenProcedure')()?.conceptId).toBe('c2');
    expect(internal<() => boolean>('procedureMissing')()).toBe(false);
  });

  it('publicar sin precio envía sólo sede y concepto y agrega la fila sin recargar', () => {
    load([offer()]);
    choose();
    internal<() => void>('publish')();

    const req = http.expectOne((r) => r.url === '/practices/pr1/healthcare-services' && r.method === 'POST');
    expect(req.request.body).toEqual({ practiceSiteId: 'si1', serviceConceptId: 'c2' });
    req.flush(
      offer({ id: 'o2', serviceConceptId: 'c2', serviceDisplay: 'Colonoscopía total', serviceCatalogId: null, price: null, visibleInSearch: false }),
      { status: 201, statusText: 'Created' },
    );
    harness.detectChanges();

    expect(items().map((o) => o.id)).toEqual(['o1', 'o2']);
    http.expectNone((r) => r.method === 'GET');
    expect(internal<() => number>('selectedTab')()).toBe(0);
  });

  it('publicar con precio crea primero el precio y manda su id como serviceCatalogId', () => {
    load([]);
    choose();
    (internal<{ setValue: (v: string) => void }>('publishPrice')).setValue('350,5');
    internal<() => void>('publish')();

    const catalog = http.expectOne((r) => r.url === '/billing/service-catalog' && r.method === 'POST');
    expect(catalog.request.body).toMatchObject({
      practiceId: 'pr1',
      code: 'SCZ-0001@S1',
      serviceConceptId: 'c2',
      defaultPrice: '350.50',
    });
    catalog.flush({ id: 'sc9', practiceId: 'pr1', code: 'SCZ-0001@S1', name: 'x', defaultPrice: '350.50', isActive: true });

    const create = http.expectOne((r) => r.url === '/practices/pr1/healthcare-services' && r.method === 'POST');
    expect(create.request.body).toEqual({ practiceSiteId: 'si1', serviceConceptId: 'c2', serviceCatalogId: 'sc9' });
    create.flush(offer({ id: 'o9', serviceConceptId: 'c2', serviceCatalogId: 'sc9', price: 350.5 }), {
      status: 201,
      statusText: 'Created',
    });
    expect(items().map((o) => o.id)).toEqual(['o9']);
  });

  it('un 409 se muestra como S4 con el texto de la API, conserva lo escrito y desactiva el precio huérfano', () => {
    load([offer({ serviceConceptId: 'c2' })]);
    choose();
    internal<{ setValue: (v: string) => void }>('publishPrice').setValue('400');
    internal<() => void>('publish')();

    http
      .expectOne((r) => r.url === '/billing/service-catalog' && r.method === 'POST')
      .flush({ id: 'sc10', practiceId: 'pr1', code: 'x', name: 'x', defaultPrice: '400.00', isActive: true });
    http
      .expectOne((r) => r.url === '/practices/pr1/healthcare-services' && r.method === 'POST')
      .flush(
        { statusCode: 409, code: 'CONFLICT', message: 'Este procedimiento ya está publicado en esta sede', error: 'Conflict' },
        { status: 409, statusText: 'Conflict' },
      );
    const compensation = http.expectOne((r) => r.url === '/billing/service-catalog/sc10' && r.method === 'PATCH');
    expect(compensation.request.body).toEqual({ isActive: false });
    compensation.flush({});
    harness.detectChanges();

    expect(publishState().status).toBe('validation');
    expect(publishState().issues?.[0]?.message).toBe('Este procedimiento ya está publicado en esta sede');
    // Lo escrito sigue ahí.
    expect(internal<() => { conceptId: string } | null>('chosenProcedure')()?.conceptId).toBe('c2');
    expect(internal<{ value: string }>('publishPrice').value).toBe('400');
    expect(items().length).toBe(1);
  });

  it('un 422 se muestra como S4 con el mensaje de la API', () => {
    load([]);
    choose();
    internal<() => void>('publish')();
    http
      .expectOne((r) => r.url === '/practices/pr1/healthcare-services' && r.method === 'POST')
      .flush(
        { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'El procedimiento no pertenece al nomenclador', error: 'Unprocessable' },
        { status: 422, statusText: 'Unprocessable' },
      );

    expect(publishState().status).toBe('validation');
    expect(publishState().issues?.[0]?.message).toBe('El procedimiento no pertenece al nomenclador');
  });

  it('el conmutador envía PATCH { active } y la fila refleja lo que devuelve la API', () => {
    load([offer()]);
    internal<(o: HealthcareServiceOffer, active: boolean) => void>('toggleActive')(offer(), false);

    const req = http.expectOne((r) => r.url === '/practices/pr1/healthcare-services/o1' && r.method === 'PATCH');
    expect(req.request.body).toEqual({ active: false });
    req.flush(offer({ active: false, visibleInSearch: false }));
    harness.detectChanges();

    expect(items()[0]).toMatchObject({ active: false, visibleInSearch: false });
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('No aparece en búsquedas');
  });

  it('fijar el precio de una fila sin precio crea el ítem y lo enlaza con PATCH { serviceCatalogId }', () => {
    load([offer({ serviceCatalogId: null, price: null, visibleInSearch: false })]);
    internal<(o: HealthcareServiceOffer) => void>('openPriceEditor')(items()[0]!);
    internal<{ setValue: (v: string) => void }>('priceEditControl').setValue('280');
    internal<() => void>('savePrice')();

    http
      .expectOne((r) => r.url === '/billing/service-catalog' && r.method === 'POST')
      .flush({ id: 'sc11', practiceId: 'pr1', code: 'x', name: 'x', defaultPrice: '280.00', isActive: true });
    const patch = http.expectOne((r) => r.url === '/practices/pr1/healthcare-services/o1' && r.method === 'PATCH');
    expect(patch.request.body).toEqual({ serviceCatalogId: 'sc11' });
    patch.flush(offer({ serviceCatalogId: 'sc11', price: 280, visibleInSearch: true }));

    expect(items()[0]).toMatchObject({ price: 280, visibleInSearch: true });
    expect(internal<() => unknown>('priceEditing')()).toBeNull();
  });

  it('un error al cargar los procedimientos de la sede deja S9 con reintento', () => {
    answerPractices();
    answerSites('pr1');
    offersRequest('pr1').flush({}, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(offersState().status).toBe('error');
    internal<() => void>('reloadOffers')();
    offersRequest('pr1').flush({ items: [] });
  });
});
