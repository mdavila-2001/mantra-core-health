import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { InfoCalculo } from '@core/data-access/reporting/reporting.types';

/**
 * La ficha «Cómo se calcula» de un número: definición, fórmula, numerador,
 * denominador, fuente, frescura y salvedades. La usan las tarjetas KPI y las
 * tablas de detalle; los gráficos tienen la suya dentro de `ChartPanel` con el
 * mismo contenido y el mismo orden, para que el lector aprenda una sola ficha.
 */
@Component({
  selector: 'app-calc-info',
  templateUrl: './calc-info.html',
  styleUrl: './calc-info.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalcInfo {
  readonly info = input.required<InfoCalculo>();
  /** Nombre accesible de la región: «Cómo se calcula MRR». */
  readonly label = input.required<string>();
}
