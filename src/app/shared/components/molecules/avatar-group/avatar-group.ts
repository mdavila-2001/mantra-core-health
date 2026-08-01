import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { AvatarSize } from '../../atoms/avatar/avatar.types';

/**
 * Apila avatares con superposición. Los avatares se proyectan; el grupo solo
 * los solapa y, si se le pasa `overflow`, agrega el contador `+N`.
 *
 * ```html
 * <app-avatar-group [overflow]="4" size="sm" label="Equipo tratante">
 *   <app-avatar name="Andrea Peña" size="sm" />
 *   <app-avatar name="Bruno Salas" size="sm" />
 * </app-avatar-group>
 * ```
 *
 * El talle se le pasa a cada avatar **y** al grupo: el grupo lo necesita para
 * dimensionar el contador `+N`, que no es un `app-avatar` sino su propio hueco.
 */
@Component({
  selector: 'app-avatar-group',
  templateUrl: './avatar-group.html',
  styleUrl: './avatar-group.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'groupClasses()',
    role: 'group',
    '[attr.aria-label]': 'label() || null',
  },
})
export class AvatarGroup {
  /** Cuántas personas quedaron fuera de la pila; 0 o menos no muestra nada. */
  readonly overflow = input<number>(0);
  readonly size = input<AvatarSize>('md');
  /** Nombra al grupo — sin esto es un montón de imágenes sueltas. */
  readonly label = input<string>('');

  protected readonly showOverflow = computed(() => this.overflow() > 0);
  protected readonly overflowText = computed(() => `+${this.overflow()}`);
  protected readonly overflowLabel = computed(() => `${this.overflow()} personas más`);

  protected readonly groupClasses = computed(
    () => `avatar-group avatar-group--${this.size()}`,
  );
}
