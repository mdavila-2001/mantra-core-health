import { facturaDePrueba } from './billing.spec-fixtures';
import {
  graphicRepresentationBlocks,
  qrContent,
  WITHOUT_LEGEND,
  INLINE_LEGEND,
  SIMULATED_MARK,
  fileName,
} from './graphic-representation';

/** PNG de 1 × 1: basta para comprobar que el QR se inserta. */
const PNG_MINIMO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('representación gráfica de la factura SIMULADA', () => {
  const factura = facturaDePrueba();
  const todo = graphicRepresentationBlocks(factura)
    .map((b) => b.text)
    .join('\n');

  it('lleva los elementos del Art. 69 (en línea) de la RND 102100000011', () => {
    for (const esperado of [
      'FACTURA (SIMULADA)',
      '(Con Derecho a Crédito Fiscal)',
      `Razón social: ${String(factura.cabecera['razonSocialEmisor'])}`,
      'Casa matriz / sucursal: N.º 0',
      'Punto de venta: N.º 0',
      `NIT (SIMULADO): ${factura.issuer.nit}`,
      `Factura N.º: ${factura.invoiceNumber}`,
      `Cód. Autorización: ${factura.cuf} (SIMULADO)`,
      'Fecha: 15/09/2026 10:00:00',
      'Nombre / Razón social:',
      'NIT / CI / CEX:',
      'Cód. cliente:',
      'Subtotal:',
      'Descuento:',
      'Total:',
      'Monto gift card:',
      'Monto a pagar:',
      'Importe base crédito fiscal: ',
      'Son: ',
      WITHOUT_LEGEND,
      INLINE_LEGEND,
      'Ley N° 453',
    ]) {
      expect(todo).toContain(esperado);
    }
  });

  it('tiene un renglón de detalle por renglón del XML, con cantidad, precio y subtotal', () => {
    const filas = graphicRepresentationBlocks(factura).filter((b) => b.kind === 'row' && !b.header);
    expect(filas).toHaveLength(factura.detalle.length);
    expect(filas[0]!.cells).toHaveLength(7);
  });

  it('dice desde la primera línea que es simulada y sin validez fiscal', () => {
    expect(graphicRepresentationBlocks(factura)[0]!.text).toContain(SIMULATED_MARK);
  });

  it('el QR tiene la forma oficial sobre simulado.invalid, nunca el host del SIN', () => {
    const qr = qrContent(factura);
    expect(qr).toBe(
      `https://simulado.invalid/consulta/QR?nit=${factura.issuer.nit}&cuf=${factura.cuf}&numero=${factura.invoiceNumber}&t=2`,
    );
    expect(qrContent(factura, 1).endsWith('&t=1')).toBe(true);
    expect(todo).not.toMatch(/impuestos\.gob\.bo/);
  });

  it('el PDF se arma, lleva la marca de agua en cada hoja y el QR si se lo dan', async () => {
    // Another suite mocks jspdf; load the real library for this artifact assertion.
    vi.doUnmock('jspdf');
    vi.resetModules();
    const { buildGraphicRepresentation: construirRepresentacionGrafica, markSimulatedAs: marcarComoSimulado, addQr: agregarQr } = await import('./graphic-representation');
    const documento = construirRepresentacionGrafica(factura, null);
    expect(documento.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const texto = vi.spyOn(documento, 'text');
    marcarComoSimulado(documento);
    expect(texto).toHaveBeenCalledTimes(documento.getNumberOfPages());
    expect(texto.mock.calls[0]![0]).toBe(SIMULATED_MARK);
    const imagen = vi.spyOn(documento, 'addImage');
    agregarQr(documento, PNG_MINIMO);
    expect(imagen).toHaveBeenCalledTimes(1);
    expect(documento.output()).toContain('%PDF-');
  });

  it('los archivos se llaman como lo que son', () => {
    expect(fileName(factura, 'pdf')).toBe(`factura-${factura.invoiceNumber}-SIMULADA.pdf`);
    expect(fileName(factura, 'xml')).toBe(`factura-${factura.invoiceNumber}-SIMULADA.xml`);
  });
});
