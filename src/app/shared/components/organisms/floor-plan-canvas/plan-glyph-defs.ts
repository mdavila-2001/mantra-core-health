import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PLAN_GLYPH_NAMES, PLAN_GLYPH_SHAPES } from './plan-glyphs';

/**
 * Los `<symbol>` de los glifos de estado del plano (CONTRATO-PLANO §5.4): el
 * set de íconos del sistema es de navegación y no los trae. Decorativos
 * (`aria-hidden` en quien los usa): el significado viaja en texto y `aria-label`.
 */
@Component({
  selector: 'defs[app-plan-glyph-defs]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (name of names; track name) {
      <svg:symbol [attr.id]="'plan-g-' + name" viewBox="0 0 16 16">
        @for (shape of shapes[name]; track $index) {
          @switch (shape.t) {
            @case ('path') { <svg:path [attr.d]="shape.d" /> }
            @case ('circle') { <svg:circle [attr.cx]="shape.cx" [attr.cy]="shape.cy" [attr.r]="shape.r" /> }
            @case ('rect') { <svg:rect [attr.x]="shape.x" [attr.y]="shape.y" [attr.width]="shape.w" [attr.height]="shape.h" [attr.rx]="shape.rx" /> }
          }
        }
      </svg:symbol>
    }
  `,
})
export class PlanGlyphDefs {
  protected readonly names = PLAN_GLYPH_NAMES;
  protected readonly shapes = PLAN_GLYPH_SHAPES;
}
