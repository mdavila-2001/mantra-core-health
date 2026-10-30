import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { QuotationList } from './quotation-list';

const PATIENT = {
  profileId: 'pac1',
  personId: 'per1',
  patientCode: 'PAC-01',
  displayName: 'Ana Pérez',
  deceased: false,
};

/** La fila como la manda hoy la API (`quotation-response.dto.ts`): sin `status`. */
const QUOTATION = {
  id: 'q-1',
  patientProfileId: 'pac1',
  serviceNameSnapshot: 'Cita médica',
  offeredPrice: '300.00',
  statusConceptId: 'c-activa',
  currencyConceptId: 'c-bob',
  attentionDate: '2026-11-10',
  validUntil: '2026-11-30',
};

describe('QuotationList — H15: el listado de la médica, legible', () => {
  let harness: RouterTestingHarness;
  let component: QuotationList;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-quotations', component: QuotationList }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl('/my-quotations', QuotationList);
  });

  afterEach(() => http.verify());

  function root(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  function cell(testid: string): string {
    return root().querySelector(`[data-testid="${testid}"]`)?.textContent?.trim() ?? '';
  }

  async function choosePatientWith(rows: readonly object[]): Promise<void> {
    (component as unknown as { elegirPaciente(p: unknown): void }).elegirPaciente(PATIENT);
    http
      .expectOne((r) => r.url === '/quotations' && r.params.get('patientProfileId') === 'pac1')
      .flush(rows);
  }

  it('estado en palabras, «300,00 Bs» y las fechas como 10/11/2026', async () => {
    await choosePatientWith([QUOTATION]);
    const read = http.expectOne((r) => r.url === '/terminology/concepts');
    expect(read.request.params.get('ids')?.split(',').sort()).toEqual(['c-activa', 'c-bob']);
    read.flush({
      items: [
        { conceptId: 'c-activa', code: 'ACTIVE', display: 'Active', codeSystemVersionId: 'csv' },
        { conceptId: 'c-bob', code: 'BOB', display: 'Boliviano', codeSystemVersionId: 'csv' },
      ],
      count: 2,
      limit: 200,
    });
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(cell('quotation-list-status')).toBe('Vigente');
    expect(cell('quotation-list-price')).toBe('300,00 Bs');
    expect(cell('quotation-list-attention-date')).toBe('10/11/2026');
    expect(cell('quotation-list-valid-until')).toBe('30/11/2026');
    expect(root().textContent).not.toContain('c-activa');
  });

  it('sin la etiqueta del estado dice «Sin dato»; sin moneda resuelta, el número solo', async () => {
    await choosePatientWith([QUOTATION]);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(cell('quotation-list-status')).toBe('Sin dato');
    expect(cell('quotation-list-price')).toBe('300,00');
    expect(root().textContent).not.toContain('c-activa');
  });

  it('una sola lectura de terminología por página, con los ids sin repetir', async () => {
    await choosePatientWith([
      QUOTATION,
      { ...QUOTATION, id: 'q-2' },
      { ...QUOTATION, id: 'q-3', currencyConceptId: undefined },
    ]);
    const reads = http.match((r) => r.url === '/terminology/concepts');
    expect(reads).toHaveLength(1);
    expect(reads[0]!.request.params.get('ids')?.split(',').sort()).toEqual(['c-activa', 'c-bob']);
    reads[0]!.flush({ items: [], count: 0, limit: 200 });
  });
});
