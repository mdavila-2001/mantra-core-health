/* ============================================================================
    Contabilidad simple del doctor (28/09/2026, P49).

    El pedido del propietario, literal: «gasto → tipo, activo → tipo, deuda →
    tipo, transacción debe/haber, nada más; nada de centros de costo ni cosas
    complicadas; cuenta → modal y tabla». Y arriba de todo, tres números:
    cuántos pacientes se atendieron, cuánto dinero se hizo y cuánto se espera
    recibir de las aseguradoras.

    **El tipo de un gasto, un activo o una deuda ES una cuenta** de su clase.
    Así el gestor de cuentas y los tipos son una sola cosa: crear una cuenta
    de gasto es crear un tipo de gasto nuevo.

    Los importes viajan como **cadena decimal** (`'1250.00'`), igual que el
    resto de la contabilidad: `Number` perdería los decimales que importan.
    ========================================================================== */

/** Las cinco clases de cuenta. Ninguna más: es la contabilidad de un consultorio. */
export const ACCOUNT_CLASSES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const;
export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

/** Una cuenta del gestor. */
export interface SimpleAccount {
  readonly id: string;
  /** Código corto, `5.3`. Lo asigna el servidor al crear si no se manda. */
  readonly code: string;
  readonly name: string;
  readonly accountClass: AccountClass;
  /**
   * Viene sembrada —las cuentas generales de cualquier práctica médica—. Se
   * puede renombrar pero no borrar: otros doctores y los tipos de siempre
   * cuelgan de ella.
   */
  readonly seeded: boolean;
}

export interface SimpleAccountInput {
  readonly name: string;
  readonly accountClass: AccountClass;
}

/** Las tres clases de registro que el doctor carga a mano. */
export const RECORD_KINDS = ['EXPENSE', 'ASSET', 'DEBT'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

/** De qué clase tiene que ser la cuenta (el tipo) de cada registro. */
export const CLASS_OF_KIND: Readonly<Record<RecordKind, AccountClass>> = {
  EXPENSE: 'EXPENSE',
  ASSET: 'ASSET',
  DEBT: 'LIABILITY',
};

/** Un gasto, un activo o una deuda. */
export interface SimpleRecord {
  readonly id: string;
  readonly kind: RecordKind;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** El tipo: una cuenta de la clase que corresponde a `kind`. */
  readonly accountId: string;
  readonly description: string;
  /** Cadena decimal, siempre positiva. */
  readonly amount: string;
}

export interface SimpleRecordInput {
  readonly kind: RecordKind;
  readonly date: string;
  readonly accountId: string;
  readonly description: string;
  readonly amount: string;
}

/** Una transacción: debe y haber, nada más. */
export interface SimpleTransaction {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly debitAccountId: string;
  readonly creditAccountId: string;
  readonly amount: string;
}

export interface SimpleTransactionInput {
  readonly date: string;
  readonly description: string;
  readonly debitAccountId: string;
  readonly creditAccountId: string;
  readonly amount: string;
}

/** El período de los tres números de arriba. */
export type SummaryPeriod = 'month' | 'year';

/** Los tres números que el doctor ve primero. */
export interface PractitionerSummary {
  readonly period: SummaryPeriod;
  /** Primer y último día del período, `YYYY-MM-DD`. */
  readonly from: string;
  readonly to: string;
  /** Personas distintas atendidas (consultas marcadas «Atendida»). */
  readonly patientsSeen: number;
  /** Consultas atendidas: una persona puede venir dos veces. */
  readonly consultations: number;
  /** Lo que cobraste en el período: consultas pagadas. Cadena decimal. */
  readonly collected: string;
  /**
   * Lo que esperás recibir de las aseguradoras, **a hoy**: solicitudes
   * enviadas sin dictamen (por lo facturado) y aprobadas sin pagar (por lo
   * aprobado). No depende del período: es un saldo, no un movimiento.
   */
  readonly expectedFromInsurers: string;
  /** Cuántas solicitudes componen ese saldo. */
  readonly pendingClaims: number;
}
