import { ChangeDetectionStrategy, Component, signal, type TemplateRef, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { TooltipPanel } from './tooltip-panel';
import type { TooltipPosition } from './tooltip.types';

/**
 * El globo del tooltip: rol `tooltip`, el id que referencia el disparador
 * (`aria-describedby`), la posición calculada en px y, si se le pasa una
 * plantilla, contenido rico en lugar del texto.
 */

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipPanel],
  template: `
    <ng-template #rico><strong class="rico">Rico</strong></ng-template>
    <app-tooltip-panel text="Ayuda" panelId="tip-1" [position]="posicion()" [top]="12" [left]="34" [template]="usarRico() ? plantilla() : null" />
  `,
})
class Host {
  readonly posicion = signal<TooltipPosition>('top');
  readonly usarRico = signal(false);
  readonly plantilla = viewChild.required<TemplateRef<unknown>>('rico');
}

describe('TooltipPanel', () => {
  let fixture: ComponentFixture<Host>;
  const panel = (): HTMLElement => (fixture.nativeElement as HTMLElement).querySelector('app-tooltip-panel')!;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('es un tooltip con id, posición y texto', () => {
    expect(panel().getAttribute('role')).toBe('tooltip');
    expect(panel().id).toBe('tip-1');
    expect(panel().style.top).toBe('12px');
    expect(panel().style.left).toBe('34px');
    expect(panel().textContent?.trim()).toBe('Ayuda');
    expect(panel().className).toContain('tooltip--top');
  });

  it('la clase sigue a la posición', () => {
    fixture.componentInstance.posicion.set('bottom');
    fixture.detectChanges();
    expect(panel().className).toContain('tooltip--bottom');
  });

  it('con plantilla pinta el contenido rico en lugar del texto', () => {
    fixture.componentInstance.usarRico.set(true);
    fixture.detectChanges();

    expect(panel().querySelector('.rico')?.textContent).toBe('Rico');
    expect(panel().textContent).not.toContain('Ayuda');
    expect(panel().className).toContain('tooltip--rich');
  });
});
