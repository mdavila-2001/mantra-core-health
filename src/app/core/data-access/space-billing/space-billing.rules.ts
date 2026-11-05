/* ============================================================================
    Reglas de devengo de F5e (`CONTRATO-F2-F5.md` §F5e, decisión D7). Puras:
    las usan la maqueta y las pruebas; en producción las aplica la API.
    ========================================================================== */

/** Un período de ocupación de cama (`encounter_locations`). */
export interface BedPeriod {
  readonly careSpaceId: string;
  /** Categoría vigente de la cama en el período (`care_space_category_periods`). */
  readonly bedCategoryCode: string;
  readonly start: string;
  /** `null` = sigue ocupada. */
  readonly end: string | null;
}

/** Un día-cama que corresponde cobrar. */
export interface BedDay {
  /** `yyyy-mm-dd` local: el día que termina en la medianoche contada. */
  readonly serviceDate: string;
  readonly careSpaceId: string;
  readonly bedCategoryCode: string;
}

const DAY_MS = 86_400_000;

const localDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * **Regla de medianoche**: un día-cama por cada medianoche local M tal que
 * `inicio ≤ M < fin` en algún período; fecha de servicio = fecha(M) − 1;
 * categoría = la de la cama ocupada en M. El día del egreso no se cobra.
 * Estancia sin ninguna medianoche → un día si `minOneDay` (por defecto).
 *
 * @param until - Hasta dónde contar si la estancia sigue abierta (ahora).
 */
export function bedDays(periods: readonly BedPeriod[], until: Date, minOneDay = true): readonly BedDay[] {
  if (periods.length === 0) return [];
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  const first = new Date(sorted[0]!.start);
  const lastEnd = sorted.reduce((max, p) => Math.max(max, p.end === null ? until.getTime() : Date.parse(p.end)), 0);
  const days: BedDay[] = [];
  const midnight = new Date(first);
  midnight.setHours(0, 0, 0, 0);
  midnight.setDate(midnight.getDate() + 1);
  for (; midnight.getTime() < lastEnd; midnight.setDate(midnight.getDate() + 1)) {
    const m = midnight.getTime();
    const occupied = sorted.find((p) => Date.parse(p.start) <= m && m < (p.end === null ? until.getTime() : Date.parse(p.end)));
    if (occupied === undefined) continue;
    const service = new Date(m - DAY_MS / 2);
    days.push({ serviceDate: localDay(service), careSpaceId: occupied.careSpaceId, bedCategoryCode: occupied.bedCategoryCode });
  }
  if (days.length === 0 && minOneDay) {
    return [{ serviceDate: localDay(first), careSpaceId: sorted[0]!.careSpaceId, bedCategoryCode: sorted[0]!.bedCategoryCode }];
  }
  return days;
}

/** Clave de idempotencia del día-cama: un cargo por encuentro y fecha (INV-42). */
export function bedDayKey(encounterId: string, serviceDate: string): string {
  return `BEDDAY:${encounterId}:${serviceDate}`;
}

/** Unidades de quirófano: `max(mínimo, ⌈minutos ÷ unidad⌉)`. */
export function orTimeUnits(minutes: number, unitMinutes: number, minimumUnits = 0): number {
  if (unitMinutes <= 0) throw new RangeError('unitMinutes debe ser mayor que cero');
  return Math.max(minimumUnits, Math.ceil(minutes / unitMinutes));
}

/** ¿La vigencia `[from, to)` contiene el día? */
export function validOn(day: string, from: string, to: string | null): boolean {
  return from <= day && (to === null || day < to);
}

/** ¿Se solapan dos vigencias `[from, to)`? (`ex_space_tariffs_validity`). */
export function validityOverlaps(aFrom: string, aTo: string | null, bFrom: string, bTo: string | null): boolean {
  return (bTo === null || aFrom < bTo) && (aTo === null || bFrom < aTo);
}

/** Importe con 2 decimales a partir de texto decimal, sin pasar por coma flotante en la suma. */
export function amountOf(quantity: string, unitPrice: string | null): string | null {
  if (unitPrice === null) return null;
  const cents = Math.round(Number(quantity) * Number(unitPrice) * 100);
  return (cents / 100).toFixed(2);
}
