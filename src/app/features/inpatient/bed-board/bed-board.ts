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
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { V2_LABEL, V2_RULES } from '../../../core/data-access/infrastructure-ops/bed-status-v2';
import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { BedBoard as BedBoardData, BedBoardCell, BedBoardUnit, V2Code } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
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
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DrawerPanel } from '../../../shared/components/organisms/drawer-panel/drawer-panel';
import { FilterBar, type FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { BedActions } from '../bed-actions/bed-actions';
import { InpatientAccessStore } from '../inpatient-access.store';
import { ADMISSION_NEW_ROUTE, CLEANING_ROUTE, POLL_INTERVAL_MS, STALE_AFTER_MS, cellToTile, relativeAge, shortDateTime } from '../inpatient-presentation';
import { BedPanel } from './bed-panel';

type View = 'grid' | 'list';

/** Una fila de la vista de lista. */
export interface BoardRow {
  readonly id: string;
  readonly code: string;
  readonly v2Code: V2Code;
  readonly statusLabel: string;
  readonly availability: string;
  readonly hygiene: string;
  readonly isolation: string;
  readonly patient: string;
  readonly age: string;
  readonly cell: BedBoardCell;
}

function toRow(c: BedBoardCell, now: number): BoardRow {
  const t = cellToTile(c, now);
  return {
    id: c.id,
    code: c.code,
    v2Code: c.v2Code,
    statusLabel: t.statusLabel,
    availability: t.reason ?? c.availability.display,
    hygiene: c.hygiene.display + (c.hygiene.terminalRequired ? ' · terminal' : ''),
    isolation: t.isolation ?? 'Sin aislamiento',
    patient: t.patient ?? '—',
    age: t.age ?? '—',
    cell: c,
  };
}
const VIEWS: readonly SegmentedOption<View>[] = [
  { value: 'grid', label: 'Grilla' },
  { value: 'list', label: 'Lista' },
];

const COUNT_LABELS: readonly [keyof BedBoardUnit['counts'], string][] = [
  ['assignable', 'Asignables'],
  ['occupied', 'Ocupadas'],
  ['reserved', 'Reservadas'],
  ['blocked', 'Bloqueadas'],
  ['maintenance', 'Mantenimiento'],
  ['dirty', 'Sucias'],
  ['cleaning', 'Limpiando'],
  ['isolation', 'Aislamiento'],
  ['contaminated', 'Contaminadas'],
];

/**
 * **Tablero de camas** — `/inpatient/bed-board` (F2.4).
 *
 * Una pestaña por unidad con recuentos **derivados** por la API, grilla ⇄
 * lista, filtros en la URL, leyenda fija y un panel lateral por cama con sus
 * acciones (F2) y las de internación (F3, slot `adtActions`).
 *
 * ## Antigüedad del dato (S7)
 *
 * «Actualizado hace N s» está siempre a la vista. Se sondea cada 30 s y al
 * volver el foco; si pasaron más de 120 s desde `generatedAt`, o si el sondeo
 * falla y quedan los datos previos, el tablero se muestra como atrasado.
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
  protected readonly countLabels = COUNT_LABELS;
  protected readonly legend = V2_RULES.map((r) => ({ code: r.code, label: V2_LABEL[r.code], rule: r.rule }));
  protected readonly cleaningRoute = CLEANING_ROUTE;
  protected readonly admissionRoute = ADMISSION_NEW_ROUTE;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly now = signal(Date.now());

  /** La sede: la de la URL si la persona tiene rol ahí; si no, la primera. */
  protected readonly site = computed(() => this.access.pickSite(this.query().get('site'), 'board.view'));
  protected readonly siteId = computed(() => this.site()?.siteId ?? null);

  /** S1 hasta saber qué puede la persona; S5 si no tiene rol operativo en ninguna sede. */
  protected readonly gate = computed<ViewState<string>>(() => {
    const a = this.access.state();
    if (a.status !== 'ready') return a as ViewState<string>;
    const s = this.site();
    return s === null
      ? forbidden({ message: 'Su cuenta no tiene un rol operativo (enfermería, admisión, limpieza o mantenimiento) en ningún establecimiento de esta organización.' })
      : ready(s.siteId);
  });

  private readonly board = signal<ViewState<BedBoardData>>(loading());
  private readonly lastGood = signal<BedBoardData | null>(null);
  private readonly structure = signal<readonly CareSpaceNode[]>([]);

  protected readonly view = computed<View>(() => (this.query().get('view') === 'list' ? 'list' : 'grid'));
  protected readonly selectedId = signal<string | null>(null);

  protected readonly data = computed(() => dataOf(this.board()) ?? this.lastGood());
  protected readonly units = computed(() => this.data()?.units ?? []);
  protected readonly allCells = computed(() => this.units().flatMap((u) => u.cells));
  protected readonly selected = computed(() => this.allCells().find((c) => c.id === this.selectedId()) ?? null);

  protected readonly tabIndex = computed(() => {
    const i = this.units().findIndex((u) => u.unitId === this.query().get('unit'));
    return i === -1 ? 0 : i;
  });

  protected readonly freshness = computed(() => relativeAge(this.data()?.generatedAt, this.now()) ?? '—');

  protected readonly boardState = computed<ViewState<BedBoardData>>(() => {
    const b = this.board();
    const last = this.lastGood();
    if ((b.status === 'offline' || b.status === 'error') && last !== null) return stale(last, new Date(last.generatedAt));
    if (b.status === 'loading' && last !== null) return ready(last);
    if (b.status !== 'ready') return b;
    if (this.now() - Date.parse(b.data.generatedAt) > STALE_AFTER_MS) return stale(b.data, new Date(b.data.generatedAt));
    if (b.data.units.length === 0) {
      const filtrado = ['location', 'fn', 'v2'].some((k) => this.query().get(k));
      return filtrado
        ? empty({ label: 'Quitar los filtros', route: '/inpatient/bed-board', queryParams: { site: b.data.siteId } }, 'Ninguna cama coincide con los filtros.')
        : empty(
            { label: 'Crear camas', route: '/administration/medical-organization/spaces/bulk', queryParams: { site: b.data.siteId } },
            'Esta unidad no tiene camas. Quien administra la estructura puede darlas de alta en bloque.',
          );
    }
    return b;
  });

  protected readonly filters = computed<readonly FilterDef[]>(() => {
    const sitios = this.access.sites().filter((s) => s.actions.includes('board.view'));
    const espacios = this.structure();
    const spacesById = new Map(espacios.map((e) => [e.id, e]));
    const camino = (e: CareSpaceNode): string => {
      const partes: string[] = [];
      let x: CareSpaceNode | undefined = e;
      while (x !== undefined && partes.length < 6) {
        partes.unshift(x.name);
        x = x.parentId === null ? undefined : spacesById.get(x.parentId);
      }
      return partes.join(' › ');
    };
    const ubicaciones = espacios
      .filter((e) => ['LOC_FORM_LEVEL', 'LOC_FORM_WARD', 'LOC_FORM_AREA', 'LOC_FORM_WING'].includes(e.form.code))
      .map((e) => ({ value: e.id, label: camino(e) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    const funciones = [...new Map(this.allCells().map((c) => [c.function.code, c.function.display])).entries()].map(([value, label]) => ({ value, label }));
    return [
      ...(sitios.length > 1 ? [{ key: 'site', label: 'Establecimiento', options: sitios.map((s) => ({ value: s.siteId, label: s.name })) }] : []),
      { key: 'location', label: 'Piso o sala', placeholder: 'Todo el establecimiento', options: ubicaciones },
      { key: 'fn', label: 'Función', placeholder: 'Todas', options: funciones },
      { key: 'v2', label: 'Estado', placeholder: 'Todos', options: V2_RULES.map((r) => ({ value: r.code, label: `${r.code} · ${V2_LABEL[r.code]}` })) },
    ];
  });

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
    return new Map(
      this.units().map((u) => [
        u.unitId,
        u.cells.length === 0
          ? empty({ label: 'Quitar los filtros', route: '/inpatient/bed-board' }, 'Ninguna cama de esta unidad coincide con los filtros.')
          : ready(u.cells.map((c) => toRow(c, ahora))),
      ]),
    );
  });

  protected readonly byId = (c: { readonly id: string }): string => c.id;
  protected readonly tile = (c: BedBoardCell) => cellToTile(c, this.now());
  protected readonly when = shortDateTime;

  constructor() {
    this.access.ensure();
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const id = this.siteId();
      const q = this.query();
      if (id === null) return;
      const filtros = { location: q.get('location'), fn: q.get('fn'), v2: q.get('v2') };
      untracked(() => this.load(id, filtros, false));
    });

    effect(() => {
      const id = this.siteId();
      if (id === null) return;
      untracked(() =>
        this.infra
          .getStructure(id)
          .pipe(catchError(() => of(null)))
          .subscribe((s) => this.structure.set(s?.spaces ?? [])),
      );
    });

    if (this.isBrowser) {
      const reloj = setInterval(() => this.now.set(Date.now()), 1000);
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
    const id = this.siteId();
    if (id === null) return;
    const q = this.query();
    this.load(id, { location: q.get('location'), fn: q.get('fn'), v2: q.get('v2') }, true);
  }

  protected selectTab(i: number): void {
    this.navigate({ unit: this.units()[i]?.unitId ?? null });
  }

  protected setView(v: View): void {
    this.navigate({ view: v === 'grid' ? null : v });
  }

  protected openCell(c: BedBoardCell): void {
    this.selectedId.set(c.id);
  }

  protected closePanel(): void {
    this.selectedId.set(null);
  }

  protected countsOf(u: BedBoardUnit): { label: string; value: number }[] {
    return COUNT_LABELS.map(([k, label]) => ({ label, value: u.counts[k] }));
  }

  private navigate(params: Record<string, string | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  private load(siteId: string, f: { location: string | null; fn: string | null; v2: string | null }, silent: boolean): void {
    if (!silent || this.lastGood() === null) this.board.set(loading());
    this.ops
      .getBedBoard(siteId, {
        parentSpaceId: f.location,
        functionCodes: f.fn ? [f.fn] : [],
        v2Codes: f.v2 ? [f.v2 as V2Code] : [],
      })
      .pipe(
        map((b) => ready(b) as ViewState<BedBoardData>),
        catchError((e: unknown) => of(errorToViewState<BedBoardData>(e))),
      )
      .subscribe((s) => {
        this.board.set(s);
        if (s.status === 'ready') this.lastGood.set(s.data);
        else if (s.status !== 'offline' && s.status !== 'error') this.lastGood.set(null);
        this.now.set(Date.now());
      });
  }
}
