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
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { AccountingClient } from '../../core/data-access/accounting/accounting.client';
import type { Practice } from '../../core/data-access/accounting/accounting.types';
import { PracticeSitesClient } from '../../core/data-access/practice-sites/practice-sites.client';
import {
  ROLE_ASSIGNMENT_STATUS,
  roleAssignmentStatusLabel,
} from '../../core/data-access/practice-sites/role-assignment-concepts';
import type { MyRoleAssignment } from '../../core/data-access/practice-sites/practice-sites.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../shared/a11y/announce-on-appear';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Avatar } from '../../shared/components/atoms/avatar/avatar';
import { Select } from '../../shared/components/atoms/select/select';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { Badge } from '../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../shared/components/atoms/badge/badge.types';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { errorMessageOf } from '../../shared/forms/form-support';

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

/**
 * «Mis organizaciones»: en qué organizaciones el profesional tiene una
 * vinculación, y pedir una nueva.
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
  selector: 'app-my-organizations',
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
    PageHeader,
    Select,
  ],
  templateUrl: './my-organizations.html',
  styleUrl: './my-organizations.css',
})
export class MyOrganizations {
  /**
   * `true` cuando esta pantalla vive **dentro** del panel «Organización
   * médica», como su pestaña «Mis vinculaciones».
   *
   * Cambia dos cosas: no dibuja su membrete —lo pone el panel— ni el bloque
   * largo que explica qué es una vinculación, que en una pestaña de un panel de
   * administración es un párrafo que nadie vuelve a leer. La ruta propia
   * redirige acá desde el 2026-09-10, así que en la práctica siempre está
   * embebida; el modo suelto se conserva porque el componente sigue siendo
   * montable solo y su spec lo ejercita así.
   */
  readonly embedded = input(false, { transform: booleanAttribute });

  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly accounting = inject(AccountingClient);

  /**
   * Escrito a mano (no `toSignal` puro): tras enviar una solicitud hay que
   * releer la lista, y una única suscripción de `toSignal` no ofrece forma de
   * volver a dispararla sin este signal.
   */
  private readonly vinculaciones = signal<readonly MyRoleAssignment[] | undefined>(undefined);

  protected readonly cargandoVinculaciones = computed(() => this.vinculaciones() === undefined);

  protected readonly filas = computed<readonly AssignmentRow[]>(() =>
    (this.vinculaciones() ?? []).map((v) => ({
      ...v,
      statusLabel: roleAssignmentStatusLabel(v.status),
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
  private readonly celdaPrincipal =
    viewChild.required<TemplateRef<{ $implicit: AssignmentRow }>>('celdaPrincipal');

  protected readonly columnas = computed<readonly ColumnDef<AssignmentRow>[]>(() => [
    { key: 'practiceName', header: 'Organización', priority: 1, cell: this.celdaOrganizacion() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'isPrimary', header: 'Principal', priority: 3, cell: this.celdaPrincipal() },
  ]);

  protected readonly porId = (fila: AssignmentRow): string => fila.id;

  /** El estado de la tabla, en los términos del M34. */
  protected readonly estadoDeLaTabla = computed<ViewState<readonly AssignmentRow[]>>(() =>
    this.vinculaciones() === undefined ? loading() : ready(this.filas()),
  );

  private readonly practicas = toSignal(
    this.accounting.listPractices().pipe(catchError(() => of<readonly Practice[]>([]))),
    { initialValue: undefined },
  );

  protected readonly opcionesDeOrganizacion = computed<readonly SelectOption<string>[]>(() =>
    (this.practicas() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  protected readonly organizacionElegida = signal<string | null>(null);

  protected readonly estadoDeSolicitud = signal<ViewState<null>>(ready(null));
  protected readonly enviando = computed(() => this.estadoDeSolicitud().status === 'loading');
  protected readonly errorDeSolicitud = computed(() =>
    errorMessageOf(this.estadoDeSolicitud(), 'No tenés permiso para solicitar esta vinculación.'),
  );
  protected readonly solicitudEnviada = signal(false);

  constructor() {
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

  private recargarVinculaciones(): void {
    this.practiceSites
      .listMyRoleAssignments()
      .pipe(catchError(() => of<readonly MyRoleAssignment[]>([])))
      .subscribe((items) => this.vinculaciones.set(items));
  }
}
