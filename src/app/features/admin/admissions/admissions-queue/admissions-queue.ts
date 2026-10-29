import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AdmissionsClient } from '@core/data-access/admissions/admissions.client';
import type { AdmissionPage, AdmissionSummary } from '@core/data-access/admissions/admissions.types';
import { SessionStore } from '@core/auth/session.store';
import { errorToViewState } from '@core/http/error-to-view-state';
import { NavigationService } from '@core/navigation/navigation.service';
import { empty, forbidden, loading, offline, ready, stale } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { readAdmissionError } from '@shared/admissions/admission-error';
import {
  ADMISSION_STATUS_TABS,
  admissionStatusVariant,
  progressText,
} from '@shared/admissions/admission-presentation';
import { Badge } from '@shared/components/atoms/badge/badge';
import { AppButton } from '@shared/components/atoms/button/button';
import { Link } from '@shared/components/atoms/link/link';
import { Card } from '@shared/components/molecules/card/card';
import { DataTable } from '@shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '@shared/components/organisms/data-table/data-table.types';
import { FilterBar, type FilterDef } from '@shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { admissionDetailRoute } from '../admissions.routes';

/** Cuántas filas trae cada página. */
export const QUEUE_PAGE_SIZE = 25;
/** La página uno: el cursor vacío no sirve porque la tabla lo toma por «no hay anterior». */
const FIRST_PAGE = '__first__';
/** Lo que se espera tras la última tecla antes de buscar. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Una fila ya resuelta para mostrar: la presentación no vive en el DTO. */
interface QueueRow {
  readonly id: string;
  readonly name: string;
  readonly profession: string;
  readonly maskedId: string;
  readonly typeLabel: string;
  readonly statusCode: string;
  readonly statusLabel: string;
  readonly statusVariant: ReturnType<typeof admissionStatusVariant>;
  readonly progress: string;
  readonly ratio: number;
  readonly dueAt: Date | null;
  readonly overdue: boolean;
  readonly overdueDays: number;
  readonly assignee: string | null;
}

function toRow(a: AdmissionSummary): QueueRow {
  return {
    id: a.id,
    name: a.practitioner.fullName,
    profession: a.practitioner.profession ?? 'Sin profesión',
    maskedId: a.practitioner.maskedNationalId ?? 'Sin documento',
    typeLabel: a.type.label,
    statusCode: a.status.code,
    statusLabel: a.status.label,
    statusVariant: admissionStatusVariant(a.status.code),
    progress: progressText(a.requirementsSummary),
    ratio: a.requirementsSummary.total === 0 ? 0 : a.requirementsSummary.verified / a.requirementsSummary.total,
    dueAt: a.dueAt,
    overdue: a.overdue,
    overdueDays: a.overdue && a.dueAt !== null ? Math.max(1, Math.floor((Date.now() - a.dueAt.getTime()) / 86_400_000)) : 0,
    assignee: a.assignedTo?.name ?? null,
  };
}

type Cell = TemplateRef<{ $implicit: QueueRow }>;

/** Los filtros que viajan a la URL (la búsqueda no: ahí se escribe el documento de una persona). */
const FILTERS: readonly FilterDef[] = [
  {
    key: 'type',
    label: 'Tipo',
    placeholder: 'Todos los tipos',
    options: [{ value: 'ALTA_DE_DOCTOR', label: 'Alta de doctor' }],
  },
  {
    key: 'assignedTo',
    label: 'Asignación',
    placeholder: 'Todas',
    options: [
      { value: 'me', label: 'Asignadas a mí' },
      { value: 'none', label: 'Sin asignar' },
    ],
  },
  {
    key: 'overdue',
    label: 'Plazo',
    placeholder: 'Con o sin vencer',
    options: [{ value: 'true', label: 'Solo vencidas' }],
  },
];

/**
 * La bandeja de «Admisiones»: lo que espera una persona, ordenado por quién
 * vence antes. Es genérica —hoy trae el alta de doctor— y se filtra por tipo,
 * estado (con contadores del servidor), asignación y vencimiento.
 *
 * El estado, el tipo, la asignación y el vencimiento viven en la URL: recargar
 * o compartir el enlace reproduce la misma bandeja. **La búsqueda no**: lo que
 * se escribe es el nombre o el documento de una persona, y la dirección queda
 * en el historial y en los registros de los servidores. Con texto, la consulta
 * viaja por `POST /admissions/search`; la bandeja muestra el documento
 * enmascarado.
 *
 * Los nueve estados del M34: el acceso a la ruta (S1) lo resuelve el guard de
 * sección antes de montar esta pantalla; el resto los pinta `app-view-state-host`.
 * Si falla una recarga con datos a la vista, se conservan como «desactualizados»
 * (S7) con su antigüedad en vez de borrarlos.
 */
@Component({
  selector: 'app-admissions-queue',
  imports: [
    AppButton,
    Badge,
    Card,
    DataTable,
    DatePipe,
    FilterBar,
    Link,
    PageHeader,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './admissions-queue.html',
  styleUrl: './admissions-queue.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionsQueue {
  private readonly client = inject(AdmissionsClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly navigation = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly filterDefs = FILTERS;
  protected readonly detailRoute = admissionDetailRoute;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly status = computed(() => this.query().get('status') ?? '');
  private readonly type = computed(() => this.query().get('type') ?? '');
  private readonly assigned = computed(() => this.query().get('assignedTo') ?? '');
  private readonly overdue = computed(() => this.query().get('overdue') === 'true');

  /** Lo que se escribió en el buscador, y lo que se consulta tras la espera. */
  protected readonly searchText = signal('');
  private readonly committedSearch = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  /** Cursores de las páginas ya vistas; el último es el de la página actual. */
  private readonly filterKey = computed(() =>
    [this.status(), this.type(), this.assigned(), this.overdue(), this.committedSearch()].join('|'),
  );
  /** Un filtro distinto vuelve a la primera página: el cursor no sobrevive. */
  protected readonly cursors = linkedSignal<string, readonly string[]>({
    source: this.filterKey,
    computation: () => [FIRST_PAGE],
  });

  protected readonly state = signal<ViewState<AdmissionPage>>(loading());
  private lastGood: { page: AdmissionPage; at: Date } | null = null;
  private requestSeq = 0;

  protected readonly hasFilters = computed(
    () => this.status() !== '' || this.type() !== '' || this.assigned() !== '' || this.overdue() || this.committedSearch() !== '',
  );

  protected readonly page = computed<AdmissionPage | null>(() => {
    const actual = this.state();
    return actual.status === 'ready' || actual.status === 'stale' ? actual.data : null;
  });

  protected readonly rows = computed<readonly QueueRow[]>(() => this.page()?.items.map(toRow) ?? []);
  protected readonly tableState = computed<ViewState<readonly QueueRow[]>>(() => ready(this.rows()));

  /** Los contadores por estado, tal como los da el servidor. */
  protected readonly tabs = computed(() => {
    const counts = this.page()?.counts ?? {};
    const total = Object.values(counts).reduce((suma, n) => suma + n, 0);
    return [
      { value: '', label: 'Todas', count: total },
      ...ADMISSION_STATUS_TABS.map((t) => ({ value: t.code as string, label: t.label, count: counts[t.code] ?? 0 })),
    ];
  });

  protected readonly cursorState = computed(() => {
    const pila = this.cursors();
    return {
      prevCursor: pila.length > 1 ? pila[pila.length - 2]! : null,
      nextCursor: this.page()?.nextCursor ?? null,
    };
  });
  protected readonly pageNumber = computed(() => this.cursors().length);

  private readonly nameCell = viewChild<Cell>('nameCell');
  private readonly statusCell = viewChild<Cell>('statusCell');
  private readonly progressCell = viewChild<Cell>('progressCell');
  private readonly dueCell = viewChild<Cell>('dueCell');
  private readonly assigneeCell = viewChild<Cell>('assigneeCell');
  private readonly actionCell = viewChild<Cell>('actionCell');

  protected readonly columns = computed<readonly ColumnDef<QueueRow>[]>(() => [
    { key: 'name', header: 'Médico', priority: 1, cell: this.nameCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'progress', header: 'Avance de la revisión', priority: 2, cell: this.progressCell() },
    { key: 'dueAt', header: 'Vence', priority: 1, cell: this.dueCell() },
    { key: 'assignee', header: 'Asignada a', priority: 3, cell: this.assigneeCell() },
    { key: 'action', header: 'Acción', priority: 1, accion: true, cell: this.actionCell() },
  ]);

  protected readonly byId = (row: QueueRow): string => row.id;
  protected readonly rowLabel = (row: QueueRow): string => `Revisar la admisión de ${row.name}`;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimer());
    effect(() => {
      const cursor = this.cursors().at(-1)!;
      untracked(() => this.load(cursor));
    });
  }

  private clearTimer(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = null;
  }

  protected onSearch(texto: string): void {
    this.searchText.set(texto);
    this.clearTimer();
    this.searchTimer = setTimeout(() => this.committedSearch.set(texto.trim()), SEARCH_DEBOUNCE_MS);
  }

  protected selectStatus(code: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: code === '' ? null : code },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    this.clearTimer();
    this.searchText.set('');
    this.committedSearch.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: { status: null, type: null, assignedTo: null, overdue: null } });
  }

  protected reload(): void {
    this.load(this.cursors().at(-1)!);
  }

  protected goTo(cursor: string): void {
    const pila = this.cursors();
    const anterior = pila.indexOf(cursor);
    this.cursors.set(anterior >= 0 ? pila.slice(0, anterior + 1) : [...pila, cursor]);
  }

  protected open(row: QueueRow): void {
    void this.router.navigateByUrl(admissionDetailRoute(row.id));
  }

  private load(cursor: string): void {
    const seq = ++this.requestSeq;
    if (this.lastGood === null) this.state.set(loading());
    const assigned = this.assigned() === 'me' ? (this.session.userId() ?? '') : this.assigned();
    this.client
      .list({
        ...(this.type() === '' ? {} : { type: this.type() }),
        ...(this.status() === '' ? {} : { status: this.status() }),
        ...(assigned === '' ? {} : { assignedTo: assigned }),
        ...(this.overdue() ? { overdue: true } : {}),
        ...(this.committedSearch() === '' ? {} : { q: this.committedSearch() }),
        ...(cursor === FIRST_PAGE ? {} : { cursor }),
        limit: QUEUE_PAGE_SIZE,
        sort: 'due_at',
      })
      .subscribe({
        next: (page) => {
          // Una respuesta vieja no pisa a una más nueva.
          if (seq !== this.requestSeq) return;
          this.lastGood = { page, at: new Date() };
          const total = Object.values(page.counts).reduce((s, n) => s + n, 0);
          this.state.set(
            page.items.length === 0 && !this.hasFilters() && total === 0 && cursor === FIRST_PAGE
              ? empty({ label: 'Las nuevas altas de doctor aparecen acá apenas se registran.' }, 'No hay admisiones todavía.')
              : ready(page),
          );
        },
        error: (error: unknown) => {
          if (seq !== this.requestSeq) return;
          const problema = readAdmissionError(error);
          if (problema.kind === 'role') {
            this.state.set(forbidden({ message: problema.message, ...(problema.requestId === null ? {} : { requestId: problema.requestId }) }));
          } else if (problema.kind === 'offline' && this.lastGood !== null) {
            // Sin red pero con datos a la vista: se conservan, diciendo cuánto hace que son.
            this.state.set(stale(this.lastGood.page, this.lastGood.at));
          } else if (problema.kind === 'offline') {
            this.state.set(offline(new Date()));
          } else {
            this.state.set(errorToViewState<AdmissionPage>(error));
          }
        },
      });
  }
}
