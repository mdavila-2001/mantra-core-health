import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal, viewChild, type TemplateRef } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, filter, forkJoin, map, of, startWith, switchMap, type Observable } from 'rxjs';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { EncounterLocation, InpatientStay, PlacementIncident } from '../../../core/data-access/adt/adt.types';
import { ruleLabel } from '../../../core/data-access/adt/bed-compatibility';
import { opsLabel } from '../../../core/data-access/infrastructure-ops/ops-labels';
import { InfrastructureClient } from '../../../core/data-access/infrastructure/infrastructure.client';
import type { CareSpaceDetail } from '../../../core/data-access/infrastructure/infrastructure.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, mapData, ready, routeAuthPending } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { DischargeForm } from '../bed-actions/discharge-form';
import { InpatientAccessStore } from '../inpatient-access.store';
import { BED_BOARD_ROUTE, DEFAULT_TIME_ZONE, shortDateTime } from '../inpatient-presentation';

export const STAY_TABS = ['bed', 'movements', 'incidents', 'discharge'] as const;

const HL7: Readonly<Record<string, string>> = { ADT_ADMIT: 'A01', ADT_TRANSFER: 'A02', ADT_SWAP: 'A17', ADT_RESERVE: 'A05' };
/** La ventana de anulación ADT de la API (fija en 120 min, desvío API-F2F5). */
const CANCEL_WINDOW_MS = 120 * 60_000;

/** La ficha tal como la arma la pantalla: lo de la API + nombre del paciente + código de cada cama. */
export interface StayView {
  readonly stay: InpatientStay;
  readonly patientName: string | null;
  readonly beds: ReadonlyMap<string, CareSpaceDetail>;
  readonly siteId: string | null;
}

/** Una fila de movimientos, con su cama y su evento HL7 ya resueltos. */
export interface MovementRow extends EncounterLocation {
  readonly bedCode: string;
  readonly bedName: string;
  readonly hl7: string;
  readonly cancellable: boolean;
}

/** Reserva vigente, o traslado reciente con cama anterior: la API decide igual (409 si no). */
export function isCancellable(m: EncounterLocation, now: number): boolean {
  if (m.status === 'LOCATION_RESERVED' && m.periodEnd === null) return true;
  return (
    m.status === 'LOCATION_ACTIVE' &&
    m.periodEnd === null &&
    m.movement === 'ADT_TRANSFER' &&
    m.previousEncounterLocationId !== null &&
    m.periodStart !== null &&
    now - Date.parse(m.periodStart) <= CANCEL_WINDOW_MS
  );
}

/**
 * **Ficha de internación** — `/inpatient/stays/:encounterId` (F3.4).
 *
 * UNA tarjeta con cuatro pestañas (regla del 09/09): Cama actual · Movimientos
 * (línea de tiempo A01/A02/A17/A03) · Compatibilidad e incidentes · Egreso.
 *
 * La API devuelve `{encounter, movements, incidents}` con ids; la pantalla
 * completa el nombre del paciente (expediente) y el código de cada cama
 * (estructura de F1). **Espera el S1**: no pide la estancia hasta saber qué
 * puede la persona. Cada escritura relee la ficha.
 */
@Component({
  selector: 'app-stay',
  imports: [AppButton, AppButtonLink, Badge, Card, DataTable, DischargeForm, FactList, PageHeader, RouterLink, Tab, Tabs, ViewStateHost],
  templateUrl: './stay.html',
  styleUrl: './stay.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stay {
  private readonly adt = inject(AdtClient);
  private readonly infra = inject(InfrastructureClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly access = inject(InpatientAccessStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly boardRoute = BED_BOARD_ROUTE;
  protected readonly label = opsLabel;
  protected readonly ruleName = ruleLabel;

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly id = computed(() => this.params().get('encounterId') ?? '');

  protected readonly tab = linkedSignal(() => Math.max(0, STAY_TABS.indexOf(this.query().get('tab') as (typeof STAY_TABS)[number])));

  private readonly reloads = signal(0);
  protected readonly view = signal<ViewState<StayView>>(routeAuthPending());
  protected readonly data = computed(() => dataOf(this.view()));
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly working = signal(false);

  protected readonly timeZone = computed(() => this.access.site(this.data()?.siteId ?? null)?.timeZone ?? DEFAULT_TIME_ZONE);
  protected readonly when = (iso: string | null) => shortDateTime(iso, this.timeZone()) ?? '—';
  protected readonly inProgress = computed(() => this.data()?.stay.encounter.status === 'ENCOUNTER_IN_PROGRESS');
  private readonly currentMove = computed(() => this.data()?.stay.movements.find((m) => m.status === 'LOCATION_ACTIVE' && m.periodEnd === null) ?? null);
  protected readonly currentBed = computed(() => {
    const m = this.currentMove();
    return m?.careSpaceId ? (this.data()?.beds.get(m.careSpaceId) ?? null) : null;
  });
  protected readonly losDays = computed(() => {
    const e = this.data()?.stay.encounter;
    if (!e?.startAt) return null;
    const fin = e.endAt ? Date.parse(e.endAt) : Date.now();
    return Math.max(1, Math.floor((fin - Date.parse(e.startAt)) / 86_400_000));
  });

  protected readonly title = computed(() => this.data()?.patientName ?? 'Internación');
  protected readonly subtitle = computed(() => {
    const d = this.data();
    if (d === null) return 'Ficha de internación';
    const cama = this.currentBed();
    const donde = cama ? `Cama ${cama.code}` : this.inProgress() ? 'Pendiente de cama' : 'Egresada';
    return `${donde} · ${this.losDays() ?? '—'} día(s)`;
  });
  protected readonly canReview = computed(() => this.access.can(this.data()?.siteId ?? null, 'f3.incident.review'));
  protected readonly canPlace = computed(() => this.access.can(this.data()?.siteId ?? null, 'f3.adt.place'));
  protected readonly canDischarge = computed(() => this.canPlace() && this.inProgress());

  protected readonly bedFacts = computed<readonly Hecho[]>(() => {
    const d = this.data();
    if (d === null) return [];
    const e = d.stay.encounter;
    const cama = this.currentBed();
    return [
      { etiqueta: 'Paciente', valor: d.patientName },
      { etiqueta: 'Estado', valor: opsLabel(e.status), tono: this.inProgress() ? 'ok' : 'neutro' },
      { etiqueta: 'Cama actual', valor: cama ? `${cama.code} · ${cama.name}` : 'Sin cama' },
      { etiqueta: 'Ubicación', valor: cama ? cama.path.map((p) => p.name).join(' › ') : null },
      { etiqueta: 'Nivel de cuidado', valor: e.levelOfCare === null ? null : opsLabel(e.levelOfCare) },
      { etiqueta: 'Origen', valor: e.admissionSource === null ? null : opsLabel(e.admissionSource) },
      { etiqueta: 'Ingreso', valor: shortDateTime(e.startAt, this.timeZone()) },
      { etiqueta: 'Alta prevista', valor: shortDateTime(e.expectedDischargeAt, this.timeZone()) },
      { etiqueta: 'Egreso', valor: e.endAt ? `${shortDateTime(e.endAt, this.timeZone())} · ${opsLabel(e.dischargeDisposition)}` : null },
      { etiqueta: 'Días de estancia', valor: this.losDays() === null ? null : String(this.losDays()) },
    ];
  });

  protected readonly movements = computed<ViewState<readonly MovementRow[]>>(() => {
    const ahora = Date.now();
    const m = mapData(this.view(), (v) =>
      [...v.stay.movements].reverse().map((x) => {
        const cama = x.careSpaceId ? v.beds.get(x.careSpaceId) : undefined;
        const base = x.movement ? (HL7[x.movement] ?? x.movement) : '—';
        return { ...x, bedCode: cama?.code ?? '—', bedName: cama?.name ?? '', hl7: x.endReason === 'ADT_END_DISCHARGE' ? `${base} · A03` : base, cancellable: isCancellable(x, ahora) };
      }),
    );
    return m.status === 'ready' && m.data.length === 0 ? empty({ label: 'Asignar una cama desde el tablero', route: BED_BOARD_ROUTE }, 'Esta internación todavía no tuvo cama.') : m;
  });

  protected readonly incidents = computed<ViewState<readonly (PlacementIncident & { readonly bedCode: string })[]>>(() => {
    const m = mapData(this.view(), (v) => v.stay.incidents.map((i) => ({ ...i, bedCode: v.beds.get(i.careSpaceId)?.code ?? '—' })));
    return m.status === 'ready' && m.data.length === 0 ? empty({ label: 'Cada forzado de compatibilidad deja un incidente acá' }, 'Sin incidentes de ubicación: todas las camas fueron compatibles.') : m;
  });

  private readonly cellEvent = viewChild<TemplateRef<{ $implicit: MovementRow }>>('cellEvent');
  private readonly cellBed = viewChild<TemplateRef<{ $implicit: MovementRow }>>('cellBed');
  private readonly cellPeriod = viewChild<TemplateRef<{ $implicit: MovementRow }>>('cellPeriod');
  private readonly cellMoveActions = viewChild<TemplateRef<{ $implicit: MovementRow }>>('cellMoveActions');
  private readonly cellRules = viewChild<TemplateRef<{ $implicit: PlacementIncident & { readonly bedCode: string } }>>('cellRules');
  private readonly cellIncStatus = viewChild<TemplateRef<{ $implicit: PlacementIncident & { readonly bedCode: string } }>>('cellIncStatus');
  private readonly cellIncActions = viewChild<TemplateRef<{ $implicit: PlacementIncident & { readonly bedCode: string } }>>('cellIncActions');

  protected readonly moveColumns = computed<readonly ColumnDef<MovementRow>[]>(() => [
    { key: 'hl7', header: 'Movimiento', priority: 1, cell: this.cellEvent() },
    { key: 'bedCode', header: 'Cama', priority: 1, cell: this.cellBed() },
    { key: 'periodStart', header: 'Período', priority: 2, cell: this.cellPeriod() },
    { key: 'id', header: 'Acciones', priority: 1, align: 'end', accion: true, cell: this.cellMoveActions() },
  ]);

  protected readonly incidentColumns = computed<readonly ColumnDef<PlacementIncident & { readonly bedCode: string }>[]>(() => [
    { key: 'bedCode', header: 'Cama', priority: 1 },
    { key: 'violations', header: 'Reglas forzadas', priority: 1, cell: this.cellRules() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.cellIncStatus() },
    { key: 'id', header: 'Acciones', priority: 1, align: 'end', accion: true, cell: this.cellIncActions() },
  ]);

  protected readonly byId = (x: { readonly id: string }): string => x.id;

  constructor() {
    this.access.ensure();
    // Espera el S1: sin saber qué puede la persona, no se pide la estancia.
    toObservable(computed(() => ({ ok: this.access.state().status === 'ready', id: this.id(), n: this.reloads() })))
      .pipe(
        filter((x) => x.ok),
        switchMap(({ id }) => this.loadStay(id).pipe(startWith(loading() as ViewState<StayView>))),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.view.set(s));
    // Si el acceso falla (S5/S9), se muestra eso mismo.
    toObservable(this.access.state)
      .pipe(
        filter((a) => a.status !== 'ready' && a.status !== 'route-auth-pending'),
        takeUntilDestroyed(),
      )
      .subscribe((a) => this.view.set(a as ViewState<StayView>));
  }

  protected changeTab(i: number): void {
    this.tab.set(i);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: STAY_TABS[i] }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reload(): void {
    this.reloads.update((n) => n + 1);
  }

  protected afterDischarge(): void {
    this.reload();
  }

  protected async cancelMovement(m: MovementRow): Promise<void> {
    const reserva = m.status === 'LOCATION_RESERVED';
    const reason = await this.dialogs.confirmWithReason(
      { title: reserva ? 'Cancelar la reserva' : 'Cancelar el traslado', message: reserva ? `La cama ${m.bedCode} vuelve a quedar libre.` : 'El paciente vuelve a la cama anterior si sigue libre.', confirmLabel: 'Cancelar el movimiento', destructive: true },
      { label: 'Motivo', minLength: 3, maxLength: 300 },
    );
    if (reason === null) return;
    this.write(this.adt.cancelLocation(m.id, reason));
  }

  /** H4: la revisión manda `REVIEWED` (`ReviewIncidentDto`: `REVIEWED | CLOSED`). */
  protected async review(i: PlacementIncident & { readonly bedCode: string }): Promise<void> {
    const reglas = (i.violations ?? []).map((v) => ruleLabel(v.rule)).join(', ');
    const nota = await this.dialogs.confirmWithReason(
      { title: 'Revisar el incidente', message: `Forzado en la cama ${i.bedCode}${reglas ? `: ${reglas}` : ''}.`, confirmLabel: 'Marcar revisado' },
      { label: 'Nota de revisión', minLength: 5, maxLength: 500 },
    );
    if (nota === null) return;
    this.write(this.adt.reviewIncident(i.id, { status: 'REVIEWED', reviewNote: nota }));
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

  /** La estancia, y después (en paralelo) el nombre del paciente y cada cama de sus movimientos. */
  private loadStay(id: string): Observable<ViewState<StayView>> {
    return this.adt.getStay(id).pipe(
      switchMap((stay) => {
        const camas = [...new Set([...stay.movements.map((m) => m.careSpaceId), ...stay.incidents.map((i) => i.careSpaceId)].filter((x): x is string => !!x))];
        return forkJoin({
          patient: this.profiles.getPatient(stay.encounter.patientProfileId).pipe(catchError(() => of(null))),
          beds: camas.length === 0 ? of([] as (CareSpaceDetail | null)[]) : forkJoin(camas.map((c) => this.infra.getCareSpace(c).pipe(catchError(() => of(null))))),
        }).pipe(
          map(({ patient, beds }) => {
            const porId = new Map(beds.filter((b): b is CareSpaceDetail => b !== null).map((b) => [b.id, b]));
            const ultima = [...stay.movements].reverse().find((m) => m.careSpaceId && porId.has(m.careSpaceId));
            const view: StayView = {
              stay,
              patientName: patient?.displayName ?? patient?.patientCode ?? null,
              beds: porId,
              siteId: ultima?.careSpaceId ? (porId.get(ultima.careSpaceId)?.siteId ?? null) : null,
            };
            return ready(view) as ViewState<StayView>;
          }),
        );
      }),
      catchError((e: unknown) => {
        const s = errorToViewState<StayView>(e);
        return of(s.status === 'not-found' ? ({ status: 'not-found', nextAction: { label: 'Volver al tablero', route: BED_BOARD_ROUTE } } as ViewState<StayView>) : s);
      }),
    );
  }
}
