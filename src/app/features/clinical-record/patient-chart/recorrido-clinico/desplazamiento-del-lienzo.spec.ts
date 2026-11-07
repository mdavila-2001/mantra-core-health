import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DesplazamientoDelLienzo } from './desplazamiento-del-lienzo';

/** A box at `top` of `height`, as the browser would measure it. */
const caja = (top: number, height: number): DOMRect => ({ top, bottom: top + height, height, left: 0, right: 800, width: 800, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

describe('DesplazamientoDelLienzo: the axis follows the page under the app header', () => {
  let header: HTMLElement;
  let marco: HTMLElement;
  let lienzo: HTMLElement;
  let topeDelLienzo = 300;
  let creados: DesplazamientoDelLienzo[] = [];
  const nuevo = (): DesplazamientoDelLienzo => {
    const d = new DesplazamientoDelLienzo(() => lienzo);
    creados.push(d);
    return d;
  };

  beforeEach(() => {
    topeDelLienzo = 300;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    // These cases are about where the axis lands, not about frame batching: the frame runs at once.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    header = document.createElement('header');
    header.setAttribute('app-header', '');
    header.getBoundingClientRect = () => caja(0, 64);
    marco = document.createElement('div');
    lienzo = document.createElement('div');
    const eje = document.createElement('ol');
    eje.className = 'red__eje';
    Object.defineProperty(eje, 'offsetHeight', { value: 76 });
    lienzo.append(eje);
    lienzo.getBoundingClientRect = () => caja(topeDelLienzo, 900);
    marco.append(lienzo);
    document.body.append(header, marco);
  });

  afterEach(() => {
    creados.forEach((d) => d.soltar());
    creados = [];
    header.remove();
    marco.remove();
    vi.unstubAllGlobals();
  });

  const desplazarA = (top: number): void => {
    topeDelLienzo = top;
    document.dispatchEvent(new Event('scroll'));
  };

  it('stays put while the canvas is below the header', () => {
    nuevo().fijarAlFinal(lienzo);
    expect(marco.style.getPropertyValue('--red-eje-y')).toBe('0px');
    expect(marco.hasAttribute('data-eje-pegado')).toBe(false);
  });

  it('once the canvas goes under the header, the axis sits right below it, 14 px of room above', () => {
    nuevo().fijarAlFinal(lienzo);
    desplazarA(-200);
    // Header bottom (64) minus canvas top (-200), plus the jumps' 16 px band.
    expect(marco.style.getPropertyValue('--red-eje-y')).toBe('280px');
    expect(marco.hasAttribute('data-eje-pegado')).toBe(true);
  });

  it('stops at the canvas bottom and never runs over what follows', () => {
    nuevo().fijarAlFinal(lienzo);
    desplazarA(-2000);
    // 900 tall canvas, minus the 76 px axis and its 16 px band.
    expect(marco.style.getPropertyValue('--red-eje-y')).toBe('808px');
  });

  it('lets go of the page when released', () => {
    const d = nuevo();
    d.fijarAlFinal(lienzo);
    d.soltar();
    desplazarA(-200);
    expect(marco.style.getPropertyValue('--red-eje-y')).toBe('0px');
  });
});

describe('DesplazamientoDelLienzo: scroll is measured once per frame', () => {
  let cuadros: FrameRequestCallback[];
  let marco: HTMLElement;
  let lienzo: HTMLElement;
  let lecturas: number;
  let creados: DesplazamientoDelLienzo[];

  const crear = (): DesplazamientoDelLienzo => {
    const d = new DesplazamientoDelLienzo(() => lienzo);
    creados.push(d);
    d.fijarAlFinal(lienzo);
    return d;
  };

  beforeEach(() => {
    cuadros = [];
    creados = [];
    lecturas = 0;
    vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => cuadros.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    marco = document.createElement('div');
    lienzo = document.createElement('div');
    lienzo.getBoundingClientRect = () => {
      lecturas += 1;
      return caja(300, 900);
    };
    Object.defineProperty(lienzo, 'clientWidth', { value: 800 });
    marco.append(lienzo);
    document.body.append(marco);
  });

  afterEach(() => {
    creados.forEach((d) => d.soltar());
    marco.remove();
    vi.unstubAllGlobals();
  });

  const pasarCuadro = (): void => cuadros.splice(0).forEach((cb) => cb(0));

  it('many canvas scroll events in one frame update the view once, with the last position', () => {
    const d = crear();
    for (const x of [10, 20, 30]) {
      lienzo.scrollLeft = x;
      lienzo.dispatchEvent(new Event('scroll'));
    }
    expect(cuadros).toHaveLength(1);
    pasarCuadro();
    expect(d.ventana()).toEqual({ desde: 30, hasta: 830 });
  });

  it('the canvas own sideways scroll does not measure the axis again', () => {
    crear();
    const antes = lecturas;
    lienzo.dispatchEvent(new Event('scroll'));
    pasarCuadro();
    expect(lecturas).toBe(antes);
  });

  it('releasing cancels the measurement still waiting for its frame', () => {
    const d = crear();
    lienzo.dispatchEvent(new Event('scroll'));
    d.soltar();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
