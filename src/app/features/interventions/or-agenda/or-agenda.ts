import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { OperatingRoomsClient } from '../../../core/data-access/operating-rooms/operating-rooms.client';
import { canScheduleCases } from '../../../core/data-access/operating-rooms/operating-rooms.rules';
import type { OperatingRoomSummary, OrBlock } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { ProceduresClient } from '../../../core/data-access/procedures/procedures.client';
import type { SurgicalCase } from '../../../core/data-access/procedures/procedures.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, mapData, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ResourceTimeline } from '../../../shared/components/organisms/resource-timeline/resource-timeline';
import type { TimelineRow, TimelineSegment } from '../../../shared/components/organisms/resource-timeline/resource-timeline.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ageOf, dayBounds, localDay, shiftDay, timeOf } from '../interventions.presentation';
import { caseRoute, SCHEDULE_CASE_ROUTE } from '../interventions.routes';

/** Lo que pinta la agenda de un día. */
interface DayAgenda {
  readonly rooms: readonly OperatingRoomSummary[];
  readonly blocks: readonly OrBlock[];
  readonly cases: readonly SurgicalCase[];
  readonly asOf: string;
}

/** A partir de cuántos minutos la agenda del día se considera atrasada (S7). */
const STALE_AFTER_MINUTES = 5;

/**
 * **Agenda de quirófanos** — `/interventions/operating-rooms` (F4).
 *
 * Un día, una fila por sala: los bloques de fondo (con su dueño), los
 * liberados rayados y cada caso con su ventana reservada sombreada como
 * preparación y limpieza. Debajo de 780 px la misma información sale como
 * tabla (`app-resource-timeline`).
 *
 * La agenda cambia durante la jornada: pasados unos minutos se marca como
 * atrasada (S7) con la hora del dato y se ofrece actualizar.
 */
@Component({
  selector: 'app-or-agenda',
  imports: [Alert, AppButton, AppButtonLink, Card, Input, PageHeader, ResourceTimeline, RouterLink, ViewStateHost],
  templateUrl: './or-agenda.html',
  styleUrl: './or-agenda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrAgenda {
  private readonly operatingRooms = inject(OperatingRoomsClient);
  private readonly procedures = inject(ProceduresClient);
  private readonly siteContext = inject(SiteContextStore);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly scheduleRoute = SCHEDULE_CASE_ROUTE;
  protected readonly timeOf = timeOf;
  protected readonly ageOf = ageOf;

  protected readonly day = signal(this.route.snapshot.queryParamMap.get('day') ?? localDay(new Date()));
  private readonly loaded = signal<ViewState<DayAgenda>>(loading());
  private readonly now = signal(Date.now());

  protected readonly canSchedule = computed(() => canScheduleCases(this.session.roles()));
  private readonly siteId = computed(() => dataOf(this.siteContext.state())?.sites[0]?.id ?? null);

  /** El estado que se pinta: el del contexto, el de la carga, o S7 si el dato envejeció. */
  protected readonly state = computed<ViewState<DayAgenda>>(() => {
    const ctx = this.siteContext.state();
    if (ctx.status !== 'ready' && ctx.status !== 'stale') return mapData(ctx, () => ({ rooms: [], blocks: [], cases: [], asOf: '' }));
    const s = this.loaded();
    if (s.status === 'ready' && this.now() - Date.parse(s.data.asOf) > STALE_AFTER_MINUTES * 60_000) return stale(s.data, new Date(s.data.asOf));
    return s;
  });

  protected readonly agenda = computed(() => dataOf(this.state()));

  protected readonly rows = computed<readonly TimelineRow[]>(() =>
    (this.agenda()?.rooms ?? []).map((r) => ({ id: r.careSpace.id, label: `${r.careSpace.code} · ${r.careSpace.name}`, description: `+${r.prepMinutes} prep · +${r.cleanupMinutes} limpieza` })),
  );

  protected readonly segments = computed<readonly TimelineSegment[]>(() => {
    const a = this.agenda();
    if (a === null) return [];
    const blocks: TimelineSegment[] = a.blocks
      .filter((b) => b.status !== 'ORB_CANCELLED')
      .map((b) => ({
        id: b.id,
        rowId: b.operatingRoomId,
        kind: b.status === 'ORB_RELEASED' ? 'released' : 'band',
        start: b.startsAt,
        end: b.endsAt,
        label: b.status === 'ORB_RELEASED' ? `Liberado · ${b.owner.label}` : `Bloque ${b.owner.label}`,
        detail: `${b.status === 'ORB_RELEASED' ? 'Bloque liberado' : 'Bloque'} de ${b.owner.label}, ${timeOf(b.startsAt)} a ${timeOf(b.endsAt)}`,
      }));
    const cases: TimelineSegment[] = a.cases
      .filter((c) => c.operatingRoomId !== undefined && c.scheduledStartAt !== undefined && c.scheduledEndAt !== undefined)
      .map((c) => ({
        id: c.id,
        rowId: c.operatingRoomId!,
        kind: 'item',
        start: c.scheduledStartAt!.toISOString(),
        end: c.scheduledEndAt!.toISOString(),
        ...(c.reservedStartAt === undefined ? {} : { reservedStart: c.reservedStartAt.toISOString() }),
        ...(c.reservedEndAt === undefined ? {} : { reservedEnd: c.reservedEndAt.toISOString() }),
        label: c.caseNumber,
        detail: `${c.caseNumber}, de ${timeOf(c.scheduledStartAt)} a ${timeOf(c.scheduledEndAt)}; sala reservada de ${timeOf(c.reservedStartAt)} a ${timeOf(c.reservedEndAt)} con preparación y limpieza`,
        route: caseRoute(c.id),
      }));
    return [...blocks, ...cases];
  });

  protected readonly hasCases = computed(() => (this.agenda()?.cases.length ?? 0) > 0);

  constructor() {
    this.siteContext.ensure();
    effect(() => {
      const siteId = this.siteId();
      const day = this.day();
      if (siteId === null) return;
      untracked(() => this.load(siteId, day));
    });
    const timer = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected move(days: number): void {
    this.setDay(shiftDay(this.day(), days));
  }

  protected setDay(day: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    this.day.set(day);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { day }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected today(): void {
    this.setDay(localDay(new Date()));
  }

  protected reload(): void {
    const siteId = this.siteId();
    if (siteId === null) this.siteContext.reload();
    else this.load(siteId, this.day());
  }

  private load(siteId: string, day: string): void {
    this.loaded.set(loading());
    const { from, to } = dayBounds(day);
    forkJoin({
      rooms: this.operatingRooms.listOperatingRooms(siteId),
      blocks: this.operatingRooms.listBlocks(siteId, { from, to }),
      cases: this.procedures.listAgenda({ from: new Date(from), to: new Date(to), limit: 100 }),
    }).subscribe({
      next: ({ rooms, blocks, cases }) => {
        this.now.set(Date.now());
        if (rooms.length === 0) {
          this.loaded.set(empty({ label: 'Registrar un quirófano en la infraestructura', route: '/administration/medical-organization' }, 'La sede todavía no tiene espacios con función quirófano.'));
          return;
        }
        this.loaded.set(ready({ rooms, blocks, cases: cases.items, asOf: new Date().toISOString() }));
      },
      error: (error: unknown) => this.loaded.set(errorToViewState<DayAgenda>(error)),
    });
  }
}
