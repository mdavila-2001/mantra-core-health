import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { OrderSummary } from './order-summary';
import type { RenglonDelResumen, ResumenDelPedido } from './order-summary.types';

/**
 * El resumen del pedido de farmacia antes de pagar (F2.2.5): con seguro separa
 * lo aprobado de lo no aprobado y muestra coaseguro y cobertura; sin seguro es
 * un solo bloque. Un importe que falta se dice («No disponible»), no se pinta
 * como cero.
 */

function renglon(partial: Partial<RenglonDelResumen> = {}): RenglonDelResumen {
  return {
    indice: 0,
    medicamento: 'Paracetamol',
    presentacion: '500 mg · 10 comprimidos',
    cantidad: 2,
    subtotal: '24.00',
    promocion: null,
    esAlternativa: false,
    disponible: true,
    ...partial,
  };
}

function resumen(partial: Partial<ResumenDelPedido> = {}): ResumenDelPedido {
  return {
    moneda: 'BOB',
    conSeguro: false,
    aprobados: [],
    noAprobados: [renglon()],
    subtotal: '24.00',
    descuentoDeCampana: null,
    descuentoDeRed: '2.40',
    coaseguro: null,
    cubreElSeguro: null,
    total: '21.60',
    puntos: null,
    ...partial,
  };
}

describe('OrderSummary', () => {
  let fixture: ComponentFixture<OrderSummary>;

  function pintar(datos: ResumenDelPedido): HTMLElement {
    fixture = TestBed.createComponent(OrderSummary);
    fixture.componentRef.setInput('resumen', datos);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const texto = (root: HTMLElement, id: string): string =>
    root.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('sin seguro: un solo bloque, con subtotal, descuento y total en bolivianos', () => {
    const root = pintar(resumen());

    expect(root.querySelector('[data-testid="resumen-bloque-pedido"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="resumen-bloque-aprobados"]')).toBeNull();
    expect(texto(root, 'resumen-renglon')).toContain('2 × Paracetamol');
    expect(texto(root, 'resumen-renglon')).toContain('24.00 Bs');
    expect(texto(root, 'resumen-subtotal')).toContain('24.00 Bs');
    expect(texto(root, 'resumen-descuento')).toContain('−2.40 Bs');
    expect(texto(root, 'resumen-total')).toContain('21.60 Bs');
    expect(root.querySelector('[data-testid="resumen-coaseguro"]')).toBeNull();
  });

  it('con seguro: separa aprobados y no aprobados, y muestra coaseguro y lo que cubre la aseguradora', () => {
    const root = pintar(
      resumen({
        conSeguro: true,
        aprobados: [renglon({ indice: 1, medicamento: 'Amoxicilina' })],
        noAprobados: [renglon({ indice: 2, medicamento: 'Vitamina C' })],
        coaseguro: '5.00',
        cubreElSeguro: '19.00',
      }),
    );

    expect(texto(root, 'resumen-bloque-aprobados')).toContain('Amoxicilina');
    expect(texto(root, 'resumen-bloque-no-aprobados')).toContain('Vitamina C');
    expect(texto(root, 'resumen-coaseguro')).toContain('5.00 Bs');
    expect(texto(root, 'resumen-cubre-el-seguro')).toContain('19.00 Bs');
  });

  it('con seguro y nada aprobado: lo dice y no inventa coaseguro', () => {
    const root = pintar(resumen({ conSeguro: true, aprobados: [], coaseguro: '0.00' }));

    expect(texto(root, 'resumen-bloque-aprobados')).toContain('Ningún medicamento de este pedido.');
    expect(root.querySelector('[data-testid="resumen-coaseguro"]')).toBeNull();
  });

  it('un importe ausente se dice «No disponible», no se pinta como cero', () => {
    const root = pintar(resumen({ subtotal: null, descuentoDeRed: null, total: null }));

    expect(texto(root, 'resumen-subtotal')).toContain('No disponible');
    expect(texto(root, 'resumen-descuento')).toContain('No disponible');
    expect(texto(root, 'resumen-total')).toContain('falta algún precio publicado');
  });

  it('renglón sin existencia, sin precio, alternativa y con promoción', () => {
    const root = pintar(
      resumen({
        noAprobados: [
          renglon({ indice: 1, disponible: false }),
          renglon({ indice: 2, subtotal: null }),
          renglon({ indice: 3, esAlternativa: true, promocion: '2x1' }),
        ],
      }),
    );
    const renglones = Array.from(root.querySelectorAll('[data-testid="resumen-renglon"]')).map((r) => r.textContent ?? '');

    expect(renglones[0]).toContain('La farmacia no la tiene');
    expect(renglones[1]).toContain('Sin precio publicado');
    expect(renglones[2]).toContain('Alternativa de demostración');
    expect(root.querySelector('[data-testid="resumen-renglon-promocion"]')?.textContent).toContain('2x1');
  });

  it('la promoción sobre el total y los puntos sólo aparecen cuando vienen', () => {
    expect(pintar(resumen()).querySelector('[data-testid="resumen-promocion"]')).toBeNull();
    expect(pintar(resumen()).querySelector('[data-testid="resumen-puntos"]')).toBeNull();

    const root = pintar(resumen({ descuentoDeCampana: '3.00', puntos: 12 }));
    expect(texto(root, 'resumen-promocion')).toContain('−3.00 Bs');
    expect(texto(root, 'resumen-puntos')).toContain('12');
  });
});
