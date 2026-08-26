import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';

import { AVATAR_TONES, type AvatarSize, type AvatarStatus, type AvatarTone } from './avatar.types';

/** Cuántas letras se muestran como iniciales. */
const MAX_INITIALS = 2;

/** Semilla del hash — primo chico, clásico de djb2. Solo tiene que ser estable. */
const HASH_SEED = 5381;
const HASH_SHIFT = 5;

/**
 * Avatar de persona con degradación en cascada: foto → iniciales → silueta.
 *
 * El color de fondo **no es aleatorio**: sale de un hash determinista del
 * nombre, así la misma persona tiene siempre el mismo color en toda la app y
 * entre sesiones — sin guardar nada.
 *
 * ```html
 * <app-avatar name="Andrea Peña" size="lg" status="online" />
 * <app-avatar [src]="foto()" name="Andrea Peña" alt="Foto de Andrea Peña" />
 * ```
 */
@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
  styleUrl: './avatar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
    role: 'img',
    '[attr.aria-label]': 'accessibleName()',
  },
})
export class Avatar {
  readonly src = input<string | null>(null);
  readonly name = input<string>('');
  readonly initials = input<string | null>(null);
  readonly size = input<AvatarSize>('md');
  readonly status = input<AvatarStatus>('none');
  readonly alt = input<string>('Avatar de usuario');

  /**
   * Una foto rota no puede dejar un hueco: activa el fallback a iniciales.
   *
   * `linkedSignal` y no `signal`: si sólo se apagara con `set(true)` en el
   * error, un avatar que falló una vez quedaba en iniciales para siempre,
   * aunque después llegara un `src` nuevo y válido — exactamente lo que pasa
   * en una lista de conversaciones que reutiliza la misma instancia del
   * componente al reordenarse. Al recalcular en `false` cada vez que cambia
   * `src`, cada foto nueva tiene su propia oportunidad.
   */
  protected readonly imageFailed = linkedSignal({
    source: this.src,
    computation: () => false,
  });

  protected readonly computedInitials = computed(() => {
    const explicit = this.initials()?.trim();
    if (explicit) {
      return explicit.slice(0, MAX_INITIALS).toUpperCase();
    }
    return initialsFromName(this.name());
  });

  /**
   * Tono determinista: el mismo nombre siempre cae en el mismo color.
   * Sin nombre no hay a qué anclarse, así que se usa el primero — un avatar
   * anónimo no debería cambiar de color entre renders.
   */
  protected readonly tone = computed<AvatarTone>(() => {
    const name = this.name().trim();
    if (!name) {
      return AVATAR_TONES[0];
    }
    return AVATAR_TONES[hashString(name) % AVATAR_TONES.length];
  });

  protected readonly showImage = computed(() => Boolean(this.src()) && !this.imageFailed());
  protected readonly showInitials = computed(
    () => !this.showImage() && this.computedInitials().length > 0,
  );
  protected readonly showSilhouette = computed(
    () => !this.showImage() && !this.showInitials(),
  );

  protected readonly hostClasses = computed(() => {
    const classes = ['avatar', `avatar--${this.size()}`, `avatar--${this.tone()}`];
    if (this.status() !== 'none') {
      classes.push('avatar--with-status');
    }
    return classes.join(' ');
  });

  /**
   * El host lleva `role="img"`, así que necesita un nombre: el `alt` cuando hay
   * foto, y si no el nombre de la persona. La presencia se suma al nombre
   * porque un punto de color no la comunica por sí solo.
   */
  protected readonly accessibleName = computed(() => {
    const base = this.showImage() ? this.alt() : this.name().trim() || this.alt();
    switch (this.status()) {
      case 'online':
        return `${base}, en línea`;
      case 'offline':
        return `${base}, desconectado`;
      default:
        return base;
    }
  });

  protected handleImageError(): void {
    this.imageFailed.set(true);
  }
}

/** «Andrea Peña» → «AP»; «Andrea» → «A». Ignora partículas y espacios de más. */
function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const picked = words.length === 1 ? words.slice(0, 1) : [words[0], words[words.length - 1]];
  return picked
    .map((word) => [...word][0] ?? '')
    .join('')
    .slice(0, MAX_INITIALS)
    .toUpperCase();
}

/** djb2. No es criptográfico: solo tiene que ser estable y repartir parejo. */
function hashString(value: string): number {
  let hash = HASH_SEED;
  for (const char of value) {
    hash = (hash << HASH_SHIFT) + hash + char.codePointAt(0)!;
    // Se mantiene en 32 bits con signo para que no se desborde a float.
    hash |= 0;
  }
  return Math.abs(hash);
}
