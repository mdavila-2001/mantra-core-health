import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, filter, map, of, switchMap } from 'rxjs';

import { OperatingRoomsClient } from '../../../core/data-access/operating-rooms/operating-rooms.client';
import { PHASE_LABELS, type ChecklistPhaseCode } from '../../../core/data-access/operating-rooms/operating-rooms.rules';
import type { OperatingRoomSummary } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { ProceduresClient } from '../../../core/data-access/procedures/procedures.client';
import type { SurgicalCaseDetail } from '../../../core/data-access/procedures/procedures.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, ready, routeAuthPending } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Card } from '../../../shared/components/molecules/card/card';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { CaseCharges } from '../case-charges/case-charges';
import { CaseChecklist } from '../case-checklist/case-checklist';
import { CaseRoomEvents } from '../case-room-events/case-room-events';
import { CaseTeam } from '../case-team/case-team';
import { dateTimeOf, timeOf } from '../interventions.presentation';
import { INTERVENTIONS_ROUTE } from '../interventions.routes';

/** Las pestañas, en el orden del contrato (§F4.4); la clave viaja en `?tab=`. */
const TABS = ['summary', 'team', 'checklist', 'room', 'charges'] as const;
type CaseTab = (typeof TABS)[number];

const CASE_TYPE_LABELS: Readonly<Record<string, string>> = { ELECTIVE: 'Electiva', URGENT: 'Urgente', EMERGENCY: 'Emergencia' };

/**
 * **Ficha de una intervención** — `/interventions/:caseId` (F4).
 *
 * Una tarjeta centrada a lo ancho con cinco pestañas (regla 6): Resumen ·
 * Equipo (la aceptación de siempre, sin cambiar su contrato) · Check-list OMS
 * (tres fases con `Stepper`) · Eventos de sala (botonera en orden + línea de
 * tiempo) · Cargos.
 *
 * S1 hasta saber a quién se le piden los datos; un caso de otro tenant
 * responde 404 y se pinta S6 sin un dato del caso. Cada mutación de una
 * pestaña relee la ficha: lo que se ve después es lo que la API guardó.
 *
 * Formas de la API: la cabecera (`toSummary`) trae `operatingRoomId`; la sala
 * se resuelve contra las salas de la sede. Lo que A-F4 todavía no manda
 * (`checklist`, `roomEvents`, `turnoverCleaning`, `encounterId`, `reserved*`)
 * es opcional y ninguna compuerta se deriva de su ausencia: el check-list se
 * lee de su propio endpoint y sus fases alimentan la botonera de sala.
 */
@Component({
  selector: 'app-case-detail',
  imports: [AppButtonLink, Badge, Card, CaseCharges, CaseChecklist, CaseRoomEvents, CaseTeam, FactList, PageHeader, RouterLink, Tab, Tabs, ViewStateHost],
  templateUrl: './case-detail.html',
  styleUrl: './case-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseDetail {
  private readonly procedures = inject(ProceduresClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly operatingRooms = inject(OperatingRoomsClient);
  private readonly siteContext = inject(SiteContextStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly listRoute = INTERVENTIONS_ROUTE;

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly caseId = computed(() => this.params().get('caseId') ?? '');

  protected readonly tab = linkedSignal<number>(() => Math.max(0, TABS.indexOf(this.query().get('tab') as CaseTab)));

  protected readonly state = signal<ViewState<SurgicalCaseDetail>>(routeAuthPending());
  private readonly labels = signal<ConceptLabels>(new Map());
  private readonly reloads = signal(0);
  private readonly rooms = signal<readonly OperatingRoomSummary[]>([]);
  /** Las fases completas según el check-list leído (no según un campo ausente). */
  protected readonly phases = signal<Readonly<Record<ChecklistPhaseCode, boolean>>>({ SIGN_IN: false, TIME_OUT: false, SIGN_OUT: false });

  protected readonly detail = computed(() => dataOf(this.state()));
  protected readonly surgicalCase = computed(() => this.detail()?.case ?? null);

  /** La sala del caso: la que manda la API o, si no, la de la sede por su id. */
  protected readonly room = computed(() => {
    const c = this.surgicalCase();
    if (c === null) return null;
    if (c.operatingRoom) return c.operatingRoom;
    const r = this.rooms().find((x) => x.careSpace.id === c.operatingRoomId);
    return r === undefined ? null : { id: r.careSpace.id, code: r.careSpace.code, name: r.careSpace.name, path: '' };
  });

  protected readonly roomLabel = computed(() => {
    const r = this.room();
    return r === null ? null : `${r.code} · ${r.name}`;
  });

  protected readonly title = computed(() => this.surgicalCase()?.caseNumber ?? 'Intervención');
  protected readonly subtitle = computed(() => {
    const c = this.surgicalCase();
    if (c === null) return 'Ficha de la intervención';
    const r = this.room();
    const room = r === null ? (c.operatingRoomId ? 'quirófano' : 'sin quirófano') : `${r.code} · ${r.name}`;
    return `${room} · ${dateTimeOf(c.scheduledStartAt)}`;
  });

  protected readonly statusLabel = computed(() => {
    const c = this.surgicalCase();
    return c === null ? '' : (this.labels().get(c.statusConceptId)?.display ?? '');
  });

  protected readonly facts = computed<readonly Hecho[]>(() => {
    const c = this.surgicalCase();
    if (c === null) return [];
    const done = this.phases();
    const phase = (complete: boolean, label: string) => `${label}: ${complete ? 'completa' : 'pendiente'}`;
    const r = this.room();
    return [
      { etiqueta: 'Número', valor: c.caseNumber },
      { etiqueta: 'Estado', valor: this.statusLabel() || null },
      { etiqueta: 'Tipo', valor: c.caseType === undefined ? null : (CASE_TYPE_LABELS[c.caseType.code.replace(/^.*?(ELECTIVE|URGENT|EMERGENCY)$/, '$1')] ?? c.caseType.display) },
      { etiqueta: 'Quirófano', valor: r === null ? null : `${r.code} · ${r.name}` },
      { etiqueta: 'Ubicación', valor: r?.path || null },
      { etiqueta: 'Programada', valor: c.scheduledStartAt === undefined ? null : `${dateTimeOf(c.scheduledStartAt)}–${timeOf(c.scheduledEndAt)}` },
      {
        etiqueta: 'Ventana reservada',
        valor: c.reservedStartAt === undefined ? null : `${timeOf(c.reservedStartAt)}–${timeOf(c.reservedEndAt)} (+${c.prepMinutes ?? 0} min de preparación, +${c.cleanupMinutes ?? 0} de limpieza)`,
      },
      { etiqueta: 'Bloque', valor: c.block === undefined ? null : c.block.label || 'Bloque asignado' },
      {
        etiqueta: 'Check-list OMS',
        valor: [phase(done.SIGN_IN, PHASE_LABELS.SIGN_IN), phase(done.TIME_OUT, PHASE_LABELS.TIME_OUT), phase(done.SIGN_OUT, PHASE_LABELS.SIGN_OUT)].join(' · '),
        tono: done.SIGN_OUT ? 'ok' : 'aviso',
      },
    ];
  });

  constructor() {
    this.siteContext.ensure();
    toObservable(this.siteContext.siteId)
      .pipe(
        filter((id): id is string => id !== null),
        switchMap((siteId) => this.operatingRooms.listOperatingRooms(siteId).pipe(catchError(() => of([] as readonly OperatingRoomSummary[])))),
        takeUntilDestroyed(),
      )
      .subscribe((rooms) => this.rooms.set(rooms));
    // Una lectura por clave (caso, reintento): `switchMap` cancela la anterior.
    // El reintento conserva lo pintado hasta que llega la respuesta nueva.
    toObservable(computed(() => ({ id: this.caseId(), n: this.reloads() })))
      .pipe(
        switchMap(({ id, n }) => {
          if (n === 0 || this.detail() === null) this.state.set(loading());
          return this.procedures.getCase(id).pipe(
            map((detail) => ready(detail) as ViewState<SurgicalCaseDetail>),
            catchError((error: unknown) => of(errorToViewState<SurgicalCaseDetail>(error))),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((s) => {
        this.state.set(s);
        const detail = dataOf(s);
        if (detail === null) return;
        this.terminology
          .readConceptLabels([detail.case.statusConceptId])
          .pipe(catchError(() => of(new Map() as ConceptLabels)))
          .subscribe((labels) => this.labels.update((prev) => new Map([...prev, ...labels])));
      });
  }

  protected changeTab(index: number): void {
    this.tab.set(index);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: TABS[index] ?? null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reload(): void {
    this.reloads.update((n) => n + 1);
  }
}
