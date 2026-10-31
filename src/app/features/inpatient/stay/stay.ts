import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, type Observable } from 'rxjs';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { DischargeDispositionCode, EncounterLocation, InpatientStay, PlacementIncident } from '../../../core/data-access/adt/adt.types';
import { RULE_LABEL } from '../../../core/data-access/adt/bed-compatibility';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, mapData, ready, routeAuthPending } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Select } from '../../../shared/components/atoms/select/select';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { DISPOSITIONS } from '../bed-actions/discharge-dialog';
import { InpatientAccessStore } from '../inpatient-access.store';
import { BED_BOARD_ROUTE, shortDateTime } from '../inpatient-presentation';

export const STAY_TABS = ['bed', 'movements', 'incidents', 'discharge'] as const;

/**
 * **Ficha de internación** — `/inpatient/stays/:encounterId` (F3.4).
 *
 * UNA tarjeta con cuatro pestañas (regla del 09/09): Cama actual · Movimientos
 * (línea de tiempo A01/A02/A17/A03) · Compatibilidad e incidentes · Egreso.
 * Cada escritura relee la ficha: lo que se ve es lo que respondió la API.
 */
@Component({
  selector: 'app-stay',
  imports: [AppButton, AppButtonLink, Badge, Card, DataTable, DatePicker, FactList, FormActions, FormField, PageHeader, RouterLink, Select, Tab, Tabs, Textarea, ViewStateHost],
  templateUrl: './stay.html',
  styleUrl: './stay.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stay {
  private readonly adt = inject(AdtClient);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly access = inject(InpatientAccessStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly dispositions = DISPOSITIONS;
  protected readonly boardRoute = BED_BOARD_ROUTE;
  protected readonly ruleName = (rule: string): string => RULE_LABEL[rule as keyof typeof RULE_LABEL] ?? rule;
  protected readonly when = (iso: string | null) => shortDateTime(iso) ?? '—';

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly id = computed(() => this.params().get('encounterId') ?? '');

  protected readonly tab = linkedSignal(() => Math.max(0, STAY_TABS.indexOf(this.query().get('tab') as (typeof STAY_TABS)[number])));

  protected readonly stay = signal<ViewState<InpatientStay>>(routeAuthPending());
  protected readonly data = computed(() => dataOf(this.stay()));
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly working = signal(false);

  protected readonly disposition = signal<DischargeDispositionCode | null>(null);
  protected readonly occurredAt = signal<Date | null>(null);
  protected readonly dischargeNote = signal('');
  protected readonly triedDischarge = signal(false);

  protected readonly title = computed(() => this.data()?.patient.displayName ?? 'Internación');
  protected readonly subtitle = computed(() => {
    const s = this.data();
    return s === null ? 'Ficha de internación' : `${s.currentBed ? `Cama ${s.currentBed.code} · ${s.currentBed.unitName ?? ''}` : s.status === 'FINISHED' ? 'Egresada' : 'Pendiente de cama'} · ${s.losDays} día(s)`;
  });
  protected readonly canReview = computed(() => this.access.can(this.data()?.siteId ?? null, 'incident.review'));
  protected readonly canDischarge = computed(() => this.access.can(this.data()?.siteId ?? null, 'adt.discharge') && this.data()?.status === 'IN_PROGRESS');

  protected readonly bedFacts = computed<readonly Hecho[]>(() => {
    const s = this.data();
    if (s === null) return [];
    return [
      { etiqueta: 'Paciente', valor: `${s.patient.displayName} · ${s.patient.sexCode === 'MALE' ? 'masculino' : 'femenino'} · ${s.patient.ageYears} años` },
      { etiqueta: 'Estado', valor: s.status === 'IN_PROGRESS' ? 'En curso' : 'Egresada', tono: s.status === 'IN_PROGRESS' ? 'ok' : 'neutro' },
      { etiqueta: 'Cama actual', valor: s.currentBed ? `${s.currentBed.code} · ${s.currentBed.name}` : 'Sin cama' },
      { etiqueta: 'Unidad', valor: s.currentBed?.unitName ?? null },
      { etiqueta: 'Reserva', valor: s.reservedBed ? `${s.reservedBed.code} · ${s.reservedBed.name}` : null },
      { etiqueta: 'Nivel de cuidado', valor: s.levelOfCare.display },
      { etiqueta: 'Precaución', valor: `${s.isolation.display}${s.isolationOrganism ? ` · ${s.isolationOrganism}` : ''}` },
      { etiqueta: 'Origen', valor: s.admissionSource.display },
      { etiqueta: 'Motivo', valor: s.reasonText },
      { etiqueta: 'Profesional a cargo', valor: s.attendingName },
      { etiqueta: 'Ingreso', valor: shortDateTime(s.startedAt) },
      { etiqueta: 'Alta prevista', valor: shortDateTime(s.expectedDischargeAt) },
      { etiqueta: 'Egreso', valor: s.endedAt ? `${shortDateTime(s.endedAt)} · ${s.disposition?.display ?? ''}` : null },
      { etiqueta: 'Días de estancia', valor: String(s.losDays) },
    ];
  });

  protected readonly movements = computed<ViewState<readonly EncounterLocation[]>>(() => {
    const m = mapData(this.stay(), (s) => [...s.movements].reverse());
    return m.status === 'ready' && m.data.length === 0 ? empty({ label: 'Asignar una cama desde el tablero', route: BED_BOARD_ROUTE }, 'Esta internación todavía no tuvo cama.') : m;
  });

  protected readonly incidents = computed<ViewState<readonly PlacementIncident[]>>(() => {
    const m = mapData(this.stay(), (s) => s.incidents);
    return m.status === 'ready' && m.data.length === 0 ? empty({ label: 'Cada forzado de compatibilidad deja un incidente acá' }, 'Sin incidentes de ubicación: todas las camas fueron compatibles.') : m;
  });

  private readonly cellEvent = viewChild<TemplateRef<{ $implicit: EncounterLocation }>>('cellEvent');
  private readonly cellBed = viewChild<TemplateRef<{ $implicit: EncounterLocation }>>('cellBed');
  private readonly cellPeriod = viewChild<TemplateRef<{ $implicit: EncounterLocation }>>('cellPeriod');
  private readonly cellMoveActions = viewChild<TemplateRef<{ $implicit: EncounterLocation }>>('cellMoveActions');
  private readonly cellRules = viewChild<TemplateRef<{ $implicit: PlacementIncident }>>('cellRules');
  private readonly cellIncStatus = viewChild<TemplateRef<{ $implicit: PlacementIncident }>>('cellIncStatus');
  private readonly cellIncActions = viewChild<TemplateRef<{ $implicit: PlacementIncident }>>('cellIncActions');

  protected readonly moveColumns = computed<readonly ColumnDef<EncounterLocation>[]>(() => [
    { key: 'hl7Event', header: 'Movimiento', priority: 1, cell: this.cellEvent() },
    { key: 'bed', header: 'Cama', priority: 1, cell: this.cellBed() },
    { key: 'periodStart', header: 'Período', priority: 2, cell: this.cellPeriod() },
    { key: 'id', header: 'Acciones', priority: 1, align: 'end', accion: true, cell: this.cellMoveActions() },
  ]);

  protected readonly incidentColumns = computed<readonly ColumnDef<PlacementIncident>[]>(() => [
    { key: 'bedCode', header: 'Cama', priority: 1 },
    { key: 'violations', header: 'Reglas forzadas', priority: 1, cell: this.cellRules() },
    { key: 'justification', header: 'Justificación', priority: 2 },
    { key: 'status', header: 'Estado', priority: 1, cell: this.cellIncStatus() },
    { key: 'id', header: 'Acciones', priority: 1, align: 'end', accion: true, cell: this.cellIncActions() },
  ]);

  protected readonly byId = (x: { readonly id: string }): string => x.id;

  constructor() {
    this.access.ensure();
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected changeTab(i: number): void {
    this.tab.set(i);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: STAY_TABS[i] }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reload(): void {
    this.load(this.id());
  }

  protected async cancelMovement(m: EncounterLocation): Promise<void> {
    const reason = await this.dialogs.confirmWithReason(
      { title: m.status.code === 'LOCATION_RESERVED' ? 'Cancelar la reserva' : 'Cancelar el traslado', message: m.status.code === 'LOCATION_RESERVED' ? `La cama ${m.bed.code} vuelve a quedar libre.` : 'El paciente vuelve a la cama anterior si sigue libre.', confirmLabel: 'Cancelar el movimiento', destructive: true },
      { label: 'Motivo', minLength: 3, maxLength: 300 },
    );
    if (reason === null) return;
    this.write(this.adt.cancelLocation(m.id, reason));
  }

  protected async review(i: PlacementIncident): Promise<void> {
    const nota = await this.dialogs.confirmWithReason(
      { title: 'Revisar el incidente', message: `Forzado en la cama ${i.bedCode}: ${i.violations.map((v) => RULE_LABEL[v.rule]).join(', ')}.`, confirmLabel: 'Marcar revisado' },
      { label: 'Nota de revisión', minLength: 5, maxLength: 500 },
    );
    if (nota === null) return;
    this.write(this.adt.reviewIncident(i.id, { status: 'PLC_INC_REVIEWED', reviewNote: nota }));
  }

  protected discharge(): void {
    this.triedDischarge.set(true);
    const s = this.data();
    const d = this.disposition();
    if (s === null || d === null || (this.occurredAt()?.getTime() ?? 0) > Date.now()) return;
    this.write(
      this.adt.discharge(s.encounterId, s.rowVersion, {
        dischargeDispositionCode: d,
        occurredAt: (this.occurredAt() ?? new Date()).toISOString(),
        ...(this.dischargeNote().trim() ? { reasonText: this.dischargeNote().trim() } : {}),
      }),
    );
  }

  private write(pedido: Observable<unknown>): void {
    this.working.set(true);
    this.failure.set(null);
    pedido.subscribe({
      next: () => {
        this.working.set(false);
        this.reload();
      },
      error: (e: unknown) => {
        this.working.set(false);
        this.failure.set(errorToViewState<never>(e));
      },
    });
  }

  private load(id: string): void {
    this.stay.set(loading());
    this.adt
      .getStay(id)
      .pipe(
        map((s) => ready(s) as ViewState<InpatientStay>),
        catchError((e: unknown) => of(errorToViewState<InpatientStay>(e))),
      )
      .subscribe((s) => this.stay.set(s.status === 'not-found' ? { status: 'not-found', nextAction: { label: 'Volver al tablero', route: BED_BOARD_ROUTE } } : s));
  }
}
