import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { canRecordInRoom, PHASE_LABELS } from '../../../core/data-access/operating-rooms/operating-rooms.rules';
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
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
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
 */
@Component({
  selector: 'app-case-detail',
  imports: [AppButtonLink, Badge, Card, CaseChecklist, CaseRoomEvents, CaseTeam, EmptyState, FactList, PageHeader, RouterLink, Tab, Tabs, ViewStateHost],
  templateUrl: './case-detail.html',
  styleUrl: './case-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseDetail {
  private readonly procedures = inject(ProceduresClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly session = inject(SessionStore);
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

  protected readonly detail = computed(() => dataOf(this.state()));
  protected readonly surgicalCase = computed(() => this.detail()?.case ?? null);
  protected readonly canRecord = computed(() => canRecordInRoom(this.session.roles()));

  protected readonly title = computed(() => this.surgicalCase()?.caseNumber ?? 'Intervención');
  protected readonly subtitle = computed(() => {
    const c = this.surgicalCase();
    if (c === null) return 'Ficha de la intervención';
    const room = c.operatingRoom === undefined ? 'sin quirófano' : `${c.operatingRoom.code} · ${c.operatingRoom.name}`;
    return `${room} · ${dateTimeOf(c.scheduledStartAt)}`;
  });

  protected readonly statusLabel = computed(() => {
    const c = this.surgicalCase();
    return c === null ? '' : (this.labels().get(c.statusConceptId)?.display ?? '');
  });

  protected readonly facts = computed<readonly Hecho[]>(() => {
    const c = this.surgicalCase();
    if (c === null) return [];
    const k = c.checklist;
    const phase = (iso: string | null | undefined, label: string) => `${label}: ${iso ? `completa (${timeOf(iso)})` : 'pendiente'}`;
    return [
      { etiqueta: 'Número', valor: c.caseNumber },
      { etiqueta: 'Estado', valor: this.statusLabel() || null },
      { etiqueta: 'Tipo', valor: c.caseType === undefined ? null : (CASE_TYPE_LABELS[c.caseType] ?? c.caseType) },
      { etiqueta: 'Quirófano', valor: c.operatingRoom === undefined ? null : `${c.operatingRoom.code} · ${c.operatingRoom.name}` },
      { etiqueta: 'Ubicación', valor: c.operatingRoom?.path ?? null },
      { etiqueta: 'Programada', valor: c.scheduledStartAt === undefined ? null : `${dateTimeOf(c.scheduledStartAt)}–${timeOf(c.scheduledEndAt)}` },
      {
        etiqueta: 'Ventana reservada',
        valor: c.reservedStartAt === undefined ? null : `${timeOf(c.reservedStartAt)}–${timeOf(c.reservedEndAt)} (+${c.prepMinutes ?? 0} min de preparación, +${c.cleanupMinutes ?? 0} de limpieza)`,
      },
      { etiqueta: 'Bloque', valor: c.block === undefined ? 'Agenda abierta' : c.block.owner },
      {
        etiqueta: 'Check-list OMS',
        valor: k === undefined ? 'Sin iniciar' : [phase(k.signIn, PHASE_LABELS.SIGN_IN), phase(k.timeOut, PHASE_LABELS.TIME_OUT), phase(k.signOut, PHASE_LABELS.SIGN_OUT)].join(' · '),
        tono: k?.signOut ? 'ok' : 'aviso',
      },
    ];
  });

  constructor() {
    effect(() => {
      const id = this.caseId();
      untracked(() => this.load(id));
    });
  }

  protected changeTab(index: number): void {
    this.tab.set(index);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: TABS[index] ?? null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reload(): void {
    this.load(this.caseId(), true);
  }

  private load(id: string, keep = false): void {
    if (!keep || this.detail() === null) this.state.set(loading());
    this.procedures.getCase(id).subscribe({
      next: (detail) => {
        this.state.set(ready(detail));
        this.terminology
          .readConceptLabels([detail.case.statusConceptId])
          .pipe(catchError(() => of(new Map() as ConceptLabels)))
          .subscribe((labels) => this.labels.update((prev) => new Map([...prev, ...labels])));
      },
      error: (error: unknown) => this.state.set(errorToViewState<SurgicalCaseDetail>(error)),
    });
  }
}
