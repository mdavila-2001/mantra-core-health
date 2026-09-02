import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  isDevMode,
} from '@angular/core';

import {
  PROGRESS_MAX,
  PROGRESS_MIN,
  type ProgressSize,
  type ProgressTone,
} from './progress.types';

/**
 * Barra de progreso. Con `value` es **determinada** (una subida que informa su
 * avance); sin `value`, **indeterminada** (se sabe que algo pasa, no cuánto
 * falta) — y ahí no se declara `aria-valuenow`, porque no hay valor que decir.
 *
 * ```html
 * <app-progress [value]="subida()" label="Subida del informe" />
 * <app-progress label="Procesando el lote" tone="primary" />
 * ```
 *
 * `label` es obligatorio: una barra sin nombre es un rectángulo que se mueve.
 *
 * ## La punta (`showMarker`)
 *
 * Con `showMarker` la barra termina en un círculo en la posición del avance,
 * que viaja con él. Sirve donde el avance es **el estado de quien mira** —el
 * paso de un formulario— y no donde es el estado de una tarea de fondo: en una
 * subida de ocho archivos, ocho círculos latiendo son ocho cosas pidiendo
 * atención a la vez.
 *
 * Por eso entra apagado. Es puramente decorativo: no toca el `role`, ni los
 * `aria-value*`, ni el ancho del relleno, así que encenderlo no cambia nada de
 * lo que se anuncia. Bajo `prefers-reduced-motion: reduce` el círculo queda
 * quieto —sin pulso ni halo animado—: a diferencia del modo indeterminado, acá
 * la animación no informa nada que el ancho no diga ya.
 */
@Component({
  selector: 'app-progress',
  templateUrl: './progress.html',
  styleUrl: './progress.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'progressClasses()',
    role: 'progressbar',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-valuemin]': 'min',
    '[attr.aria-valuemax]': 'max',
    '[attr.aria-valuenow]': 'clampedValue()',
  },
})
export class Progress {
  /** Fuera del rango no se confía en el consumidor: se recorta. `null` = indeterminada. */
  readonly value = input<number | null>(null);

  readonly tone = input<ProgressTone>('primary');
  readonly size = input<ProgressSize>('md');

  /** Nombre accesible. Obligatorio en los hechos: sin él se avisa en desarrollo. */
  readonly label = input<string>('');

  /**
   * Dibuja el círculo de la punta, en la posición del avance.
   *
   * Apagado por defecto **a propósito**: este átomo lo usan tanto el motor de
   * formularios como las subidas de archivo, y un default encendido le habría
   * puesto un círculo latiendo a cada fila de una subida múltiple sin que nadie
   * lo pidiera. Lo enciende quien sabe que su barra es un recorrido.
   */
  readonly showMarker = input(false, { transform: booleanAttribute });

  protected readonly min = PROGRESS_MIN;
  protected readonly max = PROGRESS_MAX;

  readonly isIndeterminate = computed(() => this.value() === null);

  /** `null` en indeterminada: `aria-valuenow` desaparece, no vale 0. */
  readonly clampedValue = computed<number | null>(() => {
    const raw = this.value();
    if (raw === null || Number.isNaN(raw)) {
      return null;
    }
    return Math.min(PROGRESS_MAX, Math.max(PROGRESS_MIN, raw));
  });

  protected readonly fillWidth = computed(() => `${this.clampedValue() ?? 0}%`);

  /**
   * La punta sólo existe cuando hay una posición que señalar.
   *
   * En indeterminada el ancho no significa nada —lo dice la animación de la
   * banda—, así que un círculo ahí apuntaría a un lugar inventado.
   */
  protected readonly markerVisible = computed(
    () => this.showMarker() && !this.isIndeterminate(),
  );

  readonly progressClasses = computed(() => {
    const classes = ['progress', `progress--${this.tone()}`, `progress--${this.size()}`];
    if (this.isIndeterminate()) {
      classes.push('progress--indeterminate');
    }
    if (this.markerVisible()) {
      // El riel recorta su contenido; con punta tiene que dejarla asomar.
      classes.push('progress--with-marker');
    }
    return classes.join(' ');
  });

  constructor() {
    if (isDevMode()) {
      afterNextRender(() => this.warnIfMissingLabel());
    }
  }

  private warnIfMissingLabel(): void {
    if (!this.label().trim()) {
      console.warn(
        '[app-progress] sin `label`: la barra no tiene nombre accesible. Decí qué avanza.',
      );
    }
  }
}
