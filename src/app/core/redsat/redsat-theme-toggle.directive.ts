/* ============================================================================
    El interruptor de tema que trae el markup de la maqueta.

    Las 126 vistas portadas desde la bóveda —y los dos marcos— llevan un botón
    `<button app-theme-toggle>` con su pista, su sol y su luna. En la maqueta lo
    movía redsat.js escribiendo `data-tema` a mano; acá el dueño del tema es
    ThemeService, y esta directiva es el único puente entre los dos.

    El rol y los estados accesibles los pone la directiva, no la plantilla: son
    consecuencia del tema y quien lo sabe es ella. Así tampoco pueden quedar
    desincronizados — un `aria-checked="false"` escrito a mano en cada archivo
    mentiría en cuanto alguien cambiara a oscuro.
    ========================================================================== */

import { Directive, inject } from '@angular/core';

import { ThemeService } from '@core/tokens/theme.service';

@Directive({
  /* El selector es el atributo literal del markup de la bóveda, que se porta
     tal cual. Renombrarlo a camelCase obligaría a reescribir las 126 vistas
     generadas y las desalinearía de su fuente. */
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[app-theme-toggle]',
  host: {
    type: 'button',
    role: 'switch',
    '[attr.aria-checked]': 'esOscuro()',
    '[attr.aria-label]': "esOscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'",
    '(click)': 'alternar()',
  },
})
export class RedsatThemeToggleDirective {
  private readonly theme = inject(ThemeService);

  /** Lo que se está pintando, que es lo que el interruptor tiene que reflejar. */
  protected readonly esOscuro = this.theme.isDark;

  protected alternar(): void {
    this.theme.toggleTheme();
  }
}
