import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';

import { ChatPreferencias } from '../../../../core/messaging/chat-preferencias';

/** Un grupo de emojis, con su rótulo. */
interface Categoria {
  readonly clave: string;
  readonly rotulo: string;
  readonly icono: string;
  readonly emojis: readonly string[];
}

/**
 * Las categorías, escritas a mano.
 *
 * No hay librería y no hace falta: una lista de emojis es una lista de
 * caracteres, y las tres que existen en npm traen un índice de miles de
 * símbolos con nombres en inglés y varios cientos de kilobytes. Esto son
 * ocho filas de texto que cubren lo que la gente usa en un chat de salud.
 */
const CATEGORIAS: readonly Categoria[] = [
  {
    clave: 'caras',
    rotulo: 'Caras y personas',
    icono: '🙂',
    emojis: [
      '😀', '😃', '😄', '😁', '😅', '😂', '🙂', '😊', '😇', '🙃',
      '😉', '😌', '😍', '🥰', '😘', '😗', '😋', '😛', '🤗', '🤔',
      '🤨', '😐', '😑', '😶', '🙄', '😏', '😴', '😪', '😮', '🤐',
      '😯', '😢', '😭', '😱', '😨', '😰', '😥', '😓', '🤯', '😳',
      '🥺', '😤', '😡', '🤬', '😷', '🤒', '🤕', '🤢', '🤧', '🥴',
    ],
  },
  {
    clave: 'gestos',
    rotulo: 'Gestos',
    icono: '👍',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤝', '👏', '🙌', '🙏', '💪',
      '👋', '✋', '🤚', '👊', '☝️', '👉', '👈', '👆', '👇', '🫶',
    ],
  },
  {
    clave: 'corazones',
    rotulo: 'Corazones',
    icono: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💗', '💖',
      '💕', '💞', '💔', '❣️', '💯', '✨', '⭐', '🌟', '🔥', '🎉',
    ],
  },
  {
    clave: 'salud',
    rotulo: 'Salud',
    icono: '🩺',
    emojis: [
      '🩺', '💊', '💉', '🩹', '🩻', '🧪', '🧬', '🦷', '🫀', '🫁',
      '🧠', '🦴', '👩‍⚕️', '👨‍⚕️', '🏥', '🚑', '🧴', '🩸', '📋', '📄',
    ],
  },
  {
    clave: 'tiempo',
    rotulo: 'Tiempo y lugares',
    icono: '🕒',
    emojis: [
      '🕒', '⏰', '📅', '📆', '⌛', '🗓️', '📍', '🏠', '🚗', '🚌',
      '✈️', '☀️', '🌙', '☔', '❄️', '🌡️', '📞', '📱', '💬', '✅',
    ],
  },
  {
    clave: 'comida',
    rotulo: 'Comida',
    icono: '🍎',
    emojis: [
      '🍎', '🍌', '🍇', '🍓', '🥑', '🥦', '🥕', '🍞', '🧀', '🥚',
      '🍗', '🐟', '🍚', '🥗', '💧', '☕', '🍵', '🥛', '🍯', '🧂',
    ],
  },
];

/**
 * El selector de emojis del composer.
 *
 * Con «Recientes» arriba, que en la práctica es la única categoría que se usa:
 * la gente manda cuatro o cinco emojis distintos y los repite. Se guardan en
 * el navegador (`ChatPreferencias`), no en el servidor.
 */
@Component({
  selector: 'app-selector-emojis',
  imports: [],
  template: `
    <div class="emojis">
      <div class="emojis__categorias" role="tablist" aria-label="Categorías de emojis">
        @if (recientes().length > 0) {
          <button
            class="emojis__categoria"
            type="button"
            role="tab"
            [class.is-activa]="categoria() === 'recientes'"
            [attr.aria-selected]="categoria() === 'recientes'"
            aria-label="Recientes"
            (click)="categoria.set('recientes')"
          >
            🕘
          </button>
        }
        @for (grupo of categorias; track grupo.clave) {
          <button
            class="emojis__categoria"
            type="button"
            role="tab"
            [class.is-activa]="categoria() === grupo.clave"
            [attr.aria-selected]="categoria() === grupo.clave"
            [attr.aria-label]="grupo.rotulo"
            (click)="categoria.set(grupo.clave)"
          >
            {{ grupo.icono }}
          </button>
        }
      </div>

      <div class="emojis__rejilla">
        @for (emoji of visibles(); track emoji) {
          <button
            class="emojis__emoji"
            type="button"
            data-testid="composer-emoji"
            [attr.aria-label]="'Insertar ' + emoji"
            (click)="elegir(emoji)"
          >
            {{ emoji }}
          </button>
        }
      </div>
    </div>
  `,
  styleUrl: './selector-emojis.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorEmojis {
  private readonly preferencias = inject(ChatPreferencias);

  readonly elegido = output<string>();

  protected readonly categorias = CATEGORIAS;
  protected readonly recientes = this.preferencias.emojisRecientes;

  protected readonly categoria = signal<string>(
    this.preferencias.emojisRecientes().length > 0 ? 'recientes' : CATEGORIAS[0].clave,
  );

  protected readonly visibles = computed<readonly string[]>(() => {
    if (this.categoria() === 'recientes') {
      return this.recientes();
    }
    return (
      CATEGORIAS.find((grupo) => grupo.clave === this.categoria())?.emojis ?? []
    );
  });

  protected elegir(emoji: string): void {
    this.preferencias.recordarEmoji(emoji);
    this.elegido.emit(emoji);
  }
}
