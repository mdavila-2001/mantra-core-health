import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import { ALERT_TONE_NOUNS, type AlertTone } from './alert.types';

/**
 * Aviso **en página**, no efímero: el error de una API que el usuario tiene
 * que poder leer con calma y volver a leer. Para lo pasajero está el toast.
 *
 * ```html
 * <app-alert tone="error" title="No se pudo guardar la evolución">
 *   El servidor rechazó la operación (SQLSTATE 40001). Reintentá en unos segundos.
 *   <div alert-actions><button app-button size="sm">Reintentar</button></div>
 * </app-alert>
 * ```
 *
 * **No se auto-oculta.** `dismissible` emite `dismissed` y el consumidor
 * decide: si el aviso se borrara solo, el estado viviría en dos lugares.
 */
@Component({
  selector: 'app-alert',
  templateUrl: './alert.html',
  styleUrl: './alert.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'alertClasses()',
    '[attr.role]': 'liveRole()',
    '[attr.aria-live]': 'livePoliteness()',
  },
})
export class Alert {
  readonly tone = input<AlertTone>('info');
  readonly title = input<string>('');
  readonly dismissible = input(false, { transform: booleanAttribute });
  readonly icon = input(true, { transform: booleanAttribute });

  readonly dismissed = output<void>();

  /** El sustantivo que dice el tono en palabras («Error:»), no en color. */
  protected readonly toneNoun = computed(() => ALERT_TONE_NOUNS[this.tone()]);

  /**
   * Un error interrumpe; el resto espera su turno. `assertive` en un aviso de
   * éxito le pisa la frase a lo que el usuario esté escuchando.
   */
  protected readonly liveRole = computed(() => (this.tone() === 'error' ? 'alert' : 'status'));
  protected readonly livePoliteness = computed(() =>
    this.tone() === 'error' ? 'assertive' : 'polite',
  );

  readonly alertClasses = computed(() => {
    const classes = ['alert', `alert--${this.tone()}`, `tone--${this.tone()}`];
    if (this.dismissible()) {
      classes.push('alert--dismissible');
    }
    return classes.join(' ');
  });

  protected dismiss(): void {
    this.dismissed.emit();
  }
}
