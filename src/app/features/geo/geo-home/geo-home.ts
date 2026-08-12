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

/**
 * La sección cuelga de `administration/` y **no puede no hacerlo**: el prefijo
 * de la API es `/geo`, el proxy compara por inicio de ruta sin límite de
 * segmento, y una sección llamada `geolocation` a nivel raíz se iría entera al
 * backend. Lo verifica `scripts/check-route-prefixes.mjs`.
 */
const BASE = '/administration/geolocation';

/**
 * Portada de la sección «Geolocalización» (M13).
 *
 * Diez comandos y una sola lectura —`GET /geo/tracked-subjects/:id/
 * last-position`—, así que la portada agrupa operaciones en vez de listar.
 * Mismo patrón que M29, M40, M27-admin y M44.
 */
@Component({
  selector: 'app-geo-home',
  imports: [Alert, Card, Link, PageHeader, RouterLink],
  templateUrl: './geo-home.html',
  styleUrl: '../../portada.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeoHome {
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly areas: readonly Area[] = [
    {
      titulo: 'Sujetos rastreados',
      descripcion:
        'Quién se rastrea y con qué consentimiento. Revocarlo suspende al sujeto y cierra sus sesiones abiertas.',
      operaciones: [
        { label: 'Consultar la última posición', route: `${BASE}/subjects/last-position` },
        { label: 'Dar de alta un sujeto', route: `${BASE}/subjects/new` },
        { label: 'Ingerir pings de ubicación', route: `${BASE}/subjects/pings` },
        { label: 'Revocar el consentimiento', route: `${BASE}/subjects/revoke-consent` },
      ],
    },
    {
      titulo: 'Sesiones y viajes',
      descripcion:
        'Un sujeto tiene como mucho una sesión abierta, y una sesión como mucho un viaje en curso. Sin sesión abierta no se ingieren pings.',
      operaciones: [
        { label: 'Abrir una sesión de rastreo', route: `${BASE}/sessions/new` },
        { label: 'Cerrar una sesión', route: `${BASE}/sessions/close` },
        { label: 'Iniciar un viaje', route: `${BASE}/trips/new` },
        { label: 'Cerrar un viaje', route: `${BASE}/trips/close` },
      ],
    },
    {
      titulo: 'Geocercas',
      descripcion:
        'Áreas con nombre único por organización, circulares o poligonales, y los cruces que se registran contra ellas.',
      operaciones: [
        { label: 'Crear una geocerca', route: `${BASE}/geofences/new` },
        { label: 'Registrar un cruce de geocerca', route: `${BASE}/geofence-events/new` },
      ],
    },
  ];
}
