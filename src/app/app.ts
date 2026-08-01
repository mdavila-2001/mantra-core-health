import { ChangeDetectionStrategy, Component, isDevMode } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastContainer } from '@shared/components/organisms/toast-container/toast-container';
import { ToastDevPanel } from '@core/dev/toast-dev-panel/toast-dev-panel';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, ToastDevPanel],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /**
   * Condición del `@defer` del panel de pruebas. En producción es `false` para
   * siempre, así que el chunk del panel NUNCA se descarga — y como el panel se
   * usa solo dentro del bloque diferido, ni siquiera entra al bundle inicial.
   */
  protected readonly isDev = isDevMode();
}
