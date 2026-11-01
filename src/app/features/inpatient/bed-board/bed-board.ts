import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, PLATFORM_ID, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, Subject, switchMap } from 'rxjs';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { BedBoard as BedBoardData, BedBoardCell, V2Code } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { InfrastructureClient } from '../../../core/data-access/infrastructure/infrastructure.client';
import type { CareSpaceNode } from '../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, forbidden, loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { BedTile } from '../../../shared/components/molecules/bed-tile/bed-tile';
import { Card } from '../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DrawerPanel } from '../../../shared/components/organisms/drawer-panel/drawer-panel';
import { FilterBar } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { BedActions } from '../bed-actions/bed-actions';
import { InpatientAccessStore } from '../inpatient-access.store';
import { ADMISSION_NEW_ROUTE, CLEANING_ROUTE, CLOCK_TICK_MS, DEFAULT_TIME_ZONE, POLL_INTERVAL_MS, STALE_AFTER_MS, cellToTile, relativeAge } from '../inpatient-presentation';
import { BedPanel } from './bed-panel';
import { badgeOf, boardFilters, countsOf, FILTER_KEYS, LEGEND, toRow, unitKey, VIEWS, type BoardRow, type BoardView } from './bed-board.view';

interface Loaded {
  readonly key: string;
  readonly state: ViewState<BedBoardData>;
}

/**
 * **Tablero de camas** — `/inpatient/bed-board` (F2.4).
 *
 * Una pestaña por unidad con recuentos **derivados** por la API, grilla ⇄
 * lista, filtros en la URL, leyenda fija y un panel lateral por cama con sus
 * acciones (F2) y las de internación (F3, slot `adtActions`).
 *
 * ## Carga atada a la consulta (H2)
 *
 * Cada pedido lleva la clave de la consulta (`sede|ubicación|función|v2`). Un
 * pedido viejo se **cancela** al llegar otro (`switchMap`), y el último dato
 * bueno (`lastGood`) sólo vale para su clave: al cambiar de filtro o de sede
 * se descarta, así nunca se muestra como «atrasado» un tablero de otra
 * consulta.
 *
 * ## Antigüedad del dato (S7)
 *
 * «Actualizado hace N s» está siempre a la vista. Se sondea cada 30 s y al
 * volver el foco; si pasaron más de 120 s desde `generatedAt`, o si el sondeo
 * falla y quedan los datos previos, el tablero se muestra como atrasado. El
 * lector de pantalla se entera **sólo** al entrar o salir de S7 (M1).
 */
@Component({
  selector: 'app-bed-board',
  imports: [AppButton, AppButtonLink, Badge, BedActions, BedPanel, BedTile, Card, DataTable, DrawerPanel, FilterBar, PageHeader, RouterLink, SegmentedControl, Tab, Tabs, ViewStateHost],
  templateUrl: './bed-board.html',
  styleUrl: './bed-board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedBoard {
  private readonly ops = inject(InfrastructureOpsClient);
  private readonly infra = inject(InfrastructureClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly access = inject(InpatientAccessStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly views = VIEWS;
  protected readonly legend = LEGEND;
  protected readonly cleaningRoute = CLEANING_ROUTE;
  protected readonly admissionRoute = ADMISSION_NEW_ROUTE;
  protected readonly countsOf = countsOf;
  protected readonly unitKey = unitKey;
  protected readonly badgeOf = badgeOf;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly now = signal(Date.now());

  /** La sede: la de la URL si la persona tiene rol ahí; si no, la primera. */
  protected readonly site = computed(() => this.access.pickSite(this.query().get('site'), 'f2.board.read'));
  protected readonly siteId = computed(() => this.site()?.siteId ?? null);
  protected readonly timeZone = computed(() => this.site()?.timeZone ?? DEFAULT_TIME_ZONE);

  /** S1 hasta saber qué puede la persona; S5 si no tiene rol operativo en ninguna sede. */
  protected readonly gate = computed<ViewState<string>>(() => {
    const a = this.access.state();
    if (a.status !== 'ready') return a as ViewState<string>;
    const s = this.site();
    return s === null
      ? forbidden({ message: 'Su cuenta no tiene un rol operativo (enfermería, admisión, limpieza o mantenimiento) en ningún establecimiento de esta organización.' })
      : ready(s.siteId);
  });

  /** Sólo las claves que filtran (M8): la pestaña, la vista o la cama elegida no recargan. */
  protected readonly queryKey = computed<string | null>(() => {
    const id = this.siteId();
    if (id === null) return null;
    const q = this.query();
    return JSON.stringify([id, ...FILTER_KEYS.map((k) => q.get(k))]);
  });

  private readonly requests = new Subject<{ readonly key: string }>();
  private readonly loaded = signal<Loaded | null>(null);
  private readonly lastGood = signal<{ readonly key: string; readonly data: BedBoardData } | null>(null);
  private readonly structure = signal<readonly CareSpaceNode[]>([]);

  private readonly board = computed<ViewState<BedBoardData>>(() => {
    const l = this.loaded();
    return l !== null && l.key === this.queryKey() ? l.state : loading();
  });
  private readonly good = computed(() => {
    const g = this.lastGood();
    return g !== null && g.key === this.queryKey() ? g.data : null;
  });

  protected readonly view = computed<BoardView>(() => (this.query().get('view') === 'list' ? 'list' : 'grid'));
  protected readonly selectedId = signal<string | null>(null);

  protected readonly data = computed(() => dataOf(this.board()) ?? this.good());
  protected readonly units = computed(() => this.data()?.units ?? []);
  protected readonly allCells = computed(() => this.units().flatMap((u) => u.cells));
  protected readonly selected = computed(() => this.allCells().find((c) => c.id === this.selectedId()) ?? null);

  protected readonly tabIndex = computed(() => {
    const i = this.units().findIndex((u) => unitKey(u) === this.query().get('unit'));
    return i === -1 ? 0 : i;
  });

  protected readonly freshness = computed(() => relativeAge(this.data()?.generatedAt, this.now()) ?? '—');

  protected readonly boardState = computed<ViewState<BedBoardData>>(() => {
    const b = this.board();
    const last = this.good();
    if ((b.status === 'offline' || b.status === 'error') && last !== null) return stale(last, new Date(last.generatedAt));
    if (b.status === 'loading' && last !== null) return ready(last);
    if (b.status !== 'ready') return b;
    if (this.now() - Date.parse(b.data.generatedAt) > STALE_AFTER_MS) return stale(b.data, new Date(b.data.generatedAt));
    if (b.data.units.length === 0) {
      const filtrado = FILTER_KEYS.some((k) => this.query().get(k));
      return filtrado
        ? empty({ label: 'Quitar los filtros', route: '/inpatient/bed-board', queryParams: { site: b.data.siteId } }, 'Ninguna cama coincide con los filtros.')
        : empty(
            { label: 'Crear camas', route: '/administration/medical-organization/spaces/bulk', queryParams: { site: b.data.siteId } },
            'Esta unidad no tiene camas. Quien administra la estructura puede darlas de alta en bloque.',
          );
    }
    return b;
  });

  /** M1: el texto del aviso cambia sólo al entrar o salir de S7. */
  private readonly isStale = computed(() => this.boardState().status === 'stale');
  private readonly wasStale = signal(false);
  protected readonly staleAnnouncement = computed(() =>
    this.isStale() ? 'El tablero muestra datos atrasados.' : this.wasStale() ? 'El tablero volvió a estar al día.' : '',
  );

  protected readonly filters = computed(() =>
    boardFilters(this.access.sites().filter((s) => this.access.actionsIn(s).includes('f2.board.read')), this.structure(), this.allCells()),
  );

  private readonly cellCode = viewChild<TemplateRef<{ $implicit: BoardRow }>>('cellCode');
  private readonly cellStatus = viewChild<TemplateRef<{ $implicit: BoardRow }>>('cellStatus');

  protected readonly columns = computed<readonly ColumnDef<BoardRow>[]>(() => [
    { key: 'code', header: 'Cama', priority: 1, cell: this.cellCode() },
    { key: 'v2Code', header: 'Estado', priority: 1, cell: this.cellStatus() },
    { key: 'availability', header: 'Disponibilidad', priority: 2 },
    { key: 'hygiene', header: 'Higiene', priority: 2 },
    { key: 'isolation', header: 'Aislamiento', priority: 3 },
    { key: 'patient', header: 'Paciente', priority: 3 },
    { key: 'age', header: 'Último cambio', priority: 4 },
  ]);

  /** Las filas de la lista, por unidad: texto ya escrito, la celda original al lado. */
  protected readonly rows = computed<ReadonlyMap<string, ViewState<readonly BoardRow[]>>>(() => {
    const ahora = this.now();
    const tz = this.timeZone();
    return new Map(
      this.units().map((u) => [
        unitKey(u),
        u.cells.length === 0
          ? empty({ label: 'Quitar los filtros', route: '/inpatient/bed-board' }, 'Ninguna cama de esta unidad coincide con los filtros.')
          : ready(u.cells.map((c) => toRow(c, ahora, tz))),
      ]),
    );
  });

  protected readonly byId = (c: { readonly id: string }): string => c.id;
  protected readonly tile = (c: BedBoardCell) => cellToTile(c, this.now(), this.timeZone());

  constructor() {
    this.access.ensure();
    const destroyRef = inject(DestroyRef);

    this.requests
      .pipe(
        switchMap(({ key }) => {
          const [siteId, location, fn, v2] = JSON.parse(key) as [string, string | null, string | null, string | null];
          return this.ops.getBedBoard(siteId, { parentSpaceId: location, functionCodes: fn ? [fn] : [], v2Codes: v2 ? [v2 as V2Code] : [] }).pipe(
            map((b) => ready(b) as ViewState<BedBoardData>),
            catchError((e: unknown) => of(errorToViewState<BedBoardData>(e))),
            map((state) => ({ key, state })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.loaded.set(r);
        if (r.state.status === 'ready') this.lastGood.set({ key: r.key, data: r.state.data });
        else if (r.state.status !== 'offline' && r.state.status !== 'error') this.lastGood.set(null);
        this.now.set(Date.now());
      });

    effect(() => {
      const key = this.queryKey();
      if (key === null) return;
      untracked(() => this.load(key, false));
    });
    effect(() => {
      if (this.isStale()) untracked(() => this.wasStale.set(true));
    });

    toObservable(this.siteId)
      .pipe(
        switchMap((id) => (id === null ? of(null) : this.infra.getStructure(id).pipe(catchError(() => of(null))))),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.structure.set(s?.spaces ?? []));

    if (this.isBrowser) {
      const reloj = setInterval(() => this.now.set(Date.now()), CLOCK_TICK_MS);
      const sondeo = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
      const alVolver = () => this.refresh();
      window.addEventListener('focus', alVolver);
      destroyRef.onDestroy(() => {
        clearInterval(reloj);
        clearInterval(sondeo);
        window.removeEventListener('focus', alVolver);
      });
    }
  }

  protected refresh(): void {
    const key = this.queryKey();
    if (key !== null) this.load(key, true);
  }

  protected selectTab(i: number): void {
    const u = this.units()[i];
    this.navigate({ unit: u === undefined ? null : unitKey(u) });
  }

  protected setView(v: BoardView): void {
    this.navigate({ view: v === 'grid' ? null : v });
  }

  protected openCell(c: BedBoardCell): void {
    this.selectedId.set(c.id);
  }

  protected closePanel(): void {
    this.selectedId.set(null);
  }

  private navigate(params: Record<string, string | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Un pedido silencioso (sondeo) no tapa el dato bueno de la misma consulta con un «cargando». */
  private load(key: string, silent: boolean): void {
    const g = this.lastGood();
    if (g !== null && g.key !== key) this.lastGood.set(null);
    if (!silent || this.good() === null) this.loaded.set({ key, state: loading() });
    this.requests.next({ key });
  }
}
