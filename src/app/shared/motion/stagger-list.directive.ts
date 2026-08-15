import {
  AfterViewInit,
  Directive,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import {
  durationMs,
  easingValue,
  prefersReducedMotion,
  type MotionDuration,
} from './motion-tokens';

/** Retraso entre un hijo y el siguiente, en milisegundos. */
const STEP_MS = 45;

/**
 * Techo de elementos animados.
 *
 * A partir de acá el resto aparece de golpe. Con cuarenta tarjetas y 45 ms de
 * paso, el último entraría casi dos segundos después del primero: eso ya no es
 * un acento, es una espera.
 */
const MAX_ANIMATED = 8;

/** Desplazamiento inicial, en píxeles. */
const OFFSET_PX = 10;

/**
 * Hace aparecer los hijos de un contenedor en cascada.
 *
 * ## Para qué sirve de verdad
 *
 * Cuando llega un lote de datos —las tarjetas del panel, una tabla que se
 * recarga— la cascada dice **«esto es nuevo, y son varios»** en un gesto que se
 * lee sin pensarlo. Aplicada a algo que ya estaba en pantalla no comunica nada
 * y sólo retrasa la lectura.
 *
 * ## Sólo los primeros ocho
 *
 * Con cuarenta hijos, el último entraría casi dos segundos después del primero.
 * A partir del octavo aparecen sin retraso: el gesto ya se entendió.
 *
 * ## Con «reducir movimiento» no anima — y no esconde nada
 *
 * Mismo criterio que `appRevealOnScroll`: los hijos **arrancan visibles** y la
 * animación sólo los mueve. Si arrancaran ocultos, quien pidió menos movimiento
 * se quedaría con una lista vacía.
 *
 * @example
 * ```html
 * <div class="panel" appStaggerList>
 *   @for (tarjeta of tarjetas(); track tarjeta.id) { <app-card …/> }
 * </div>
 * ```
 */
@Directive({
  selector: '[appStaggerList]',
})
export class StaggerList implements AfterViewInit {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /** Cuál de las tres duraciones del sistema, por hijo. */
  readonly duration = input<MotionDuration>('base');

  ngAfterViewInit(): void {
    if (!this.esNavegador || prefersReducedMotion()) {
      return;
    }

    const contenedor = this.host.nativeElement as HTMLElement;
    const ms = durationMs(this.duration(), contenedor);
    if (ms === 0) {
      return;
    }

    const curva = easingValue('out', contenedor);
    const hijos = Array.from(contenedor.children) as HTMLElement[];

    hijos.forEach((hijo, posicion) => {
      if (typeof hijo.animate !== 'function') {
        return;
      }
      hijo.animate(
        [
          { opacity: 0, transform: `translateY(${OFFSET_PX}px)` },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          duration: ms,
          delay: Math.min(posicion, MAX_ANIMATED) * STEP_MS,
          easing: curva,
          fill: 'backwards',
        },
      );
    });
  }
}
