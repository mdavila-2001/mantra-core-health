import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map, type Subscription } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type {
  GlossaryNeighbor,
  GlossaryNeighborGroup,
  GlossaryNeighborhood,
} from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  buildClinicalRoute,
  mergeFullGroups,
  type RouteColumn,
  type RouteColumnKey,
} from './glossary-clinical-route';

/** Vecinos por grupo en la primera lectura: alcanza para ver de qué se trata cada columna. */
const SAMPLE_PER_GROUP = 8;
/** Lo que se pide al abrir «Ver todos»: el máximo que acepta el contrato. */
const FULL_GROUP_LIMIT = 200;
/** Vecinos visibles por columna antes de «Ver los N». */
const VISIBLE_PER_COLUMN = 8;
/** Cuántos términos recorridos se recuerdan para volver con un clic. */
const TRAIL_LENGTH = 6;

interface TrailStep {
  readonly conceptId: string;
  readonly display: string;
}

/**
 * Mapa de relaciones del glosario como **ruta clínica** (TAREA-41 F0).
 *
 * El término elegido va al centro; a su izquierda lo que se observa (síntomas,
 * localización), a su derecha lo que sigue (enfermedades, estudios,
 * tratamientos, especialidades) y abajo el resto. Cada vecino es un botón que
 * lo pasa al centro.
 *
 * Lee el vecindario de UN término (`glossary-neighborhood`), en los dos
 * sentidos. La versión anterior leía los primeros 500 términos del catálogo y
 * buscaba las relaciones dentro de ellos: el 97 % del glosario no se podía
 * abrir, y un síntoma nunca mostraba las enfermedades que lo presentan.
 */
@Component({
  selector: 'app-glossary-network',
  imports: [Card, EmptyState, FormField, PageHeader, ReferenceCombobox, RouterLink, ViewStateHost],
  templateUrl: './glossary-network.html',
  styleUrl: './glossary-network.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryNetwork {
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly visibleLimit = VISIBLE_PER_COLUMN;

  /** El término central pedido por la URL (`?focus=<conceptId>`); vacío = ninguno. */
  protected readonly focusId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('focus') ?? '')),
    { initialValue: this.route.snapshot.queryParamMap.get('focus') ?? '' },
  );

  protected readonly neighborhood = signal<ViewState<GlossaryNeighborhood>>(loading());
  /** Grupos que llegaron enteros al abrir «Ver todos»; pisan a su muestra. */
  private readonly fullGroups = signal<readonly GlossaryNeighborGroup[]>([]);
  private readonly openColumns = signal<ReadonlySet<RouteColumnKey>>(new Set());
  protected readonly loadingColumn = signal<RouteColumnKey | null>(null);
  protected readonly failedColumn = signal<RouteColumnKey | null>(null);
  protected readonly trail = signal<readonly TrailStep[]>([]);

  protected readonly searchOptions = signal<readonly ReferenceOption[]>([]);
  protected readonly searching = signal(false);

  protected readonly data = computed(() => {
    const state = this.neighborhood();
    return state.status === 'ready' ? mergeFullGroups(state.data, this.fullGroups()) : null;
  });
  protected readonly clinicalRoute = computed(() => {
    const data = this.data();
    return data === null ? null : buildClinicalRoute(data);
  });
  /** Lo que el buscador muestra elegido: el término central, si ya cargó. */
  protected readonly selectedOption = computed<ReferenceOption | null>(() => {
    const focus = this.data()?.focus;
    return focus === undefined
      ? null
      : { value: focus.conceptId, label: focus.display, ...(focus.category ? { hint: focus.category.name } : {}) };
  });

  private neighborhoodRequest: Subscription | null = null;
  private searchRequest: Subscription | null = null;
  private columnRequest: Subscription | null = null;

  constructor() {
    effect(() => {
      const conceptId = this.focusId();
      untracked(() => this.load(conceptId));
    });
    inject(DestroyRef).onDestroy(() => {
      this.neighborhoodRequest?.unsubscribe();
      this.searchRequest?.unsubscribe();
      this.columnRequest?.unsubscribe();
    });
  }

  protected focusOn(conceptId: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { focus: conceptId },
      queryParamsHandling: 'merge',
    });
  }

  protected search(text: string): void {
    this.searchRequest?.unsubscribe();
    if (text.trim() === '') {
      this.searchOptions.set([]);
      return;
    }
    this.searching.set(true);
    this.searchRequest = this.terminology.searchGlossary({ query: text, limit: 10 }).subscribe({
      next: (page) => {
        this.searchOptions.set(
          page.items.map((term) => ({
            value: term.conceptId,
            label: term.display,
            ...(term.category ? { hint: term.category.name } : {}),
          })),
        );
        this.searching.set(false);
      },
      error: () => {
        this.searchOptions.set([]);
        this.searching.set(false);
      },
    });
  }

  protected choose(option: ReferenceOption | null): void {
    if (option !== null && option.value !== this.focusId()) this.focusOn(option.value);
  }

  protected visibleItems(column: RouteColumn): readonly GlossaryNeighbor[] {
    return this.isOpen(column) ? column.items : column.items.slice(0, VISIBLE_PER_COLUMN);
  }

  protected isOpen(column: RouteColumn): boolean {
    return this.openColumns().has(column.key);
  }

  /** Si hay más vecinos de los que se ven: en la muestra o detrás del recorte. */
  protected hasMore(column: RouteColumn): boolean {
    return !this.isOpen(column) && (!column.complete || column.items.length > VISIBLE_PER_COLUMN);
  }

  protected showAll(column: RouteColumn): void {
    if (column.complete) {
      this.setOpen(column.key, true);
      return;
    }
    const conceptId = this.focusId();
    this.columnRequest?.unsubscribe();
    this.loadingColumn.set(column.key);
    this.failedColumn.set(null);
    this.columnRequest = forkJoin(
      column.sources.map((source) =>
        this.terminology
          .readGlossaryNeighborhood(conceptId, { ...source, offset: 0, limit: FULL_GROUP_LIMIT })
          .pipe(map((page) => page.groups)),
      ),
    ).subscribe({
      next: (pages) => {
        const arrived = pages.flat();
        this.fullGroups.update((current) => [
          ...current.filter((g) => !arrived.some((a) => a.type === g.type && a.direction === g.direction)),
          ...arrived,
        ]);
        this.setOpen(column.key, true);
        this.loadingColumn.set(null);
      },
      error: () => {
        this.loadingColumn.set(null);
        this.failedColumn.set(column.key);
      },
    });
  }

  protected showLess(column: RouteColumn): void {
    this.setOpen(column.key, false);
  }

  protected reload(): void {
    this.load(this.focusId());
  }

  private setOpen(key: RouteColumnKey, open: boolean): void {
    this.openColumns.update((current) => {
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  private load(conceptId: string): void {
    this.neighborhoodRequest?.unsubscribe();
    this.columnRequest?.unsubscribe();
    this.fullGroups.set([]);
    this.openColumns.set(new Set());
    this.loadingColumn.set(null);
    this.failedColumn.set(null);
    if (conceptId === '') {
      this.neighborhood.set(loading());
      return;
    }
    this.neighborhood.set(loading());
    this.neighborhoodRequest = this.terminology
      .readGlossaryNeighborhood(conceptId, { perGroup: SAMPLE_PER_GROUP })
      .subscribe({
        next: (neighborhood) => {
          this.neighborhood.set(ready(neighborhood));
          this.remember(neighborhood.focus);
        },
        error: (error: unknown) =>
          this.neighborhood.set(errorToViewState<GlossaryNeighborhood>(error)),
      });
  }

  private remember(focus: TrailStep): void {
    this.trail.update((steps) =>
      [...steps.filter((step) => step.conceptId !== focus.conceptId), {
        conceptId: focus.conceptId,
        display: focus.display,
      }].slice(-TRAIL_LENGTH),
    );
  }
}
