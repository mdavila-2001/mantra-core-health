import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, type Subscription } from 'rxjs';

import { UiVisibilityAdminClient } from '../../../../../core/data-access/ui-visibility/ui-visibility-admin.client';
import type {
  UiElement,
  UiElementKind,
  UiElementStatus,
  UiElementSyncResult,
} from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { Breakpoints } from '../../../../../core/layout/breakpoints';
import { empty } from '../../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../../core/view-state/view-state.types';
import { UiVisibilityService } from '../../../../../core/visibility/ui-visibility.service';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar, type FilterDef } from '../../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { UiElementIndex } from '../element-index';
import { UI_ELEMENT_DRAFTS } from '../ui-element-drafts.token';
import { VisibilityNotice } from '../visibility-notice';
import {
  KINDS,
  elementStatusLabel,
  kindLabel,
  optionsOf,
  sourceLabel,
  visibilityFailure,
} from '../visibility-labels';
import { ElementFormPanel } from './element-form-panel';

const VIEWS = ['catalog', 'add'] as const;
const FILTER_KEYS = ['q', 'module', 'kind', 'status'] as const;
const PAGE_SIZE = 50;
/** Filas a la vista en el teléfono antes de «Ver los demás». */
const MOBILE_ROWS = 10;
const SCREEN = portalUrl('governance/ui-catalog');
const RULES_SCREEN = portalUrl('governance/ui-rules');

/**
 * Catálogo de visibilidad: cada elemento de la interfaz que puede tener reglas, agrupado por
 * módulo y con su jerarquía (ocultar un padre oculta a sus hijos). Se alimenta del registro del
 * front con «Sincronizar con el código» o a mano con un alta ADMIN. Primero se cataloga, después
 * se regla: un elemento que no está acá no puede tener reglas.
 */
@Component({
  selector: 'app-portal-ui-catalog-page',
  imports: [
    RouterLink,
    AppButton,
    Badge,
    Alert,
    Card,
    MetricCard,
    Tab,
    Tabs,
    DataTable,
    PageHeader,
    FilterBar,
    VisibilityNotice,
    ElementFormPanel,
  ],
  templateUrl: './ui-catalog-page.html',
  styleUrls: ['../visibility-panel.css', './ui-catalog-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiCatalogPage {
  private readonly client = inject(UiVisibilityAdminClient);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly drafts = inject(UI_ELEMENT_DRAFTS);
  protected readonly index = inject(UiElementIndex);
  /** Teléfono: sólo las columnas que se leen de un vistazo; lo demás va dentro de la fila. */
  protected readonly narrow = inject(Breakpoints).isNavDrawer;
  /** El motor de visibilidad de esta sesión: un elemento oculto por omisión o retirado cambia lo que se ve. */
  private readonly visibility = inject(UiVisibilityService);

  private readonly params = queryParamsSignal(this.route);
  protected readonly values = queryFilters(this.params, FILTER_KEYS);
  private readonly view = queryFilters(this.params, ['view']);
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view().view as (typeof VIEWS)[number])),
  );

  protected readonly kind = kindLabel;
  protected readonly source = sourceLabel;
  protected readonly status = elementStatusLabel;
  protected readonly rulesUrl = RULES_SCREEN;
  protected readonly draftCount = this.drafts.length;

  protected readonly syncing = signal(false);
  protected readonly syncResult = signal<UiElementSyncResult | null>(null);
  protected readonly syncError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  /**
   * La barra de filtros escribe cada clave en la URL (`q` el buscador) y la pantalla los lee con
   * `values()`. El módulo se elige con la fila de módulos de abajo, que muestra cuántos tiene cada uno.
   */
  protected readonly filterDefs = computed<readonly FilterDef[]>(() => [
    { key: 'kind', label: 'Tipo', placeholder: 'Todos los tipos', options: optionsOf(KINDS, (k) => kindLabel(k).label) },
    {
      key: 'status',
      label: 'Estado',
      placeholder: 'Todos los estados',
      options: [
        { value: 'ACTIVE', label: 'Activos' },
        { value: 'RETIRED', label: 'Retirados del código' },
      ],
    },
  ]);

  /** Las cifras de la cabecera, del índice que la pantalla ya pide (sin peticiones nuevas). */
  protected readonly totals = computed(() => {
    const all = this.index.elements();
    return {
      ready: this.index.state().status === 'ready' || this.index.state().status === 'stale',
      elements: all.length,
      modules: this.index.modules().length,
      withRules: all.filter((e) => e.activeRuleCount > 0).length,
      retired: all.filter((e) => e.status === 'RETIRED').length,
    };
  });
  /** Mientras el índice no llegó, la cifra es «sin dato», no un cero. */
  protected readonly metric = (n: number): number | null => (this.totals().ready ? n : null);

  protected readonly list = pagedList<UiElement>(
    (cursor) => {
      const v = this.values();
      return this.client
        .listElements({
          ...(v.q === '' ? {} : { q: v.q }),
          ...(v.module === '' ? {} : { module: v.module }),
          ...(KINDS.includes(v.kind as UiElementKind) ? { kind: v.kind as UiElementKind } : {}),
          ...(v.status === 'ACTIVE' || v.status === 'RETIRED' ? { status: v.status as UiElementStatus } : {}),
          limit: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        })
        .pipe(map((page) => ({ items: page.items, nextCursor: page.nextCursor, ...(page.total === null ? {} : { total: page.total }) })));
    },
    () => this.whenEmpty(),
  );

  /**
   * Teléfono: las primeras {@link MOBILE_ROWS} filas y «Ver los demás». Es sólo presentación sobre
   * la página que ya llegó: no cambia la consulta ni el cursor.
   */
  protected readonly showAll = signal(false);
  protected readonly tableState = computed(() => {
    const s = this.list.state();
    if (!this.narrow() || this.showAll() || (s.status !== 'ready' && s.status !== 'stale') || s.data.length <= MOBILE_ROWS) {
      return s;
    }
    return { ...s, data: s.data.slice(0, MOBILE_ROWS) };
  });
  protected readonly foldedRows = computed(() => {
    const s = this.list.state();
    if (!this.narrow() || this.showAll() || (s.status !== 'ready' && s.status !== 'stale')) return 0;
    return Math.max(0, s.data.length - MOBILE_ROWS);
  });

  private readonly elementCell = viewChild.required<TemplateRef<{ $implicit: UiElement }>>('elementCell');
  private readonly kindCell = viewChild.required<TemplateRef<{ $implicit: UiElement }>>('kindCell');
  private readonly stateCell = viewChild.required<TemplateRef<{ $implicit: UiElement }>>('stateCell');
  private readonly rulesCell = viewChild.required<TemplateRef<{ $implicit: UiElement }>>('rulesCell');

  protected readonly columns = computed<readonly ColumnDef<UiElement>[]>(() =>
    this.narrow()
      ? [
          { key: 'element', header: 'Elemento', priority: 1, cell: this.elementCell() },
          { key: 'rules', header: 'Reglas', priority: 1, align: 'end', cell: this.rulesCell() },
        ]
      : [
          { key: 'element', header: 'Elemento', priority: 1, cell: this.elementCell() },
          { key: 'kind', header: 'Tipo', priority: 2, cell: this.kindCell() },
          { key: 'state', header: 'Estado', priority: 2, cell: this.stateCell() },
          { key: 'rules', header: 'Reglas vigentes', priority: 1, align: 'end', cell: this.rulesCell() },
        ],
  );

  protected readonly byId = (row: UiElement): string => row.id;
  protected readonly rowName = (row: UiElement): string => row.label;
  protected readonly pathOfParent = (row: UiElement): string =>
    row.parentKey === null ? 'Nivel superior del módulo' : this.index.path(row.parentKey);
  protected readonly rulesQuery = (row: UiElement): Record<string, string> => ({ element: row.key });

  private pending: Subscription | null = null;

  constructor() {
    this.index.load();
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      this.values();
      untracked(() => this.list.restart());
    });
  }

  protected pickModule(code: string): void {
    void patchQuery(this.router, this.route, { module: this.values().module === code ? null : code });
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { view: index === 0 ? null : VIEWS[index]! });
  }

  protected created(element: UiElement): void {
    this.notice.set(`Se agregó «${element.label}» (${element.key}). Ya se le pueden crear reglas.`);
    this.index.load();
    this.visibility.refresh();
    void patchQuery(this.router, this.route, { view: null, q: element.key, module: null, kind: null, status: null });
  }

  /** Manda el registro del front al servidor. Pide confirmar: lo que ya no llegue pasa a «Retirado». */
  protected async sync(): Promise<void> {
    this.syncResult.set(null);
    this.syncError.set(null);
    this.notice.set(null);
    if (this.drafts.length === 0) {
      this.syncError.set(
        'El registro de la interfaz no declara ningún elemento todavía, así que no se envió nada: un envío vacío retiraría todo lo que viene del código.',
      );
      return;
    }
    const confirmed = await this.dialogs.confirmarCambios({
      title: 'Sincronizar con el código',
      message:
        'Se envía al servidor la lista de elementos que declara la interfaz. Los nuevos se crean, los cambiados se actualizan y los del código que ya no figuren pasan a «Retirado» (sus reglas se conservan).',
      details: [{ label: 'Elementos a enviar', value: String(this.drafts.length) }],
      confirmLabel: 'Sincronizar',
    });
    if (!confirmed) return;
    this.syncing.set(true);
    this.pending = this.client.syncElements(this.drafts).subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.syncResult.set(result);
        this.index.load();
        this.list.restart();
        this.visibility.refresh();
      },
      error: (error: unknown) => {
        this.syncing.set(false);
        this.syncError.set(visibilityFailure(error, 'No se pudo sincronizar con el código.'));
      },
    });
  }

  private whenEmpty(): EmptyViewState {
    const v = this.values();
    if (FILTER_KEYS.some((k) => v[k] !== '')) {
      return empty({ label: 'Quitar los filtros', route: SCREEN }, 'Ningún elemento coincide con los filtros elegidos.');
    }
    return empty(
      { label: 'Agregar un elemento a mano', route: SCREEN, queryParams: { view: 'add' } },
      'El catálogo está vacío. Sincronice con el código para traer los elementos de la interfaz, o agregue uno a mano.',
    );
  }
}
