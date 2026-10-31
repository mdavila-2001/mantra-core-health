import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { PRESCRIPTION_DISPENSE_TESTIDS as IDS } from '../prescription-dispense.testids';
import { PrescriptionItem } from '../prescription-item/prescription-item';
import { OpenPrescription } from './open-prescription';

/** Un token sintético con la forma del real (base64url, 43 caracteres). */
const TOKEN = 'TkSynthetic0123456789abcdefghijklmnopqrstuv';
const OPEN_URL = `/pharmacy/prescription-shares/${TOKEN}`;

const PHARMACY_ID = '00000000-0000-4000-8000-0000000000a1';
const CENTER_ID = '00000000-0000-4000-8000-0000000000b1';
const NORTH_ID = '00000000-0000-4000-8000-0000000000b2';
const PRODUCT_ID = '00000000-0000-4000-8000-0000000000c1';
const PUT_CENTER_URL = `/pharmacies/${PHARMACY_ID}/sites/${CENTER_ID}/products/${PRODUCT_ID}/availability`;

/** La respuesta de la API con dos ítems, uno sin productos. Datos sintéticos. */
function share(overrides: { outOfStockDeclared?: boolean; items?: unknown[] } = {}): Record<string, unknown> {
  return {
    shareId: 'sh-1',
    issuedAt: '2026-10-20T14:00:00.000Z',
    validTo: '2026-11-19T14:00:00.000Z',
    prescriber: {
      name: 'Dra. Prueba Sintética',
      license: { number: 'MP-0001', authority: null, state: 'ACTIVE' },
    },
    patient: { maskedName: 'L. P. Q.', documentLast3: '123', fullName: 'Nombre Completo Sintético' },
    items: overrides.items ?? [
      {
        medicationRequestId: 'mr-1',
        medicationConceptId: 'mc-1',
        display: 'Jarabe de prueba 100 ml',
        dosageText: '5 ml cada 8 horas',
        prescribedQuantity: 2,
        unitCode: 'UNIT_{bottle}',
        dispensedQuantity: 1,
        remainingQuantity: 1,
        matches: [
          {
            pharmacyId: PHARMACY_ID,
            pharmacyProductId: PRODUCT_ID,
            name: 'Marca de prueba',
            price: '35.50',
            currencyCode: 'pharmacy:CURRENCY_BOB',
            requiresPrescription: true,
            outOfStockDeclared: overrides.outOfStockDeclared ?? false,
            sites: [
              { siteId: CENTER_ID, siteName: 'Sede Centro', available: true, quantity: 4, stockUpdatedAt: null },
              { siteId: NORTH_ID, siteName: 'Sede Norte', available: false, quantity: 0, stockUpdatedAt: null },
            ],
          },
        ],
      },
      {
        medicationRequestId: 'mr-2',
        medicationConceptId: 'mc-2',
        display: 'Crema de prueba',
        dosageText: 'Una vez al día',
        prescribedQuantity: 30,
        unitCode: 'UNIT_{g}',
        dispensedQuantity: null,
        remainingQuantity: null,
        matches: [],
      },
    ],
  };
}

/**
 * El mismo jarabe en dos ítems de la receta: la API repite en los dos el
 * total del fármaco (4 frascos, quedan 4) y los mismos productos y sedes.
 */
function sameDrugShare(): Record<string, unknown> {
  const base = share();
  const [first] = base['items'] as Record<string, unknown>[];
  const repeated = { ...first, prescribedQuantity: 4, dispensedQuantity: 0, remainingQuantity: 4 };
  base['items'] = [
    { ...repeated, medicationRequestId: 'mr-1' },
    { ...repeated, medicationRequestId: 'mr-3', dosageText: '10 ml por la noche' },
  ];
  return base;
}

/** El cuerpo de error de la API (`docs/api/error-model.md`), sintético. */
function apiError(code: string, message: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { code, message, timestamp: '2026-10-30T10:00:00.000Z', path: '/redactado', ...extra };
}

/**
 * «Abrir receta» de la farmacia (REQ-FAR-02-008, 009, 011).
 *
 * Lo que fijan estas pruebas: la cabecera con el paciente enmascarado y nada
 * más suyo aunque la respuesta lo trajera; cada estado con su texto (404, 410
 * revocado y vencido, 403, error con su código, receta sin ítems); y el
 * interruptor optimista: deshabilitado en vuelo, con 200 lo que devolvió la
 * API, con error vuelve atrás y dice el motivo de la API.
 */
describe('OpenPrescription', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token: TOKEN }) } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function mount(): ComponentFixture<OpenPrescription> {
    const fixture = TestBed.createComponent(OpenPrescription);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<OpenPrescription>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function byTestId(fixture: ComponentFixture<OpenPrescription>, id: string): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(`[data-testid="${id}"]`));
  }

  function opened(body: Record<string, unknown> = share()): ComponentFixture<OpenPrescription> {
    const fixture = mount();
    http.expectOne(OPEN_URL).flush(body);
    fixture.detectChanges();
    return fixture;
  }

  function failWith(status: number, body: Record<string, unknown>): ComponentFixture<OpenPrescription> {
    const fixture = mount();
    http.expectOne(OPEN_URL).flush(body, { status, statusText: 'Error' });
    fixture.detectChanges();
    return fixture;
  }

  /** El interruptor de la Sede Centro del primer producto. */
  function centerSwitch(fixture: ComponentFixture<OpenPrescription>): HTMLInputElement {
    return byTestId(fixture, IDS.siteToggle)[0].querySelector('input') as HTMLInputElement;
  }

  it('mientras abre muestra la carga y pide la receta por su token', () => {
    const fixture = mount();

    expect(fixture.nativeElement.querySelector('.view-state-host__loading')).not.toBeNull();
    const req = http.expectOne(OPEN_URL);
    expect(req.request.method).toBe('GET');
    req.flush(share());
  });

  it('la cabecera dice quién recetó, cuándo y el paciente enmascarado, sin nada más suyo', () => {
    const fixture = opened();

    const header = byTestId(fixture, IDS.header)[0].textContent ?? '';
    expect(header).toContain('Dra. Prueba Sintética · matrícula MP-0001');
    expect(header).toContain('20/10/2026');
    expect(header).toContain('19/11/2026');
    expect(header).toContain('L. P. Q.');
    expect(header).toContain('terminado en 123');
    expect(text(fixture)).not.toContain('Nombre Completo Sintético');
  });

  it('un ítem por pestaña; el que no tiene productos lo dice', () => {
    const fixture = opened();

    const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLElement[];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Jarabe de prueba 100 ml', 'Crema de prueba']);

    tabs[1].click();
    fixture.detectChanges();
    expect(text(fixture)).toContain('No tiene este medicamento en su catálogo.');
    expect(text(fixture)).toContain('Sin control de cantidad');
  });

  it('404: «Este enlace no existe»', () => {
    const fixture = failWith(404, apiError('NOT_FOUND', 'Enlace no encontrado'));

    expect(byTestId(fixture, IDS.notFound)[0].textContent).toContain('Este enlace no existe');
  });

  it('404 de una organización sin farmacia verificada lo dice, sin hablar del enlace', () => {
    const fixture = failWith(
      404,
      apiError('NOT_FOUND', 'Esta organización no tiene una farmacia verificada.', {
        reason: 'PHARMACY_INVENTORY_RESOURCE_NOT_AVAILABLE',
      }),
    );

    const box = byTestId(fixture, IDS.notFound)[0].textContent ?? '';
    expect(box).toContain('Su organización no tiene una farmacia verificada');
    expect(box).not.toContain('Este enlace no existe');
  });

  it('410 revocado: «El paciente dejó de compartir esta receta», con su código de soporte', () => {
    const fixture = failWith(
      410,
      apiError('PRECONDITION_FAILED', 'El paciente dejó de compartir esta receta.', {
        reason: 'PRESCRIPTION_SHARE_REVOKED',
        details: { reason: 'PRESCRIPTION_SHARE_REVOKED' },
        correlationId: 'req-410-a',
      }),
    );

    const box = byTestId(fixture, IDS.closed)[0].textContent ?? '';
    expect(box).toContain('El paciente dejó de compartir esta receta');
    expect(box).toContain('req-410-a');
    expect(text(fixture)).not.toContain('Revise lo ingresado');
  });

  it('410 vencido: «Esta receta venció» (el reason también puede venir solo en details)', () => {
    const fixture = failWith(
      410,
      apiError('PRECONDITION_FAILED', 'Esta receta venció.', {
        details: { reason: 'PRESCRIPTION_SHARE_EXPIRED' },
      }),
    );

    expect(byTestId(fixture, IDS.closed)[0].textContent).toContain('Esta receta venció');
  });

  it('403: la cuenta no puede abrir recetas', () => {
    const fixture = failWith(403, apiError('FORBIDDEN', 'Permisos insuficientes'));

    expect(byTestId(fixture, IDS.closed)[0].textContent).toContain('Esta cuenta no puede abrir recetas');
  });

  it('error inesperado: «Algo salió mal» con su requestId', () => {
    const fixture = failWith(500, apiError('INTERNAL', 'Error interno', { correlationId: 'req-500-b' }));

    expect(text(fixture)).toContain('Algo salió mal');
    expect(text(fixture)).toContain('req-500-b');
  });

  it('una receta sin ítems vigentes es un vacío con salida a la bandeja', () => {
    const fixture = opened(share({ items: [] }));

    expect(text(fixture)).toContain('La receta no tiene medicamentos vigentes.');
    expect(text(fixture)).toContain('Volver a la bandeja');
  });

  it('«No lo tengo»: deshabilitado mientras viaja y, con 200, lo que devolvió la API', () => {
    const fixture = opened();

    centerSwitch(fixture).click();
    fixture.detectChanges();

    const req = http.expectOne(PUT_CENTER_URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ available: false });
    expect(centerSwitch(fixture).disabled).toBe(true);
    expect(centerSwitch(fixture).checked).toBe(false);

    req.flush({
      siteId: CENTER_ID,
      productId: PRODUCT_ID,
      available: false,
      quantity: 0,
      stockUpdatedAt: '2026-10-30T09:00:00.000Z',
    });
    fixture.detectChanges();

    expect(centerSwitch(fixture).disabled).toBe(false);
    expect(centerSwitch(fixture).checked).toBe(false);
    const center = byTestId(fixture, IDS.site)[0].textContent ?? '';
    expect(center).toContain('No lo tengo');
    expect(center).toContain('Sin unidades');
    expect(center).toContain('30/10/2026');
  });

  it('con 200 muestra lo que dice la API aunque no sea lo pedido', () => {
    const fixture = opened();
    const north = () => byTestId(fixture, IDS.siteToggle)[1].querySelector('input') as HTMLInputElement;

    north().click();
    fixture.detectChanges();
    http
      .expectOne(`/pharmacies/${PHARMACY_ID}/sites/${NORTH_ID}/products/${PRODUCT_ID}/availability`)
      .flush({ siteId: NORTH_ID, productId: PRODUCT_ID, available: true, quantity: 5, stockUpdatedAt: null });
    fixture.detectChanges();

    expect(north().checked).toBe(true);
    expect(byTestId(fixture, IDS.site)[1].textContent).toContain('5 unidades');
  });

  it('con error vuelve a lo que tenía y dice el motivo de la API', () => {
    const fixture = opened();

    centerSwitch(fixture).click();
    fixture.detectChanges();
    http
      .expectOne(PUT_CENTER_URL)
      .flush(
        apiError('PRECONDITION_FAILED', 'El producto está marcado sin stock en toda la farmacia.', {
          reason: 'PRODUCT_OUT_OF_STOCK_DECLARED',
        }),
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(centerSwitch(fixture).checked).toBe(true);
    expect(centerSwitch(fixture).disabled).toBe(false);
    const failure = byTestId(fixture, IDS.siteFailure)[0].textContent ?? '';
    expect(failure).toContain('No se pudo guardar. Sigue como estaba.');
    expect(failure).toContain('El producto está marcado sin stock en toda la farmacia.');
    expect(byTestId(fixture, IDS.site)[0].textContent).toContain('4 unidades');
  });

  it('un nuevo intento borra el aviso del fallo anterior', () => {
    const fixture = opened();

    centerSwitch(fixture).click();
    fixture.detectChanges();
    http.expectOne(PUT_CENTER_URL).flush(apiError('INTERNAL', 'Error interno'), {
      status: 500,
      statusText: 'Error',
    });
    fixture.detectChanges();
    expect(byTestId(fixture, IDS.siteFailure)).toHaveLength(1);

    centerSwitch(fixture).click();
    fixture.detectChanges();
    expect(byTestId(fixture, IDS.siteFailure)).toHaveLength(0);
    http
      .expectOne(PUT_CENTER_URL)
      .flush({ siteId: CENTER_ID, productId: PRODUCT_ID, available: false, quantity: 0, stockUpdatedAt: null });
  });

  it('el mismo fármaco en dos ítems: pestañas numeradas y cantidades del medicamento en toda la receta', () => {
    const fixture = opened(sameDrugShare());

    const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLElement[];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Jarabe de prueba 100 ml (1)',
      'Jarabe de prueba 100 ml (2)',
    ]);
    expect(text(fixture)).toContain('Recetado en total: 4 frascos');
    expect(byTestId(fixture, IDS.itemBalance)[0].textContent?.trim()).toBe(
      'Quedan 4 de 4, entre los 2 ítems de este medicamento',
    );
  });

  it('la misma sede en dos ítems: lo que devuelve la API se ve en los dos', () => {
    const fixture = opened(sameDrugShare());

    centerSwitch(fixture).click();
    fixture.detectChanges();
    http
      .expectOne(PUT_CENTER_URL)
      .flush({ siteId: CENTER_ID, productId: PRODUCT_ID, available: false, quantity: 0, stockUpdatedAt: null });
    fixture.detectChanges();
    expect(centerSwitch(fixture).checked).toBe(false);

    (fixture.nativeElement.querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    fixture.detectChanges();

    expect(centerSwitch(fixture).checked).toBe(false);
    expect(byTestId(fixture, IDS.site)[0].textContent).toContain('Sin unidades');
  });

  it('dos sedes en vuelo a la vez: cada una queda con lo suyo (una 200, la otra vuelve atrás)', () => {
    const fixture = opened();
    const toggles = () =>
      byTestId(fixture, IDS.siteToggle).map((toggle) => toggle.querySelector('input') as HTMLInputElement);

    toggles()[0].click();
    toggles()[1].click();
    fixture.detectChanges();
    expect(toggles().map((input) => input.disabled)).toEqual([true, true]);

    const northUrl = `/pharmacies/${PHARMACY_ID}/sites/${NORTH_ID}/products/${PRODUCT_ID}/availability`;
    http.expectOne(northUrl).flush(apiError('INTERNAL', 'Error interno'), { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(toggles()[0].disabled).toBe(true);
    expect(toggles()[1].disabled).toBe(false);

    http
      .expectOne(PUT_CENTER_URL)
      .flush({ siteId: CENTER_ID, productId: PRODUCT_ID, available: false, quantity: 0, stockUpdatedAt: null });
    fixture.detectChanges();

    expect(toggles().map((input) => input.checked)).toEqual([false, false]);
    expect(toggles().map((input) => input.disabled)).toEqual([false, false]);
    const failures = byTestId(fixture, IDS.siteFailure);
    expect(failures).toHaveLength(1);
    expect(byTestId(fixture, IDS.site)[1].contains(failures[0])).toBe(true);
    expect(byTestId(fixture, IDS.site)[0].textContent).toContain('Sin unidades');
  });

  it('un segundo pedido sobre la misma sede mientras viaja no sale', () => {
    const fixture = opened();
    const item = fixture.debugElement.query(By.directive(PrescriptionItem)).componentInstance as PrescriptionItem;
    const request = { ref: { pharmacyId: PHARMACY_ID, siteId: CENTER_ID, productId: PRODUCT_ID }, available: false };

    item.availabilityRequested.emit(request);
    item.availabilityRequested.emit({ ...request, available: true });
    fixture.detectChanges();

    const [only] = http.match(PUT_CENTER_URL);
    expect(http.match(PUT_CENTER_URL)).toHaveLength(0);
    expect(only.request.body).toEqual({ available: false });
    only.flush({ siteId: CENTER_ID, productId: PRODUCT_ID, available: false, quantity: 0, stockUpdatedAt: null });
  });

  it('422 SITE_PRODUCT_KEPT_BY_LOTS: vuelve atrás y dice el mensaje de la API', () => {
    const fixture = opened();

    centerSwitch(fixture).click();
    fixture.detectChanges();
    http.expectOne(PUT_CENTER_URL).flush(
      apiError('PRECONDITION_FAILED', 'Esta sede lleva el producto por lotes: se ajusta desde el inventario.', {
        reason: 'SITE_PRODUCT_KEPT_BY_LOTS',
        details: { reason: 'SITE_PRODUCT_KEPT_BY_LOTS' },
      }),
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    expect(centerSwitch(fixture).checked).toBe(true);
    expect(byTestId(fixture, IDS.siteFailure)[0].textContent).toContain(
      'Esta sede lleva el producto por lotes: se ajusta desde el inventario.',
    );
  });

  it('un 404 del PUT sin mensaje para la persona pide recargar, no esperar', () => {
    const fixture = opened();

    centerSwitch(fixture).click();
    fixture.detectChanges();
    http
      .expectOne(PUT_CENTER_URL)
      .flush(apiError('NOT_FOUND', 'Producto no encontrado'), { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const failure = byTestId(fixture, IDS.siteFailure)[0].textContent ?? '';
    expect(failure).toContain('Recargue la receta y vuelva a intentarlo.');
    expect(failure).not.toContain('Intente de nuevo en unos segundos');
    expect(failure).not.toContain('Producto no encontrado');
  });

  it('un producto marcado sin stock en el catálogo no ofrece interruptor', () => {
    const fixture = opened(share({ outOfStockDeclared: true }));

    expect(byTestId(fixture, IDS.productOutOfStock)[0].textContent).toContain(
      'Marcado sin stock en el catálogo',
    );
    expect(byTestId(fixture, IDS.siteToggle)).toHaveLength(0);
  });
});
