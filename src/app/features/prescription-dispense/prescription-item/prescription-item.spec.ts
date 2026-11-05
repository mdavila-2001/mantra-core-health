import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type {
  PharmacyPrescriptionItem,
  PrescriptionProductMatch,
} from '../../../core/data-access/pharmacy-prescription-shares/pharmacy-prescription-shares.types';
import { siteKey } from '../dispense-display';
import { PRESCRIPTION_DISPENSE_TESTIDS as IDS } from '../prescription-dispense.testids';
import { PrescriptionItem, type AvailabilityRequest } from './prescription-item';

function match(overrides: Partial<PrescriptionProductMatch> = {}): PrescriptionProductMatch {
  return {
    pharmacyId: 'ph-1',
    pharmacyProductId: 'pp-1',
    name: 'Marca de prueba',
    price: '35.50',
    currencyCode: 'pharmacy:CURRENCY_BOB',
    requiresPrescription: true,
    outOfStockDeclared: false,
    sites: [
      { siteId: 'st-1', siteName: 'Sede Centro', available: true, quantity: 4, stockUpdatedAt: null },
      { siteId: 'st-2', siteName: 'Sede Norte', available: false, quantity: 0, stockUpdatedAt: null },
    ],
    ...overrides,
  };
}

function item(overrides: Partial<PharmacyPrescriptionItem> = {}): PharmacyPrescriptionItem {
  return {
    medicationRequestId: 'mr-1',
    medicationConceptId: 'mc-1',
    display: 'Jarabe de prueba 100 ml',
    dosageText: '5 ml cada 8 horas',
    prescribedQuantity: 2,
    unitCode: 'UNIT_{bottle}',
    dispensedQuantity: 1,
    remainingQuantity: 1,
    matches: [match()],
    ...overrides,
  };
}

/**
 * Un ítem de la receta en el mostrador (REQ-FAR-02-007/008/009): lo recetado
 * y lo que queda (o «Sin control de cantidad»), el producto con su precio, una
 * fila por sede con su interruptor, y ningún interruptor si el catálogo lo
 * marcó sin stock.
 */
describe('PrescriptionItem', () => {
  function mount(
    value: PharmacyPrescriptionItem,
    extra: { pending?: ReadonlySet<string>; failures?: Record<string, string>; sameDrug?: number } = {},
  ): ComponentFixture<PrescriptionItem> {
    const fixture = TestBed.createComponent(PrescriptionItem);
    fixture.componentRef.setInput('item', value);
    if (extra.sameDrug) fixture.componentRef.setInput('sameDrug', extra.sameDrug);
    if (extra.pending) fixture.componentRef.setInput('pendingKeys', extra.pending);
    if (extra.failures) fixture.componentRef.setInput('failures', extra.failures);
    fixture.detectChanges();
    return fixture;
  }

  function byTestId(fixture: ComponentFixture<PrescriptionItem>, id: string): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(`[data-testid="${id}"]`));
  }

  it('dice lo recetado con su unidad y «Quedan 1 de 2»', () => {
    const fixture = mount(item());

    expect(fixture.nativeElement.textContent).toContain('Recetado: 2 frascos');
    expect(byTestId(fixture, IDS.itemBalance)[0].textContent?.trim()).toBe('Quedan 1 de 2');
    expect(fixture.nativeElement.textContent).toContain('5 ml cada 8 horas');
  });

  it('el fármaco en dos ítems: dice que lo recetado y lo que queda son del medicamento en toda la receta', () => {
    const fixture = mount(item({ prescribedQuantity: 4, dispensedQuantity: 0, remainingQuantity: 4 }), { sameDrug: 2 });

    expect(fixture.nativeElement.textContent).toContain('Recetado en total: 4 frascos');
    expect(byTestId(fixture, IDS.itemBalance)[0].textContent?.trim()).toBe(
      'Quedan 4 de 4, entre los 2 ítems de este medicamento',
    );
  });

  it('el fármaco en dos ítems sin control de cantidad: la cantidad es la del ítem y no dice «en total»', () => {
    const fixture = mount(
      item({ unitCode: 'UNIT_{tablet}', prescribedQuantity: 30, dispensedQuantity: null, remainingQuantity: null }),
      { sameDrug: 2 },
    );

    expect(fixture.nativeElement.textContent).toContain('Recetado: 30 comprimidos');
    expect(fixture.nativeElement.textContent).not.toContain('en total');
  });

  it('sin cantidad comparable dice «Sin control de cantidad»', () => {
    const fixture = mount(
      item({ unitCode: 'UNIT_{tablet}', prescribedQuantity: 30, dispensedQuantity: null, remainingQuantity: null }),
    );

    expect(byTestId(fixture, IDS.itemBalance)[0].textContent?.trim()).toBe('Sin control de cantidad');
    expect(fixture.nativeElement.textContent).toContain('Recetado: 30 comprimidos');
  });

  it('muestra el producto con su precio y una fila por sede, cada una con su interruptor', () => {
    const fixture = mount(item());

    const product = byTestId(fixture, IDS.product)[0];
    expect(product.textContent).toContain('Marca de prueba');
    expect(product.textContent).toContain('35.50 Bs');
    expect(product.textContent).toContain('Venta bajo receta');
    const sites = byTestId(fixture, IDS.site);
    expect(sites.map((site) => site.querySelector('.rx-site__name')?.textContent?.trim())).toEqual([
      'Sede Centro',
      'Sede Norte',
    ]);
    expect(sites[0].textContent).toContain('4 unidades');
    expect(byTestId(fixture, IDS.siteToggle)).toHaveLength(2);
  });

  it('una sede disponible sin conteo dice «Sin conteo»', () => {
    const fixture = mount(
      item({
        matches: [
          match({
            sites: [{ siteId: 'st-1', siteName: 'Sede Centro', available: true, quantity: null, stockUpdatedAt: null }],
          }),
        ],
      }),
    );

    expect(byTestId(fixture, IDS.site)[0].textContent).toContain('Sin conteo');
  });

  it('marcado sin stock en el catálogo: lo dice y no ofrece interruptor', () => {
    const fixture = mount(item({ matches: [match({ outOfStockDeclared: true })] }));

    expect(byTestId(fixture, IDS.productOutOfStock)[0].textContent?.trim()).toBe(
      'Marcado sin stock en el catálogo',
    );
    expect(byTestId(fixture, IDS.siteToggle)).toHaveLength(0);
    expect(byTestId(fixture, IDS.site)).toHaveLength(0);
  });

  it('sin productos dice que no lo tiene en su catálogo', () => {
    const fixture = mount(item({ matches: [] }));

    expect(byTestId(fixture, IDS.itemNoMatches)[0].textContent?.trim()).toBe(
      'No tiene este medicamento en su catálogo.',
    );
  });

  it('el interruptor de una sede pide su producto, su sede y su farmacia', () => {
    const fixture = mount(item());
    const requests: AvailabilityRequest[] = [];
    fixture.componentInstance.availabilityRequested.subscribe((request) => requests.push(request));

    (byTestId(fixture, IDS.siteToggle)[1].querySelector('input') as HTMLInputElement).click();

    expect(requests).toEqual([
      { ref: { pharmacyId: 'ph-1', siteId: 'st-2', productId: 'pp-1' }, available: true },
    ]);
  });

  it('pasa a cada sede si está en vuelo y su motivo de fallo', () => {
    const north = siteKey({ pharmacyId: 'ph-1', siteId: 'st-2', productId: 'pp-1' });
    const center = siteKey({ pharmacyId: 'ph-1', siteId: 'st-1', productId: 'pp-1' });
    const fixture = mount(item(), {
      pending: new Set([north]),
      failures: { [center]: 'Motivo sintético.' },
    });

    const [first, second] = byTestId(fixture, IDS.siteToggle).map(
      (toggle) => toggle.querySelector('input') as HTMLInputElement,
    );
    expect(first.disabled).toBe(false);
    expect(second.disabled).toBe(true);
    expect(byTestId(fixture, IDS.siteFailure)[0].textContent).toContain('Motivo sintético.');
  });
});
