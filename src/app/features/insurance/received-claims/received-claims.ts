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
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map, type Observable } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  ReceivedClaim,
  ReceivedClaimOutcome,
} from '../../../core/data-access/insurance/insurance.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  SortState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import {
  FilterBar,
  type FilterDef,
} from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import {
  UNKNOWN_STATUS_VARIANT,
  type StatusSealVariant,
} from '../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { currencySuffix, formatAmount, formatMoney } from '../money-format';

const DEFAULT_PAGE_SIZE = 10;
const MS_PER_DAY = 86_400_000;

/** Claves de los filtros en la URL. El estado no está: lo resuelve la bandeja. */
const FILTER_KEYS = {
  practitioner: 'practitioner',
  service: 'service',
  amount: 'amount',
  submitted: 'submitted',
  serviceDate: 'serviceDate',
  provider: 'provider',
} as const;

/**
 * Las bandejas: la primera pregunta de quien dictamina es «qué me falta
 * decidir», no «qué estado tiene cada una». Cada estado cae en una sola.
 */
type Queue = 'open' | 'approved' | 'paid' | 'rejected' | 'all';

const QUEUES: readonly { readonly value: Queue; readonly label: string; readonly statuses: readonly string[] | null }[] = [
  { value: 'open', label: 'Por dictaminar', statuses: ['SUBMITTED', 'IN_REVIEW'] },
  { value: 'approved', label: 'Aprobadas', statuses: ['APPROVED', 'PARTIAL'] },
  { value: 'paid', label: 'Pagadas', statuses: ['PAID'] },
  { value: 'rejected', label: 'Rechazadas', statuses: ['REJECTED'] },
  { value: 'all', label: 'Todas', statuses: null },
];

/** Las acciones de una fila, por código. */
const ACTION = {
  approve: 'approve',
  partial: 'partial',
  reject: 'reject',
  annul: 'annul-invoice',
  reissue: 'reissue-invoice',
} as const;

const OPEN_STATUSES: ReadonlySet<string> = new Set(['SUBMITTED', 'IN_REVIEW']);

/** Lo que dice la advertencia de toda decisión: se pide una vez, antes de mandarla. */
const IRREVERSIBLE = 'Esta decisión no se puede revertir.';

/** Tramos de «Monto solicitado», en la moneda de la solicitud. */
const AMOUNT_RANGES: readonly {
  readonly value: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
}[] = [
  { value: 'lt200', label: 'Hasta 200', min: 0, max: 200 },
  { value: '200-500', label: 'De 200 a 500', min: 200, max: 500 },
  { value: '500-1000', label: 'De 500 a 1000', min: 500, max: 1000 },
  { value: 'gt1000', label: 'Más de 1000', min: 1000, max: Number.POSITIVE_INFINITY },
];

/** Cortes de período para las dos columnas de fecha. */
const PERIODS: readonly { readonly value: string; readonly label: string; readonly days: number }[] = [
  { value: '7', label: 'Últimos 7 días', days: 7 },
  { value: '30', label: 'Últimos 30 días', days: 30 },
  { value: '90', label: 'Últimos 90 días', days: 90 },
  { value: '180', label: 'Últimos 180 días', days: 180 },
];

/** Estado de la solicitud → sello. Lo que no está acá cae en el neutro. */
const STATUS_SEAL: Readonly<Record<string, StatusSealVariant>> = {
  SUBMITTED: 'pending',
  IN_REVIEW: 'in-review',
  APPROVED: 'approved',
  PARTIAL: 'approved',
  PAID: 'approved',
  REJECTED: 'rejected',
};

/** Cómo se compara cada columna ordenable. */
const SORT_VALUE: Readonly<Record<string, (claim: ReceivedClaim) => string | number>> = {
  patient: (c) => c.patient.displayName ?? '',
  practitioner: (c) => c.practitioner?.displayName ?? '',
  service: (c) => c.service?.display ?? '',
  billedTotal: (c) => Number(c.billedTotal.amount),
  submittedAt: (c) => c.submittedAt?.getTime() ?? 0,
  serviceDate: (c) => c.serviceDate?.getTime() ?? 0,
  status: (c) => c.status?.display ?? '',
};

/**
 * Solicitudes recibidas — `administration/received-claims`.
 *
 * La cara de LA ASEGURADORA del mismo `insurance_claims` que el prestador ve
 * en «Solicitudes de seguro»: quién se atendió, qué médico lo atendió, qué
 * servicio, cuánto se pide y cuándo. Sigue ADR-0015 como lista local: el
 * servidor entrega la ventana entera con tope, y buscar, filtrar, ordenar y
 * paginar pasan en el cliente.
 *
 * ## Un filtro por encabezado, y el paciente por el buscador
 *
 * Cada columna tiene su filtro —médico, servicio, tramo de monto, período de
 * solicitud y de prestación, estado— **salvo Solicitud y Paciente**, que son
 * texto único por fila: un desplegable con ciento ochenta nombres no filtra,
 * obliga a leer. Esos dos los resuelve el buscador multicampo.
 *
 * ## El buscador no viaja en la URL; los filtros sí
 *
 * En el buscador se escribe el nombre o el CI de un paciente, y en la URL eso
 * queda en el historial, en los logs y en el `Referer`. Los filtros son ids de
 * médico y códigos de catálogo, que no identifican a ningún paciente, y viajan
 * en la URL para que una lista filtrada se pueda compartir.
 */
@Component({
  selector: 'app-received-claims',
  imports: [
    Alert,
    Card,
    AppButton,
    Input,
    Textarea,
    ContentDialog,
    DataTable,
    FilterBar,
    FormField,
    NavIcon,
    PageHeader,
    Pagination,
    ReactiveFormsModule,
    RowActions,
    SegmentedControl,
    Skeleton,
    StatusSeal,
    Tooltip,
    ViewStateHost,
  ],
  templateUrl: './received-claims.html',
  styleUrl: './received-claims.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivedClaims {
  private readonly insurance = inject(InsuranceClient);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  /** La lista completa recibida del servidor (S1/S2/S3/S9 del M34). */
  protected readonly state = signal<ViewState<readonly ReceivedClaim[]>>(loading());
  protected readonly truncated = signal(false);

  /* ---- búsqueda, filtros, orden y página ---------------------------------- */

  protected readonly searchTerm = signal('');
  protected readonly queue = signal<Queue>('open');
  protected readonly sort = signal<SortState>({ key: 'submittedAt', direction: 'desc' });
  protected readonly page = signal(1);
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  /** Los filtros activos, leídos de la URL que escribe `app-filter-bar`. */
  private readonly activeFilters = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => {
        const values: Record<string, string | null> = {};
        for (const key of Object.values(FILTER_KEYS)) values[key] = params.get(key);
        return values;
      }),
    ),
    { initialValue: {} as Record<string, string | null> },
  );

  constructor() {
    this.load();

    // Otra búsqueda, otro filtro u otro orden es otra lista: la página 4 de la
    // anterior puede no existir en la nueva.
    effect(() => {
      this.searchTerm();
      this.queue();
      this.activeFilters();
      this.sort();
      untracked(() => this.page.set(1));
    });
  }

  protected load(): void {
    this.state.set(loading());
    this.insurance.listReceivedClaims().subscribe({
      next: (list) => {
        this.truncated.set(list.truncated);
        this.state.set(
          list.items.length > 0
            ? ready(list.items)
            : empty(
                { label: 'Volver al panel', route: '/dashboard' },
                'Todavía ningún prestador le presentó una solicitud a tu aseguradora.',
              ),
        );
      },
      error: (error: unknown) =>
        this.state.set(errorToViewState<readonly ReceivedClaim[]>(error)),
    });
  }

  private readonly allClaims = computed<readonly ReceivedClaim[]>(() => {
    const current = this.state();
    return current.status === 'ready' ? current.data : [];
  });

  /* ---- opciones de los filtros: sólo valores que existen en la lista ------ */

  protected readonly filters = computed<readonly FilterDef[]>(() => {
    const claims = this.allClaims();
    return [
      {
        key: FILTER_KEYS.practitioner,
        label: 'Médico',
        placeholder: 'Todos los médicos',
        options: distinctOptions(claims, (c) =>
          c.practitioner === null ? null : [c.practitioner.id, c.practitioner.displayName],
        ),
      },
      {
        key: FILTER_KEYS.service,
        label: 'Servicio',
        placeholder: 'Todos los servicios',
        options: distinctOptions(claims, (c) =>
          c.service === null ? null : [c.service.code, c.service.display],
        ),
      },
      {
        key: FILTER_KEYS.amount,
        label: 'Monto solicitado',
        placeholder: 'Cualquier monto',
        options: AMOUNT_RANGES.map(({ value, label }) => ({ value, label })),
      },
      {
        key: FILTER_KEYS.submitted,
        label: 'Fecha de solicitud',
        placeholder: 'Fecha de solicitud',
        options: PERIODS.map(({ value, label }) => ({ value, label })),
      },
      {
        key: FILTER_KEYS.serviceDate,
        label: 'Fecha de prestación',
        placeholder: 'Fecha de prestación',
        options: PERIODS.map(({ value, label }) => ({ value, label })),
      },
      {
        key: FILTER_KEYS.provider,
        label: 'Prestador',
        placeholder: 'Todos los prestadores',
        options: distinctOptions(claims, (c) => [c.providerName, c.providerName]),
      },
    ];
  });

  /* ---- filtrado, orden y página ------------------------------------------- */

  /** Buscador y filtros, sin la bandeja: de acá salen los conteos de cada bandeja. */
  private readonly matchingClaims = computed<readonly ReceivedClaim[]>(() => {
    const term = normalizeText(this.searchTerm().trim());
    const f = this.activeFilters();
    const amountRange = AMOUNT_RANGES.find((r) => r.value === f[FILTER_KEYS.amount]);
    const submittedDays = daysOf(f[FILTER_KEYS.submitted]);
    const serviceDays = daysOf(f[FILTER_KEYS.serviceDate]);
    const now = Date.now();

    return this.allClaims().filter((claim) => {
      if (f[FILTER_KEYS.practitioner] && claim.practitioner?.id !== f[FILTER_KEYS.practitioner]) return false;
      if (f[FILTER_KEYS.service] && claim.service?.code !== f[FILTER_KEYS.service]) return false;
      if (f[FILTER_KEYS.provider] && claim.providerName !== f[FILTER_KEYS.provider]) return false;
      if (amountRange !== undefined) {
        const amount = Number(claim.billedTotal.amount);
        if (amount < amountRange.min || amount >= amountRange.max) return false;
      }
      if (!withinDays(claim.submittedAt, submittedDays, now)) return false;
      if (!withinDays(claim.serviceDate, serviceDays, now)) return false;
      if (term === '') return true;
      return searchableFields(claim).some((field) => normalizeText(field).includes(term));
    });
  });

  protected readonly filteredClaims = computed<readonly ReceivedClaim[]>(() => {
    const statuses = QUEUES.find((q) => q.value === this.queue())?.statuses ?? null;
    const matching = this.matchingClaims();
    return statuses === null ? matching : matching.filter((c) => statuses.includes(c.status?.code ?? ''));
  });

  /** «Por dictaminar · 12»: el conteo respeta el buscador y los filtros. */
  protected readonly queueOptions = computed<readonly SegmentedOption<Queue>[]>(() => {
    const matching = this.matchingClaims();
    return QUEUES.map(({ value, label, statuses }) => {
      const count =
        statuses === null ? matching.length : matching.filter((c) => statuses.includes(c.status?.code ?? '')).length;
      return { value, label: `${label} · ${count}` };
    });
  });

  private readonly sortedClaims = computed<readonly ReceivedClaim[]>(() => {
    const { key, direction } = this.sort();
    const valueOf = SORT_VALUE[key];
    if (valueOf === undefined) return this.filteredClaims();
    const factor = direction === 'asc' ? 1 : -1;
    return [...this.filteredClaims()].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);
      const order =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), 'es');
      return order * factor;
    });
  });

  protected readonly totalFiltered = computed(() => this.filteredClaims().length);

  /** La moneda de los importes, dicha una sola vez: `' · Boliviano'` o nada. */
  protected readonly currencyNote = computed(() =>
    currencySuffix(this.allClaims()[0]?.billedTotal ?? null),
  );

  /** Lo que pinta la tabla: la página actual, conservando loading/empty/error. */
  protected readonly tableState = computed<ViewState<readonly ReceivedClaim[]>>(() => {
    const current = this.state();
    if (current.status !== 'ready') return current;
    const start = (this.page() - 1) * this.pageSize();
    return ready(this.sortedClaims().slice(start, start + this.pageSize()));
  });

  /* ---- columnas ----------------------------------------------------------- */

  private readonly patientCell = viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('patientCell');
  private readonly practitionerCell =
    viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('practitionerCell');
  private readonly serviceCell = viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('serviceCell');
  private readonly amountCell = viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('amountCell');
  private readonly datesCell = viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('datesCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('statusCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('actionsCell');

  /**
   * Las columnas, en su orden. En móvil quedan a la vista paciente y monto;
   * acciones; el resto se pliega a la fila de detalle, a un toque.
   *
   * ADR-0015 prohíbe el scroll lateral y la tabla ya llenaba su caja (1040 px
   * a 1440 con la barra lateral abierta). La columna de acciones sale de
   * juntar las dos fechas en una: solicitud arriba, prestación abajo, cada una
   * con su rótulo; ordena por la de solicitud y las dos siguen filtrándose por
   * separado. La moneda se dice una vez, en la línea del conteo.
   */
  protected readonly columns = computed<readonly ColumnDef<ReceivedClaim>[]>(() => [
    { key: 'patient', header: 'Paciente', priority: 1, sortable: true, cell: this.patientCell() },
    { key: 'practitioner', header: 'Médico', priority: 2, sortable: true, cell: this.practitionerCell() },
    { key: 'service', header: 'Servicio prestado', priority: 2, sortable: true, cell: this.serviceCell() },
    {
      key: 'billedTotal',
      header: 'Monto solicitado',
      priority: 1,
      align: 'end',
      sortable: true,
      cell: this.amountCell(),
    },
    { key: 'submittedAt', header: 'Fechas', priority: 2, sortable: true, cell: this.datesCell() },
    { key: 'status', header: 'Estado', priority: 2, sortable: true, cell: this.statusCell() },
    { key: 'actions', header: 'Acciones', priority: 2, sticky: 'end', cell: this.actionsCell() },
  ]);

  protected readonly byId = (claim: ReceivedClaim): string => claim.id;
  protected readonly claimLabel = (claim: ReceivedClaim): string =>
    `${claim.claimIdentifier} · ${claim.patient.displayName ?? 'Paciente sin nombre registrado'}`;

  /* ---- detalle ------------------------------------------------------------ */

  protected readonly claimOnView = signal<ReceivedClaim | null>(null);

  protected openDetail(claim: ReceivedClaim): void {
    this.claimOnView.set(claim);
  }

  /* ---- dictamen y factura ------------------------------------------------- */

  /** La solicitud que está esperando respuesta del servidor: sus acciones se apagan. */
  protected readonly busyId = signal<string | null>(null);

  /**
   * Lo que se puede hacer con una solicitud, según en qué punto está.
   *
   * - Abierta: aprobar, aprobar en parte o rechazar.
   * - Aprobada con factura vigente: anular la factura, por si salió mal.
   * - Aprobada con la factura anulada: emitir la corregida.
   * - Pagada o rechazada: nada. Una factura pagada no se anula: se corrige con
   *   nota de crédito, que es otro circuito.
   */
  protected actionsOf(claim: ReceivedClaim): readonly RowAction[] {
    const disabled = this.busyId() === claim.id;
    const code = claim.status?.code ?? '';
    if (OPEN_STATUSES.has(code) && claim.decision === null) {
      return [
        { code: ACTION.approve, label: 'Aprobar', icon: 'check-circle', disabled },
        { code: ACTION.partial, label: 'Aprobar parcialmente', icon: 'sliders', disabled },
        { code: ACTION.reject, label: 'Rechazar', icon: 'close', destructive: true, disabled },
      ];
    }
    if (code === 'PAID' || claim.invoice === null) return [];
    return claim.invoice.status === 'ISSUED'
      ? [{ code: ACTION.annul, label: 'Anular factura', icon: 'remove', destructive: true, disabled }]
      : [{ code: ACTION.reissue, label: 'Volver a facturar', icon: 'refresh', disabled }];
  }

  protected async run(code: string, claim: ReceivedClaim): Promise<void> {
    switch (code) {
      case ACTION.approve:
        return this.approve(claim);
      case ACTION.partial:
        return this.openPartial(claim);
      case ACTION.reject:
        return this.reject(claim);
      case ACTION.annul:
        return this.annulInvoice(claim);
      case ACTION.reissue:
        return this.reissueInvoice(claim);
    }
  }

  private summaryOf(claim: ReceivedClaim) {
    return [
      { label: 'Paciente', value: claim.patient.displayName ?? 'Sin nombre registrado' },
      { label: 'Servicio', value: claim.service?.display ?? 'Sin servicio declarado' },
      { label: 'Prestador', value: claim.providerName },
      { label: 'Monto solicitado', value: formatMoney(claim.billedTotal) },
    ];
  }

  private async approve(claim: ReceivedClaim): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: `Aprobar la solicitud ${claim.claimIdentifier}`,
      message:
        `${IRREVERSIBLE} Aprobarla produce un evento de facturación: se emite la factura del ` +
        `prestador a tu aseguradora por ${formatMoney(claim.billedTotal)}.`,
      details: this.summaryOf(claim),
      confirmLabel: 'Aprobar y facturar',
      cancelLabel: 'Volver',
    });
    if (!confirmed) return;
    this.decide(claim, 'APPROVED', {}, 'Solicitud aprobada. Se emitió la factura.');
  }

  private async reject(claim: ReceivedClaim): Promise<void> {
    const reason = await this.dialogs.confirmWithReason(
      {
        title: `Rechazar la solicitud ${claim.claimIdentifier}`,
        message: `${IRREVERSIBLE} El prestador recibe el rechazo con tu motivo y no se emite factura.`,
        details: this.summaryOf(claim),
        confirmLabel: 'Rechazar',
        cancelLabel: 'Volver',
        destructive: true,
      },
      { label: 'Motivo del rechazo', hint: 'El prestador lo va a leer.' },
    );
    if (reason === null) return;
    this.decide(claim, 'REJECTED', { reason }, 'Solicitud rechazada.');
  }

  /* Aprobar en parte pide dos datos —monto y motivo—, así que tiene su propio
     formulario; la advertencia de irreversibilidad llega después, igual que
     en las otras dos decisiones. */

  protected readonly partialFor = signal<ReceivedClaim | null>(null);
  protected readonly partialAmount = new FormControl('', { nonNullable: true });
  protected readonly partialReason = new FormControl('', { nonNullable: true });
  protected readonly partialTouched = signal(false);

  protected openPartial(claim: ReceivedClaim): void {
    this.partialAmount.reset('');
    this.partialReason.reset('');
    this.partialTouched.set(false);
    this.partialFor.set(claim);
  }

  /** El error del monto, o `''`. */
  protected partialAmountError(claim: ReceivedClaim): string {
    const value = this.partialAmount.value.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'Escribí un importe, con hasta dos decimales.';
    const amount = Number(value);
    if (amount <= 0) return 'Tiene que ser mayor que cero.';
    if (amount >= Number(claim.billedTotal.amount)) {
      return `Tiene que ser menor que lo solicitado (${claim.billedTotal.amount}). Si es todo, usá «Aprobar».`;
    }
    return '';
  }

  protected partialReasonError(): string {
    return this.partialReason.value.trim().length < 5 ? 'Contale al prestador por qué no se aprueba todo.' : '';
  }

  protected async submitPartial(claim: ReceivedClaim): Promise<void> {
    this.partialTouched.set(true);
    if (this.partialAmountError(claim) !== '' || this.partialReasonError() !== '') return;
    const approvedAmount = Number(this.partialAmount.value.trim().replace(',', '.')).toFixed(2);
    const currency = claim.billedTotal.currency?.display;
    const approvedLabel = currency ? `${approvedAmount} ${currency}` : approvedAmount;
    const confirmed = await this.dialogs.confirm({
      title: `Aprobar ${approvedLabel} de ${formatMoney(claim.billedTotal)}`,
      message: `${IRREVERSIBLE} Aprobarla produce un evento de facturación: se emite la factura por ${approvedLabel}.`,
      details: [...this.summaryOf(claim), { label: 'Monto aprobado', value: approvedLabel }],
      confirmLabel: 'Aprobar y facturar',
      cancelLabel: 'Volver',
    });
    if (!confirmed) return;
    this.partialFor.set(null);
    this.decide(
      claim,
      'PARTIAL',
      { approvedAmount, reason: this.partialReason.value.trim() },
      'Solicitud aprobada parcialmente. Se emitió la factura.',
    );
  }

  private decide(
    claim: ReceivedClaim,
    outcome: ReceivedClaimOutcome,
    extra: { readonly approvedAmount?: string; readonly reason?: string },
    done: string,
  ): void {
    this.send(claim, this.insurance.decideReceivedClaim(claim.id, { outcome, ...extra }), done);
  }

  private async annulInvoice(claim: ReceivedClaim): Promise<void> {
    const invoice = claim.invoice;
    if (invoice === null) return;
    const reason = await this.dialogs.confirmWithReason(
      {
        title: `Anular la factura ${invoice.invoiceNumber}`,
        message:
          'La factura queda anulada y no se puede recuperar. El dictamen no cambia: ' +
          'la solicitud sigue aprobada y después podés emitir la factura corregida.',
        details: [
          { label: 'Solicitud', value: claim.claimIdentifier },
          { label: 'Paciente', value: claim.patient.displayName ?? 'Sin nombre registrado' },
          { label: 'Importe facturado', value: formatMoney(invoice.amount) },
        ],
        confirmLabel: 'Anular factura',
        cancelLabel: 'Volver',
        destructive: true,
      },
      { label: 'Motivo de la anulación', hint: 'Queda registrado junto a la factura anulada.' },
    );
    if (reason === null) return;
    this.send(
      claim,
      this.insurance.annulReceivedClaimInvoice(claim.id, reason),
      `Factura ${invoice.invoiceNumber} anulada.`,
    );
  }

  private async reissueInvoice(claim: ReceivedClaim): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'Emitir la factura corregida',
      message:
        `Se emite una factura nueva por ${formatMoney(claim.approvedTotal)}, lo que produce un ` +
        'evento de facturación. La anulada queda en el historial de la solicitud.',
      details: [
        { label: 'Solicitud', value: claim.claimIdentifier },
        { label: 'Factura anulada', value: claim.invoice?.invoiceNumber ?? '—' },
      ],
      confirmLabel: 'Emitir factura',
      cancelLabel: 'Volver',
    });
    if (!confirmed) return;
    this.send(claim, this.insurance.reissueReceivedClaimInvoice(claim.id), 'Se emitió la factura corregida.');
  }

  private send(claim: ReceivedClaim, request: Observable<ReceivedClaim>, done: string): void {
    this.busyId.set(claim.id);
    request.subscribe({
      next: (updated) => {
        this.busyId.set(null);
        this.replace(updated);
        this.toasts.success(done);
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        const body = error instanceof HttpErrorResponse ? readApiError(error) : null;
        this.toasts.error(body?.message ?? 'No se pudo completar. Probá de nuevo en un momento.');
        // Un 409 dice que alguien más ya la movió: se trae la lista de nuevo.
        if (error instanceof HttpErrorResponse && error.status === 409) this.load();
      },
    });
  }

  private replace(updated: ReceivedClaim): void {
    const current = this.state();
    if (current.status !== 'ready') return;
    this.state.set(ready(current.data.map((c) => (c.id === updated.id ? updated : c))));
    if (this.claimOnView()?.id === updated.id) this.claimOnView.set(updated);
  }

  protected readonly money = formatMoney;
  protected readonly amount = formatAmount;

  protected sealOf(claim: ReceivedClaim): StatusSealVariant {
    return (claim.status && STATUS_SEAL[claim.status.code]) ?? UNKNOWN_STATUS_VARIANT;
  }
}

/** Los valores distintos de una columna, como opciones de su filtro, en orden alfabético. */
function distinctOptions(
  claims: readonly ReceivedClaim[],
  pick: (claim: ReceivedClaim) => readonly [value: string, label: string] | null,
): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const claim of claims) {
    const pair = pick(claim);
    if (pair !== null) seen.set(pair[0], pair[1]);
  }
  return [...seen]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** Los campos que recorre el buscador multicampo. */
function searchableFields(claim: ReceivedClaim): readonly string[] {
  return [
    claim.claimIdentifier,
    claim.patient.displayName ?? '',
    claim.patient.patientCode ?? '',
    claim.patient.memberIdentifier ?? '',
    claim.practitioner?.displayName ?? '',
    claim.practitioner?.specialty ?? '',
    claim.service?.display ?? '',
    claim.providerName,
    claim.policyIdentifier ?? '',
    claim.planName ?? '',
    claim.status?.display ?? '',
  ];
}

function daysOf(value: string | null | undefined): number | null {
  return PERIODS.find((p) => p.value === value)?.days ?? null;
}

function withinDays(date: Date | null, days: number | null, now: number): boolean {
  if (days === null) return true;
  if (date === null) return false;
  return (now - date.getTime()) / MS_PER_DAY <= days;
}

/** Normaliza acentos y mayúsculas para el buscador, igual que `work-history`. */
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}
