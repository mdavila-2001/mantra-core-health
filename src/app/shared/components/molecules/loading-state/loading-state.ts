import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Skeleton } from '../../atoms/skeleton/skeleton';
import { Spinner } from '../../atoms/spinner/spinner';
import type { LoadingStateSize } from './loading-state.types';

/**
 * Espera con nombre: el aro, la frase que dice qué se está trayendo y, si hace
 * falta, la silueta de lo que va a aparecer.
 *
 * ```html
 * <app-loading-state
 *   message="Revisando si esta consulta ya tiene formulario…"
 *   detail="Así no se registra dos veces."
 *   [lines]="3"
 * />
 * ```
 *
 * Se anuncia una sola vez: el host es el `role="status"` y su texto es lo que
 * lee el lector. El aro va `decorative` y la silueta ya es `aria-hidden`, así
 * que no hay dos anuncios de la misma espera.
 */
@Component({
  selector: 'app-loading-state',
  imports: [Spinner, Skeleton],
  templateUrl: './loading-state.html',
  styleUrl: './loading-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    '[class]': 'hostClasses()',
  },
})
export class LoadingState {
  /** Qué se está trayendo, en palabras de quien espera. */
  readonly message = input.required<string>();

  /** Una línea más chica: por qué se espera o qué viene después. */
  readonly detail = input<string>('');

  /** Líneas de silueta debajo del mensaje. `0` = sin silueta. */
  readonly lines = input<number>(0);

  readonly size = input<LoadingStateSize>('inline');

  protected readonly hostClasses = computed(() => `loading-state loading-state--${this.size()}`);
}
