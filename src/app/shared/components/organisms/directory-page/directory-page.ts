import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { AppButton } from '../../atoms/button/button';
import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';
import { ResultCard } from '../../molecules/result-card/result-card';
import { ratingOf } from '../../molecules/result-card/rating-of';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { FilterBar, SEARCH_PARAM, type FilterDef } from '../filter-bar/filter-bar';
import { PageHeader } from '../page-header/page-header';
import { ViewStateHost } from '../view-state-host/view-state-host';
import type {
  CriterioDeOrden,
  GrupoDeDirectorio,
  SustantivoDelDirectorio,
} from './directory-page.types';

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
 * Así que la anatomía se escribe una sola vez. Desde el 23/10/2026 es la de un
 * **marketplace** (pedido del propietario: «como Amazon»): buscador ancho
 * arriba, columna de facetas a la izquierda —los filtros de chips y los
 * grupos del directorio con su cantidad—, barra de resultados con el rango,
 * «Ordenar por» y grilla o lista, y una grilla plana de tarjetas. Los grupos
 * ya no cortan la grilla en bandas: son una faceta más. Los
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

/** El prefijo del valor de un orden por cifra, para que no choque con los fijos. */
const PREFIJO_DE_CIFRA = 'cifra:';

/**
 * Cómo se ordena la grilla. `original` es el orden en que el directorio
 * entrega sus grupos —por ciudad, por especialidad—: no se rotula «relevancia»
 * porque nadie lo calculó como tal. `cifra:<clave>` es uno de los
 * {@link CriterioDeOrden} que declara el directorio.
 */
type Orden =
  | 'original'
  | 'calificacion'
  | 'resenas'
  | 'nombre-asc'
  | 'nombre-desc'
  | `${typeof PREFIJO_DE_CIFRA}${string}`;

/**
 * De mayor a menor por un número; sin número, al final. `sort` es estable, así
 * que a igualdad —y entre los que no tienen dato— queda el orden de entrada.
 */
function porCifraDescendente<T>(
  resultados: readonly T[],
  cifra: (resultado: T) => number | null,
): T[] {
  return [...resultados].sort((a, b) => {
    const de = cifra(a);
    const otra = cifra(b);
    if (de === null || otra === null) {
      return (de === null ? 1 : 0) - (otra === null ? 1 : 0);
    }
    return otra - de;
  });
}

/** Cuántas opciones del grupo se ven antes de «Ver todas». */
const GRUPOS_A_LA_VISTA = 10;

type Resultado = GrupoDeDirectorio['resultados'][number];

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
  imports: [AppButton, FilterBar, NavIcon, PageHeader, ResultCard, ViewStateHost],
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

  private readonly ruta = inject(ActivatedRoute);

  /**
   * Cómo se llama lo que agrupa al directorio, para el rótulo de su faceta:
   * «Ciudad», «Especialidad», «Categoría».
   */
  readonly rotuloDeGrupos = input('Sección');

  /** El ícono del rótulo de esa faceta. */
  readonly iconoDeGrupos = input<NavIconName>('labels');

  /** Los filtros que van arriba, junto al buscador: los desplegables. */
  protected readonly filtrosDeArriba = computed(() =>
    this.filtros().filter((filtro) => filtro.asChips !== true),
  );

  /** Los filtros que van a la columna de facetas: los de chips. */
  protected readonly filtrosDeLaColumna = computed(() =>
    this.filtros().filter((filtro) => filtro.asChips === true),
  );

  /**
   * La faceta de grupos: sólo si hay más de un grupo con nombre. Un único
   * grupo —«Todos los médicos»— no acota nada.
   */
  protected readonly gruposConNombre = computed(() =>
    this.grupos().filter((grupo) => grupo.nombre !== '' && grupo.resultados.length > 0),
  );

  /**
   * `false` no dibuja la faceta de grupos. Para los directorios cuyos grupos
   * ya tienen su filtro propio —clínicas, farmacias y aseguradoras agrupan
   * por ciudad, y la ciudad es un filtro dentro del departamento—: dos
   * facetas «Ciudad» en la misma columna serían la misma pregunta dos veces.
   */
  readonly facetaDeGrupos = input(true);

  protected readonly hayFacetaDeGrupos = computed(
    () => this.facetaDeGrupos() && this.gruposConNombre().length > 1,
  );

  protected readonly hayColumna = computed(
    () => this.filtrosDeLaColumna().length > 0 || this.hayFacetaDeGrupos(),
  );

  /** El grupo elegido en la faceta. Se suelta si el grupo deja de existir. */
  protected readonly grupoElegido = linkedSignal<readonly GrupoDeDirectorio[], string | null>({
    source: this.grupos,
    computation: (grupos, anterior) =>
      anterior?.value != null && grupos.some((grupo) => grupo.id === anterior.value)
        ? anterior.value
        : null,
  });

  protected elegirGrupo(id: string | null): void {
    this.grupoElegido.set(this.grupoElegido() === id ? null : id);
  }

  protected readonly verTodosLosGrupos = signal(false);

  protected readonly gruposALaVista = computed(() => {
    const grupos = this.gruposConNombre();
    if (this.verTodosLosGrupos() || grupos.length <= GRUPOS_A_LA_VISTA) {
      return grupos;
    }
    const vista = grupos.slice(0, GRUPOS_A_LA_VISTA);
    const elegido = grupos.find((grupo) => grupo.id === this.grupoElegido());
    // El elegido se ve siempre, aunque esté más abajo del corte.
    return elegido !== undefined && !vista.includes(elegido) ? [...vista, elegido] : vista;
  });

  protected readonly gruposOcultos = computed(
    () => this.gruposConNombre().length - this.gruposALaVista().length,
  );

  /** En teléfono la columna se pliega detrás de un botón «Filtros». */
  protected readonly columnaAbierta = signal(false);

  /** Cuántos filtros de la columna están puestos, para el botón plegado. */
  protected readonly filtrosActivosEnLaColumna = computed(() => {
    const params = this.parametros();
    const deChips = this.filtrosDeLaColumna().filter((filtro) => params[filtro.key]).length;
    return deChips + (this.grupoElegido() === null ? 0 : 1);
  });

  /** La URL, leída como la lee la barra: los filtros viven ahí. */
  private readonly parametros = toSignal(this.ruta.queryParams, {
    initialValue: {} as Readonly<Record<string, string>>,
  });

  readonly orden = signal<Orden>('original');

  /**
   * Los órdenes propios del directorio, por las cifras de sus resultados.
   * Vacío —los directorios que no los declaran— no cambia nada.
   */
  readonly criteriosDeOrden = input<readonly CriterioDeOrden[]>([]);

  /**
   * Si sus resultados se califican aunque todavía nadie haya opinado.
   *
   * Sin esto, «Mejor puntuación» aparece sólo cuando ya hay alguna reseña en
   * pantalla. La guía de médicos lo prende: que nadie haya calificado todavía
   * no quiere decir que no se pueda pedir ese orden.
   */
  readonly calificable = input(false);

  /**
   * Si se ofrecen los órdenes por reseñas: cuando el directorio lo declara o
   * cuando alguna tarjeta ya trae reseñas.
   */
  private readonly hayCalificaciones = computed(
    () =>
      this.calificable() ||
      this.grupos().some((grupo) => grupo.resultados.some((r) => ratingOf(r) !== null)),
  );

  protected readonly opcionesDeOrden = computed<readonly { value: Orden; label: string }[]>(() => [
    {
      value: 'original',
      label:
        this.gruposConNombre().length > 1
          ? `Por ${this.rotuloDeGrupos().toLowerCase()}`
          : 'Predeterminado',
    },
    ...(this.hayCalificaciones()
      ? [
          { value: 'calificacion' as const, label: 'Mejor puntuación' },
          { value: 'resenas' as const, label: 'Más reseñas' },
        ]
      : []),
    ...this.criteriosDeOrden().map((criterio) => ({
      value: `${PREFIJO_DE_CIFRA}${criterio.clave}` as const,
      label: criterio.etiqueta,
    })),
    { value: 'nombre-asc', label: 'Nombre: de la A a la Z' },
    { value: 'nombre-desc', label: 'Nombre: de la Z a la A' },
  ]);

  protected elegirOrden(valor: string): void {
    const opcion = this.opcionesDeOrden().find((o) => o.value === valor);
    if (opcion !== undefined) {
      this.orden.set(opcion.value);
    }
  }

  /**
   * Una de las dos barras —la de arriba o la de la columna— cambió la URL.
   *
   * Se emite el estado **entero** leído de la URL y no lo que trajo cada
   * barra: cada una sólo conoce sus filtros, y quien consume espera recibir
   * el término y todos los códigos juntos, como cuando había una sola barra.
   */
  protected alCambiarFiltros(): void {
    const params = this.parametros() as Readonly<Record<string, string>>;
    const activos: Record<string, string> = {};
    if (params[SEARCH_PARAM]) {
      activos[SEARCH_PARAM] = params[SEARCH_PARAM];
    }
    for (const filtro of this.filtros()) {
      const codigo = params[filtro.key];
      if (codigo) {
        activos[filtro.key] = codigo;
      }
    }
    this.filtrosCambiaron.emit(activos);
  }

  /**
   * El nombre del tramo que se está mirando, si es uno solo: el elegido en la
   * faceta, o el único que hay. Va en la barra de resultados porque la grilla
   * ya no lleva bandas, y «de qué directorio son estas tarjetas» es un dato.
   */
  protected readonly ambito = computed(() => {
    const elegido = this.grupoElegido();
    const conNombre = this.gruposConNombre();
    if (elegido !== null) {
      return conNombre.find((grupo) => grupo.id === elegido)?.nombre ?? null;
    }
    return conNombre.length === 1 ? conNombre[0]!.nombre : null;
  });

  /** Los resultados que pasan la faceta de grupo, ya ordenados. */
  protected readonly resultados = computed<readonly Resultado[]>(() => {
    const elegido = this.grupoElegido();
    const deLosGrupos = this.grupos()
      .filter((grupo) => elegido === null || grupo.id === elegido)
      .flatMap((grupo) => grupo.resultados);
    const orden = this.orden();
    if (orden === 'original') {
      return deLosGrupos;
    }
    if (orden === 'calificacion') {
      // La nota manda; a igual nota, la que más opiniones tiene. Las que no
      // tienen reseñas van al final, en el orden en que venían.
      return [...deLosGrupos].sort((a, b) => {
        const notaA = ratingOf(a);
        const notaB = ratingOf(b);
        if (notaA === null || notaB === null) {
          return (notaA === null ? 1 : 0) - (notaB === null ? 1 : 0);
        }
        return notaB.average - notaA.average || notaB.count - notaA.count;
      });
    }
    if (orden === 'resenas') {
      return porCifraDescendente(deLosGrupos, (r) => ratingOf(r)?.count ?? null);
    }
    if (orden.startsWith(PREFIJO_DE_CIFRA)) {
      const clave = orden.slice(PREFIJO_DE_CIFRA.length);
      return porCifraDescendente(deLosGrupos, (r) => r.stats?.[clave] ?? null);
    }
    const sentido = orden === 'nombre-asc' ? 1 : -1;
    return [...deLosGrupos].sort((a, b) => sentido * a.title.localeCompare(b.title, 'es'));
  });

  protected readonly total = computed(() => this.resultados().length);

  /** «1–24 de 804 médicos», o «5 médicos» cuando entran todos. */
  protected readonly contador = computed(() => {
    const cuantos = this.total();
    const { singular, plural } = this.sustantivo();
    const mostrados = this.mostrados();
    if (cuantos > mostrados) {
      return `1–${mostrados} de ${cuantos} ${plural}`;
    }
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
    source: this.resultados,
    computation: () => this.tamanoDeTanda(),
  });

  /** Las tarjetas que se dibujan: la grilla plana, recortada a la tanda. */
  protected readonly visibles = computed(() => this.resultados().slice(0, this.limite()));

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
