import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ProviderPaymentRow, ProviderPaymentTablePage } from '../../../core/data-access/billing/payment-proofs.types';
import { SessionPayments } from './session-payments';

const fila = (over: Partial<ProviderPaymentRow> = {}): ProviderPaymentRow => ({
  chargeId: 'c1',
  startAt: '2026-10-20T13:00:00.000Z',
  patientProfileId: 'pp1',
  patientName: 'Ana Pérez',
  amountMinor: 15000,
  currency: 'BOB',
  patientAmountMinor: 15000,
  insurerAmountMinor: 0,
  coverageStatus: 'NO_COVERAGE',
  status: 'PENDING',
  proof: null,
  invoiced: false,
  ...over,
});

const pagina = (items: ProviderPaymentRow[], nextCursor: string | null = null): ProviderPaymentTablePage => ({
  items,
  nextCursor,
  totals: { sessions: items.length, amountMinor: 30000, paidMinor: 15000, pendingMinor: 15000 },
});

describe('SessionPayments (MD-06 · pagos por sesión)', () => {
  let fixture: ComponentFixture<SessionPayments>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionPayments],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(SessionPayments);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const responder = (body: ProviderPaymentTablePage) => {
    const req = http.expectOne((r) => r.url.endsWith('/billing/me/provider-payment-table'));
    expect(req.request.params.get('limit')).toBe('20');
    req.flush(body);
  };

  it('pinta las seis columnas y el estado con texto, no sólo con color', async () => {
    fixture.detectChanges();
    responder(
      pagina([
        fila(),
        fila({
          chargeId: 'c2',
          status: 'PAID',
          proof: {
            id: 'p1',
            chargeId: 'c2',
            patientProfileId: 'pp1',
            method: 'QR_TRANSFER',
            fileId: 'f1',
            amountMinor: 15000,
            currency: 'BOB',
            status: 'ACCEPTED',
            rejectionReason: null,
            reviewedAt: null,
            reviewedByUserId: null,
            createdAt: '2026-10-20T14:00:00.000Z',
          },
        }),
      ]),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const raiz: HTMLElement = fixture.nativeElement;
    const cabeceras = [...raiz.querySelectorAll('th')].map((th) => th.textContent?.trim() ?? '');
    for (const columna of ['Paciente', 'Fecha', 'Monto', 'Seguro', 'Estado', 'Comprobante']) {
      expect(cabeceras.some((c) => c.includes(columna))).toBe(true);
    }
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('Pendiente');
    expect(texto).toContain('Pagado');
    expect(texto).toContain('Bs 150,00');
    expect(texto).toContain('Transferencia por QR');
    expect(texto).toContain('Sin comprobante');
    expect(texto).toContain('Sin seguro');
  });

  it('vacío orienta: dice por qué y qué hacer', async () => {
    fixture.detectChanges();
    responder(pagina([]));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Cuando atienda una consulta');
  });

  it('error accionable: ofrece reintentar y vuelve a pedir', async () => {
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/billing/me/provider-payment-table'))
      .flush({ code: 'INTERNAL_ERROR', message: 'x' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    await fixture.whenStable();
    const reintentar = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      /reintentar/i.test(b.textContent ?? ''),
    );
    expect(reintentar).toBeDefined();
    reintentar!.click();
    responder(pagina([fila()]));
  });

  it('pagina por cursor: «Siguiente» pide la página con el cursor recibido', async () => {
    fixture.detectChanges();
    responder(pagina([fila()], 'cur-2'));
    fixture.detectChanges();
    await fixture.whenStable();
    const siguiente = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="tabla-siguiente"]');
    expect(siguiente).not.toBeNull();
    siguiente!.click();
    const req = http.expectOne((r) => r.url.endsWith('/billing/me/provider-payment-table'));
    expect(req.request.params.get('cursor')).toBe('cur-2');
    req.flush(pagina([fila({ chargeId: 'c9' })]));
  });
});
