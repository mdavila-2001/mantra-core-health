import { quotationBlocks, quotationPdfOptions, type QuotationPdfData } from './quotation-pdf';

/**
 * Lo que se fija: QUÉ dice la cotización —datos, plan, cuotas, totales y
 * condiciones— y cómo se presenta en la portada (vigencia, sin firma, sin fecha
 * de emisión inventada). El motor de render no aparece: sus pruebas viven en
 * `pdf-export.spec.ts`. El formulario que la descarga se prueba aparte, con el
 * token `QUOTATION_PDF_DOWNLOADER` (`quotation-form.spec.ts`).
 */

const cotizacion = (extra: Partial<QuotationPdfData> = {}): QuotationPdfData => ({
  patientName: 'Ana Pérez',
  serviceName: 'Tratamiento de ortodoncia',
  offeredPrice: 3000,
  downPaymentAmount: 600,
  paymentFrequency: 'MONTHLY',
  attentionDate: '2026-11-02',
  validUntil: '2026-11-30',
  installments: [
    { installmentNumber: 1, dueDate: '2026-12-02', amount: 800 },
    { installmentNumber: 2, dueDate: '2027-01-02', amount: 800 },
    { installmentNumber: 3, dueDate: '2027-02-02', amount: 800 },
  ],
  ...extra,
});


/** Los datos de todas las rejillas, por etiqueta. */
const datos = (data: QuotationPdfData): Record<string, string> =>
  Object.fromEntries(
    quotationBlocks(data)
      .filter((bloque) => bloque.kind === 'fields')
      .flatMap((bloque) => (bloque.fields ?? []).map((campo) => [campo.label, campo.value])),
  );

describe('quotationPdfOptions', () => {
  it('la portada dice la clase, el título, de quién y de qué es', () => {
    const opciones = quotationPdfOptions(cotizacion());
    expect(opciones.kind).toBe('Cotización');
    expect(opciones.title).toBe('Cotización de servicios');
    expect(opciones.subtitle).toBe('Ana Pérez · Tratamiento de ortodoncia');
  });

  it('la vigencia va en los metadatos de la portada, en palabras', () => {
    expect(quotationPdfOptions(cotizacion()).meta).toEqual([
      { label: 'Válida hasta', value: '30/11/2026' },
    ]);
    expect(quotationPdfOptions(cotizacion({ validUntil: '' })).meta).toEqual([
      { label: 'Válida hasta', value: 'Sin fecha de vencimiento' },
    ]);
  });

  it('no la firma un médico ni inventa una fecha de emisión', () => {
    const opciones = quotationPdfOptions(cotizacion());
    expect(opciones.firma).toBeNull();
    // Sale del formulario antes de guardarse: el motor rotula la de generación.
    expect(opciones.issuedAt).toBeUndefined();
    expect(opciones.footerNote).toContain('No es una factura');
  });
});

describe('quotationBlocks', () => {
  it('los datos del plan van en una rejilla, con fechas dd/mm/aaaa y montos en bolivianos', () => {
    expect(datos(cotizacion())).toEqual({
      'Fecha de atención': '02/11/2026',
      'Precio ofrecido': '3.000,00 Bs',
      Frecuencia: 'Mensual',
      Cuotas: '3',
    });
    expect(datos(cotizacion({ attentionDate: '', paymentFrequency: 'BIWEEKLY' }))).toMatchObject({
      'Fecha de atención': 'No definida',
      Frecuencia: 'Quincenal',
    });
  });

  it('lo que ya dice la portada no se repite en el cuerpo: paciente, servicio, vigencia', () => {
    const todo = quotationBlocks(cotizacion())
      .map((bloque) => bloque.text)
      .join('\n');
    expect(todo).not.toContain('Ana Pérez');
    expect(todo).not.toContain('Tratamiento de ortodoncia');
    expect(todo).not.toContain('Válida hasta');
    expect(todo).not.toContain('30/11/2026');
  });

  it('cada cuota es una fila de la tabla, con su vencimiento y su monto con moneda', () => {
    const bloques = quotationBlocks(cotizacion());
    const cabecera = bloques.find((bloque) => bloque.kind === 'row' && bloque.header === true);
    const filas = bloques.filter((bloque) => bloque.kind === 'row' && bloque.header !== true);

    expect(cabecera?.cells).toEqual(['Cuota', 'Vencimiento', 'Monto']);
    expect(filas.map((fila) => fila.cells)).toEqual([
      ['1', '02/12/2026', '800,00 Bs'],
      ['2', '02/01/2027', '800,00 Bs'],
      ['3', '02/02/2027', '800,00 Bs'],
    ]);
  });

  it('la caja de totales cierra: anticipo más saldo en cuotas es el total del plan, resaltado', () => {
    const bloques = quotationBlocks(cotizacion());
    const caja = bloques.find((bloque) => bloque.kind === 'totals');

    expect(caja?.totals).toEqual([
      { label: 'Anticipo', value: '600,00 Bs' },
      { label: 'Saldo en cuotas', value: '2.400,00 Bs' },
      { label: 'Total del plan', value: '3.000,00 Bs', emphasis: true },
    ]);
    // El precio ofrecido es un dato de la oferta, no un sumando de la caja.
    expect(caja?.totals?.map((fila) => fila.label)).not.toContain('Precio ofrecido');
    // Va después de la última cuota: el total resume lo que se acaba de leer.
    const ultimaFila = bloques.filter((bloque) => bloque.kind === 'row').at(-1);
    expect(bloques.indexOf(caja!)).toBeGreaterThan(bloques.indexOf(ultimaFila!));
  });

  it('el saldo y el total salen de las filas impresas, aunque no coincidan con el precio ofrecido', () => {
    const caja = quotationBlocks(cotizacion({ downPaymentAmount: 0 })).find((b) => b.kind === 'totals');
    expect(caja?.totals).toEqual([
      { label: 'Anticipo', value: '0,00 Bs' },
      { label: 'Saldo en cuotas', value: '2.400,00 Bs' },
      { label: 'Total del plan', value: '2.400,00 Bs', emphasis: true },
    ]);
  });

  it('las condiciones van en un aviso al final: cómo se paga y que no es una factura', () => {
    const bloques = quotationBlocks(cotizacion());
    const aviso = bloques.at(-1);

    expect(aviso?.kind).toBe('note');
    expect(aviso?.tone).toBe('brand');
    expect(aviso?.title).toBe('Condiciones');
    expect(aviso?.text).toBe(
      'El saldo se paga en 3 cuotas mensuales, sin interés, en las fechas de vencimiento indicadas. Esta cotización es un presupuesto: no es una factura ni un comprobante de pago.',
    );
    expect(
      quotationBlocks(cotizacion({ installments: [cotizacion().installments[0]!], paymentFrequency: 'WEEKLY' }))
        .at(-1)?.text,
    ).toContain('El saldo se paga en una cuota, sin interés,');
  });

  it('con pago único no hay tabla ni «Cuotas: 0»: la rejilla dice la forma de pago', () => {
    const datosContado = cotizacion({ installments: [] });
    const contado = quotationBlocks(datosContado);
    expect(contado.some((bloque) => bloque.kind === 'row')).toBe(false);
    expect(datos(datosContado)).toEqual({
      'Fecha de atención': '02/11/2026',
      'Precio ofrecido': '3.000,00 Bs',
      'Forma de pago': 'Pago único',
    });
    expect(contado.at(-1)?.text).toContain('Se paga completo el día de la atención.');
    expect(contado.find((bloque) => bloque.kind === 'totals')?.totals).toEqual([
      { label: 'Total a pagar', value: '600,00 Bs', emphasis: true },
    ]);

    const datosSinPlan = cotizacion({ installments: [], downPaymentAmount: 0 });
    expect(datos(datosSinPlan)['Forma de pago']).toBe('Sin definir');
    expect(quotationBlocks(datosSinPlan).at(-1)?.text).toContain('Sin plan de pagos armado todavía.');
  });
});
