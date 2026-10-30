import type { HealthStatus, MetricUnit } from './insights.types';

/* ============================================================================
    Formato de cifras. Una sola fuente: así el mismo número se lee igual en una
    tarjeta, en un tooltip, en una tabla y en un informe.
    ========================================================================== */

const LOCALE = 'es-BO';

const int = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct1 = new Intl.NumberFormat(LOCALE, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct0 = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 });

export function formatInt(value: number): string {
  return int.format(value);
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${dec1.format(value / 1_000_000)} M`;
  if (abs >= 10_000) return `${int.format(value / 1000)} mil`;
  if (abs >= 1000) return `${dec1.format(value / 1000)} mil`;
  return int.format(value);
}

/** Importe en bolivianos a partir de centavos. */
export function formatMoney(cents: number, compact = false): string {
  const bs = cents / 100;
  if (compact && Math.abs(bs) >= 10_000) return `Bs ${formatCompact(bs)}`;
  return `Bs ${Math.abs(bs) >= 1000 ? int.format(bs) : dec2.format(bs)}`;
}

export function formatPercent(fraction: number, digits: 0 | 1 = 1): string {
  return (digits === 0 ? pct0 : pct1).format(fraction);
}

/** Variación relativa con signo: +18,4 %. */
export function formatChange(fraction: number): string {
  const text = pct1.format(Math.abs(fraction));
  if (Math.abs(fraction) < 0.0005) return '0,0 %';
  return `${fraction > 0 ? '+' : '−'}${text}`;
}

export function formatValue(value: number | null, unit: MetricUnit, compact = false): string {
  if (value === null) return 'Sin dato';
  switch (unit) {
    case 'count':
      return compact ? formatCompact(value) : int.format(value);
    case 'percent':
      return pct1.format(value);
    case 'money':
      return formatMoney(value, compact);
    case 'ratio':
      return `${dec2.format(value)}×`;
    case 'times':
      return `${dec2.format(value)}×`;
    case 'seconds':
      return `${dec1.format(value)} s`;
  }
}

/** Etiqueta corta de un eje (sin unidad redundante). */
export function formatAxis(value: number, unit: MetricUnit): string {
  switch (unit) {
    case 'percent':
      return pct1.format(value);
    case 'money':
      return formatCompact(value / 100);
    case 'ratio':
    case 'times':
      return dec1.format(value);
    case 'seconds':
      return `${dec1.format(value)} s`;
    default:
      return formatCompact(value);
  }
}

export const STATUS_ICON: Readonly<Record<HealthStatus, string>> = {
  optimal: '●',
  acceptable: '◆',
  alert: '▲',
  critical: '■',
  insufficient: '○',
};

/** Texto accesible de un cambio relativo: «sube 18,4 % respecto al periodo anterior». */
export function describeChange(fraction: number | null, versus: string): string {
  if (fraction === null) return `Sin ${versus} comparable`;
  if (Math.abs(fraction) < 0.0005) return `Sin cambio frente a ${versus}`;
  return `${fraction > 0 ? 'Sube' : 'Baja'} ${pct1.format(Math.abs(fraction))} frente a ${versus}`;
}
