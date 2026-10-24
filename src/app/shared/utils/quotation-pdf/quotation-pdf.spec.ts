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

const FECHA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });
const dia = (iso: string): string => FECHA.format(new Date(`${iso}T00:00:00`));

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
      { label: 'Válida hasta', value: dia('2026-11-30') },
    ]);
    expect(quotationPdfOptions(cotizacion({ validUntil: '' })).meta).toEqual([
      { label: 'Válida hasta', value: 'No definida' },
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
  it('los datos del plan van en una rejilla', () => {
    expect(datos(cotizacion())).toEqual({
      'Fecha de atención': dia('2026-11-02'),
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
    expect(todo).not.toContain(dia('2026-11-30'));
  });

  it('cada cuota es una fila de la tabla, con su vencimiento en palabras', () => {
    const bloques = quotationBlocks(cotizacion());
    const cabecera = bloques.find((bloque) => bloque.kind === 'row' && bloque.header === true);
    const filas = bloques.filter((bloque) => bloque.kind === 'row' && bloque.header !== true);

    expect(cabecera?.cells).toEqual(['Cuota', 'Vencimiento', 'Monto']);
    expect(filas.map((fila) => fila.cells)).toEqual([
      ['1', dia('2026-12-02'), '800.00'],
      ['2', dia('2027-01-02'), '800.00'],
      ['3', dia('2027-02-02'), '800.00'],
    ]);
  });

  it('la caja de totales cierra con el total del plan —anticipo más cuotas— resaltado', () => {
    const bloques = quotationBlocks(cotizacion());
    const caja = bloques.find((bloque) => bloque.kind === 'totals');

    expect(caja?.totals).toEqual([
      { label: 'Precio ofrecido', value: '3000.00' },
      { label: 'Anticipo', value: '600.00' },
      { label: 'Total del plan', value: '3000.00', emphasis: true },
    ]);
    // Va después de la última cuota: el total resume lo que se acaba de leer.
    const ultimaFila = bloques.filter((bloque) => bloque.kind === 'row').at(-1);
    expect(bloques.indexOf(caja!)).toBeGreaterThan(bloques.indexOf(ultimaFila!));
  });

  it('el total sale de las filas impresas, aunque no coincida con el precio ofrecido', () => {
    const caja = quotationBlocks(cotizacion({ downPaymentAmount: 0 })).find((b) => b.kind === 'totals');
    expect(caja?.totals?.at(-1)).toEqual({ label: 'Total del plan', value: '2400.00', emphasis: true });
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

  it('sin cuotas no hay tabla, y el aviso dice cómo se paga', () => {
    const contado = quotationBlocks(cotizacion({ installments: [] }));
    expect(contado.some((bloque) => bloque.kind === 'row')).toBe(false);
    expect(contado.at(-1)?.text).toContain('Se paga completo el día de la atención.');
    expect(contado.find((bloque) => bloque.kind === 'totals')?.totals?.at(-1)?.value).toBe('600.00');

    const sinPlan = quotationBlocks(cotizacion({ installments: [], downPaymentAmount: 0 }));
    expect(sinPlan.at(-1)?.text).toContain('Sin plan de pagos armado todavía.');
  });
});
