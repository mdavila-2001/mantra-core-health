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
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { ReceivedClaim } from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
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

/** Claves de los filtros en la URL. Una por encabezado filtrable. */
const FILTER_KEYS = {
  practitioner: 'practitioner',
  service: 'service',
  amount: 'amount',
  submitted: 'submitted',
  serviceDate: 'serviceDate',
  status: 'status',
  provider: 'provider',
} as const;

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
    ContentDialog,
    DataTable,
    FilterBar,
    PageHeader,
    Pagination,
    Skeleton,
    StatusSeal,
    ViewStateHost,
  ],
  templateUrl: './received-claims.html',
  styleUrl: './received-claims.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivedClaims {
  private readonly insurance = inject(InsuranceClient);
  private readonly route = inject(ActivatedRoute);

  /** La lista completa recibida del servidor (S1/S2/S3/S9 del M34). */
  protected readonly state = signal<ViewState<readonly ReceivedClaim[]>>(loading());
  protected readonly truncated = signal(false);

  /* ---- búsqueda, filtros, orden y página ---------------------------------- */

  protected readonly searchTerm = signal('');
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
        key: FILTER_KEYS.status,
        label: 'Estado',
        placeholder: 'Todos los estados',
        options: distinctOptions(claims, (c) =>
          c.status === null ? null : [c.status.code, c.status.display],
        ),
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

  protected readonly filteredClaims = computed<readonly ReceivedClaim[]>(() => {
    const term = normalizeText(this.searchTerm().trim());
    const f = this.activeFilters();
    const amountRange = AMOUNT_RANGES.find((r) => r.value === f[FILTER_KEYS.amount]);
    const submittedDays = daysOf(f[FILTER_KEYS.submitted]);
    const serviceDays = daysOf(f[FILTER_KEYS.serviceDate]);
    const now = Date.now();

    return this.allClaims().filter((claim) => {
      if (f[FILTER_KEYS.practitioner] && claim.practitioner?.id !== f[FILTER_KEYS.practitioner]) return false;
      if (f[FILTER_KEYS.service] && claim.service?.code !== f[FILTER_KEYS.service]) return false;
      if (f[FILTER_KEYS.status] && claim.status?.code !== f[FILTER_KEYS.status]) return false;
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
  private readonly submittedCell = viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('submittedCell');
  private readonly serviceDateCell =
    viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('serviceDateCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: ReceivedClaim }>>('statusCell');

  /**
   * Las columnas del pedido, en su orden. En móvil quedan a la vista paciente
   * y monto; el resto se pliega a la fila de detalle, a un toque.
   *
   * Lo que no es de las seis columnas pedidas —código de solicitud, prestador,
   * plan, póliza, monto aprobado— va en el detalle, y **no hay columna de
   * acciones ni de código**: medido con la barra lateral abierta, con ellas
   * la tabla medía 1297 px en una caja de 1040 (a 1440) y 1013 en 896 (a
   * 1280), y ADR-0015 prohíbe el scroll lateral. El código queda como segunda
   * línea del paciente y en el buscador. El detalle se abre tocando la fila o,
   * por teclado, con el nombre del paciente, que es un botón. La moneda se
   * dice una vez, en la línea del conteo.
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
    { key: 'submittedAt', header: 'Fecha de solicitud', priority: 2, sortable: true, cell: this.submittedCell() },
    { key: 'serviceDate', header: 'Fecha de prestación', priority: 2, sortable: true, cell: this.serviceDateCell() },
    { key: 'status', header: 'Estado', priority: 2, sortable: true, cell: this.statusCell() },
  ]);

  protected readonly byId = (claim: ReceivedClaim): string => claim.id;
  protected readonly claimLabel = (claim: ReceivedClaim): string =>
    `${claim.claimIdentifier} · ${claim.patient.displayName ?? 'Paciente sin nombre registrado'}`;

  /* ---- detalle ------------------------------------------------------------ */

  protected readonly claimOnView = signal<ReceivedClaim | null>(null);

  protected openDetail(claim: ReceivedClaim): void {
    this.claimOnView.set(claim);
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
