import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';

/**
 * Paginación de la ventana de la agenda (ALV-024).
 *
 * Al pie de la lista, como cualquier paginación. Un tramo es el tamaño de la
 * ventana elegida: con «Próximos 7 días», el siguiente salta 7 días. El rango a
 * la izquierda dice qué página se está mirando. Presentacional: no sabe de
 * fechas; quien la usa mueve la ventana al recibir `mover` u `hoy`.
 */
@Component({
  selector: 'app-agenda-window-nav',
  imports: [AppButton, Tooltip],
  templateUrl: './window-nav.html',
  styleUrl: './window-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaWindowNav {
  /** El rango visible, ya redactado («Hoy, 11 oct — 17 oct»). */
  readonly rango = input.required<string>();
  /** Si la ventana ya arranca hoy: entonces «Volver a hoy» sobra. */
  readonly enHoy = input.required<boolean>();

  /** Un tramo atrás (-1) o adelante (1). */
  readonly mover = output<-1 | 1>();
  readonly hoy = output<void>();
}
