/* ============================================================================
    La nota de venta (PDF) de un pago a cuenta del plan.

    Es un comprobante **interno**: no pasa por el SIAT, no tiene CUF ni QR y
    no sirve para crédito fiscal. Lo dice en el título, en la marca de agua y
    en el pie. La factura del servicio se emite una sola vez, por el total,
    cuando el plan queda saldado.

    Mismo maquetador (`buildBlocksPdf`) y misma marca de agua que la
    representación gráfica de la factura simulada.
    ========================================================================== */

import type {
  SimulatedCharge,
  SimulatedIssuer,
  SimulatedPlanInstance,
  SimulatedSalesNote,
} from '../../core/data-access/billing-simulated/billing-simulated.types';
import { buildBlocksPdf, campoDeBloque, type PdfBlock } from '../../shared/utils/pdf-export/pdf-export';
import { bs, centavos, deCentavos } from './cobros-en-pantalla';
import { montoLiteral } from './monto-literal';
import { marcarComoSimulado } from './representacion-grafica';

export const LEYENDA_DE_NOTA_DE_VENTA = 'NOTA DE VENTA — NO VÁLIDA COMO FACTURA';

/** `NV-000042` → 42: el correlativo ordena las notas, la hora no (dos pagos pueden caer en el mismo instante). */
function correlativo(nota: SimulatedSalesNote): number {
  return Number(nota.number.replace(/^NV-/, '')) || 0;
}

/** Lo pagado en el plan hasta esta nota, inclusive: el saldo que figura en el papel. */
export function pagadoHasta(cobro: SimulatedCharge, nota: SimulatedSalesNote): string {
  const notas = cobro.plan?.instances.flatMap((i) => i.salesNotes) ?? [];
  const hasta = correlativo(nota);
  return deCentavos(notas.filter((n) => correlativo(n) <= hasta).reduce((suma, n) => suma + centavos(n.amount), 0));
}

export function bloquesDeNotaDeVenta(
  cobro: SimulatedCharge,
  instancia: SimulatedPlanInstance,
  nota: SimulatedSalesNote,
  emisor: SimulatedIssuer | null,
): PdfBlock[] {
  const plan = cobro.plan!;
  const pagado = pagadoHasta(cobro, nota);
  return [
    { kind: 'note', text: `${LEYENDA_DE_NOTA_DE_VENTA}. Comprobante interno SIMULADO de un pago a cuenta del plan.` },
    { kind: 'heading', level: 1, text: 'NOTA DE VENTA (SIMULADA)' },
    { kind: 'heading', level: 2, text: 'Emisor' },
    campoDeBloque('Razón social', emisor?.legalName ?? 'Consultorio (SIMULADO)'),
    ...(emisor === null ? [] : [campoDeBloque('NIT (SIMULADO)', emisor.nit), campoDeBloque('Dirección', emisor.address)]),
    campoDeBloque('Nota de venta N.º', nota.number),
    campoDeBloque('Fecha', nota.issuedAt.slice(0, 16).replace('T', ' ')),
    { kind: 'heading', level: 2, text: 'Cliente' },
    campoDeBloque('Nombre', cobro.suggestedBuyer.name || cobro.patientName),
    ...(cobro.suggestedBuyer.documentNumber === '' ? [] : [campoDeBloque('CI', cobro.suggestedBuyer.documentNumber)]),
    { kind: 'heading', level: 2, text: 'Detalle' },
    campoDeBloque('Servicio', plan.serviceName),
    campoDeBloque('Ítem', `${instancia.label} (a cobrar ${bs(instancia.expectedAmount)})`),
    campoDeBloque('Medio de pago', nota.methodLabel),
    { kind: 'total', text: `Monto recibido: ${bs(nota.amount)}` },
    { kind: 'paragraph', text: montoLiteral(nota.amount) },
    { kind: 'heading', level: 2, text: 'Estado del plan' },
    campoDeBloque('Monto del servicio', bs(plan.expectedTotal)),
    campoDeBloque('Pagado a la fecha', bs(pagado)),
    campoDeBloque('Saldo', bs(deCentavos(Math.max(centavos(plan.expectedTotal) - centavos(pagado), 0)))),
    {
      kind: 'note',
      text: 'Mientras el plan tenga saldo, cada pago lleva nota de venta. La factura se emite por el total del servicio cuando el plan queda saldado.',
    },
  ];
}

export function nombreDeNotaDeVenta(nota: SimulatedSalesNote): string {
  return `nota-de-venta-${nota.number}-SIMULADA.pdf`;
}

export function descargarNotaDeVenta(
  cobro: SimulatedCharge,
  instancia: SimulatedPlanInstance,
  nota: SimulatedSalesNote,
  emisor: SimulatedIssuer | null,
): void {
  const documento = buildBlocksPdf(bloquesDeNotaDeVenta(cobro, instancia, nota, emisor), {
    title: 'Nota de venta (SIMULADA)',
    kind: 'Nota de venta',
    reference: nota.number,
    subtitle: `${emisor?.legalName ?? 'Consultorio'} · ${nota.issuedAt.slice(0, 10)}`,
    footerNote: 'Nota de venta SIMULADA · No válida como factura · Sin validez fiscal · AloVida',
  });
  marcarComoSimulado(documento);
  documento.save(nombreDeNotaDeVenta(nota));
}
