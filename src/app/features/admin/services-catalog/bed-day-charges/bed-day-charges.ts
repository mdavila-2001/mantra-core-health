import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type TemplateRef } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, filter, map, of, startWith, switchMap } from 'rxjs';

import { InfrastructureItemsClient } from '../../../../core/data-access/accounting/infrastructure-items.client';
import { bedCategoryCode, currencyCode } from '../../../../core/data-access/infra-concepts';
import { SiteContextStore } from '../../../../core/data-access/operating-rooms/site-context.store';
import { amountOf } from '../../../../core/data-access/space-billing/space-billing.rules';
import { SpaceBillingClient } from '../../../../core/data-access/space-billing/space-billing.client';
import type { ChargeCapture, Inpatient, SpaceTariff } from '../../../../core/data-access/space-billing/space-billing.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, empty, loading, mapData, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { SiteSwitch } from '../../../interventions/site-switch/site-switch';

const BED_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  BED_CAT_PRIVATE: 'Cama privada',
  BED_CAT_SHARED: 'Cama compartida',
  BED_CAT_ICU: 'Cama de terapia intensiva',
  BED_CAT_INTERMEDIATE: 'Cama de cuidados intermedios',
  BED_CAT_NEONATAL: 'Cama neonatal',
};

const STATUS: Readonly<Record<ChargeCapture['status'], { label: string; variant: 'warning' | 'success' | 'error' }>> = {
  CHG_PENDING: { label: 'Pendiente de revisión', variant: 'warning' },
  CHG_INVOICED: { label: 'Facturado', variant: 'success' },
  CHG_VOIDED: { label: 'Anulado', variant: 'error' },
};

/** Los cargos leídos y para qué encuentro: lo que llega se compara con lo elegido. */
interface Loaded {
  readonly encounterId: string;
  readonly charges: readonly ChargeCapture[];
  readonly asOf: string;
}

const dateTime = (iso: string | null): string =>
  iso === null ? 'sin fecha' : new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * **Cargos de día-cama** — `/administration/services-catalog/bed-day-charges` (F5e).
 *
 * Facturación elige una internación de la sede y ve sus días-cama
 * **pendientes** devengados por la regla de medianoche: fecha de servicio, cama
 * a medianoche, categoría, tarifa vigente (foto del precio) y centro de costo.
 * Un día sin tarifa queda sin precio, con alerta: no se inventa. «Devengar
 * hasta hoy» es idempotente: re-ejecutarlo no duplica.
 *
 * ## Formas de la API
 *
 * `pending-charges` es un arreglo de `chargeView` (ids sueltos: cama, categoría,
 * centro de costo, tarifa) y `bed-day-charges/run` devuelve
 * `{created: ChargeCapture[], skipped}`. Los rótulos se resuelven con la
 * estructura de la sede, las tarifas y los centros de costo; lo que no se
 * pueda resolver se dice («Cama sin identificar»), nunca un uuid.
 *
 * No hay lectura de estancias de facturación en la API: las internaciones
 * vigentes salen de `GET /sites/:siteId/inpatients` (F3). Se puede llegar con
 * `?encounter=` desde otra pantalla.
 *
 * ## Carreras (H5)
 *
 * Cargos por clave (encuentro, reintento) con `switchMap`, y lo recibido lleva
 * su encuentro: si no coincide con el elegido no se pinta. Nunca se ven los
 * cargos de otra estancia bajo la elegida.
 */
@Component({
  selector: 'app-bed-day-charges',
  imports: [Alert, AppButton, AppButtonLink, Badge, Card, DataTable, FormField, PageHeader, RouterLink, Select, SiteSwitch, ViewStateHost],
  templateUrl: './bed-day-charges.html',
  styleUrl: './bed-day-charges.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedDayCharges {
  private readonly billing = inject(SpaceBillingClient);
  private readonly accounting = inject(InfrastructureItemsClient);
  private readonly siteContext = inject(SiteContextStore);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly encounterId = computed(() => this.query().get('encounter'));

  protected readonly stays = signal<ViewState<readonly Inpatient[]>>(loading());
  private readonly loaded = signal<ViewState<Loaded>>(loading());
  private readonly reloads = signal(0);
  private readonly tariffs = signal<readonly SpaceTariff[]>([]);
  private readonly costCenters = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly running = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly lastRun = signal<{ created: number; skipped: number } | null>(null);

  private readonly spaces = computed(() => new Map((dataOf(this.siteContext.directory())?.careSpaces ?? []).map((s) => [s.id, `${s.code} · ${s.name}`])));

  protected readonly stayOptions = computed<readonly SelectOption<string>[]>(() =>
    (dataOf(this.stays()) ?? []).map((s) => ({
      value: s.encounterId,
      label: this.bedOf(s.bed.careSpaceId),
      description: `Desde ${dateTime(s.since)}${s.losDays === null ? '' : ` · ${s.losDays} días`}`,
    })),
  );

  protected readonly charges = computed<ViewState<readonly ChargeCapture[]>>(() => {
    const id = this.encounterId();
    if (id === null) return empty({ label: 'Elija una internación arriba' }, 'Elija la internación cuyos cargos quiere revisar.');
    const s = this.loaded();
    // Lo que llegó para otro encuentro no se pinta bajo el elegido.
    if ((s.status === 'ready' || s.status === 'stale') && s.data.encounterId !== id) return loading();
    const list = mapData(s, (d) => d.charges.filter((c) => c.encounterId === id && c.source === 'BED_DAY'));
    return list.status === 'ready' && list.data.length === 0
      ? empty({ label: 'Use «Devengar hasta hoy»' }, 'La internación no tiene días-cama pendientes: se generan al cierre de cada medianoche.')
      : list;
  });

  protected readonly asOf = computed(() => {
    const s = this.loaded();
    return s.status === 'ready' && s.data.encounterId === this.encounterId() ? s.data.asOf : null;
  });
  protected readonly total = computed(() => {
    const list = dataOf(this.charges()) ?? [];
    return list.filter((c) => c.unitPrice !== null).reduce((sum, c) => sum + Number(amountOf(c.quantity, c.unitPrice)), 0).toFixed(2);
  });
  protected readonly missingTariff = computed(() => (dataOf(this.charges()) ?? []).some((c) => c.unitPrice === null));

  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('dateCell');
  private readonly bedCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('bedCell');
  private readonly priceCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('priceCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('statusCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<ChargeCapture>[]>(() => [
    { key: 'serviceDate', header: 'Día de servicio', priority: 1, cell: this.dateCell() },
    { key: 'careSpaceId', header: 'Cama a medianoche', priority: 1, cell: this.bedCell() },
    { key: 'unitPrice', header: 'Importe', priority: 1, cell: this.priceCell(), align: 'end' },
    { key: 'costCenterId', header: 'Centro de costo', priority: 3, cell: this.statusCell() },
    { key: 'id', header: 'Acciones', priority: 2, cell: this.actionsCell(), align: 'end' },
  ]);

  protected readonly byId = (c: ChargeCapture): string => c.id;

  constructor() {
    this.siteContext.ensureDirectory();
    // Internaciones, tarifas y centros de costo por sede/práctica; cambiar de
    // sede cancela la lectura anterior.
    toObservable(computed(() => ({ siteId: this.siteContext.siteId(), n: this.reloads() })))
      .pipe(
        filter((k): k is { siteId: string; n: number } => k.siteId !== null),
        switchMap(({ siteId }) =>
          this.billing.listInpatients(siteId).pipe(
            map((list) => (list.length === 0 ? empty({ label: 'Volver a las tarifas', route: '/administration/services-catalog', queryParams: { tab: 'space-tariffs' } }, 'La sede no tiene personas internadas ahora.') : ready(list)) as ViewState<readonly Inpatient[]>),
            catchError((e: unknown) => of(errorToViewState<readonly Inpatient[]>(e))),
            startWith(loading() as ViewState<readonly Inpatient[]>),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.stays.set(s));
    toObservable(this.siteContext.practiceId)
      .pipe(
        filter((id): id is string => id !== null),
        switchMap((practiceId) => this.billing.listTariffs(practiceId).pipe(catchError(() => of([] as readonly SpaceTariff[])))),
        takeUntilDestroyed(),
      )
      .subscribe((t) => this.tariffs.set(t));
    toObservable(this.siteContext.practiceId)
      .pipe(
        filter((id): id is string => id !== null),
        // Facturación puede no leer contabilidad: sin nombres, se dice «asignado».
        switchMap((practiceId) => this.accounting.listCostCenters(practiceId).pipe(catchError(() => of([])))),
        takeUntilDestroyed(),
      )
      .subscribe((list) => this.costCenters.set(new Map(list.map((c) => [c.id, `${c.code} · ${c.name}`]))));
    toObservable(computed(() => ({ id: this.encounterId(), n: this.reloads() })))
      .pipe(
        filter((k): k is { id: string; n: number } => k.id !== null),
        switchMap(({ id }) =>
          this.billing.getPendingCharges(id).pipe(
            map((charges) => ready({ encounterId: id, charges, asOf: new Date().toISOString() }) as ViewState<Loaded>),
            catchError((e: unknown) => of(errorToViewState<Loaded>(e))),
            startWith(loading() as ViewState<Loaded>),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.loaded.set(s));
  }

  protected chooseStay(id: string | null): void {
    this.lastRun.set(null);
    this.failure.set(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { encounter: id }, queryParamsHandling: 'merge' });
  }

  protected bedOf(careSpaceId: string | null): string {
    return (careSpaceId && this.spaces().get(careSpaceId)) || 'Cama sin identificar';
  }

  protected categoryOf(c: ChargeCapture): string {
    const code = bedCategoryCode(c.bedCategoryConceptId);
    return code === null ? 'Sin categoría' : (BED_CATEGORY_LABELS[code] ?? code);
  }

  protected costCenterOf(c: ChargeCapture): string {
    if (c.costCenterId === null) return 'Sin centro de costo';
    return this.costCenters().get(c.costCenterId) ?? 'Centro de costo asignado';
  }

  protected statusOf(c: ChargeCapture): { label: string; variant: 'warning' | 'success' | 'error' } {
    return STATUS[c.status];
  }

  /** Moneda de la tarifa aplicada; la vista de la tarifa todavía puede no traerla. */
  protected currencyOf(c: ChargeCapture): string {
    const t = this.tariffs().find((x) => x.id === c.spaceTariffId);
    return currencyCode(t?.currencyConceptId) ?? 'BOB';
  }

  protected amount(c: ChargeCapture): string {
    const a = amountOf(c.quantity, c.unitPrice);
    return a === null ? 'Sin tarifa vigente' : `${Number(a).toLocaleString('es-BO', { minimumFractionDigits: 2 })} ${this.currencyOf(c)}`;
  }

  protected run(): void {
    const id = this.encounterId();
    if (id === null || this.running()) return;
    this.running.set(true);
    this.failure.set(null);
    this.billing.runBedDay(id).subscribe({
      next: (r) => {
        this.running.set(false);
        this.lastRun.set({ created: r.created.length, skipped: r.skipped });
        this.reload();
      },
      error: (error: unknown) => {
        this.running.set(false);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }

  protected async voidCharge(c: ChargeCapture): Promise<void> {
    const reason = await this.dialogs.confirmWithReason(
      { title: 'Anular el cargo', message: `El día-cama del ${c.serviceDate} queda anulado; nunca se edita un cargo.`, confirmLabel: 'Anular', destructive: true },
      { label: 'Motivo', minLength: 3, maxLength: 500 },
    );
    if (reason === null) return;
    this.billing.voidCharge(c.id, reason).subscribe({
      next: () => this.reload(),
      error: (error: unknown) => this.failure.set(errorToViewState<never>(error)),
    });
  }

  protected reload(): void {
    if (this.siteContext.state().status !== 'ready') this.siteContext.reload();
    this.reloads.update((n) => n + 1);
  }

  protected timeOf(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}
