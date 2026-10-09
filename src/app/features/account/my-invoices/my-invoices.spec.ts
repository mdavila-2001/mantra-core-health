import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type {
  MyInvoiceItem,
  MyInvoicesPage,
  MyInvoicesView,
} from '@core/data-access/billing-simulated/billing-simulated.types';

import { FACTURACION_SIMULADA_DISPONIBLE } from '../../billing/invoicing-availability';
import { MyInvoices } from './my-invoices';

/**
 * «Mis facturas». Lo que se fija: sin facturación conectada no se pide nada;
 * la columna de la contraparte cambia con el lado (emisor para el paciente,
 * paciente para quien factura); el vacío dice por qué; y el buscador acota.
 */

function item(numero: number, descripcion: string, paciente = 'Ana Lucía Pérez'): MyInvoiceItem {
  return {
    invoice: {
      id: `f-${numero}`,
      invoiceNumber: numero,
      cuf: 'CUF',
      status: 'VALIDATED',
      siatStatusCode: 908,
      issuedAt: new Date().toISOString(),
      total: '250.00',
      simulated: true,
    },
    chargeId: `c-${numero}`,
    source: 'CONSULTATION',
    description: descripcion,
    issuerName: 'CONSULTORIO DEMO',
    issuerNit: '1000000011',
    patientName: paciente,
    simulated: true,
  };
}

function pagina(view: MyInvoicesView, items: MyInvoiceItem[]): MyInvoicesPage {
  return { view, items, count: items.length, simulated: true };
}

describe('MyInvoices', () => {
  let fixture: ComponentFixture<MyInvoices>;
  let http: HttpTestingController;

  function montar(disponible = true): void {
    TestBed.configureTestingModule({
      imports: [MyInvoices],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: FACTURACION_SIMULADA_DISPONIBLE, useValue: () => disponible },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyInvoices);
    fixture.detectChanges();
  }

  function responder(p: MyInvoicesPage): void {
    http.expectOne((r) => r.url.endsWith('/billing/simulated/my-invoices')).flush(p);
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => http.verify());

  it('sin facturación conectada lo dice y no pide nada', () => {
    montar(false);
    expect(texto()).toContain('La facturación no está conectada');
    http.expectNone((r) => r.url.includes('/billing/simulated/'));
  });

  it('el paciente ve el emisor de cada factura', () => {
    montar();
    responder(pagina('RECEIVED', [item(1, 'Consulta médica · 2026-09-10')]));
    expect(texto()).toContain('Las facturas que le emitieron');
    expect(texto()).toContain('Emisor');
    expect(texto()).toContain('CONSULTORIO DEMO');
  });

  it('quien factura ve a qué paciente se la emitió', () => {
    montar();
    responder(pagina('ISSUED', [item(1, 'Consulta médica · 2026-09-10', 'Germán Vargas')]));
    expect(texto()).toContain('Las facturas que emitió');
    expect(texto()).toContain('Paciente');
    expect(texto()).toContain('Germán Vargas');
  });

  it('sin facturas, el vacío explica cuándo aparecen', () => {
    montar();
    responder(pagina('ISSUED', []));
    expect(texto()).toContain('Todavía no emitió facturas');
  });

  it('el buscador acota sin distinguir acentos', () => {
    montar();
    responder(pagina('ISSUED', [item(1, 'Consulta médica', 'Germán Vargas'), item(2, 'Pedido de farmacia', 'Ana Pérez')]));
    const componente = fixture.componentInstance as unknown as {
      onFiltrosCambiaron(f: Record<string, string>): void;
      totalFiltrado(): number;
    };
    componente.onFiltrosCambiaron({ q: 'german' });
    expect(componente.totalFiltrado()).toBe(1);
  });
});
