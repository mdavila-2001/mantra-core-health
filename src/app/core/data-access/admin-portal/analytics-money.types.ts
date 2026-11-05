/* ============================================================================
    Dinero que mueve cada módulo (`GET /admin/analytics/money`).

    Contrato acordado con la API (franja 2026-10-30, «Medición por
    funcionalidad»): agregados por módulo, tipo de importe y moneda. Todo es
    agregado; no hay personas ni documentos individuales.

    Reglas del contrato que la pantalla respeta:
    - `amount` es un **decimal exacto como cadena** (`"18450.50"`), jamás un
      `number`: el front no lo convierte ni lo redondea.
    - Cada fila es de **una** moneda. Las monedas no se suman entre sí.
    - Un módulo que no se pudo medir figura en `notMeasured` con su razón; no
      aparece con importe cero.
    ========================================================================== */

/** Qué clase de importe es: no se suman entre sí (lo facturado no es lo cobrado). */
export type MoneyKind = 'FACTURADO' | 'COBRADO' | 'COTIZADO' | 'OTRO';

export interface MoneyQuery {
  readonly from?: string;
  readonly to?: string;
}

export interface MoneyWindow {
  readonly from: string;
  readonly to: string;
}

export interface MoneyItem {
  /** Clave estable del módulo, como la declara la API. */
  readonly module: string;
  /** Nombre legible del módulo, ya en el idioma de la interfaz. */
  readonly moduleLabel: string;
  readonly kind: MoneyKind;
  /** Código de moneda (ISO 4217). Una fila, una moneda. */
  readonly currency: string;
  /** Cuántas operaciones componen el importe. */
  readonly operations: number;
  /** Decimal exacto como cadena. Nunca `number`. */
  readonly amount: string;
}

export interface MoneyNotMeasured {
  readonly module: string;
  readonly reason: string;
}

export interface MoneyReport {
  readonly window: MoneyWindow;
  readonly items: readonly MoneyItem[];
  readonly notMeasured: readonly MoneyNotMeasured[];
}
