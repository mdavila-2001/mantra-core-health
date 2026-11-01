import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type TemplateRef } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, filter, map, of, startWith, switchMap } from 'rxjs';

import { bedCategoryCode, currencyCode, CURRENCY_CONCEPTS } from '../../../../core/data-access/infra-concepts';
import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import { SiteContextStore } from '../../../../core/data-access/operating-rooms/site-context.store';
import { ServicesCatalogClient } from '../../../../core/data-access/services-catalog/services-catalog.client';
import { SpaceBillingClient } from '../../../../core/data-access/space-billing/space-billing.client';
import type { SpaceTariff, TariffKind } from '../../../../core/data-access/space-billing/space-billing.types';
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

const KINDS: readonly SegmentedOption<TariffKind>[] = [
  { value: 'BED_DAY', label: 'Día-cama' },
  { value: 'OR_TIME', label: 'Quirófano por tiempo' },
];

const KIND_LABELS: Readonly<Record<TariffKind, string>> = { BED_DAY: 'Día-cama', OR_TIME: 'Quirófano por tiempo' };

const UNIT_MINUTES: readonly SelectOption<string>[] = [
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '60', label: '60 minutos' },
];

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * **Tarifas de espacios** — pestaña del catálogo de servicios (F5e).
 *
 * Día-cama por categoría y quirófano por tiempo, versionados: una tarifa no se
 * edita, se **cierra** con una fecha y se carga la siguiente. Así cambiar el
 * precio con vigencia futura no altera los cargos ya devengados (D7). La API
 * rechaza vigencias superpuestas (409 `TARIFF_OVERLAP`) y un ítem de otra
 * práctica (422 `TARIFF_SERVICE_NOT_IN_PRACTICE`).
 *
 * Formas de la API (`CreateSpaceTariffDto`, `tariffView`): se manda
 * `tariffKind` y `currencyConceptId`; la lista trae ids (categoría como
 * concepto, espacio, ítem del catálogo) que se resuelven con los catálogos ya
 * cargados, y el estado se deduce de la vigencia. Quién carga tarifas lo decide
 * la API (§0.3, `f5e.tariff.write`): 403 → S5 en el aviso.
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

  protected readonly kinds = KINDS;
  protected readonly unitMinuteOptions = UNIT_MINUTES;

  private readonly loaded = signal<ViewState<readonly SpaceTariff[]>>(loading());
  protected readonly serviceOptions = signal<readonly SelectOption<string>[]>([]);
  protected readonly categoryOptions = signal<readonly SelectOption<string>[]>([]);

  protected readonly kind = signal<TariffKind>('BED_DAY');
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

  protected readonly practiceId = this.siteContext.practiceId;
  private readonly reloads = signal(0);
  private readonly serviceNames = computed(() => new Map(this.serviceOptions().map((o) => [o.value, o.label])));
  private readonly categoryNames = computed(() => new Map(this.categoryOptions().map((o) => [o.value, o.label])));
  private readonly spaceNames = computed(() => new Map((dataOf(this.siteContext.directory())?.careSpaces ?? []).map((c) => [c.id, `${c.code} · ${c.name}`])));

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
      (this.kind() === 'OR_TIME' ? this.unitMinutes() !== null : this.categoryCode() !== null),
  );

  private readonly targetCell = viewChild.required<TemplateRef<{ $implicit: SpaceTariff }>>('targetCell');
  private readonly priceCell = viewChild.required<TemplateRef<{ $implicit: SpaceTariff }>>('priceCell');
  private readonly validityCell = viewChild.required<TemplateRef<{ $implicit: SpaceTariff }>>('validityCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: SpaceTariff }>>('actionsCell');
  private readonly serviceCell = viewChild.required<TemplateRef<{ $implicit: SpaceTariff }>>('serviceCell');

  protected readonly columns = computed<readonly ColumnDef<SpaceTariff>[]>(() => [
    { key: 'tariffKind', header: 'Tarifa', priority: 1, cell: this.targetCell() },
    { key: 'serviceCatalogId', header: 'Ítem del catálogo', priority: 3, cell: this.serviceCell() },
    { key: 'unitPrice', header: 'Precio', priority: 1, cell: this.priceCell(), align: 'end' },
    { key: 'validFrom', header: 'Vigencia', priority: 2, cell: this.validityCell() },
    { key: 'id', header: 'Acciones', priority: 1, cell: this.actionsCell(), align: 'end' },
  ]);

  protected readonly byId = (t: SpaceTariff): string => t.id;

  constructor() {
    this.siteContext.ensureDirectory();
    const practice$ = toObservable(computed(() => ({ practiceId: this.practiceId(), n: this.reloads() }))).pipe(
      filter((k): k is { practiceId: string; n: number } => k.practiceId !== null),
    );
    practice$
      .pipe(
        switchMap(({ practiceId }) =>
          this.billing.listTariffs(practiceId).pipe(
            map((list) => ready(list) as ViewState<readonly SpaceTariff[]>),
            catchError((e: unknown) => of(errorToViewState<readonly SpaceTariff[]>(e))),
            startWith(loading() as ViewState<readonly SpaceTariff[]>),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.loaded.set(s));
    practice$
      .pipe(
        switchMap(({ practiceId }) => this.catalog.search(practiceId, { limit: 50 }).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((page) => this.serviceOptions.set(page === null ? [] : page.items.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))));
    this.infrastructure.getCatalog().subscribe({
      next: (c) => this.categoryOptions.set(c.attributes.bedCategory.map((b) => ({ value: b.code, label: b.display }))),
      error: () => this.categoryOptions.set([]),
    });
  }

  protected kindLabel(t: SpaceTariff): string {
    return KIND_LABELS[t.tariffKind];
  }

  /** A qué se aplica: la categoría de cama, la sala o cualquier quirófano. */
  protected targetOf(t: SpaceTariff): string {
    const code = bedCategoryCode(t.bedCategoryConceptId);
    if (code !== null) return this.categoryNames().get(code) ?? code;
    if (t.careSpaceId !== null) return this.spaceNames().get(t.careSpaceId) ?? 'Un espacio de la organización';
    return t.tariffKind === 'OR_TIME' ? 'Cualquier quirófano' : 'Sin categoría';
  }

  protected serviceOf(t: SpaceTariff): string {
    return this.serviceNames().get(t.serviceCatalogId) ?? 'Ítem del catálogo';
  }

  /** Estado deducido de la vigencia `[desde, hasta)`: la vista de la API no lo trae. */
  protected statusOf(t: SpaceTariff): { label: string; variant: 'success' | 'secondary' | 'info' } {
    const today = todayIso();
    if (t.validTo !== null && t.validTo <= today) return { label: 'Cerrada', variant: 'secondary' };
    if (t.validFrom > today) return { label: 'Futura', variant: 'info' };
    return { label: 'Vigente', variant: 'success' };
  }

  protected price(t: SpaceTariff): string {
    if (t.unitPrice === null) return '—';
    const currency = currencyCode(t.currencyConceptId) ?? 'BOB';
    return `${Number(t.unitPrice).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }

  protected create(): void {
    const practiceId = this.practiceId();
    const serviceId = this.serviceId();
    if (practiceId === null || serviceId === null || !this.valid() || this.sending()) return;
    const orTime = this.kind() === 'OR_TIME';
    this.run(
      this.billing.createTariff({
        practiceId,
        tariffKind: this.kind(),
        serviceCatalogId: serviceId,
        unitPrice: this.unitPrice(),
        currencyConceptId: CURRENCY_CONCEPTS['BOB']!,
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
    if (this.siteContext.state().status !== 'ready') this.siteContext.reload();
    this.reloads.update((n) => n + 1);
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
}
