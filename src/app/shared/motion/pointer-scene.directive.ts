import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

import { prefersReducedMotion } from './motion-tokens';

/**
 * Cuánto se acerca el valor pintado al del puntero en cada cuadro.
 *
 * Es un suavizado exponencial, no una transición de CSS: una `transition` sobre
 * `translate` volvería a arrancar en cada `pointermove` —sesenta veces por
 * segundo— y el resultado es una escena que va siempre un tranco atrás. Con el
 * suavizado acá, el CSS recibe un valor que ya viene planchado.
 */
const APROXIMACION = 0.12;

/** Debajo de esto la diferencia no se ve, así que el bucle se apaga. */
const QUIETO = 0.0008;

/**
 * Cuánto queda encendido el efecto después de un toque, en pantallas táctiles.
 *
 * Es el mismo número que la gota de agua del fondo (`alovida.css`, `html::after`):
 * los dos gestos de «tocar la superficie» duran lo mismo.
 */
const TOUCH_GLOW_HOLD_MS = 900;

/** Coordenada de la escena: dónde está el puntero y hacia dónde tira. */
interface Punto {
  x: number;
  y: number;
  presencia: number;
}

/**
 * Convierte el elemento en una **escena que reacciona al puntero**.
 *
 * No mueve nada por su cuenta: publica cinco variables CSS en el host y deja
 * que la hoja de estilos decida qué hacer con ellas. Así el mismo directivo
 * sirve para un fondo con paralaje, para un reflejo que sigue al ratón o para
 * una tarjeta que se inclina, sin que TypeScript sepa nada de ninguno.
 *
 * | Variable | Rango | Qué es |
 * |---|---|---|
 * | `--pointer-x` / `--pointer-y` | `0`–`1` | Posición dentro del elemento. Sirve para un `radial-gradient` en porcentaje. |
 * | `--pointer-tilt-x` / `--pointer-tilt-y` | `-1`–`1` | Lo mismo medido desde el centro. Sirve para desplazar o inclinar. |
 * | `--pointer-on` | `0` o `1` | Si el puntero está encima. Sirve para apagar el efecto al salir. |
 *
 * ## Se abstiene más de lo que actúa
 *
 * No hace nada bajo SSR (no hay puntero), con `prefers-reduced-motion` (es
 * movimiento decorativo puro) ni en pantallas táctiles —`(hover: hover) and
 * (pointer: fine)`—, donde no existe la noción de «el puntero está por acá» y
 * el efecto se dispararía de golpe en cada toque.
 *
 * La excepción táctil es opcional y explícita: con `[pointerSceneTouch]="true"`,
 * en una pantalla sin puntero fino el efecto aparece **donde se toca** y se
 * retira solo a los `TOUCH_GLOW_HOLD_MS`. El escucha es un `pointerdown`
 * pasivo: no bloquea el toque, el foco ni el scroll. Con «reducir movimiento»
 * tampoco se engancha.
 *
 * En todos esos casos las variables **no se escriben**, así que el CSS se queda
 * con los valores de reposo que él mismo declara. Esa es la razón de que el
 * directivo no escriba nunca un estado inicial: el reposo lo define la hoja, y
 * la ausencia de JavaScript tiene que verse igual que la escena quieta.
 *
 * ## Un solo cuadro por vez
 *
 * `pointermove` llega a la frecuencia del dispositivo, que en un ratón de 1000 Hz
 * son mil eventos por segundo. Acá el evento solo anota el destino; escribir en
 * el DOM ocurre una vez por `requestAnimationFrame`, y el bucle se apaga solo
 * cuando la escena alcanzó al puntero.
 *
 * @example
 * ```html
 * <div class="escena" appPointerScene>
 *   <span class="velo"></span>
 * </div>
 * ```
 * ```css
 * .escena { --pointer-tilt-x: 0; --pointer-tilt-y: 0; --pointer-on: 0; }
 * .velo { translate: calc(var(--pointer-tilt-x) * 24px) calc(var(--pointer-tilt-y) * 24px); }
 * ```
 */
@Directive({
  selector: '[appPointerScene]',
})
export class PointerScene {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Dónde está el puntero de verdad. */
  private readonly destino: Punto = { x: 0.5, y: 0.5, presencia: 0 };

  /** Dónde está la escena, que llega siempre unos cuadros después. */
  private readonly actual: Punto = { x: 0.5, y: 0.5, presencia: 0 };

  /**
   * En pantallas táctiles, el efecto aparece donde se toca. Apagado por
   * defecto: solo lo pide quien tiene un efecto que tenga sentido en un
   * teléfono (el escenario del acceso).
   */
  readonly pointerSceneTouch = input(false);

  private cuadro = 0;

  private touchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    afterNextRender(() => {
      if (!allowsMotion()) {
        return;
      }

      const elemento = this.host.nativeElement;
      if (hasFinePointer()) {
        this.listenToMouse(elemento);
      } else if (this.pointerSceneTouch()) {
        this.listenToTouch(elemento);
      }
    });
  }

  private listenToMouse(elemento: HTMLElement): void {
    elemento.addEventListener('pointermove', this.alMover, { passive: true });
    elemento.addEventListener('pointerleave', this.alSalir, { passive: true });
    elemento.addEventListener('pointercancel', this.alSalir, { passive: true });

    this.destroyRef.onDestroy(() => {
      elemento.removeEventListener('pointermove', this.alMover);
      elemento.removeEventListener('pointerleave', this.alSalir);
      elemento.removeEventListener('pointercancel', this.alSalir);
      this.cancelFrame();
    });
  }

  private listenToTouch(elemento: HTMLElement): void {
    elemento.addEventListener('pointerdown', this.onTouch, { passive: true });

    this.destroyRef.onDestroy(() => {
      elemento.removeEventListener('pointerdown', this.onTouch);
      clearTimeout(this.touchTimer);
      this.touchTimer = undefined;
      this.cancelFrame();
    });
  }

  private cancelFrame(): void {
    if (this.cuadro !== 0) {
      cancelAnimationFrame(this.cuadro);
      this.cuadro = 0;
    }
  }

  private readonly alMover = (evento: PointerEvent): void => {
    const caja = this.host.nativeElement.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) {
      return;
    }

    this.destino.x = acotar((evento.clientX - caja.left) / caja.width);
    this.destino.y = acotar((evento.clientY - caja.top) / caja.height);
    this.destino.presencia = 1;
    this.pedirCuadro();
  };

  /**
   * Un toque: el efecto SALTA al punto —no se desliza desde el centro, que en
   * un teléfono se leería como un arrastre que nadie hizo— y se enciende. Un
   * único temporizador, reprogramado en cada toque, lo apaga después.
   */
  private readonly onTouch = (evento: PointerEvent): void => {
    if (evento.pointerType === 'mouse') {
      return;
    }
    const caja = this.host.nativeElement.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) {
      return;
    }

    this.destino.x = acotar((evento.clientX - caja.left) / caja.width);
    this.destino.y = acotar((evento.clientY - caja.top) / caja.height);
    this.destino.presencia = 1;
    this.actual.x = this.destino.x;
    this.actual.y = this.destino.y;
    this.pedirCuadro();

    clearTimeout(this.touchTimer);
    this.touchTimer = setTimeout(this.releaseTouch, TOUCH_GLOW_HOLD_MS);
  };

  /** Se apaga en el lugar del toque, con el mismo suavizado con que se encendió. */
  private readonly releaseTouch = (): void => {
    this.touchTimer = undefined;
    this.destino.presencia = 0;
    this.pedirCuadro();
  };

  private readonly alSalir = (): void => {
    // El puntero vuelve al centro y la presencia se apaga: la escena regresa a
    // su reposo con el mismo suavizado con que salió de él, en vez de saltar.
    this.destino.x = 0.5;
    this.destino.y = 0.5;
    this.destino.presencia = 0;
    this.pedirCuadro();
  };

  private pedirCuadro(): void {
    if (this.cuadro !== 0) {
      return;
    }
    this.cuadro = requestAnimationFrame(this.avanzar);
  }

  private readonly avanzar = (): void => {
    this.cuadro = 0;

    this.actual.x += (this.destino.x - this.actual.x) * APROXIMACION;
    this.actual.y += (this.destino.y - this.actual.y) * APROXIMACION;
    this.actual.presencia += (this.destino.presencia - this.actual.presencia) * APROXIMACION;

    this.publicar();

    const distancia =
      Math.abs(this.destino.x - this.actual.x) +
      Math.abs(this.destino.y - this.actual.y) +
      Math.abs(this.destino.presencia - this.actual.presencia);

    if (distancia > QUIETO) {
      this.pedirCuadro();
      return;
    }

    // Llegó: se escribe el destino exacto para no dejar un resto de coma
    // flotante congelado en el estilo.
    this.actual.x = this.destino.x;
    this.actual.y = this.destino.y;
    this.actual.presencia = this.destino.presencia;
    this.publicar();
  };

  private publicar(): void {
    const estilo = this.host.nativeElement.style;
    estilo.setProperty('--pointer-x', this.actual.x.toFixed(4));
    estilo.setProperty('--pointer-y', this.actual.y.toFixed(4));
    estilo.setProperty('--pointer-tilt-x', (this.actual.x * 2 - 1).toFixed(4));
    estilo.setProperty('--pointer-tilt-y', (this.actual.y * 2 - 1).toFixed(4));
    estilo.setProperty('--pointer-on', this.actual.presencia.toFixed(4));
  }
}

/**
 * Movimiento decorativo y navegador: sin ellos no se engancha ningún escucha.
 *
 * `prefers-reduced-motion` se consulta una sola vez y no en cada cuadro porque
 * lo que se decide es si **enganchar los escuchas**; quien cambie la
 * preferencia con la pantalla de acceso abierta la verá aplicada al recargar,
 * que es el único momento en que esta pantalla existe.
 */
function allowsMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return !prefersReducedMotion();
}

/** Puntero fino con hover: un ratón o un trackpad, no un dedo. */
function hasFinePointer(): boolean {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** El puntero puede salirse del elemento durante una captura; se recorta. */
function acotar(valor: number): number {
  return Math.min(1, Math.max(0, valor));
}
