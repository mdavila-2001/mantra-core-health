import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Toast } from '../../molecules/toast/toast';
import { ToastService } from '../../molecules/toast/toast.service';

/**
 * Ancla de la pila de avisos. Va **una sola vez**, fuera del `router-outlet`,
 * para sobrevivir a los cambios de ruta.
 *
 * Es **la región viva**: el `aria-live` va acá, en un elemento que existe desde
 * el primer render. Puesto en cada aviso no serviría — un lector de pantalla
 * solo anuncia los cambios de una región que ya estaba en el documento.
 *
 * Por eso los `app-toast` de adentro NO llevan `role="alert"`: dos regiones
 * vivas anidadas hacen que el mismo aviso se anuncie dos veces.
 */
@Component({
  selector: 'app-toast-container',
  imports: [Toast],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    'aria-label': 'Avisos',
    // `polite` no interrumpe lo que el lector esté diciendo. Los errores de
    // esta app llegan tras una acción del usuario, que ya está esperando
    // respuesta: `assertive` cortaría la lectura sin ganar nada.
    'aria-live': 'polite',
    // Solo se anuncia lo que entra; que un aviso se vaya solo no es noticia.
    'aria-relevant': 'additions',
  },
})
export class ToastContainer {
  private readonly toastService = inject(ToastService);

  protected readonly toasts = this.toastService.toasts;

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
