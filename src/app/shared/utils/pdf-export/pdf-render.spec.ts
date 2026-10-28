import { buildBlocksPdf, fieldsBlock, noteBlock, panelsBlock, totalsBlock, type PdfBlock } from './pdf-export';

/**
 * Prueba de humo con el `jsPDF` **real**, sin dobles.
 *
 * `pdf-export.spec.ts` mockea `jspdf` para medir lo que el maquetador pide, y
 * en ese doble no hay `ShadingPattern` ni API avanzada: los degradados de la
 * portada, del pie y del total caen ahí al color del medio. Este archivo pasa
 * por el camino de verdad —degradados, recortes, opacidad, sombras, QR— y
 * comprueba que el documento sale entero.
 */
describe('el maquetador con el jsPDF real', () => {
  const fila = (celdas: string[], header = false): PdfBlock => ({
    kind: 'row',
    text: celdas.join('\t'),
    cells: celdas,
    ...(header ? { header: true } : {}),
  });

  it('arma un documento de varias hojas con todos los bloques', () => {
    const doc = buildBlocksPdf(
      [
        panelsBlock([
          { title: 'Paciente', fields: [{ label: 'Nombre', value: 'Paciente de prueba' }] },
          { title: 'Profesional', fields: [{ label: 'Nombre', value: 'Profesional de prueba' }] },
        ]),
        { kind: 'heading', level: 2, text: 'Datos' },
        fieldsBlock([
          { label: 'Fecha', value: '22/10/2026' },
          { label: 'Estado', value: 'Atendida' },
        ]),
        noteBlock('Aviso de prueba.', 'alert', 'Alergias'),
        fila(['Concepto', 'Importe'], true),
        ...Array.from({ length: 60 }, (_, i) => fila([`Cuota ${i + 1}`, '100,00 Bs'])),
        totalsBlock([{ label: 'Total a pagar', value: '6.000,00 Bs', emphasis: true }]),
        { kind: 'qr', text: 'Leyenda', title: 'Verificación', qr: { size: 3, modules: [1, 0, 1, 0, 1, 0, 1, 0, 1] } },
      ],
      { title: 'Documento de prueba', kind: 'Prueba', reference: 'N.º 1', watermark: 'Sin validez', firma: null, logo: null },
    );

    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-');
    // El degradado de la portada se registró como patrón de sombreado: el camino real, no el de respaldo.
    expect(doc.output()).toContain('/ShadingType 2');
  });
});
