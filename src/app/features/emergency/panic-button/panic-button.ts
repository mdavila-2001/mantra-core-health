import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  InjectionToken,
  computed,
  inject,
  viewChild,
} from '@angular/core';

import { enlaceDeLlamada } from '@core/emergency/emergency-numbers';
import { TrustedAmbulanceStore } from '@core/emergency/trusted-ambulance.store';
import { AppButton } from '@shared/components/atoms/button/button';
import { EmergencyPanel } from '../emergency-panel/emergency-panel';

/**
 * Cómo se hace la llamada. Un token para que las pruebas no naveguen a `tel:` (jsdom no puede).
 */
export const PHONE_DIALER = new InjectionToken<(enlace: string) => void>('PHONE_DIALER', {
  providedIn: 'root',
  factory: () => {
    const documento = inject(DOCUMENT);
    return (enlace: string) => documento.defaultView?.location.assign(enlace);
  },
});

/**
 * El botón de emergencia, siempre a un toque (pedido del propietario, 2026-10-08): «reportar un
 * accidente y que lleve a todos los números de ambulancias».
 *
 * - Con **ambulancia de confianza** configurada, el toque llama directo, sin lista intermedia.
 * - Sin ella, abre los números oficiales (cada uno, otro toque) y deja configurarla.
 *
 * El diálogo es el `<dialog>` nativo, como `app-dialog`: esa molécula es de confirmación y no
 * proyecta contenido. El nativo da el fondo, la trampa de foco y `Escape`.
 */
@Component({
  selector: 'app-panic-button',
  imports: [AppButton, EmergencyPanel],
  templateUrl: './panic-button.html',
  styleUrl: './panic-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanicButton {
  private readonly confianza = inject(TrustedAmbulanceStore);
  private readonly marcar = inject(PHONE_DIALER);
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  protected readonly ambulancia = this.confianza.ambulancia;

  protected readonly etiqueta = computed(() => {
    const propia = this.ambulancia();
    return propia ? `Emergencia: llamar a ${propia.nombre}` : 'Emergencia: ver los números de ambulancia';
  });

  protected activar(): void {
    const propia = this.ambulancia();
    if (propia) {
      this.marcar(enlaceDeLlamada(propia.telefono));
      return;
    }
    this.abrir();
  }

  protected abrir(): void {
    const dialogo = this.dialogo()?.nativeElement;
    if (!dialogo) {
      return;
    }
    // jsdom no implementa `showModal`: el atributo deja el diálogo abierto igual (mismo respaldo que app-dialog).
    if (typeof dialogo.showModal === 'function') {
      dialogo.showModal();
    } else {
      dialogo.setAttribute('open', '');
    }
  }

  protected cerrar(): void {
    const dialogo = this.dialogo()?.nativeElement;
    if (!dialogo) {
      return;
    }
    if (typeof dialogo.close === 'function') {
      dialogo.close();
    } else {
      dialogo.removeAttribute('open');
    }
  }
}
