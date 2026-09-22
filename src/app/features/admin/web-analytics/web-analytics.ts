import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { WebAnalyticsClient } from '../../../core/data-access/admin-portal/platform.client';
import type {
  AnalyticsOverview,
  AnalyticsWindowQuery,
  FunnelDefinition,
  FunnelReport,
  PipelineHealth,
  SessionDetail,
  SessionSummary,
  Timeseries,
  WebVitals,
} from '../../../core/data-access/admin-portal/platform.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { entero, porcentaje } from '../platform/platform-labels';

type Rango = '24h' | '7d' | '30d';
const HORAS: Record<Rango, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

/** Nombres legibles de las métricas de rendimiento que manda el servidor. */
const VITALES: Readonly<Record<string, string>> = {
  LCP: 'Carga del contenido principal (LCP)',
  INP: 'Respuesta a la interacción (INP)',
  CLS: 'Estabilidad visual (CLS)',
  FCP: 'Primer contenido (FCP)',
  TTFB: 'Primer byte (TTFB)',
  FID: 'Primer retardo de entrada (FID)',
};

const NO_MEDIDO: Readonly<Record<string, string>> = {
  duplicates: 'Duplicados descartados',
  consentDropped: 'Descartados por consentimiento',
  rejected: 'Lotes rechazados',
};

/**
 * Analítica de producto y rendimiento real (RUM) del portal. Cada número lo
 * calcula el servidor sobre una ventana acotada, con su definición; aquí sólo
 * se muestra. Lo que la ingesta no persiste se declara como no medido.
 */
@Component({
  selector: 'app-web-analytics',
  imports: [
    DatePipe,
    DecimalPipe,
    AppButton,
    Badge,
    Select,
    Alert,
    Card,
    SegmentedControl,
    Tabs,
    Tab,
    ContentDialog,
    PageHeader,
    ViewStateHost,
  ],
  templateUrl: './web-analytics.html',
  styleUrl: './web-analytics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebAnalytics {
  private readonly analytics = inject(WebAnalyticsClient);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly entero = entero;
  protected readonly porcentaje = porcentaje;
  protected readonly vital = (m: string) => VITALES[m] ?? m;
  protected readonly noMedido = (m: string) => NO_MEDIDO[m] ?? m;

  protected readonly pestana = signal(0);
  protected readonly rango = signal<Rango>('7d');
  protected readonly portal = signal<'WEB' | 'MOBILE' | null>(null);
  protected readonly opcionesRango = [
    { value: '24h' as const, label: 'Últimas 24 h' },
    { value: '7d' as const, label: '7 días' },
    { value: '30d' as const, label: '30 días' },
  ];
  protected readonly opcionesPortal = [
    { value: null, label: 'Todos los portales' },
    { value: 'WEB' as const, label: 'Web' },
    { value: 'MOBILE' as const, label: 'Móvil' },
  ];

  protected readonly resumen = signal<ViewState<AnalyticsOverview>>(loading());
  protected readonly serie = signal<ViewState<Timeseries>>(loading());
  protected readonly vitales = signal<ViewState<WebVitals>>(loading());
  protected readonly salud = signal<ViewState<PipelineHealth>>(loading());
  protected readonly embudos = signal<readonly FunnelDefinition[]>([]);
  protected readonly embudoElegido = signal<string | null>(null);
  protected readonly informe = signal<ViewState<FunnelReport> | null>(null);
  protected readonly sesiones = signal<ViewState<readonly SessionSummary[]>>(loading());
  protected readonly sesionAbierta = signal<ViewState<SessionDetail> | null>(null);

  protected readonly maximoSerie = computed(() => {
    const s = this.serie();
    return s.status === 'ready' ? Math.max(1, ...s.data.points.map((p) => p.events)) : 1;
  });

  protected readonly opcionesEmbudo = computed(() => [
    { value: null, label: 'Elegí un embudo' },
    ...this.embudos().map((f) => ({ value: f.id as string | null, label: `${f.name} (v${f.version})` })),
  ]);

  constructor() {
    this.analytics.funnels().subscribe({ next: (f) => this.embudos.set(f), error: () => this.embudos.set([]) });
    this.cargar();
  }

  private ventana(): AnalyticsWindowQuery {
    const to = new Date();
    const from = new Date(to.getTime() - HORAS[this.rango()] * 3_600_000);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      interval: this.rango() === '24h' ? 'hour' : 'day',
      ...(this.portal() ? { portal: this.portal()! } : {}),
    };
  }

  protected cargar(): void {
    const w = this.ventana();
    this.resumen.set(loading());
    this.serie.set(loading());
    this.vitales.set(loading());
    this.salud.set(loading());
    this.sesiones.set(loading());
    this.analytics.overview(w).subscribe({
      next: (r) => this.resumen.set(ready(r)),
      error: (e: unknown) => this.resumen.set(errorToViewState<AnalyticsOverview>(e)),
    });
    this.analytics.timeseries(w).subscribe({
      next: (r) => this.serie.set(ready(r)),
      error: (e: unknown) => this.serie.set(errorToViewState<Timeseries>(e)),
    });
    this.analytics.webVitals(w).subscribe({
      next: (r) =>
        this.vitales.set(
          r.metrics.length === 0 ? empty({ label: 'Ampliá la ventana de tiempo.' }, 'Sin muestras de rendimiento en esta ventana.') : ready(r),
        ),
      error: (e: unknown) => this.vitales.set(errorToViewState<WebVitals>(e)),
    });
    this.analytics.pipelineHealth(w).subscribe({
      next: (r) => this.salud.set(ready(r)),
      error: (e: unknown) => this.salud.set(errorToViewState<PipelineHealth>(e)),
    });
    this.analytics.sessions(w).subscribe({
      next: (r) =>
        this.sesiones.set(r.items.length === 0 ? empty({ label: 'Ampliá la ventana de tiempo.' }, 'Sin sesiones en esta ventana.') : ready(r.items)),
      error: (e: unknown) => this.sesiones.set(errorToViewState<readonly SessionSummary[]>(e)),
    });
    this.cargarInforme();
  }

  protected cambiarRango(r: Rango): void {
    this.rango.set(r);
    this.cargar();
  }

  protected cambiarPortal(p: 'WEB' | 'MOBILE' | null): void {
    this.portal.set(p);
    this.cargar();
  }

  protected elegirEmbudo(id: string | null): void {
    this.embudoElegido.set(id);
    this.cargarInforme();
  }

  protected cargarInforme(): void {
    const id = this.embudoElegido();
    if (!id) {
      this.informe.set(null);
      return;
    }
    this.informe.set(loading());
    this.analytics.funnelReport(id, this.ventana()).subscribe({
      next: (r) => this.informe.set(ready(r)),
      error: (e: unknown) => this.informe.set(errorToViewState<FunnelReport>(e)),
    });
  }

  protected abrirSesion(id: string): void {
    this.sesionAbierta.set(loading());
    this.analytics.session(id).subscribe({
      next: (s) => this.sesionAbierta.set(ready(s)),
      error: (e: unknown) => this.sesionAbierta.set(errorToViewState<SessionDetail>(e)),
    });
  }

  protected alto(eventos: number): string {
    return `${Math.round((eventos / this.maximoSerie()) * 100)}%`;
  }

  protected duracion(segundos: number | null): string {
    if (segundos === null) return 'En curso';
    const m = Math.floor(segundos / 60);
    return m > 0 ? `${m} min ${segundos % 60} s` : `${segundos} s`;
  }
}
