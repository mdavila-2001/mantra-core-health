import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  isDevMode,
} from '@angular/core';

import type { BadgeSize, BadgeValue, BadgeVariant } from './badge.types';

/**
 * Badge de estado o de conteo. Respeta la regla del spec REDSAT: **fondo claro
 * + texto oscuro del mismo tono**, nunca color sólido con texto blanco.
 *
 * ```html
 * <app-badge variant="error" [value]="120" [max]="99" label="alertas activas" />
 * <app-badge variant="success">Vigente</app-badge>
 * <app-badge variant="warning" [dotOnly]="true" label="Requiere revisión" />
 * ```
 *
 * `value` y el contenido proyectado son alternativas: sin `value`, el badge
 * muestra lo que se le proyecte (las etiquetas de estado del M30).
 */
@Component({
  selector: 'app-badge',
  imports: [],
  templateUrl: './badge.html',
  styleUrl: './badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'badgeClasses()',
    // Región viva: un conteo que cambia (mensajes, alertas) debe anunciarse.
    role: 'status',
    '[attr.aria-label]': 'ariaLabel()',
  },
})
export class Badge {
  readonly variant = input<BadgeVariant>('primary');
  readonly size = input<BadgeSize>('md');
  readonly value = input<BadgeValue>(null);

  /** Techo del conteo: por encima se muestra `${max}+`. */
  readonly max = input<number>(99);

  /** Punto sin texto: indicador de estado puro. Exige `label`. */
  readonly dotOnly = input<boolean>(false);

  /**
   * Sustantivo que le da sentido al número («notificaciones no leídas»). Sin
   * él, un lector de pantalla anuncia una cifra suelta.
   */
  readonly label = input<string>('');

  /** El conteo real supera el techo: lo mostrado es una aproximación. */
  readonly isTruncated = computed(() => {
    const raw = this.value();
    return typeof raw === 'number' && raw > this.max();
  });

  readonly displayValue = computed<string>(() => {
    if (this.dotOnly()) {
      return '';
    }
    const raw = this.value();
    if (raw === null) {
      return '';
    }
    if (typeof raw === 'number') {
      return this.isTruncated() ? `${this.max()}+` : String(raw);
    }
    return raw;
  });

  readonly badgeClasses = computed(() => {
    const classes = [
      'badge',
      `badge--${this.variant()}`,
      `badge--${this.size()}`,
      // el tono lo resuelve el mapa compartido con el Chip (`tone.css`)
      `tone--${this.variant()}`,
    ];
    if (this.dotOnly()) {
      classes.push('badge--dot');
    }
    return classes.join(' ');
  });

  /**
   * `null` deja que el nombre accesible salga del contenido visible, que es lo
   * correcto para un badge de texto. Con un conteo se arma una frase explícita:
   * «3 notificaciones no leídas» — o «más de 99 …» cuando está truncado, porque
   * «99+» no se lee bien en voz alta.
   */
  readonly ariaLabel = computed<string | null>(() => {
    const label = this.label().trim();
    if (!label) {
      return null;
    }
    const raw = this.value();
    if (!this.dotOnly() && typeof raw === 'number') {
      return this.isTruncated() ? `más de ${this.max()} ${label}` : `${raw} ${label}`;
    }
    return label;
  });

  constructor() {
    if (isDevMode()) {
      afterNextRender(() => this.warnIfDotWithoutLabel());
    }
  }

  /** Un punto de color sin nombre no existe para quien usa lector de pantalla. */
  private warnIfDotWithoutLabel(): void {
    if (this.dotOnly() && !this.label().trim()) {
      console.warn('[app-badge] dotOnly sin `label`: el estado no tiene nombre accesible.');
    }
  }
}
