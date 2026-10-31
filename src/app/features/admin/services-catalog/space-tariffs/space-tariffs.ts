import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild, type TemplateRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import { SiteContextStore } from '../../../../core/data-access/operating-rooms/site-context.store';
import { ServicesCatalogClient } from '../../../../core/data-access/services-catalog/services-catalog.client';
import { SpaceBillingClient } from '../../../../core/data-access/space-billing/space-billing.client';
import type { SpaceTariff, TariffKindCode } from '../../../../core/data-access/space-billing/space-billing.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, mapData, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

const KINDS: readonly SegmentedOption<TariffKindCode>[] = [
  { value: 'TARIFF_BED_DAY', label: 'Día-cama' },
  { value: 'TARIFF_OR_TIME', label: 'Quirófano por tiempo' },
];

const UNIT_MINUTES: readonly SelectOption<string>[] = [
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '60', label: '60 minutos' },
];

const BILLING_WRITERS = ['BILLING', 'SECURITY_ADMIN'];

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * **Tarifas de espacios** — pestaña del catálogo de servicios (F5e).
 *
 * Día-cama por categoría y quirófano por tiempo, versionados: una tarifa no se
 * edita, se **cierra** con una fecha y se carga la siguiente. Así cambiar el
 * precio con vigencia futura no altera los cargos ya devengados (D7). La API
 * rechaza vigencias superpuestas (409 `TARIFF_OVERLAP`) y un ítem de otra
 * práctica (422 `TARIFF_SERVICE_NOT_IN_PRACTICE`).
 */
@Component({
  selector: 'app-space-tariffs',
  imports: [Alert, AppButton, AppButtonLink, Badge, DataTable, FormField, Input, RouterLink, SegmentedControl, Select, ViewStateHost],
  templateUrl: './space-tariffs.html',
  styleUrl: './space-tariffs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceTariffs {
  private readonly billing = inject(SpaceBillingClient);
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly infrastructure = inject(InfrastructureClient);
  private readonly siteContext = inject(SiteContextStore);
  private readonly session = inject(SessionStore);

  protected readonly kinds = KINDS;
  protected readonly unitMinuteOptions = UNIT_MINUTES;

  private readonly loaded = signal<ViewState<readonly SpaceTariff[]>>(loading());
  protected readonly serviceOptions = signal<readonly SelectOption<string>[]>([]);
  protected readonly categoryOptions = signal<readonly SelectOption<string>[]>([]);

  protected readonly kind = signal<TariffKindCode>('TARIFF_BED_DAY');
  protected readonly categoryCode = signal<string | null>(null);
  protected readonly serviceId = signal<string | null>(null);
  protected readonly unitPrice = signal('');
  protected readonly unitMinutes = signal<string | null>('30');
  protected readonly minimumUnits = signal<number>(1);
  protected readonly validFrom = signal(todayIso());
  protected readonly validTo = signal('');

  protected readonly closing = signal<SpaceTariff | null>(null);
  protected readonly closeDate = signal(todayIso());
  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);

  protected readonly practiceId = computed(() => dataOf(this.siteContext.state())?.practiceId ?? null);
  protected readonly canWrite = computed(() => BILLING_WRITERS.some((r) => this.session.roles().includes(r)));

  protected readonly state = computed<ViewState<readonly SpaceTariff[]>>(() => {
    const ctx = this.siteContext.state();
    if (ctx.status !== 'ready' && ctx.status !== 'stale') return mapData(ctx, () => [] as readonly SpaceTariff[]);
    const s = this.loaded();
    return s.status === 'ready' && s.data.length === 0 ? empty({ label: 'Cargue la primera tarifa con el formulario de arriba' }, 'La organización todavía no tiene tarifas de espacios.') : s;
  });

  protected readonly valid = computed(
    () =>
      this.serviceId() !== null &&
      /^\d+(\.\d{1,6})?$/.test(this.unitPrice()) &&
      /^\d{4}-\d{2}-\d{2}$/.test(this.validFrom()) &&
      (this.validTo() === '' || this.validTo() > this.validFrom()) &&
      (this.kind() === 'TARIFF_OR_TIME' ? this.unitMinutes() !== null : this.categoryCode() !== null),
  );

  private readonly targetCell = viewChild.required<TemplateRef<{ $implicit: SpaceTariff }>>('targetCell');
  private readonly priceCell = viewChild.required<TemplateRef<{ $implicit: SpaceTariff }>>('priceCell');
  private readonly validityCell = viewChild.required<TemplateRef<{ $implicit: SpaceTariff }>>('validityCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: SpaceTariff }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<SpaceTariff>[]>(() => [
    { key: 'tariffKind', header: 'Tarifa', priority: 1, cell: this.targetCell() },
    { key: 'serviceName', header: 'Ítem del catálogo', priority: 3 },
    { key: 'unitPrice', header: 'Precio', priority: 1, cell: this.priceCell(), align: 'end' },
    { key: 'validFrom', header: 'Vigencia', priority: 2, cell: this.validityCell() },
    ...(this.canWrite() ? [{ key: 'id', header: 'Acciones', priority: 1, cell: this.actionsCell(), align: 'end' as const }] : []),
  ]);

  protected readonly byId = (t: SpaceTariff): string => t.id;

  constructor() {
    this.siteContext.ensure();
    effect(() => {
      const practiceId = this.practiceId();
      if (practiceId === null) return;
      untracked(() => {
        this.load(practiceId);
        this.catalog.search(practiceId, { limit: 50 }).subscribe({
          next: (page) => this.serviceOptions.set(page.items.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))),
          error: () => this.serviceOptions.set([]),
        });
      });
    });
    this.infrastructure.getCatalog().subscribe({
      next: (c) => this.categoryOptions.set(c.attributes.bedCategory.map((b) => ({ value: b.code, label: b.display }))),
      error: () => this.categoryOptions.set([]),
    });
  }

  protected price(t: SpaceTariff): string {
    return `${Number(t.unitPrice).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t.currencyCode}`;
  }

  protected create(): void {
    const practiceId = this.practiceId();
    const serviceId = this.serviceId();
    if (practiceId === null || serviceId === null || !this.valid() || this.sending()) return;
    const orTime = this.kind() === 'TARIFF_OR_TIME';
    this.run(
      this.billing.createTariff({
        practiceId,
        tariffKindCode: this.kind(),
        serviceCatalogId: serviceId,
        unitPrice: this.unitPrice(),
        currencyCode: 'BOB',
        validFrom: this.validFrom(),
        ...(this.validTo() === '' ? {} : { validTo: this.validTo() }),
        ...(orTime ? { unitMinutes: Number(this.unitMinutes()), minimumUnits: Number(this.minimumUnits()) } : { bedCategoryCode: this.categoryCode()! }),
      }),
      () => {
        this.unitPrice.set('');
        this.validTo.set('');
      },
    );
  }

  protected startClose(t: SpaceTariff): void {
    this.closing.set(t);
    this.closeDate.set(todayIso());
  }

  protected confirmClose(): void {
    const t = this.closing();
    if (t === null || this.sending()) return;
    this.run(this.billing.closeTariff(t.id, this.closeDate()), () => this.closing.set(null));
  }

  protected reload(): void {
    const practiceId = this.practiceId();
    if (practiceId !== null) this.load(practiceId);
  }

  private run(call: ReturnType<SpaceBillingClient['closeTariff']>, done: () => void): void {
    this.sending.set(true);
    this.failure.set(null);
    call.subscribe({
      next: () => {
        this.sending.set(false);
        done();
        this.reload();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }

  private load(practiceId: string): void {
    this.loaded.set(loading());
    this.billing.listTariffs(practiceId).subscribe({
      next: (list) => this.loaded.set(ready(list)),
      error: (error: unknown) => this.loaded.set(errorToViewState<readonly SpaceTariff[]>(error)),
    });
  }
}
