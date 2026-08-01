import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { STATUS_TYPES, type StatusType } from '@core/tokens/design-tokens.types';
import { AppButtonComponent, ToastService } from '@shared';

/** Cuántos avisos lanza la ráfaga: uno más que el techo, para verlo actuar. */
const BURST_SIZE = 5;

/**
 * Disparador de avisos para probar desde cualquier pantalla. **No es producto**:
 * `app.html` lo envuelve en un `@defer` que en producción nunca se descarga.
 */
@Component({
  selector: 'app-toast-dev-panel',
  imports: [AppButtonComponent],
  templateUrl: './toast-dev-panel.html',
  styleUrl: './toast-dev-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastDevPanel {
  private readonly toastService = inject(ToastService);

  protected readonly types = STATUS_TYPES;

  protected lanzar(type: StatusType): void {
    this.toastService.show(type, MENSAJES[type], { title: TITULOS[type] });
  }

  /** Fijo: sin duración, solo se va con el botón de cierre. */
  protected lanzarFijo(): void {
    this.toastService.error('Este aviso no se cierra solo.', {
      title: 'Requiere confirmación',
      duration: null,
    });
  }

  /** Ráfaga: supera `TOAST_MAX_VISIBLE` a propósito, para ver el descarte. */
  protected lanzarRafaga(): void {
    for (let n = 1; n <= BURST_SIZE; n += 1) {
      this.toastService.info(`Aviso ${n} de ${BURST_SIZE} de la ráfaga.`);
    }
  }

  protected limpiar(): void {
    this.toastService.clear();
  }
}

const TITULOS: Readonly<Record<StatusType, string>> = {
  success: 'Guardado',
  warning: 'Revisá los datos',
  error: 'No se pudo guardar',
  info: 'Cambios pendientes',
};

const MENSAJES: Readonly<Record<StatusType, string>> = {
  success: 'La ficha del paciente se guardó correctamente.',
  warning: 'Faltan datos de contacto en la ficha.',
  error: 'Se perdió la conexión con el servidor. Intentá de nuevo.',
  info: 'Hay cambios sin guardar en este formulario.',
};
