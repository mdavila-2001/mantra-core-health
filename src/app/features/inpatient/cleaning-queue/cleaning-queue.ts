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
import { ActivatedRoute, Router } from '@angular/router';
import { fromEvent, interval, map, merge, type Observable } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import { opsErrorToViewState, readOpsError } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.errors';
import {
  ageLabel,
  BOARD_POLL_INTERVAL_MS,
  BOARD_STALE_AFTER_SECONDS,
  CLEANING_PRIORITY_LABEL,
  CLEANING_STATUS_LABEL,
  CLEANING_TRIGGER_LABEL,
  CLEANING_TYPE_LABEL,
  isTerminal,
  minutesSince,
  offerCleaningActions,
  secondsSince,
  sortCleaningQueue,
  type CleaningActionCode,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import { OpsSiteDirectory, type OpsSiteOption } from '../../../core/data-access/infrastructure-ops/infrastructure-ops-sites';
import type {
  CleaningOrder,
  CleaningOrderList,
  CleaningPriority,
  CleaningStatus,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { empty, loading, ready, routeAuthPending } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { OpsIssueAlert } from '../ops-issue-alert/ops-issue-alert';
import { CleaningOrderDialog } from './cleaning-order-dialog';

const ICON_OF: Readonly<Record<CleaningActionCode, RowAction['icon']>> = {
  assign: 'people',
  start: 'clock',
  finish: 'check',
  'inspect-pass': 'check-circle',
  'inspect-fail': 'close',
  cancel: 'remove',
};

const PRIORITY_TONE: Readonly<Record<CleaningPriority, BadgeVariant>> = {
  CLN_PRIO_STAT: 'error',
  CLN_PRIO_URGENT: 'warning',
  CLN_PRIO_ROUTINE: 'secondary',
};

const STATUS_OPTIONS: readonly SelectOption<string>[] = [
  { value: '', label: 'Abiertas' },
  { value: 'CLN_PENDING', label: 'Pendientes' },
  { value: 'CLN_IN_PROGRESS', label: 'En curso' },
  { value: 'CLN_DONE', label: 'Por inspeccionar' },
  { value: 'CLN_INSPECTED', label: 'Inspeccionadas' },
  { value: 'CLN_REJECTED', label: 'Rechazadas' },
  { value: 'CLN_CANCELLED', label: 'Canceladas' },
];

const PRIORITY_OPTIONS: readonly SelectOption<string>[] = [
  { value: '', label: 'Todas las prioridades' },
  { value: 'CLN_PRIO_STAT', label: 'Inmediata' },
  { value: 'CLN_PRIO_URGENT', label: 'Urgente' },
  { value: 'CLN_PRIO_ROUTINE', label: 'Rutina' },
];

/**
 * **Cola de limpieza** — `/inpatient/cleaning`.
 *
 * Las órdenes de limpieza de un establecimiento, **sin una sola columna de
 * paciente**: prioridad, cama, tipo (la terminal, resaltada), estado,
 * antigüedad desde el pedido y quién la tiene. Cada fila ofrece solo la
 * transición válida para su estado y para el rol de quien mira:
 * tomar → iniciar → terminar → aprobar o rechazar la inspección.
 *
 * ## Dos personas, una orden
 *
 * Cada transición viaja con `If-Match` (la versión de la orden): si otra
 * persona la movió primero, la API responde 412 o 409 y la cola lo dice y se
 * vuelve a leer; gana la primera. La inspección la hace alguien distinto de
 * quien terminó, y la terminal solo supervisión — la pantalla no ofrece lo que
 * ya sabe que no va, y la API lo exige igual.
 *
 * ## Frescura
 *
 * Mismo criterio que el tablero: sondeo cada 30 s y al volver el foco; con el
 * dato de más de 120 s, o con el sondeo caído, se muestra «Dato de hace N min ·
 * Reintentar».
 */
@Component({
  selector: 'app-cleaning-queue',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    CleaningOrderDialog,
    DataTable,
    OpsIssueAlert,
    PageHeader,
    RowActions,
    Select,
    Switch,
  ],
  templateUrl: './cleaning-queue.html',
  styleUrl: './cleaning-queue.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CleaningQueue {
  private readonly client = inject(InfrastructureOpsClient);
  private readonly directory = inject(OpsSiteDirectory);
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly priorityCell = viewChild.required<TemplateRef<{ $implicit: CleaningOrder }>>('priorityCell');
  private readonly bedCell = viewChild.required<TemplateRef<{ $implicit: CleaningOrder }>>('bedCell');
  private readonly typeCell = viewChild.required<TemplateRef<{ $implicit: CleaningOrder }>>('typeCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: CleaningOrder }>>('statusCell');
  private readonly ageCell = viewChild.required<TemplateRef<{ $implicit: CleaningOrder }>>('ageCell');
  private readonly assignedCell = viewChild.required<TemplateRef<{ $implicit: CleaningOrder }>>('assignedCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: CleaningOrder }>>('actionsCell');

  protected readonly now = signal(new Date());
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly sites = signal<readonly OpsSiteOption[]>([]);
  private readonly sitesLoaded = signal(false);
  private readonly fatal = signal<ViewState<never> | null>(null);

  protected readonly siteId = computed(() => {
    const wanted = this.params().get('site');
    return this.sites().find((s) => s.id === wanted)?.id ?? wanted ?? this.sites()[0]?.id ?? '';
  });
  protected readonly status = computed(() => this.params().get('status') ?? '');
  protected readonly priority = computed(() => this.params().get('priority') ?? '');
  protected readonly mine = computed(() => this.params().get('mine') === '1');

  private readonly reading = signal<CleaningOrderList | null>(null);
  private readonly pollFailed = signal(false);
  protected readonly pollFailedFlag = this.pollFailed.asReadonly();
  protected readonly refreshing = signal(false);
  protected readonly actionError = signal<ViewState<unknown> | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly busyId = signal<string | null>(null);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  protected readonly siteOptions = computed<readonly SelectOption<string>[]>(() =>
    this.sites().map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
  );

  protected readonly viewer = computed(() => this.reading()?.viewer);
  protected readonly me = computed(() => this.viewer()?.userId ?? this.session.userId());
  protected readonly canCreate = computed(() => this.viewer()?.actions.includes('create-cleaning') === true);
  protected readonly ageSeconds = computed(() => {
    const r = this.reading();
    return r === null ? 0 : secondsSince(r.generatedAt, this.now());
  });
  protected readonly isStale = computed(() => this.reading() !== null && (this.pollFailed() || this.ageSeconds() > BOARD_STALE_AFTER_SECONDS));
  protected readonly freshness = computed(() => {
    const r = this.reading();
    return r === null ? '' : ageLabel(r.generatedAt, this.now());
  });
  protected readonly ageMinutes = computed(() => Math.max(1, Math.round(this.ageSeconds() / 60)));

  protected readonly rows = computed<ViewState<readonly CleaningOrder[]>>(() => {
    const r = this.reading();
    if (r === null) {
      const f = this.fatal();
      if (f !== null) return f;
      if (!this.session.isAuthenticated()) return routeAuthPending();
      return loading();
    }
    if (r.items.length === 0) {
      return empty(
        { label: 'Ver el tablero de camas', route: '/inpatient/bed-board' },
        this.status() === '' ? 'Sin limpiezas pendientes.' : 'Ninguna orden coincide con ese estado.',
      );
    }
    return ready(sortCleaningQueue(r.items));
  });

  protected readonly columns = computed<readonly ColumnDef<CleaningOrder>[]>(() => [
    { key: 'priority', header: 'Prioridad', priority: 1, cell: this.priorityCell() },
    { key: 'bed', header: 'Cama', priority: 1, cell: this.bedCell() },
    { key: 'type', header: 'Tipo', priority: 1, cell: this.typeCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'age', header: 'Pedida', priority: 2, cell: this.ageCell() },
    { key: 'assigned', header: 'Asignada a', priority: 2, cell: this.assignedCell() },
    { key: 'actions', header: 'Acciones', priority: 1, accion: true, cell: this.actionsCell() },
  ]);
  protected readonly trackBy = (o: CleaningOrder): string => o.id;
  protected readonly rowLabel = (o: CleaningOrder): string => `Orden de limpieza de ${o.careSpace.code}`;

  protected readonly priorityText = (o: CleaningOrder): string => CLEANING_PRIORITY_LABEL[o.priority];
  protected readonly priorityTone = (o: CleaningOrder): BadgeVariant => PRIORITY_TONE[o.priority];
  protected readonly typeText = (o: CleaningOrder): string => CLEANING_TYPE_LABEL[o.cleaningType];
  protected readonly statusText = (o: CleaningOrder): string => CLEANING_STATUS_LABEL[o.status];
  protected readonly triggerText = (o: CleaningOrder): string => CLEANING_TRIGGER_LABEL[o.trigger] ?? o.trigger;
  protected readonly isTerminal = isTerminal;
  protected readonly age = (o: CleaningOrder): string => `hace ${minutesSince(o.requestedAt, this.now())} min`;

  /**
   * Las transiciones que se ofrecen en cada fila, ya como acciones de `app-row-actions`.
   * Se calculan una vez por lectura: la tabla las recibe en cada ciclo de detección y
   * un arreglo nuevo por llamada sería un cambio por ciclo.
   */
  protected readonly actionsById = computed<ReadonlyMap<string, readonly RowAction[]>>(() => {
    const viewer = this.viewer();
    const me = this.me();
    return new Map(
      (this.reading()?.items ?? []).map((o) => [
        o.id,
        offerCleaningActions(o, viewer, me).map(
          (a): RowAction => ({
            code: a.code,
            label: a.code === 'assign' ? (o.assignedTo?.id === me ? 'Soltar' : 'Tomar para mí') : a.label,
            icon: ICON_OF[a.code],
            destructive: a.code === 'cancel' || a.code === 'inspect-fail',
          }),
        ),
      ]),
    );
  });
  protected readonly needsSupervision = (o: CleaningOrder): boolean =>
    o.status === 'CLN_DONE' && isTerminal(o) && this.viewer() !== undefined && !this.viewer()!.actions.includes('inspect-terminal');

  constructor() {
    this.directory.sites().subscribe({
      next: (list) => {
        this.sites.set(list);
        this.sitesLoaded.set(true);
      },
      error: (error: unknown) => this.fatal.set(opsErrorToViewState<never>(error)),
    });
    effect(() => {
      const site = this.siteId();
      const key = [this.status(), this.priority(), this.mine()].join('|');
      void key;
      if (site !== '') untracked(() => this.loadOrders());
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
          if (this.siteId() !== '') this.loadOrders();
        });
    }
  }

  protected refresh(): void {
    this.loadOrders();
  }

  private loadOrders(): void {
    const site = this.siteId();
    if (site === '') return;
    this.refreshing.set(true);
    this.client
      .listCleaningOrders(site, {
        ...(this.status() === '' ? {} : { status: this.status() as CleaningStatus }),
        ...(this.priority() === '' ? {} : { priority: this.priority() as CleaningPriority }),
        ...(this.mine() ? { assignedTo: 'me' as const } : {}),
      })
      .subscribe({
        next: (list) => {
          this.refreshing.set(false);
          this.pollFailed.set(false);
          this.fatal.set(null);
          this.now.set(new Date());
          this.reading.set(list);
        },
        error: (error: unknown) => {
          this.refreshing.set(false);
          const status = readOpsError(error)?.status;
          if (this.reading() !== null && status !== 403 && status !== 404) {
            this.pollFailed.set(true);
            return;
          }
          this.reading.set(null);
          this.fatal.set(opsErrorToViewState<never>(error));
        },
      });
  }

  private go(params: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected chooseSite(id: string | null): void {
    this.reading.set(null);
    this.go({ site: id });
  }
  protected chooseStatus(value: string | null): void {
    this.go({ status: value === '' ? null : value });
  }
  protected choosePriority(value: string | null): void {
    this.go({ priority: value === '' ? null : value });
  }
  protected chooseMine(on: boolean): void {
    this.go({ mine: on ? '1' : null });
  }

  protected async act(order: CleaningOrder, code: string): Promise<void> {
    this.actionError.set(null);
    this.notice.set(null);
    const v = order.rowVersion;
    const bed = order.careSpace.code;
    switch (code as CleaningActionCode) {
      case 'assign': {
        const mine = order.assignedTo?.id === this.me();
        this.run(order, this.client.assign(order.id, v, { userId: mine ? null : this.me() }), mine ? `Soltó la orden de ${bed}.` : `Tomó la orden de ${bed}.`);
        break;
      }
      case 'start':
        this.run(order, this.client.start(order.id, v), `Inició la limpieza de ${bed}.`);
        break;
      case 'finish':
        this.run(order, this.client.finish(order.id, v), `Terminó la limpieza de ${bed}: falta la inspección.`);
        break;
      case 'inspect-pass': {
        const ok = await this.dialogs.confirm({
          title: `Aprobar la limpieza de ${bed}`,
          message: isTerminal(order)
            ? 'Es una limpieza terminal: al aprobarla se apaga la bandera y la cama puede asignarse.'
            : 'La cama pasa a inspeccionada y puede asignarse.',
          confirmLabel: 'Aprobar',
        });
        if (ok) this.run(order, this.client.inspect(order.id, v, { result: 'PASS' }), `Aprobada: ${bed} quedó inspeccionada y asignable.`);
        break;
      }
      case 'inspect-fail': {
        const reason = await this.dialogs.confirmWithReason(
          {
            title: `Rechazar la limpieza de ${bed}`,
            message: 'Se abre una orden nueva con prioridad urgente y la cama vuelve a quedar sucia.',
            confirmLabel: 'Rechazar',
            destructive: true,
          },
          { label: 'Qué falló', hint: 'Lo lee quien repita la limpieza.' },
        );
        if (reason !== null) this.run(order, this.client.inspect(order.id, v, { result: 'FAIL', reasonText: reason }), `Rechazada: se abrió una orden nueva para ${bed}.`);
        break;
      }
      case 'cancel': {
        const reason = await this.dialogs.confirmWithReason(
          { title: `Cancelar la orden de ${bed}`, message: 'La cama sigue sucia hasta que se pida otra limpieza.', confirmLabel: 'Cancelar la orden', destructive: true },
          { label: 'Motivo de la cancelación' },
        );
        if (reason !== null) this.run(order, this.client.cancel(order.id, v, { reason }), `Orden de ${bed} cancelada.`);
        break;
      }
    }
  }

  private run(order: CleaningOrder, call: Observable<CleaningOrder>, message: string): void {
    this.busyId.set(order.id);
    call.subscribe({
      next: () => {
        this.busyId.set(null);
        this.notice.set(message);
        this.loadOrders();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.actionError.set(opsErrorToViewState<unknown>(error));
        // Otra persona se adelantó: se lee lo vigente, no lo que se creía.
        this.loadOrders();
      },
    });
  }

  protected afterCreate(): void {
    this.creating.set(false);
    this.notice.set('Orden de limpieza creada.');
    this.loadOrders();
  }

  protected readonly beds = signal<readonly { id: string; code: string; name: string }[]>([]);

  /** Las camas elegibles salen del tablero: el contrato no tiene otra lectura de camas por sede. */
  protected openCreate(): void {
    this.client.getBedBoard(this.siteId()).subscribe({
      next: (board) => {
        this.beds.set(board.units.flatMap((u) => u.cells).map((c) => ({ id: c.id, code: c.code, name: c.name })));
        this.creating.set(true);
      },
      error: (error: unknown) => this.actionError.set(opsErrorToViewState<unknown>(error)),
    });
  }
}
