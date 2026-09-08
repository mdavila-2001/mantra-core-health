import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavigationService } from '../../core/navigation/navigation.service';
import { NAV_SUBGROUPS } from '../../core/navigation/navigation.subgroups';
import { routeOf, type AppSection } from '../../core/navigation/navigation.types';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Rótulo del bloque de `navigation.subgroups.ts` del que salen los nodos. */
const BLOQUE = 'Directorios';

/**
 * La ruta de esta misma portada.
 *
 * `NAV_SUBGROUPS` la incluye a propósito —para que quede en el mismo bloque
 * que agrupa (ver el comentario ahí)—, así que hay que descartarla acá: un
 * nodo que apunta a la pantalla en la que ya se está no es un directorio más,
 * es un enlace a ningún lado.
 */
const PROPIA_RUTA = 'directories';

/**
 * **Portada de los cuatro directorios** (FT-18-R01/R02, 05/09/2026).
 *
 * ## Qué pidió el carril
 *
 * «Directorios debe tener una vista de nodos que muestre cada directorio con
 * el detalle de que se encuentra en cada directorio.» Los cuatro directorios
 * —médicos, laboratorios, clínicas, farmacias— ya existían como secciones
 * hermanas (A5/A6 del plan de UX, FT-09-R01) y `navigation.subgroups.ts` ya
 * los agrupa bajo un mismo desplegable. Lo que faltaba era la pantalla: hoy
 * quien abre «Directorios» en la barra sólo ve la lista para elegir uno, sin
 * un lugar que explique qué hay en cada uno antes de entrar.
 *
 * ## Por qué no inventa una cuarta fuente de datos
 *
 * El nodo de cada directorio muestra exactamente el `summary` que su propia
 * fila de {@link APP_SECTIONS} ya declara — el mismo texto que usaría el
 * estado vacío de una sección `planificada`. Escribir una descripción nueva
 * acá habría creado una segunda copia que se desincroniza en cuanto alguien
 * corrija una sin la otra.
 *
 * ## De dónde sale la lista de nodos
 *
 * De {@link NAV_SUBGROUPS}: es el registro que ya declara «estos cuatro son
 * los directorios», y esta pantalla lo lee en vez de mantener su propia lista
 * de rutas. Si mañana se agrega un quinto directorio, alcanza con sumarlo ahí
 * — esta portada lo dibuja solo.
 *
 * ## Por qué son nodos y no una lista
 *
 * Es la forma que pidió el carril, y separa la pregunta «¿a qué tipo de cosa
 * quiero buscar?» —que es lo que estos cuatro tienen en común— de la lista
 * plana que ya ofrece el menú lateral. El nodo central es puramente
 * decorativo (`aria-hidden`): lo único navegable es cada directorio, y cada
 * uno es un enlace entero — el título y la descripción viajan dentro del
 * mismo `<a>`, así que el nombre accesible del enlace ya dice de qué se trata,
 * sin depender del color ni de la posición para entenderlo.
 */
@Component({
  selector: 'app-directories-overview',
  imports: [NavIcon, PageHeader, RouterLink],
  templateUrl: './directories-overview.html',
  // La hoja compartida va **primera**: lo de abajo son los ajustes de esta
  // pantalla sobre esa base, y Angular concatena en este orden.
  styleUrls: ['../../shared/styles/rejilla-de-tarjetas.css', './directories-overview.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoriesOverview {
  private readonly navigation = inject(NavigationService);

  /**
   * Las rutas de los cuatro directorios, en el orden en que se declaran en
   * {@link APP_SECTIONS} — el mismo orden en el que ya se dibujan en el menú.
   */
  private readonly rutasDelBloque: readonly string[] = (
    NAV_SUBGROUPS.find((bloque) => bloque.label === BLOQUE)?.paths ?? []
  ).filter((ruta) => ruta !== PROPIA_RUTA);

  /**
   * Los directorios que esta sesión puede abrir.
   *
   * Sale de {@link NavigationService.visibleSections}, que ya aplica los
   * roles de la sesión: quien ejerce no ve el nodo de la guía de médicos, que
   * sigue siendo exclusiva del paciente (corrección #2), sin que esta pantalla
   * tenga que repetir esa regla.
   */
  protected readonly nodos = computed<readonly AppSection[]>(() => {
    const visibles = new Map(
      this.navigation.visibleSections().map((seccion) => [seccion.path, seccion] as const),
    );
    return this.rutasDelBloque
      .map((ruta) => visibles.get(ruta))
      .filter((seccion): seccion is AppSection => seccion !== undefined);
  });

  protected readonly routeOf = routeOf;
}
