import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import {
  CAMPAIGN_PARTNER_ROLE_LABELS,
  CAMPAIGN_PARTNER_ROLES,
  CAMPAIGN_PARTNER_TYPE_LABELS,
  CAMPAIGN_PARTNER_TYPES,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_TYPES,
} from '../../../core/data-access/insurance/insurance-campaign.labels';
import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  CampaignPage,
  CampaignPartnerRole,
  CampaignPartnerType,
  CampaignStatus,
  CampaignTargetStatus,
  CampaignType,
  CreateCampaignInput,
  InsuranceCampaign,
} from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { historialDeCursor } from '../../../shared/components/organisms/data-table/cursor-history';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

const PAGE_SIZE = 25;
const DEFAULT_DURATION_DAYS = 60;

/** Lo mismo que valida la API (`CreateInsuranceCampaignDto`): así el error sale antes de enviar. */
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_CONDITION_CODE = 16;
const MAX_PARTNER_NAME = 160;

/** Valor del selector de filtro que significa «sin filtro». */
const ALL = '';

/** Qué se le puede hacer a una campaña según su estado (tabla de transiciones de la API). */
const ROW_ACTIONS: Readonly<
  Record<CampaignStatus, readonly { target: CampaignTargetStatus; label: string }[]>
> = {
  DRAFT: [{ target: 'ACTIVE', label: 'Activar' }],
  ACTIVE: [
    { target: 'PAUSED', label: 'Pausar' },
    { target: 'EXPIRED', label: 'Finalizar' },
  ],
  PAUSED: [
    { target: 'ACTIVE', label: 'Reanudar' },
    { target: 'EXPIRED', label: 'Finalizar' },
  ],
  EXPIRED: [],
};

/** `AAAA-MM-DD` con los componentes **locales**: pasar por UTC correría el día. */
function civilDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** La vigencia termina antes de empezar. */
function dateOrderValidator(group: AbstractControl): ValidationErrors | null {
  const from = String(group.get('validFrom')?.value ?? '');
  const to = String(group.get('validTo')?.value ?? '');
  return from !== '' && to !== '' && to < from ? { dateOrder: true } : null;
}

/** Hasta dos decimales, como exige la API. */
function twoDecimalsValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as number | null;
  if (value === null || value === undefined) {
    return null;
  }
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6 ? null : { decimals: true };
}

/**
 * Campañas preventivas de la aseguradora — `administration/insurance-campaigns`
 * (Tarea 4 · M-06, Proceso 4 del cliente: «Módulo de promociones»).
 *
 * ## Por qué listado y alta viven en la misma pantalla
 *
 * Igual que el catálogo de servicios: el alta es un formulario sobre una lista
 * que ya se está mirando, y separarla en otra ruta obligaría a ir y volver para
 * ver si el código elegido ya existe. El formulario se abre inline, dentro de
 * una sola tarjeta centrada, y al guardar recarga el listado.
 *
 * ## La patología describe, no dirige
 *
 * El CIE-10 dice qué previene la campaña. No segmenta afiliados por su historia
 * clínica: eso exigiría un consentimiento específico que no existe (D4). Todos
 * los afiliados de la aseguradora con cobertura vigente ven la campaña.
 *
 * ## La autoridad es de la API
 *
 * La sección se muestra a quien tenga una aseguradora activa; quién puede crear
 * o cambiar el estado lo decide el servidor por membresía. Un 403 se dice tal cual.
 */
@Component({
  selector: 'app-insurance-campaigns',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    Badge,
    Card,
    Checkbox,
    DataTable,
    DatePipe,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    ReactiveFormsModule,
    Select,
  ],
  templateUrl: './insurance-campaigns.html',
  styleUrl: './insurance-campaigns.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceCampaigns {
  private readonly insurance = inject(InsuranceClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly titleCell =
    viewChild.required<TemplateRef<{ $implicit: InsuranceCampaign }>>('titleCell');
  private readonly typeCell =
    viewChild.required<TemplateRef<{ $implicit: InsuranceCampaign }>>('typeCell');
  private readonly bonusCell =
    viewChild.required<TemplateRef<{ $implicit: InsuranceCampaign }>>('bonusCell');
  private readonly validityCell =
    viewChild.required<TemplateRef<{ $implicit: InsuranceCampaign }>>('validityCell');
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: InsuranceCampaign }>>('actionsCell');

  /* ---- filtros (en la URL, para poder compartir la vista) ------------------ */

  protected readonly typeFilter = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('type') ?? ALL)),
    { initialValue: ALL },
  );
  protected readonly statusFilter = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('status') ?? ALL)),
    { initialValue: ALL },
  );

  protected readonly typeOptions: readonly SelectOption<string>[] = [
    { value: ALL, label: 'Todos los tipos' },
    ...CAMPAIGN_TYPES.map((type) => ({ value: type, label: CAMPAIGN_TYPE_LABELS[type] })),
  ];
  protected readonly statusOptions: readonly SelectOption<string>[] = [
    { value: ALL, label: 'Todos los estados' },
    ...CAMPAIGN_STATUSES.map((status) => ({
      value: status,
      label: CAMPAIGN_STATUS_LABELS[status],
    })),
  ];

  protected setFilter(key: 'type' | 'status', value: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value === null || value === ALL ? null : value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /* ---- listado ------------------------------------------------------------- */

  protected readonly results = signal<ViewState<readonly InsuranceCampaign[]>>(loading());
  protected readonly loadingList = computed(() => this.results().status === 'loading');

  /** El paginado por cursor, con memoria (`historialDeCursor`). */
  private readonly paging = historialDeCursor();
  protected readonly cursor = this.paging.cursor;

  protected readonly columns = computed<readonly ColumnDef<InsuranceCampaign>[]>(() => [
    { key: 'title', header: 'Campaña', priority: 1, cell: this.titleCell() },
    { key: 'campaignType', header: 'Tipo', priority: 2, cell: this.typeCell() },
    { key: 'copayBonusPercentage', header: 'Bonificación', priority: 2, cell: this.bonusCell() },
    { key: 'validTo', header: 'Vigencia', priority: 2, cell: this.validityCell() },
    { key: 'actions', header: 'Acciones', priority: 1, cell: this.actionsCell() },
  ]);

  protected readonly trackById = (row: InsuranceCampaign): string => row.id;
  protected readonly rowName = (row: InsuranceCampaign): string => `${row.code}, ${row.title}`;

  constructor() {
    // Un cambio de filtro es una lista nueva: el cursor de la anterior devolvería
    // una página del listado viejo.
    effect(() => {
      this.typeFilter();
      this.statusFilter();
      untracked(() => {
        this.paging.reiniciar();
        this.load();
      });
    });
  }

  protected move(cursor: string): void {
    this.paging.mover(cursor);
    this.load();
  }

  protected reload(): void {
    this.load();
  }

  private load(): void {
    this.results.set(loading());
    const type = this.typeFilter();
    const status = this.statusFilter();
    const currentCursor = this.paging.actual();

    this.insurance
      .listCampaigns({
        limit: PAGE_SIZE,
        ...(type === ALL ? {} : { type: type as CampaignType }),
        ...(status === ALL ? {} : { status: status as CampaignStatus }),
        ...(currentCursor === undefined ? {} : { cursor: currentCursor }),
      })
      .subscribe({
        next: (page) => {
          this.paging.llego(page.nextCursor);
          this.results.set(this.stateOf(page));
        },
        error: (error: unknown) => {
          this.paging.llego(null);
          this.results.set(errorToViewState<readonly InsuranceCampaign[]>(error));
        },
      });
  }

  private stateOf(page: CampaignPage): ViewState<readonly InsuranceCampaign[]> {
    if (page.items.length > 0) {
      return ready(page.items);
    }
    const filtered = this.typeFilter() !== ALL || this.statusFilter() !== ALL;
    return filtered
      ? empty({ label: 'Ver todas las campañas' }, 'Ninguna campaña coincide con los filtros.')
      : empty(
          { label: 'Crear la primera campaña' },
          'Todavía no creaste campañas preventivas. Sumá una junto a un laboratorio o una importadora.',
        );
  }

  /* ---- presentación de una fila ------------------------------------------- */

  protected typeLabel(type: CampaignType): string {
    return CAMPAIGN_TYPE_LABELS[type];
  }

  protected bonusText(percentage: number): string {
    return `${percentage}%`;
  }

  /**
   * Una campaña `ACTIVE` cuya vigencia ya pasó deja de verse para el afiliado
   * aunque nadie la haya cerrado (el vencimiento efectivo lo manda la fecha, no
   * un cron); acá se rotula como tal para que el operador no crea que sigue viva.
   */
  protected isElapsed(campaign: InsuranceCampaign): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return campaign.status === 'ACTIVE' && campaign.validTo < today;
  }

  protected statusLabel(campaign: InsuranceCampaign): string {
    return this.isElapsed(campaign) ? 'Vencida' : CAMPAIGN_STATUS_LABELS[campaign.status];
  }

  protected statusTone(campaign: InsuranceCampaign): 'info' | 'success' | 'warning' | 'secondary' {
    return this.isElapsed(campaign) ? 'secondary' : CAMPAIGN_STATUS_TONES[campaign.status];
  }

  protected actionsFor(campaign: InsuranceCampaign): readonly {
    target: CampaignTargetStatus;
    label: string;
  }[] {
    const actions = ROW_ACTIONS[campaign.status];
    // Una activa cuya vigencia ya terminó no tiene nada que pausar: sólo cerrarla.
    return this.isElapsed(campaign)
      ? actions.filter((action) => action.target === 'EXPIRED')
      : actions;
  }

  /* ---- cambio de estado ---------------------------------------------------- */

  /** Fila con una petición en vuelo: sus botones se deshabilitan. */
  protected readonly busyId = signal<string | null>(null);
  /** Fila esperando confirmación de «Finalizar», que no se puede deshacer. */
  protected readonly confirmingId = signal<string | null>(null);

  protected requestAction(campaign: InsuranceCampaign, target: CampaignTargetStatus): void {
    if (target === 'EXPIRED') {
      this.confirmingId.set(campaign.id);
      return;
    }
    this.changeStatus(campaign, target);
  }

  protected cancelConfirmation(): void {
    this.confirmingId.set(null);
  }

  protected changeStatus(campaign: InsuranceCampaign, target: CampaignTargetStatus): void {
    if (this.busyId() !== null) {
      return;
    }
    this.confirmingId.set(null);
    this.busyId.set(campaign.id);

    this.insurance.updateCampaignStatus(campaign.id, target).subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.toast.success(
          `«${updated.code}» ahora está ${CAMPAIGN_STATUS_LABELS[updated.status].toLowerCase()}.`,
          'Campaña actualizada',
        );
        this.load();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.toast.error(
          this.messageOf(errorToViewState<null>(error)),
          'No se pudo cambiar el estado',
        );
      },
    });
  }

  /* ---- alta ---------------------------------------------------------------- */

  protected readonly showForm = signal(false);

  protected readonly partnerRoleOptions: readonly SelectOption<CampaignPartnerRole>[] =
    CAMPAIGN_PARTNER_ROLES.map((role) => ({
      value: role,
      label: CAMPAIGN_PARTNER_ROLE_LABELS[role],
    }));
  protected readonly partnerTypeOptions: readonly SelectOption<CampaignPartnerType>[] =
    CAMPAIGN_PARTNER_TYPES.map((type) => ({
      value: type,
      label: CAMPAIGN_PARTNER_TYPE_LABELS[type],
    }));
  protected readonly formTypeOptions: readonly SelectOption<CampaignType>[] = CAMPAIGN_TYPES.map(
    (type) => ({ value: type, label: CAMPAIGN_TYPE_LABELS[type] }),
  );

  private newPartnerGroup(
    role: CampaignPartnerRole = 'PROVIDER',
    type: CampaignPartnerType = 'LABORATORY',
  ) {
    return new FormGroup({
      role: new FormControl<CampaignPartnerRole>(role, { nonNullable: true }),
      type: new FormControl<CampaignPartnerType>(type, { nonNullable: true }),
      name: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(MAX_PARTNER_NAME),
          (control) => (String(control.value).trim() === '' ? { required: true } : null),
        ],
      }),
    });
  }

  protected readonly form = new FormGroup(
    {
      code: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(CODE_PATTERN)],
      }),
      title: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(MAX_TITLE)],
      }),
      description: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(MAX_DESCRIPTION)],
      }),
      campaignType: new FormControl<CampaignType>('LABORATORY', { nonNullable: true }),
      targetConditionCode: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(MAX_CONDITION_CODE)],
      }),
      copayBonusPercentage: new FormControl<number | null>(100, {
        validators: [
          Validators.required,
          Validators.min(0),
          Validators.max(100),
          twoDecimalsValidator,
        ],
      }),
      validFrom: new FormControl(civilDate(), {
        nonNullable: true,
        validators: [Validators.required],
      }),
      validTo: new FormControl(civilDate(DEFAULT_DURATION_DAYS), {
        nonNullable: true,
        validators: [Validators.required],
      }),
      partners: new FormArray([this.newPartnerGroup()], {
        validators: [
          (control) => ((control as FormArray).length === 0 ? { minPartners: true } : null),
        ],
      }),
      activate: new FormControl(true, { nonNullable: true }),
    },
    { validators: [dateOrderValidator] },
  );

  protected get partners(): FormArray<ReturnType<InsuranceCampaigns['newPartnerGroup']>> {
    return this.form.controls.partners;
  }

  protected addPartner(): void {
    this.partners.push(this.newPartnerGroup());
  }

  protected removePartner(index: number): void {
    if (this.partners.length > 1) {
      this.partners.removeAt(index);
    }
  }

  protected readonly formState = signal<ViewState<null>>(ready(null));
  protected readonly submitting = computed(() => this.formState().status === 'loading');

  protected readonly formError = computed<string | null>(() => {
    const state = this.formState();
    return state.status === 'ready' || state.status === 'loading' ? null : this.messageOf(state);
  });

  /** Un 409 (código repetido) se dice en el campo, no arriba. */
  protected readonly codeConflict = computed(() => {
    const state = this.formState();
    return (
      state.status === 'validation' &&
      state.issues.some((issue) => issue.code === 'CONFLICT' || issue.field === 'code')
    );
  });

  private messageOf(state: ViewState<unknown>): string {
    switch (state.status) {
      case 'validation':
        return state.issues.map((issue) => issue.message).join(' ') || 'Revisá los datos.';
      case 'forbidden':
        return (
          state.message ?? 'Sólo quien administra la aseguradora puede crear o cambiar campañas.'
        );
      case 'offline':
        return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
      case 'error':
        return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
      default:
        return 'No se pudo completar la operación.';
    }
  }

  /** ¿Mostrar el error de este control? Apenas se toca o se edita, sin esperar al envío. */
  protected showError(control: AbstractControl | null | undefined): boolean {
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  protected openForm(): void {
    this.showForm.set(true);
  }

  protected cancelForm(): void {
    this.showForm.set(false);
    this.resetForm();
  }

  private resetForm(): void {
    this.form.reset({
      code: '',
      title: '',
      description: '',
      campaignType: 'LABORATORY',
      targetConditionCode: '',
      copayBonusPercentage: 100,
      validFrom: civilDate(),
      validTo: civilDate(DEFAULT_DURATION_DAYS),
      activate: true,
    });
    while (this.partners.length > 1) {
      this.partners.removeAt(this.partners.length - 1);
    }
    this.partners.at(0).reset({ role: 'PROVIDER', type: 'LABORATORY', name: '' });
    this.formState.set(ready(null));
  }

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const description = raw.description.trim();
    const conditionCode = raw.targetConditionCode.trim().toUpperCase();
    const input: CreateCampaignInput = {
      code: raw.code.trim(),
      title: raw.title.trim(),
      ...(description === '' ? {} : { description }),
      campaignType: raw.campaignType,
      ...(conditionCode === '' ? {} : { targetConditionCode: conditionCode }),
      copayBonusPercentage: raw.copayBonusPercentage ?? 0,
      validFrom: raw.validFrom,
      validTo: raw.validTo,
      partners: raw.partners.map((partner) => ({
        role: partner.role,
        type: partner.type,
        name: partner.name.trim(),
      })),
      activate: raw.activate,
    };

    this.formState.set(loading());
    this.insurance.createCampaign(input).subscribe({
      next: (created) => {
        this.toast.success(
          raw.activate
            ? `«${created.code}» se creó y ya la ven tus afiliados.`
            : `«${created.code}» se guardó como borrador.`,
          'Campaña creada',
        );
        this.showForm.set(false);
        this.resetForm();
        this.paging.reiniciar();
        this.load();
      },
      error: (error: unknown) => this.formState.set(errorToViewState<null>(error)),
    });
  }
}
