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

const BASE = '/administration/identity-providers';

/**
 * Portada de la sección «Proveedores de identidad» (M40).
 *
 * El módulo del backend es solo de comando —ningún `GET`—, así que esta
 * portada no lista nada: ordena las doce operaciones del contrato por área.
 * Cuando lleguen los endpoints de consulta, acá va el listado de proveedores
 * con sus pestañas de configuración.
 */
@Component({
  selector: 'app-auth-providers-home',
  imports: [Alert, Card, Link, PageHeader, RouterLink],
  templateUrl: './auth-providers-home.html',
  styleUrl: '../../portada.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthProvidersHome {
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly areas: readonly Area[] = [
    {
      titulo: 'Proveedores',
      descripcion:
        'El proveedor nace en borrador; configurar su protocolo por entorno es lo que lo activa.',
      operaciones: [
        { label: 'Registrar proveedor', route: `${BASE}/providers/new` },
        { label: 'Configurar protocolo', route: `${BASE}/providers/protocol` },
        { label: 'Fijar mapeo de atributos', route: `${BASE}/providers/attribute-mappings` },
        {
          label: 'Definir regla de aprovisionamiento',
          route: `${BASE}/providers/provisioning-rule`,
        },
      ],
    },
    {
      titulo: 'Claves de firma',
      descripcion:
        'Con qué firma el proveedor. La rotación retira las salientes con gracia, no de golpe.',
      operaciones: [
        { label: 'Publicar clave de firma', route: `${BASE}/keys/new` },
        { label: 'Rotar clave de firma', route: `${BASE}/keys/rotate` },
      ],
    },
    {
      titulo: 'Organizaciones',
      descripcion: 'Qué organización puede usar cada proveedor y con qué aprovisionamiento.',
      operaciones: [
        { label: 'Vincular proveedor a una organización', route: `${BASE}/organizations/link` },
      ],
    },
    {
      titulo: 'Login federado',
      descripcion: 'El intento se inicia con state y nonce; todo desenlace queda registrado.',
      operaciones: [
        { label: 'Iniciar login federado', route: `${BASE}/login/start` },
        { label: 'Procesar callback', route: `${BASE}/login/callback` },
      ],
    },
    {
      titulo: 'Vinculación de cuentas',
      descripcion:
        'Sujetos externos que se vinculan a una cuenta local con un token de un solo uso.',
      operaciones: [
        { label: 'Solicitar vinculación de cuenta', route: `${BASE}/accounts/link` },
        { label: 'Completar vinculación', route: `${BASE}/accounts/complete` },
        { label: 'Desvincular identidad federada', route: `${BASE}/accounts/unlink` },
      ],
    },
  ];
}
