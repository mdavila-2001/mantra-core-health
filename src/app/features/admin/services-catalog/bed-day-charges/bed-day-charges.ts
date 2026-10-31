import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { SiteContextStore } from '../../../../core/data-access/operating-rooms/site-context.store';
import { amountOf } from '../../../../core/data-access/space-billing/space-billing.rules';
import { SpaceBillingClient } from '../../../../core/data-access/space-billing/space-billing.client';
import type { BedDayStay, ChargeCapture, EncounterCharges } from '../../../../core/data-access/space-billing/space-billing.types';
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

const dateTime = (iso: string | null): string =>
  iso === null ? 'en curso' : new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * **Cargos de día-cama** — `/administration/services-catalog/bed-day-charges` (F5e).
 *
 * Facturación elige una estancia y ve los días-cama devengados por la regla de
 * medianoche: fecha de servicio, cama ocupada a medianoche, categoría,
 * tarifa vigente (foto del precio) y centro de costo de la unidad. Un día sin
 * tarifa vigente queda pendiente **sin precio**, con alerta: no se inventa.
 * «Devengar hasta hoy» es idempotente: re-ejecutarlo no duplica.
 */
@Component({
  selector: 'app-bed-day-charges',
  imports: [Alert, AppButton, AppButtonLink, Badge, Card, DataTable, FormField, PageHeader, RouterLink, Select, ViewStateHost],
  templateUrl: './bed-day-charges.html',
  styleUrl: './bed-day-charges.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedDayCharges {
  private readonly billing = inject(SpaceBillingClient);
  private readonly siteContext = inject(SiteContextStore);
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly encounterId = computed(() => this.query().get('encounter'));

  protected readonly stays = signal<ViewState<readonly BedDayStay[]>>(loading());
  private readonly loaded = signal<ViewState<EncounterCharges>>(loading());
  protected readonly running = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly lastRun = signal<{ created: number; skipped: number } | null>(null);

  private readonly siteId = computed(() => dataOf(this.siteContext.state())?.sites[0]?.id ?? null);
  protected readonly canRun = computed(() => this.session.roles().includes('BILLING'));

  protected readonly stayOptions = computed<readonly SelectOption<string>[]>(() =>
    (dataOf(this.stays()) ?? []).map((s) => ({ value: s.encounterId, label: s.patientName, description: `${dateTime(s.admittedAt)} → ${dateTime(s.dischargedAt)} · ${s.currentBed}` })),
  );

  protected readonly charges = computed<ViewState<readonly ChargeCapture[]>>(() => {
    if (this.encounterId() === null) return empty({ label: 'Elija una estancia arriba' }, 'Elija la estancia cuyos cargos quiere revisar.');
    const s = mapData(this.loaded(), (d) => d.charges);
    return s.status === 'ready' && s.data.length === 0
      ? empty({ label: this.canRun() ? 'Use «Devengar hasta hoy»' : 'Se generan al cierre del censo' }, 'La estancia todavía no tiene cargos: se generan al cierre del censo de cada día.')
      : s;
  });

  protected readonly asOf = computed(() => dataOf(this.loaded())?.asOf ?? null);
  protected readonly total = computed(() => {
    const list = dataOf(this.charges()) ?? [];
    const live = list.filter((c) => c.status.code !== 'CHG_VOIDED' && c.unitPrice !== null);
    return live.reduce((sum, c) => sum + Number(amountOf(c.quantity, c.unitPrice)), 0).toFixed(2);
  });
  protected readonly missingTariff = computed(() => (dataOf(this.charges()) ?? []).some((c) => c.unitPrice === null && c.status.code !== 'CHG_VOIDED'));

  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('dateCell');
  private readonly bedCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('bedCell');
  private readonly priceCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('priceCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('statusCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: ChargeCapture }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<ChargeCapture>[]>(() => [
    { key: 'serviceDate', header: 'Día de servicio', priority: 1, cell: this.dateCell() },
    { key: 'careSpace', header: 'Cama a medianoche', priority: 1, cell: this.bedCell() },
    { key: 'unitPrice', header: 'Importe', priority: 1, cell: this.priceCell(), align: 'end' },
    { key: 'costCenter', header: 'Centro de costo', priority: 3, cell: this.statusCell() },
    ...(this.canRun() ? [{ key: 'id', header: 'Acciones', priority: 2, cell: this.actionsCell(), align: 'end' as const }] : []),
  ]);

  protected readonly byId = (c: ChargeCapture): string => c.id;

  constructor() {
    this.siteContext.ensure();
    effect(() => {
      const siteId = this.siteId();
      if (siteId === null) return;
      untracked(() => this.loadStays(siteId));
    });
    effect(() => {
      const id = this.encounterId();
      if (id === null) return;
      untracked(() => this.loadCharges(id));
    });
  }

  protected chooseStay(id: string | null): void {
    this.lastRun.set(null);
    this.failure.set(null);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { encounter: id }, queryParamsHandling: 'merge' });
  }

  protected amount(c: ChargeCapture): string {
    const a = amountOf(c.quantity, c.unitPrice);
    return a === null ? 'Sin tarifa vigente' : `${Number(a).toLocaleString('es-BO', { minimumFractionDigits: 2 })} ${c.currencyCode}`;
  }

  protected run(): void {
    const id = this.encounterId();
    if (id === null || this.running()) return;
    this.running.set(true);
    this.failure.set(null);
    this.billing.runBedDay(id).subscribe({
      next: (r) => {
        this.running.set(false);
        this.lastRun.set({ created: r.created, skipped: r.skipped });
        this.loadCharges(id);
        const siteId = this.siteId();
        if (siteId !== null) this.loadStays(siteId);
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
      next: () => this.loadCharges(c.encounterId),
      error: (error: unknown) => this.failure.set(errorToViewState<never>(error)),
    });
  }

  protected reload(): void {
    const id = this.encounterId();
    if (id !== null) this.loadCharges(id);
  }

  protected timeOf(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private loadStays(siteId: string): void {
    this.billing.listStays(siteId).subscribe({
      next: (list) => this.stays.set(list.length === 0 ? empty({ label: 'Volver a las tarifas', route: '/administration/services-catalog', queryParams: { tab: 'space-tariffs' } }, 'La sede no tiene estancias de internación.') : ready(list)),
      error: (error: unknown) => this.stays.set(errorToViewState<readonly BedDayStay[]>(error)),
    });
  }

  private loadCharges(id: string): void {
    this.loaded.set(loading());
    this.billing.getEncounterCharges(id).subscribe({
      next: (d) => this.loaded.set(ready(d)),
      error: (error: unknown) => this.loaded.set(errorToViewState<EncounterCharges>(error)),
    });
  }
}
