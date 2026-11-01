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
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { empty } from '../../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../../core/view-state/view-state.types';
import { UiVisibilityService } from '../../../../../core/visibility/ui-visibility.service';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { FilterForm, type FilterField } from '../../governance/filter-form';
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
    Tab,
    Tabs,
    DataTable,
    PageHeader,
    FilterForm,
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
  /** El motor de visibilidad de esta sesión: un elemento oculto por omisión o retirado cambia lo que se ve. */
  private readonly visibility = inject(UiVisibilityService);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

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

  protected readonly fields = computed<readonly FilterField[]>(() => [
    { key: 'q', label: 'Buscar', kind: 'text', placeholder: 'Clave o nombre' },
    {
      key: 'module',
      label: 'Módulo',
      kind: 'select',
      options: [
        { value: '', label: 'Todos los módulos' },
        ...this.index.modules().map((m) => ({ value: m.code, label: m.label === m.code ? m.code : `${m.label} (${m.code})` })),
      ],
    },
    {
      key: 'kind',
      label: 'Tipo',
      kind: 'select',
      options: [{ value: '', label: 'Todos los tipos' }, ...optionsOf(KINDS, (k) => kindLabel(k).label)],
    },
    {
      key: 'status',
      label: 'Estado',
      kind: 'select',
      options: [
        { value: '', label: 'Todos los estados' },
        { value: 'ACTIVE', label: 'Activos' },
        { value: 'RETIRED', label: 'Retirados del código' },
      ],
    },
  ]);

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

  private readonly elementCell = viewChild.required<TemplateRef<{ $implicit: UiElement }>>('elementCell');
  private readonly kindCell = viewChild.required<TemplateRef<{ $implicit: UiElement }>>('kindCell');
  private readonly stateCell = viewChild.required<TemplateRef<{ $implicit: UiElement }>>('stateCell');
  private readonly rulesCell = viewChild.required<TemplateRef<{ $implicit: UiElement }>>('rulesCell');

  protected readonly columns = computed<readonly ColumnDef<UiElement>[]>(() => [
    { key: 'element', header: 'Elemento', priority: 1, cell: this.elementCell() },
    { key: 'kind', header: 'Tipo', priority: 2, cell: this.kindCell() },
    { key: 'state', header: 'Estado', priority: 2, cell: this.stateCell() },
    { key: 'rules', header: 'Reglas vigentes', priority: 1, align: 'end', cell: this.rulesCell() },
  ]);

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

  protected apply(filters: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, filters);
  }

  protected clear(): void {
    void patchQuery(this.router, this.route, Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));
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
