import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal, viewChild, type OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of, type Observable } from 'rxjs';

import { isReservedBlock } from '../../../core/access-challenge/access-challenge';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { LocationNode, SupportAgenda } from '../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { canDrag, rescheduleCandidates } from './agenda-actions';
import { createAgendaDrag } from './agenda-drag-coordinator';
import { dayColumns, weekColumns } from './agenda-columns';
import { applyFilters, filterChips, setAllDoctors, toggleDoctor, type AgendaFilters, type FilterChip } from './agenda-filters';
import { AgendaGrid, type GridColumn } from './agenda-grid';
import { groupAgenda, type AgendaView } from './agenda-grouping';
import { AgendaPanel, type BookRequest } from './agenda-panel';
import { AgendaReserved } from './agenda-reserved';
import { AgendaActionRunner } from './agenda-runner';
import { shortcutFor } from './agenda-shortcuts';
import { addDays, boundsOf, daysOf, fromDayKey, hasScheduleAccess, makeOrg, mergeAgendas, startOfDay, titleOf, toDayKey, windowFor, type AgendaData, type AgendaEvent, type AgendaOrg, type AgendaViewKind } from './agenda-model';
import { AgendaSidebar } from './agenda-sidebar';
import { AgendaTimeline } from './agenda-timeline';
import { ALL_ORGS, clearAllFilters, parseUrlState, toQueryParams, withoutFilter, type AgendaUrlState } from './agenda-url';
import { PatientFinder, type PickedPatient } from './patient-finder';

const VISTAS: readonly SegmentedOption<AgendaViewKind>[] = [
  { value: 'DAY', label: 'Día' },
  { value: 'WEEK', label: 'Semana' },
  { value: 'TIMELINE', label: 'Línea de tiempo' },
];

const AGRUPACIONES: readonly SegmentedOption<AgendaView>[] = [
  { value: 'DOCTOR', label: 'Por doctor' },
  { value: 'SPACE', label: 'Por consultorio' },
  { value: 'SERVICE', label: 'Por servicio' },
];

const RANGOS: readonly SegmentedOption<'1' | '7'>[] = [
  { value: '1', label: '1 día' },
  { value: '7', label: '7 días' },
];

/** Lo que volvió de pedir la agenda de una organización: la agenda o el motivo por el que no llegó. */
interface AgendaResult {
  readonly org: AgendaOrg;
  readonly agenda: SupportAgenda | null;
  readonly error: unknown;
}

const TIPO_DE_FILA: Readonly<Record<AgendaView, string>> = { DOCTOR: 'Doctor', SPACE: 'Consultorio o sala', SERVICE: 'Servicio' };
const NOMBRE_DE_AGRUPACION: Readonly<Record<AgendaView, string>> = { DOCTOR: 'por doctor', SPACE: 'por consultorio', SERVICE: 'por servicio' };
const MOVIL = '(max-width: 779px)';

/**
 * **Agenda combinada** del personal de apoyo: los doctores que cubre, juntos, como
 * en Google Calendar (día, semana, «Mis doctores» con casillas de color) y como la
 * vista de recursos de un programador de proyectos (línea de tiempo con la
 * ocupación de cada consultorio).
 *
 * - **El estado vive en la URL**: vista, fecha, organización y filtros.
 * - **Las acciones salen de `allowedActions`** (lo que la API ya resolvió): sin
 *   permiso no hay botón, hay una nota; y lo que no se puede ver sale atenuado con el motivo.
 * - **Varias organizaciones en una agenda**: cada evento lleva la sigla de la suya y
 *   toda acción dice en cuál se actúa.
 *
 * No autoriza nada: la API decide en cada petición. Ocultar un botón no es seguridad.
 */
@Component({
  selector: 'app-combined-agenda',
  imports: [Alert, AgendaGrid, AgendaPanel, AgendaReserved, AgendaSidebar, AgendaTimeline, AppButton, Chip, PageHeader, PatientFinder, SegmentedControl, ViewStateHost],
  templateUrl: './combined-agenda.html',
  styleUrl: './combined-agenda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AgendaActionRunner],
  host: { '(document:keydown)': 'onKey($event)' },
})
export class CombinedAgenda implements OnInit {
  private readonly support = inject(SupportAccessClient);
  private readonly runner = inject(AgendaActionRunner);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly grid = viewChild(AgendaGrid);
  private readonly timeline = viewChild(AgendaTimeline);

  protected readonly vistas = VISTAS;
  protected readonly agrupaciones = AGRUPACIONES;
  protected readonly rangos = RANGOS;

  /** El reloj de la pantalla: mueve el indicador de «ahora» sin recargar nada. */
  protected readonly now = signal(new Date());
  protected readonly isMobile = signal(false);

  protected readonly url = signal<AgendaUrlState>(parseUrlState(this.route.snapshot.queryParamMap, new Date()));
  protected readonly orgs = signal<readonly AgendaOrg[]>([]);
  protected readonly state = signal<ViewState<AgendaData>>(loading());
  protected readonly partialFailures = signal<readonly string[]>([]);

  protected readonly selectedId = signal<string | null>(null);
  protected readonly announcement = this.runner.announcement;
  protected readonly busy = this.runner.busy;
  protected readonly failure = this.runner.failure;
  protected readonly explainRequest = this.runner.explainRequest;
  protected readonly reservedBlock = isReservedBlock;
  protected readonly filtersOpen = signal(false);

  /** «Nueva cita» y «Buscar paciente»: el buscador abierto y para qué. */
  protected readonly finderOpen = signal<'search' | 'new' | null>(null);
  protected readonly finderOrgId = signal<string | null>(null);
  protected readonly holding = signal<{ readonly picked: PickedPatient; readonly orgId: string } | null>(null);
  protected readonly foundPatient = signal<PickedPatient | null>(null);

  /** Celular: la columna (doctor) que está a la vista y a la que llevan las pestañas. */
  protected readonly activeColumn = signal<string | null>(null);
  /** La pestaña activa: la que se eligió o se deslizó, o la primera mientras nadie haya tocado nada. */
  protected readonly currentColumn = computed(() => this.activeColumn() ?? this.columns()[0]?.key ?? null);
  protected readonly focusColumn = signal<string | null>(null);

  /* ---- organizaciones ------------------------------------------------------------ */

  protected readonly orgValue = computed(() => {
    const lista = this.orgs();
    const pedida = this.url().org;
    if (pedida === ALL_ORGS && lista.length > 1) return ALL_ORGS;
    if (pedida !== null && lista.some((o) => o.id === pedida)) return pedida;
    return lista.length > 1 ? ALL_ORGS : (lista[0]?.id ?? null);
  });

  protected readonly orgOptions = computed<readonly SelectOption<string>[]>(() => [
    ...(this.orgs().length > 1 ? [{ value: ALL_ORGS, label: 'Todas mis organizaciones' }] : []),
    ...this.orgs().map((o) => ({ value: o.id, label: o.name })),
  ]);

  protected readonly selectedOrgs = computed<readonly AgendaOrg[]>(() => {
    const valor = this.orgValue();
    return valor === ALL_ORGS ? this.orgs() : this.orgs().filter((o) => o.id === valor);
  });

  protected readonly multiOrg = computed(() => this.selectedOrgs().length > 1);

  /* ---- fecha y rango ------------------------------------------------------------- */

  protected readonly anchor = computed(() => fromDayKey(this.url().date) ?? startOfDay(this.now()));
  protected readonly days = computed(() => daysOf(this.url().view, this.anchor(), this.url().span));
  protected readonly title = computed(() => {
    const texto = titleOf(this.url().view, this.days());
    return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
  });
  protected readonly rowKind = computed(() => TIPO_DE_FILA[this.url().group]);
  protected readonly regionLabel = computed(() => {
    const { view, group } = this.url();
    const que = view === 'WEEK' ? 'semana' : `${view === 'TIMELINE' ? 'línea de tiempo' : 'día'} ${NOMBRE_DE_AGRUPACION[group]}`;
    return `Agenda: ${que}, ${this.title()}. Se desplaza hacia los lados y hacia abajo.`;
  });

  /* ---- datos --------------------------------------------------------------------- */

  private readonly data = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });
  protected readonly doctors = computed(() => this.data()?.doctors ?? []);
  protected readonly locations = computed<readonly LocationNode[]>(() => this.data()?.locations ?? []);
  private readonly locationIndex = computed(() => new Map(this.locations().map((n) => [n.id, n])));

  protected readonly filters = computed<AgendaFilters>(() => ({
    hiddenDoctors: new Set(this.url().hidden),
    locationId: this.url().location,
    serviceId: this.url().service,
    showDenied: this.url().showDenied,
    showFree: this.url().showFree,
  }));

  protected readonly hiddenSet = computed(() => this.filters().hiddenDoctors);
  protected readonly visibleEvents = computed(() => applyFilters(this.data()?.events ?? [], this.filters(), this.locationIndex()));
  protected readonly timeWindow = computed(() => windowFor(this.data()?.events ?? []));

  protected readonly serviceOptions = computed<readonly SelectOption<string>[]>(() => {
    const servicios = this.data()?.services ?? [];
    const multi = this.multiOrg();
    return [
      { value: '', label: 'Todos los servicios' },
      ...servicios.map((s) => ({ value: s.id, label: multi ? `${s.name} · ${this.orgs().find((o) => o.id === s.orgId)?.short ?? ''}` : s.name })),
    ];
  });

  /** Lo que se dibuja en el **día** (una columna por doctor, consultorio o servicio) y en la **semana** (una por día). */
  protected readonly columns = computed<readonly GridColumn[]>(() => {
    const data = this.data();
    if (data === null) return [];
    if (this.url().view === 'WEEK') return weekColumns(this.visibleEvents(), this.days(), this.now());
    return dayColumns({
      events: this.visibleEvents(),
      day: this.days()[0]!,
      group: this.url().group,
      data,
      orgs: this.orgs(),
      multiOrg: this.multiOrg(),
      now: this.now(),
      hiddenDoctors: this.hiddenSet(),
      narrowed: this.url().service !== null || this.url().location !== null,
    });
  });

  /** Lo que se dibuja en la **línea de tiempo**: una fila por recurso. */
  protected readonly timelineGroups = computed(() => {
    const data = this.data();
    if (data === null) return [];
    return groupAgenda(this.visibleEvents(), this.url().group, data.doctors, data.services, data.locations);
  });

  protected readonly hasEvents = computed(() => this.visibleEvents().length > 0);
  protected readonly noScheduleNames = computed(() => this.selectedOrgs().filter((o) => o.scheduleAccess === false).map((o) => o.name).join(', '));

  protected readonly selectedEvent = computed<AgendaEvent | null>(() => {
    const id = this.selectedId();
    return id === null ? null : ((this.data()?.events ?? []).find((e) => e.id === id) ?? null);
  });

  protected readonly candidates = computed(() => {
    const e = this.selectedEvent();
    if (e === null || !canDrag(e)) return [];
    return rescheduleCandidates(e, this.visibleEvents(), this.now());
  });

  protected readonly panelHolding = computed(() => {
    const e = this.selectedEvent();
    const h = this.holding();
    return e !== null && h !== null && h.orgId === e.orgId ? h.picked : null;
  });

  /* ---- filtros activos ------------------------------------------------------------ */

  protected readonly chips = computed<readonly FilterChip[]>(() =>
    filterChips(this.filters(), { doctors: this.doctors(), services: this.data()?.services ?? [], locations: this.locationIndex() }),
  );

  /* ---- arrastre ------------------------------------------------------------------- */

  private readonly dragging = createAgendaDrag({
    doc: this.doc,
    allEvents: computed(() => this.data()?.events ?? []),
    visibleEvents: this.visibleEvents,
    now: this.now,
    holdingOrgId: computed(() => this.holding()?.orgId ?? null),
    onDrop: (source, target) => this.askReschedule(source, target),
    onReject: (reason) => {
      this.toasts.warning(reason, 'No se puede mover la cita ahí');
      this.announcement.set(`No se puede mover la cita ahí. ${reason}`);
    },
    scroller: () => this.grid()?.element ?? this.timeline()?.element,
  });

  protected readonly drag = this.dragging.controller;
  protected readonly dragSourceId = this.dragging.sourceId;
  protected readonly dragOverId = this.dragging.overId;
  protected readonly dragOverOk = this.dragging.overOk;
  protected readonly dropTargets = this.dragging.targets;

  constructor() {
    // El reloj: cada minuto, para el indicador de «ahora». Solo en el navegador: un temporizador vivo en el servidor lo dejaría esperando.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const reloj = setInterval(() => this.now.set(new Date()), 60_000);
      this.destroyRef.onDestroy(() => clearInterval(reloj));
    }
    this.destroyRef.onDestroy(() => this.drag.destroy());

    // Atrás y adelante del navegador: la URL manda.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const leido = parseUrlState(params, new Date());
      if (JSON.stringify(leido) === JSON.stringify(this.url())) return;
      const antes = this.requestKey();
      this.url.set(leido);
      if (this.orgs().length > 0 && antes !== this.requestKey()) this.load();
    });

    const mq = this.doc.defaultView?.matchMedia?.(MOVIL);
    if (mq !== undefined) {
      this.isMobile.set(mq.matches);
      const alCambiar = (e: MediaQueryListEvent): void => this.isMobile.set(e.matches);
      mq.addEventListener('change', alCambiar);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', alCambiar));
    }
  }

  ngOnInit(): void {
    this.support.listMyEngagements().subscribe({
      next: ({ engagements }) => {
        const activos = engagements.filter((v) => v.status === 'ACTIVE');
        const unicos = activos.filter((v, i) => activos.findIndex((o) => o.tenantId === v.tenantId) === i);
        this.orgs.set(unicos.map((v, i) => makeOrg(v.tenantId, v.organizationName, i, hasScheduleAccess(v.grants))));
        if (unicos.length === 0) {
          this.state.set(empty({ label: 'Vea «Mis accesos» para unirse a una organización', route: '/my-support' }, 'No tiene un vínculo de apoyo activo.'));
          return;
        }
        this.load();
      },
      error: (failure: unknown) => this.state.set(errorToViewState<AgendaData>(failure)),
    });
  }

  /* ---- carga ---------------------------------------------------------------------- */

  /** Lo que identifica **qué se le pide a la API**: si no cambia, no hace falta volver a pedir. */
  private requestKey(): string {
    const { from, to } = boundsOf(this.days());
    return `${this.orgValue() ?? ''}|${from}|${to}`;
  }

  protected load(options: { readonly silent?: boolean } = {}): void {
    const orgs = this.selectedOrgs();
    if (orgs.length === 0) return;
    if (options.silent !== true) {
      this.state.set(loading());
      this.selectedId.set(null);
    }
    const { from, to } = boundsOf(this.days());
    const peticiones: Observable<AgendaResult>[] = orgs.map((org) =>
      this.support.getSupportAgenda({ org: org.id, from, to }).pipe(
        map((agenda) => ({ org, agenda, error: null })),
        catchError((error: unknown) => of({ org, agenda: null, error })),
      ),
    );
    forkJoin(peticiones).subscribe((resultados) => {
      const buenos = resultados.flatMap((r) => (r.agenda === null ? [] : [{ org: r.org, agenda: r.agenda }]));
      const malos = resultados.filter((r) => r.agenda === null);
      this.partialFailures.set(malos.map((r) => r.org.name));
      if (buenos.length === 0) {
        this.state.set(errorToViewState<AgendaData>(malos[0]?.error));
        return;
      }
      this.state.set(ready(mergeAgendas(buenos)));
      this.announcement.set(`Agenda cargada: ${this.title()}.`);
    });
  }

  /* ---- la URL --------------------------------------------------------------------- */

  protected setUrl(patch: Partial<AgendaUrlState>): void {
    const antes = this.requestKey();
    const siguiente = { ...this.url(), ...patch };
    this.url.set(siguiente);
    void this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(siguiente, new Date()), replaceUrl: true });
    if (antes !== this.requestKey()) this.load();
  }

  protected setView(view: AgendaViewKind): void {
    this.setUrl({ view });
  }

  protected setGroup(group: AgendaView): void {
    this.setUrl({ group });
  }

  protected setSpan(span: '1' | '7'): void {
    this.setUrl({ span: span === '7' ? 7 : 1 });
  }

  protected setOrg(org: string | null): void {
    if (org === null) return;
    this.setUrl({ org, hidden: [], location: null, service: null });
  }

  protected goTo(day: Date): void {
    this.setUrl({ date: toDayKey(day) });
  }

  protected goToday(): void {
    this.goTo(new Date());
  }

  /** Mueve la vista un período: un día, o una semana si la vista abarca siete. */
  protected step(direction: -1 | 1): void {
    const salto = this.days().length > 1 ? 7 : 1;
    this.goTo(addDays(this.anchor(), direction * salto));
  }

  protected onDateInput(event: Event): void {
    const day = fromDayKey((event.target as HTMLInputElement).value);
    if (day !== null) this.goTo(day);
  }

  protected toggleDoctor(id: string): void {
    this.setUrl({ hidden: [...toggleDoctor(this.hiddenSet(), id)] });
  }

  protected setAllDoctors(on: boolean): void {
    this.setUrl({ hidden: [...setAllDoctors(this.doctors(), on)] });
  }

  protected removeChip(id: FilterChip['id']): void {
    this.setUrl(withoutFilter(this.url(), id));
  }

  protected clearFilters(): void {
    this.setUrl(clearAllFilters(this.url()));
  }

  /* ---- leer un evento -------------------------------------------------------------- */

  private findEvent(id: string): AgendaEvent | null {
    return (this.data()?.events ?? []).find((e) => e.id === id) ?? null;
  }

  protected pick(event: AgendaEvent): void {
    if (this.drag.consumeClick()) return;
    if (!event.allowedActions.includes('schedule.view') && !isReservedBlock(event)) {
      this.announcement.set(`Sin permiso. ${event.denialReason ?? 'Su permiso no cubre este horario.'}`);
      return;
    }
    this.selectedId.set(event.id);
    this.runner.clearFailure();
    // Quien navega con teclado o lector de pantalla aterriza en el panel, no varios cientos de horarios más atrás.
    setTimeout(() => this.doc.getElementById('panel-titulo')?.focus(), 0);
  }

  protected closePanel(): void {
    const id = this.selectedId();
    this.selectedId.set(null);
    this.runner.clearFailure();
    // Y al cerrar vuelve al horario del que salió.
    if (id !== null) setTimeout(() => this.doc.querySelector<HTMLElement>(`[data-event-id="${id}"]`)?.focus(), 0);
  }

  protected pointerDown(payload: { readonly event: PointerEvent; readonly item: AgendaEvent }): void {
    this.drag.pointerDown(payload.event, payload.item.id);
  }

  /* ---- acciones ------------------------------------------------------------------- */

  /** Después de cualquier acción: se cierra el panel, se suelta al paciente en mano y se vuelve a leer la agenda. */
  private readonly afterAction = (): void => {
    this.selectedId.set(null);
    this.holding.set(null);
    this.load({ silent: true });
  };

  protected checkIn(): void {
    const e = this.selectedEvent();
    if (e !== null) this.runner.checkIn(e, this.afterAction);
  }

  protected confirmBooking(): void {
    const e = this.selectedEvent();
    if (e !== null) this.runner.confirm(e, this.afterAction);
  }

  protected cancelBooking(): void {
    const e = this.selectedEvent();
    if (e !== null) void this.runner.cancel(e, this.afterAction);
  }

  /** Reprogramar: el origen y el destino salen del arrastre o del selector del panel. */
  protected askReschedule(sourceId: string, targetId: string): void {
    const origen = this.findEvent(sourceId);
    const destino = this.findEvent(targetId);
    if (origen !== null && destino !== null) void this.runner.reschedule(origen, destino, this.now(), this.afterAction);
  }

  protected reschedule(target: AgendaEvent): void {
    const origen = this.selectedEvent();
    if (origen !== null) this.askReschedule(origen.id, target.id);
  }

  protected book(request: BookRequest): void {
    const e = this.selectedEvent();
    if (e !== null) this.runner.book(e, request, this.afterAction);
  }

  /* ---- nueva cita y buscar paciente ----------------------------------------------- */

  protected readonly finderOrg = computed(() => this.orgs().find((o) => o.id === (this.finderOrgId() ?? this.selectedOrgs()[0]?.id)) ?? null);
  protected readonly finderOrgOptions = computed<readonly SelectOption<string>[]>(() => this.selectedOrgs().map((o) => ({ value: o.id, label: o.name })));
  protected readonly finderCanRegister = computed(() => {
    const org = this.finderOrg();
    return org !== null && (this.data()?.events ?? []).some((e) => e.orgId === org.id && e.allowedActions.includes('patient.register'));
  });

  /** Las citas de ese paciente en lo que se está viendo. */
  protected readonly foundEvents = computed(() => {
    const p = this.foundPatient();
    if (p === null) return [];
    const nombre = p.patient.displayName.toLocaleLowerCase('es');
    return (this.data()?.events ?? []).filter((e) => e.status !== 'FREE' && (e.patientLabel ?? '').toLocaleLowerCase('es').startsWith(nombre));
  });

  protected openFinder(intent: 'search' | 'new'): void {
    this.finderOpen.set(intent);
    this.foundPatient.set(null);
    this.finderOrgId.set(this.selectedOrgs()[0]?.id ?? null);
    setTimeout(() => this.doc.querySelector<HTMLElement>('[data-testid="agenda-buscador"] input')?.focus(), 0);
  }

  protected closeFinder(): void {
    this.finderOpen.set(null);
    this.foundPatient.set(null);
  }

  protected finderPicked(picked: PickedPatient): void {
    this.foundPatient.set(picked);
    if (this.finderOpen() === 'new') this.startBooking();
  }

  /** Con el paciente en mano, solo falta elegir el horario libre. */
  protected startBooking(): void {
    const picked = this.foundPatient();
    const org = this.finderOrg();
    if (picked === null || org === null) return;
    this.holding.set({ picked, orgId: org.id });
    this.closeFinder();
    this.announcement.set(`Nueva cita para ${picked.patient.displayName} en ${org.name}. Elija un horario libre.`);
  }

  protected showPatientEvent(event: AgendaEvent): void {
    this.closeFinder();
    this.pick(event);
  }

  protected cancelHolding(): void {
    this.holding.set(null);
  }

  protected holdingOrg(): AgendaOrg | null {
    const h = this.holding();
    return h === null ? null : (this.orgs().find((o) => o.id === h.orgId) ?? null);
  }

  /* ---- móvil ---------------------------------------------------------------------- */

  protected showColumn(key: string): void {
    this.activeColumn.set(key);
    this.focusColumn.set(null);
    queueMicrotask(() => this.focusColumn.set(key));
  }

  /* ---- teclado -------------------------------------------------------------------- */

  protected onKey(event: KeyboardEvent): void {
    const comando = shortcutFor(event, {
      dragging: this.drag.dragging,
      finderOpen: this.finderOpen() !== null,
      panelOpen: this.selectedId() !== null,
      holding: this.holding() !== null,
    });
    switch (comando) {
      case 'NEW':
      case 'SEARCH':
        event.preventDefault();
        this.openFinder(comando === 'NEW' ? 'new' : 'search');
        return;
      case 'TODAY':
        event.preventDefault();
        this.goToday();
        return;
      case 'PREVIOUS':
      case 'NEXT':
        event.preventDefault();
        this.step(comando === 'PREVIOUS' ? -1 : 1);
        return;
      case 'CLOSE_FINDER':
        this.closeFinder();
        return;
      case 'CLOSE_PANEL':
        this.closePanel();
        return;
      case 'CANCEL_HOLDING':
        this.cancelHolding();
        return;
      case null:
        return;
    }
  }
}
