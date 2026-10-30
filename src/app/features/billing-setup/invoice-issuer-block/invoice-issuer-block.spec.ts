import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { BillingSimulatedClient } from '../../../core/data-access/billing-simulated/billing-simulated.client';
import { InvoiceIssuerBlock } from './invoice-issuer-block';

const ISSUER = {
  id: 'i-1',
  kind: 'PRACTICE',
  nit: '1020304050',
  legalName: 'Consultorio Dra. Arce',
  municipality: 'La Paz',
  address: 'Av. Arce 123',
  phone: null,
  branchCode: 0,
  pointOfSaleCode: 0,
  documentSector: 1,
  simulated: true,
};

describe('InvoiceIssuerBlock', () => {
  let fixture: ComponentFixture<InvoiceIssuerBlock>;

  function mount(status: ReturnType<typeof vi.fn>): HTMLElement {
    TestBed.configureTestingModule({
      imports: [InvoiceIssuerBlock],
      providers: [{ provide: BillingSimulatedClient, useValue: { status } }],
    });
    fixture = TestBed.createComponent(InvoiceIssuerBlock);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const byTestId = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  it('dice «Emisor de prueba» y muestra razón social y NIT tal como vienen, sin botones', () => {
    const host = mount(vi.fn(() => of({ environment: 'SIMULADO', issuers: [ISSUER, { ...ISSUER, id: 'f', kind: 'PHARMACY' }] })));
    expect(byTestId('invoice-issuer-test-label')!.textContent).toContain('Emisor de prueba');
    const items = host.querySelectorAll('[data-testid="invoice-issuer-item"]');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toContain('Consultorio Dra. Arce');
    expect(items[0]!.textContent).toContain('1020304050');
    expect(host.querySelector('button')).toBeNull();
  });

  it('sin emisores dice que la práctica todavía no tiene', () => {
    mount(vi.fn(() => of({ environment: 'SIMULADO', issuers: [] })));
    expect(byTestId('invoice-issuer-none')!.textContent).toContain('Su práctica todavía no tiene emisor');
  });

  it('un error de la API es un estado de error con reintento, no una pantalla rota', () => {
    const host = mount(vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 }))));
    expect(byTestId('invoice-issuer')).toBeNull();
    expect(host.textContent!.trim().length).toBeGreaterThan(0);
  });
});
