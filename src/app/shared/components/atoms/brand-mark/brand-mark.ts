import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import type { BrandMarkSize, BrandMarkVariant } from './brand-mark.types';

/**
 * La marca ALOVIDA: el isotipo, solo o con su palabra.
 *
 * ```html
 * <app-brand-mark />                          <!-- isotipo, se anuncia «AloVida» -->
 * <app-brand-mark variant="completa" />       <!-- isotipo + «AloVida» -->
 * <app-brand-mark decorative size="sm" />     <!-- dentro de un enlace que ya se nombra -->
 * ```
 *
 * El isotipo se dibuja con la máscara del propio `alovida-logo.svg` sobre
 * `--brand-primary`: toma el color del tema (claro y oscuro) sin un segundo
 * archivo. Antes la misma máscara estaba copiada en `auth-split` y en el
 * armazón; las pantallas de tarjeta (verificar, activar, recuperar…), el error
 * y el 404 no llevaban marca.
 *
 * Es sólo la marca: no navega. Si tiene que llevar al inicio, va dentro de un
 * `<a>` que declare su propio nombre y esta se marca `decorative`.
 */
@Component({
  selector: 'app-brand-mark',
  templateUrl: './brand-mark.html',
  styleUrl: './brand-mark.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'markClasses()',
    '[attr.role]': 'announced() ? "img" : null',
    '[attr.aria-label]': 'announced() ? "AloVida" : null',
  },
})
export class BrandMark {
  readonly variant = input<BrandMarkVariant>('glifo');
  readonly size = input<BrandMarkSize>('md');

  /** Dentro de un enlace con nombre propio: la marca no se anuncia de nuevo. */
  readonly decorative = input(false, { transform: booleanAttribute });

  /**
   * Sólo el isotipo suelto necesita rol: con la palabra, el texto ya es el
   * nombre accesible.
   */
  protected readonly announced = computed(() => this.variant() === 'glifo' && !this.decorative());

  protected readonly markClasses = computed(
    () => `brand-mark brand-mark--${this.variant()} brand-mark--${this.size()}`,
  );
}
