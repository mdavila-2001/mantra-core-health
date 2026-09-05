import { computed, inject, Injectable, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, scan } from 'rxjs';

/**
 * ¿Hay a dónde volver **dentro** de la aplicación?
 *
 * Responde una sola pregunta, y la responde contando las navegaciones que el
 * router dio por terminadas: la primera es la pantalla en la que estás parado,
 * así que recién a partir de la segunda hubo un paso previo propio al que se
 * puede retroceder.
 *
 * ## Por qué NO se usa `history.length`
 *
 * Porque no contesta esta pregunta. `history.length` es el largo de la pila de
 * la pestaña entera —lo que se visitó antes de llegar acá, incluidos otros
 * sitios— y **nunca decrece**: al volver atrás el índice se mueve, el largo no.
 * Así que un `length > 1` no distingue «llegué navegando por la aplicación» de
 * «abrí el enlace directo del correo con la pestaña ya usada», que es
 * exactamente la distinción que hay que hacer. Retroceder en el segundo caso
 * saca a la persona de la aplicación.
 *
 * ## Seguro bajo SSR por construcción
 *
 * No toca `window`, `document` ni `history`: sólo eventos del router. En el
 * render del servidor la cuenta es 1 —la navegación que produjo la página— y la
 * respuesta es «no», que es la correcta: el HTML del servidor no puede saber
 * qué había antes en la pestaña.
 */
@Injectable({
  providedIn: 'root',
})
export class NavigationHistoryService {
  private readonly router = inject(Router);

  /**
   * Cuántas navegaciones habían terminado **antes** de que este servicio
   * existiera: ninguna, o al menos una.
   *
   * Hace falta porque el servicio nace tarde. Es `providedIn: 'root'`, así que
   * se instancia la primera vez que alguien lo inyecta —el primer control
   * «Volver» que se dibuja—, y eso ocurre mientras el router **activa** esa
   * pantalla, o sea antes de que emita el `NavigationEnd` de esa misma
   * navegación. Sin esta semilla, quien llega a la pantalla profunda navegando
   * contaría una sola navegación y el control diría, mintiendo, que no hay a
   * dónde volver.
   *
   * Un valor de 1 alcanza: la pregunta es «¿hubo alguna?», no «¿cuántas?».
   *
   * Va en `untracked` porque el servicio puede nacer dentro de un cálculo
   * reactivo ajeno, y sin eso esa lectura ataría el cálculo al router para
   * siempre.
   */
  private readonly navigationsBeforeBirth = untracked(() =>
    this.router.lastSuccessfulNavigation() === null ? 0 : 1,
  );

  /**
   * Navegaciones terminadas, contando desde el arranque de la aplicación.
   *
   * Mismo mecanismo que `NavigationService.currentUrl`: `NavigationEnd` y no
   * `router.url`, porque leer una propiedad dentro de un `computed` daría el
   * valor del primer cálculo para siempre.
   */
  private readonly completedNavigations = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      scan((count) => count + 1, this.navigationsBeforeBirth),
    ),
    { initialValue: this.navigationsBeforeBirth },
  );

  /** `true` si hubo al menos una navegación propia antes de la pantalla actual. */
  readonly hasInternalHistory = computed(() => this.completedNavigations() > 1);
}
