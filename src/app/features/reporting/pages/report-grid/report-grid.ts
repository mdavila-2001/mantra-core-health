import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';

import { ReportingClient } from '@core/data-access/reporting/reporting.client';
import { ETIQUETA_VERTICAL } from '@core/data-access/reporting/reporting-labels';
import type { ReporteCatalogo } from '@core/data-access/reporting/reporting.types';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Skeleton } from '@shared/components/atoms/skeleton/skeleton';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';
import { SearchField } from '@shared/components/molecules/search-field/search-field';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { reportErrorState } from '../../state/report-error-state';
import { ReportCard } from '../../components/report-card/report-card';
import {
  countByVertical,
  filterReports,
  sortReports,
  type VerticalFilter,
} from './report-grid.logic';
import { ReportPrefsStore } from './report-prefs.store';

const SKELETON_CARDS = [0, 1, 2, 3, 4, 5] as const;

/**
 * La pantalla de inicio del portal de reportería: el catálogo de reportes en
 * un grid. Es el centro del portal —el asistente es una pieza al costado—.
 *
 * Se puede recorrer de tres maneras sin salir de la pantalla: por vertical
 * (chips con contador), por texto (sin tildes) o por memoria de la persona
 * (favoritos y recientes). Los filtros viven en señales y no en la ruta porque
 * son del catálogo, no un enlace que se comparta.
 */
@Component({
  selector: 'app-report-grid',
  imports: [
    RouterLink,
    AppButton,
    Skeleton,
    EmptyState,
    SearchField,
    PageHeader,
    ViewStateHost,
    ReportCard,
  ],
  templateUrl: './report-grid.html',
  styleUrl: './report-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportGrid {
  private readonly client = inject(ReportingClient);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly prefs = inject(ReportPrefsStore);

  protected readonly state = signal<ViewState<readonly ReporteCatalogo[]>>(loading());
  protected readonly vertical = signal<VerticalFilter>('all');
  protected readonly query = signal('');
  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly verticalLabels = ETIQUETA_VERTICAL;

  private request: Subscription | null = null;

  private readonly catalog = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : [];
  });

  /** Verdadero si el catálogo ya cargó y la persona está recortándolo. */
  protected readonly filtering = computed(() => this.vertical() !== 'all' || this.query().trim() !== '');

  protected readonly chips = computed(() => countByVertical(this.catalog(), this.query()));
  protected readonly totalMatching = computed(() => this.chips().reduce((sum, c) => sum + c.count, 0));

  protected readonly results = computed(() => sortReports(filterReports(this.catalog(), this.vertical(), this.query())));

  protected readonly favoriteReports = computed(() => {
    const ids = this.prefs.favorites();
    return this.results().filter((r) => ids.includes(r.id));
  });

  /** Más reciente primero; se respeta el filtro para que «Recientes» no contradiga lo que se ve. */
  protected readonly recentReports = computed(() => {
    const visible = new Map(this.results().map((r) => [r.id, r]));
    return this.prefs.recents().flatMap((id) => visible.get(id) ?? []);
  });

  constructor() {
    this.load();
    // El almacenamiento del navegador no existe bajo SSR: se lee después de pintar.
    afterNextRender(() => this.prefs.load());
    this.destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  protected load(): void {
    this.request?.unsubscribe();
    this.state.set(loading());
    this.request = this.client.catalogo().subscribe({
      next: (reports) =>
        this.state.set(
          reports.length === 0
            ? empty(
                { label: 'Pida acceso a la persona que administra su organización.' },
                'Todavía no hay reportes publicados para su rol.',
              )
            : ready(reports),
        ),
      error: (error: unknown) => this.state.set(reportErrorState(error)),
    });
  }

  protected pickVertical(value: VerticalFilter): void {
    this.vertical.set(value);
  }

  protected clearFilters(): void {
    this.vertical.set('all');
    this.query.set('');
  }

  protected toggleFavorite(report: ReporteCatalogo): void {
    this.prefs.toggleFavorite(report.id);
  }

  protected opened(report: ReporteCatalogo): void {
    this.prefs.markOpened(report.id);
  }
}
