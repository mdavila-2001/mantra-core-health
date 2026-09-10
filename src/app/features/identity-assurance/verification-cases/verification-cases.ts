import { DatePipe } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { FileDownloader } from '../../../core/data-access/files/file-downloader';
import { FilesClient } from '../../../core/data-access/files/files.client';
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
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Link } from '../../../shared/components/atoms/link/link';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
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
  // **El mismo tipo, con los dos códigos que circulan.** Acá decía sólo
  // `TENANT_VERIFICATION`, pero el catálogo que publica
  // `GET /identity/verification-types` lo llama `TENANT` — y como un código sin
  // entrada se muestra tal cual, la tabla mostraba «TENANT» crudo al lado de
  // «Identidad profesional» y «Matrícula profesional» (2026-09-10).
  //
  // Se aceptan los dos porque **no se pudo comprobar cuál emite el backend
  // real**: se trabajó contra el simulador. El día que se confirme, sobra uno y
  // esta entrada queda en una línea. Mismo patrón que `ALIAS_DEL_PAQUETE` en
  // `admin/medical-laboratory`.
  TENANT: 'Organización',
  TENANT_VERIFICATION: 'Organización',
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/**
 * Estados que todavía no tienen un veredicto que mostrar (FT-32-R06/R07).
 *
 * El detalle resolutivo no se abre en ninguno de estos: no hay nada resuelto
 * que enseñar, y abrir una pantalla vacía se lee como que el trámite falló.
 * En su lugar se abre un aviso que dice en qué punto está.
 */
const SIN_VEREDICTO: ReadonlySet<StatusSealVariant> = new Set(['pending', 'in-review']);

/** Fila de la tabla: presentación ya resuelta, no el DTO del backend. */
interface CaseRow {
  readonly id: string;
  readonly sealVariant: StatusSealVariant;
  readonly statusVariant: BadgeVariant;
  readonly statusLabel: string;
  readonly typeLabel: string;
  readonly evidenceFileId: string | null;
  /** FT-32-R06/R07: `true` mientras no haya veredicto que abrir. */
  readonly sinVeredicto: boolean;
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
    sinVeredicto: SIN_VEREDICTO.has(status.variant),
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
  imports: [
    AppButton,
    Badge,
    ContentDialog,
    DataTable,
    DatePipe,
    Link,
    PageHeader,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './verification-cases.html',
  styleUrl: './verification-cases.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationCases {
  /**
   * `true` cuando esta pantalla vive **dentro** del centro de verificación,
   * como una de sus pestañas.
   *
   * Lo único que cambia es el membrete: adentro lo pone el contenedor, y dos
   * títulos apilados serían dos pantallas dibujadas una encima de la otra. La
   * ruta propia sigue existiendo y ahí el membrete se dibuja como siempre.
   */
  readonly embedded = input(false, { transform: booleanAttribute });

  private readonly identity = inject(IdentityClient);
  private readonly archivos = inject(FilesClient);
  private readonly descargas = inject(FileDownloader);
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
  private readonly typeCell = viewChild<CaseCell>('typeCell');
  private readonly statusCell = viewChild<CaseCell>('statusCell');
  private readonly evidenceCell = viewChild<CaseCell>('evidenceCell');
  private readonly openedCell = viewChild<CaseCell>('openedCell');
  private readonly completedCell = viewChild<CaseCell>('completedCell');

  /** `key` es el código estable de la columna; la etiqueta es presentación. */
  protected readonly columns = computed<readonly ColumnDef<CaseRow>[]>(() => [
    { key: 'id', header: 'Identificador', priority: 1, cell: this.idCell() },
    { key: 'type', header: 'Tipo', priority: 2, cell: this.typeCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'openedAt', header: 'Apertura', priority: 2, cell: this.openedCell() },
    { key: 'completedAt', header: 'Finalización', priority: 2, cell: this.completedCell() },
    { key: 'evidence', header: 'Evidencia', priority: 3, cell: this.evidenceCell() },
  ]);

  protected readonly byId = (row: CaseRow): string => row.id;

  /** El caso cuyo aviso «todavía no hay veredicto» está abierto (R06/R07). */
  protected readonly avisoDe = signal<CaseRow | null>(null);

  /** El caso cuya evidencia se está trayendo, para no ofrecerla dos veces. */
  protected readonly descargando = signal<string | null>(null);

  /** Lo que falló al traer la evidencia; se muestra bajo la tabla. */
  protected readonly errorDeDescarga = signal<string | null>(null);

  protected abrirAviso(caso: CaseRow): void {
    this.avisoDe.set(caso);
  }

  protected cerrarAviso(): void {
    this.avisoDe.set(null);
  }

  /**
   * Trae el archivo de evidencia y lo ofrece para guardar (FT-32-R02).
   *
   * Va por `contentDataUrl` y no por una URL del navegador: la CSP del
   * servidor deja `connect-src` en `'self'`, así que el contenido viaja por el
   * `GET` autenticado de siempre y se entrega como `data:` URL. El backend ya
   * exige ser quien lo subió o tener rol revisor: no hace falta comprobarlo acá.
   */
  protected descargarEvidencia(caso: CaseRow): void {
    const fileId = caso.evidenceFileId;
    if (fileId === null || this.descargando() !== null) {
      return;
    }
    this.descargando.set(caso.id);
    this.errorDeDescarga.set(null);
    this.archivos.contentDataUrl(fileId).subscribe({
      next: (dataUrl) => {
        this.descargas.trigger(dataUrl, `evidencia-${caso.id}`);
        this.descargando.set(null);
      },
      error: () => {
        this.descargando.set(null);
        this.errorDeDescarga.set(
          'No pudimos traer la evidencia de ese caso. Probá de nuevo en un momento.',
        );
      },
    });
  }

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
