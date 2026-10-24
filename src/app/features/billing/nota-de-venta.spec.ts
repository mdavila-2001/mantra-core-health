import { cobrosDePrueba } from './billing.spec-fixtures';
import { bs } from './cobros-en-pantalla';
import {
  bloquesDeNotaDeVenta,
  buildSalesNotePdf,
  LEYENDA_DE_NOTA_DE_VENTA,
  nombreDeNotaDeVenta,
  pagadoHasta,
  SALES_NOTE_FOOTER,
  SALES_NOTE_WATERMARK,
  salesNotePdfOptions,
} from './nota-de-venta';
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
  const bloques = bloquesDeNotaDeVenta(cobro, instancia, nota, EMISOR);
  const todo = bloques.map((b) => b.text).join('\n');
  const opciones = salesNotePdfOptions(nota, EMISOR);

  it('abre con un aviso de alerta: no es una factura', () => {
    const [primero] = bloques;
    expect(primero?.kind).toBe('note');
    expect(primero?.tone).toBe('alert');
    expect(primero?.text).toContain(LEYENDA_DE_NOTA_DE_VENTA);
  });

  it('dice que no es una factura en la portada, en cada hoja y en el pie', () => {
    expect(opciones.title).toBe('NOTA DE VENTA (SIMULADA)');
    expect(opciones.subtitle).toContain('No válida como factura');
    expect(opciones.watermark).toBe(SALES_NOTE_WATERMARK);
    expect(SALES_NOTE_WATERMARK.toLocaleUpperCase('es')).toBe('SIMULADA · NO VÁLIDA COMO FACTURA');
    expect(opciones.footerNote).toBe(SALES_NOTE_FOOTER);
    expect(SALES_NOTE_FOOTER).toContain('No válida como factura');
  });

  it('la portada lleva el número, la fecha real del pago y el emisor; sin firma', () => {
    expect(opciones.reference).toBe(nota.number);
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
    expect(bloquesDeNotaDeVenta(cobro, instancia, nota, null).find((b) => b.kind === 'panels')?.text).toContain(
      'Razón social: Consultorio (SIMULADO)',
    );
  });

  it('el pago va en una tabla con cabecera y el monto recibido, resaltado en la caja de totales', () => {
    const filas = bloques.filter((b) => b.kind === 'row');
    expect(filas[0]?.header).toBe(true);
    expect(filas[0]?.cells).toEqual(['Servicio', 'Ítem', 'Medio de pago', 'A cobrar', 'Recibido']);
    expect(filas[1]?.cells).toEqual([
      cobro.plan!.serviceName,
      instancia.label,
      nota.methodLabel,
      bs(instancia.expectedAmount),
      bs(nota.amount),
    ]);
    const totales = bloques.find((b) => b.kind === 'totals')?.totals;
    expect(totales).toEqual([{ label: 'Monto recibido', value: bs(nota.amount), emphasis: true }]);
    expect(todo).toContain('Son: ');
  });

  it('el estado del plan suma lo pagado hasta esta nota y no deja un saldo negativo', () => {
    const estado = bloques.find((b) => b.kind === 'fields');
    expect(estado?.fields).toEqual([
      { label: 'Monto del servicio', value: bs(cobro.plan!.expectedTotal) },
      { label: 'Pagado a la fecha', value: bs(pagadoHasta(cobro, nota)) },
      expect.objectContaining({ label: 'Saldo del plan' }),
    ]);
    expect(estado?.fields?.[2]?.value).not.toMatch(/-/);
  });

  it('no usa los caracteres que las fuentes no traen', () => {
    expect(todo).not.toMatch(/[→●✓]/);
  });

  it('el PDF se arma y el archivo dice lo que es', () => {
    expect(buildSalesNotePdf(cobro, instancia, nota, EMISOR).getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(nombreDeNotaDeVenta(nota)).toBe(`nota-de-venta-${nota.number}-SIMULADA.pdf`);
  });
});
