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

import { ChatPreferencias } from '../../../../core/messaging/chat-preferencias';
import {
  GRUPOS_DE_EMOJIS,
  type EmojiDelCatalogo,
} from './emoji-catalog.generated';

/** La pestaña de recientes, que no está en el catálogo porque es de cada uno. */
const RECIENTES = 'recientes';

/**
 * Cuántos resultados se dibujan al buscar.
 *
 * Con dos letras coinciden cientos, y pintar mil botones por tecleo cuesta más
 * que la búsqueda misma. Nadie recorre el resultado 60: si lo que se busca no
 * está arriba, se escribe otra letra.
 */
const TOPE_DE_RESULTADOS = 90;

/** Quita tildes y baja a minúsculas: «corazon» encuentra «corazón». */
function normalizar(texto: string): string {
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
  selector: 'app-selector-emojis',
  imports: [],
  templateUrl: './selector-emojis.html',
  styleUrl: './selector-emojis.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorEmojis {
  private readonly preferencias = inject(ChatPreferencias);

  readonly elegido = output<string>();

  private readonly buscador = viewChild<ElementRef<HTMLInputElement>>('buscador');

  protected readonly grupos = GRUPOS_DE_EMOJIS;
  protected readonly recientes = this.preferencias.emojisRecientes;

  protected readonly consulta = signal('');

  protected readonly grupoActivo = signal<string>(
    this.preferencias.emojisRecientes().length > 0 ? RECIENTES : GRUPOS_DE_EMOJIS[0].clave,
  );

  /**
   * Los recientes con su nombre, buscándolos en el catálogo.
   *
   * Se guardan como caracteres sueltos —`ChatPreferencias` no sabe de nombres—,
   * así que el rótulo accesible sale de acá o, si el emoji ya no está en el
   * catálogo, del propio símbolo.
   */
  protected readonly recientesConNombre = computed<readonly EmojiDelCatalogo[]>(() =>
    this.recientes().map(
      (emoji) => porSimbolo().get(emoji) ?? { e: emoji, n: emoji, k: '' },
    ),
  );

  /** Lo que se buscó, si se buscó algo. */
  protected readonly resultados = computed<readonly EmojiDelCatalogo[]>(() => {
    const aguja = normalizar(this.consulta().trim());
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
          if (vistos.has(emoji.e) || encontrados.length >= TOPE_DE_RESULTADOS) {
            continue;
          }
          if (coincide(emoji, aguja, ronda === 0)) {
            vistos.add(emoji.e);
            encontrados.push(emoji);
          }
        }
      }
    }
    return encontrados;
  });

  /** `true` si se está buscando —la rejilla muestra resultados, no un grupo—. */
  protected readonly buscando = computed(() => this.consulta().trim() !== '');

  /** Lo que se ve en la rejilla ahora mismo. */
  protected readonly visibles = computed<readonly EmojiDelCatalogo[]>(() => {
    if (this.buscando()) {
      return this.resultados();
    }
    if (this.grupoActivo() === RECIENTES) {
      return this.recientesConNombre();
    }
    return (
      GRUPOS_DE_EMOJIS.find((grupo) => grupo.clave === this.grupoActivo())?.emojis ?? []
    );
  });

  /** El rótulo de lo que se está mirando, para quien no ve la pestaña activa. */
  protected readonly rotuloDeLaRejilla = computed(() => {
    if (this.buscando()) {
      const cuantos = this.resultados().length;
      if (cuantos === 0) {
        return `Sin emojis para «${this.consulta().trim()}»`;
      }
      return cuantos === 1 ? '1 emoji encontrado' : `${cuantos} emojis encontrados`;
    }
    if (this.grupoActivo() === RECIENTES) {
      return 'Recientes';
    }
    return (
      GRUPOS_DE_EMOJIS.find((grupo) => grupo.clave === this.grupoActivo())?.rotulo ?? ''
    );
  });

  protected readonly recientesClave = RECIENTES;

  protected alBuscar(valor: string): void {
    this.consulta.set(valor);
  }

  protected limpiarBusqueda(): void {
    this.consulta.set('');
    this.buscador()?.nativeElement.focus();
  }

  /**
   * Elegir una pestaña **cancela la búsqueda**: si no, se tocaría «Comida» y
   * se seguirían viendo los resultados de lo que había escrito.
   */
  protected elegirGrupo(clave: string): void {
    this.consulta.set('');
    this.grupoActivo.set(clave);
  }

  protected elegir(emoji: string): void {
    this.preferencias.recordarEmoji(emoji);
    this.elegido.emit(emoji);
  }
}

/**
 * `true` si el emoji responde a lo buscado.
 *
 * @param soloAlPrincipio - En la primera pasada sólo cuentan las coincidencias
 *   que abren una palabra; en la segunda, cualquiera.
 */
function coincide(
  emoji: EmojiDelCatalogo,
  aguja: string,
  soloAlPrincipio: boolean,
): boolean {
  const nombre = normalizar(emoji.n);
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
let indice: ReadonlyMap<string, EmojiDelCatalogo> | null = null;
function porSimbolo(): ReadonlyMap<string, EmojiDelCatalogo> {
  if (indice === null) {
    const mapa = new Map<string, EmojiDelCatalogo>();
    for (const grupo of GRUPOS_DE_EMOJIS) {
      for (const emoji of grupo.emojis) {
        mapa.set(emoji.e, emoji);
      }
    }
    indice = mapa;
  }
  return indice;
}
