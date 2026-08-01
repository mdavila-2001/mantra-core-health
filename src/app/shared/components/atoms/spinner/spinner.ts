import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import type { SpinnerSize } from './spinner.types';

/**
 * Indicador de carga. La tinta sale de `currentColor`, así que hereda la del
 * contenedor igual que los íconos del botón.
 *
 * ```html
 * <app-spinner size="lg" label="Cargando historia clínica" />
 * ```
 *
 * Por defecto se anuncia (`role="status"` con nombre accesible). Dentro de un
 * control que ya declara su carga —el botón con `aria-busy`— eso sería un
 * anuncio duplicado: ahí va `decorative`, que lo saca del árbol accesible.
 */
@Component({
  selector: 'app-spinner',
  templateUrl: './spinner.html',
  styleUrl: './spinner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'spinnerClasses()',
    '[attr.role]': 'decorative() ? null : "status"',
    '[attr.aria-label]': 'decorative() ? null : label()',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
  },
})
export class Spinner {
  readonly size = input<SpinnerSize>('md');

  /** Nombre accesible. Sin él, un lector anuncia una región vacía: tiene default. */
  readonly label = input<string>('Cargando');

  /** El contenedor ya anuncia la carga: el spinner solo dibuja. */
  readonly decorative = input(false, { transform: booleanAttribute });

  readonly spinnerClasses = computed(() => `spinner spinner--${this.size()}`);
}
