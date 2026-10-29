import { cobrosDePrueba } from './billing.spec-fixtures';
import {
  saleNoteBlocks,
  buildSalesNotePdf,
  SALE_NOTE_LEGEND,
  saleNoteName,
  paidUntil,
  SALES_NOTE_FOOTER,
  SALES_NOTE_WATERMARK,
  salesNotePdfOptions,
} from './sales-note';
import { formatMoney } from '../../shared/utils/pdf-export/pdf-export';
import type { SimulatedIssuer } from '../../core/data-access/billing-simulated/billing-simulated.types';

/**
 * Qué dice la nota de venta y qué lleva la portada, sin abrir el PDF: la
 * maquetación tiene sus pruebas en `pdf-export.spec.ts`.
 */

const EMISOR: SimulatedIssuer = {
  id: 'emisor-prueba',
  kind: 'PRACTICE',
  nit: '0000000000',
  legalName: 'Consultorio de Prueba S.R.L.',
  municipality: 'La Paz',
  address: 'Calle Ficticia N.º 0000',
  phone: '2 000 0000',
  branchCode: 0,
  pointOfSaleCode: 0,
  documentSector: 1,
  simulated: true,
};

describe('nota de venta SIMULADA', () => {
  const cobro = cobrosDePrueba().find((c) => c.plan?.instances.some((i) => i.salesNotes.length > 0))!;
  const instancia = cobro.plan!.instances.find((i) => i.salesNotes.length > 0)!;
  const nota = instancia.salesNotes[0]!;
  const bloques = saleNoteBlocks(cobro, instancia, nota, EMISOR);
  const todo = bloques.map((b) => b.text).join('\n');
  const opciones = salesNotePdfOptions(nota, EMISOR);

  it('abre con un aviso de alerta: no es una factura', () => {
    const [primero] = bloques;
    expect(primero?.kind).toBe('note');
    expect(primero?.tone).toBe('alert');
    expect(primero?.title).toBe('Comprobante interno');
    expect(primero?.text).toContain(SALE_NOTE_LEGEND);
  });

  it('dice «no válida como factura» en el aviso, la marca de agua y el pie, y nada más', () => {
    const veces = (texto: string | undefined) => (texto ?? '').toLocaleLowerCase('es').split('no válida como factura').length - 1;
    expect(veces(todo)).toBe(1);
    expect(veces(opciones.watermark)).toBe(1);
    expect(veces(opciones.footerNote)).toBe(1);
    expect(veces(opciones.title) + veces(opciones.subtitle) + veces(opciones.kind)).toBe(0);
  });

  it('dice que no es una factura en la portada, en cada hoja y en el pie', () => {
    expect(opciones.title).toBe('Nota de venta (simulada)');
    expect(opciones.subtitle).toBe('Pago a cuenta del plan');
    expect(opciones.watermark).toBe(SALES_NOTE_WATERMARK);
    expect(SALES_NOTE_WATERMARK.toLocaleUpperCase('es')).toBe('SIMULADA · NO VÁLIDA COMO FACTURA');
    expect(opciones.footerNote).toBe(SALES_NOTE_FOOTER);
    expect(SALES_NOTE_FOOTER).toContain('No válida como factura');
  });

  it('la portada lleva el número, la fecha real del pago y el emisor; sin firma', () => {
    expect(opciones.reference).toBe(`N.º ${nota.number}`);
    expect(opciones.issuedAt).toEqual(new Date(nota.issuedAt));
    expect(opciones.issuer?.name).toBe(EMISOR.legalName);
    expect(opciones.issuer?.details?.[0]?.replace(/\u00a0/g, ' ')).toBe('NIT 0000000000 (SIMULADO)');
    expect(opciones.firma).toBeNull();
    // Sin emisor no se inventa uno: el mismo rótulo genérico que el cuerpo.
    expect(salesNotePdfOptions(nota, null).issuer).toEqual({ name: 'Consultorio (SIMULADO)' });
    // Sin fecha legible, el motor rotula «Fecha de generación».
    expect(salesNotePdfOptions({ ...nota, issuedAt: 'no-es-una-fecha' }, EMISOR).issuedAt).toBeUndefined();
  });

  it('no repite en el cuerpo el número ni la fecha de la portada', () => {
    expect(todo).not.toContain(nota.number);
    expect(todo).not.toContain(nota.issuedAt.slice(0, 10));
  });

  it('el emisor y el cliente van en paneles lado a lado', () => {
    const paneles = bloques.find((b) => b.kind === 'panels');
    expect(paneles?.panels?.map((p) => p.title)).toEqual(['Emisor', 'Cliente']);
    expect(paneles?.text).toContain(`Razón social: ${EMISOR.legalName}`);
    expect(paneles?.text).toContain('NIT (SIMULADO): 0000000000');
    expect(saleNoteBlocks(cobro, instancia, nota, null).find((b) => b.kind === 'panels')?.text).toContain(
      'Razón social: Consultorio (SIMULADO)',
    );
  });

  it('el pago va en una tabla con cabecera y el monto recibido, resaltado en la caja de totales', () => {
    const filas = bloques.filter((b) => b.kind === 'row');
    expect(filas[0]?.header).toBe(true);
    expect(filas[0]?.cells).toEqual(['Servicio', 'Ítem', 'Medio de pago', 'A cobrar', 'Recibido']);
    // Celdas sin moneda, con el formato común «1.234,56».
    expect(filas[1]?.cells).toEqual([
      cobro.plan!.serviceName,
      instancia.label,
      nota.methodLabel,
      formatMoney(instancia.expectedAmount, null),
      formatMoney(nota.amount, null),
    ]);
    expect(filas[1]?.cells?.[4]).toMatch(/^\d{1,3}(\.\d{3})*,\d{2}$/);
    const totales = bloques.find((b) => b.kind === 'totals')?.totals;
    expect(totales).toEqual([{ label: 'Monto recibido', value: formatMoney(nota.amount), emphasis: true }]);
    expect(totales?.[0]?.value).toMatch(/^\d{1,3}(\.\d{3})*,\d{2} Bs$/);
    // El literal, en una rejilla rotulada como en la factura.
    const son = bloques.flatMap((b) => (b.kind === 'fields' ? (b.fields ?? []) : [])).find((f) => f.label === 'Son');
    expect(son?.value).toMatch(/Bolivianos$/);
    expect(todo).toContain('Son: ');
    expect(todo).toContain('Importes en bolivianos (Bs).');
  });

  it('el estado del plan suma lo pagado hasta esta nota y no deja un saldo negativo', () => {
    const estado = bloques.find((b) => b.kind === 'fields' && b.fields?.some((f) => f.label === 'Monto del servicio'));
    expect(estado?.fields).toEqual([
      { label: 'Monto del servicio', value: formatMoney(cobro.plan!.expectedTotal) },
      { label: 'Pagado a la fecha', value: formatMoney(paidUntil(cobro, nota)) },
      expect.objectContaining({ label: 'Saldo del plan' }),
    ]);
    expect(estado?.fields?.[2]?.value).not.toMatch(/-/);
  });

  it('no usa los caracteres que las fuentes no traen', () => {
    expect(todo).not.toMatch(/[→●✓]/);
  });

  it('el PDF se arma y el archivo dice lo que es', () => {
    expect(buildSalesNotePdf(cobro, instancia, nota, EMISOR).getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(saleNoteName(nota)).toBe(`nota-de-venta-${nota.number}-SIMULADA.pdf`);
  });
});
