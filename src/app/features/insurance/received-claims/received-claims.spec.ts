import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';

import type { ReceivedClaim } from '../../../core/data-access/insurance/insurance.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { ReceivedClaims } from './received-claims';

const BOB = { code: 'BOB', display: 'Boliviano' };

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Una fila tal cual la manda el servidor. */
function claimWire(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `claim-${index}`,
    claimIdentifier: `CLM-2026-${String(1000 + index)}`,
    patient: {
      id: `patient-${index}`,
      displayName: `Paciente ${index}`,
      patientCode: `PAC-${index}`,
      memberIdentifier: `AF-${index}`,
    },
    practitioner: { id: 'doc-1', displayName: 'Valeria Rojas', specialty: 'Cardiología' },
    providerName: 'Clínica Los Olivos',
    service: { code: 'SVC_ECG', display: 'Electrocardiograma' },
    additionalServiceCount: 0,
    billedTotal: { amount: '120.00', currency: BOB },
    approvedTotal: null,
    submittedAt: daysAgo(index),
    serviceDate: daysAgo(index + 1).slice(0, 10),
    policyIdentifier: `POL-${index}`,
    planName: 'Seguros Andina · Plan Oro',
    status: { code: 'SUBMITTED', display: 'Enviada' },
    lines: [
      {
        sequence: 1,
        code: 'SVC_ECG',
        display: 'Electrocardiograma',
        quantity: 1,
        unitPrice: { amount: '120.00', currency: BOB },
        billedAmount: { amount: '120.00', currency: BOB },
      },
    ],
    decision: null,
    invoice: null,
    ...overrides,
  };
}

/**
 * «Solicitudes recibidas»: la cara de la aseguradora de `insurance_claims`,
 * con la disciplina de tabla de ADR-0015 (buscador multicampo, un filtro por
 * encabezado, orden por encabezado y paginación en cliente).
 */
describe('ReceivedClaims', () => {
  let fixture: ComponentFixture<ReceivedClaims>;
  let component: ReceivedClaims;
  let http: HttpTestingController;
  let router: Router;
  /** Lo que responde la próxima confirmación: `true`/`false`, o el motivo escrito. */
  let answer: boolean | string | null;
  let asked: { title: string; message: string }[];

  beforeEach(() => {
    answer = true;
    asked = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: DialogService,
          useValue: {
            confirm: async (config: { title: string; message: string }) => {
              asked.push(config);
              return answer === true;
            },
            confirmWithReason: async (config: { title: string; message: string }) => {
              asked.push(config);
              return typeof answer === 'string' ? answer : null;
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  function internal<T>(name: string): T {
    const value = (component as unknown as Record<string, unknown>)[name];
    return (typeof value === 'function' ? value.bind(component) : value) as T;
  }

  /** Una señal escribible, sin `bind`: `bind` devuelve una función sin `.set`. */
  function writable<T>(name: string): { set(value: T): void } {
    return (component as unknown as Record<string, { set(value: T): void }>)[name]!;
  }

  function rows(): readonly ReceivedClaim[] {
    const state = internal<() => ViewState<readonly ReceivedClaim[]>>('tableState')();
    return state.status === 'ready' ? state.data : [];
  }

  function total(): number {
    return internal<() => number>('totalFiltered')();
  }

  async function mount(items: unknown[], truncated = false): Promise<void> {
    fixture = TestBed.createComponent(ReceivedClaims);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/insurance/received-claims').flush({ items, truncated });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function filterBy(queryParams: Record<string, string>): Promise<void> {
    await router.navigate([], { queryParams });
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('pinta las columnas del pedido más la de acciones, y la moneda una sola vez en el conteo', async () => {
    await mount([claimWire(1)]);
    expect(
      (fixture.nativeElement.querySelector('[data-testid="received-claims-count"]') as HTMLElement).textContent,
    ).toContain('importes en BOB');
    const columns = internal<() => { header: string; sortable?: boolean }[]>('columns')();
    expect(columns.map((c) => c.header)).toEqual([
      'Paciente',
      'Médico',
      'Servicio prestado',
      'Monto solicitado',
      'Fechas',
      'Estado',
      'Acciones',
    ]);
    expect(columns.filter((c) => c.header !== 'Acciones').every((c) => c.sortable)).toBe(true);
  });

  it('ofrece un filtro por cada encabezado filtrable, con sólo los valores que existen', async () => {
    await mount([
      claimWire(1),
      claimWire(2, { service: { code: 'SVC_ECO', display: 'Ecografía' } }),
    ]);
    const filters = internal<() => { label: string; options: { value: string }[] }[]>('filters')();
    expect(filters.map((f) => f.label)).toEqual([
      'Médico',
      'Servicio',
      'Monto solicitado',
      'Fecha de solicitud',
      'Fecha de prestación',
      'Prestador',
    ]);
    expect(filters.find((f) => f.label === 'Servicio')!.options.map((o) => o.value)).toEqual([
      'SVC_ECO',
      'SVC_ECG',
    ]);
  });

  it('el buscador es multicampo e ignora acentos y mayúsculas', async () => {
    await mount([
      claimWire(1),
      claimWire(2, { practitioner: { id: 'doc-2', displayName: 'Jorge Salazar', specialty: 'Pediatría' } }),
      claimWire(3, { policyIdentifier: 'POL-ÚNICA' }),
    ]);
    writable<string>('searchTerm').set('pediatria');
    expect(rows().map((r) => r.id)).toEqual(['claim-2']);

    writable<string>('searchTerm').set('pol-unica');
    expect(rows().map((r) => r.id)).toEqual(['claim-3']);

    writable<string>('searchTerm').set('af-1');
    expect(rows().map((r) => r.id)).toEqual(['claim-1']);
  });

  it('filtra por tramo de monto y período de prestación leídos de la URL', async () => {
    await mount([
      claimWire(1, { billedTotal: { amount: '1500.00', currency: BOB } }),
      claimWire(2),
      claimWire(40, { serviceDate: daysAgo(41).slice(0, 10) }),
    ]);
    await filterBy({ amount: 'gt1000' });
    expect(rows().map((r) => r.id)).toEqual(['claim-1']);

    await filterBy({ serviceDate: '30' });
    expect(rows().map((r) => r.id)).toEqual(['claim-1', 'claim-2']);
  });

  it('arranca en «Por dictaminar» y cada bandeja cuenta lo que tiene', async () => {
    await mount([
      claimWire(1),
      claimWire(2, { status: { code: 'IN_REVIEW', display: 'En revisión' } }),
      claimWire(3, { status: { code: 'PAID', display: 'Pagada' } }),
      claimWire(4, { status: { code: 'REJECTED', display: 'Rechazada' } }),
    ]);
    expect(rows().map((r) => r.id)).toEqual(['claim-1', 'claim-2']);
    const labels = internal<() => { label: string }[]>('queueOptions')().map((o) => o.label);
    expect(labels).toEqual(['Por dictaminar · 2', 'Aprobadas · 0', 'Pagadas · 1', 'Rechazadas · 1', 'Todas · 4']);

    writable<string>('queue').set('paid');
    expect(rows().map((r) => r.id)).toEqual(['claim-3']);
  });

  it('ordena por el encabezado elegido, en las dos direcciones', async () => {
    await mount([
      claimWire(1, { billedTotal: { amount: '300.00', currency: BOB } }),
      claimWire(2, { billedTotal: { amount: '1200.00', currency: BOB } }),
      claimWire(3, { billedTotal: { amount: '90.00', currency: BOB } }),
    ]);
    const sort = writable<unknown>('sort');
    sort.set({ key: 'billedTotal', direction: 'asc' });
    expect(rows().map((r) => r.billedTotal.amount)).toEqual(['90.00', '300.00', '1200.00']);
    sort.set({ key: 'billedTotal', direction: 'desc' });
    expect(rows().map((r) => r.billedTotal.amount)).toEqual(['1200.00', '300.00', '90.00']);
  });

  it('pagina en el cliente y vuelve a la página 1 cuando cambia la búsqueda', async () => {
    await mount(Array.from({ length: 23 }, (_, i) => claimWire(i + 1)));
    expect(total()).toBe(23);
    expect(rows().length).toBe(10);

    writable<number>('page').set(3);
    expect(rows().length).toBe(3);

    writable<string>('searchTerm').set('Paciente 1');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(internal<() => number>('page')()).toBe(1);
  });

  it('el buscador no escribe en la URL: ahí irían nombres y CI de pacientes', async () => {
    await mount([claimWire(1)]);
    writable<string>('searchTerm').set('Paciente 1');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(router.url).not.toContain('Paciente');
  });

  it('sin solicitudes queda en vacío con la próxima acción, no en una tabla vacía', async () => {
    await mount([]);
    expect(internal<() => { status: string }>('state')().status).toBe('empty');
  });

  it('un error del servidor se muestra como error, no como lista vacía', async () => {
    fixture = TestBed.createComponent(ReceivedClaims);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http
      .expectOne('/insurance/received-claims')
      .flush({ message: 'caído' }, { status: 500, statusText: 'Server Error' });
    expect(internal<() => { status: string }>('state')().status).not.toBe('empty');
    expect(internal<() => { status: string }>('state')().status).not.toBe('ready');
  });

  it('avisa cuando el servidor recortó la lista', async () => {
    await mount([claimWire(1)], true);
    expect(fixture.nativeElement.querySelector('[data-testid="received-claims-truncated"]')).not.toBeNull();
  });

  it('el nombre del paciente es un botón que abre el detalle con los otros datos', async () => {
    await mount([claimWire(1)]);
    const open = fixture.nativeElement.querySelector('[data-testid="received-claim-open"]') as HTMLButtonElement;
    expect(open.tagName).toBe('BUTTON');
    open.click();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[data-testid="received-claim-detail"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Clínica Los Olivos');
    expect(dialog.textContent).toContain('POL-1');
    expect(dialog.textContent).toContain('CLM-2026-1001');
    expect(dialog.textContent).toContain('Sin dictaminar');
    expect(dialog.textContent).toContain('SVC_ECG');
  });

  /* ---- dictamen y factura ------------------------------------------------- */

  const invoice = (status: 'ISSUED' | 'ANNULLED') => ({
    id: 'inv-1',
    invoiceNumber: 'FAC-004101',
    amount: { amount: '120.00', currency: BOB },
    status,
    issuedAt: daysAgo(2),
    annulledAt: status === 'ANNULLED' ? daysAgo(1) : null,
    annulmentReason: status === 'ANNULLED' ? 'NIT equivocado' : null,
    previous: [],
  });
  const approved = { code: 'APPROVED', display: 'Aprobada' };
  const decision = { outcome: 'APPROVED', decidedAt: daysAgo(2), decidedBy: 'Patricia Suárez', reason: null };

  function actionsOf(claim: ReceivedClaim): string[] {
    return internal<(c: ReceivedClaim) => { code: string }[]>('actionsOf')(claim).map((a) => a.code);
  }

  it('ofrece decidir sólo lo abierto, anular la factura vigente y volver a facturar la anulada', async () => {
    await mount([
      claimWire(1),
      claimWire(2, { status: approved, decision, invoice: invoice('ISSUED') }),
      claimWire(3, { status: approved, decision, invoice: invoice('ANNULLED') }),
      claimWire(4, { status: { code: 'REJECTED', display: 'Rechazada' }, decision: { ...decision, outcome: 'REJECTED' } }),
      claimWire(5, { status: { code: 'PAID', display: 'Pagada' }, decision, invoice: invoice('ISSUED') }),
    ]);
    writable<string>('queue').set('all');
    const byId = new Map(rows().map((r) => [r.id, r]));
    expect(actionsOf(byId.get('claim-1')!)).toEqual(['approve', 'partial', 'reject']);
    expect(actionsOf(byId.get('claim-2')!)).toEqual(['annul-invoice']);
    expect(actionsOf(byId.get('claim-3')!)).toEqual(['reissue-invoice']);
    expect(actionsOf(byId.get('claim-4')!)).toEqual([]);
    expect(actionsOf(byId.get('claim-5')!)).toEqual([]);
  });

  it('cada fila tiene su botón «Ver detalle»', async () => {
    await mount([claimWire(1), claimWire(2)]);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="received-claim-view"]').length).toBe(2);
  });

  it('aprobar avisa que no se revierte y que factura, y sólo manda el dictamen si se confirma', async () => {
    await mount([claimWire(1)]);
    const claim = rows()[0]!;

    answer = false;
    await internal<(code: string, c: ReceivedClaim) => Promise<void>>('run')('approve', claim);
    http.expectNone('/insurance/received-claims/claim-1/decision');
    expect(asked[0]!.message).toContain('no se puede revertir');
    expect(asked[0]!.message).toContain('evento de facturación');

    answer = true;
    await internal<(code: string, c: ReceivedClaim) => Promise<void>>('run')('approve', claim);
    const request = http.expectOne('/insurance/received-claims/claim-1/decision');
    expect(request.request.body).toEqual({ outcome: 'APPROVED' });
    request.flush(claimWire(1, { status: approved, decision, invoice: invoice('ISSUED') }));
    expect(internal<() => { label: string }[]>('queueOptions')()[1]!.label).toBe('Aprobadas · 1');
  });

  it('rechazar exige motivo y lo manda', async () => {
    await mount([claimWire(1)]);
    answer = 'El plan no cubre este estudio';
    await internal<(code: string, c: ReceivedClaim) => Promise<void>>('run')('reject', rows()[0]!);
    const request = http.expectOne('/insurance/received-claims/claim-1/decision');
    expect(request.request.body).toEqual({ outcome: 'REJECTED', reason: 'El plan no cubre este estudio' });
    request.flush(claimWire(1, { status: { code: 'REJECTED', display: 'Rechazada' } }));
  });

  it('aprobar en parte no deja pasar un monto igual o mayor que lo solicitado', async () => {
    await mount([claimWire(1)]);
    const claim = rows()[0]!;
    internal<(c: ReceivedClaim) => void>('openPartial')(claim);
    const amount = internal<{ setValue(v: string): void }>('partialAmount');
    const reason = internal<{ setValue(v: string): void }>('partialReason');
    amount.setValue('120.00');
    reason.setValue('Cobertura al 50 %');
    await internal<(c: ReceivedClaim) => Promise<void>>('submitPartial')(claim);
    http.expectNone('/insurance/received-claims/claim-1/decision');

    amount.setValue('60');
    await internal<(c: ReceivedClaim) => Promise<void>>('submitPartial')(claim);
    const request = http.expectOne('/insurance/received-claims/claim-1/decision');
    expect(request.request.body).toEqual({ outcome: 'PARTIAL', approvedAmount: '60.00', reason: 'Cobertura al 50 %' });
    request.flush(claimWire(1, { status: { code: 'PARTIAL', display: 'Aprobada parcialmente' } }));
  });

  it('anular la factura pide motivo y lo manda', async () => {
    await mount([claimWire(1, { status: approved, decision, invoice: invoice('ISSUED') })]);
    writable<string>('queue').set('approved');
    answer = 'El NIT salió equivocado';
    await internal<(code: string, c: ReceivedClaim) => Promise<void>>('run')('annul-invoice', rows()[0]!);
    const request = http.expectOne('/insurance/received-claims/claim-1/invoice/annulment');
    expect(request.request.body).toEqual({ reason: 'El NIT salió equivocado' });
    request.flush(claimWire(1, { status: approved, decision, invoice: invoice('ANNULLED') }));
    expect(rows()[0]!.invoice?.status).toBe('ANNULLED');
  });

  it('muestra la institución médica junto al médico y como entidad principal cuando no hay médico', async () => {
    await mount([
      claimWire(1, { practitioner: { id: 'doc-1', displayName: 'Valeria Rojas', specialty: 'Cardiología' }, providerName: 'Clínica Los Olivos' }),
      claimWire(2, { practitioner: null, providerName: 'Laboratorio Central' }),
    ]);
    const providers = fixture.nativeElement.querySelectorAll('[data-testid="received-claim-provider"]');
    expect(providers.length).toBe(2);
    expect(providers[0].textContent.trim()).toBe('Clínica Los Olivos');
    expect(providers[1].textContent.trim()).toBe('Laboratorio Central');
  });

  it('muestra el monto aprobado cuando la solicitud tiene dictamen favorable', async () => {
    await mount([
      claimWire(1, {
        billedTotal: { amount: '120.00', currency: BOB },
        approvedTotal: { amount: '80.00', currency: BOB },
      }),
    ]);
    const approvedEl = fixture.nativeElement.querySelector('[data-testid="received-claim-approved"]');
    expect(approvedEl).not.toBeNull();
    expect(approvedEl.textContent).toContain('80.00');
  });
});
