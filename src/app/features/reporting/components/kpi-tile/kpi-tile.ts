import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';

import { formatearValor } from '@core/data-access/reporting/reporting-format';
import type { EstadoKpi, KpiSpec, UnidadValor } from '@core/data-access/reporting/reporting.types';
import { nextControlId } from '@shared/forms/form-control.context';
import { AppButton } from '@shared/components/atoms/button/button';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { provideGraficos } from '@shared/components/organisms/chart-panel';
import { CalcInfo } from '../calc-info/calc-info';
import { ChartThemeService } from '../chart-theme.service';
import { readDelta, type DeltaDirection } from './kpi-delta';
import { buildSparkline, describeTrend, hasTrend } from './sparkline';

const ARROWS: Readonly<Record<DeltaDirection, string>> = { up: '▲', down: '▼', flat: '■', none: '' };

/** El veredicto de un indicador se dice con icono Y palabra; el color sólo refuerza. */
const ESTADOS: Readonly<Record<EstadoKpi, { readonly glifo: string; readonly palabra: string; readonly token: 'success' | 'warning' | 'error' }>> = {
  bueno: { glifo: '✔', palabra: 'Bien', token: 'success' },
  aviso: { glifo: '▲', palabra: 'Atención', token: 'warning' },
  serio: { glifo: '◆', palabra: 'Serio', token: 'error' },
  critico: { glifo: '✖', palabra: 'Crítico', token: 'error' },
};

/** Cuando el servidor no explica la ausencia, la tarjeta lo dice con honestidad en vez de callar. */
const DEFAULT_NO_DATA_REASON = 'Aún no hay datos para este periodo.';

/**
 * Tarjeta de un indicador (KPI) del portal de reportería.
 *
 * Lo que la distingue de «un número grande»:
 * - **`null` no es `0`.** Sin dato dice «Sin dato» y el motivo; nunca dibuja un cero.
 * - **La variación se dice con flecha, número Y palabra** («mejora» / «empeora»);
 *   el color solo refuerza. Si subir es malo (churn, mora) el veredicto se invierte.
 * - **Las tasas muestran de dónde salen** («12 de 340»): 80 % sobre diez casos y
 *   80 % sobre diez mil no son la misma noticia.
 * - La mini-tendencia tiene tooltip y una frase para lector de pantalla.
 * - «Cómo se calcula» abre la ficha del indicador.
 */
@Component({
  selector: 'app-kpi-tile',
  imports: [NgxEchartsDirective, AppButton, NavIcon, CalcInfo],
  providers: [provideGraficos()],
  templateUrl: './kpi-tile.html',
  styleUrl: './kpi-tile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiTile {
  private readonly document = inject(DOCUMENT);
  private readonly themeService = inject(ChartThemeService);

  readonly kpi = input.required<KpiSpec>();
  /** Con qué se compara la variación, p. ej. «frente al periodo anterior». `null` si no se compara. */
  readonly comparison = input<string | null>(null);
  /** Dentro de la única tarjeta con pestañas: superficie tonal, sin borde ni sombra propios. */
  readonly plano = input(false);

  protected readonly ids = nextControlId('kpi');
  protected readonly infoOpen = signal(false);

  protected readonly noData = computed(() => {
    const value = this.kpi().valor;
    return value === null || Number.isNaN(value);
  });
  protected readonly estado = computed(() => {
    const e = this.kpi().estado;
    return e === undefined ? null : { clave: e, ...ESTADOS[e] };
  });
  protected readonly hero = computed(() => this.kpi().variante === 'hero');
  protected readonly valueText = computed(() => {
    const texto = formatearValor(this.kpi().valor, this.kpi().unidad);
    return this.noData() ? texto : `${this.kpi().prefijo ?? ''}${texto}`;
  });
  protected readonly reason = computed(() => this.kpi().motivoSinDato?.trim() || DEFAULT_NO_DATA_REASON);
  protected readonly delta = computed(() => readDelta(this.kpi().variacionPct, this.kpi().subirEsMalo === true));
  protected readonly arrow = computed(() => ARROWS[this.delta().direction]);

  /** «12 de 340», o `null` si el servidor no mandó los dos lados. */
  protected readonly fraction = computed(() => {
    const { numerador, denominador, unidad, unidadNumerador, unidadDenominador } = this.kpi();
    if (numerador === null || numerador === undefined || denominador === null || denominador === undefined) {
      return null;
    }
    // Una tasa (porcentaje) se compone de conteos; un importe o una razón se compone de lo que su unidad diga.
    const unit: UnidadValor = unidad.tipo === 'moneda' ? unidad : { tipo: 'numero' };
    return `${formatearValor(numerador, unidadNumerador ?? unit)} de ${formatearValor(denominador, unidadDenominador ?? unit)}`;
  });

  protected readonly showTrend = computed(() => !this.noData() && hasTrend(this.kpi().tendencia));
  protected readonly trendLabel = computed(() =>
    describeTrend(this.kpi().tendencia ?? [], this.kpi().unidad),
  );
  protected readonly trendOptions = computed(() => {
    const theme = this.themeService.theme();
    const trend = this.kpi().tendencia;
    if (theme === null || trend === undefined || !this.showTrend()) {
      return null;
    }
    // Sin `matchMedia` (entornos sin pantalla) se asume movimiento reducido: la opción segura.
    const view = this.document.defaultView;
    const reduceMotion =
      typeof view?.matchMedia === 'function' ? view.matchMedia('(prefers-reduced-motion: reduce)').matches : true;
    return buildSparkline(trend, this.kpi().unidad, theme, !reduceMotion);
  });

  constructor() {
    afterNextRender(() => this.themeService.start());
  }
}
