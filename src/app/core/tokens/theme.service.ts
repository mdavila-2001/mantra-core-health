/* ============================================================================
    Gestión del tema ALOVIDA.
    Contrato con src/styles.css y src/index.html:
      'light'  → data-theme="light",  data-tema="claro"
      'dark'   → data-theme="dark",   data-tema="oscuro"
    ========================================================================== */

import {
  computed,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { isThemeMode, type ResolvedTheme, type ThemeMode } from './design-tokens.types';

/** Espejo literal de la clave que lee el script anti-parpadeo de index.html. */
export const THEME_STORAGE_KEY = 'mantra-core-health.theme';

const THEME_ATTRIBUTE = 'data-theme';

/**
 * Segundo atributo, para la hoja normativa de la bóveda (src/styles/alovida.css).
 * ALOVIDA resuelve el tema oscuro SOLO contra un atributo explícito: no tiene
 * respaldo en `@media (prefers-color-scheme)`. Espejo en index.html.
 */
const ALOVIDA_THEME_ATTRIBUTE = 'data-tema';
const ALOVIDA_THEME_VALUE: Record<ResolvedTheme, string> = { light: 'claro', dark: 'oscuro' };

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly preference = signal<ThemeMode>('light');

  /** Lo que el usuario eligió: 'light' | 'dark'. */
  readonly currentTheme = this.preference.asReadonly();

  /** Lo que efectivamente se está pintando: 'light' | 'dark'. */
  readonly resolvedTheme = computed<ResolvedTheme>(() => this.preference());

  readonly isDark = computed(() => this.resolvedTheme() === 'dark');

  constructor() {
    if (this.isBrowser) {
      this.preference.set(this.readStoredPreference());
    }

    effect(() => this.applyPreference(this.preference()));
    effect(() => this.applyAlovidaTheme(this.resolvedTheme()));
  }

  setTheme(mode: ThemeMode): void {
    this.preference.set(mode);
  }

  /** Alterna claro ↔ oscuro. */
  toggleTheme(): void {
    this.preference.set(this.resolvedTheme() === 'dark' ? 'light' : 'dark');
  }

  private applyPreference(mode: ThemeMode): void {
    if (!this.isBrowser) {
      return;
    }
    const root = this.document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, mode);
    this.persistPreference(mode);
  }

  private applyAlovidaTheme(resolved: ResolvedTheme): void {
    if (!this.isBrowser) {
      return;
    }
    this.document.documentElement.setAttribute(
      ALOVIDA_THEME_ATTRIBUTE,
      ALOVIDA_THEME_VALUE[resolved],
    );
  }

  private readStoredPreference(): ThemeMode {
    const stored = this.storage()?.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'light';
  }

  private persistPreference(mode: ThemeMode): void {
    const storage = this.storage();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Escritura rechazada (cuota agotada o modo privado): degradar, no romper.
    }
  }

  /**
   * `localStorage` lanza —no devuelve null— cuando el navegador bloquea el
   * almacenamiento (Safari privado, cookies de terceros deshabilitadas). Sin
   * persistencia el tema sigue funcionando por sesión, así que se degrada.
   */
  private storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }
}
