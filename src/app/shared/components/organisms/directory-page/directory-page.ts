import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

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
@Component({
  selector: 'app-directory-page',
  imports: [FilterBar, PageHeader, ResultCard, ViewStateHost],
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

  protected readonly sinCoincidencias = computed(
    () => this.total() === 0 && this.textoSinCoincidencias() !== null,
  );
}
