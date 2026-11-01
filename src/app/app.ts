import { NgComponentOutlet } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal, type Type } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AlovidaRuntimeService } from '@core/alovida/alovida-runtime.service';
import { ToastContainer } from '@shared/components/organisms/toast-container/toast-container';
import { environment } from '../environments/environment';
import { loadSimulatorBanner } from './core/simulator/simulator';
import { FreeGapNotice } from './features/notifications/free-slot-notice';
import { DelayNotice } from './features/notifications/delay-notice';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, NgComponentOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly alovida = inject(AlovidaRuntimeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly huecosLibres = inject(FreeGapNotice);
  private readonly delays = inject(DelayNotice);

  /**
   * El cartel «Modo demo», sólo con el simulador encendido (H1.S2.M1). Contra
   * la API real no tiene nada que anunciar.
   *
   * Se pide por `core/simulator/simulator.ts` y no se importa directamente
   * (O3-4): en las compilaciones contra la API real ese archivo es la versión
   * neutra, que no trae cargador, así que el cartel y sus cuentas de prueba no
   * entran al paquete. Con el simulador se carga en su propio fragmento, tras
   * el primer render en el navegador, como lo hacía el `@defer` de antes.
   */
  protected readonly banner = signal<Type<unknown> | null>(null);

  constructor() {
    /* Los comportamientos del marco ALOVIDA (menús, diálogo, cajón de
       navegación, etiquetas de tabla) se instalan una vez y se refrescan en
       cada navegación: en la maqueta estática bastaba con DOMContentLoaded,
       pero acá el documento no se recarga entre pantallas. */
    this.alovida.instalar();
    const cargarCartel = loadSimulatorBanner;
    if (environment.mockBackend && cargarCartel !== null) {
      afterNextRender(() => {
        // Sin red el fragmento puede no llegar: el cartel es un aviso, no algo de lo que dependa la pantalla.
        void cargarCartel()
          .then((cartel) => this.banner.set(cartel))
          .catch(() => undefined);
      });
    }
    /* El aviso de cupo libre del punto 3.4 del registro de procesos. Se
       enciende solo en la maqueta y sólo con sesión abierta: contra la API real
       el empujón lo da el servidor (módulo 35). Ver `free-slot-notice.ts`. */
    this.huecosLibres.start();
    /* «El médico se demora» como push: toast fijo con «Ver mi cita» y, con
       permiso, notificación del sistema. Corre también contra la API real.
       Ver `delay-notice.ts`. */
    this.delays.start();
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
