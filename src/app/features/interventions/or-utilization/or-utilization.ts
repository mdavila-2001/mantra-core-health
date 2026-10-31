import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, type TemplateRef } from '@angular/core';

import { SessionStore } from '../../../core/auth/session.store';
import { OperatingRoomsClient } from '../../../core/data-access/operating-rooms/operating-rooms.client';
import { canSeeUtilization } from '../../../core/data-access/operating-rooms/operating-rooms.rules';
import type { BlockUtilization, OrUtilization, OwnerUtilization, RoomDayUtilization } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, forbidden, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ageOf, durationOf, localDay, percentOf, shiftDay, shortDateOf, timeOf } from '../interventions.presentation';
import { OPERATING_ROOMS_ROUTE } from '../interventions.routes';

type Range = '7' | '14' | '30';

const RANGES: readonly SegmentedOption<Range>[] = [
  { value: '7', label: '7 días' },
  { value: '14', label: '14 días' },
  { value: '30', label: '30 días' },
];

/**
 * **Utilización de quirófanos** — `/interventions/utilization` (F4).
 *
 * Responde dos preguntas: *¿cuánto de la sesión publicada se usó?* (tiempo
 * útil = inicio de anestesia → salida, ÷ sesión) y *¿cuánto aprovecha cada
 * dueño su bloque?* ((usado + recambio) ÷ (asignado − liberado)). Las cifras
 * las calcula la API; la pantalla no recalcula nada, sólo muestra con su
 * antigüedad (S7) y con la fórmula a la vista.
 *
 * Lo ven la jefatura de quirófano, Facturación y la administración (R).
 */
@Component({
  selector: 'app-or-utilization',
  imports: [Card, DataTable, MetricCard, PageHeader, SegmentedControl, ViewStateHost],
  templateUrl: './or-utilization.html',
  styleUrl: './or-utilization.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrUtilizationPage {
  private readonly operatingRooms = inject(OperatingRoomsClient);
  private readonly siteContext = inject(SiteContextStore);
  private readonly session = inject(SessionStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly ranges = RANGES;
  protected readonly range = signal<Range>('14');
  protected readonly percentOf = percentOf;
  protected readonly durationOf = durationOf;
  protected readonly ageOf = ageOf;
  protected readonly timeOf = timeOf;
  protected readonly shortDateOf = shortDateOf;

  private readonly loaded = signal<ViewState<OrUtilization>>(loading());
  private readonly siteId = computed(() => dataOf(this.siteContext.state())?.sites[0]?.id ?? null);
  private readonly allowed = computed(() => canSeeUtilization(this.session.roles()));

  protected readonly state = computed<ViewState<OrUtilization>>(() => {
    if (!this.allowed()) return forbidden({ message: 'La utilización la consultan la jefatura de quirófano, Facturación y la administración.' });
    const ctx = this.siteContext.state();
    if (ctx.status !== 'ready' && ctx.status !== 'stale') return mapData(ctx, () => null as unknown as OrUtilization);
    const s = this.loaded();
    return s.status === 'ready' && s.data.rooms.length === 0 ? empty({ label: 'Ver la agenda de quirófanos', route: OPERATING_ROOMS_ROUTE }, 'No hubo sesiones de quirófano en el período elegido.') : s;
  });

  protected readonly data = computed(() => dataOf(this.state()));

  private readonly roomDayCell = viewChild.required<TemplateRef<{ $implicit: RoomDayUtilization }>>('roomDayCell');
  private readonly pctRoomCell = viewChild.required<TemplateRef<{ $implicit: RoomDayUtilization }>>('pctRoomCell');
  private readonly ownerPctCell = viewChild.required<TemplateRef<{ $implicit: OwnerUtilization }>>('ownerPctCell');
  private readonly blockCell = viewChild.required<TemplateRef<{ $implicit: BlockUtilization }>>('blockCell');
  private readonly blockPctCell = viewChild.required<TemplateRef<{ $implicit: BlockUtilization }>>('blockPctCell');

  protected readonly ownerColumns = computed<readonly ColumnDef<OwnerUtilization>[]>(() => [
    { key: 'owner', header: 'Dueño', priority: 1 },
    { key: 'allocatedMinutes', header: 'Asignado (min)', priority: 2, align: 'end' },
    { key: 'releasedMinutes', header: 'Liberado (min)', priority: 2, align: 'end' },
    { key: 'usedInBlockMinutes', header: 'Usado (min)', priority: 2, align: 'end' },
    { key: 'blockUtilizationPct', header: 'Utilización de bloque', priority: 1, cell: this.ownerPctCell() },
  ]);

  protected readonly roomColumns = computed<readonly ColumnDef<RoomDayUtilization>[]>(() => [
    { key: 'date', header: 'Sala y día', priority: 1, cell: this.roomDayCell() },
    { key: 'cases', header: 'Casos', priority: 2, align: 'end' },
    { key: 'touchMinutes', header: 'Tiempo útil (min)', priority: 2, align: 'end' },
    { key: 'roomUtilizationPct', header: 'Utilización de sala', priority: 1, cell: this.pctRoomCell() },
  ]);

  protected readonly blockColumns = computed<readonly ColumnDef<BlockUtilization>[]>(() => [
    { key: 'startsAt', header: 'Bloque', priority: 1, cell: this.blockCell() },
    { key: 'allocatedMinutes', header: 'Asignado', priority: 3, align: 'end' },
    { key: 'releasedMinutes', header: 'Liberado', priority: 3, align: 'end' },
    { key: 'usedInBlockMinutes', header: 'Usado', priority: 2, align: 'end' },
    { key: 'blockUtilizationPct', header: 'Utilización', priority: 1, cell: this.blockPctCell() },
  ]);

  protected readonly ownersState = computed(() => mapData(this.state(), (d) => d.owners));
  protected readonly roomsState = computed(() => mapData(this.state(), (d) => d.rooms));
  protected readonly blocksState = computed(() => mapData(this.state(), (d) => d.blocks));

  protected readonly byOwner = (r: OwnerUtilization): string => r.owner;
  protected readonly byRoomDay = (r: RoomDayUtilization): string => `${r.operatingRoomId}:${r.date}`;
  protected readonly byBlock = (r: BlockUtilization): string => r.blockId;

  constructor() {
    this.siteContext.ensure();
    effect(() => {
      const siteId = this.siteId();
      const range = this.range();
      if (siteId === null || !this.allowed()) return;
      untracked(() => this.load(siteId, range));
    });
  }

  protected reload(): void {
    const siteId = this.siteId();
    if (siteId !== null) this.load(siteId, this.range());
  }

  /** Ancho de la barra, acotado a 0–100. */
  protected barOf(pct: number | null): number {
    return pct === null ? 0 : Math.max(0, Math.min(100, pct));
  }

  private load(siteId: string, range: Range): void {
    this.loaded.set(loading());
    const to = localDay(new Date());
    const from = shiftDay(to, -(Number(range) - 1));
    this.operatingRooms.getUtilization(siteId, { from, to }).subscribe({
      next: (u) => this.loaded.set(ready(u)),
      error: (error: unknown) => this.loaded.set(errorToViewState<OrUtilization>(error)),
    });
  }
}
