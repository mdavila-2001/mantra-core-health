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

const BASE = '/administracion/verificacion-identidad';

/**
 * Portada de la sección «Verificación de identidad» (M27, lado administrativo).
 *
 * El backend no expone ningún `GET` administrativo —solo los catorce comandos—,
 * así que esta portada no lista nada: ordena las operaciones del contrato por
 * área. Cuando lleguen los endpoints de consulta, acá van los listados de
 * autoridades, políticas y casos.
 */
@Component({
  selector: 'app-identity-admin-home',
  imports: [Alert, Card, Link, PageHeader, RouterLink],
  templateUrl: './identity-admin-home.html',
  styleUrl: './identity-admin-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityAdminHome {
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly areas: readonly Area[] = [
    {
      titulo: 'Autoridades',
      descripcion:
        'Contra quién se verifica: los registros oficiales y los endpoints por los que responden.',
      operaciones: [
        { label: 'Registrar autoridad', route: `${BASE}/autoridades/nueva` },
        { label: 'Publicar endpoint de autoridad', route: `${BASE}/autoridades/endpoint` },
      ],
    },
    {
      titulo: 'Políticas',
      descripcion:
        'Qué exige cada trámite según su riesgo: niveles de aseguramiento, evidencia y controles.',
      operaciones: [{ label: 'Crear política de verificación', route: `${BASE}/politicas/nueva` }],
    },
    {
      titulo: 'Casos',
      descripcion:
        'El expediente de una verificación: se abre contra una política, junta evidencia y vence.',
      operaciones: [
        { label: 'Abrir caso de verificación', route: `${BASE}/casos/nuevo` },
        { label: 'Aportar evidencia', route: `${BASE}/casos/evidencia` },
        { label: 'Planificar checks', route: `${BASE}/casos/checks` },
        { label: 'Barrer casos vencidos', route: `${BASE}/casos/barrido` },
      ],
    },
    {
      titulo: 'Checks',
      descripcion:
        'La consulta a la autoridad: sus intentos técnicos, el resultado inmutable y el fraude.',
      operaciones: [
        { label: 'Registrar intento contra la autoridad', route: `${BASE}/checks/intento` },
        { label: 'Registrar resultado del check', route: `${BASE}/checks/resultado` },
        { label: 'Registrar señal de fraude', route: `${BASE}/checks/fraude` },
      ],
    },
    {
      titulo: 'Revisión y aserciones',
      descripcion:
        'El desenlace: revisión humana cuando hace falta, y la aserción que acredita el nivel.',
      operaciones: [
        { label: 'Escalar a revisión manual' },
        { label: 'Decidir revisión manual' },
        { label: 'Emitir aserción' },
        { label: 'Revocar aserción' },
      ],
    },
  ];
}
