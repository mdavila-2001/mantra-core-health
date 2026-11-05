import type { Provider } from '@angular/core';
import { BarChart, CandlestickChart, FunnelChart, GaugeChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  // `construirOpciones` usa `baseOption` + `media` (lienzo angosto): ECharts exige el componente de línea de tiempo.
  TimelineComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echartsCore from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { provideEchartsCore } from 'ngx-echarts';

/**
 * Apache ECharts por módulos (ADR-0017): solo los gráficos y componentes que el
 * portal usa, y el renderizador SVG (texto nítido, elementos inspeccionables).
 * Se registra una sola vez, al primer uso, aunque haya veinte gráficos en pantalla.
 */
let registrado = false;

export function registrarEcharts(): typeof echartsCore {
  if (!registrado) {
    echartsCore.use([
      BarChart,
      LineChart,
      PieChart,
      FunnelChart,
      HeatmapChart,
      GaugeChart,
      CandlestickChart,
      AriaComponent,
      DataZoomComponent,
      GridComponent,
      LegendComponent,
      MarkLineComponent,
      TimelineComponent,
      TooltipComponent,
      VisualMapComponent,
      SVGRenderer,
    ]);
    registrado = true;
  }
  return echartsCore;
}

/** Proveedor para `app.config`/rutas de reportería. */
export function provideGraficos(): Provider {
  return provideEchartsCore({ echarts: registrarEcharts() });
}
