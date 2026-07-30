import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { AppButtonComponent } from '../../../shared/components/atoms/button/app-button';
import {
  TOAST_TYPES,
  type ToastType,
} from '../../../shared/components/molecules/toast/toast.types';

/**
 * Panel flotante para disparar avisos desde cualquier pantalla. **No es
 * producto**: `app.html` lo mete en un `@defer (when isDev)`, así el chunk no
 * se descarga nunca en producción.
 *
 * Tampoco administra la cola: emite lo que se pidió y quien lo monta —el
 * componente raíz— decide qué hacer. Sin servicio de por medio.
 */
@Component({
  selector: 'app-toast-dev-panel',
  imports: [AppButtonComponent],
  templateUrl: './toast-dev-panel.html',
  styleUrl: './toast-dev-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastDevPanel {
  protected readonly types = TOAST_TYPES;

  /** Un aviso del tipo pedido, con la duración de su muestra. */
  readonly launched = output<ToastType>();

  /** Un aviso sin `duration`: se queda hasta que lo cierren. */
  readonly persistentLaunched = output<void>();

  /** Varios de golpe: sirve para ver cómo se apila y desborda la columna. */
  readonly burstLaunched = output<void>();

  readonly cleared = output<void>();
}
