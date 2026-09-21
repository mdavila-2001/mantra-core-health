import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty } from '../../../core/view-state/view-state';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * **Promociones** del paciente (R-T-E7): por ahora, un vacío honesto.
 *
 * ## Por qué no hay datos
 *
 * La API no publica ninguna lectura de promociones recibidas (`B-REAL-13`):
 * `promotions` y `marketing` sólo tienen escrituras, y lo que el modelo define
 * como «recibida» —un destinatario de `marketing.campaign_dispatch_recipients`—
 * no lo escribe ningún servicio. Sin fuente real, la pantalla no fabrica
 * promociones: dice que acá van a aparecer y ofrece buscar farmacias.
 *
 * La maqueta con tarjetas de ejemplo vive en la rama `mockup` (D-FARMOCK-3);
 * en `dev` no hay datos de ejemplo, ni siquiera detrás de `campaignsDemo`.
 */
@Component({
  selector: 'app-promotions',
  imports: [PageHeader, ViewStateHost],
  templateUrl: './promotions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Promotions {
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  /**
   * Siempre vacío mientras no exista la lectura. El texto no afirma que la
   * persona no recibió nada —eso no se sabe—: dice dónde van a aparecer.
   */
  protected readonly state = empty(
    { label: 'Buscar farmacias', route: '/search/medications' },
    'Cuando las farmacias te manden promociones, van a aparecer acá.',
  );
}
