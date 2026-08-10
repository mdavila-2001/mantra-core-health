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

import { IdentityClient } from '../../../core/data-access/identity/identity.client';
import type { VerificationCase } from '../../../core/data-access/identity/identity.types';
import {
  errorToViewState,
  IDENTITY_VERIFICATION_ROUTE,
} from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { toCaseStatusPresentation } from '../../identity-verification/case-status';

/** Fila de la tabla: presentación ya resuelta, no el DTO del backend. */
interface CaseRow {
  readonly id: string;
  readonly statusVariant: BadgeVariant;
  readonly statusLabel: string;
  readonly openedAt: Date | null;
  readonly completedAt: Date | null;
}

/**
 * El sello y el badge comparten semántica pero no escala: en una celda de
 * tabla el sello ocuparía media fila, así que el estado va como badge con la
 * misma etiqueta que el sello muestra en el detalle.
 */
const BADGE_BY_SEAL_VARIANT: Readonly<Record<StatusSealVariant, BadgeVariant>> = {
  pending: 'warning',
  'in-review': 'info',
  approved: 'success',
  rejected: 'error',
  expired: 'secondary',
  unknown: 'secondary',
};

function toCaseRow(verificationCase: VerificationCase): CaseRow {
  const status = toCaseStatusPresentation(verificationCase.status);
  return {
    id: verificationCase.id,
    statusVariant: BADGE_BY_SEAL_VARIANT[status.variant],
    statusLabel: status.label,
    openedAt: verificationCase.openedAt ?? null,
    completedAt: verificationCase.completedAt ?? null,
  };
}

type CaseCell = TemplateRef<{ $implicit: CaseRow }>;

/**
 * V27-01 · Casos de verificación (mi cuenta).
 *
 * Autoservicio: `GET /identity/me/verification-cases` devuelve los casos del
 * usuario autenticado —el backend resuelve de quién, la pantalla jamás lo
 * pide— como array plano, sin cursor ni filtros. Por eso la tabla no pagina:
 * inventarle paginación a un contrato que no la tiene sería mentirle a quien
 * la usa. Las columnas son las cuatro que el contrato expone hoy.
 *
 * La tabla va envuelta en un `app-view-state-host` propio porque el que trae
 * `app-data-table` adentro no re-emite `retry`: sin este envoltorio, el botón
 * «Reintentar» del estado de error no haría nada.
 */
@Component({
  selector: 'app-verification-cases',
  imports: [Badge, DataTable, DatePipe, Link, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './verification-cases.html',
  styleUrl: './verification-cases.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationCases {
  private readonly identity = inject(IdentityClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly state = signal<ViewState<readonly CaseRow[]>>(loading());

  private readonly idCell = viewChild<CaseCell>('idCell');
  private readonly statusCell = viewChild<CaseCell>('statusCell');
  private readonly openedCell = viewChild<CaseCell>('openedCell');
  private readonly completedCell = viewChild<CaseCell>('completedCell');

  /** `key` es el código estable de la columna; la etiqueta es presentación. */
  protected readonly columns = computed<readonly ColumnDef<CaseRow>[]>(() => [
    { key: 'id', header: 'Identificador', priority: 1, cell: this.idCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'openedAt', header: 'Apertura', priority: 2, cell: this.openedCell() },
    { key: 'completedAt', header: 'Finalización', priority: 2, cell: this.completedCell() },
  ]);

  protected readonly byId = (row: CaseRow): string => row.id;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.identity.listVerificationCases().subscribe({
      next: (casos) => this.state.set(this.aEstado(casos)),
      error: (error: unknown) => this.state.set(errorToViewState<readonly CaseRow[]>(error)),
    });
  }

  private aEstado(casos: readonly VerificationCase[]): ViewState<readonly CaseRow[]> {
    if (casos.length === 0) {
      return empty(
        { label: 'Verificar mi identidad', route: IDENTITY_VERIFICATION_ROUTE },
        'Cuando inicies una verificación de identidad, tus trámites van a aparecer acá.',
      );
    }
    return ready(casos.map(toCaseRow));
  }
}
