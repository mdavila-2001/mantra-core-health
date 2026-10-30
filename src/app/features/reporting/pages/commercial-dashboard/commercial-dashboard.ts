import { toObservable, toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, type Observable, of, switchMap, tap } from 'rxjs';

import { ReportingClient } from '@core/data-access/reporting/reporting.client';
import { ETIQUETA_VERTICAL, VERTICALES } from '@core/data-access/reporting/reporting-labels';
import type { ContextoReporte, PestanaReporte, VerticalReporte } from '@core/data-access/reporting/reporting.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { empty, loading, notFound, ready, stale } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Skeleton } from '@shared/components/atoms/skeleton/skeleton';
import { Alert } from '@shared/components/molecules/alert/alert';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { ReportFilterBar } from '../../components/filter-bar/report-filter-bar';
import { TabView } from '../../components/tab-view/tab-view';
import { ReportContextStore } from '../../state/report-context.store';

const SKELETON_KPIS = [0, 1, 2, 3] as const;
const SKELETON_CHARTS = [0, 1] as const;

const DESIGN_TITLE = 'Módulo en diseño';
const DESIGN_PATTERN = /dise[ñn]o/i;
const DESIGN_FALLBACK =
  'El pauteo todavía no está cerrado: se modela como un gestor de anuncios (campaña, conjunto y anuncio) y su definición puede cambiar.';

interface LastGood {
  readonly tab: VerticalReporte;
  readonly data: PestanaReporte;
}

interface Request {
  readonly tab: VerticalReporte;
  readonly context: ContextoReporte;
  readonly attempt: number;
}

/**
 * El dashboard comercial: una pestaña por vertical de negocio, con filtros
 * globales arriba. La pestaña activa sale de la URL (`reports/commercial/:pestana`),
 * así que cada pestaña tiene enlace propio y el botón «atrás» funciona.
 *
 * Reglas de carga (por qué no es un `rxResource` a secas):
 * - Cualquier cambio del contexto (periodo, comparación, moneda, alcance o un
 *   filtro por clic) **cancela** la petición anterior y pide de nuevo; una
 *   respuesta lenta vieja nunca pisa a una nueva.
 * - Si solo cambió el contexto, los datos de la pestaña **se quedan a la vista**
 *   mientras se recalcula (con aviso), en vez de volver a un esqueleto: los
 *   gráficos no se destruyen ni la página salta con cada clic en un filtro.
 * - Si la recarga falla por red o por el servidor y ya había datos de esa
 *   pestaña, se muestran como **datos atrasados** con su antigüedad y un botón
 *   para reintentar; sin datos previos, el error explica y ofrece reintentar.
 */
@Component({
  selector: 'app-commercial-dashboard',
  imports: [
    RouterLink,
    AppButton,
    Skeleton,
    Alert,
    EmptyState,
    PageHeader,
    ViewStateHost,
    ReportFilterBar,
    TabView,
  ],
  templateUrl: './commercial-dashboard.html',
  styleUrl: './commercial-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommercialDashboard {
  private readonly route = inject(ActivatedRoute);
  private readonly client = inject(ReportingClient);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly store = inject(ReportContextStore);

  protected readonly tabs = VERTICALES.map((vertical) => ({
    vertical,
    label: ETIQUETA_VERTICAL[vertical],
    link: ['/reports', 'commercial', vertical],
  }));
  protected readonly skeletonKpis = SKELETON_KPIS;
  protected readonly skeletonCharts = SKELETON_CHARTS;
  protected readonly designTitle = DESIGN_TITLE;

  private readonly param = toSignal(this.route.paramMap.pipe(map((p) => p.get('pestana'))), {
    initialValue: this.route.snapshot.paramMap.get('pestana'),
  });

  /** `null` = la URL pide una pestaña que no existe. Sin parámetro se abre el resumen. */
  protected readonly tab = computed<VerticalReporte | null>(() => {
    const value = this.param();
    if (value === null || value === '') {
      return 'resumen';
    }
    return (VERTICALES as readonly string[]).includes(value) ? (value as VerticalReporte) : null;
  });

  protected readonly state = signal<ViewState<PestanaReporte>>(loading());
  /** Hay datos de esta pestaña en pantalla y se están recalculando. */
  protected readonly refreshing = signal(false);
  private readonly attempt = signal(0);
  private lastGood: LastGood | null = null;

  protected readonly data = computed<PestanaReporte | null>(() => {
    const state = this.state();
    return state.status === 'ready' || state.status === 'stale' ? state.data : null;
  });
  protected readonly generatedLabel = computed(() => {
    const iso = this.data()?.generadoEn;
    const date = iso === undefined ? null : new Date(iso);
    return date === null || Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  });
  protected readonly isSample = computed(() => this.data()?.origen === 'ejemplo');
  protected readonly isDesignTab = computed(() => this.tab() === 'publicidad');
  /**
   * El aviso de «en diseño» es obligatorio en publicidad y va destacado, no mezclado con los demás
   * avisos: se usa el texto del servidor si lo trae, y el propio si no.
   */
  protected readonly designNotice = computed(() => {
    if (!this.isDesignTab()) {
      return null;
    }
    return (this.data()?.avisos ?? []).find((a) => DESIGN_PATTERN.test(a)) ?? DESIGN_FALLBACK;
  });
  /** Lo que se le entrega al cuerpo: sin el aviso de diseño, que ya salió arriba. */
  protected readonly body = computed<PestanaReporte | null>(() => {
    const data = this.data();
    if (data === null || !this.isDesignTab()) {
      return data;
    }
    return { ...data, avisos: (data.avisos ?? []).filter((a) => !DESIGN_PATTERN.test(a)) };
  });

  private readonly request = computed<Request | null>(() => {
    const tab = this.tab();
    return tab === null ? null : { tab, context: this.store.contexto(), attempt: this.attempt() };
  });

  constructor() {
    toObservable(this.request)
      .pipe(
        switchMap((request) => this.loadTab(request)),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        this.state.set(state);
        this.refreshing.set(false);
      });

    // La pestaña activa puede quedar fuera de la vista en un móvil: se la acerca.
    afterRenderEffect(() => {
      this.tab();
      const active = this.host.nativeElement.querySelector<HTMLElement>('.cd__tab[aria-current="page"]');
      if (active !== null && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
    });
  }

  protected reload(): void {
    this.attempt.update((n) => n + 1);
  }

  protected clearFilters(): void {
    this.store.limpiarFiltros();
  }

  private loadTab(request: Request | null): Observable<ViewState<PestanaReporte>> {
    if (request === null) {
      this.lastGood = null;
      return of(notFound({ label: 'Ir al resumen ejecutivo', route: '/reports/commercial/resumen' }));
    }
    if (this.lastGood?.tab === request.tab) {
      this.refreshing.set(true);
    } else {
      this.lastGood = null;
      this.refreshing.set(false);
      this.state.set(loading());
    }
    return this.client.pestana(request.tab, request.context).pipe(
      tap((data) => (this.lastGood = { tab: request.tab, data })),
      map((data): ViewState<PestanaReporte> => {
        const hasContent = data.kpis.length > 0 || data.graficos.length > 0 || data.tablas.length > 0;
        return hasContent
          ? ready(data)
          : empty(
              { label: 'Quite un filtro o amplíe el periodo.' },
              'No hay datos para este periodo y estos filtros.',
            );
      }),
      catchError((error: unknown) => of(this.failure(error, request.tab))),
    );
  }

  private failure(error: unknown, tab: VerticalReporte): ViewState<PestanaReporte> {
    const failed = errorToViewState<PestanaReporte>(error);
    const previous = this.lastGood;
    // Sin red o con el servidor caído, lo último que se vio vale más que una pantalla vacía.
    if (previous !== null && previous.tab === tab && (failed.status === 'offline' || failed.status === 'error')) {
      const generated = new Date(previous.data.generadoEn);
      return stale(previous.data, Number.isNaN(generated.getTime()) ? new Date() : generated);
    }
    return failed;
  }
}
