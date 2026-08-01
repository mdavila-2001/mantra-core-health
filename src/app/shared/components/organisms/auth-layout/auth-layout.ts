import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import type { ThemeMode } from '../../../../core/tokens/design-tokens.types';
import { ThemeService } from '../../../../core/tokens/theme.service';
import { AppButton } from '../../atoms/button/button';
import { Card } from '../../molecules/card/card';

/**
 * Estructura de las pantallas públicas (login, registro, verificación,
 * activación): marca + tarjeta centrada + pie con enlaces legales.
 *
 * ```html
 * <app-auth-layout title="Ingresá a tu cuenta" subtitle="Red SALUD">
 *   <form>…</form>
 *   <nav auth-footer><a app-link href="/legal/privacidad">Privacidad</a></nav>
 * </app-auth-layout>
 * ```
 *
 * **No sabe qué es un token**: es puro layout. El único servicio que toca es
 * el de tema, porque una persona ajusta claro/oscuro antes de entrar y ese
 * control tiene que existir también fuera de la aplicación autenticada.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [AppButton, Card],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'auth-layout',
  },
})
export class AuthLayout {
  private readonly themeService = inject(ThemeService);

  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly showBrand = input<boolean>(true);

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
