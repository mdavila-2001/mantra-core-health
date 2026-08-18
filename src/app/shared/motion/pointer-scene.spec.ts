import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PointerScene } from './pointer-scene.directive';

/**
 * Lo que estas pruebas fijan.
 *
 * `appPointerScene` no dibuja nada: **publica cinco variables CSS**. Así que lo
 * que se comprueba es exactamente eso —qué valores escribe y, sobre todo, cuándo
 * NO escribe ninguno—, y no píxeles ni transformaciones, que son cosa de la hoja
 * de estilos.
 *
 * La mitad importante es la de abstenerse. Un efecto de puntero que se engancha
 * en una pantalla táctil no falla ruidosamente: salta de golpe en cada toque,
 * que es peor. Y con `prefers-reduced-motion` no hay término medio: es
 * movimiento decorativo puro y no corre.
 */

/** Un `matchMedia` controlable: jsdom no lo trae. */
function fijarEntorno(opciones: { reducido: boolean; punteroFino: boolean }): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (consulta: string) => ({
      matches: consulta.includes('prefers-reduced-motion')
        ? opciones.reducido
        : opciones.punteroFino,
      media: consulta,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

/** El rectángulo del host: jsdom no hace layout y devolvería todo en cero. */
function fijarCaja(elemento: HTMLElement, ancho: number, alto: number): void {
  elemento.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: ancho, height: alto }) as DOMRect;
}

@Component({
  imports: [PointerScene],
  template: `<div class="escena" appPointerScene></div>`,
})
class Anfitrion {}

describe('PointerScene', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let escena: HTMLElement;
  let cuadros: FrameRequestCallback[] = [];

  const rafOriginal = window.requestAnimationFrame;
  const cancelOriginal = window.cancelAnimationFrame;
  const matchMediaOriginal = window.matchMedia;

  /**
   * Los cuadros se encolan en vez de correr solos.
   *
   * El suavizado del directivo tarda decenas de cuadros en llegar; con el
   * `requestAnimationFrame` real habría que esperar casi un segundo de reloj
   * para ver el valor final. El sustituto se instala **después** de montar el
   * componente, para no interferir con la detección de cambios de Angular.
   */
  const tomarElControlDeLosCuadros = (): void => {
    cuadros = [];
    window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      cuadros.push(cb);
      return cuadros.length;
    };
    window.cancelAnimationFrame = (): void => undefined;
  };

  /** Corre lo encolado hasta que la escena alcanza al puntero y se apaga sola. */
  const dejarQueLaEscenaAlcance = (maximo = 400): void => {
    for (let i = 0; i < maximo && cuadros.length > 0; i += 1) {
      const pendientes = cuadros;
      cuadros = [];
      for (const cuadro of pendientes) {
        cuadro(0);
      }
    }
  };

  const mover = (x: number, y: number): void => {
    escena.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }));
  };

  const variable = (nombre: string): string => escena.style.getPropertyValue(nombre);

  const montar = async (opciones: {
    reducido: boolean;
    punteroFino: boolean;
  }): Promise<void> => {
    fijarEntorno(opciones);
    fixture = TestBed.createComponent(Anfitrion);
    escena = fixture.nativeElement.querySelector('.escena') as HTMLElement;
    fijarCaja(escena, 200, 100);
    await fixture.whenStable();
    tomarElControlDeLosCuadros();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
  });

  afterEach(() => {
    window.requestAnimationFrame = rafOriginal;
    window.cancelAnimationFrame = cancelOriginal;
    window.matchMedia = matchMediaOriginal;
  });

  describe('con ratón y sin restricciones de movimiento', () => {
    beforeEach(async () => {
      await montar({ reducido: false, punteroFino: true });
    });

    it('publica la posición del puntero dentro del elemento', () => {
      mover(150, 25);
      dejarQueLaEscenaAlcance();

      // 150 de 200 y 25 de 100: tres cuartos a la derecha, un cuarto abajo.
      expect(Number(variable('--pointer-x'))).toBeCloseTo(0.75, 3);
      expect(Number(variable('--pointer-y'))).toBeCloseTo(0.25, 3);
    });

    it('publica además la desviación desde el centro, que es lo que inclina', () => {
      mover(150, 25);
      dejarQueLaEscenaAlcance();

      // El mismo punto, medido desde el centro: +0,5 a la derecha, −0,5 arriba.
      expect(Number(variable('--pointer-tilt-x'))).toBeCloseTo(0.5, 3);
      expect(Number(variable('--pointer-tilt-y'))).toBeCloseTo(-0.5, 3);
    });

    it('enciende y apaga la presencia al entrar y al salir', () => {
      mover(100, 50);
      dejarQueLaEscenaAlcance();
      expect(Number(variable('--pointer-on'))).toBe(1);

      escena.dispatchEvent(new MouseEvent('pointerleave'));
      dejarQueLaEscenaAlcance();

      // Y vuelve al centro: el efecto se retira, no se queda congelado donde
      // estaba la mano.
      expect(Number(variable('--pointer-on'))).toBe(0);
      expect(Number(variable('--pointer-tilt-x'))).toBe(0);
      expect(Number(variable('--pointer-tilt-y'))).toBe(0);
    });

    it('recorta lo que caiga fuera del elemento', () => {
      // El puntero puede salirse del elemento durante una captura y un valor
      // fuera de 0–1 correría el foco de luz más allá del borde.
      mover(9999, -9999);
      dejarQueLaEscenaAlcance();

      expect(Number(variable('--pointer-x'))).toBe(1);
      expect(Number(variable('--pointer-y'))).toBe(0);
    });

    it('escribe una sola vez por cuadro, no una por evento', () => {
      for (let i = 0; i < 20; i += 1) {
        mover(100 + i, 50);
      }

      // Veinte eventos, un cuadro encolado: el DOM se toca cuando el navegador
      // va a pintar y no cuando el ratón se mueve.
      expect(cuadros.length).toBe(1);
    });

    it('deja de escuchar al destruirse', () => {
      fixture.destroy();
      cuadros = [];

      mover(150, 25);

      expect(cuadros.length).toBe(0);
    });
  });

  describe('en una pantalla táctil', () => {
    beforeEach(async () => {
      await montar({ reducido: false, punteroFino: false });
    });

    it('no publica nada: sin puntero que seguir, el efecto saltaría en cada toque', () => {
      mover(150, 25);
      dejarQueLaEscenaAlcance();

      expect(escena.getAttribute('style')).toBeNull();
    });
  });

  describe('con «reducir movimiento» activo', () => {
    beforeEach(async () => {
      await montar({ reducido: true, punteroFino: true });
    });

    it('no publica nada: el reposo lo define la hoja de estilos', () => {
      mover(150, 25);
      dejarQueLaEscenaAlcance();

      expect(escena.getAttribute('style')).toBeNull();
    });
  });
});
