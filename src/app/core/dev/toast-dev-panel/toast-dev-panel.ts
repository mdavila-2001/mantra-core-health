import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import type { ToastType } from '../../../shared/components/molecules/toast/toast.types';

/** Cuántos avisos lanza la ráfaga: suficientes para ver cómo se apilan. */
const TAMANO_RAFAGA = 5;

/**
 * Disparador de avisos para probar desde cualquier pantalla.
 *
 * Vive en `core/dev/` y el `@defer (when isDev)` de `app.html` lo deja en un
 * fragmento que en producción nunca se descarga.
 */
@Component({
  selector: 'app-toast-dev-panel',
  imports: [AppButton],
  templateUrl: './toast-dev-panel.html',
  styleUrl: './toast-dev-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastDevPanel {
  private readonly toastService = inject(ToastService);

  readonly types: readonly ToastType[] = ['success', 'info', 'warning', 'error'];

  lanzar(type: ToastType): void {
    this.toastService.show({
      type,
      title: `Aviso de prueba (${type})`,
      message: 'Texto de ejemplo para revisar el aviso en pantalla.',
    });
  }

  /** Aviso que no se cierra solo: sirve para revisar el foco y el cierre manual. */
  lanzarFijo(): void {
    this.toastService.show({
      type: 'error',
      title: 'Aviso fijo',
      message: 'Este no se cierra solo: hay que cerrarlo a mano.',
      durationMs: null,
    });
  }

  lanzarRafaga(): void {
    for (let i = 1; i <= TAMANO_RAFAGA; i += 1) {
      this.toastService.show({
        type: this.types[i % this.types.length] ?? 'info',
        message: `Aviso ${i} de ${TAMANO_RAFAGA} de la ráfaga.`,
      });
    }
  }

  limpiar(): void {
    this.toastService.clear();
  }
}
