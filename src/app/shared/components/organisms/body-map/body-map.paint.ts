import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { ZonaDibujable } from './body-map.types';

/** Instance counter: two figures on one page must not share filter ids. */
let nextPaint = 0;

/**
 * The chosen and the told zones, painted on the mannequin's own volume.
 *
 * A flat translucent fill hid the body under it. Here the render itself is
 * clipped to the zone, turned to grey (its light and shade), deepened, and
 * multiplied by the tint: the colour sits on the plaster, and the curve of
 * the muscle shows through it. Decorative: the zone's `aria-*` says the rest.
 */
@Component({
  selector: 'g[app-body-map-paint]',
  templateUrl: './body-map.paint.html',
  styleUrl: './body-map.paint.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class BodyMapPaint {
  /** The render of the view, and its viewBox size. */
  readonly fuente = input.required<string>();
  readonly caja = input.required<readonly [number, number]>();
  /** The zones drawn in this view. */
  readonly zonas = input.required<readonly ZonaDibujable[]>();
  /** The chosen zone id, if any. */
  readonly elegida = input<string | null>(null);
  /** Told zone ids: a coarse id paints every fine zone cut from it. */
  readonly marcadas = input<ReadonlySet<string>>(new Set());

  protected readonly uid = `body-map-pintura-${nextPaint++}`;
  protected readonly tonos = ['elegida', 'marcada'] as const;

  protected readonly dElegida = computed(() => this.zonas().find((z) => z.id === this.elegida())?.d ?? null);

  protected readonly dsMarcadas = computed(() => {
    const ids = this.marcadas();
    return this.zonas()
      .filter((z) => z.id !== this.elegida() && (ids.has(z.id) || ids.has(z.madre)))
      .map((z) => z.d);
  });
}
