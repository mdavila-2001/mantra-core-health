import type { InfoCalculo } from '../../../data-access/reporting/reporting.types';
import { INFO_EJEMPLO } from './reporting-dataset.util';

export const AVISO_TASAS = 'Tasas de comisión de EJEMPLO; no son parámetros de negocio.';

const SALVEDADES_COMISION: readonly string[] = [
  'Datos de EJEMPLO.',
  AVISO_TASAS,
  'No incluye al Visitador médico: su esquema de comisión no está definido todavía (decisión de negocio pendiente).',
  'No suma lo que la Plataforma retiene al cobrar: no se le paga a nadie, se muestra aparte.',
];

interface DefinicionInfo {
  readonly definicion: string;
  readonly formula: string;
  readonly numerador?: string;
  readonly denominador?: string;
  readonly fuente: string;
  /** Salvedades propias; se agregan a las comunes. */
  readonly salvedades?: readonly string[];
  /** `false` para gráficos que no hablan de comisiones (conciliación). */
  readonly esComision?: boolean;
}

export function info(d: DefinicionInfo): InfoCalculo {
  const comunes = d.esComision === false ? ['Datos de EJEMPLO.'] : SALVEDADES_COMISION;
  return {
    definicion: d.definicion,
    formula: d.formula,
    ...(d.numerador === undefined ? {} : { numerador: d.numerador }),
    ...(d.denominador === undefined ? {} : { denominador: d.denominador }),
    fuente: d.fuente,
    frescura: INFO_EJEMPLO.frescura,
    salvedades: [...(d.salvedades ?? []), ...comunes],
  };
}

export const FUENTE_COMISIONES =
  'payments.payment_splits, payments.payouts, payments.payout_items, insurance.broker_commission_statements, promotions.member_referrals';
export const FUENTE_FEES = 'payments.fee_schedules, payments.transaction_fees, payments.payment_transactions';
export const FUENTE_PAYOUTS = 'payments.payouts, payments.payout_items';
export const FUENTE_CONCILIACION =
  'payments.reconciliation_runs, payments.provider_reconciliation_records, payments.reconciliation_exceptions';
