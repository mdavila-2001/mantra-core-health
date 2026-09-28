/* ============================================================================
    Lo que la pantalla de facturación calcula sobre los cobros: las dos cifras
    de arriba, los filtros y los rótulos de estado. Funciones puras: se prueban
    sin montar nada.
    ========================================================================== */

import type {
  ChargeSource,
  SimulatedCharge,
  SimulatedInvoiceStatus,
} from '../../core/data-access/billing-simulated/billing-simulated.types';
import type { ChipVariant } from '../../shared/components/atoms/chip/chip.types';

/**
 * Estado de facturación de un cobro, visto desde la pantalla. `PAGO_PARCIAL`
 * es un plan con notas de venta y saldo: todavía no se puede facturar.
 */
export type EstadoDeCobro = 'SIN_PAGO' | 'PAGO_PARCIAL' | 'SIN_FACTURAR' | SimulatedInvoiceStatus;

export type FiltroDeOrigen = 'TODOS' | ChargeSource;
export type FiltroDeEstado = 'TODOS' | EstadoDeCobro;

export interface ResumenDeCobros {
  /** Suma de lo pagado en los cobros visibles —notas de venta incluidas—, en texto decimal. */
  readonly montoCobrado: string;
  /** Pacientes distintos con al menos un pago entre los cobros visibles. */
  readonly pacientesConPago: number;
  readonly cobrosPendientes: number;
}

function centavos(importe: string): number {
  const [entero, decimales = ''] = importe.split('.');
  return Number(entero) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
}

function importe(c: number): string {
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

export function estadoDeCobro(cobro: SimulatedCharge): EstadoDeCobro {
  if (cobro.payment === null) return cobro.plan !== null && centavos(cobro.plan.paidTotal) > 0 ? 'PAGO_PARCIAL' : 'SIN_PAGO';
  return cobro.latestInvoice?.status ?? 'SIN_FACTURAR';
}

/** Lo que ya entró por un cobro: su pago, o las notas de venta de su plan. */
export function pagadoDeCobro(cobro: SimulatedCharge): string {
  return cobro.payment?.amount ?? cobro.plan?.paidTotal ?? '0.00';
}

export function resumenDeCobros(cobros: readonly SimulatedCharge[]): ResumenDeCobros {
  const conPago = cobros.filter((c) => centavos(pagadoDeCobro(c)) > 0);
  return {
    montoCobrado: importe(conPago.reduce((suma, c) => suma + centavos(pagadoDeCobro(c)), 0)),
    pacientesConPago: new Set(conPago.map((c) => c.patientProfileId)).size,
    cobrosPendientes: cobros.filter((c) => c.payment === null).length,
  };
}

export function filtrarCobros(
  cobros: readonly SimulatedCharge[],
  origen: FiltroDeOrigen,
  estado: FiltroDeEstado,
): SimulatedCharge[] {
  return cobros.filter(
    (c) => (origen === 'TODOS' || c.source === origen) && (estado === 'TODOS' || estadoDeCobro(c) === estado),
  );
}

export const ROTULO_DE_ORIGEN: Readonly<Record<ChargeSource, string>> = {
  CONSULTATION: 'Consulta',
  PHARMACY: 'Farmacia',
};

/** Los estados fiscales llevan «(SIMULADO)»: ninguno viene del SIN. */
export const ROTULO_DE_ESTADO: Readonly<Record<EstadoDeCobro, string>> = {
  SIN_PAGO: 'Sin pago',
  PAGO_PARCIAL: 'Pago parcial · nota de venta',
  SIN_FACTURAR: 'Sin facturar',
  VALIDATED: 'Validada (SIMULADO)',
  OBSERVED: 'Observada (SIMULADO)',
  REJECTED: 'Rechazada (SIMULADO)',
  ANNULLED: 'Anulada (SIMULADO)',
};

export const TONO_DE_ESTADO: Readonly<Record<EstadoDeCobro, ChipVariant>> = {
  SIN_PAGO: 'neutral',
  PAGO_PARCIAL: 'warning',
  // Una acción pendiente, no un logro: con el tono de éxito se leía igual que «Pagada».
  SIN_FACTURAR: 'warning',
  VALIDATED: 'success',
  OBSERVED: 'warning',
  REJECTED: 'error',
  ANNULLED: 'neutral',
};

export const OPCIONES_DE_ORIGEN: readonly { readonly value: FiltroDeOrigen; readonly label: string }[] = [
  { value: 'TODOS', label: 'Todos los orígenes' },
  { value: 'CONSULTATION', label: 'Consultas' },
  { value: 'PHARMACY', label: 'Farmacia' },
];

export const OPCIONES_DE_ESTADO: readonly { readonly value: FiltroDeEstado; readonly label: string }[] = [
  { value: 'TODOS', label: 'Todos los estados' },
  ...(Object.keys(ROTULO_DE_ESTADO) as EstadoDeCobro[]).map((value) => ({ value, label: ROTULO_DE_ESTADO[value] })),
];
