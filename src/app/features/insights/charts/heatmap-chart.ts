import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { formatValue } from '../domain/format';
import type { MetricUnit } from '../domain/insights.types';
import { heatLevel } from './chart-math';

export interface HeatCell {
  readonly value: number | null;
  /** Texto del tooltip. */
  readonly note?: string;
}

/**
 * Pregunta que responde: «¿dónde se concentra el comportamiento?».
 *
 * Cruza dos dimensiones (día × hora, cohorte × semana, función × hora) con la
 * intensidad de una medida. La escala usa los 4 pasos `--heat-*` del sistema,
 * que cumplen contraste AA en claro y oscuro; cada celda además trae su cifra
 * cuando el ancho lo permite, así que la intensidad nunca es la única señal.
 * Una celda sin dato suficiente se rotula y se raya: no se pinta como la más baja.
 */
@Component({
  selector: 'ins-heatmap-chart',
  templateUrl: './heatmap-chart.html',
  styleUrl: './heatmap-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ins-chart' },
})
export class HeatmapChart {
  readonly rows = input.required<readonly string[]>();
  readonly cols = input.required<readonly string[]>();
  readonly cells = input.required<readonly (readonly HeatCell[])[]>();
  readonly unit = input.required<MetricUnit>();
  readonly rowMeta = input<readonly string[] | null>(null);
  readonly rowMetaLabel = input('');
  readonly valueName = input('Valor');
  readonly ariaLabel = input.required<string>();
  /** Cuántas columnas muestran su cifra; 0 = nunca. */
  readonly showValues = input(true);
  /** Etiqueta cada N columnas (24 horas no caben todas en móvil). */
  readonly colLabelEvery = input(1);
  readonly minCell = input(44);
  /** Celda destacada [fila, columna], p. ej. la mejor franja. */
  readonly best = input<readonly [number, number] | null>(null);

  readonly picked = output<{ row: number; col: number }>();
  protected readonly hover = signal<string | null>(null);

  protected readonly range = computed(() => {
    const values = this.cells().flatMap((r) => r.map((c) => c.value)).filter((v): v is number => v !== null);
    return values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: 0, max: 0 };
  });

  protected readonly gridTemplate = computed(
    () => `${this.rowMeta() ? 'minmax(72px, auto) auto' : 'minmax(72px, auto)'} repeat(${this.cols().length}, minmax(${this.minCell()}px, 1fr))`,
  );

  protected level(value: number | null): number {
    return value === null ? 0 : heatLevel(value, this.range().min, this.range().max);
  }

  protected text(cell: HeatCell): string {
    return cell.value === null ? '—' : formatValue(cell.value, this.unit(), true);
  }

  protected tip(r: number, c: number, cell: HeatCell): string {
    const head = `${this.rows()[r]} · ${this.cols()[c]}`;
    if (cell.value === null) return `${head}: sin dato suficiente. ${cell.note ?? ''}`.trim();
    return `${head}: ${formatValue(cell.value, this.unit())}${cell.note ? ` · ${cell.note}` : ''}`;
  }

  protected isBest(r: number, c: number): boolean {
    const b = this.best();
    return !!b && b[0] === r && b[1] === c;
  }

  protected pick(row: number, col: number): void {
    this.picked.emit({ row, col });
  }

  protected readonly legendSteps = [1, 2, 3, 4] as const;
}
