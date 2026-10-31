import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { OperatingRoomsClient } from '../../../core/data-access/operating-rooms/operating-rooms.client';
import { canManageBlocks } from '../../../core/data-access/operating-rooms/operating-rooms.rules';
import type { OperatingRoomSummary, OrBlock } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, forbidden, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { dateTimeOf, durationOf, localDay, shiftDay, shortDateOf, timeOf } from '../interventions.presentation';
import { BlockForm } from './block-form';

const TABS = ['week', 'new'] as const;

const STATUS: Readonly<Record<OrBlock['status'], { label: string; variant: 'success' | 'secondary' | 'error' }>> = {
  ORB_ACTIVE: { label: 'Vigente', variant: 'success' },
  ORB_RELEASED: { label: 'Liberado', variant: 'secondary' },
  ORB_CANCELLED: { label: 'Cancelado', variant: 'error' },
};

/** El lunes de la semana del día dado. */
function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  const offset = (d.getDay() + 6) % 7;
  return shiftDay(day, -offset);
}

/**
 * **Bloques de quirófano** — `/interventions/blocks` (F4).
 *
 * Una tarjeta con dos pestañas: los bloques de la semana (con su uso, su
 * plazo de liberación y sus casos) y el alta de un bloque o de una serie
 * semanal. Liberar o cancelar pide motivo (`confirmWithReason`) y viaja con
 * `If-Match`: si alguien programó un caso en el medio, la API responde 422
 * `OR_BLOCK_HAS_CASES` o 412, y se muestra.
 *
 * Sólo la jefatura de quirófano gestiona bloques; quien no lo es ve S5. La
 * API decide igual.
 */
@Component({
  selector: 'app-or-blocks',
  imports: [AppButton, Badge, BlockForm, Card, DataTable, PageHeader, Tab, Tabs, ViewStateHost],
  templateUrl: './or-blocks.html',
  styleUrl: './or-blocks.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrBlocks {
  private readonly operatingRooms = inject(OperatingRoomsClient);
  private readonly siteContext = inject(SiteContextStore);
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly timeOf = timeOf;
  protected readonly shortDateOf = shortDateOf;
  protected readonly dateTimeOf = dateTimeOf;
  protected readonly durationOf = durationOf;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly tab = linkedSignal<number>(() => Math.max(0, TABS.indexOf(this.query().get('tab') as (typeof TABS)[number])));
  protected readonly week = signal(mondayOf(localDay(new Date())));

  protected readonly rooms = signal<readonly OperatingRoomSummary[]>([]);
  private readonly loaded = signal<ViewState<readonly OrBlock[]>>(loading());
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly working = signal<string | null>(null);

  protected readonly allowed = computed(() => canManageBlocks(this.session.roles()));
  protected readonly siteId = computed(() => dataOf(this.siteContext.state())?.sites[0]?.id ?? null);
  protected readonly staff = computed(() => dataOf(this.siteContext.state())?.staff ?? []);
  protected readonly weekLabel = computed(() => `Semana del ${shortDateOf(`${this.week()}T12:00:00`)} al ${shortDateOf(`${shiftDay(this.week(), 6)}T12:00:00`)}`);

  /** S5 para la página entera: sin rol no se pide nada. */
  protected readonly pageState = computed<ViewState<null>>(() =>
    this.allowed() ? ready(null) : forbidden({ message: 'Los bloques de quirófano los gestiona la jefatura de quirófano.' }),
  );

  protected readonly state = computed<ViewState<readonly OrBlock[]>>(() => {
    const ctx = this.siteContext.state();
    if (ctx.status !== 'ready' && ctx.status !== 'stale') return mapData(ctx, () => [] as readonly OrBlock[]);
    const s = this.loaded();
    return s.status === 'ready' && s.data.length === 0 ? empty({ label: 'Crear bloque', route: '/interventions/blocks', queryParams: { tab: 'new' } }, 'No hay bloques esta semana.') : s;
  });

  private readonly whenCell = viewChild.required<TemplateRef<{ $implicit: OrBlock }>>('whenCell');
  private readonly roomCell = viewChild.required<TemplateRef<{ $implicit: OrBlock }>>('roomCell');
  private readonly releaseCell = viewChild.required<TemplateRef<{ $implicit: OrBlock }>>('releaseCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: OrBlock }>>('statusCell');
  private readonly useCell = viewChild.required<TemplateRef<{ $implicit: OrBlock }>>('useCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: OrBlock }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<OrBlock>[]>(() => [
    { key: 'startsAt', header: 'Cuándo', priority: 1, cell: this.whenCell() },
    { key: 'operatingRoomId', header: 'Quirófano', priority: 2, cell: this.roomCell() },
    { key: 'owner', header: 'Dueño', priority: 1, cell: this.useCell() },
    { key: 'releaseAt', header: 'Se libera', priority: 3, cell: this.releaseCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'id', header: 'Acciones', priority: 1, cell: this.actionsCell(), align: 'end' },
  ]);

  protected readonly byId = (row: OrBlock): string => row.id;

  constructor() {
    this.siteContext.ensure();
    effect(() => {
      const siteId = this.siteId();
      const week = this.week();
      if (siteId === null || !this.allowed()) return;
      untracked(() => this.load(siteId, week));
    });
  }

  protected statusOf(block: OrBlock): { label: string; variant: 'success' | 'secondary' | 'error' } {
    return STATUS[block.status];
  }

  protected roomLabel(id: string): string {
    const r = this.rooms().find((x) => x.careSpace.id === id);
    return r === undefined ? 'Quirófano' : `${r.careSpace.code} · ${r.careSpace.name}`;
  }

  protected changeTab(index: number): void {
    this.tab.set(index);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: TABS[index] ?? null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected moveWeek(weeks: number): void {
    this.week.set(shiftDay(this.week(), weeks * 7));
  }

  protected reload(): void {
    const siteId = this.siteId();
    if (siteId !== null) this.load(siteId, this.week());
  }

  protected created(): void {
    this.changeTab(0);
    this.reload();
  }

  protected async close(block: OrBlock, action: 'release' | 'cancel'): Promise<void> {
    const releasing = action === 'release';
    const reason = await this.dialogs.confirmWithReason(
      {
        title: releasing ? 'Liberar el bloque' : 'Cancelar el bloque',
        message: releasing
          ? `El tiempo de ${block.owner.label} del ${shortDateOf(block.startsAt)} (${timeOf(block.startsAt)}–${timeOf(block.endsAt)}) vuelve a la agenda abierta. Cuenta como liberado en la utilización.`
          : `El bloque de ${block.owner.label} del ${shortDateOf(block.startsAt)} deja de existir.`,
        confirmLabel: releasing ? 'Liberar' : 'Cancelar el bloque',
        destructive: !releasing,
      },
      { label: 'Motivo', hint: 'Queda registrado con su nombre y la hora.', minLength: 3, maxLength: 500 },
    );
    if (reason === null) return;
    this.working.set(block.id);
    this.failure.set(null);
    const call = releasing ? this.operatingRooms.releaseBlock(block.id, block.rowVersion, reason) : this.operatingRooms.cancelBlock(block.id, block.rowVersion, reason);
    call.subscribe({
      next: () => {
        this.working.set(null);
        this.reload();
      },
      error: (error: unknown) => {
        this.working.set(null);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }

  private load(siteId: string, week: string): void {
    this.loaded.set(loading());
    this.operatingRooms.listOperatingRooms(siteId).subscribe({ next: (r) => this.rooms.set(r), error: () => this.rooms.set([]) });
    const from = new Date(`${week}T00:00:00`).toISOString();
    const to = new Date(`${shiftDay(week, 7)}T00:00:00`).toISOString();
    this.operatingRooms.listBlocks(siteId, { from, to }).subscribe({
      next: (blocks) => this.loaded.set(ready(blocks)),
      error: (error: unknown) => this.loaded.set(errorToViewState<readonly OrBlock[]>(error)),
    });
  }
}
