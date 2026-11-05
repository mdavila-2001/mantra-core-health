import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type {
  DiagnosticStudy,
  DiagnosticUnitDetail,
} from '../../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import { durationText, isOperational, isPublishedPrice, priceSource, priceText } from '../study-format';

/** One headline figure of the centre. */
interface SummaryStat {
  readonly label: string;
  readonly value: string;
  readonly icon: NavIconName;
  /** Small print under the value: where the figure comes from. */
  readonly note?: string;
}

/**
 * The top of a diagnostic unit sheet: what the centre offers at a glance.
 *
 * It answers the questions that decide whether to go there — how much, how
 * soon, how many studies, where — before anyone opens a tab. Every figure is
 * derived from the published catalogue; nothing is shown that the API did
 * not send, and a figure with no data is left out rather than drawn as zero.
 */
@Component({
  selector: 'app-lab-unit-summary',
  imports: [NavIcon],
  templateUrl: './unit-summary.html',
  styleUrl: './unit-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabUnitSummary {
  readonly unit = input.required<DiagnosticUnitDetail>();
  readonly icon = input<NavIconName>('flask');

  /** Things the centre does; only the ones it does, never a list of "no". */
  protected readonly services = computed(() => {
    const unit = this.unit();
    const services: string[] = [];
    if (unit.walkInAvailable) services.push('Atención sin cita');
    if (unit.homeCollectionAvailable) services.push('Toma de muestras a domicilio');
    if (unit.acceptsExternalOrders) services.push('Recibe órdenes externas');
    return services;
  });

  protected readonly stats = computed<readonly SummaryStat[]>(() => {
    const unit = this.unit();
    // Study and site counts already sit on their tabs; repeating them here
    // was the same number four times on one screen.
    const stats: SummaryStat[] = [];

    const cheapest = cheapestStudy(unit.studies);
    const cheapestPrice = cheapest === null ? null : priceText(cheapest);
    if (cheapest !== null && cheapestPrice !== null) {
      // «Desde» alone reads as what the centre charges; a reference tariff says so.
      const label = isPublishedPrice(cheapest) ? 'Desde' : 'Referencia desde';
      stats.push({ label, value: cheapestPrice, icon: 'wallet', note: priceSource(cheapest) });
    }

    const fastest = fastestTurnaround(unit.studies);
    if (fastest !== null) {
      stats.push({ label: 'Resultados desde', value: fastest, icon: 'clock', note: 'Según el estudio' });
    }

    if (unit.equipment.length > 0) {
      const working = unit.equipment.filter((item) => isOperational(item.operationalStatus.code)).length;
      stats.push({
        label: 'Equipos operativos',
        value: `${working} de ${unit.equipment.length}`,
        icon: 'scan',
      });
    }

    if (unit.accreditations.length > 0) {
      stats.push({
        label: 'Acreditaciones',
        value: String(unit.accreditations.length),
        icon: 'shield',
        note: unit.accreditations.map((item) => item.type.display).join('\u00a0· '), // keep «·» off the start of a line
      });
    }
    return stats;
  });
}

/**
 * The study with the lowest valid amount, or `null` when none has one. Only
 * amounts in the catalogue's most used currency compete: 10 USD is not under 50 Bs.
 */
function cheapestStudy(studies: readonly DiagnosticStudy[]): DiagnosticStudy | null {
  const priced = studies.flatMap((study) => {
    const price = study.prices[0];
    const amount = Number.parseFloat(price?.amount ?? '');
    return price && Number.isFinite(amount) && amount > 0 ? [{ study, amount, currency: price.currency.code }] : [];
  });
  const uses = new Map<string, number>();
  for (const { currency } of priced) uses.set(currency, (uses.get(currency) ?? 0) + 1);
  const main = [...uses].sort((a, b) => b[1] - a[1])[0]?.[0];
  const best = priced.filter((item) => item.currency === main).sort((a, b) => a.amount - b.amount)[0];
  return best?.study ?? null;
}

/** The shortest declared turnaround across the catalogue, already formatted. */
function fastestTurnaround(studies: readonly DiagnosticStudy[]): string | null {
  const minutes = studies
    .map((study) => study.expectedTurnaroundMinutes)
    .filter((value): value is number => value !== null && value > 0);
  return minutes.length === 0 ? null : durationText(Math.min(...minutes));
}
