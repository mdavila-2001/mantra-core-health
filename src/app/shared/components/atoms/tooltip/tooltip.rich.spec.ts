import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { Rect } from './floating-placement';
import { Tooltip } from './tooltip';
import { TOOLTIP_CLOSE_DELAY_MS, TOOLTIP_HOVER_DELAY_MS } from './tooltip.types';

@Component({
  imports: [Tooltip],
  template: `
    <button
      type="button"
      appTooltip="Ficha del espacio"
      [appTooltipShift]="true"
      [appTooltipHoverable]="hoverable()"
      [appTooltipAnchor]="anchor()"
    >
      Espacio
    </button>
  `,
})
class RichHost {
  readonly hoverable = signal(true);
  readonly anchor = signal<Rect | null>(null);
}

/**
 * El modo rico del Tooltip (CONTRATO-PLANO §5.6, WCAG 2.1 SC 1.4.13): hoverable,
 * descartable con Escape, con `shift` y con ancla propia. El globo simple sigue
 * cubierto por `tooltip.spec.ts`, sin tocar.
 */
describe('Tooltip · modo rico', () => {
  let fixture: ComponentFixture<RichHost>;

  const host = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');
  const globo = (): HTMLElement | null => document.body.querySelector('app-tooltip-panel');

  function fijarRectangulo(rect: Partial<DOMRect>): void {
    const v = { top: 300, bottom: 340, left: 200, right: 260, width: 60, height: 40, ...rect };
    host().getBoundingClientRect = (): DOMRect => ({ ...v, x: v.left, y: v.top, toJSON: () => v });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RichHost] }).compileComponents();
    fixture = TestBed.createComponent(RichHost);
    await fixture.whenStable();
    fijarRectangulo({});
    // Con el montaje hecho, el reloj pasa a ser falso: antes, `whenStable` esperaría un reloj que no avanza.
    vi.useFakeTimers();
  });
  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  async function abrir(): Promise<void> {
    host().dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS);
    await fixture.whenStable();
  }

  it('hoverable: al salir del control el globo sigue ahí y el puntero puede llegar a él', async () => {
    await abrir();
    host().dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY_MS / 2);
    expect(globo()).not.toBeNull();
    globo()!.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY_MS * 5);
    expect(globo()).not.toBeNull();
    globo()!.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY_MS);
    expect(globo()).toBeNull();
  });

  it('hoverable: si el puntero no llega al globo, se cierra tras el puente de 200 ms', async () => {
    await abrir();
    host().dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(TOOLTIP_CLOSE_DELAY_MS);
    expect(globo()).toBeNull();
  });

  it('hoverable: Escape en cualquier parte del documento lo descarta sin mover el foco', async () => {
    await abrir();
    host().focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(globo()).toBeNull();
    expect(document.activeElement).toBe(host());
  });

  it('hoverable: el globo recibe el puntero; sin hoverable, nunca', async () => {
    await abrir();
    expect(globo()!.className).toContain('tooltip--hoverable');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(globo()).toBeNull();
    fixture.componentInstance.hoverable.set(false);
    fixture.detectChanges();
    await abrir();
    expect(globo()!.className).not.toContain('tooltip--hoverable');
  });

  it('con ancla propia se ubica junto a ella y no junto al host', async () => {
    fixture.componentInstance.anchor.set({ left: 600, top: 500, width: 10, height: 10 });
    fixture.detectChanges();
    await abrir();
    const left = parseFloat(globo()!.style.left);
    // jsdom no mide: el globo mide 0 × 0, así que queda centrado sobre el ancla (605) y no sobre el host (230).
    expect(Math.abs(left - 605)).toBeLessThan(5);
  });
});
