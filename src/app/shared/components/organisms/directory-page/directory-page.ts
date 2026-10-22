import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { ResultCard } from '../../molecules/result-card/result-card';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { FilterBar, type FilterDef } from '../filter-bar/filter-bar';
import { PageHeader } from '../page-header/page-header';
import { ViewStateHost } from '../view-state-host/view-state-host';
import type { GrupoDeDirectorio, SustantivoDelDirectorio } from './directory-page.types';

/**
 * **El patrón único de página de directorio** (A7 del plan de UX del
 * 22/08/2026).
 *
 * ## Por qué existe
 *
 * El cliente pidió cuatro directorios —médicos, laboratorios, clínicas,
 * farmacias— con la misma pinta. Había dos: uno con `filter-bar` y otro con un
 * `search-field` suelto, uno con contador y el otro con un aviso de lista
 * recortada, los dos con listas planas donde el diseño pedía grillas. Con
 * cuatro pantallas escritas a mano, la quinta corrección de diseño se aplica a
 * dos y media.
 *
 * Así que la anatomía se escribe una sola vez: **título, barra de filtros con
 * chips, contador, y una grilla de tarjetas agrupada por secciones**. Los
 * cuatro directorios pasan a ser el mapeo de sus datos a
 * {@link GrupoDeDirectorio} y una lista de {@link FilterDef} — que es lo único
 * en lo que de verdad se diferencian.
 *
 * El criterio de aceptación del plan es literal: «un paciente entra a
 * cualquiera de los cuatro y ve la misma anatomía… sin leer documentación».
 *
 * ## Lo que no hace
 *
 * **No pide datos ni filtra.** Recibe el {@link ViewState} ya resuelto y los
 * grupos ya armados, y emite los filtros cuando cambian. Cada directorio sabe
 * si su filtrado es del servidor (laboratorios, clínicas, farmacias) o en
 * memoria sobre la guía completa (médicos), y eso no se puede unificar sin
 * empeorar a alguno de los dos.
 */
/** Dónde se recuerda la forma elegida: una sola para los cuatro directorios. */
const CLAVE_DE_VISTA = 'alovida.directorio.vista';

/**
 * Cuántas tarjetas se dibujan de entrada y cuántas suma cada «Mostrar más».
 *
 * La guía de médicos llegaba con 804 y las dibujaba todas: 190 000 px de
 * página y varios segundos en blanco antes del primer pintado. 24 llena dos
 * pantallas de escritorio en grilla (3 o 4 por fila) y es divisible por las
 * dos.
 */
const TANDA_POR_DEFECTO = 24;

type Vista = 'grilla' | 'lista';

function vistaGuardada(clave: string): Vista | null {
  try {
    const guardada = globalThis.localStorage?.getItem(clave);
    return guardada === 'lista' || guardada === 'grilla' ? guardada : null;
  } catch {
    // Almacenamiento bloqueado (modo privado, SSR): vale la de por defecto.
    return null;
  }
}

@Component({
  selector: 'app-directory-page',
  imports: [AppButton, FilterBar, PageHeader, ResultCard, ViewStateHost],
  templateUrl: './directory-page.html',
  styleUrl: './directory-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryPage {
  readonly titulo = input.required<string>();

  /**
   * La línea que dice de qué es el directorio.
   *
   * Obligatoria y no opcional (K3 del plan): el `subtitle` del `page-header` es
   * el lugar donde una sección se explica, y dejarlo opcional es cómo tres de
   * las cuatro se quedaron sin él.
   */
  readonly subtitulo = input.required<string>();

  /**
   * Si va embebido en otro contenedor —hoy, el modal de consulta que abre
   * «Tus accesos»—.
   *
   * Con `true` no dibuja su `app-page-header`. El resto de la anatomía no
   * cambia: los mismos filtros, el mismo contador y la misma rejilla, para que
   * el directorio dentro del modal no sea otro directorio.
   */
  readonly embebido = input(false);

  readonly filtros = input<readonly FilterDef[]>([]);
  readonly etiquetaBusqueda = input('Buscar en el directorio');
  /**
   * Lo que se lee dentro del buscador vacío. Por defecto, el mismo
   * `etiquetaBusqueda`: el rótulo del campo no se ve, y un «Buscar» a secas
   * no decía qué se puede escribir ahí.
   */
  readonly searchPlaceholder = input<string | null>(null);

  protected readonly textoDelBuscador = computed(
    () => this.searchPlaceholder() ?? this.etiquetaBusqueda(),
  );

  readonly estado = input.required<ViewState<unknown>>();
  readonly grupos = input.required<readonly GrupoDeDirectorio[]>();
  readonly sustantivo = input.required<SustantivoDelDirectorio>();

  /** Un aviso sobre el listado —«se muestran los primeros…»—, si hace falta. */
  readonly aviso = input<string | null>(null);

  /**
   * Qué decir cuando hay directorio pero el filtro no dejó a nadie.
   *
   * **No es el vacío del `ViewState`**, y la diferencia importa: «este
   * directorio todavía no tiene a nadie» y «tu búsqueda no encontró a nadie»
   * llevan a acciones distintas —esperar, o probar otra palabra—.
   */
  readonly textoSinCoincidencias = input<string | null>(null);

  /**
   * Si se muestra la portada del vertical en vez de la lista.
   *
   * Para los directorios con más de un escalón: la barra de búsqueda está en
   * todos los niveles (pedido del cliente, 19/09/2026), y la portada es lo que
   * se ve mientras no haya nada escrito ni elegido. El vertical proyecta su
   * portada en `[slot=portada]` y decide cuándo toca con esta entrada.
   */
  readonly portada = input(false);

  /** Activa el bloqueo opt-in de navegaciones repetidas en sus tarjetas. */
  readonly preventDuplicateNavigation = input(false);

  /**
   * Grilla o lista. Es un gusto de quien mira y no del directorio, así que se
   * recuerda entre visitas y vale para los cuatro: quien prefiere la lista en
   * farmacias la quiere también en laboratorios.
   */
  /**
   * La forma con que abre cuando nadie eligió todavía. El directorio de
   * médicos abre en lista (propietario, 04/10/2026); el resto, en grilla.
   */
  readonly vistaPorDefecto = input<Vista>('grilla');

  /**
   * Dónde se recuerda la elección. Los médicos tienen la suya: si no, una
   * grilla elegida en farmacias abriría en grilla también la guía de médicos,
   * que tiene que abrir en filas.
   */
  readonly claveDeVista = input(CLAVE_DE_VISTA);

  protected readonly vista = linkedSignal<Vista>(
    () => vistaGuardada(this.claveDeVista()) ?? this.vistaPorDefecto(),
  );

  protected elegirVista(vista: Vista): void {
    this.vista.set(vista);
    try {
      globalThis.localStorage?.setItem(this.claveDeVista(), vista);
    } catch {
      // Sin almacenamiento la elección vale sólo para esta pantalla.
    }
  }

  readonly filtrosCambiaron = output<Readonly<Record<string, string>>>();
  readonly reintentar = output<void>();

  protected readonly total = computed(() =>
    this.grupos().reduce((suma, grupo) => suma + grupo.resultados.length, 0),
  );

  protected readonly contador = computed(() => {
    const cuantos = this.total();
    const { singular, plural } = this.sustantivo();
    return `${cuantos} ${cuantos === 1 ? singular : plural}`;
  });

  /** Cuántas tarjetas suma cada «Mostrar más». */
  readonly tamanoDeTanda = input(TANDA_POR_DEFECTO);

  /**
   * Cuántas tarjetas se dibujan. Vuelve a una tanda cada vez que cambian los
   * grupos —otro filtro, otra búsqueda—: lo abierto de una búsqueda no tiene
   * por qué seguir abierto en la siguiente.
   */
  protected readonly limite = linkedSignal({
    source: this.grupos,
    computation: () => this.tamanoDeTanda(),
  });

  /**
   * Los grupos recortados al límite, en orden, con las tarjetas que entran de
   * cada uno. El grupo viaja entero para que su encabezado siga diciendo
   * cuántos tiene de verdad y no cuántos se ven. Un grupo que quedó todo fuera
   * del límite no se dibuja, ni su encabezado: un rótulo sin tarjetas debajo
   * parece un tramo vacío.
   */
  protected readonly gruposVisibles = computed(() => {
    let quedan = this.limite();
    const visibles: { grupo: GrupoDeDirectorio; resultados: GrupoDeDirectorio['resultados'] }[] =
      [];
    for (const grupo of this.grupos()) {
      if (quedan <= 0) {
        break;
      }
      const resultados = grupo.resultados.slice(0, quedan);
      quedan -= resultados.length;
      visibles.push({ grupo, resultados });
    }
    return visibles;
  });

  protected readonly mostrados = computed(() => Math.min(this.limite(), this.total()));

  protected readonly restantes = computed(() => this.total() - this.mostrados());

  /**
   * «Mostrar 24 más», o los que queden si son menos. Sin el sustantivo: el de
   * varios directorios es «clínicas encontradas», y la línea de progreso, justo
   * encima, ya dice de qué son.
   */
  protected readonly textoMostrarMas = computed(
    () => `Mostrar ${Math.min(this.tamanoDeTanda(), this.restantes())} más`,
  );

  /** «Se muestran 24 de 804 médicos». */
  protected readonly textoProgreso = computed(() => {
    const { plural } = this.sustantivo();
    return `Se muestran ${this.mostrados()} de ${this.total()} ${plural}.`;
  });

  protected mostrarMas(): void {
    this.limite.update((actual) => actual + this.tamanoDeTanda());
  }

  protected readonly sinCoincidencias = computed(
    () => this.total() === 0 && this.textoSinCoincidencias() !== null,
  );
}
