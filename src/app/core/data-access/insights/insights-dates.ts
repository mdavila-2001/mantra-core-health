/* ============================================================================
    Fechas del dominio: siempre cadenas `YYYY-MM-DD` en UTC. Sin zonas horarias
    ni `Date` local: dos máquinas en husos distintos deben ver el mismo día.
    ========================================================================== */

const DAY_MS = 86_400_000;

export function parseDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

export function addDays(iso: string, days: number): string {
  return formatDate(parseDate(iso) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to) - parseDate(from)) / DAY_MS);
}

/** Lista inclusiva de días entre dos fechas. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let ms = parseDate(from); ms <= parseDate(to); ms += DAY_MS) out.push(formatDate(ms));
  return out;
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(iso: string): number {
  return (new Date(parseDate(iso)).getUTCDay() + 6) % 7;
}
