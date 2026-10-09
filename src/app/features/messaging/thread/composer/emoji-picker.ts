import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { ChatPreferences } from '../../../../core/messaging/chat-preferences';
import {
  GRUPOS_DE_EMOJIS,
  type EmojiDelCatalogo,
} from './emoji-catalog.generated';

/** La pestaña de recientes, que no está en el catálogo porque es de cada uno. */
const RECENT = 'recientes';

/**
 * Cuántos resultados se dibujan al buscar.
 *
 * Con dos letras coinciden cientos, y pintar mil botones por tecleo cuesta más
 * que la búsqueda misma. Nadie recorre el resultado 60: si lo que se busca no
 * está arriba, se escribe otra letra.
 */
const RESULTS_LIMIT = 90;

/** Quita tildes y baja a minúsculas: «corazon» encuentra «corazón». */
function normalize(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase();
}

/**
 * El selector de emojis del composer.
 *
 * ## Qué cambió
 *
 * Eran **150 emojis escritos a mano** en seis categorías, sin forma de buscar:
 * lo que no estaba en la lista no existía. Ahora son **1 946 con nombre en
 * castellano**, generados de Unicode y CLDR (`emoji-catalog.generated.ts`), y
 * se buscan escribiendo —«jeringa», «corazón», «bandera de bolivia»—, que es la
 * única manera de encontrar algo en una lista de ese tamaño.
 *
 * ## Salud primero, recientes antes que todo
 *
 * La primera pestaña son los cuarenta de salud, juntos: en el catálogo completo
 * quedan repartidos entre «Gente», «Objetos» y «Símbolos». Y arriba de esa,
 * cuando hay, los recientes — que en la práctica es la pestaña que se usa: la
 * gente manda cuatro o cinco emojis distintos y los repite.
 */
@Component({
  selector: 'app-emoji-picker',
  imports: [],
  templateUrl: './emoji-picker.html',
  styleUrl: './emoji-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmojiPicker {
  private readonly preferences = inject(ChatPreferences);

  readonly elegido = output<string>();

  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  protected readonly groupList = GRUPOS_DE_EMOJIS;
  protected readonly recent = this.preferences.recentEmojis;

  protected readonly consultation = signal('');

  protected readonly activeGroup = signal<string>(
    this.preferences.recentEmojis().length > 0 ? RECENT : GRUPOS_DE_EMOJIS[0].clave,
  );

  /**
   * Los recientes con su nombre, buscándolos en el catálogo.
   *
   * Se guardan como caracteres sueltos —`ChatPreferencias` no sabe de nombres—,
   * así que el rótulo accesible sale de acá o, si el emoji ya no está en el
   * catálogo, del propio símbolo.
   */
  protected readonly recentWithName = computed<readonly EmojiDelCatalogo[]>(() =>
    this.recent().map(
      (emoji) => bySymbol().get(emoji) ?? { e: emoji, n: emoji, k: '' },
    ),
  );

  /** Lo que se buscó, si se buscó algo. */
  protected readonly results = computed<readonly EmojiDelCatalogo[]>(() => {
    const aguja = normalize(this.consultation().trim());
    if (aguja === '') {
      return [];
    }
    const encontrados: EmojiDelCatalogo[] = [];
    const vistos = new Set<string>();
    // Primero los que **empiezan** con lo escrito: buscando «cara» interesa la
    // cara antes que el gato con cara de algo.
    for (const ronda of [0, 1]) {
      for (const grupo of GRUPOS_DE_EMOJIS) {
        for (const emoji of grupo.emojis) {
          if (vistos.has(emoji.e) || encontrados.length >= RESULTS_LIMIT) {
            continue;
          }
          if (matches(emoji, aguja, ronda === 0)) {
            vistos.add(emoji.e);
            encontrados.push(emoji);
          }
        }
      }
    }
    return encontrados;
  });

  /** `true` si se está buscando —la rejilla muestra resultados, no un grupo—. */
  protected readonly searching = computed(() => this.consultation().trim() !== '');

  /** Lo que se ve en la rejilla ahora mismo. */
  protected readonly visible = computed<readonly EmojiDelCatalogo[]>(() => {
    if (this.searching()) {
      return this.results();
    }
    if (this.activeGroup() === RECENT) {
      return this.recentWithName();
    }
    return (
      GRUPOS_DE_EMOJIS.find((grupo) => grupo.clave === this.activeGroup())?.emojis ?? []
    );
  });

  /** El rótulo de lo que se está mirando, para quien no ve la pestaña activa. */
  protected readonly gridLabel = computed(() => {
    if (this.searching()) {
      const cuantos = this.results().length;
      if (cuantos === 0) {
        return `Sin emojis para «${this.consultation().trim()}»`;
      }
      return cuantos === 1 ? '1 emoji encontrado' : `${cuantos} emojis encontrados`;
    }
    if (this.activeGroup() === RECENT) {
      return 'Recientes';
    }
    return (
      GRUPOS_DE_EMOJIS.find((grupo) => grupo.clave === this.activeGroup())?.rotulo ?? ''
    );
  });

  protected readonly recentKey = RECENT;

  protected toSearch(valor: string): void {
    this.consultation.set(valor);
  }

  protected clearSearch(): void {
    this.consultation.set('');
    this.buscador()?.nativeElement.focus();
  }

  /**
   * Elegir una pestaña **cancela la búsqueda**: si no, se tocaría «Comida» y
   * se seguirían viendo los resultados de lo que había escrito.
   */
  protected chooseGroup(clave: string): void {
    this.consultation.set('');
    this.activeGroup.set(clave);
  }

  protected choose(emoji: string): void {
    this.preferences.rememberEmoji(emoji);
    this.elegido.emit(emoji);
  }
}

/**
 * `true` si el emoji responde a lo buscado.
 *
 * @param soloAlPrincipio - En la primera pasada sólo cuentan las coincidencias
 *   que abren una palabra; en la segunda, cualquiera.
 */
function matches(
  emoji: EmojiDelCatalogo,
  aguja: string,
  soloAlPrincipio: boolean,
): boolean {
  const nombre = normalize(emoji.n);
  if (soloAlPrincipio) {
    return (
      nombre.startsWith(aguja) ||
      nombre.includes(` ${aguja}`) ||
      emoji.k.startsWith(aguja) ||
      emoji.k.includes(`|${aguja}`)
    );
  }
  return nombre.includes(aguja) || emoji.k.includes(aguja);
}

/**
 * El catálogo indexado por símbolo, para ponerle nombre a un reciente.
 *
 * Perezoso y una sola vez: recorrer casi dos mil emojis en cada ciclo de
 * detección de cambios sería pagar el índice entero por cinco recientes.
 */
let index: ReadonlyMap<string, EmojiDelCatalogo> | null = null;
function bySymbol(): ReadonlyMap<string, EmojiDelCatalogo> {
  if (index === null) {
    const mapa = new Map<string, EmojiDelCatalogo>();
    for (const grupo of GRUPOS_DE_EMOJIS) {
      for (const emoji of grupo.emojis) {
        mapa.set(emoji.e, emoji);
      }
    }
    index = mapa;
  }
  return index;
}
