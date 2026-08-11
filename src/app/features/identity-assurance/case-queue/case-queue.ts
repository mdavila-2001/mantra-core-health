import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type { QueuedCase } from '../../../core/data-access/identity/identity-admin.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  CaseStatusCatalog,
  toCaseStatusCode,
  toCaseStatusPresentation,
} from '../../identity-verification/case-status';
import { AT_RISK_CODE, toReviewerStatusLabel } from './case-queue.presentation';

/** Ruta del formulario que escala un caso a revisión manual. */
const ESCALATE_ROUTE = '/administracion/verificacion-identidad/revision/escalar';
/** Ruta del alta de caso, salida del estado vacío. */
const OPEN_CASE_ROUTE = '/administracion/verificacion-identidad/casos/nuevo';

/** Fila de la cola: presentación resuelta, no el DTO del backend. */
interface QueueRow {
  readonly id: string;
  readonly statusVariant: BadgeVariant;
  readonly statusLabel: string;
  readonly subjectEntityId: string;
  readonly openedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly riskScore: string | null;
}

/**
 * El sello y el badge comparten semántica pero no escala. Mismo mapa que usa
 * `verification-cases` para que un estado no se llame distinto según quién
 * mire; sólo cambia la etiqueta, no el color.
 */
const BADGE_BY_VARIANT: Readonly<Record<string, BadgeVariant>> = {
  pending: 'warning',
  'in-review': 'info',
  approved: 'success',
  rejected: 'error',
  expired: 'secondary',
  unknown: 'secondary',
};

function toQueueRow(kase: QueuedCase): QueueRow {
  const presentacion = toCaseStatusPresentation(kase.status);
  const codigo = toCaseStatusCode(kase.status);
  return {
    id: kase.id,
    statusVariant:
      codigo === AT_RISK_CODE ? 'error' : (BADGE_BY_VARIANT[presentacion.variant] ?? 'secondary'),
    statusLabel: toReviewerStatusLabel(codigo, presentacion.label),
    subjectEntityId: kase.subjectEntityId,
    openedAt: kase.openedAt ?? null,
    expiresAt: kase.expiresAt ?? null,
    riskScore: kase.riskScore ?? null,
  };
}

type QueueCell = TemplateRef<{ $implicit: QueueRow }>;

/**
 * V27-02 · Cola de revisión de identidad (administración).
 *
 * La única lectura de la superficie administrativa del M27. Sin ella un revisor
 * sólo podía actuar sobre un caso cuyo id ya conociera, y el caso que abre un
 * solicitante por autoservicio no llegaba por ningún lado.
 *
 * `GET /identity/verification-cases` devuelve, sin filtros, los estados que
 * esperan a una persona, del más viejo al más nuevo: al frente va quien más
 * esperó. La tabla **no pagina** porque el contrato no expone cursor —
 * inventarle paginación sería mentirle a quien la usa— y el backend acota con
 * `limit`.
 *
 * > [!warning] El alcance de esta pantalla lo da el rol, no el dato.
 * > `identity_verification_cases` no tiene `tenant_id`, así que el RLS por
 * > `app.current_tenant_id` no la alcanza. Un `SECURITY_ADMIN` ve por acá los
 * > casos de todos los tenants. Está documentado en el servicio del backend
 * > (`IdentityCasesService.listQueue`) y es deuda abierta, no un descuido.
 *
 * El envoltorio `app-view-state-host` es propio: el que trae `app-data-table`
 * adentro no re-emite `retry`, y sin esto el botón «Reintentar» no haría nada.
 */
@Component({
  selector: 'app-case-queue',
  imports: [Badge, DataTable, DatePipe, Link, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './case-queue.html',
  styleUrl: './case-queue.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseQueue {
  private readonly identity = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);
  // `toQueueRow` resuelve el estado con `toCaseStatusPresentation`, que lee el
  // catálogo de terminología: inyectarlo acá es lo que lo llena.
  private readonly estadosDeCaso = inject(CaseStatusCatalog);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /**
   * Los casos tal como los devuelve el backend, sin traducir.
   *
   * Se guardan crudos y la traducción se deriva: los estados se resuelven
   * contra terminología, que responde **después** de que la cola llegó. Mapear
   * dentro del `subscribe` congelaba las etiquetas en el instante equivocado y
   * la tabla mostraba «Desconocido» para siempre, aunque el catálogo llegara un
   * segundo más tarde.
   */
  private readonly casos = signal<ViewState<readonly QueuedCase[]>>(loading());

  protected readonly state = computed<ViewState<readonly QueueRow[]>>(() => {
    const estado = this.casos();
    return estado.status === 'ready'
      ? ready(estado.data.map(toQueueRow))
      : (estado as ViewState<readonly QueueRow[]>);
  });

  protected readonly escalateRoute = ESCALATE_ROUTE;

  private readonly statusCell = viewChild<QueueCell>('statusCell');
  private readonly caseCell = viewChild<QueueCell>('caseCell');
  private readonly subjectCell = viewChild<QueueCell>('subjectCell');
  private readonly openedCell = viewChild<QueueCell>('openedCell');
  private readonly expiresCell = viewChild<QueueCell>('expiresCell');
  private readonly actionCell = viewChild<QueueCell>('actionCell');

  /** `key` es el código estable de la columna; la etiqueta es presentación. */
  protected readonly columns = computed<readonly ColumnDef<QueueRow>[]>(() => [
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'id', header: 'Caso', priority: 2, cell: this.caseCell() },
    { key: 'subjectEntityId', header: 'Sujeto', priority: 3, cell: this.subjectCell() },
    { key: 'openedAt', header: 'Esperando desde', priority: 1, cell: this.openedCell() },
    { key: 'expiresAt', header: 'Vence', priority: 3, cell: this.expiresCell() },
    { key: 'action', header: 'Acción', priority: 1, cell: this.actionCell() },
  ]);

  protected readonly byId = (row: QueueRow): string => row.id;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.casos.set(loading());
    this.identity.listCaseQueue().subscribe({
      next: (casos) => this.casos.set(this.aEstado(casos)),
      error: (error: unknown) =>
        this.casos.set(errorToViewState<readonly QueuedCase[]>(error)),
    });
  }

  private aEstado(casos: readonly QueuedCase[]): ViewState<readonly QueuedCase[]> {
    if (casos.length === 0) {
      // Una cola vacía es buena noticia, pero el M34 exige salida igual («un
      // vacío sin salida es un callejón»): la de acá es abrir un caso a mano,
      // que es lo único que un revisor puede hacer sin esperar a nadie.
      return empty(
        { label: 'Abrir un caso de verificación', route: OPEN_CASE_ROUTE },
        'No hay casos esperando revisión.',
      );
    }
    return ready(casos);
  }
}
