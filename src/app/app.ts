import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AlovidaRuntimeService } from '@core/alovida/alovida-runtime.service';
import { ToastContainer } from '@shared/components/organisms/toast-container/toast-container';
import { MockBanner } from './core/mock/mock-banner';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, MockBanner],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly alovida = inject(AlovidaRuntimeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    /* Los comportamientos del marco ALOVIDA (menús, diálogo, cajón de
       navegación, etiquetas de tabla) se instalan una vez y se refrescan en
       cada navegación: en la maqueta estática bastaba con DOMContentLoaded,
       pero acá el documento no se recarga entre pantallas. */
    this.alovida.instalar();
    this.aplicarPantalla();
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.aplicarPantalla());
  }

  /**
   * Dos cosas que la pantalla declara y el marco tiene que obedecer: su
   * arquetipo —que gobierna la composición— y el estado que pide la URL, que
   * es cómo navegan las etapas de un formulario (`?estado=paso2`).
   */
  private aplicarPantalla(): void {
    let hoja = this.route;
    while (hoja.firstChild) {
      hoja = hoja.firstChild;
    }
    const arquetipo = hoja.snapshot.data['arquetipo'];
    this.alovida.fijarArquetipo(typeof arquetipo === 'string' ? arquetipo : null);
    this.alovida.refrescar(hoja.snapshot.queryParamMap.get('estado'));
  }
}
