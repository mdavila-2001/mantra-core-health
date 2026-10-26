/**
 * La antigüedad de las existencias de una sucursal (REQ-19-011): cuándo se
 * actualizó por última vez lo que la sede dice tener. Pasado el umbral, la
 * pantalla deja de presentarlo como certeza (REQ-19-009) y le pide a la
 * persona que confirme antes de ir. Puro y sin estado: el reloj llega de afuera.
 */

/**
 * Pasadas estas horas, la existencia informada ya no se presenta como certeza.
 *
 * Un día: el stock de una farmacia se mueve con cada venta del día, y lo que
 * se informó ayer ya no garantiza lo de hoy. Ir hasta una sede por algo que
 * ya no está le cuesta un viaje a quien menos puede perderlo.
 */
export const STALE_STOCK_AFTER_HOURS = 24;

const MS_PER_HOUR = 3_600_000;
const HOURS_PER_DAY = 24;

/** Desde acá la cuenta en días ya no le dice nada útil a la persona. */
const DAYS_BEFORE_MONTH_LABEL = 30;

/**
 * El aviso para la persona si las existencias de la sede son más viejas que
 * {@link STALE_STOCK_AFTER_HOURS}; `null` si están al día, si no traen fecha
 * o si la fecha no se puede leer. Sin fecha se conserva lo de siempre: no se
 * inventa una antigüedad. Una fecha en el futuro (relojes desfasados) cuenta
 * como al día.
 */
export function staleStockNoticeOf(stockUpdatedAt: string | null | undefined, now: Date): string | null {
  if (stockUpdatedAt === null || stockUpdatedAt === undefined) {
    return null;
  }
  const updatedAt = Date.parse(stockUpdatedAt);
  if (Number.isNaN(updatedAt)) {
    return null;
  }
  const ageHours = (now.getTime() - updatedAt) / MS_PER_HOUR;
  if (ageHours < STALE_STOCK_AFTER_HOURS) {
    return null;
  }
  return `Existencias informadas ${ageLabel(ageHours)}; confirme con la farmacia antes de ir.`;
}

/** «hace 1 día», «hace 3 días», «hace más de un mes». */
function ageLabel(ageHours: number): string {
  const days = Math.floor(ageHours / HOURS_PER_DAY);
  if (days >= DAYS_BEFORE_MONTH_LABEL) {
    return 'hace más de un mes';
  }
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
