import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  isDevMode,
  model,
  output,
} from '@angular/core';

import {
  CHIP_REMOVE_KEYS,
  type ChipSize,
  type ChipVariant,
} from './chip.types';

/**
 * Etiqueta de filtro o faceta. Tres modos, excluyentes por diseño:
 *
 * - **estático**: informa y nada más; no es enfocable.
 * - **removible**: lleva su botón de cierre y emite `removed` (también con
 *   Delete o Backspace, como en cualquier campo de etiquetas).
 * - **seleccionable**: alterna con Enter o Espacio y expone `aria-pressed`.
 *
 * ```html
 * <app-chip variant="info" [removable]="true" label="Cardiología"
 *           (removed)="quitarFiltro('cardiologia')" />
 * <app-chip [selectable]="true" [(selected)]="soloUrgencias" label="Solo urgencias" />
 * ```
 *
 * El tono sale del mapa compartido con el Badge (`tone.css`): los mismos
 * tríos `--st-*`, con `neutral` para las facetas sin significado clínico.
 */
@Component({
  selector: 'app-chip',
  templateUrl: './chip.html',
  styleUrl: './chip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'chipClasses()',
    '[attr.tabindex]': 'isInteractive() ? 0 : null',
    '[attr.role]': 'isSelectable() ? "button" : null',
    '[attr.aria-pressed]': 'isSelectable() ? selected() : null',
    '[attr.aria-label]': 'label() || null',
    '(keydown)': 'handleKeydown($event)',
    '(click)': 'handleClick()',
  },
})
export class Chip {
  readonly variant = input<ChipVariant>('neutral');
  readonly size = input<ChipSize>('md');

  /**
   * Nombre del chip para el lector de pantalla y para el botón de cierre. Con
   * contenido proyectado corto puede omitirse: el texto visible alcanza.
   */
  readonly label = input<string>('');

  readonly removable = input(false, { transform: booleanAttribute });
  readonly selectable = input(false, { transform: booleanAttribute });

  readonly selected = model(false);
  readonly removed = output<void>();

  /** `removable` manda: quitar un filtro es más destructivo que alternarlo. */
  readonly isRemovable = computed(() => this.removable());
  readonly isSelectable = computed(() => this.selectable() && !this.removable());
  protected readonly isInteractive = computed(() => this.isRemovable() || this.isSelectable());

  /** «Quitar Cardiología» dice mucho más que «Quitar». */
  protected readonly removeLabel = computed(() => {
    const label = this.label().trim();
    return label ? `Quitar ${label}` : 'Quitar';
  });

  readonly chipClasses = computed(() => {
    const classes = [
      'chip',
      `chip--${this.size()}`,
      // el tono lo resuelve el mapa compartido con el Badge
      `tone--${this.variant()}`,
    ];
    if (this.isRemovable()) {
      classes.push('chip--removable');
    }
    if (this.isSelectable()) {
      classes.push('chip--selectable');
    }
    if (this.isSelectable() && this.selected()) {
      classes.push('chip--selected');
    }
    return classes.join(' ');
  });

  constructor() {
    if (isDevMode()) {
      afterNextRender(() => this.warnIfBothModes());
    }
  }

  protected remove(): void {
    this.removed.emit();
  }

  protected handleClick(): void {
    if (!this.isSelectable()) {
      return;
    }
    this.selected.update((value) => !value);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (this.isSelectable() && (event.key === 'Enter' || event.key === ' ')) {
      // el Espacio desplaza la página si no se lo frena
      event.preventDefault();
      this.selected.update((value) => !value);
      return;
    }

    const removeKeys: readonly string[] = CHIP_REMOVE_KEYS;
    if (this.isRemovable() && removeKeys.includes(event.key)) {
      event.preventDefault();
      this.remove();
    }
  }

  /** Dos modos a la vez es un error de uso, no una combinación con sentido. */
  private warnIfBothModes(): void {
    if (this.removable() && this.selectable()) {
      console.warn(
        '[app-chip] `removable` y `selectable` son excluyentes: gana `removable`.',
      );
    }
  }
}
