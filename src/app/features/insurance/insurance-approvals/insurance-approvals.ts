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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, type Subscription } from 'rxjs';

import { PriorAuthorizationClient } from '../../../core/data-access/insurance/prior-authorization.client';
import type {
  PriorAuthorizationInboxFilter,
  PriorAuthorizationSummary,
} from '../../../core/data-access/insurance/prior-authorization.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { amountText, originLabel, patientName, statusBadge } from '../prior-authorization-labels';

/** Lo que admite `?estado=` en la URL. `todas` es la ausencia de filtro. */
type Filtro = 'pendientes' | 'decididas' | 'todas';

const FILTRO_API: Readonly<Record<Filtro, PriorAuthorizationInboxFilter | undefined>> = {
  pendientes: 'PENDING',
  decididas: 'DETERMINED',
  todas: undefined,
};

/**
 * Bandeja de solicitudes de aprobación de la aseguradora —
 * `administration/insurance-approvals`.
 *
 * Registro de procesos · MÓDULO ASEGURADORA · «Recepción de solicitudes de
 * órdenes de Aprobación»: lo que médicos, farmacias y laboratorios mandan a
 * aprobar. Abre en **pendientes**, que es lo que hay que responder; la
 * respuesta (APROBADO / NO APROBADO por ítem) se da en el detalle.
 *
 * El filtro viaja en la URL, como en «Solicitudes de seguro»: una bandeja
 * filtrada tiene que poder pegarse en un mensaje y abrir igual.
 *
 * El alcance lo pone la API: un tenant que no es aseguradora recibe 403 y la
 * tabla muestra el estado prohibido, no una lista vacía que lo disimule.
 */
@Component({
  selector: 'app-insurance-approvals',
  imports: [Badge, DataTable, PageHeader, RouterLink, SegmentedControl],
  templateUrl: './insurance-approvals.html',
  styleUrl: './insurance-approvals.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceApprovals {
  private readonly client = inject(PriorAuthorizationClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly patientCell =
    viewChild.required<TemplateRef<{ $implicit: PriorAuthorizationSummary }>>('patientCell');
  private readonly originCell =
    viewChild.required<TemplateRef<{ $implicit: PriorAuthorizationSummary }>>('originCell');
  private readonly amountCell =
    viewChild.required<TemplateRef<{ $implicit: PriorAuthorizationSummary }>>('amountCell');
  private readonly submittedCell =
    viewChild.required<TemplateRef<{ $implicit: PriorAuthorizationSummary }>>('submittedCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: PriorAuthorizationSummary }>>('statusCell');

  protected readonly filterOptions: readonly SegmentedOption<Filtro>[] = [
    { value: 'pendientes', label: 'Pendientes' },
    { value: 'decididas', label: 'Respondidas' },
    { value: 'todas', label: 'Todas' },
  ];

  /** El filtro vigente sale de la URL. Sin parámetro: pendientes. */
  protected readonly filter = toSignal(
    this.route.queryParamMap.pipe(
      map((params): Filtro => {
        const valor = params.get('estado');
        return valor === 'decididas' || valor === 'todas' ? valor : 'pendientes';
      }),
    ),
    { initialValue: 'pendientes' as Filtro },
  );

  protected readonly results = signal<ViewState<readonly PriorAuthorizationSummary[]>>(loading());

  /**
   * Quién y qué siempre a la vista; el resto se pliega a la fila de detalle en
   * móvil (queda a un toque, no se oculta).
   */
  protected readonly columns = computed<readonly ColumnDef<PriorAuthorizationSummary>[]>(() => [
    { key: 'patient', header: 'Paciente', priority: 1, cell: this.patientCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'origin', header: 'Solicitud', priority: 2, cell: this.originCell() },
    { key: 'planName', header: 'Plan', priority: 2 },
    {
      key: 'totalRequestedAmount',
      header: 'Monto solicitado',
      priority: 2,
      align: 'end',
      cell: this.amountCell(),
    },
    { key: 'submittedAt', header: 'Recibida', priority: 2, cell: this.submittedCell() },
  ]);

  protected readonly byId = (row: PriorAuthorizationSummary): string => row.id;
  protected readonly rowLabel = (row: PriorAuthorizationSummary): string => patientName(row.patient);

  protected readonly patientName = patientName;
  protected readonly originLabel = originLabel;
  protected readonly statusBadge = statusBadge;
  protected readonly amountText = amountText;

  /** La lectura en vuelo: un cambio de filtro la cancela (ver `load`). */
  private pedido: Subscription | null = null;

  constructor() {
    effect(() => {
      this.filter();
      untracked(() => this.load());
    });
  }

  protected changeFilter(filtro: Filtro): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filtro === 'pendientes' ? {} : { estado: filtro },
      replaceUrl: true,
    });
  }

  protected retry(): void {
    this.load();
  }

  protected open(row: PriorAuthorizationSummary): void {
    void this.router.navigate(['/administration/insurance-approvals', row.id]);
  }

  private load(): void {
    this.results.set(loading());
    const filtro = this.filter();
    // Se cancela la anterior: tocar «Respondidas» y enseguida «Pendientes»
    // podía pintar la respuesta vieja, si llegaba última, bajo el filtro nuevo.
    this.pedido?.unsubscribe();
    this.pedido = this.client.listInbox(FILTRO_API[filtro]).subscribe({
      next: (items) => this.results.set(items.length > 0 ? ready(items) : this.emptyFor(filtro)),
      error: (error: unknown) =>
        this.results.set(errorToViewState<readonly PriorAuthorizationSummary[]>(error)),
    });
  }

  /** El vacío dice por qué y adónde ir: «pendientes: ninguna» es una buena noticia. */
  private emptyFor(filtro: Filtro): ViewState<readonly PriorAuthorizationSummary[]> {
    if (filtro === 'pendientes') {
      return empty(
        {
          label: 'Ver las respondidas',
          route: '/administration/insurance-approvals',
          queryParams: { estado: 'decididas' },
        },
        'No hay solicitudes esperando respuesta. Las nuevas aparecen acá en cuanto llegan.',
      );
    }
    return empty(
      { label: 'Volver al panel', route: '/dashboard' },
      filtro === 'decididas'
        ? 'Todavía no respondiste ninguna solicitud de aprobación.'
        : 'Todavía no llegó ninguna solicitud de aprobación.',
    );
  }
}
