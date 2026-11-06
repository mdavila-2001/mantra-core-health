/* ============================================================================
    The clinical network canvas' horizontal scroll: it opens at the end (the
    most recent is what people come to see), stays there while nobody moves,
    and jumps to a stretch only when it is not already in view.
    ========================================================================== */

/** Whether the person asked for reduced motion. */
export function reducirMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class DesplazamientoDelLienzo {
  /**
   * Whether the canvas is still stuck to the end. Whoever scrolls releases it,
   * and so does expanding an episode: the canvas goes to its records.
   */
  pegadoAlFinal = true;

  private soltarLienzo: (() => void) | null = null;

  constructor(private readonly lienzo: () => HTMLElement | undefined) {}

  /**
   * Opens at the end and stays there while the viewer does not move: after
   * the first render the canvas still changes width (scrollbar, fonts), and
   * the last column was left cut off.
   */
  fijarAlFinal(lienzo: HTMLElement): void {
    this.soltar();
    if (typeof ResizeObserver !== 'function') {
      this.irA('final', false);
      return;
    }
    this.pegadoAlFinal = true;
    let propio = lienzo.scrollLeft;
    const pegar = (): void => {
      this.irA('final', false);
      propio = lienzo.scrollLeft;
    };
    const observador = new ResizeObserver(() => {
      if (this.pegadoAlFinal) {
        pegar();
      }
    });
    observador.observe(lienzo);
    if (lienzo.firstElementChild !== null) {
      observador.observe(lienzo.firstElementChild);
    }
    const alDesplazar = (): void => {
      if (Math.abs(lienzo.scrollLeft - propio) <= 1) {
        return;
      }
      if (lienzo.scrollLeft < lienzo.scrollWidth - lienzo.clientWidth - 2) {
        this.pegadoAlFinal = false;
      }
    };
    lienzo.addEventListener('scroll', alDesplazar, { passive: true });
    pegar();
    this.soltarLienzo = () => {
      observador.disconnect();
      lienzo.removeEventListener('scroll', alDesplazar);
    };
  }

  soltar(): void {
    this.soltarLienzo?.();
    this.soltarLienzo = null;
  }

  irA(extremo: 'inicio' | 'final', suave = true): void {
    const lienzo = this.lienzo();
    if (lienzo === undefined) {
      return;
    }
    const destino = extremo === 'inicio' ? 0 : lienzo.scrollWidth;
    if (typeof lienzo.scrollTo === 'function') {
      lienzo.scrollTo({ left: destino, behavior: suave && !reducirMovimiento() ? 'smooth' : 'auto' });
    } else {
      lienzo.scrollLeft = destino;
    }
  }

  /** Brings the stretch `[primero, ultimo]` into view. */
  mostrarTramo(primero: number, ultimo: number): void {
    const lienzo = this.lienzo();
    if (lienzo === undefined || typeof lienzo.scrollTo !== 'function') {
      return;
    }
    // If it is already whole in view, it does not move: a jump for no reason disorients.
    if (primero >= lienzo.scrollLeft && ultimo <= lienzo.scrollLeft + lienzo.clientWidth) {
      return;
    }
    lienzo.scrollTo({ left: Math.max(0, primero), behavior: reducirMovimiento() ? 'auto' : 'smooth' });
  }
}
