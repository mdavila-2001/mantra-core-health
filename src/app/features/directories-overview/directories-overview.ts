import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, type Params } from '@angular/router';
import {
  catchError,
  forkJoin,
  map,
  of,
  startWith,
  Subject,
  switchMap,
  type Observable,
} from 'rxjs';

import { DiagnosticUnitsClient } from '../../core/data-access/diagnostic-units/diagnostic-units.client';
import { PublicDirectoryClient } from '../../core/data-access/public-directory/public-directory.client';
import type { PublicSearchResult } from '../../core/data-access/public-directory/public-directory.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { NAV_SUBGROUPS } from '../../core/navigation/navigation.subgroups';
import { routeOf, type AppSection } from '../../core/navigation/navigation.types';
import { dataOf, empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import type { SearchResultItem } from '../../shared/components/molecules/search-result/search-result.types';
import { DirectoryPage } from '../../shared/components/organisms/directory-page/directory-page';
import type {
  GrupoDeDirectorio,
  SustantivoDelDirectorio,
} from '../../shared/components/organisms/directory-page/directory-page.types';
import {
  SEARCH_PARAM,
  type FilterDef,
} from '../../shared/components/organisms/filter-bar/filter-bar';
import { aTarjeta, rutaDeFicha } from '../alovida/buscar/public-result.mapper';
import { groupUnits } from '../laboratory-directory/laboratory-directory';

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

/** Cómo se cuenta lo que devuelve la búsqueda de esta portada. */
const SUSTANTIVO: SustantivoDelDirectorio = {
  singular: 'resultado encontrado',
  plural: 'resultados encontrados',
};

/**
 * Cuántos resultados se piden por directorio.
 *
 * Una sola página y no el recorrido entero del cursor: esto es una búsqueda
 * con término, no el directorio para hojear —ese se abre desde su tarjeta—.
 * 50 es el tope del contrato público; el de laboratorios acepta 100, pero con
 * un término de por medio no hace falta más.
 */
const POR_DIRECTORIO = 50;

/**
 * La clave del desplegable «en qué directorio buscar», en la URL. Su valor es
 * la ruta del directorio elegido; sin la clave, se busca en todos.
 */
export const DIRECTORIO_PARAM = 'directorio';

/**
 * Los directorios en los que busca esta portada, con cómo se busca en cada
 * uno. La ficha de cada resultado cuelga del **mismo** directorio, dentro del
 * panel — la misma ruta que abre la tarjeta desde su propia lista.
 */
type Buscador = (termino: string) => Observable<readonly SearchResultItem[]>;

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
  imports: [DirectoryPage, NavIcon, RouterLink],
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
   * roles de la sesión: quien administra no ve el nodo de la guía de médicos,
   * que es del paciente y del médico (corrección #2, ampliada el 24/09/2026),
   * sin que esta pantalla tenga que repetir esa regla.
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

  /** Los nodos que se dibujan: todos, o sólo el elegido en el desplegable. */
  protected readonly nodosVisibles = computed<readonly AppSection[]>(() => {
    const elegido = this.elegido();
    return elegido === null ? this.nodos() : this.nodos().filter((nodo) => nodo.path === elegido);
  });

  /* ---- la búsqueda en los tres directorios de lugares --------------------- */

  private readonly laboratorios = inject(DiagnosticUnitsClient);
  private readonly publico = inject(PublicDirectoryClient);

  protected readonly sustantivo = SUSTANTIVO;

  /**
   * Cómo se busca en cada directorio de lugares, por su ruta.
   *
   * El de médicos entró el 24/09/2026 (pedido del cliente, junto con el
   * desplegable): busca por nombre en el directorio público, y su tarjeta abre
   * la ficha pública del profesional —el buscador público no expone el
   * `profileId` que pide `/directory/:profileId`—. Un nodo que no tiene
   * buscador acá simplemente no suma resultados.
   */
  private readonly buscadores: Readonly<Record<string, Buscador>> = {
    directory: (q) =>
      this.publico
        .searchPractitioners({ q, limit: POR_DIRECTORIO })
        .pipe(map((pagina) => tarjetas(pagina.items, rutaDeFicha))),
    'laboratory-directory': (q) =>
      this.laboratorios
        .search({ q, limit: POR_DIRECTORIO })
        .pipe(map((pagina) => groupUnits(pagina.items).flatMap((grupo) => grupo.resultados))),
    'clinics-directory': (q) =>
      this.publico
        .searchOrganizations({ q, limit: POR_DIRECTORIO })
        .pipe(map((pagina) => tarjetas(pagina.items, fichaEn('/clinics-directory')))),
    'pharmacies-directory': (q) =>
      this.publico
        .searchPharmacies({ q, limit: POR_DIRECTORIO })
        .pipe(map((pagina) => tarjetas(pagina.items, fichaEn('/pharmacies-directory')))),
  };

  /** El término, de la URL: la barra lo escribe ahí bajo `q`. */
  private readonly parametros = toSignal(inject(ActivatedRoute).queryParams, {
    initialValue: {} as Params,
  });

  protected readonly termino = computed(() => {
    const valor: unknown = this.parametros()[SEARCH_PARAM];
    return typeof valor === 'string' ? valor.trim() : '';
  });

  /** Sin término se ven los nodos; con término, los resultados. */
  protected readonly enPortada = computed(() => this.termino() === '');

  /** Los directorios de la sesión en los que se puede buscar. */
  private readonly buscables = computed(() =>
    this.nodos().filter((nodo) => this.buscadores[nodo.path] !== undefined),
  );

  /**
   * El directorio elegido en el desplegable, o `null` = todos.
   *
   * Sale de la URL, como el término: recargar o compartir el enlace reproduce
   * la misma búsqueda. Un valor que no es un directorio de esta sesión —un
   * enlace viejo, o uno armado a mano— se lee como «todos» en vez de dejar la
   * búsqueda vacía sin explicación.
   */
  private readonly elegido = computed<string | null>(() => {
    const valor: unknown = this.parametros()[DIRECTORIO_PARAM];
    return typeof valor === 'string' && this.buscables().some((nodo) => nodo.path === valor)
      ? valor
      : null;
  });

  /** En qué directorios busca de verdad el término: el elegido, o todos. */
  private readonly buscados = computed(() => {
    const elegido = this.elegido();
    return elegido === null
      ? this.buscables()
      : this.buscables().filter((nodo) => nodo.path === elegido);
  });

  /**
   * El desplegable al lado del buscador (pedido del cliente, 24/09/2026):
   * «SOLO laboratorios, clínicas o farmacias». Es un filtro de la misma barra,
   * y no un control aparte, para que viaje en la URL, se vea como chip y lo
   * limpie «Limpiar todo» igual que cualquier otro filtro.
   *
   * Las opciones son los directorios que esta sesión puede abrir, en el orden
   * de los nodos; «Todos» va primero con valor vacío, que la barra lee como
   * quitar el filtro.
   */
  protected readonly filtros = computed<readonly FilterDef[]>(() => [
    {
      key: DIRECTORIO_PARAM,
      label: 'Directorio',
      placeholder: TODOS,
      options: [
        { value: '', label: TODOS },
        ...this.buscables().map((nodo) => ({ value: nodo.path, label: nombreCorto(nodo) })),
      ],
    },
  ]);

  /** La etiqueta de la barra nombra sólo lo que de verdad busca. */
  protected readonly etiquetaBusqueda = computed(() => {
    const nombres = this.buscados().map((nodo) => nombreCorto(nodo).toLowerCase());
    if (nombres.length === 0) {
      return 'Buscar en los directorios';
    }
    const lista =
      nombres.length === 1
        ? nombres[0]
        : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
    return `Buscar ${lista} por nombre`;
  });

  protected readonly estado = signal<ViewState<readonly GrupoDeDirectorio[]>>(ready([]));
  protected readonly grupos = computed(() => dataOf(this.estado()) ?? []);

  /**
   * Las búsquedas en vuelo, encauzadas por `switchMap`: escribir rápido pide
   * varias veces, y la que queda en pantalla tiene que ser la última pedida,
   * no la que respondió última. El mismo remedio que el directorio de
   * laboratorios.
   */
  private readonly peticiones = new Subject<string>();

  constructor() {
    this.peticiones
      .pipe(
        switchMap((termino) => {
          if (termino === '') {
            return of(ready<readonly GrupoDeDirectorio[]>([]));
          }
          const nodos = this.buscados();
          // Cada directorio falla por su cuenta: si uno no responde, los otros
          // dos siguen mostrando lo suyo en vez de tumbar la búsqueda entera.
          // Sólo si caen todos se muestra el error.
          const lecturas = nodos.map((nodo) =>
            this.buscadores[nodo.path](termino).pipe(
              map((resultados) => ({ nodo, resultados, fallo: null as unknown })),
              catchError((fallo: unknown) => of({ nodo, resultados: [], fallo })),
            ),
          );
          return (lecturas.length === 0 ? of([]) : forkJoin(lecturas)).pipe(
            map((respuestas) => {
              const caido = respuestas.find((respuesta) => respuesta.fallo !== null);
              if (caido !== undefined && respuestas.every((r) => r.fallo !== null)) {
                return errorToViewState<readonly GrupoDeDirectorio[]>(caido.fallo);
              }
              const grupos = respuestas
                .filter((respuesta) => respuesta.resultados.length > 0)
                .map(({ nodo, resultados }) => ({
                  id: nodo.path,
                  nombre: nodo.label,
                  resultados,
                }));
              return grupos.length === 0
                ? empty(
                    { label: 'Ver los directorios', route: '/directories' },
                    `No encontramos nada que coincida con «${termino}». Probá con otra palabra.`,
                  )
                : ready<readonly GrupoDeDirectorio[]>(grupos);
            }),
            startWith(loading()),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((estado) => this.estado.set(estado));

    // El término y el directorio elegido: cambiar cualquiera de los dos es
    // otra búsqueda, así que el efecto depende de los dos.
    effect(() => {
      this.buscados();
      this.peticiones.next(this.termino());
    });
  }

  protected reintentar(): void {
    this.peticiones.next(this.termino());
  }
}

/** Lo que dice el desplegable cuando no acota. */
const TODOS = 'Todos los directorios';

/** «Directorio de clínicas» → «Clínicas»: lo que ofrece el desplegable. */
function nombreCorto(nodo: AppSection): string {
  const nombre = nodo.label.replace(/^Directorio de /u, '');
  return nombre.charAt(0).toLocaleUpperCase('es') + nombre.slice(1);
}

/** La ficha de un resultado dentro del panel de su directorio. */
function fichaEn(rutaDelDirectorio: string): (resultado: PublicSearchResult) => string {
  return (resultado) => `${rutaDelDirectorio}/${encodeURIComponent(resultado.slug)}`;
}

/** Las filas públicas como tarjetas, ordenadas por nombre. */
function tarjetas(
  filas: readonly PublicSearchResult[],
  ruta: (resultado: PublicSearchResult) => string,
): readonly SearchResultItem[] {
  return filas
    .map((fila) => aTarjeta(fila, { mostrarTipo: false, ruta }))
    .sort((a, b) => a.title.localeCompare(b.title, 'es'));
}
