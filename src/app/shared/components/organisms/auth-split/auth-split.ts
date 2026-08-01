import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import type { ThemeMode } from '../../../../core/tokens/design-tokens.types';
import { ThemeService } from '../../../../core/tokens/theme.service';
import { AppButton } from '../../atoms/button/button';

/**
 * Estructura partida de las pantallas de acceso: columna de marca a la
 * izquierda y panel de formulario a la derecha.
 *
 * Es la forma del diseño que entregó el diseñador para el alta de profesional,
 * adoptada como estructura común de login y registro para que las dos pantallas
 * se vean de la misma familia.
 *
 * ```html
 * <app-auth-split claim="Tu salud, conectada" tagline="La red más grande…">
 *   <h1>Iniciar sesión</h1>
 *   <form>…</form>
 * </app-auth-split>
 * ```
 *
 * **No sabe qué es un token**: es puro layout. El único servicio que toca es el
 * de tema, porque una persona ajusta claro/oscuro **antes** de entrar y ese
 * control tiene que existir también fuera de la aplicación autenticada — hasta
 * ahora solo vivía en la vitrina.
 */
@Component({
  selector: 'app-auth-split',
  imports: [AppButton],
  templateUrl: './auth-split.html',
  styleUrl: './auth-split.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthSplit {
  private readonly themeService = inject(ThemeService);

  /** Titular grande de la columna de marca. */
  readonly claim = input.required<string>();

  /** Bajada del titular. */
  readonly tagline = input<string>('');

  /**
   * El titular y la bajada, envueltos en una lista de un solo elemento para
   * poder recorrerlos con `@for … track`.
   *
   * No es adorno: en el registro el texto cambia al elegir paciente o
   * profesional, y una interpolación a secas lo reemplazaría de golpe, sin
   * transición. Con `track` sobre el propio texto, cambiarlo destruye el nodo y
   * crea otro, así que la animación de entrada vuelve a correr y el titular
   * nuevo aparece en vez de aparecer ya puesto.
   *
   * Van como `computed` y no como literal en la plantilla para no alojar un
   * arreglo nuevo en cada detección de cambios.
   */
  protected readonly claimKeyed = computed(() => [this.claim()]);
  protected readonly taglineKeyed = computed(() => {
    const texto = this.tagline();
    return texto === '' ? [] : [texto];
  });

  protected readonly theme = this.themeService.currentTheme;

  protected readonly themeOptions: readonly { mode: ThemeMode; label: string }[] = [
    { mode: 'light', label: 'Claro' },
    { mode: 'dark', label: 'Oscuro' },
    { mode: 'system', label: 'Sistema' },
  ];

  protected setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }
}
