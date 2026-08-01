import {
  afterNextRender,
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

  readonly progressClasses = computed(() => {
    const classes = ['progress', `progress--${this.tone()}`, `progress--${this.size()}`];
    if (this.isIndeterminate()) {
      classes.push('progress--indeterminate');
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
