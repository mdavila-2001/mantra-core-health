import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Link } from '../../shared/components/atoms/link/link';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';

/**
 * «No disponible para su perfil»: adonde llega quien abre una pantalla que una regla de visibilidad le oculta.
 *
 * Es el estado **S3** del M34 (vacío **con próxima acción**): la persona esperaba una pantalla y no hay nada que
 * mostrarle, así que se le dice y se le ofrece la salida. No dice qué regla lo causa ni quién la puso, y no confirma
 * nada del contenido de la pantalla.
 *
 * **Visibilidad, no seguridad:** esto es presentación. La API autoriza cada petición por su cuenta.
 */
@Component({
  selector: 'app-visibility-unavailable',
  imports: [EmptyState, Link, RouterLink],
  templateUrl: './visibility-unavailable.html',
  styleUrl: './visibility-unavailable.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisibilityUnavailable {}
