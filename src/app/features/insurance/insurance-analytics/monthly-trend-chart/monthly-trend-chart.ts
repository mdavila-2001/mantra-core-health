import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { InsuranceConcept } from '../../../../core/data-access/insurance/insurance.types';
import type { MonthlyTrend } from '../../../../core/data-access/insurance/insurance-analytics.types';
import { formatKpiAmount } from '../../money-format';

/** Ancho lógico del `viewBox` reservado a cada mes (dos barras + separación). */
const MONTH_WIDTH = 56;
/** Alto lógico disponible para las barras (el resto es el eje y las etiquetas). */
const CHART_HEIGHT = 140;
const LABEL_HEIGHT = 24;

interface BarGroup {
  readonly period: string;
  readonly monthLabel: string;
  readonly x: number;
  readonly billedHeight: number;
  readonly approvedHeight: number;
  readonly billedAmount: string;
  readonly approvedAmount: string;
  readonly claimsCount: number;
  /** Lo que anuncia el lector al parar en la barra de facturado. */
  readonly billedAriaLabel: string;
  /** Ídem, para la de aprobado. */
  readonly approvedAriaLabel: string;
}

const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/**
 * Barras agrupadas facturado vs. aprobado, un mes por par (subtarea 3.1).
 *
 * SVG calculado a mano: el repo no tiene ninguna librería de gráficos ni
 * componente de visualización de datos (verificado — sin `chart.js`/`d3`/etc.
 * en `package.json`, sin ningún `<svg>` que dibuje una serie en todo
 * `src/app`), así que no hay nada que reutilizar. Las alturas son las ÚNICAS
 * cifras que pasan por `Number()`: es geometría de layout, no un total que se
 * vuelve a calcular — los importes que se MUESTRAN (leyenda, tabla oculta)
 * siguen viniendo tal cual los devolvió la API, vía {@link formatKpiAmount}.
 *
 * Accesible por tres caminos independientes, y ninguno depende de interpretar
 * geometría:
 *
 * 1. el `<svg>` es un `role="group"` rotulado con el resumen del periodo;
 * 2. **cada barra es una parada de teclado** (`tabindex="0"`) que dice su mes y
 *    su cifra al recibir el foco;
 * 3. una tabla `.sr-only` con el dato exacto de cada mes.
 *
 * El grupo no puede ser `role="img"`: una imagen es un nodo hoja para el árbol
 * de accesibilidad y su contenido no se expone, así que las etiquetas de las
 * barras no se anunciarían. La tabla oculta sobrevive al punto 2 a propósito —
 * con doce meses son veinticuatro tabuladores, y quien sólo quiere la cifra
 * merece un atajo.
 */
@Component({
  selector: 'app-monthly-trend-chart',
  imports: [],
  templateUrl: './monthly-trend-chart.html',
  styleUrl: './monthly-trend-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlyTrendChart {
  readonly trends = input.required<readonly MonthlyTrend[]>();
  readonly currency = input<InsuranceConcept | null>(null);

  protected readonly chartHeight = CHART_HEIGHT;
  protected readonly labelHeight = LABEL_HEIGHT;

  protected readonly viewBoxWidth = computed(
    () => Math.max(this.trends().length, 1) * MONTH_WIDTH,
  );

  private readonly maxValue = computed(() => {
    const valores = this.trends().flatMap((mes) => [
      Number(mes.billedAmount),
      Number(mes.approvedAmount),
    ]);
    const max = Math.max(0, ...valores.filter((n) => Number.isFinite(n)));
    return max > 0 ? max : 1;
  });

  protected readonly bars = computed<readonly BarGroup[]>(() =>
    this.trends().map((mes, indice) => {
      const billed = Number(mes.billedAmount);
      const approved = Number(mes.approvedAmount);
      return {
        period: mes.period,
        monthLabel: etiquetaDeMes(mes.period),
        x: indice * MONTH_WIDTH,
        billedHeight: alturaProporcional(billed, this.maxValue()),
        approvedHeight: alturaProporcional(approved, this.maxValue()),
        billedAmount: mes.billedAmount,
        approvedAmount: mes.approvedAmount,
        claimsCount: mes.claimsCount,
        billedAriaLabel:
          `${etiquetaDeMes(mes.period)}, facturado ${this.formatear(mes.billedAmount)}, ` +
          `${mes.claimsCount} reclamo${mes.claimsCount === 1 ? '' : 's'}.`,
        approvedAriaLabel:
          `${etiquetaDeMes(mes.period)}, aprobado ${this.formatear(mes.approvedAmount)}.`,
      };
    }),
  );

  protected readonly resumenAccesible = computed(() => {
    const meses = this.trends();
    if (meses.length === 0) return 'Tendencia mensual sin datos en el periodo.';
    const pico = meses.reduce((mayor, actual) =>
      Number(actual.billedAmount) > Number(mayor.billedAmount) ? actual : mayor,
    );
    return (
      `Tendencia mensual de ${meses.length} mes${meses.length === 1 ? '' : 'es'}, ` +
      `de ${etiquetaDeMes(meses[0]!.period)} a ${etiquetaDeMes(meses[meses.length - 1]!.period)}. ` +
      `El mayor facturado fue ${this.formatear(pico.billedAmount)} en ${etiquetaDeMes(pico.period)}.`
    );
  });

  protected formatear(amount: string): string {
    return formatKpiAmount(amount, this.currency());
  }
}

function alturaProporcional(valor: number, max: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return Math.max(1, (valor / max) * CHART_HEIGHT);
}

/** `'2026-01'` → `'ene 26'`. Sin `Date`: el string ya trae año y mes, parsearlo con `Date` arriesga huso horario. */
function etiquetaDeMes(period: string): string {
  const [anio, mes] = period.split('-');
  const indice = Number(mes) - 1;
  const nombre = MESES[indice] ?? mes;
  return `${nombre} ${(anio ?? '').slice(2)}`;
}
