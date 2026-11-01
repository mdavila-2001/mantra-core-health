/* ============================================================================
    Formato compartido por las pantallas de quirófano (F4). Horas en la zona del
    navegador, que es la del establecimiento en el uso real de la sala.
    ========================================================================== */

const LOCALE = 'es-BO';

/** `08:40`. */
export function timeOf(value: string | Date | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return new Date(value).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** `lun 02/11`. */
export function shortDateOf(value: string | Date | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return new Date(value).toLocaleDateString(LOCALE, { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/** `02/11/2026 08:40`. */
export function dateTimeOf(value: string | Date | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const d = new Date(value);
  return `${d.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${timeOf(d)}`;
}

/** `1 h 35 min`, `45 min`. */
export function durationOf(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** `75,5 %` o guion cuando no hay denominador. */
export function percentOf(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} %`;
}

/** `yyyy-mm-dd` del día local. */
export function localDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Inicio y fin (ISO) del día local `yyyy-mm-dd`. */
export function dayBounds(day: string): { readonly from: string; readonly to: string } {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Un `yyyy-mm-dd` desplazado `days` días. */
export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDay(d);
}

/** `yyyy-mm-dd` + `HH:mm` locales → ISO. */
export function toIso(day: string, time: string): string {
  return new Date(`${day}T${time}:00`).toISOString();
}

/** Antigüedad legible de un dato, para S7. */
export function ageOf(asOf: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(asOf)) / 60_000));
  return minutes < 1 ? 'hace menos de un minuto' : minutes === 1 ? 'hace 1 minuto' : `hace ${minutes} minutos`;
}
