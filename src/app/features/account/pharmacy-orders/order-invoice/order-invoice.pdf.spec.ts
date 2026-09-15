import { bloquesDeFactura } from './order-invoice.pdf';
import { facturaDePrueba } from './order-invoice.spec-fixtures';

describe('order-invoice pdf', () => {
  const textos = (factura = facturaDePrueba()) => bloquesDeFactura(factura).map((b) => b.text);

  it('dice que es una factura de ejemplo sin validez fiscal, no un comprobante interno', () => {
    const lineas = textos();
    expect(lineas[0]).toContain('Factura de ejemplo');
    expect(lineas[0]).toContain('Sin validez fiscal');
    expect(lineas.join('\n')).not.toContain('Comprobante interno');
  });

  it('lleva emisor, comprador, rótulos del mostrador, detalle, descuento y total', () => {
    const todo = textos().join('\n');
    expect(todo).toContain('Razón social: Farmacia Andina');
    expect(todo).toContain('NIT: 1028394027');
    expect(todo).toContain('Documento: CI 4832915 SC');
    expect(todo).toContain('Número: 04213377');
    expect(todo).toContain('Emitida el:');
    expect(todo).toContain('Estado: Enviada al paciente');
    expect(todo).toContain('Amoxicilina · 500 mg\tx1\t68.00 BOB');
    expect(todo).toContain('Descuento red AloVida: -6.80 BOB');
    expect(todo).toContain('Total facturado: 61.20 BOB');
  });

  it('el coaseguro sólo aparece si aplica', () => {
    expect(textos().join('\n')).not.toContain('Coaseguro');
    const conSeguro = facturaDePrueba({
      coaseguro: { aseguradora: 'Seguros Bolívar', importe: '13.60', moneda: 'BOB' },
    });
    expect(textos(conSeguro).join('\n')).toContain('Coaseguro (Seguros Bolívar): 13.60 BOB');
  });

  it('sin total dice el vacío honesto y no imprime el identificador técnico', () => {
    const sinTotal = facturaDePrueba({ subtotal: null, descuentoDeRed: null, total: null });
    const todo = textos(sinTotal).join('\n');
    expect(todo).toContain('Total facturado: No disponible');
    expect(todo).not.toContain('Descuento red AloVida');
    expect(todo).not.toContain('00000000-0000-4000-8000-000000000001');
  });
});
