import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DesplazamientoDelLienzo } from './desplazamiento-del-lienzo';

/** A box at `top` of `height`, as the browser would measure it. */
const caja = (top: number, height: number): DOMRect => ({ top, bottom: top + height, height, left: 0, right: 800, width: 800, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

describe('DesplazamientoDelLienzo: the axis follows the page under the app header', () => {
  let header: HTMLElement;
  let marco: HTMLElement;
  let lienzo: HTMLElement;
  let topeDelLienzo = 300;

  beforeEach(() => {
    topeDelLienzo = 300;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
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
    header.remove();
    marco.remove();
    vi.unstubAllGlobals();
  });

  const desplazarA = (top: number): void => {
    topeDelLienzo = top;
    document.dispatchEvent(new Event('scroll'));
  };

  it('stays put while the canvas is below the header', () => {
    new DesplazamientoDelLienzo(() => lienzo).fijarAlFinal(lienzo);
    expect(marco.style.getPropertyValue('--red-eje-y')).toBe('0px');
    expect(marco.hasAttribute('data-eje-pegado')).toBe(false);
  });

  it('once the canvas goes under the header, the axis sits right below it, 14 px of room above', () => {
    new DesplazamientoDelLienzo(() => lienzo).fijarAlFinal(lienzo);
    desplazarA(-200);
    // Header bottom (64) minus canvas top (-200), plus the jumps' 16 px band.
    expect(marco.style.getPropertyValue('--red-eje-y')).toBe('280px');
    expect(marco.hasAttribute('data-eje-pegado')).toBe(true);
  });

  it('stops at the canvas bottom and never runs over what follows', () => {
    new DesplazamientoDelLienzo(() => lienzo).fijarAlFinal(lienzo);
    desplazarA(-2000);
    // 900 tall canvas, minus the 76 px axis and its 16 px band.
    expect(marco.style.getPropertyValue('--red-eje-y')).toBe('808px');
  });

  it('lets go of the page when released', () => {
    const d = new DesplazamientoDelLienzo(() => lienzo);
    d.fijarAlFinal(lienzo);
    d.soltar();
    desplazarA(-200);
    expect(marco.style.getPropertyValue('--red-eje-y')).toBe('0px');
  });
});
