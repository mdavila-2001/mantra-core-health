import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import {
  describeDelta,
  formatMoney,
  formatWholeMoney,
  type Comparison,
  type MonthPoint,
} from '../spending.model';

/** Cuántas líneas de referencia lleva el eje (sin contar el cero). */
const TICKS = 4;

interface MonthColumn {
  readonly point: MonthPoint;
  readonly previousHeight: number;
  /** `null` para los meses que todavía no llegaron: no se dibuja barra. */
  readonly currentHeight: number | null;
  readonly ariaLabel: string;
}

interface Tick {
  readonly bottom: number;
  readonly label: string;
}

/**
 * Tope «redondo» del eje: el menor 1-2-2,5-5 × 10ⁿ que cubre el máximo, para
 * que las marcas caigan en cifras que se leen (0 · 500 · 1.000…).
 */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value)!;
  return step * magnitude;
}

/**
 * Columnas agrupadas, mes a mes: este año contra el pasado.
 *
 * Forma de «énfasis» y no categórica: el año en curso lleva el color de marca
 * y el pasado un paso claro de la misma rampa, porque la historia es «cómo
 * vengo este año», no dos series con el mismo peso. Una sola escala: los dos
 * años se miden en bolivianos.
 *
 * Columnas de HTML y no un `<svg>` escalado: el gráfico se estira con la
 * tarjeta, y en un `viewBox` estirado los rótulos se achican con el ancho y las
 * esquinas redondeadas se deforman. Acá cada columna es un `div` con su altura
 * en porcentaje y el texto queda al tamaño del sistema.
 *
 * Tres caminos al dato, ninguno sólo visual: cada mes es una parada de teclado
 * que anuncia sus dos cifras y la variación; al pasar el puntero o el foco se
 * abre el globo con lo mismo; y una tabla `.sr-only` lo tiene todo junto.
 */
@Component({
  selector: 'app-spending-year-chart',
  imports: [],
  templateUrl: './spending-year-chart.html',
  styleUrl: './spending-year-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpendingYearChart {
  readonly months = input.required<readonly MonthPoint[]>();
  readonly currentYear = input.required<number>();
  readonly previousYear = input.required<number>();
  readonly currencyLabel = input.required<string>();

  /** El mes bajo el puntero o con el foco; `null` sin globo. */
  protected readonly activeIndex = signal<number | null>(null);

  private readonly ceiling = computed(() =>
    niceCeiling(
      Math.max(
        0,
        ...this.months().flatMap((m) => [m.previousCents, m.currentCents ?? 0]),
      ),
    ),
  );

  protected readonly ticks = computed<readonly Tick[]>(() =>
    Array.from({ length: TICKS + 1 }, (_, i) => {
      const cents = (this.ceiling() / TICKS) * i;
      return { bottom: (i / TICKS) * 100, label: formatWholeMoney(cents, '').trim() };
    }),
  );

  protected readonly columns = computed<readonly MonthColumn[]>(() =>
    this.months().map((point) => ({
      point,
      previousHeight: (point.previousCents / this.ceiling()) * 100,
      currentHeight:
        point.currentCents === null ? null : (point.currentCents / this.ceiling()) * 100,
      ariaLabel: this.describe(point),
    })),
  );

  protected readonly active = computed(() => {
    const index = this.activeIndex();
    return index === null ? null : (this.columns()[index] ?? null);
  });

  /** Dónde se ancla el globo: el centro del mes, en porcentaje del ancho. */
  protected readonly tooltipLeft = computed(() => {
    const index = this.activeIndex();
    const count = this.columns().length;
    return index === null || count === 0 ? 0 : ((index + 0.5) / count) * 100;
  });

  protected money(cents: number): string {
    return formatMoney(cents, this.currencyLabel());
  }

  protected delta(point: MonthPoint): string | null {
    if (point.currentCents === null) return null;
    return describeDelta(this.comparisonOf(point), `${point.label} de ${this.previousYear()}`);
  }

  protected show(index: number): void {
    this.activeIndex.set(index);
  }

  protected hide(index: number): void {
    if (this.activeIndex() === index) this.activeIndex.set(null);
  }

  private comparisonOf(point: MonthPoint): Comparison {
    const cents = point.currentCents ?? 0;
    return {
      cents,
      previousCents: point.previousCents,
      ratio:
        point.previousCents === 0 ? null : (cents - point.previousCents) / point.previousCents,
    };
  }

  private describe(point: MonthPoint): string {
    const previous = `${this.previousYear()}: ${this.money(point.previousCents)}`;
    if (point.currentCents === null) {
      return `${point.label}. ${previous}. ${this.currentYear()}: todavía no llegó.`;
    }
    return (
      `${point.label}. ${this.currentYear()}: ${this.money(point.currentCents)}. ` +
      `${previous}. ${this.delta(point)}.`
    );
  }
}
