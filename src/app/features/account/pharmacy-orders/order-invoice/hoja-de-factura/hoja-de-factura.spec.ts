import { TestBed } from '@angular/core/testing';

import { facturaDePrueba } from '../order-invoice.spec-fixtures';
import type { DocumentoDeFactura } from '../order-invoice.types';
import { HojaDeFactura } from './hoja-de-factura';

describe('HojaDeFactura', () => {
  function render(documento: DocumentoDeFactura, nota: string | null = null): HTMLElement {
    const fixture = TestBed.createComponent(HojaDeFactura);
    fixture.componentRef.setInput('documento', documento);
    fixture.componentRef.setInput('nota', nota);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('usa los rótulos del resumen del mostrador (AC-T-E4-07)', () => {
    const texto = render(facturaDePrueba()).textContent ?? '';
    for (const rotulo of ['Número', 'Emitida el', 'Total facturado', 'Estado']) {
      expect(texto).toContain(rotulo);
    }
    expect(texto).toContain('04213377');
    expect(texto).toContain('04/09/2026');
    expect(texto).toContain('61.20 BOB');
    expect(texto).toContain('−6.80 BOB');
  });

  it('sirve igual con otro emisor: el supermercado (AC-T-E4-03)', () => {
    const supermercado = facturaDePrueba({
      emisor: {
        nombre: 'Supermercado AloVida',
        detalle: null,
        razonSocial: 'Mercados de la Red S.A.',
        nit: '3004455011',
      },
      lineas: [{ descripcion: 'Leche entera 1 L', cantidad: 2, importe: '17.00' }],
    });
    const hoja = render(supermercado);
    const emisor = hoja.querySelector('[data-testid="factura-emisor"]')?.textContent ?? '';

    expect(emisor).toContain('Mercados de la Red S.A.');
    expect(emisor).toContain('3004455011');
    expect(emisor).toContain('Supermercado AloVida');
    expect(hoja.textContent).not.toContain('Farmacia');
    expect(hoja.textContent).toContain('Leche entera 1 L');
  });

  it('el coaseguro sólo aparece si aplica, y no se resta del total', () => {
    expect(render(facturaDePrueba()).querySelector('[data-testid="factura-coaseguro"]')).toBeNull();

    const hoja = render(
      facturaDePrueba({ coaseguro: { aseguradora: 'Seguros Bolívar', importe: '13.60', moneda: 'BOB' } }),
    );
    expect(hoja.querySelector('[data-testid="factura-coaseguro"]')?.textContent).toContain('13.60 BOB');
    expect(hoja.querySelector('[data-testid="factura-total"]')?.textContent).toContain('61.20 BOB');
  });

  it('rotula los datos de ejemplo sólo cuando se lo piden', () => {
    expect(render(facturaDePrueba()).textContent).not.toContain('Datos de ejemplo');
    expect(render(facturaDePrueba(), 'Datos de ejemplo').textContent).toContain('Datos de ejemplo');
  });

  it('sin precio publicado dice el vacío, no un importe', () => {
    const hoja = render(facturaDePrueba({ subtotal: null, descuentoDeRed: null, total: null }));
    expect(hoja.querySelector('[data-testid="factura-total"]')?.textContent).toContain('No disponible');
    expect(hoja.querySelector('[data-testid="factura-descuento"]')).toBeNull();
  });
});
