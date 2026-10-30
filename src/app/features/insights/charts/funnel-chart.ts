import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { formatChange, formatInt, formatPercent } from '../domain/format';

export interface FunnelStage {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  /** Etapa de la que se parte la conversión (para el tooltip: numerador y denominador). */
  readonly fromLabel?: string;
  /** Conversión frente al benchmark de la etapa (fracción) para marcar brechas. */
  readonly benchmarkRate?: number | null;
  /** Variación de la conversión de la etapa frente al periodo anterior. */
  readonly changeVsPrevious?: number | null;
  readonly note?: string;
}

interface Row {
  readonly stage: FunnelStage;
  readonly widthPct: number;
  readonly stepRate: number | null;
  readonly dropped: number | null;
  readonly gapVsBenchmark: number | null;
  readonly worst: boolean;
  readonly text: string;
}

/**
 * Pregunta que responde: «¿dónde estamos perdiendo usuarios?».
 *
 * La primera etapa (impresiones) es de otra magnitud que las demás: dibujarla a
 * escala aplastaría el resto del embudo, así que se muestra como cabecera y el
 * embudo propiamente dicho arranca en el primer clic. La «mayor pérdida» no es
 * la caída más grande en bruto (siempre sería impresión → clic, que es normal)
 * sino la etapa más lejos de su benchmark.
 */
@Component({
  selector: 'app-ins-funnel-chart',
  templateUrl: './funnel-chart.html',
  styleUrl: './funnel-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ins-chart' },
})
export class FunnelChart {
  readonly stages = input.required<readonly FunnelStage[]>();
  readonly ariaLabel = input.required<string>();
  readonly selectedId = input<string | null>(null);
  readonly picked = output<string>();

  protected readonly head = computed(() => this.stages()[0] ?? null);
  protected readonly body = computed(() => this.stages().slice(1));

  protected readonly rows = computed<readonly Row[]>(() => {
    const stages = this.stages();
    const body = this.body();
    const top = body[0]?.value ?? 0;
    const gaps = body.map((s, i) => {
      const prev = i === 0 ? stages[0] : body[i - 1];
      const rate = prev && prev.value > 0 ? s.value / prev.value : null;
      return s.benchmarkRate && rate !== null ? (rate - s.benchmarkRate) / s.benchmarkRate : null;
    });
    const worstIndex = gaps.reduce<number>((worst, g, i) => (g !== null && (worst < 0 || g < (gaps[worst] ?? 0)) ? i : worst), -1);
    return body.map((s, i) => {
      const prev = i === 0 ? stages[0] : body[i - 1];
      const rate = prev && prev.value > 0 ? s.value / prev.value : null;
      return {
        stage: s,
        widthPct: top > 0 ? Math.max(2, (s.value / top) * 100) : 0,
        stepRate: rate,
        dropped: prev ? prev.value - s.value : null,
        gapVsBenchmark: gaps[i] ?? null,
        worst: i === worstIndex && (gaps[i] ?? 0) < -0.05,
        text: rate === null || !prev ? '' : `${formatInt(s.value)} de ${formatInt(prev.value)} (${s.fromLabel ?? prev.label})`,
      };
    });
  });

  protected int(n: number): string {
    return formatInt(n);
  }
  protected pct(n: number): string {
    return formatPercent(n);
  }
  protected change(n: number): string {
    return formatChange(n);
  }
}
