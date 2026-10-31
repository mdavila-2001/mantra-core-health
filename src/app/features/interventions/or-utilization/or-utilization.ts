import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type TemplateRef } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, filter, map, of, startWith, switchMap } from 'rxjs';

import { OperatingRoomsClient } from '../../../core/data-access/operating-rooms/operating-rooms.client';
import type { OrUtilization, RoomUtilization } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
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
import { SiteSwitch } from '../site-switch/site-switch';

type Range = '7' | '14' | '30';

const RANGES: readonly SegmentedOption<Range>[] = [
  { value: '7', label: '7 días' },
  { value: '14', label: '14 días' },
  { value: '30', label: '30 días' },
];

/** La utilización con la hora en que se recibió (S7 cuando la API no manda `asOf`). */
interface Received {
  readonly data: OrUtilization;
  readonly asOf: string;
}

/**
 * **Utilización de quirófanos** — `/interventions/utilization` (F4).
 *
 * Responde *¿cuánto de la sesión publicada se usó?* (tiempo útil = inicio de
 * anestesia → salida, ÷ sesión de bloques activos) y *¿cuánto se aprovechan
 * los bloques?* (útil ÷ (asignado − liberado)), por sala. Son las cifras de
 * `GET /sites/:siteId/or-utilization`; los totales del período los arma el
 * cliente con la misma fórmula cuando la API no los manda (`withTotals`).
 *
 * Quién la ve lo decide la API (§0.3, `f4.utilization.read`): la pantalla
 * pide siempre y pinta S5 con el 403.
 */
@Component({
  selector: 'app-or-utilization',
  imports: [Card, DataTable, MetricCard, PageHeader, SegmentedControl, SiteSwitch, ViewStateHost],
  templateUrl: './or-utilization.html',
  styleUrl: './or-utilization.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrUtilizationPage {
  private readonly operatingRooms = inject(OperatingRoomsClient);
  private readonly siteContext = inject(SiteContextStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly ranges = RANGES;
  protected readonly range = signal<Range>('14');
  private readonly reloads = signal(0);
  protected readonly percentOf = percentOf;
  protected readonly durationOf = durationOf;
  protected readonly ageOf = ageOf;
  protected readonly timeOf = timeOf;
  protected readonly shortDateOf = shortDateOf;

  private readonly loaded = signal<ViewState<Received>>(loading());

  protected readonly state = computed<ViewState<Received>>(() => {
    const ctx = this.siteContext.state();
    if (ctx.status !== 'ready' && ctx.status !== 'stale') return mapData(ctx, () => null as unknown as Received);
    const s = this.loaded();
    return s.status === 'ready' && s.data.data.rooms.length === 0
      ? empty({ label: 'Ver la agenda de quirófanos', route: OPERATING_ROOMS_ROUTE }, 'El establecimiento no tiene quirófanos con datos en el período elegido.')
      : s;
  });

  protected readonly data = computed(() => dataOf(this.state()));

  private readonly roomCell = viewChild.required<TemplateRef<{ $implicit: RoomUtilization }>>('roomCell');
  private readonly pctRoomCell = viewChild.required<TemplateRef<{ $implicit: RoomUtilization }>>('pctRoomCell');
  private readonly pctBlockCell = viewChild.required<TemplateRef<{ $implicit: RoomUtilization }>>('pctBlockCell');

  protected readonly roomColumns = computed<readonly ColumnDef<RoomUtilization>[]>(() => [
    { key: 'code', header: 'Sala', priority: 1, cell: this.roomCell() },
    { key: 'sessionMinutes', header: 'Sesión (min)', priority: 2, align: 'end' },
    { key: 'touchMinutes', header: 'Tiempo útil (min)', priority: 2, align: 'end' },
    { key: 'roomUtilizationPct', header: 'Utilización de sala', priority: 1, cell: this.pctRoomCell() },
    { key: 'blocks', header: 'Utilización de bloque', priority: 1, cell: this.pctBlockCell() },
  ]);

  protected readonly roomsState = computed(() => mapData(this.state(), (d) => d.data.rooms));
  protected readonly byRoom = (r: RoomUtilization): string => r.operatingRoomId;

  constructor() {
    this.siteContext.ensure();
    // Una lectura por clave (sede, período, reintento): `switchMap` cancela la
    // anterior, así una respuesta vieja nunca pisa la de la sede elegida.
    toObservable(computed(() => ({ siteId: this.siteContext.siteId(), range: this.range(), n: this.reloads() })))
      .pipe(
        filter((k): k is { siteId: string; range: Range; n: number } => k.siteId !== null),
        switchMap(({ siteId, range }) => {
          const to = localDay(new Date());
          const from = shiftDay(to, -(Number(range) - 1));
          return this.operatingRooms.getUtilization(siteId, { from, to }).pipe(
            map((u) => ready({ data: u, asOf: u.asOf ?? new Date().toISOString() }) as ViewState<Received>),
            catchError((e: unknown) => of(errorToViewState<Received>(e))),
            startWith(loading() as ViewState<Received>),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.loaded.set(s));
  }

  protected reload(): void {
    if (this.siteContext.state().status !== 'ready') this.siteContext.reload();
    this.reloads.update((n) => n + 1);
  }

  /** Ancho de la barra, acotado a 0–100. */
  protected barOf(pct: number | null): number {
    return pct === null ? 0 : Math.max(0, Math.min(100, pct));
  }
}
