import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavigationService } from '../../../core/navigation/navigation.service';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Una operación del módulo, con su pantalla si ya existe. */
interface Operacion {
  readonly label: string;
  readonly route?: string;
}

interface Area {
  readonly titulo: string;
  readonly descripcion: string;
  readonly operaciones: readonly Operacion[];
}

const BASE = '/administration/delegated-access';

/**
 * Portada de la sección «Acceso delegado» (M29).
 *
 * El módulo del backend es solo de comando —ningún `GET`—, así que esta
 * portada no lista nada: ordena las once operaciones del contrato por área.
 * Cuando lleguen los endpoints de consulta, acá va el listado de delegaciones
 * con sus acciones por fila.
 */
@Component({
  selector: 'app-delegated-access-home',
  imports: [Alert, Card, Link, PageHeader, RouterLink],
  templateUrl: './delegated-access-home.html',
  styleUrl: '../../portada.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DelegatedAccessHome {
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly areas: readonly Area[] = [
    {
      titulo: 'Delegaciones de profesional',
      descripcion:
        'Un profesional delega parte de su acceso en alguien de su equipo, con alcance y vigencia.',
      operaciones: [
        { label: 'Nueva delegación', route: `${BASE}/delegations/new` },
        { label: 'Solicitar acceso delegado', route: `${BASE}/delegations/requests/new` },
        { label: 'Otorgar concesión', route: `${BASE}/delegations/grants/new` },
        { label: 'Revocar delegación', route: `${BASE}/delegations/revoke` },
      ],
    },
    {
      titulo: 'Asignaciones de organización',
      descripcion: 'Usuarios de la organización con alcance acotado y supervisor responsable.',
      operaciones: [
        { label: 'Asignar usuario', route: `${BASE}/assignments/new` },
        { label: 'Reasignar o suspender', route: `${BASE}/assignments/edit` },
      ],
    },
    {
      titulo: 'Solicitudes de acceso',
      descripcion: 'Resolución de solicitudes pendientes: aprobar o denegar, y emitir el grant.',
      operaciones: [{ label: 'Resolver solicitud', route: `${BASE}/requests/resolve` }],
    },
    {
      titulo: 'Conjuntos de permisos',
      descripcion: 'Sets versionados de permisos delegables; cada versión reemplaza entera a la anterior.',
      operaciones: [
        { label: 'Publicar set', route: `${BASE}/permission-sets/new` },
        { label: 'Versionar set', route: `${BASE}/permission-sets/new-version` },
      ],
    },
    {
      titulo: 'Operación',
      descripcion: 'Herramientas del administrador: evaluar el actor efectivo y expirar lo vencido.',
      operaciones: [
        { label: 'Evaluar actor efectivo', route: `${BASE}/operations/evaluate-actor` },
        { label: 'Barrido de expiración', route: `${BASE}/operations/expiry-sweep` },
      ],
    },
  ];
}
