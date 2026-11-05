import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, filter, forkJoin, map, of, startWith, switchMap } from 'rxjs';

import { OperatingRoomsClient } from '../../../core/data-access/operating-rooms/operating-rooms.client';
import { blockOwnerLabel, reservedWindow, type OwnerDirectory } from '../../../core/data-access/operating-rooms/operating-rooms.rules';
import type { OperatingRoomSummary, OrBlock } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { ProceduresClient } from '../../../core/data-access/procedures/procedures.client';
import type { SurgicalCase } from '../../../core/data-access/procedures/procedures.types';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
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
import { SiteSwitch } from '../site-switch/site-switch';

/** Lo que pinta la agenda de un día. */
interface DaySchedule {
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
 *
 * Las formas son las de la API: el dueño del bloque viene como ids (el rótulo
 * se arma con catálogos) y, si el caso no trae su ventana reservada, se dibuja
 * con la preparación y la limpieza de la sala (es sólo dibujo: la reserva la
 * calcula la API).
 */
@Component({
  selector: 'app-or-schedule',
  imports: [Alert, AppButton, AppButtonLink, Card, Input, PageHeader, ResourceTimeline, RouterLink, SiteSwitch, ViewStateHost],
  templateUrl: './or-schedule.html',
  styleUrl: './or-schedule.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrSchedule {
  private readonly operatingRooms = inject(OperatingRoomsClient);
  private readonly procedures = inject(ProceduresClient);
  private readonly siteContext = inject(SiteContextStore);
  private readonly specialtiesCatalog = inject(MedicalSpecialtiesCatalog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly scheduleRoute = SCHEDULE_CASE_ROUTE;
  protected readonly timeOf = timeOf;
  protected readonly ageOf = ageOf;

  protected readonly day = signal(this.route.snapshot.queryParamMap.get('day') ?? localDay(new Date()));
  private readonly loaded = signal<ViewState<DaySchedule>>(loading());
  private readonly now = signal(Date.now());
  private readonly reloads = signal(0);
  private readonly specialties = signal<ReadonlyMap<string, string>>(new Map());
  private readonly ownerDirectory = computed<OwnerDirectory>(() => {
    const dir = dataOf(this.siteContext.directory());
    return {
      specialties: this.specialties(),
      units: new Map((dir?.clinicalUnits ?? []).map((u) => [u.id, u.name])),
      surgeons: new Map((dir?.staff ?? []).flatMap((m) => (m.practitionerName === null ? [] : [[m.practitionerProfileId, m.practitionerName] as const]))),
    };
  });

  /** El estado que se pinta: el del contexto, el de la carga, o S7 si el dato envejeció. */
  protected readonly state = computed<ViewState<DaySchedule>>(() => {
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
      .map((b) => {
        const owner = blockOwnerLabel(b.owner, this.ownerDirectory());
        return {
          id: b.id,
          rowId: b.operatingRoomId,
          kind: b.status === 'ORB_RELEASED' ? 'released' : 'band',
          start: b.startsAt,
          end: b.endsAt,
          label: b.status === 'ORB_RELEASED' ? `Liberado · ${owner}` : `Bloque ${owner}`,
          detail: `${b.status === 'ORB_RELEASED' ? 'Bloque liberado' : 'Bloque'} de ${owner}, ${timeOf(b.startsAt)} a ${timeOf(b.endsAt)}`,
        };
      });
    const cases: TimelineSegment[] = a.cases
      .filter((c) => c.operatingRoomId !== undefined && c.scheduledStartAt !== undefined && c.scheduledEndAt !== undefined)
      .map((c) => {
        const start = c.scheduledStartAt!.toISOString();
        const end = c.scheduledEndAt!.toISOString();
        const room = a.rooms.find((r) => r.careSpace.id === c.operatingRoomId);
        const drawn = reservedWindow(start, end, room?.prepMinutes ?? 0, room?.cleanupMinutes ?? 0);
        const reservedStart = c.reservedStartAt?.toISOString() ?? drawn.reservedStartAt;
        const reservedEnd = c.reservedEndAt?.toISOString() ?? drawn.reservedEndAt;
        return {
          id: c.id,
          rowId: c.operatingRoomId!,
          kind: 'item' as const,
          start,
          end,
          reservedStart,
          reservedEnd,
          label: c.caseNumber,
          detail: `${c.caseNumber}, de ${timeOf(start)} a ${timeOf(end)}; sala reservada de ${timeOf(reservedStart)} a ${timeOf(reservedEnd)} con preparación y limpieza`,
          route: caseRoute(c.id),
        };
      });
    return [...blocks, ...cases];
  });

  protected readonly hasCases = computed(() => {
    const a = this.agenda();
    return a !== null && a.cases.some((c) => a.rooms.some((r) => r.careSpace.id === c.operatingRoomId));
  });

  constructor() {
    this.siteContext.ensureDirectory();
    this.specialtiesCatalog.listar().subscribe({
      next: (list) => this.specialties.set(new Map(list.map((x) => [x.conceptId, x.display]))),
      error: () => this.specialties.set(new Map()),
    });
    // Una lectura por clave (sede, día, reintento): `switchMap` cancela la del
    // día anterior, así nunca se pinta otro día bajo el elegido.
    toObservable(computed(() => ({ siteId: this.siteContext.siteId(), day: this.day(), n: this.reloads() })))
      .pipe(
        filter((k): k is { siteId: string; day: string; n: number } => k.siteId !== null),
        switchMap(({ siteId, day }) => this.read(siteId, day).pipe(startWith(loading() as ViewState<DaySchedule>))),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.loaded.set(s));
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
    if (this.siteContext.state().status !== 'ready') this.siteContext.reload();
    this.reloads.update((n) => n + 1);
  }

  private read(siteId: string, day: string) {
    const { from, to } = dayBounds(day);
    return forkJoin({
      rooms: this.operatingRooms.listOperatingRooms(siteId),
      blocks: this.operatingRooms.listBlocks(siteId, { from, to }),
      cases: this.procedures.listAgenda({ from: new Date(from), to: new Date(to), limit: 100 }),
    }).pipe(
      map(({ rooms, blocks, cases }): ViewState<DaySchedule> => {
        this.now.set(Date.now());
        if (rooms.length === 0) {
          return empty({ label: 'Registrar un quirófano en la infraestructura', route: '/administration/medical-organization' }, 'La sede todavía no tiene espacios con función quirófano.');
        }
        return ready({ rooms, blocks, cases: cases.items, asOf: new Date().toISOString() });
      }),
      catchError((error: unknown) => of(errorToViewState<DaySchedule>(error))),
    );
  }
}
