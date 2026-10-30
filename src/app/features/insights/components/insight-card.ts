import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { INSIGHTS_BASE, MODULE_BY_ID } from '../insights-nav';
import { CONFIDENCE_LABELS, EVIDENCE_LABELS, type Insight } from '../domain/insights.types';
import { formatInt } from '../domain/format';

/**
 * Hallazgo de la capa de interpretación.
 *
 * Separa visiblemente cuatro niveles —dato observado, interpretación, hipótesis
 * y conclusión confirmada— para que una suposición no se lea como un hecho. Cada
 * hallazgo declara su confianza y sus factores, y se puede auditar: «¿de dónde
 * salió esta conclusión?» abre fuentes, periodo y método.
 */
@Component({
  selector: 'app-ins-insight',
  imports: [RouterLink],
  templateUrl: './insight-card.html',
  styleUrl: './insight-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightCard {
  readonly insight = input.required<Insight>();
  protected readonly open = signal(false);
  protected readonly evidenceLabels = EVIDENCE_LABELS;
  protected readonly confidenceLabels = CONFIDENCE_LABELS;
  protected readonly int = formatInt;

  protected target(): { link: string[]; query: Record<string, string>; module: string } {
    const a = this.insight().action;
    const m = MODULE_BY_ID.get(a.module);
    return { link: [INSIGHTS_BASE, m?.path ?? 'campaigns'], query: { ...(a.query ?? {}) }, module: m?.short ?? '' };
  }
}
