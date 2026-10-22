import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import type {
  NotificationAction,
  NotificationActionTone,
  NotificationDestination,
} from '../../../../core/data-access/notifications/notifications.types';
import { NotificationActionRunner } from '../../../../core/notifications/notification-actions';
import { AppButton } from '../../atoms/button/button';
import type { ButtonVariant } from '../../atoms/button/button.types';
import { ToastService } from '../toast/toast.service';

/** Qué variante de botón pinta cada tono de acción. */
const VARIANTE: Readonly<Record<NotificationActionTone, ButtonVariant>> = {
  primary: 'primary',
  neutral: 'secondary',
  danger: 'danger',
};

/**
 * Los botones de una notificación: «Aceptar», «Rechazar»…
 *
 * Es la única pieza que sabe **ejecutar** una acción, y la usan la campana y el
 * centro de notificaciones: cada pantalla sólo le pasa lo que la notificación
 * ofrece y se entera cuando terminó. Ejecutar, mostrar el resultado y bloquear
 * el doble clic viven acá una sola vez.
 *
 * ```html
 * <app-notification-actions
 *   [actions]="aviso.acciones"
 *   [destination]="aviso.destino"
 *   (executed)="store.trasAccion(aviso)"
 * />
 * ```
 *
 * ## Qué dibuja
 *
 * Sólo las acciones para las que hay manejador registrado
 * ({@link NotificationActionRunner.puedeEjecutar}). Sin ninguna, no dibuja
 * nada, ni siquiera el contenedor.
 *
 * ## Por qué frena la propagación
 *
 * En la campana y en el centro, la fila de la notificación es un botón que
 * navega. Un clic en «Aceptar» que burbujeara terminaría también abriendo la
 * pantalla, y la persona que quería resolver desde acá se iría de donde estaba.
 */
@Component({
  selector: 'app-notification-actions',
  imports: [AppButton],
  templateUrl: './notification-actions.html',
  styleUrl: './notification-actions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationActions {
  private readonly runner = inject(NotificationActionRunner);
  private readonly toast = inject(ToastService);

  readonly actions = input<readonly NotificationAction[]>([]);
  readonly destination = input<NotificationDestination | undefined>(undefined);

  /** La `key` de la acción que terminó bien. La pantalla refresca su bandeja. */
  readonly executed = output<string>();

  /** La acción en curso, para bloquearlas todas: son alternativas de una misma decisión. */
  protected readonly enCurso = signal<string | null>(null);

  protected readonly visibles = computed(() =>
    this.actions().filter((accion) => this.runner.puedeEjecutar(this.destination(), accion.key)),
  );

  protected variante(accion: NotificationAction): ButtonVariant {
    return VARIANTE[accion.tone ?? 'neutral'];
  }

  protected ejecutar(accion: NotificationAction, evento: Event): void {
    evento.stopPropagation();
    if (this.enCurso() !== null) return;
    this.enCurso.set(accion.key);
    this.runner.ejecutar(this.destination(), accion.key).subscribe({
      next: (resultado) => {
        this.enCurso.set(null);
        this.toast.show({ type: resultado.tone ?? 'success', message: resultado.message });
        this.executed.emit(accion.key);
      },
      error: () => {
        this.enCurso.set(null);
        this.toast.show({
          type: 'error',
          message: `No se pudo completar «${accion.label}». Intente de nuevo.`,
        });
      },
    });
  }
}
