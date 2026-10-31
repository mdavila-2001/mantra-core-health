import type { DailyFact } from './insights.types';

/* ============================================================================
    Los hechos diarios que consume el dominio. Los trae la API
    (`GET /marketing/insights/campaign-facts`) y el shell los instala una vez
    cargados; hasta entonces no hay ninguno, a propósito: nada se inventa.
    ========================================================================== */

let facts: readonly DailyFact[] = [];

/** Instala los hechos cargados, ordenados por fecha, campaña y canal. */
export function installFacts(rows: readonly DailyFact[]): void {
  facts = [...rows].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.campaignId.localeCompare(b.campaignId) ||
      a.channel.localeCompare(b.channel),
  );
}

/** Todos los hechos diarios instalados. */
export function allFacts(): readonly DailyFact[] {
  return facts;
}
