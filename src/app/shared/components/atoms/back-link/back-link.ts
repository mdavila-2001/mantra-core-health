import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { NavigationHistoryService } from '../../../../core/navigation/navigation-history.service';
import { AppButtonLink } from '../button/button-link';
import { NavIcon } from '../nav-icon/nav-icon';

/**
 * La salida de una pantalla profunda: «Volver».
 *
 * ```html
 * <app-page-header title="Encuesta">
 *   <app-back-link page-actions fallback="/questionnaires" label="Volver a las encuestas" />
 * </app-page-header>
 * ```
 *
 * ## Por qué es un enlace de verdad y no un botón
 *
 * El host dibuja **siempre** un `<a>` con destino real —el respaldo—, incluso
 * cuando el clic se va a interceptar. Eso es lo que hace que la pieza funcione
 * en el HTML del servidor, sobreviva al clic con la rueda y a «abrir en pestaña
 * nueva», muestre el destino en la barra de estado y siga llevando a algún lado
 * si el JavaScript todavía no arrancó. Un `<button>` que llama al router pierde
 * las cuatro cosas.
 *
 * ## Encima, mejora progresiva
 *
 * Si {@link NavigationHistoryService} dice que hubo una navegación previa
 * **dentro** de la aplicación, el clic se intercepta y se retrocede con
 * `Location.back()`: volver es deshacer el paso que se dio, no ir a una pantalla
 * que se le parece. Si no la hubo —enlace de un correo, recarga, primera
 * pantalla de la sesión— no hay nada que deshacer y se navega al respaldo.
 *
 * Los clics con Ctrl, Meta, Shift o Alt, y los que no son del botón principal,
 * **no se tocan**: son la forma de pedir una pestaña nueva, una ventana o una
 * descarga, y quedárselos rompe algo que el navegador ya hacía bien.
 *
 * ## Por qué el `href` se arma acá y no con `routerLink`
 *
 * Porque `routerLink` atiende el clic **antes** que cualquier `(click)` de la
 * plantilla: Angular registra los escuchas de las directivas al instanciarlas,
 * o sea antes que los del marcado. Medido, no supuesto — con las dos cosas en
 * el mismo `<a>`, el router ya navegó al respaldo para cuando corre el
 * `preventDefault()`, y el `Location.back()` de después deja la pila con dos
 * entradas de más. Así que el ancla lleva su `href` armado con las mismas dos
 * piezas que usa `RouterLink` por dentro (`Router.createUrlTree` +
 * `Location.prepareExternalUrl`) y hay un solo dueño del clic.
 *
 * ## El aspecto no es propio
 *
 * Es el mismo `<a app-button variant="secondary">` que ya usan las pantallas
 * que tenían su vuelta escrita a mano. Abrir un segundo aspecto para el mismo
 * rol sería empezar a tener dos «Volver» distintos según la pantalla.
 */
@Component({
  selector: 'app-back-link',
  imports: [AppButtonLink, NavIcon],
  templateUrl: './back-link.html',
  styleUrl: './back-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackLink {
  private readonly history = inject(NavigationHistoryService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /**
   * A dónde se vuelve cuando no hay historial propio que deshacer. Acepta lo
   * mismo que `routerLink`, y es obligatorio: sin destino de reserva el enlace
   * no llevaría a ningún lado justo en el caso que más lo necesita.
   */
  readonly fallback = input.required<string | readonly unknown[]>();

  /** El texto visible. «Volver a las encuestas» dice más que «Volver». */
  readonly label = input('Volver');

  /** El respaldo como árbol de URL, que es lo que el router sabe navegar. */
  private readonly fallbackUrl = computed(() => {
    const destino = this.fallback();
    return this.router.createUrlTree(Array.isArray(destino) ? destino : [destino]);
  });

  /**
   * El destino escrito en el ancla. Pasa por `prepareExternalUrl` para que
   * respete el `<base href>` del despliegue, igual que haría `routerLink`.
   */
  protected readonly href = computed(() =>
    this.location.prepareExternalUrl(this.router.serializeUrl(this.fallbackUrl())),
  );

  protected handleClick(event: MouseEvent): void {
    if (!this.isPlainClick(event)) {
      return;
    }

    event.preventDefault();

    if (this.history.hasInternalHistory()) {
      this.location.back();
      return;
    }

    void this.router.navigateByUrl(this.fallbackUrl());
  }

  /**
   * Un clic con modificador o con otro botón es un pedido al navegador
   * —pestaña nueva, ventana, descarga, menú contextual—, no a la aplicación.
   */
  private isPlainClick(event: MouseEvent): boolean {
    return (
      event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
    );
  }
}
