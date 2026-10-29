import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PLAN_GLYPH_SHAPES, type ExtraGlyph } from './plan-glyphs';

/** Glifo de estado en línea (16 × 16, trazo `currentColor`), para la tarjeta, la leyenda y la lista. Decorativo. */
@Component({
  selector: 'app-plan-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'plan-glyph', 'aria-hidden': 'true' },
  styles: `
    :host { display: inline-flex; width: 1em; height: 1em; flex: none; }
    svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; overflow: visible; }
  `,
  template: `
    <svg viewBox="0 0 16 16" focusable="false">
      @for (shape of shapes(); track $index) {
        @switch (shape.t) {
          @case ('path') { <svg:path [attr.d]="shape.d" /> }
          @case ('circle') { <svg:circle [attr.cx]="shape.cx" [attr.cy]="shape.cy" [attr.r]="shape.r" /> }
          @case ('rect') { <svg:rect [attr.x]="shape.x" [attr.y]="shape.y" [attr.width]="shape.w" [attr.height]="shape.h" [attr.rx]="shape.rx" /> }
        }
      }
    </svg>
  `,
})
export class PlanGlyphIcon {
  readonly name = input.required<ExtraGlyph>();
  protected readonly shapes = computed(() => PLAN_GLYPH_SHAPES[this.name()]);
}
