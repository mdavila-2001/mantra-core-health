import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { fromEvent, interval, map, merge } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { InfrastructureClient } from '../../../core/data-access/infrastructure/infrastructure.client';
import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import { opsErrorToViewState, readOpsError } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.errors';
import {
  ageLabel,
  BOARD_POLL_INTERVAL_MS,
  BOARD_STALE_AFTER_SECONDS,
  HYGIENE_LABEL,
  isHygieneOnly,
  secondsSince,
  summarizeCell,
  V2_LABEL,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import { OpsSiteDirectory, type OpsSiteOption } from '../../../core/data-access/infrastructure-ops/infrastructure-ops-sites';
import type {
  BedBoard as BedBoardData,
  BedBoardCell,
  BlockReason,
  OperationalState,
  V2Code,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import type { CareSpaceNode } from '../../../core/data-access/infrastructure/infrastructure.types';
import { empty, loading, ready, routeAuthPending, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { BedStatusBadge, lookOfHygiene, lookOfV2 } from '../../../shared/components/molecules/bed-tile/bed-status';
import { BedTile } from '../../../shared/components/molecules/bed-tile/bed-tile';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar, type FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { Tree } from '../../../shared/components/organisms/tree/tree';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { arbolDeEspacios } from '../../admin/medical-organization/infrastructure/infrastructure.view';
import { CellDetail } from '../cell-detail/cell-detail';

/** Lo último que la API contestó bien, y cuándo llegó a esta pantalla. */
interface Reading {
  readonly board: BedBoardData;
  readonly receivedAt: Date;
}

const VIEW_OPTIONS: readonly SegmentedOption<string>[] = [
  { value: 'grid', label: 'Grilla', icon: 'grid' },
  { value: 'list', label: 'Lista', icon: 'table' },
];

/**
 * **Tablero de camas** — `/inpatient/bed-board`.
 *
 * Una unidad por pestaña, cada cama como un recuadro con su estado en texto,
 * glifo y patrón, el motivo y «hasta cuándo» si no está disponible, y la
 * antigüedad de su último cambio. Al elegir una cama, un panel lateral muestra
 * los cuatro ejes, los bloqueos, la orden de limpieza abierta, el historial y
 * las acciones. La grilla se puede ver también como lista.
 *
 * ## Frescura (S7)
 *
 * «Actualizado hace N s» está siempre a la vista. El tablero se vuelve a pedir
 * cada {@link BOARD_POLL_INTERVAL_MS} ms y al recuperar el foco. Cuando el dato
 * tiene más de {@link BOARD_STALE_AFTER_SECONDS} s, o cuando el sondeo falla y
 * quedan en pantalla los datos previos, la pantalla pasa a S7 con «Dato de hace
 * N min · Actualizar»: nunca se hace pasar un dato viejo por vigente.
 *
 * ## Los nueve estados
 *
 * S1 hasta que hay sesión; S2 cargando; S3 un establecimiento sin camas
 * («Crear camas») o unas pocas unidades sin camas; S4 el rechazo de una acción
 * (en el panel); S5 si la API niega la lectura; S6 un establecimiento de otro
 * tenant, sin revelar nada; S7 lo de arriba; S8 sin conexión; S9 con código de
 * soporte.
 *
 * ## Quién ve qué
 *
 * `viewer` (lo que el servidor declara) decide qué acciones se ofrecen y si la
 * vista es la reducida de Limpieza (solo higiene). Solo refleja: cada acción la
 * decide la API.
 */
@Component({
  selector: 'app-bed-board',
  imports: [
    AppButton,
    AppButtonLink,
    BedStatusBadge,
    BedTile,
    Card,
    CellDetail,
    DataTable,
    EmptyState,
    FilterBar,
    PageHeader,
    RouterLink,
    SegmentedControl,
    Select,
    Tab,
    Tabs,
    Tree,
    ViewStateHost,
  ],
  templateUrl: './bed-board.html',
  styleUrl: './bed-board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedBoard {
  private readonly client = inject(InfrastructureOpsClient);
  private readonly infra = inject(InfrastructureClient);
  private readonly directory = inject(OpsSiteDirectory);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly codeCell = viewChild.required<TemplateRef<{ $implicit: BedBoardCell }>>('codeCell');
  private readonly stateCell = viewChild.required<TemplateRef<{ $implicit: BedBoardCell }>>('stateCell');
  private readonly detailCell = viewChild.required<TemplateRef<{ $implicit: BedBoardCell }>>('detailCell');
  private readonly hygieneCell = viewChild.required<TemplateRef<{ $implicit: BedBoardCell }>>('hygieneCell');
  private readonly ageCell = viewChild.required<TemplateRef<{ $implicit: BedBoardCell }>>('ageCell');

  /** El reloj de la pantalla: de él salen «hace N s» y la regla de S7. */
  protected readonly now = signal(new Date());

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly sites = signal<readonly OpsSiteOption[]>([]);
  private readonly sitesLoaded = signal(false);
  private readonly sitesError = signal<ViewState<never> | null>(null);

  protected readonly siteId = computed(() => {
    const wanted = this.params().get('site');
    const list = this.sites();
    return list.find((s) => s.id === wanted)?.id ?? wanted ?? list[0]?.id ?? '';
  });
  protected readonly site = computed(() => this.sites().find((s) => s.id === this.siteId()) ?? null);
  protected readonly subtitle = computed(() => {
    const s = this.site();
    return s === null ? '' : s.name === s.practiceName ? s.code : `${s.name} · ${s.practiceName}`;
  });
  protected readonly layout = computed(() => (this.params().get('view') === 'list' ? 'list' : 'grid'));
  protected readonly filterFunction = computed(() => this.params().get('fn') ?? '');
  protected readonly filterV2 = computed(() => this.params().get('v2') ?? '');
  protected readonly filterParent = computed(() => this.params().get('parent') ?? '');
  protected readonly selectedId = computed(() => this.params().get('cell'));

  private readonly reading = signal<Reading | null>(null);
  private readonly loadError = signal<ViewState<never> | null>(null);
  protected readonly pollFailed = signal(false);
  protected readonly refreshing = signal(false);

  protected readonly viewOptions = VIEW_OPTIONS;
  protected readonly siteOptions = computed<readonly SelectOption<string>[]>(() =>
    this.sites().map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
  );

  protected readonly board = computed(() => this.reading()?.board ?? null);
  protected readonly viewer = computed(() => this.board()?.viewer);
  protected readonly hygieneOnly = computed(() => isHygieneOnly(this.viewer()));
  protected readonly units = computed(() => this.board()?.units ?? []);
  protected readonly reasons = signal<readonly BlockReason[]>([]);

  /** Segundos desde que la API armó el tablero (no desde que llegó: el atraso es de la fuente). */
  protected readonly ageSeconds = computed(() => {
    const b = this.board();
    return b === null ? 0 : secondsSince(b.generatedAt, this.now());
  });
  protected readonly freshness = computed(() => {
    const b = this.board();
    return b === null ? '' : ageLabel(b.generatedAt, this.now());
  });
  protected readonly staleCause = computed(() =>
    this.pollFailed()
      ? 'No se pudo actualizar: se muestran los datos de antes.'
      : 'La última lectura es más vieja de lo esperado.',
  );
  protected readonly ageMinutes = computed(() => Math.max(1, Math.round(this.ageSeconds() / 60)));

  /** Los nueve estados M34 del tablero. */
  protected readonly state = computed<ViewState<Reading>>(() => {
    const r = this.reading();
    if (r === null) {
      const e = this.sitesError() ?? this.loadError();
      if (e !== null) return e;
      if (!this.session.isAuthenticated()) return routeAuthPending();
      if (this.sitesLoaded() && this.sites().length === 0) {
        return empty(
          { label: 'Cargar la estructura del establecimiento', route: '/administration/medical-organization' },
          'Esta organización todavía no tiene establecimientos.',
        );
      }
      return loading();
    }
    const total = r.board.units.reduce((n, u) => n + u.counts.total, 0);
    if (r.board.units.length === 0 || (total === 0 && !this.hasFilters())) {
      return empty(
        { label: 'Crear camas', route: '/administration/medical-organization' },
        'Este establecimiento no tiene camas ni locales con estado operativo.',
      );
    }
    if (this.pollFailed() || secondsSince(r.board.generatedAt, this.now()) > BOARD_STALE_AFTER_SECONDS) {
      return stale(r, new Date(r.board.generatedAt));
    }
    return ready(r);
  });

  protected readonly hasFilters = computed(
    () => this.filterFunction() !== '' || this.filterV2() !== '' || this.filterParent() !== '',
  );

  /** La unidad de la URL; si no hay, la de la cama elegida por enlace; si no, la primera. */
  protected readonly tabIndex = computed(() => {
    const byUnit = this.units().findIndex((u) => u.unitId === this.params().get('unit'));
    if (byUnit >= 0) return byUnit;
    const bySelection = this.units().findIndex((u) => u.cells.some((c) => c.id === this.selectedId()));
    return bySelection < 0 ? 0 : bySelection;
  });
  protected readonly unitLabels = computed(() => this.units().map((u) => `${u.name} · ${u.counts.total}`));

  protected readonly allCells = computed(() => this.units().flatMap((u) => u.cells));
  protected readonly selectedCell = computed(() => this.allCells().find((c) => c.id === this.selectedId()) ?? null);
  protected readonly detail = signal<OperationalState | null>(null);
  protected readonly detailError = signal<ViewState<never> | null>(null);
  protected readonly detailLoading = signal(false);

  protected readonly filterDefs = computed<readonly FilterDef[]>(() => {
    const functions = new Map<string, string>();
    for (const c of this.allCells()) functions.set(c.function.code, c.function.display);
    const defs: FilterDef[] = [
      {
        key: 'fn',
        label: 'Función',
        placeholder: 'Todas las funciones',
        options: [...functions.entries()].map(([value, label]) => ({ value, label })),
      },
    ];
    if (!this.hygieneOnly()) {
      defs.push({
        key: 'v2',
        label: 'Estado',
        placeholder: 'Todos los estados',
        options: (Object.keys(V2_LABEL) as V2Code[]).map((value) => ({ value, label: V2_LABEL[value] })),
      });
    }
    return defs;
  });

  // ─ ubicación: el árbol de F1, acotado a lo que contiene camas
  protected readonly locationOpen = signal(false);
  protected readonly locationNodes = signal<ReturnType<typeof arbolDeEspacios>>([]);
  protected readonly locationExpanded = signal<readonly string[]>([]);
  protected readonly locationName = computed(() => {
    const id = this.filterParent();
    if (id === '') return null;
    const find = (nodes: ReturnType<typeof arbolDeEspacios>): string | null => {
      for (const n of nodes) {
        if (n.id === id) return n.label;
        const inner = find(n.children ?? []);
        if (inner !== null) return inner;
      }
      return null;
    };
    return find(this.locationNodes());
  });

  protected readonly columns = computed<readonly ColumnDef<BedBoardCell>[]>(() => [
    { key: 'code', header: 'Cama', priority: 1, cell: this.codeCell() },
    { key: 'state', header: 'Estado', priority: 1, cell: this.stateCell() },
    { key: 'detail', header: 'Detalle', priority: 2, cell: this.detailCell() },
    { key: 'hygiene', header: 'Higiene', priority: 2, cell: this.hygieneCell() },
    { key: 'age', header: 'Último cambio', priority: 2, cell: this.ageCell() },
  ]);
  protected readonly trackBy = (c: BedBoardCell): string => c.id;
  protected readonly rowLabel = (c: BedBoardCell): string => `${c.form.display} ${c.code}`;
  /** Un estado por unidad, estable entre ciclos: la tabla no recibe un objeto nuevo en cada detección. */
  protected readonly listStates = computed<readonly ViewState<readonly BedBoardCell[]>[]>(() => this.units().map((u) => ready(u.cells)));

  protected readonly lookOfV2 = lookOfV2;
  protected readonly lookOfHygiene = lookOfHygiene;
  protected readonly hygieneText = (c: BedBoardCell): string => HYGIENE_LABEL[c.hygiene.code];
  protected readonly summarize = (c: BedBoardCell): string => {
    const s = summarizeCell(c, this.reasons());
    return s.detail === null ? s.headline : `${s.headline} · ${s.detail}`;
  };
  protected readonly ageOf = (c: BedBoardCell): string => ageLabel(c.lastEventAt, this.now());
  /** La leyenda dice lo que el tablero dibuja: los siete estados, o los de higiene en la vista de Limpieza. */
  protected readonly legend = computed(() =>
    this.hygieneOnly()
      ? (['HYG_INSPECTED', 'HYG_CLEAN', 'HYG_DIRTY', 'HYG_CLEANING', 'HYG_CONTAMINATED'] as const).map((c) => lookOfHygiene(c, c === 'HYG_CLEAN'))
      : (Object.keys(V2_LABEL) as V2Code[]).map((code) => lookOfV2(code)),
  );

  constructor() {
    this.directory.sites().subscribe({
      next: (list) => {
        this.sites.set(list);
        this.sitesLoaded.set(true);
      },
      error: (error: unknown) => this.sitesError.set(opsErrorToViewState<never>(error)),
    });
    this.client.getCatalog().subscribe({
      next: (catalog) => this.reasons.set(catalog.blockReasons ?? []),
      error: () => undefined,
    });

    // Cada cambio de establecimiento o de filtro vuelve a pedir el tablero.
    effect(() => {
      const site = this.siteId();
      const key = [this.filterFunction(), this.filterV2(), this.filterParent()].join('|');
      void key;
      if (site === '') return;
      untracked(() => this.loadBoard(false));
    });
    // La estructura del establecimiento, para el filtro por ubicación.
    effect(() => {
      const site = this.siteId();
      if (site === '') return;
      untracked(() => this.loadLocations(site));
    });
    // Si el sondeo trae una versión nueva de la cama elegida, el panel se vuelve a leer:
    // no se deja a la vista un estado que otra persona ya cambió.
    effect(() => {
      const cell = this.selectedCell();
      if (cell === null) return;
      untracked(() => {
        const d = this.detail();
        if (d !== null && d.id === cell.id && d.opsVersion !== cell.opsVersion) this.loadDetail(cell.id);
      });
    });
    // La cama elegida (por enlace o por clic) trae su estado operativo completo.
    effect(() => {
      const id = this.selectedId();
      untracked(() => this.loadDetail(id));
    });

    if (this.isBrowser) {
      interval(1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.now.set(new Date()));
      merge(
        interval(BOARD_POLL_INTERVAL_MS),
        fromEvent(window, 'focus'),
        fromEvent(document, 'visibilitychange').pipe(map(() => document.visibilityState)),
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((signal) => {
          if (typeof signal === 'string' && signal !== 'visible') return;
          if (this.siteId() !== '') this.loadBoard(true);
        });
    }
  }

  protected reloadBoard(): void {
    this.loadBoard(true);
  }

  protected refresh(): void {
    this.loadBoard(true);
    const id = this.selectedId();
    if (id !== null) this.loadDetail(id);
  }

  private loadBoard(silent: boolean): void {
    const site = this.siteId();
    if (site === '') return;
    if (!silent && this.reading() === null) this.loadError.set(null);
    this.refreshing.set(true);
    this.client
      .getBedBoard(site, {
        ...(this.filterParent() === '' ? {} : { parentSpaceId: this.filterParent() }),
        ...(this.filterFunction() === '' ? {} : { functionCodes: [this.filterFunction()] }),
        ...(this.filterV2() === '' ? {} : { v2Codes: [this.filterV2() as V2Code] }),
      })
      .subscribe({
        next: (board) => {
          this.refreshing.set(false);
          this.pollFailed.set(false);
          this.loadError.set(null);
          this.now.set(new Date());
          this.reading.set({ board, receivedAt: new Date() });
        },
        error: (error: unknown) => {
          this.refreshing.set(false);
          const status = readOpsError(error)?.status;
          if (this.reading() !== null && status !== 403 && status !== 404) {
            // Quedan en pantalla los datos de antes, marcados como atrasados.
            this.pollFailed.set(true);
            return;
          }
          this.reading.set(null);
          this.loadError.set(opsErrorToViewState<never>(error));
        },
      });
  }

  private loadLocations(site: string): void {
    this.infra.getStructure(site).subscribe({
      next: (structure) => {
        const places: readonly CareSpaceNode[] = structure.spaces.filter((s) => s.form.code !== 'LOC_FORM_BED');
        this.locationNodes.set(arbolDeEspacios(places, false));
      },
      error: () => this.locationNodes.set([]),
    });
  }

  private loadDetail(id: string | null): void {
    if (id === null) {
      this.detail.set(null);
      this.detailError.set(null);
      return;
    }
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.client.getOperationalState(id).subscribe({
      next: (state) => {
        this.detailLoading.set(false);
        this.detail.set(state);
      },
      error: (error: unknown) => {
        this.detailLoading.set(false);
        this.detail.set(null);
        this.detailError.set(opsErrorToViewState<never>(error));
      },
    });
  }

  // ─ navegación por la URL (la fuente de verdad: recargar reproduce la vista)
  private go(params: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected chooseSite(id: string | null): void {
    this.go({ site: id, unit: null, cell: null, parent: null });
    this.reading.set(null);
  }

  protected chooseLayout(value: string): void {
    this.go({ view: value === 'list' ? 'list' : null });
  }

  protected chooseTab(index: number): void {
    const unit = this.units()[index];
    if (unit !== undefined) this.go({ unit: unit.unitId });
  }

  protected selectCell(cell: BedBoardCell): void {
    this.go({ cell: cell.id, unit: this.units().find((u) => u.cells.some((c) => c.id === cell.id))?.unitId ?? null });
  }

  protected closePanel(): void {
    this.go({ cell: null });
  }

  protected chooseLocation(id: string | null): void {
    this.go({ parent: id });
  }

  protected clearFilters(): void {
    this.go({ fn: null, v2: null, parent: null });
  }

  protected onDetailChange(state: OperationalState): void {
    this.detail.set(state);
  }
}
