import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { unavailableInApiError } from '../../../core/data-access/simulator-only';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { ClaimQuoteResult } from '../../../core/data-access/insurance/insurance.types';
import { ClaimQuoteSection } from './claim-quote-section';

const COBERTURA = {
  id: 'coverage-paciente',
  insuranceCarrierId: 'carrier-andina',
  carrierName: 'Seguros Andina',
  planName: 'Plan Integral',
  policyIdentifier: 'POL-0001',
  memberIdentifier: 'AF-0001',
  validityStatus: 'CURRENT',
  currencyCode: 'BOB',
};

function cotizacion(parcial: Partial<ClaimQuoteResult> = {}): ClaimQuoteResult {
  const linea = {
    lineSequence: 1,
    serviceConceptId: 'concepto-cirugia',
    billedAmount: '500.00',
    covered: true,
    coveragePercent: '80',
    copayAmount: '50.00',
    deductibleAmount: null,
    requiresPriorAuthorization: true,
    priorAuthorizationStatus: 'MISSING' as const,
    patientAmount: '140.00',
    insurerAmount: '360.00',
    reason: 'PRIOR_AUTHORIZATION_REQUIRED',
    message: null,
  };
  return {
    canSubmit: false,
    currencyConceptId: null,
    totalBilledAmount: '500.00',
    totalPatientAmount: '140.00',
    totalInsurerAmount: '360.00',
    lines: [linea],
    ...parcial,
  };
}

describe('ClaimQuoteSection', async () => {
  let fixture: ComponentFixture<ClaimQuoteSection>;
  let http: HttpTestingController;
  let el: HTMLElement;

  function instancia(): Record<string, { set(valor: unknown): void }> {
    return fixture.componentInstance as unknown as Record<string, { set(valor: unknown): void }>;
  }

  /** Lee el seguro de la persona: la primera petición que la sección hace al abrir. */
  function responderCoberturas(items: readonly unknown[] = [COBERTURA]): void {
    http.expectOne((r) => r.url === '/patient-coverages/by-patient/p-1').flush({ items });
    fixture.detectChanges();
  }

  /** Deja correr las efectos que emiten el pedido y luego el debounce de la cotización. */
  async function dejarCotizar(): Promise<void> {
    TestBed.tick();
    await new Promise((resolver) => setTimeout(resolver, 350));
    TestBed.tick();
  }

  function boton(): HTMLButtonElement {
    return el.querySelector<HTMLButtonElement>('[data-testid="claim-quote-submit"]')!;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ClaimQuoteSection],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ServicesCatalogClient,
          useValue: { searchProcedures: () => of({ items: [], total: 0, limit: 20, nextCursor: null }) },
        },
        { provide: AuthService, useValue: { activeTenantId: () => 't-1' } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ClaimQuoteSection);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    http.match(() => true).forEach((r) => r.flush({ items: [] }));
    http.verify();
  });

  it('muestra el seguro vigente y no cotiza hasta tener servicio y monto', async () => {
    responderCoberturas();
    await dejarCotizar();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="claim-quote-coverage"]')?.textContent).toContain('Seguros Andina');
    expect(el.querySelector('[data-testid="claim-quote-pending"]')).not.toBeNull();
    http.expectNone('/insurance-claims/quote');
  });

  it('una persona sin seguro vigente lo dice y no ofrece el cobro', async () => {
    responderCoberturas([]);
    fixture.detectChanges();

    expect(el.textContent).toContain('Sin seguro vigente');
    expect(el.querySelector('[data-testid="claim-quote-submit"]')).toBeNull();
  });

  it('contra la API real, la lectura no disponible se dice como aviso y no como falla', async () => {
    const aviso = unavailableInApiError('Ver los seguros de la persona', '/patient-coverages/by-patient/p-1');
    http
      .expectOne((r) => r.url === '/patient-coverages/by-patient/p-1')
      .flush(aviso.error, { status: 501, statusText: 'Not Implemented' });
    fixture.detectChanges();

    expect(el.textContent).toContain('todavía no está disponible');
    expect(el.querySelector('[role="alert"]')?.textContent ?? '').not.toContain('No pudimos leer');
  });

  it('un monto con letras no cotiza y se dice en el campo', async () => {
    responderCoberturas();
    instancia()['servicioId']!.set('concepto-cirugia');
    instancia()['montoTexto']!.set('12,5x');
    fixture.detectChanges();
    await dejarCotizar();
    fixture.detectChanges();

    http.expectNone('/insurance-claims/quote');
    expect(el.textContent).toContain('Indique un importe en bolivianos');
  });

  it('una aprobación previa exigida y ausente bloquea el envío con el motivo en usted', async () => {
    responderCoberturas();
    instancia()['servicioId']!.set('concepto-cirugia');
    instancia()['montoTexto']!.set('500.00');
    fixture.detectChanges();
    await dejarCotizar();

    const pedido = http.expectOne('/insurance-claims/quote');
    expect(Object.keys(pedido.request.body as object).sort()).toEqual(['insuranceCarrierId', 'lines', 'patientCoverageId']);
    pedido.flush(cotizacion());
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="claim-quote-breakdown"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="claim-quote-total-patient"]')?.textContent).toContain('140.00');
    expect(el.querySelector('[data-testid="claim-quote-total-insurer"]')?.textContent).toContain('360.00');
    expect(el.querySelector('[data-testid="claim-quote-alert"]')?.textContent).toContain('requiere una aprobación previa');
    expect(boton().getAttribute('aria-disabled')).toBe('true');
  });

  it('con el reparto que se puede enviar, el botón se habilita, envía el cobro y lo confirma', async () => {
    responderCoberturas();
    instancia()['servicioId']!.set('concepto-consulta');
    instancia()['montoTexto']!.set('500.00');
    fixture.detectChanges();
    await dejarCotizar();
    http.expectOne('/insurance-claims/quote').flush(
      cotizacion({ canSubmit: true, lines: [{ ...cotizacion().lines[0]!, priorAuthorizationStatus: 'NOT_REQUIRED', reason: null, requiresPriorAuthorization: false }] }),
    );
    fixture.detectChanges();
    expect(boton().getAttribute('aria-disabled')).toBe('false');

    const emitidos: unknown[] = [];
    fixture.componentInstance.enviado.subscribe((creado) => emitidos.push(creado));
    boton().click();
    const envio = http.expectOne('/insurance-claims');
    const cuerpo = envio.request.body as Record<string, unknown>;
    expect(cuerpo['billingProviderEntityId']).toBe('t-1');
    expect(String(cuerpo['claimIdentifier'])).toMatch(/^COB-[A-Z0-9]{8}$/);
    expect(cuerpo['priorAuthorizationRequestId']).toBeUndefined();
    envio.flush({ id: 'c-1', status: 'SUBMITTED' }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(emitidos).toEqual([{ id: 'c-1', status: 'SUBMITTED' }]);
    expect(el.querySelector('[data-testid="claim-quote-sent"]')?.textContent).toContain('COB-');
  });

  it('un cobro rechazado al enviar no pierde el formulario y lo dice', async () => {
    responderCoberturas();
    instancia()['servicioId']!.set('concepto-consulta');
    instancia()['montoTexto']!.set('500.00');
    fixture.detectChanges();
    await dejarCotizar();
    http.expectOne('/insurance-claims/quote').flush(
      cotizacion({ canSubmit: true, lines: [{ ...cotizacion().lines[0]!, priorAuthorizationStatus: 'NOT_REQUIRED', reason: null, requiresPriorAuthorization: false }] }),
    );
    fixture.detectChanges();

    boton().click();
    http.expectOne('/insurance-claims').flush({ message: 'x' }, { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="claim-quote-send-error"]')?.textContent).toContain('No pudimos enviar el cobro');
    expect(el.querySelector('[data-testid="claim-quote-breakdown"]')).not.toBeNull();
    expect(boton().getAttribute('aria-disabled')).toBe('false');
  });
});

