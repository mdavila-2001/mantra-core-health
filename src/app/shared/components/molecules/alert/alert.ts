import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
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
  /**
   * Aviso plegado en una línea: el título es un botón («Lead ▸») y el texto
   * proyectado se despliega al pulsarlo. Es EL aviso de honestidad del portal
   * (datos simulados, límites de una vista): una sola receta en vez de que
   * cada pantalla arme su `<details>` con otro tamaño de letra. Sin título no
   * se pliega (no habría qué mostrar plegado).
   */
  readonly collapsible = input(false, { transform: booleanAttribute });
  protected readonly abierto = signal(false);
  private static siguienteId = 0;
  protected readonly idMensaje = `alerta-${Alert.siguienteId++}`;
  protected readonly plegable = computed(() => this.collapsible() && this.title() !== '');

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
    if (this.plegable()) {
      classes.push('alert--plegable');
    }
    return classes.join(' ');
  });

  protected alternar(): void {
    this.abierto.update((v) => !v);
  }

  protected dismiss(): void {
    this.dismissed.emit();
  }
}
