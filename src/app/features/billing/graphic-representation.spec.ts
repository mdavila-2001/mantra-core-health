import { facturaDePrueba } from './billing.spec-fixtures';
import {
  graphicRepresentationBlocks,
  qrContent,
  invoiceIssuedAt,
  invoicePdfOptions,
  invoiceQrBlock,
  WITHOUT_LEGEND,
  INLINE_LEGEND,
  SIMULATED_MARK,
  fileName,
  pdfIssuerOf,
  SIMULATED_INVOICE_FOOTER,
  SIMULATED_INVOICE_WATERMARK,
} from './graphic-representation';
import { formatMoney, type PdfBlock } from '../../shared/utils/pdf-export/pdf-export';

/** Un QR ya calculado de mentira: basta para comprobar dónde va y que entra al PDF. */
const QR_DE_PRUEBA: PdfBlock = {
  kind: 'qr',
  text: 'Leyenda del QR',
  title: 'Verificación SIMULADA',
  qr: { size: 21, modules: Array.from({ length: 21 * 21 }, (_, i) => i % 2) },
};

describe('representación gráfica de la factura SIMULADA', () => {
  const factura = facturaDePrueba();
  const opciones = invoicePdfOptions(factura);
  const bloques = graphicRepresentationBlocks(factura);
  /** Todo lo que el papel dice: el cuerpo y la portada, el pie y la marca de agua. */
  const todo = [
    ...bloques.map((b) => b.text),
    opciones.kind,
    opciones.title,
    opciones.subtitle,
    opciones.reference,
    ...(opciones.meta ?? []).map((m) => `${m.label}: ${m.value}`),
    opciones.issuer?.name,
    ...(opciones.issuer?.details ?? []),
    opciones.footerNote,
    opciones.watermark,
  ].join('\n');

  it('lleva los elementos del Art. 69 (en línea) de la RND 102100000011', () => {
    for (const esperado of [
      'FACTURA (SIMULADA)',
      '(Con Derecho a Crédito Fiscal)',
      `Razón social: ${String(factura.cabecera['razonSocialEmisor'])}`,
      'Casa matriz / sucursal: N.º 0',
      'Punto de venta N.º 0',
      `NIT (SIMULADO): ${factura.issuer.nit}`,
      `N.º ${factura.invoiceNumber}`,
      `Cód. Autorización: ${factura.cuf} (SIMULADO)`,
      `Dirección / Municipio: ${String(factura.cabecera['direccion'])} · ${String(factura.cabecera['municipio'])}`,
      'Nombre / Razón social:',
      'NIT / CI / CEX:',
      'Cód. cliente:',
      'Actividad:',
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

  it('la fecha y hora de emisión es la del XML, sin reinterpretar zona', () => {
    // El fixture se emite a las 10:00:00 de Bolivia (`2026-09-15T10:00:00.000`).
    expect(factura.issuedAt.startsWith('2026-09-15T10:00:00')).toBe(true);
    expect(opciones.issuedAt).toEqual(new Date(2026, 8, 15, 10, 0, 0));
    expect(invoiceIssuedAt('2026-09-15T23:59:58.000Z')).toEqual(new Date(2026, 8, 15, 23, 59, 58));
    // Sin la forma del SIAT no se inventa: el motor rotula «Fecha de generación».
    expect(invoiceIssuedAt('mañana')).toBeUndefined();
    expect(invoicePdfOptions({ ...factura, issuedAt: '' }).issuedAt).toBeUndefined();
  });

  it('el emisor del pie es la razón social de la factura, con su NIT simulado; sin firma', () => {
    expect(opciones.issuer?.name).toBe(factura.issuer.legalName);
    expect(opciones.issuer?.details?.[0]?.replace(/\u00a0/g, ' ')).toBe(`NIT ${factura.issuer.nit} (SIMULADO)`);
    expect(opciones.issuer?.details).toContain(`${factura.issuer.address}, ${factura.issuer.municipality}`);
    expect(opciones.firma).toBeNull();
    // Sin teléfono no se inventa uno.
    expect(pdfIssuerOf({ ...factura.issuer, phone: null }).details?.some((d) => d.startsWith('Tel.'))).toBe(false);
    expect(pdfIssuerOf({ ...factura.issuer, phone: '2 000 0000' }).details).toContain('Tel.\u00a02\u00a0000\u00a00000');
  });

  it('dice SIMULADA en la portada, en cada hoja (marca de agua) y en el pie', () => {
    expect(opciones.title).toContain('SIMULADA');
    expect(opciones.kind).toBe('Factura simulada · Sin validez fiscal');
    expect(opciones.watermark).toBe(SIMULATED_INVOICE_WATERMARK);
    expect(SIMULATED_INVOICE_WATERMARK.toLocaleUpperCase('es')).toBe('SIMULADA · SIN VALIDEZ FISCAL');
    expect(opciones.footerNote).toBe(SIMULATED_INVOICE_FOOTER);
    expect(SIMULATED_INVOICE_FOOTER).toMatch(/SIMULADA · Sin validez fiscal/);
  });

  it('el estado del SIAT se lee como palabra, no en mayúsculas', () => {
    const estado = opciones.meta?.find((m) => m.label === 'Estado SIAT (SIMULADO)')?.value ?? '';
    expect(estado).not.toBe(estado.toLocaleUpperCase('es'));
    expect(estado.toLocaleUpperCase('es')).toBe(factura.siatResponse.codigoDescripcion.toLocaleUpperCase('es'));
    expect(invoicePdfOptions({ ...factura, siatResponse: { ...factura.siatResponse, codigoDescripcion: 'VALIDADA' } }).meta).toContainEqual({
      label: 'Estado SIAT (SIMULADO)',
      value: 'Validada',
    });
  });

  it('abre con un aviso de alerta que dice que es simulada y sin validez fiscal', () => {
    const [primero] = bloques;
    expect(primero?.kind).toBe('note');
    expect(primero?.tone).toBe('alert');
    expect(primero?.text).toContain(SIMULATED_MARK);
  });

  it('el emisor y el comprador van en paneles lado a lado, con los datos de la factura', () => {
    const paneles = bloques.find((b) => b.kind === 'panels');
    expect(paneles?.panels?.map((p) => p.title)).toEqual(['Emisor', 'Comprador', 'Factura']);
  });

  it('tiene un renglón de detalle por renglón del XML, con cantidad, precio y subtotal', () => {
    const filas = bloques.filter((b) => b.kind === 'row' && !b.header);
    expect(filas).toHaveLength(factura.detalle.length);
    expect(filas[0]!.cells).toHaveLength(7);
    const cabecera = bloques.find((b) => b.kind === 'row' && b.header === true);
    // Cabeceras de una palabra: «P. unitario» se partía en dos renglones.
    expect(cabecera?.cells).toEqual(['Código', 'Descripción', 'Cant.', 'Unidad', 'Precio', 'Desc.', 'Subtotal']);
    expect(cabecera?.cells?.every((celda) => !celda.includes(' '))).toBe(true);
    // La moneda la dice la letra chica del final, no cada celda; formato común «1.234,56».
    expect(filas[0]!.cells?.[6]).toBe(formatMoney(String(factura.detalle[0]!['subTotal']), null));
    expect(filas[0]!.cells?.[6]).toMatch(/^\d{1,3}(\.\d{3})*,\d{2}$/);
    expect(todo).toContain('Importes en bolivianos (Bs)');
  });

  it('los importes van en la caja de totales, con el monto a pagar resaltado al final', () => {
    const totales = bloques.find((b) => b.kind === 'totals')?.totals ?? [];
    expect(totales.map((t) => t.label)).toEqual(['Subtotal', 'Descuento', 'Total', 'Monto gift card', 'Monto a pagar']);
    expect(totales.at(-1)).toEqual({
      label: 'Monto a pagar',
      value: formatMoney(String(factura.cabecera['montoTotal'])),
      emphasis: true,
    });
    expect(totales.slice(0, -1).every((t) => t.emphasis !== true)).toBe(true);
    // Pegada a la tabla: el motor la reserva con las últimas filas del detalle.
    const indice = bloques.findIndex((b) => b.kind === 'totals');
    expect(bloques[indice - 1]?.kind).toBe('row');
  });

  it('lo que se resta lleva el signo menos tipográfico, nunca el guion; un cero va sin signo', () => {
    const conDescuento = graphicRepresentationBlocks({
      ...factura,
      cabecera: { ...factura.cabecera, descuentoAdicional: '12.5', montoGiftCard: '20' },
    });
    const totales = conDescuento.find((b) => b.kind === 'totals')?.totals ?? [];
    expect(totales.find((t) => t.label === 'Descuento')?.value).toBe('\u221212,50 Bs');
    expect(totales.find((t) => t.label === 'Monto gift card')?.value).toBe('\u221220,00 Bs');
    const sinDescuento = graphicRepresentationBlocks({
      ...factura,
      cabecera: { ...factura.cabecera, descuentoAdicional: '0', montoGiftCard: null },
    });
    const ceros = sinDescuento.find((b) => b.kind === 'totals')?.totals ?? [];
    expect(ceros.find((t) => t.label === 'Descuento')?.value).toBe('0,00 Bs');
    expect(ceros.find((t) => t.label === 'Monto gift card')?.value).toBe('0,00 Bs');
    expect(totales.every((t) => !t.value.includes('-'))).toBe(true);
  });

  it('las leyendas van juntas en un aviso neutro', () => {
    const leyendas = bloques.find((b) => b.kind === 'note' && b.text.includes(WITHOUT_LEGEND));
    expect(leyendas?.tone).toBe('neutral');
    expect(leyendas?.text).toContain(INLINE_LEGEND);
    expect(leyendas?.text).toContain(String(factura.cabecera['leyenda']));
  });

  it('el QR va en el flujo, como último bloque; sin QR, la dirección va como texto', () => {
    const conQr = graphicRepresentationBlocks(factura, QR_DE_PRUEBA);
    expect(conQr.at(-1)).toBe(QR_DE_PRUEBA);
    expect(conQr.filter((b) => b.kind === 'qr')).toHaveLength(1);
    expect(conQr.map((b) => b.text).join('\n')).not.toContain(qrContent(factura));
    expect(bloques.some((b) => b.kind === 'qr')).toBe(false);
    expect(bloques.at(-1)?.text).toBe(`QR de verificación SIMULADO: ${qrContent(factura)} (no apunta al SIN)`);
    // Nada de renglones invisibles para reservar el pie: el QR ya no se estampa encima.
    expect(bloques.some((b) => b.text === '\u00a0')).toBe(false);
  });

  it('el QR tiene la forma oficial sobre simulado.invalid, nunca el host del SIN', () => {
    const qr = qrContent(factura);
    expect(qr).toBe(
      `https://simulado.invalid/consulta/QR?nit=${factura.issuer.nit}&cuf=${factura.cuf}&numero=${factura.invoiceNumber}&t=2`,
    );
    expect(qrContent(factura, 1).endsWith('&t=1')).toBe(true);
    expect(todo).not.toMatch(/impuestos\.gob\.bo/);
  });

  it('el bloque de QR del motor codifica la dirección simulada', async () => {
    const qr = await invoiceQrBlock(factura);
    expect(qr?.kind).toBe('qr');
    expect(qr?.title).toBe('Verificación SIMULADA');
    expect(qr?.text).toContain('simulado.invalid');
    expect(qr?.qr?.size).toBeGreaterThan(20);
    expect(qr?.text).not.toMatch(/impuestos\.gob\.bo/);
  });

  it('el PDF se arma con y sin QR, y el QR se dibuja dentro del flujo', async () => {
    // Another suite mocks jspdf; load the real library for this artifact assertion.
    vi.doUnmock('jspdf');
    vi.resetModules();
    const { buildGraphicRepresentation } = await import('./graphic-representation');
    const sinQr = buildGraphicRepresentation(factura, null);
    expect(sinQr.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const conQr = buildGraphicRepresentation(factura, QR_DE_PRUEBA);
    expect(conQr.getNumberOfPages()).toBeGreaterThanOrEqual(sinQr.getNumberOfPages());
    // El QR vectorial agrega rectángulos: el documento con QR pesa más.
    expect(conQr.output().length).toBeGreaterThan(sinQr.output().length);
  });

  it('no usa los caracteres que las fuentes no traen, y escribe «solo» sin tilde', () => {
    expect(todo).not.toMatch(/[→●✓]/);
    expect(todo).not.toMatch(/Sólo/);
  });

  it('los archivos se llaman como lo que son', () => {
    expect(fileName(factura, 'pdf')).toBe(`factura-${factura.invoiceNumber}-SIMULADA.pdf`);
    expect(fileName(factura, 'xml')).toBe(`factura-${factura.invoiceNumber}-SIMULADA.xml`);
  });
});
