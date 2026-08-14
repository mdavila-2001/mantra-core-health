import {
  Directive,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import {
  durationMs,
  easingValue,
  prefersReducedMotion,
  type MotionDuration,
} from './motion-tokens';

/** Cuánto del elemento tiene que verse para considerarlo «entró». */
const VISIBLE_THRESHOLD = 0.15;

/** Desplazamiento inicial, en píxeles. Corto a propósito: es un acento. */
const OFFSET_PX = 12;

/**
 * Hace aparecer un elemento cuando entra en pantalla.
 *
 * ## Qué hace, y qué no
 *
 * Un desplazamiento de 12 px y una opacidad. **No es una entrada teatral**: en
 * una aplicación clínica el movimiento sirve para dirigir la mirada hacia lo
 * que acaba de llegar, no para lucirse. Un elemento que tarda medio segundo en
 * poder leerse es una molestia con buenas intenciones.
 *
 * ## Se anima una sola vez
 *
 * El observador se desconecta al primer cruce. Un panel que reanima cada vez
 * que se pasa por encima convierte el scroll en un parpadeo.
 *
 * ## Con «reducir movimiento» no anima — y tampoco esconde
 *
 * Esto es lo importante: el elemento **arranca visible**, y la animación sólo
 * lo mueve. Si arrancara oculto y la animación estuviera suprimida, quien pidió
 * menos movimiento se quedaría con la pantalla en blanco. Es el modo de fallo
 * clásico de este patrón, y por eso acá el estado sin animación es el estado
 * final, no el inicial.
 *
 * ## No corre en el servidor
 *
 * `IntersectionObserver` no existe bajo SSR, y el HTML del servidor tiene que
 * llegar legible: es lo que ve un buscador y quien tiene JavaScript apagado.
 *
 * @example
 * ```html
 * <article appRevealOnScroll>…</article>
 * <article appRevealOnScroll duration="slow">…</article>
 * ```
 */
@Directive({
  selector: '[appRevealOnScroll]',
})
export class RevealOnScroll implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));
  private observador: IntersectionObserver | null = null;

  /** Cuál de las tres duraciones del sistema. */
  readonly duration = input<MotionDuration>('base');

  /** Retraso antes de arrancar, en milisegundos. Lo usa `appStaggerList`. */
  readonly delay = input<number>(0);

  ngOnInit(): void {
    if (!this.esNavegador || prefersReducedMotion()) {
      return;
    }
    if (typeof IntersectionObserver !== 'function') {
      return;
    }

    this.observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            this.animar();
            this.desconectar();
          }
        }
      },
      { threshold: VISIBLE_THRESHOLD },
    );
    this.observador.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.desconectar();
  }

  private animar(): void {
    const elemento = this.host.nativeElement as HTMLElement;
    const ms = durationMs(this.duration(), elemento);
    if (ms === 0) {
      return;
    }

    elemento.animate(
      [
        { opacity: 0, transform: `translateY(${OFFSET_PX}px)` },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      {
        duration: ms,
        delay: this.delay(),
        // `out` y no `standard`: algo que aparece se posa, no arranca acelerando.
        easing: easingValue('out', elemento),
        fill: 'backwards',
      },
    );
  }

  private desconectar(): void {
    this.observador?.disconnect();
    this.observador = null;
  }
}
