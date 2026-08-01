import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  isDevMode,
} from '@angular/core';

import type { DividerOrientation } from './divider.types';

/**
 * Separador de secciones. En un formulario largo —una anamnesis, una orden con
 * varios ítems— el corte **es** información: agrupa lo que se lee junto.
 *
 * ```html
 * <app-divider />
 * <app-divider label="Antecedentes" />
 * <app-divider orientation="vertical" />
 * ```
 *
 * El label solo existe en horizontal: un rótulo dentro de una línea vertical
 * no tiene dónde acostarse sin rotar el texto.
 */
@Component({
  selector: 'app-divider',
  templateUrl: './divider.html',
  styleUrl: './divider.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'dividerClasses()',
    role: 'separator',
    '[attr.aria-orientation]': 'orientation()',
    '[attr.aria-label]': 'visibleLabel() || null',
  },
})
export class Divider {
  readonly orientation = input<DividerOrientation>('horizontal');

  /** Rótulo del corte («Antecedentes», «Indicaciones»). Solo en horizontal. */
  readonly label = input<string>('');

  protected readonly visibleLabel = computed(() =>
    this.orientation() === 'horizontal' ? this.label().trim() : '',
  );

  readonly dividerClasses = computed(() => {
    const classes = ['divider', `divider--${this.orientation()}`];
    if (this.visibleLabel()) {
      classes.push('divider--labelled');
    }
    return classes.join(' ');
  });

  constructor() {
    if (isDevMode()) {
      afterNextRender(() => this.warnIfVerticalWithLabel());
    }
  }

  private warnIfVerticalWithLabel(): void {
    if (this.orientation() === 'vertical' && this.label().trim()) {
      console.warn(
        '[app-divider] `label` se ignora en orientación vertical: no hay dónde escribirlo.',
      );
    }
  }
}
