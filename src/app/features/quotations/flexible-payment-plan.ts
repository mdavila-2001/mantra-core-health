import type {
  Installment,
  PaymentFrequency,
} from '../../core/data-access/quotations/quotations.types';

/* ============================================================================
    El plan de pagos flexible de una cotización (FT-24).

    **Sin interés.** Un consultorio no financia: reparte el precio de un
    tratamiento en las cuotas que le sirvan a la persona. Por eso no hay tasa ni
    método de amortización —lo que había antes era un simulador de crédito que
    el negocio no pidió— y cada cuota es sólo una fecha y un monto.

    **Flexible de verdad.** El cronograma se arma solo a partir del anticipo,
    la cantidad de cuotas y la frecuencia, pero después cada cuota se puede
    cambiar a mano: su fecha, su monto, sacarla o agregar otra. Una cuota cuyo
    monto se tocó queda **fijada** y las que no se tocaron se reparten lo que
    falta. Es el comportamiento que evita la cuenta a mano: «esta la paga en
    diciembre con el aguinaldo, lo demás en partes iguales».

    Toda la plata se cuenta en **centavos enteros**: tres cuotas de 100/3 en
    coma flotante no vuelven a sumar 100, y un plan que no cierra con el precio
    es justo lo que esta pantalla no puede dejar guardar.

    Es un archivo de funciones puras, sin Angular: el formulario las usa y la
    prueba las ejerce sin montar nada.
    ========================================================================== */

/** Una fila del cronograma en edición. `pinned` es estado de la pantalla, no del contrato. */
export interface PlanRow extends Installment {
  /** El monto se escribió a mano: el reparto automático no lo toca. */
  readonly pinned: boolean;
}

/** Lo que hace falta para armar el cronograma inicial. */
export interface PlanParameters {
  readonly total: number;
  readonly downPayment: number;
  readonly installmentCount: number;
  readonly frequency: PaymentFrequency;
  /** ISO `YYYY-MM-DD` de la primera cuota. */
  readonly firstDueDate: string;
}

/** Tope de cuotas: cinco años de cuotas semanales. Más que eso no es un plan, es un error de tipeo. */
export const MAX_INSTALLMENTS = 260;

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Suma `steps` períodos a una fecha `YYYY-MM-DD`.
 *
 * Al sumar meses se respeta el fin de mes: del 31 de enero, un mes después es
 * el 28 (o 29) de febrero y no el 3 de marzo, que es lo que haría `setMonth`.
 */
export function addPeriods(isoDate: string, frequency: PaymentFrequency, steps: number): string {
  const [anio, mes, dia] = isoDate.split('-').map(Number) as [number, number, number];
  if (frequency === 'MONTHLY') {
    const destino = new Date(anio, mes - 1 + steps, 1);
    const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
    destino.setDate(Math.min(dia, ultimoDia));
    return isoOf(destino);
  }
  const dias = frequency === 'WEEKLY' ? 7 : 14;
  return isoOf(new Date(anio, mes - 1, dia + dias * steps));
}

function isoOf(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Reparte `cents` en `parts` montos que suman exactamente `cents`. Los
 * centavos que sobran de la división van a las primeras cuotas, de a uno:
 * así ninguna cuota se aparta más de un centavo de las demás.
 */
export function splitCents(cents: number, parts: number): readonly number[] {
  if (parts <= 0) {
    return [];
  }
  const base = Math.floor(cents / parts);
  const resto = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < resto ? 1 : 0));
}

/** El cronograma inicial: el saldo después del anticipo, en partes iguales. */
export function buildSchedule(parameters: PlanParameters): readonly PlanRow[] {
  const cantidad = Math.min(Math.max(0, Math.trunc(parameters.installmentCount)), MAX_INSTALLMENTS);
  const saldo = Math.max(0, toCents(parameters.total) - toCents(parameters.downPayment));
  return splitCents(saldo, cantidad).map((centavos, i) => ({
    installmentNumber: i + 1,
    dueDate: addPeriods(parameters.firstDueDate, parameters.frequency, i),
    amount: fromCents(centavos),
    pinned: false,
  }));
}

/**
 * Reparte lo que falta entre las cuotas no fijadas. Las fijadas quedan como
 * están; si todas lo están, no se toca nada y la diferencia la muestra
 * {@link remainingCents}. Nunca deja un monto negativo: si lo fijado ya pasa
 * el saldo, las libres quedan en cero.
 */
export function rebalance(
  rows: readonly PlanRow[],
  total: number,
  downPayment: number,
): readonly PlanRow[] {
  const libres = rows.filter((fila) => !fila.pinned).length;
  if (libres === 0) {
    return renumber(rows);
  }
  const fijado = rows
    .filter((fila) => fila.pinned)
    .reduce((suma, fila) => suma + toCents(fila.amount), 0);
  const aRepartir = Math.max(0, toCents(total) - toCents(downPayment) - fijado);
  const partes = [...splitCents(aRepartir, libres)];
  return renumber(
    rows.map((fila) => (fila.pinned ? fila : { ...fila, amount: fromCents(partes.shift() ?? 0) })),
  );
}

/**
 * Cuánto le falta (positivo) o le sobra (negativo) al plan para cerrar con el
 * precio, en centavos. Cero es el único valor guardable.
 */
export function remainingCents(
  rows: readonly PlanRow[],
  total: number,
  downPayment: number,
): number {
  const cuotas = rows.reduce((suma, fila) => suma + toCents(fila.amount), 0);
  return toCents(total) - toCents(downPayment) - cuotas;
}

/** Numera de nuevo, en orden: sacar la cuota 2 de 4 deja 1, 2, 3 y no 1, 3, 4. */
export function renumber(rows: readonly PlanRow[]): readonly PlanRow[] {
  return rows.map((fila, i) => ({ ...fila, installmentNumber: i + 1 }));
}

/** El contrato no lleva `pinned`: es de la pantalla. */
export function toInstallments(rows: readonly PlanRow[]): readonly Installment[] {
  return rows.map(({ installmentNumber, dueDate, amount }) => ({
    installmentNumber,
    dueDate,
    amount,
  }));
}
