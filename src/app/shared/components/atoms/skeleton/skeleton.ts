import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SKELETON_LAST_LINE_WIDTH, type SkeletonVariant } from './skeleton.types';

/**
 * Silueta de carga: el hueco que va a ocupar el contenido mientras llega
 * (estado UX **S8**). Cero lógica — es CSS con inputs.
 *
 * ```html
 * <app-skeleton variant="text" [lines]="3" />
 * <app-skeleton variant="circle" width="40px" />
 * <app-skeleton variant="rect" height="180px" />
 * ```
 *
 * **Nunca se anuncia** (`aria-hidden`): un lector de pantalla leyendo cinco
 * cajas vacías no informa nada. Quien lo monta es el responsable de declarar
 * la carga —`aria-busy` en el contenedor, o un `role="status"` con el texto
 * «Cargando…»— igual que el botón hace con su spinner.
 */
@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'skeletonClasses()',
    'aria-hidden': 'true',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
})
export class Skeleton {
  readonly variant = input<SkeletonVariant>('text');

  /** Medidas CSS crudas (`'40px'`, `'100%'`): el hueco lo dicta quien lo usa. */
  readonly width = input<string | null>(null);
  readonly height = input<string | null>(null);

  /** Solo en `text`: cuántas líneas simular. */
  readonly lines = input<number>(1);

  protected readonly lineWidths = computed<readonly string[]>(() => {
    if (this.variant() !== 'text') {
      return [];
    }
    const total = Math.max(1, Math.trunc(this.lines()));
    return Array.from({ length: total }, (_, index) =>
      index === total - 1 && total > 1 ? SKELETON_LAST_LINE_WIDTH : '100%',
    );
  });

  readonly skeletonClasses = computed(() => `skeleton skeleton--${this.variant()}`);
}
