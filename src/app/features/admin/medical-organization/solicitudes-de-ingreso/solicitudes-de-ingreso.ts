import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';

import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import { ROLE_ASSIGNMENT_STATUS } from '../../../../core/data-access/practice-sites/role-assignment-concepts';
import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import {
  roleAssignmentInitiatorText,
  roleAssignmentState,
  type RoleAssignmentState,
} from '../../../../core/data-access/role-assignments/role-assignment-status';
import { RoleAssignmentsClient } from '../../../../core/data-access/role-assignments/role-assignments.client';
import { describeApiFailure } from '../../../../core/http/api-failure';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';

/** Lo que el buzón muestra de cada estado: el texto es el de la persona, no el del backend. */
const ESTADOS: Readonly<Record<'INVITED' | 'PENDING' | 'ACTIVE' | 'REJECTED', { texto: string; tono: BadgeVariant }>> = {
  INVITED: { texto: 'Invitación para responder', tono: 'warning' },
  PENDING: { texto: 'Pendiente', tono: 'warning' },
  ACTIVE: { texto: 'Aceptada', tono: 'success' },
  REJECTED: { texto: 'Rechazada', tono: 'secondary' },
};

type EstadoDelBuzon = keyof typeof ESTADOS;

interface FilaDelBuzon extends MyRoleAssignment {
  readonly estado: EstadoDelBuzon;
  readonly estadoTexto: string;
  readonly estadoTono: BadgeVariant;
  readonly origen: string;
  readonly detalle: string;
}

/** El estado de la fila: por código si vino, y si no por el concepto de siempre. */
function estadoDe(v: MyRoleAssignment): RoleAssignmentState | null {
  const porCodigo = roleAssignmentState(v.statusCode ?? '');
  if (porCodigo !== null) return porCodigo;
  if (v.status === ROLE_ASSIGNMENT_STATUS.ACTIVE) return 'ACTIVE';
  if (v.status === ROLE_ASSIGNMENT_STATUS.PENDING) return 'PENDING';
  if (v.status === ROLE_ASSIGNMENT_STATUS.REJECTED) return 'REJECTED';
  return null;
}

/**
 * **Buzón de solicitudes de ingreso** del médico.
 *
 * Reúne en un solo lugar lo que pasó entre el médico y las organizaciones:
 * las invitaciones que una organización le mandó (las responde acá), las
 * solicitudes que él pidió y siguen pendientes, y las que ya fueron aceptadas
 * o rechazadas. Lo ya finalizado no entra: es historia, no una solicitud.
 *
 * Ninguna fila cambia de estado por su cuenta: tras aceptar o rechazar se
 * vuelve a leer la lista y se muestra lo que devolvió la API.
 */
@Component({
  selector: 'app-solicitudes-de-ingreso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Alert, AppButton, Badge, DataTable],
  templateUrl: './solicitudes-de-ingreso.html',
  styleUrl: './solicitudes-de-ingreso.css',
})
export class SolicitudesDeIngreso {
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly assignments = inject(RoleAssignmentsClient);

  /** Cuántas invitaciones esperan respuesta; la pestaña lo muestra como contador. */
  readonly pendientes = output<number>();

  protected readonly estado = signal<ViewState<readonly FilaDelBuzon[]>>(loading());
  protected readonly filaEnCurso = signal<string | null>(null);
  protected readonly errorDeAccion = signal('');

  private readonly celdaOrganizacion =
    viewChild.required<TemplateRef<{ $implicit: FilaDelBuzon }>>('celdaOrg');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: FilaDelBuzon }>>('celdaEstado');
  private readonly celdaAcciones =
    viewChild.required<TemplateRef<{ $implicit: FilaDelBuzon }>>('celdaAcciones');

  protected readonly columnas = computed<readonly ColumnDef<FilaDelBuzon>[]>(() => [
    { key: 'practiceName', header: 'Organización', priority: 1, cell: this.celdaOrganizacion() },
    { key: 'origen', header: 'Origen', priority: 2 },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'actions', header: 'Acciones', priority: 1, sticky: 'end', cell: this.celdaAcciones() },
  ]);

  protected readonly porId = (fila: FilaDelBuzon): string => fila.id;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.practiceSites.listMyRoleAssignments().subscribe({
      next: (lista) => {
        const filas = lista.flatMap((v) => this.aFila(v));
        this.pendientes.emit(filas.filter((f) => f.estado === 'INVITED').length);
        this.estado.set(
          filas.length > 0
            ? ready(filas)
            : empty(
                { label: 'Pida pertenecer desde «Mis organizaciones» o desde el directorio' },
                'No tiene solicitudes ni invitaciones de ingreso.',
              ),
        );
      },
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly FilaDelBuzon[]>(error)),
    });
  }

  protected aceptar(fila: FilaDelBuzon): void {
    this.responder(fila, this.assignments.accept(fila.id));
  }

  protected rechazar(fila: FilaDelBuzon): void {
    this.responder(fila, this.assignments.decline(fila.id));
  }

  private responder(fila: FilaDelBuzon, peticion: ReturnType<RoleAssignmentsClient['accept']>): void {
    if (this.filaEnCurso() !== null) return;
    this.filaEnCurso.set(fila.id);
    this.errorDeAccion.set('');
    peticion.subscribe({
      next: () => {
        this.filaEnCurso.set(null);
        this.cargar();
      },
      error: (error: unknown) => {
        this.filaEnCurso.set(null);
        this.errorDeAccion.set(describeApiFailure(error, 'No pudimos registrar su respuesta.'));
      },
    });
  }

  private aFila(v: MyRoleAssignment): readonly FilaDelBuzon[] {
    const estado = estadoDe(v);
    if (estado === null || !(estado in ESTADOS)) return [];
    // Una vinculación activa sin iniciador es una de siempre, no una solicitud.
    if (estado === 'ACTIVE' && v.initiatedBy === undefined) return [];
    const clave = estado as EstadoDelBuzon;
    const { texto, tono } = ESTADOS[clave];
    return [
      {
        ...v,
        estado: clave,
        estadoTexto: texto,
        estadoTono: tono,
        origen: v.initiatedBy === undefined ? '—' : roleAssignmentInitiatorText(v.initiatedBy),
        detalle: v.serviceDisplay ?? '',
      },
    ];
  }
}
