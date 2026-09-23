import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { PaymentsBlock } from './payments-block';

/**
 * Pagos de la persona, dentro de la consulta. Lo que estas pruebas fijan:
 *
 * 1. **Sólo los pagos de esta persona.** La lectura es de la práctica entera:
 *    un filtro flojo mostraría a un paciente los comprobantes de otro, que es
 *    la peor fuga posible en una pantalla que se abre con alguien enfrente.
 * 2. **El total suma todo lo pagado**, aunque la lista se recorte, y se suma en
 *    centavos enteros: los importes son texto decimal de punta a punta.
 * 3. **«No podés ver» no es «no pagó nada».** Un `403` dice lo suyo y no se
 *    disfraza de lista vacía.
 * 4. **Sin práctica no hay caja.** Una organización sin prácticas no es un
 *    error ni una persona sin pagos.
 */

const PRACTICA = {
  id: 'pr-1',
  code: 'P1',
  name: 'Consultorio',
  typeConceptId: 'tipo',
  statusConceptId: 'activo',
};

function factura(
  invoiceId: string,
  patientProfileId: string,
  paidTotal: string,
  issueDate = '2026-09-10',
): Record<string, unknown> {
  return {
    invoiceId,
    invoiceNumber: `FAC-2026-${invoiceId}`,
    patientProfileId,
    issueDate,
    paidTotal,
  };
}

describe('PaymentsBlock', () => {
  let fixture: ComponentFixture<PaymentsBlock>;
  let http: HttpTestingController;

  /** Lo que la plantilla lee, sin pasar por el DOM. */
  function interno<T>(clave: string): T {
    return (fixture.componentInstance as unknown as Record<string, T>)[clave] as T;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PaymentsBlock);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
  });

  afterEach(() => {
    http.verify();
  });

  function responder(facturas: readonly Record<string, unknown>[]): void {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/practices').flush([PRACTICA]);
    http
      .expectOne((r) => r.url === '/accounting/practitioner/paid-consultations')
      .flush({ items: facturas, count: facturas.length });
    fixture.detectChanges();
  }

  it('muestra sólo los pagos de esta persona, del más reciente al más viejo', () => {
    responder([
      factura('a', 'p-1', '180.00', '2026-08-01'),
      factura('b', 'p-2', '999.00', '2026-09-30'),
      factura('c', 'p-1', '250.50', '2026-09-12'),
    ]);

    const datos = interno<() => { pagos: readonly { id: string }[] } | null>('datos')();
    expect(datos?.pagos.map((p) => p.id)).toEqual(['c', 'a']);
  });

  it('suma en centavos y formatea en bolivianos', () => {
    responder([factura('a', 'p-1', '180.10'), factura('c', 'p-1', '250.25')]);

    // 180,10 + 250,25 = 430,35. Con `number` puro esto se escribe 430.34999…
    expect(interno<() => { total: string } | null>('datos')()?.total).toBe('Bs 430,35');
  });

  it('un 403 no se lee como «no pagó nada»', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/practices').flush([PRACTICA]);
    http
      .expectOne((r) => r.url === '/accounting/practitioner/paid-consultations')
      .flush(
        { code: 'FORBIDDEN', message: 'Tu rol no incluye la caja de esta práctica.' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    expect(interno<() => { status: string }>('estado')().status).toBe('forbidden');
  });

  it('sin prácticas lo dice, y no pide los pagos', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/practices').flush([]);
    fixture.detectChanges();

    expect(interno<() => boolean>('sinPractica')()).toBe(true);
    expect(interno<() => boolean>('hayPagos')()).toBe(false);
    // La otra mitad: no se pidió una lectura que no tenía `practiceId`.
    http.expectNone((r) => r.url === '/accounting/practitioner/paid-consultations');
  });

  it('no inventa pagos cuando la persona no tiene ninguno', () => {
    responder([factura('b', 'p-2', '999.00')]);

    expect(interno<() => boolean>('hayPagos')()).toBe(false);
    expect(interno<() => boolean>('sinPractica')()).toBe(false);
  });
});
