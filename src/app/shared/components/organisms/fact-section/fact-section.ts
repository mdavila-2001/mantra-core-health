import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';

import { Chip } from '../../atoms/chip/chip';
import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';
import { Card } from '../../molecules/card/card';
import { FactList } from '../../molecules/fact-list/fact-list';
import { Pagination } from '../../molecules/pagination/pagination';
import { SearchField } from '../../molecules/search-field/search-field';
import { SectionHeading } from '../../molecules/section-heading/section-heading';
import {
  BLOQUES_POR_PAGINA,
  MINIMO_PARA_BUSCAR,
  type BloqueDeFicha,
} from './fact-section.types';

/** Un chip del filtro, ya con cuántos bloques tiene detrás. */
interface ChipDeSeccion {
  readonly etiqueta: string;
  readonly cuantos: number;
}

/**
 * Una sección de ficha: la card con su encabezado, su buscador, sus filtros,
 * su rejilla de bloques y su paginador.
 *
 * ```html
 * <app-fact-section
 *   icono="scan"
 *   titulo="Equipos"
 *   [bloques]="equipos()"
 *   [columnas]="2"
 * />
 * ```
 *
 * ## Qué reemplaza
 *
 * Cada sección de una ficha se escribía a mano: una `app-card`, un encabezado,
 * un `@for` y una `app-fact-list` por elemento. Cuatro secciones eran cuatro
 * copias de la misma estructura, y ninguna sabía pararse: un laboratorio con
 * cuarenta equipos dibujaba los cuarenta, la card medía dos pantallas y la
 * sección de abajo —«Acreditaciones»— quedaba donde nadie llega.
 *
 * Acá eso pasa a ser un solo componente que además hace las tres cosas que una
 * lista larga necesita y que nadie iba a escribir cuatro veces: buscar, acotar
 * y paginar.
 *
 * ## Los tres controles aparecen **sólo cuando sirven**
 *
 * Es la misma regla que el resto del producto: un control que no acota nada no
 * es un pendiente visual, es una respuesta equivocada a una pregunta que la
 * persona sí hizo.
 *
 * - El **buscador**, a partir de {@link MINIMO_PARA_BUSCAR} bloques. Con menos
 *   ya se ven todos, y buscar sobre lo que está entero en pantalla no ahorra
 *   nada.
 * - Los **chips**, sólo si hay más de una etiqueta distinta. Con una sola, el
 *   chip selecciona «todo» y deseleccionado muestra «todo»: dos estados que se
 *   ven distintos y hacen lo mismo.
 * - El **paginador**, sólo si lo que quedó tras buscar y filtrar no entra en una
 *   página.
 *
 * ## Por qué la rejilla lleva las celdas a la misma altura
 *
 * Porque son fichas del mismo tipo puestas a comparar. Con altura libre, el
 * equipo que declara su calibración queda más alto que el que no, y la fila se
 * lee como un serrucho donde la vista no encuentra dónde empieza el dato
 * siguiente. `grid-auto-rows: 1fr` iguala la fila; ver la hoja de estilos.
 */
@Component({
  selector: 'app-fact-section',
  imports: [Card, Chip, FactList, Pagination, SearchField, SectionHeading],
  templateUrl: './fact-section.html',
  styleUrl: './fact-section.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'seccion-ficha' },
})
export class FactSection {
  readonly icono = input.required<NavIconName>();
  readonly titulo = input.required<string>();
  readonly bloques = input.required<readonly BloqueDeFicha[]>();

  /**
   * En cuántas columnas se reparten los bloques en una pantalla ancha.
   *
   * `1` para las secciones que van en media ficha —dos cards una al lado de la
   * otra— y `2` para las que ocupan el ancho entero. No hay `3`: con tres
   * columnas la tabla campo → valor pierde la columna del campo y los pares se
   * apilan, que es volver a la pila de líneas grises que esto vino a arreglar.
   */
  readonly columnas = input<1 | 2>(1);

  /** Cuántos bloques por página. */
  readonly porPagina = input<number>(BLOQUES_POR_PAGINA);

  /**
   * Fuerza el buscador aunque haya pocos bloques.
   *
   * Existe para la sección que se sabe que va a crecer y donde el control tiene
   * que estar desde el primer día; no para encenderlo «por las dudas».
   */
  readonly conBuscador = input(false, { transform: booleanAttribute });

  protected readonly termino = signal('');
  protected readonly etiquetaElegida = signal<string | null>(null);
  protected readonly pagina = signal(1);

  /** El buscador se dibuja cuando de verdad hay algo que buscar. */
  protected readonly muestraBuscador = computed(
    () => this.conBuscador() || this.bloques().length >= MINIMO_PARA_BUSCAR,
  );

  /**
   * Los chips: las etiquetas que de verdad tienen bloques detrás, con su
   * recuento y ordenadas por cuántos hay.
   *
   * Se cuentan sobre **todos** los bloques y no sobre los ya filtrados: contar
   * con el filtro puesto dejaría a los otros chips en cero, o sea la sección
   * diciendo que sólo hay elementos donde uno acaba de pulsar.
   */
  protected readonly chips = computed<readonly ChipDeSeccion[]>(() => {
    const cuenta = new Map<string, number>();
    for (const bloque of this.bloques()) {
      for (const etiqueta of bloque.etiquetas ?? []) {
        cuenta.set(etiqueta, (cuenta.get(etiqueta) ?? 0) + 1);
      }
    }
    if (cuenta.size < 2) {
      return [];
    }
    return [...cuenta.entries()]
      .map(([etiqueta, cuantos]) => ({ etiqueta, cuantos }))
      .sort((a, b) => b.cuantos - a.cuantos || a.etiqueta.localeCompare(b.etiqueta, 'es'));
  });

  /** Lo que queda tras buscar y acotar. Es sobre esto que se pagina. */
  protected readonly filtrados = computed<readonly BloqueDeFicha[]>(() => {
    const termino = normalizar(this.termino());
    const etiqueta = this.etiquetaElegida();
    return this.bloques().filter((bloque) => {
      if (etiqueta !== null && !(bloque.etiquetas ?? []).includes(etiqueta)) {
        return false;
      }
      return termino === '' || textoDe(bloque).includes(termino);
    });
  });

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.filtrados().length / Math.max(1, this.porPagina()))),
  );

  /**
   * La página que se dibuja: la pedida, recortada al rango real.
   *
   * Recortar acá y no sólo al filtrar es lo que evita la pantalla en blanco:
   * estar en la página 4 y escribir en el buscador deja tres resultados y una
   * página 4 que no existe.
   */
  protected readonly paginaActual = computed(() =>
    Math.min(this.totalPaginas(), Math.max(1, this.pagina())),
  );

  protected readonly visibles = computed<readonly BloqueDeFicha[]>(() => {
    const desde = (this.paginaActual() - 1) * this.porPagina();
    return this.filtrados().slice(desde, desde + this.porPagina());
  });

  protected readonly hayPaginador = computed(() => this.totalPaginas() > 1);

  /**
   * El recuento del encabezado: cuántos hay, o cuántos quedaron.
   *
   * Con filtros puestos dice los dos números —«3 de 12»— porque el primero solo
   * haría creer que la sección tiene tres, y el segundo solo escondería que hay
   * un filtro activo.
   */
  protected readonly leyenda = computed(() => {
    const total = this.bloques().length;
    const quedan = this.filtrados().length;
    return quedan === total ? `${total}` : `${quedan} de ${total}`;
  });

  protected readonly sinCoincidencias = computed(
    () => this.bloques().length > 0 && this.filtrados().length === 0,
  );

  constructor() {
    // Buscar o acotar **vuelve a la página 1**: quedarse en la 3 tras un filtro
    // que deja cuatro elementos deja a quien filtró mirando un hueco. Se lee el
    // resultado del filtro y no las señales de entrada para que la vuelta
    // ocurra también cuando cambian los bloques de afuera.
    effect(() => {
      this.filtrados();
      this.pagina.set(1);
    });
  }

  /** Pulsar el chip activo lo apaga: es un interruptor, no un grupo de radios. */
  protected alternarEtiqueta(etiqueta: string): void {
    this.etiquetaElegida.update((actual) => (actual === etiqueta ? null : etiqueta));
  }

  protected limpiar(): void {
    this.termino.set('');
    this.etiquetaElegida.set(null);
  }
}

/** Baja a minúsculas y quita tildes, para que «Análisis» case con «analisis». */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Todo el texto por el que un bloque se puede encontrar.
 *
 * Incluye los **valores** de la tabla y no sólo el título: quien busca
 * «Sysmex» busca un modelo, que es un valor; y quien busca «mantenimiento»
 * busca un estado. Un buscador que sólo mirara el nombre no encontraría
 * ninguno de los dos y parecería roto.
 */
function textoDe(bloque: BloqueDeFicha): string {
  const partes = [bloque.titulo, bloque.nota ?? '', ...(bloque.etiquetas ?? [])];
  for (const hecho of bloque.hechos) {
    partes.push(hecho.etiqueta, hecho.valor ?? '');
  }
  return normalizar(partes.join(' '));
}
