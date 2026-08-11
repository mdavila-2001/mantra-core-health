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

const BASE = '/administration/identity-assurance';

/**
 * Portada de la sección «Verificación de identidad» (M27, lado administrativo).
 *
 * La portada ordena las operaciones del contrato por área, y arranca por la
 * única lectura que el backend expone hoy: la **cola de revisión**. El resto
 * siguen siendo comandos, así que no hay listados de autoridades ni de
 * políticas — cuando lleguen sus `GET`, van acá.
 */
@Component({
  selector: 'app-identity-admin-home',
  imports: [Alert, Card, Link, PageHeader, RouterLink],
  templateUrl: './identity-admin-home.html',
  styleUrl: '../../portada.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityAdminHome {
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly areas: readonly Area[] = [
    {
      titulo: 'Trabajo pendiente',
      descripcion:
        'Los casos que esperan una decisión, del que más lleva esperando al más reciente.',
      operaciones: [{ label: 'Cola de revisión', route: `${BASE}/queue` }],
    },
    {
      titulo: 'Autoridades',
      descripcion:
        'Contra quién se verifica: los registros oficiales y los endpoints por los que responden.',
      operaciones: [
        { label: 'Registrar autoridad', route: `${BASE}/authorities/new` },
        { label: 'Publicar endpoint de autoridad', route: `${BASE}/authorities/endpoint` },
      ],
    },
    {
      titulo: 'Políticas',
      descripcion:
        'Qué exige cada trámite según su riesgo: niveles de aseguramiento, evidencia y controles.',
      operaciones: [{ label: 'Crear política de verificación', route: `${BASE}/policies/new` }],
    },
    {
      titulo: 'Casos',
      descripcion:
        'El expediente de una verificación: se abre contra una política, junta evidencia y vence.',
      operaciones: [
        { label: 'Abrir caso de verificación', route: `${BASE}/cases/new` },
        { label: 'Aportar evidencia', route: `${BASE}/cases/evidence` },
        { label: 'Planificar checks', route: `${BASE}/cases/checks` },
        { label: 'Barrer casos vencidos', route: `${BASE}/cases/expire-sweep` },
      ],
    },
    {
      titulo: 'Checks',
      descripcion:
        'La consulta a la autoridad: sus intentos técnicos, el resultado inmutable y el fraude.',
      operaciones: [
        { label: 'Registrar intento contra la autoridad', route: `${BASE}/checks/attempt` },
        { label: 'Registrar resultado del check', route: `${BASE}/checks/result` },
        { label: 'Registrar señal de fraude', route: `${BASE}/checks/fraud-signal` },
      ],
    },
    {
      titulo: 'Revisión y aserciones',
      descripcion:
        'El desenlace: revisión humana cuando hace falta, y la aserción que acredita el nivel.',
      operaciones: [
        { label: 'Escalar a revisión manual', route: `${BASE}/review/escalate` },
        { label: 'Decidir revisión manual', route: `${BASE}/review/decision` },
        { label: 'Emitir aserción', route: `${BASE}/assertions/issue` },
        { label: 'Revocar aserción', route: `${BASE}/assertions/revoke` },
      ],
    },
  ];
}
