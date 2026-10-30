import { DOCUMENT, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { leerTemaGraficos, type ChartTheme } from '@shared/components/organisms/chart-panel/chart-theme';

/**
 * El tema de los gráficos pequeños (mini-tendencias de las tarjetas KPI).
 *
 * ECharts no entiende `var()`, así que los tokens se resuelven en ejecución. Con
 * ocho tarjetas por pestaña, que cada una observara el `<html>` por su cuenta
 * sería ocho observadores para el mismo aviso: este servicio lo hace una vez y
 * todas leen la misma señal. Bajo SSR no hay documento que medir, así que la
 * señal queda en `null` y la tarjeta se pinta sin mini-gráfico hasta hidratar.
 */
@Injectable({ providedIn: 'root' })
export class ChartThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private started = false;

  readonly theme = signal<ChartTheme | null>(null);

  /** Idempotente: la primera tarjeta que se pinta lo arranca, las demás no hacen nada. */
  start(): void {
    const view = this.document.defaultView;
    if (this.started || !this.isBrowser || view === null) {
      return;
    }
    this.started = true;
    const reread = () => this.theme.set(leerTemaGraficos());
    reread();
    // El tema cambia por el atributo `data-theme`, por la clase o por la preferencia del sistema.
    new MutationObserver(reread).observe(this.document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    // `matchMedia` no existe en todos los entornos (el de pruebas, por ejemplo): sin él se sigue con el atributo.
    if (typeof view.matchMedia === 'function') {
      view.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', reread);
    }
  }
}
