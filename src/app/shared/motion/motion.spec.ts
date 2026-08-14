import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { durationMs, easingValue, prefersReducedMotion } from './motion-tokens';
import { RevealOnScroll } from './reveal-on-scroll.directive';
import { StaggerList } from './stagger-list.directive';

/**
 * Lo que estas pruebas fijan.
 *
 * El sistema de movimiento tiene **una sola regla que no se puede romper**: con
 * `prefers-reduced-motion` activo, nada anima **y nada queda escondido**. La
 * segunda mitad es la que se olvida: si el elemento arrancara oculto y la
 * animación estuviera suprimida, quien pidió menos movimiento se quedaría con
 * la pantalla en blanco. Es el modo de fallo clásico del patrón.
 *
 * Lo demás —que la curva sea la del sistema, que la cascada tenga techo— se
 * comprueba sobre lo que se le pidió al navegador, no sobre píxeles.
 */

/** Registra lo que se le pidió animar sin depender del motor real. */
interface Pedido {
  readonly opciones: KeyframeAnimationOptions;
}

function espiarAnimate(): Pedido[] {
  const pedidos: Pedido[] = [];
  Element.prototype.animate = function (
    _keyframes: unknown,
    opciones: KeyframeAnimationOptions,
  ) {
    pedidos.push({ opciones });
    return { finished: Promise.resolve() } as unknown as Animation;
  } as typeof Element.prototype.animate;
  return pedidos;
}

/** `matchMedia` controlable: jsdom no lo trae. */
function fijarReducedMotion(activo: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (consulta: string) => ({
      matches: activo && consulta.includes('prefers-reduced-motion'),
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

@Component({
  imports: [RevealOnScroll, StaggerList],
  template: `
    <article appRevealOnScroll>Una tarjeta</article>
    <div appStaggerList>
      @for (n of items(); track n) {
        <span>Elemento {{ n }}</span>
      }
    </div>
  `,
})
class Anfitrion {
  readonly items = signal([1, 2, 3]);
}

describe('Sistema de movimiento', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let pedidos: Pedido[];
  const animateOriginal = Element.prototype.animate;

  afterEach(() => {
    Element.prototype.animate = animateOriginal;
    quitarTokens();
  });

  /**
   * Crea el anfitrión con la cantidad de hijos pedida.
   *
   * Los hijos se fijan **antes** del primer `detectChanges`: `ngAfterViewInit`
   * corre ahí, y una lista que crece después no vuelve a animarse.
   */
  const montar = (cuantos = 3): void => {
    fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.items.set(
      Array.from({ length: cuantos }, (_, i) => i + 1),
    );
    fixture.detectChanges();
  };

  /**
   * Declara los tokens en el documento de la prueba.
   *
   * jsdom no carga `styles.css`, así que sin esto `durationMs` devuelve 0 y las
   * directivas **no animan** — que es su comportamiento correcto (si no se
   * puede leer la duración, no se inventa una), pero deja las pruebas de la
   * cascada sin nada que observar.
   */
  const declararTokens = (): void => {
    document.documentElement.style.setProperty('--dur-base', '200ms');
    document.documentElement.style.setProperty('--ease-out', 'cubic-bezier(0, 0, 0.2, 1)');
  };

  const quitarTokens = (): void => {
    document.documentElement.style.removeProperty('--dur-base');
    document.documentElement.style.removeProperty('--ease-out');
  };

  beforeEach(async () => {
    pedidos = espiarAnimate();
    fijarReducedMotion(false);
    declararTokens();
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
  });

  describe('con «reducir movimiento» activo', () => {
    beforeEach(() => {
      fijarReducedMotion(true);
      montar();
    });

    it('no anima nada', () => {
      expect(pedidos.length).toBe(0);
    });

    /**
     * La otra mitad de la regla, y la que se olvida: sin animación, el
     * contenido **igual se ve**. Nada arranca en `opacity: 0`.
     */
    it('el contenido queda visible igual', () => {
      const tarjeta: HTMLElement = fixture.nativeElement.querySelector('article');
      expect(tarjeta.style.opacity).toBe('');
      expect(tarjeta.textContent).toContain('Una tarjeta');

      const items: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('span'),
      );
      expect(items.length).toBe(3);
      for (const item of items) {
        expect(item.style.opacity).toBe('');
      }
    });
  });

  describe('la cascada', () => {
    it('escalona el retraso de cada hijo', () => {
      montar();

      // El `article` de reveal no anima acá: sin IntersectionObserver en jsdom,
      // la directiva sale temprano. Lo que se mide es la cascada.
      const retrasos = pedidos.map((p) => p.opciones.delay);
      expect(retrasos).toEqual([0, 45, 90]);
    });

    it('usa la curva del sistema y no una inventada', () => {
      montar();

      for (const pedido of pedidos) {
        expect(pedido.opciones.easing).toBe('cubic-bezier(0, 0, 0.2, 1)');
      }
    });

    /**
     * Con cuarenta hijos, el último entraría casi dos segundos después del
     * primero: eso ya no es un acento, es una espera.
     */
    it('tiene techo: a partir del octavo no crece el retraso', () => {
      montar(12);

      const retrasos = pedidos.map((p) => p.opciones.delay as number);
      expect(Math.max(...retrasos)).toBe(8 * 45);
      expect(retrasos.at(-1)).toBe(8 * 45);
    });
  });

  describe('los tokens', () => {
    it('leen los valores del CSS, no una copia propia', () => {
      expect(durationMs('base')).toBe(200);
      expect(easingValue('out')).toBe('cubic-bezier(0, 0, 0.2, 1)');
    });

    /**
     * Sin hoja de estilos —SSR, una prueba, un fallo de carga— los tokens
     * devuelven respaldos honestos y no `NaN`. `durationMs` en 0 significa **no
     * animes**, no «animá instantáneo»: es lo que hace que las directivas se
     * abstengan en vez de producir un parpadeo.
     */
    it('sin hoja de estilos se abstienen, no inventan', () => {
      quitarTokens();

      expect(durationMs('base')).toBe(0);
      expect(easingValue('out')).toBe('ease-out');
    });

    it('prefersReducedMotion consulta el navegador cada vez', () => {
      fijarReducedMotion(false);
      expect(prefersReducedMotion()).toBe(false);

      // La preferencia se puede cambiar con la aplicación abierta: una copia
      // guardada al arrancar seguiría animando después de desactivarla.
      fijarReducedMotion(true);
      expect(prefersReducedMotion()).toBe(true);
    });
  });
});
