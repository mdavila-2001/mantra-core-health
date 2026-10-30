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
  GlossaryEvidenceTier,
  GlossaryNeighbor,
  GlossaryNeighborGroup,
  GlossaryNeighborhood,
  GlossaryRelationFrequency,
} from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Checkbox } from '../../shared/components/atoms/checkbox/checkbox';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Card } from '../../shared/components/molecules/card/card';
import {
  EVIDENCE_TIER_LABEL,
  EVIDENCE_TIER_NUMBER,
  EVIDENCE_TIERS,
  FREQUENCY_LABEL,
  RELATION_FREQUENCIES,
} from '../../shared/components/molecules/relation-evidence/relation-evidence.logic';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { RelationGroups } from '../../shared/components/organisms/relation-groups/relation-groups';
import type {
  RelationColumnView,
  RelationGroupsTone,
} from '../../shared/components/organisms/relation-groups/relation-groups.types';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  buildClinicalRoute,
  mergeFullGroups,
  ROUTE_ZONES,
  type RouteColumn,
  type RouteColumnKey,
  type RouteZone,
} from './glossary-clinical-route';
import {
  applyNetworkFilters,
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  isDefaultFilters,
  type NetworkFilters,
} from './glossary-network-filters.logic';
import { GlossaryTermSearch } from './glossary-term-search';

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

/** Una zona del mapa lista para el organismo de relaciones. */
interface ZoneView {
  readonly key: 'hallazgos' | 'siguiente' | 'contexto';
  readonly title: string;
  readonly tone: RelationGroupsTone;
  readonly columns: readonly RelationColumnView[];
}

/** El sufijo de clase e id de cada zona (`ruta__zona--hallazgos`, `ruta-zona-hallazgos`). */
const ZONE_CLASS: Readonly<Record<RouteZone, ZoneView['key']>> = {
  findings: 'hallazgos',
  next: 'siguiente',
  context: 'contexto',
};

/** Valor del selector de frecuencia que no filtra. */
const ANY_FREQUENCY = 'ANY';
type FrequencyChoice = GlossaryRelationFrequency | typeof ANY_FREQUENCY;

const FREQUENCY_OPTIONS: readonly SelectOption<FrequencyChoice>[] = [
  { value: ANY_FREQUENCY, label: 'Cualquier frecuencia' },
  ...RELATION_FREQUENCIES.filter((frequency) => frequency !== 'EXCLUDED').map((frequency) => ({
    value: frequency,
    label: frequency === 'OBLIGATE' ? FREQUENCY_LABEL[frequency] : `${FREQUENCY_LABEL[frequency]} o más`,
  })),
];

const TIER_OPTIONS = EVIDENCE_TIERS.map((tier) => ({
  tier,
  label: `${EVIDENCE_TIER_LABEL[tier]} (nivel ${EVIDENCE_TIER_NUMBER[tier]})`,
}));

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
  imports: [
    AppButton,
    Card,
    Checkbox,
    EmptyState,
    FormField,
    PageHeader,
    ReferenceCombobox,
    RelationGroups,
    RouterLink,
    Select,
    ViewStateHost,
  ],
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

  protected readonly termSearch = new GlossaryTermSearch(this.terminology);
  protected readonly compareSearch = new GlossaryTermSearch(this.terminology);
  protected readonly compareOpen = signal(false);

  /** Los filtros que dice la URL (TAREA-41 F5.2). */
  protected readonly filters = toSignal(this.route.queryParamMap.pipe(map(filtersFromParams)), {
    initialValue: filtersFromParams(this.route.snapshot.queryParamMap),
  });
  protected readonly filtersAreDefault = computed(() => isDefaultFilters(this.filters()));
  protected readonly tierOptions = TIER_OPTIONS;
  protected readonly frequencyOptions = FREQUENCY_OPTIONS;
  protected readonly frequencyChoice = computed<FrequencyChoice>(
    () => this.filters().minFrequency ?? ANY_FREQUENCY,
  );

  protected readonly data = computed(() => {
    const state = this.neighborhood();
    return state.status === 'ready' ? mergeFullGroups(state.data, this.fullGroups()) : null;
  });
  protected readonly clinicalRoute = computed(() => {
    const data = this.data();
    return data === null ? null : buildClinicalRoute(data);
  });
  /** La ruta clínica después de los filtros, con lo que quedó oculto. */
  protected readonly filtered = computed(() => {
    const route = this.clinicalRoute();
    return route === null ? null : applyNetworkFilters(route, this.filters());
  });
  /** Las columnas que el filtro «Tipos de relación» puede mostrar u ocultar. */
  protected readonly columnChoices = computed(() => {
    const route = this.clinicalRoute();
    if (route === null) return [];
    return [...route.findings, ...route.next, ...route.context].map((column) => ({
      key: column.key,
      title: column.title,
      visible: !this.filters().hiddenColumns.has(column.key),
    }));
  });
  /** Las tres zonas del mapa, ya filtradas y recortadas, para el organismo. */
  protected readonly zones = computed<readonly ZoneView[]>(() => {
    const route = this.filtered()?.route;
    if (route === undefined) return [];
    const view = (column: RouteColumn): RelationColumnView => ({
      key: column.key,
      title: column.title,
      items: this.visibleItems(column),
      count: column.complete ? column.items.length : null,
    });
    return ROUTE_ZONES.map(({ zone, title }) => ({
      key: ZONE_CLASS[zone],
      title,
      tone: zone,
      columns: route[zone].map(view),
    }));
  });
  /** Lo que el buscador muestra elegido: el término central, si ya cargó. */
  protected readonly selectedOption = computed<ReferenceOption | null>(() => {
    const focus = this.data()?.focus;
    return focus === undefined
      ? null
      : { value: focus.conceptId, label: focus.display, ...(focus.category ? { hint: focus.category.name } : {}) };
  });

  private neighborhoodRequest: Subscription | null = null;
  private columnRequest: Subscription | null = null;

  constructor() {
    effect(() => {
      const conceptId = this.focusId();
      untracked(() => this.load(conceptId));
    });
    inject(DestroyRef).onDestroy(() => {
      this.neighborhoodRequest?.unsubscribe();
      this.termSearch.dispose();
      this.compareSearch.dispose();
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

  protected choose(option: ReferenceOption | null): void {
    if (option !== null && option.value !== this.focusId()) this.focusOn(option.value);
  }

  /** Abre el comparador con el término central como A y el elegido como B. */
  protected compareWith(option: ReferenceOption | null): void {
    if (option === null || option.value === this.focusId()) return;
    void this.router.navigate(['/glossary/compare'], {
      queryParams: { a: this.focusId(), b: option.value },
    });
  }

  protected toggleTier(tier: GlossaryEvidenceTier, checked: boolean): void {
    const tiers = new Set(this.filters().tiers);
    if (checked) tiers.add(tier);
    else tiers.delete(tier);
    this.applyFilters({ ...this.filters(), tiers });
  }

  protected chooseFrequency(choice: FrequencyChoice | null): void {
    const minFrequency = choice === null || choice === ANY_FREQUENCY ? null : choice;
    this.applyFilters({ ...this.filters(), minFrequency });
  }

  protected toggleColumn(key: RouteColumnKey, visible: boolean): void {
    const hiddenColumns = new Set(this.filters().hiddenColumns);
    if (visible) hiddenColumns.delete(key);
    else hiddenColumns.add(key);
    this.applyFilters({ ...this.filters(), hiddenColumns });
  }

  protected toggleUnrated(includeUnrated: boolean): void {
    this.applyFilters({ ...this.filters(), includeUnrated });
  }

  protected resetFilters(): void {
    this.applyFilters(DEFAULT_FILTERS);
  }

  /** La columna filtrada detrás de una vista del organismo (para su pie). */
  protected routeColumn(view: RelationColumnView): RouteColumn | null {
    const route = this.filtered()?.route;
    if (route === undefined) return null;
    return [...route.findings, ...route.next, ...route.context].find((c) => c.key === view.key) ?? null;
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

  /** Los filtros se escriben en la URL: sobreviven a la recarga y se comparten. */
  private applyFilters(filters: NetworkFilters): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filtersToParams(filters),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
    this.compareOpen.set(false);
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
