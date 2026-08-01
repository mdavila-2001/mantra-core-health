import { Component, isDevMode } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastContainer } from '@shared/components/organisms/toast-container/toast-container';
import { ToastDevPanel } from './core/dev/toast-dev-panel/toast-dev-panel';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, ToastDevPanel],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  /**
   * Condición del `@defer` que aísla el panel de pruebas de avisos. Se lee una
   * sola vez: `isDevMode()` no cambia durante la vida de la aplicación, y el
   * bloque diferido queda en un chunk que en producción nunca se descarga.
   */
  readonly isDev = isDevMode();
}
