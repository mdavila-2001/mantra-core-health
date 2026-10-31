import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of, type Observable } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { InfrastructureItemsClient } from '../../../core/data-access/accounting/infrastructure-items.client';
import type { CostCenter, InfrastructureItem } from '../../../core/data-access/accounting/infrastructure-items.types';
import { InfrastructureClient } from '../../../core/data-access/infrastructure/infrastructure.client';
import type { SiteStructure } from '../../../core/data-access/infrastructure/infrastructure.types';
import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { Tree } from '../../../shared/components/organisms/tree/tree';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { arbolDeEspacios } from '../../admin/medical-organization/infraestructura/infraestructura.presentacion';

const TABS = ['assets', 'cost-centers'] as const;
const WRITE_ROLES = ['ACCOUNTING_APPROVER', 'SECURITY_ADMIN'];

/**
 * **Activos y centros de costo por espacio** — F5f (`CONTRATO-F2-F5.md` §F5f).
 *
 * Una tarjeta con dos pestañas (regla 6): los activos de infraestructura con
 * la ruta de su espacio (se ubican eligiendo en el árbol de F1, `app-tree`;
 * la ubicación en texto libre queda como dato heredado) y los centros de
 * costo con su unidad clínica (uno vigente por unidad). Los cargos de día-cama
 * toman el centro de costo de la unidad dueña de la cama.
 */
@Component({
  selector: 'app-infrastructure-accounting',
  imports: [AppButton, Card, DataTable, FormField, PageHeader, Select, Tab, Tabs, Tree, ViewStateHost],
  templateUrl: './infrastructure-accounting.html',
  styleUrl: './infrastructure-accounting.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfrastructureAccounting {
  private readonly client = inject(InfrastructureItemsClient);
  private readonly infrastructure = inject(InfrastructureClient);
  private readonly siteContext = inject(SiteContextStore);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly tab = linkedSignal<number>(() => Math.max(0, TABS.indexOf(this.query().get('tab') as (typeof TABS)[number])));

  private readonly itemsLoaded = signal<ViewState<readonly InfrastructureItem[]>>(loading());
  private readonly centersLoaded = signal<ViewState<readonly CostCenter[]>>(loading());
  private readonly structure = signal<SiteStructure | null>(null);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly saving = signal(false);

  protected readonly locating = signal<InfrastructureItem | null>(null);
  protected readonly chosenSpace = signal<string | null>(null);
  protected readonly linking = signal<CostCenter | null>(null);
  protected readonly chosenUnit = signal<string | null>(null);

  private readonly practiceId = computed(() => dataOf(this.siteContext.state())?.practiceId ?? null);
  protected readonly canWrite = computed(() => WRITE_ROLES.some((r) => this.session.roles().includes(r)));
  protected readonly tree = computed(() => arbolDeEspacios(this.structure()?.spaces ?? []));
  /** Las ramas abiertas al elegir: todas, para ver el espacio sin buscarlo. */
  protected readonly expanded = computed(() => (this.structure()?.spaces ?? []).filter((s) => s.childCount > 0).map((s) => s.id));
  protected readonly unitOptions = computed<readonly SelectOption<string>[]>(() =>
    (this.structure()?.units ?? []).filter((u) => u.status.code !== 'UNIT_RETIRED').map((u) => ({ value: u.id, label: u.name })),
  );

  protected readonly items = computed<ViewState<readonly InfrastructureItem[]>>(() => {
    const ctx = this.siteContext.state();
    if (ctx.status !== 'ready' && ctx.status !== 'stale') return mapData(ctx, () => [] as readonly InfrastructureItem[]);
    const s = this.itemsLoaded();
    return s.status === 'ready' && s.data.length === 0 ? empty({ label: 'Volver a contabilidad', route: '/administration/accounting' }, 'La organización no tiene activos de infraestructura registrados.') : s;
  });

  protected readonly centers = computed<ViewState<readonly CostCenter[]>>(() => {
    const ctx = this.siteContext.state();
    if (ctx.status !== 'ready' && ctx.status !== 'stale') return mapData(ctx, () => [] as readonly CostCenter[]);
    const s = this.centersLoaded();
    return s.status === 'ready' && s.data.length === 0 ? empty({ label: 'Volver a contabilidad', route: '/administration/accounting' }, 'La organización no tiene centros de costo.') : s;
  });

  private readonly itemCell = viewChild.required<TemplateRef<{ $implicit: InfrastructureItem }>>('itemCell');
  private readonly placeCell = viewChild.required<TemplateRef<{ $implicit: InfrastructureItem }>>('placeCell');
  private readonly itemActions = viewChild.required<TemplateRef<{ $implicit: InfrastructureItem }>>('itemActions');
  private readonly centerCell = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('centerCell');
  private readonly unitCell = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('unitCell');
  private readonly centerActions = viewChild.required<TemplateRef<{ $implicit: CostCenter }>>('centerActions');

  protected readonly itemColumns = computed<readonly ColumnDef<InfrastructureItem>[]>(() => [
    { key: 'name', header: 'Activo', priority: 1, cell: this.itemCell() },
    { key: 'careSpace', header: 'Ubicación', priority: 1, cell: this.placeCell() },
    { key: 'bookValue', header: 'Valor (BOB)', priority: 3, align: 'end' },
    ...(this.canWrite() ? [{ key: 'id', header: 'Acciones', priority: 1, cell: this.itemActions(), align: 'end' as const }] : []),
  ]);

  protected readonly centerColumns = computed<readonly ColumnDef<CostCenter>[]>(() => [
    { key: 'name', header: 'Centro de costo', priority: 1, cell: this.centerCell() },
    { key: 'clinicalUnit', header: 'Unidad clínica', priority: 1, cell: this.unitCell() },
    ...(this.canWrite() ? [{ key: 'id', header: 'Acciones', priority: 1, cell: this.centerActions(), align: 'end' as const }] : []),
  ]);

  protected readonly byId = (row: { readonly id: string }): string => row.id;

  constructor() {
    this.siteContext.ensure();
    effect(() => {
      const practiceId = this.practiceId();
      const site = dataOf(this.siteContext.state())?.sites[0];
      if (practiceId === null) return;
      untracked(() => {
        this.load(practiceId);
        if (site !== undefined) this.infrastructure.getStructure(site.id).pipe(catchError(() => of(null))).subscribe((s) => this.structure.set(s));
      });
    });
  }

  protected changeTab(index: number): void {
    this.tab.set(index);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: TABS[index] ?? null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected startLocate(row: InfrastructureItem): void {
    this.linking.set(null);
    this.locating.set(row);
    this.chosenSpace.set(row.careSpace?.id ?? null);
  }

  protected startLink(row: CostCenter): void {
    this.locating.set(null);
    this.linking.set(row);
    this.chosenUnit.set(row.clinicalUnit?.id ?? null);
  }

  protected confirmLocate(): void {
    const row = this.locating();
    const space = this.chosenSpace();
    if (row === null || space === null || this.saving()) return;
    this.run(this.client.locateItem(row.id, space), () => this.locating.set(null));
  }

  protected confirmLink(): void {
    const row = this.linking();
    const unit = this.chosenUnit();
    if (row === null || unit === null || this.saving()) return;
    this.run(this.client.linkUnit(row.id, unit), () => this.linking.set(null));
  }

  protected reload(): void {
    const practiceId = this.practiceId();
    if (practiceId !== null) this.load(practiceId);
  }

  private run(call: Observable<unknown>, done: () => void): void {
    this.saving.set(true);
    this.failure.set(null);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        done();
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }

  private load(practiceId: string): void {
    this.itemsLoaded.set(loading());
    this.centersLoaded.set(loading());
    forkJoin({ items: this.client.listItems(practiceId), centers: this.client.listCostCenters(practiceId) }).subscribe({
      next: ({ items, centers }) => {
        this.itemsLoaded.set(ready(items));
        this.centersLoaded.set(ready(centers));
      },
      error: (error: unknown) => {
        this.itemsLoaded.set(errorToViewState<readonly InfrastructureItem[]>(error));
        this.centersLoaded.set(errorToViewState<readonly CostCenter[]>(error));
      },
    });
  }
}
