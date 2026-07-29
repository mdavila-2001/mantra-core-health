/* ============================================================================
    Gestión del tema REDSAT. Tres responsabilidades, ninguna más:
    leer la preferencia, resolverla contra el sistema, y estamparla en
    `document.documentElement`.

    Contrato con src/styles.css — el atributo se estampa SOLO cuando el usuario
    eligió explícitamente:
      'system' → sin atributo   → manda @media (prefers-color-scheme: dark)
      'light'  → data-theme="light"  (neutraliza el @media)
      'dark'   → data-theme="dark"
    Por eso 'system' no parpadea jamás: se resuelve en CSS, sin JS.

    Contrato con src/index.html — el script en línea del <head> estampa el mismo
    atributo antes del primer paint leyendo THEME_STORAGE_KEY. Si cambia la clave
    acá, cambia allá.
    ========================================================================== */

import {
  computed,
  DestroyRef,
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
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly preference = signal<ThemeMode>('system');
  private readonly systemPrefersDark = signal(false);

  /** Lo que el usuario eligió: 'light' | 'dark' | 'system'. */
  readonly currentTheme = this.preference.asReadonly();

  /** Lo que efectivamente se está pintando. Es lo que mira un componente. */
  readonly resolvedTheme = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    if (preference !== 'system') {
      return preference;
    }
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  readonly isDark = computed(() => this.resolvedTheme() === 'dark');

  constructor() {
    if (this.isBrowser) {
      this.preference.set(this.readStoredPreference());
      this.watchSystemPreference();
    }

    effect(() => this.applyPreference(this.preference()));
  }

  setTheme(mode: ThemeMode): void {
    this.preference.set(mode);
  }

  /**
   * Alterna claro ↔ oscuro tomando como punto de partida lo que se ve.
   * Alternar desde 'system' fija una preferencia explícita: es lo que el
   * usuario acaba de pedir.
   */
  toggleTheme(): void {
    this.preference.set(this.resolvedTheme() === 'dark' ? 'light' : 'dark');
  }

  /** Devuelve el control al sistema operativo. */
  useSystemTheme(): void {
    this.preference.set('system');
  }

  private applyPreference(mode: ThemeMode): void {
    if (!this.isBrowser) {
      return;
    }
    const root = this.document.documentElement;
    if (mode === 'system') {
      root.removeAttribute(THEME_ATTRIBUTE);
    } else {
      root.setAttribute(THEME_ATTRIBUTE, mode);
    }
    this.persistPreference(mode);
  }

  private watchSystemPreference(): void {
    const query = this.document.defaultView?.matchMedia?.(DARK_SCHEME_QUERY);
    if (!query) {
      return;
    }
    this.systemPrefersDark.set(query.matches);

    const onChange = (event: MediaQueryListEvent) => this.systemPrefersDark.set(event.matches);
    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
  }

  private readStoredPreference(): ThemeMode {
    const stored = this.storage()?.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : 'system';
  }

  private persistPreference(mode: ThemeMode): void {
    const storage = this.storage();
    if (!storage) {
      return;
    }
    try {
      // 'system' se guarda como ausencia: así el script de index.html no estampa nada.
      if (mode === 'system') {
        storage.removeItem(THEME_STORAGE_KEY);
      } else {
        storage.setItem(THEME_STORAGE_KEY, mode);
      }
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
