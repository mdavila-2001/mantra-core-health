import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, PLATFORM_ID, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { CleaningOrder, CleaningOrderPage, CleaningPriorityCode, CleaningTransition } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, forbidden, loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar, type FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { InpatientAccessStore } from '../inpatient-access.store';
import { BED_BOARD_ROUTE, POLL_INTERVAL_MS, STALE_AFTER_MS, relativeAge } from '../inpatient-presentation';
import { NewOrderDialog } from './new-order-dialog';

type Scope = 'all' | 'mine';
const SCOPES: readonly SegmentedOption<Scope>[] = [
  { value: 'all', label: 'Todas' },
  { value: 'mine', label: 'Mías' },
];

const ACTION: Readonly<Record<CleaningTransition, Omit<RowAction, 'code'>>> = {
  assign: { label: 'Tomarla', icon: 'people' },
  start: { label: 'Empezar', icon: 'arrow-right' },
  finish: { label: 'Terminar', icon: 'flag' },
  inspect: { label: 'Inspeccionar', icon: 'shield' },
  cancel: { label: 'Cancelar', icon: 'remove', destructive: true },
};

/**
 * **Cola de limpieza** — `/inpatient/cleaning` (F2.4).
 *
 * Sin columnas de paciente: la API no las manda y la cola no las pide. Cada
 * fila ofrece sólo las transiciones que la API declara para este actor
 * (`allowedTransitions`); quien terminó una limpieza no la inspecciona (la API
 * responde 422 y se muestra). Sondeo cada 30 s, como el tablero.
 */
@Component({
  selector: 'app-cleaning-queue',
  imports: [AppButton, AppButtonLink, Badge, Card, DataTable, FilterBar, NewOrderDialog, PageHeader, RouterLink, RowActions, SegmentedControl, ViewStateHost],
  templateUrl: './cleaning-queue.html',
  styleUrl: './cleaning-queue.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CleaningQueue {
  private readonly client = inject(InfrastructureOpsClient);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly access = inject(InpatientAccessStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly scopes = SCOPES;
  protected readonly boardRoute = BED_BOARD_ROUTE;
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly now = signal(Date.now());

  protected readonly site = computed(() => this.access.pickSite(this.query().get('site'), 'cleaning.view'));
  protected readonly siteId = computed(() => this.site()?.siteId ?? null);
  protected readonly scope = computed<Scope>(() => (this.query().get('scope') === 'mine' ? 'mine' : 'all'));

  protected readonly gate = computed<ViewState<string>>(() => {
    const a = this.access.state();
    if (a.status !== 'ready') return a as ViewState<string>;
    const s = this.site();
    return s === null ? forbidden({ message: 'Su rol no incluye la cola de limpieza de ningún establecimiento de esta organización.' }) : ready(s.siteId);
  });

  private readonly page = signal<ViewState<CleaningOrderPage>>(loading());
  private readonly lastGood = signal<CleaningOrderPage | null>(null);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly working = signal(false);
  protected readonly creating = signal(false);

  protected readonly freshness = computed(() => relativeAge((dataOf(this.page()) ?? this.lastGood())?.generatedAt, this.now()) ?? '—');

  protected readonly rows = computed<ViewState<readonly CleaningOrder[]>>(() => {
    const p = this.page();
    const last = this.lastGood();
    if ((p.status === 'offline' || p.status === 'error') && last !== null) return stale(last.items, new Date(last.generatedAt));
    if (p.status === 'loading' && last !== null) return ready(last.items);
    if (p.status !== 'ready') return p as ViewState<readonly CleaningOrder[]>;
    if (this.now() - Date.parse(p.data.generatedAt) > STALE_AFTER_MS) return stale(p.data.items, new Date(p.data.generatedAt));
    if (p.data.items.length === 0) {
      return empty({ label: 'Ver el tablero de camas', route: BED_BOARD_ROUTE }, this.scope() === 'mine' ? 'No tiene limpiezas asignadas.' : 'Sin limpiezas pendientes.');
    }
    return ready(p.data.items);
  });

  protected readonly filters: readonly FilterDef[] = [
    { key: 'priority', label: 'Prioridad', placeholder: 'Todas', options: [
      { value: 'CLN_PRIO_STAT', label: 'Inmediata' },
      { value: 'CLN_PRIO_URGENT', label: 'Urgente' },
      { value: 'CLN_PRIO_ROUTINE', label: 'Rutina' },
    ] },
  ];

  private readonly cellSpace = viewChild<TemplateRef<{ $implicit: CleaningOrder }>>('cellSpace');
  private readonly cellType = viewChild<TemplateRef<{ $implicit: CleaningOrder }>>('cellType');
  private readonly cellPriority = viewChild<TemplateRef<{ $implicit: CleaningOrder }>>('cellPriority');
  private readonly cellStatus = viewChild<TemplateRef<{ $implicit: CleaningOrder }>>('cellStatus');
  private readonly cellAge = viewChild<TemplateRef<{ $implicit: CleaningOrder }>>('cellAge');
  private readonly cellAssigned = viewChild<TemplateRef<{ $implicit: CleaningOrder }>>('cellAssigned');
  private readonly cellActions = viewChild<TemplateRef<{ $implicit: CleaningOrder }>>('cellActions');

  protected readonly columns = computed<readonly ColumnDef<CleaningOrder>[]>(() => [
    { key: 'careSpaceCode', header: 'Espacio', priority: 1, cell: this.cellSpace() },
    { key: 'type', header: 'Tipo', priority: 1, cell: this.cellType() },
    { key: 'priority', header: 'Prioridad', priority: 2, cell: this.cellPriority() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.cellStatus() },
    { key: 'requestedAt', header: 'Antigüedad', priority: 2, cell: this.cellAge() },
    { key: 'assignedName', header: 'Asignada a', priority: 3, cell: this.cellAssigned() },
    { key: 'id', header: 'Acciones', priority: 1, align: 'end', accion: true, cell: this.cellActions() },
  ]);

  protected readonly byId = (o: CleaningOrder): string => o.id;
  protected readonly ago = (iso: string | null): string => relativeAge(iso, this.now()) ?? '—';
  protected actionsOf(o: CleaningOrder): RowAction[] {
    return o.allowedTransitions.map((t) => ({ code: t, ...ACTION[t] }));
  }

  constructor() {
    this.access.ensure();
    effect(() => {
      const id = this.siteId();
      const q = this.query();
      if (id === null) return;
      untracked(() => this.load(id, q.get('priority') as CleaningPriorityCode | null, q.get('scope') === 'mine', false));
    });
    if (this.isBrowser) {
      const reloj = setInterval(() => this.now.set(Date.now()), 1000);
      const sondeo = setInterval(() => this.refresh(), POLL_INTERVAL_MS);
      const alVolver = () => this.refresh();
      window.addEventListener('focus', alVolver);
      inject(DestroyRef).onDestroy(() => {
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
    this.load(id, q.get('priority') as CleaningPriorityCode | null, q.get('scope') === 'mine', true);
  }

  protected setScope(s: Scope): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { scope: s === 'all' ? null : s }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected async act(o: CleaningOrder, t: string): Promise<void> {
    this.failure.set(null);
    let call;
    switch (t as CleaningTransition) {
      case 'assign':
        call = this.client.assignCleaningOrder(o.id, o.rowVersion, this.access.state().status === 'ready' ? (dataOf(this.access.state())?.userId ?? null) : null);
        break;
      case 'start':
        call = this.client.startCleaningOrder(o.id, o.rowVersion);
        break;
      case 'finish': {
        const ok = await this.dialogs.confirm({ title: 'Terminar la limpieza', message: `${o.careSpaceName} pasa a «limpia». ${o.inspectionRequired ? 'Después la inspecciona otra persona.' : ''}`, confirmLabel: 'Terminar' });
        if (!ok) return;
        call = this.client.finishCleaningOrder(o.id, o.rowVersion);
        break;
      }
      case 'inspect':
        call = await this.inspect(o);
        if (call === null) return;
        break;
      case 'cancel': {
        const reason = await this.dialogs.confirmWithReason(
          { title: 'Cancelar la orden', message: `La orden de ${o.careSpaceName} queda cancelada. El espacio sigue sucio.`, confirmLabel: 'Cancelar la orden', destructive: true },
          { label: 'Motivo', minLength: 3, maxLength: 300 },
        );
        if (reason === null) return;
        call = this.client.cancelCleaningOrder(o.id, o.rowVersion, reason);
        break;
      }
      default:
        return;
    }
    this.working.set(true);
    call.subscribe({
      next: () => {
        this.working.set(false);
        this.refresh();
      },
      error: (e: unknown) => {
        this.working.set(false);
        this.failure.set(errorToViewState<never>(e));
        this.refresh();
      },
    });
  }

  /** Aprobar con confirmación; rechazar exige el reason (422 si falta). */
  private async inspect(o: CleaningOrder) {
    const aprobar = await this.dialogs.confirm({
      title: `Inspeccionar ${o.careSpaceName}`,
      message: `Limpieza ${o.type.display.toLowerCase()} terminada por ${o.finishedByName ?? 'otra persona'}. ¿Queda aprobada?`,
      confirmLabel: 'Aprobar',
      cancelLabel: 'Rechazar…',
    });
    if (aprobar) return this.client.inspectCleaningOrder(o.id, o.rowVersion, 'PASS');
    const reason = await this.dialogs.confirmWithReason(
      { title: 'Rechazar la inspección', message: 'Se crea una orden nueva y el espacio vuelve a «sucio».', confirmLabel: 'Rechazar', destructive: true },
      { label: 'Qué falta', minLength: 5, maxLength: 300 },
    );
    return reason === null ? null : this.client.inspectCleaningOrder(o.id, o.rowVersion, 'FAIL', reason);
  }

  protected afterCreate(): void {
    this.creating.set(false);
    this.refresh();
  }

  private load(siteId: string, priority: CleaningPriorityCode | null, mine: boolean, silent: boolean): void {
    if (!silent || this.lastGood() === null) this.page.set(loading());
    this.client
      .listCleaningOrders(siteId, { priority, assignedTo: mine ? 'me' : null })
      .pipe(
        map((p) => ready(p) as ViewState<CleaningOrderPage>),
        catchError((e: unknown) => of(errorToViewState<CleaningOrderPage>(e))),
      )
      .subscribe((s) => {
        this.page.set(s);
        if (s.status === 'ready') this.lastGood.set(s.data);
        else if (s.status !== 'offline' && s.status !== 'error') this.lastGood.set(null);
        this.now.set(Date.now());
      });
  }
}
