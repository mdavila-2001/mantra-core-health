import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { catchError, of } from 'rxjs';

import { AccountingClient } from '../../../../core/data-access/accounting/accounting.client';
import type { Practice } from '../../../../core/data-access/accounting/accounting.types';
import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import {
  ROLE_ASSIGNMENT_STATUS,
  roleAssignmentStatusLabel,
} from '../../../../core/data-access/practice-sites/role-assignment-concepts';
import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { describeApiFailure } from '../../../../core/http/api-failure';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Avatar } from '../../../../shared/components/atoms/avatar/avatar';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../../shared/components/molecules/empty-state/empty-state';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { errorMessageOf } from '../../../../shared/forms/form-support';

/**
 * El tono del sello de cada estado de vinculación.
 *
 * Aceptada en verde, pendiente en ámbar, y **rechazada o finalizada en neutro**
 * y no en rojo: una vinculación que terminó no es un error de nadie, y pintarla
 * de rojo en la lista propia haría leer como problema lo que es historia.
 */
function varianteDeEstado(estado: string): BadgeVariant {
  if (estado === ROLE_ASSIGNMENT_STATUS.ACTIVE) return 'success';
  if (estado === ROLE_ASSIGNMENT_STATUS.REJECTED || estado === ROLE_ASSIGNMENT_STATUS.ENDED) {
    return 'secondary';
  }
  return 'warning';
}

/** Una vinculación tal como la pinta la tabla. */
interface AssignmentRow extends MyRoleAssignment {
  readonly statusLabel: string;
  readonly roleLabel: string;
  readonly sinceLabel: string;
  readonly isFinal: boolean;
  /**
   * El sello de verificado se gana, no se declara: sólo aparece cuando la
   * propia organización aceptó la vinculación (`ACTIVE`). Pendiente,
   * suspendida, rechazada o finalizada cuentan como no verificado.
   */
  readonly verified: boolean;
  /** El tono del sello de estado. Presentación, no dominio. */
  readonly statusVariant: BadgeVariant;
}

const FORMATO_DIA = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Pestaña «Mis vinculaciones» del panel de organización médica.
 *
 * ## Para qué sirve esta pantalla
 *
 * Un profesional puede ejercer en más de una organización a la vez (hospital,
 * consultorio propio, clínica). Acá ves todas tus vinculaciones —incluidas
 * las pendientes de aprobación— y pedís vincularte a una organización nueva.
 *
 * ## Ejemplo
 *
 * Elegís «Hospital Central» en el selector, confirmás, y la vinculación queda
 * **pendiente** hasta que esa organización la apruebe. No es automático: la
 * decide la organización, igual que en la vida real.
 *
 * ## Lo que esta pantalla NO hace
 *
 * Pertenecer a una organización **no te da acceso a sus pacientes**. El
 * acceso a un paciente concreto depende siempre de una cita, derivación,
 * intervención o autorización con ese paciente — nunca de estar vinculado a
 * la organización que lo atiende.
 */
@Component({
  selector: 'app-memberships-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AnnounceOnAppear,
    Alert,
    AppButton,
    Avatar,
    Badge,
    Card,
    DataTable,
    EmptyState,
    Select,
  ],
  templateUrl: './memberships-tab.html',
  styleUrl: './memberships-tab.css',
})
export class MembershipsTab {
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly accounting = inject(AccountingClient);
  private readonly terminology = inject(TerminologyClient);

  /**
   * Escrito a mano (no `toSignal` puro): tras enviar una solicitud hay que
   * releer la lista, y una única suscripción de `toSignal` no ofrece forma de
   * volver a dispararla sin este signal.
   */
  private readonly vinculaciones = signal<readonly MyRoleAssignment[] | undefined>(undefined);
  private readonly etiquetasDeCargo = signal<ConceptLabels>(new Map());

  /**
   * El fallo de la lectura de vinculaciones, o `null`.
   *
   * Regla 14 del criterio humano: antes la caída se convertía en `[]` y la
   * pantalla decía «Todavía no tiene vinculaciones» a quien tenía tres.
   */
  private readonly falloDeVinculaciones = signal<ViewState<readonly AssignmentRow[]> | null>(null);

  protected readonly cargandoVinculaciones = computed(() => this.vinculaciones() === undefined);

  protected readonly filas = computed<readonly AssignmentRow[]>(() =>
    (this.vinculaciones() ?? []).map((v) => ({
      ...v,
      statusLabel: roleAssignmentStatusLabel(v.status),
      roleLabel: this.etiquetasDeCargo().get(v.roleConceptId)?.display ?? 'Profesional',
      sinceLabel: v.validFrom === undefined ? '—' : FORMATO_DIA.format(v.validFrom),
      isFinal:
        v.status === ROLE_ASSIGNMENT_STATUS.REJECTED ||
        v.status === ROLE_ASSIGNMENT_STATUS.ENDED,
      verified: v.status === ROLE_ASSIGNMENT_STATUS.ACTIVE,
      statusVariant: varianteDeEstado(v.status),
    })),
  );

  /* --- la tabla ---------------------------------------------------------- *
     El propietario pidió el 2026-09-10 que esta pantalla «sea como están los
     organismos de tabla», porque la lista de tarjetas «está totalmente
     detonada». Se usa `app-data-table`, que es el organismo del sistema, con
     las celdas de presentación proyectadas. */

  private readonly celdaOrganizacion =
    viewChild.required<TemplateRef<{ $implicit: AssignmentRow }>>('celdaOrg');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: AssignmentRow }>>('celdaEstado');
  private readonly celdaCargo =
    viewChild.required<TemplateRef<{ $implicit: AssignmentRow }>>('celdaCargo');
  private readonly celdaDesde =
    viewChild.required<TemplateRef<{ $implicit: AssignmentRow }>>('celdaDesde');
  private readonly celdaAcciones =
    viewChild.required<TemplateRef<{ $implicit: AssignmentRow }>>('celdaAcciones');

  protected readonly columnas = computed<readonly ColumnDef<AssignmentRow>[]>(() => [
    { key: 'practiceName', header: 'Organización', priority: 1, cell: this.celdaOrganizacion() },
    { key: 'roleConceptId', header: 'Rol/cargo', priority: 2, cell: this.celdaCargo() },
    { key: 'validFrom', header: 'Desde', priority: 3, cell: this.celdaDesde() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    {
      key: 'actions',
      header: 'Acciones',
      priority: 1,
      sticky: 'end',
      cell: this.celdaAcciones(),
    },
  ]);

  protected readonly porId = (fila: AssignmentRow): string => fila.id;

  /** El estado de la tabla, en los términos del M34. */
  protected readonly estadoDeLaTabla = computed<ViewState<readonly AssignmentRow[]>>(
    () =>
      this.falloDeVinculaciones() ??
      (this.vinculaciones() === undefined ? loading() : ready(this.filas())),
  );

  /** «Todavía no tiene vinculaciones» sólo cuando la lectura respondió vacía. */
  protected readonly sinVinculaciones = computed(
    () =>
      this.falloDeVinculaciones() === null &&
      !this.cargandoVinculaciones() &&
      this.filas().length === 0,
  );

  private readonly practicas = signal<readonly Practice[] | undefined>(undefined);

  /**
   * Por qué no hay organizaciones para elegir; vacío si la lista llegó.
   *
   * Sin esto, una caída dejaba el selector vacío y no había forma de saber si
   * no existía ninguna organización o si no se pudo preguntar.
   */
  protected readonly errorDeOrganizaciones = signal('');

  protected readonly opcionesDeOrganizacion = computed<readonly SelectOption<string>[]>(() =>
    (this.practicas() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  protected readonly organizacionElegida = signal<string | null>(null);

  protected readonly estadoDeSolicitud = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.estadoDeSolicitud().status === 'loading');
  protected readonly errorDeSolicitud = computed(() =>
    errorMessageOf(this.estadoDeSolicitud(), 'No tiene permiso para solicitar esta vinculación.'),
  );
  protected readonly solicitudEnviada = signal(false);

  constructor() {
    this.recargarVinculaciones();
    this.cargarOrganizaciones();
  }

  /** Vuelve a pedir la lista de organizaciones que se pueden elegir. */
  protected cargarOrganizaciones(): void {
    this.errorDeOrganizaciones.set('');
    this.accounting.listPractices().subscribe({
      next: (practicas) => this.practicas.set(practicas),
      error: (error: unknown) => {
        this.practicas.set([]);
        this.errorDeOrganizaciones.set(
          describeApiFailure(
            error,
            'No pudimos traer la lista de organizaciones, así que todavía no puede pedir una vinculación.',
          ),
        );
      },
    });
  }

  /** Vuelve a leer las vinculaciones; lo usa el reintento de la tabla. */
  protected reintentarVinculaciones(): void {
    this.vinculaciones.set(undefined);
    this.recargarVinculaciones();
  }

  protected solicitar(): void {
    const practiceId = this.organizacionElegida();
    if (practiceId === null || this.enviando()) {
      return;
    }
    this.estadoDeSolicitud.set(loading());
    this.solicitudEnviada.set(false);
    this.practiceSites.selfRequestAffiliation(practiceId, {}).subscribe({
      next: () => {
        this.estadoDeSolicitud.set(ready(null));
        this.solicitudEnviada.set(true);
        this.organizacionElegida.set(null);
        this.recargarVinculaciones();
      },
      error: (error: unknown) => this.estadoDeSolicitud.set(errorToViewState<null>(error)),
    });
  }

  /** Preselecciona una vinculación finalizada para pedirla nuevamente. */
  protected elegirParaNuevaSolicitud(fila: AssignmentRow): void {
    if (fila.isFinal) {
      this.organizacionElegida.set(fila.practiceId);
    }
  }

  private recargarVinculaciones(): void {
    this.falloDeVinculaciones.set(null);
    this.practiceSites.listMyRoleAssignments().subscribe({
      next: (items) => {
        this.vinculaciones.set(items);
        this.etiquetasDeCargo.set(new Map());
        const ids = [...new Set(items.map((item) => item.roleConceptId))];
        this.terminology.readConceptLabels(ids).pipe(catchError(() => of(new Map()))).subscribe({
          next: (etiquetas) => this.etiquetasDeCargo.set(etiquetas),
        });
      },
      error: (error: unknown) =>
        this.falloDeVinculaciones.set(errorToViewState<readonly AssignmentRow[]>(error)),
    });
  }
}
