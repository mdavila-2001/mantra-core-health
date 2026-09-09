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
import {
  CaseStatusCatalog,
  toCaseStatusPresentation,
} from '../../identity-verification/case-status';

/**
 * Etiqueta legible por código de tipo de solicitud (FT-32-R03). Espeja el
 * catálogo que expone `GET /identity/me/verification-types`: un código sin
 * entrada acá (uno nuevo, o `UNKNOWN`) se muestra tal cual en vez de romper.
 */
const TYPE_LABELS: Readonly<Record<string, string>> = {
  PRACTITIONER_IDENTITY: 'Identidad profesional',
  PRACTITIONER_LICENSE: 'Matrícula profesional',
  PATIENT_IDENTITY: 'Identidad (paciente)',
  TENANT_VERIFICATION: 'Institución',
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/**
 * Lo que FT-32 todavía debe.
 *
 * La pantalla se mergeó como `wip` (11417960) con el andamiaje de tres cosas
 * sin terminar, y el andamiaje —imports y constantes que nadie usaba— rompía
 * `yarn lint`. Se quitó, porque código muerto no es documentación; queda acá
 * anotado lo que falta, que sí lo es:
 *
 * 1. **R06/R07**: un caso en `pending` o `in-review` no debería abrir el
 *    detalle resolutivo —no hay veredicto que mostrar— sino un modal que
 *    invite a esperar. Hoy la celda del identificador enlaza al detalle sin
 *    condición, en todos los estados.
 * 2. **La evidencia no se descarga**: `CaseRow.evidenceFileId` se resuelve y
 *    no lo consume nadie; falta la columna con el botón de descarga.
 * 3. **R03 a medias**: `typeLabel` se calcula por fila pero no hay columna de
 *    tipo que lo muestre.
 */

/** Fila de la tabla: presentación ya resuelta, no el DTO del backend. */
interface CaseRow {
  readonly id: string;
  readonly sealVariant: StatusSealVariant;
  readonly statusVariant: BadgeVariant;
  readonly statusLabel: string;
  readonly typeLabel: string;
  readonly evidenceFileId: string | null;
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
    sealVariant: status.variant,
    statusVariant: BADGE_BY_SEAL_VARIANT[status.variant],
    statusLabel: status.label,
    typeLabel: typeLabel(verificationCase.type),
    evidenceFileId: verificationCase.evidenceFileId ?? null,
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
  // `toCaseRow` resuelve el estado con `toCaseStatusPresentation`, que lee el
  // catálogo de terminología: inyectarlo acá es lo que lo llena.
  private readonly estadosDeCaso = inject(CaseStatusCatalog);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  /**
   * Los casos tal como los devuelve el backend, sin traducir.
   *
   * Se guardan crudos y la traducción se deriva: los estados se resuelven contra
   * terminología, que responde **después** de que la lista llegó. Mapear en el
   * `subscribe` congelaba las etiquetas en el instante equivocado y la tabla
   * mostraba «Desconocido» para siempre, aunque el catálogo llegara un segundo
   * más tarde.
   */
  private readonly casos = signal<ViewState<readonly VerificationCase[]>>(loading());

  protected readonly state = computed<ViewState<readonly CaseRow[]>>(() => {
    const estado = this.casos();
    return estado.status === 'ready'
      ? ready(estado.data.map(toCaseRow))
      : (estado as ViewState<readonly CaseRow[]>);
  });

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
    this.casos.set(loading());
    this.identity.listVerificationCases().subscribe({
      next: (casos) => this.casos.set(this.aEstado(casos)),
      error: (error: unknown) =>
        this.casos.set(errorToViewState<readonly VerificationCase[]>(error)),
    });
  }

  private aEstado(casos: readonly VerificationCase[]): ViewState<readonly VerificationCase[]> {
    if (casos.length === 0) {
      return empty(
        { label: 'Verificar mi identidad', route: IDENTITY_VERIFICATION_ROUTE },
        'Cuando inicies una verificación de identidad, tus trámites van a aparecer acá.',
      );
    }
    return ready(casos);
  }
}
