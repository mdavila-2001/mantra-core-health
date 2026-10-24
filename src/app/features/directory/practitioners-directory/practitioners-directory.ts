import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type {
  PractitionerListItem,
  SpecialtyCounts,
} from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { SearchResultItem } from '../../../shared/components/molecules/search-result/search-result.types';
import { DirectoryPage } from '../../../shared/components/organisms/directory-page/directory-page';
import type {
  CriterioDeOrden,
  SustantivoDelDirectorio,
} from '../../../shared/components/organisms/directory-page/directory-page.types';
import { CONTADORES_DE_ACTIVIDAD } from '../../account/my-profile/contadores-de-actividad';
import {
  SEARCH_PARAM,
  type FilterDef,
} from '../../../shared/components/organisms/filter-bar/filter-bar';
import {
  cortesDe,
  filtrosDeLaGuia,
  pasaLosCortes,
  type CortesDeLaGuia,
} from './practitioner-filters';
import { porNombre, toResultado } from './practitioner-card';

/** Una especialidad en la portada: su nombre y cuánta gente hay detrás. */
interface TarjetaDeEspecialidad {
  readonly conceptId: string;
  readonly nombre: string;
  readonly cantidad: number;
}

/** Cómo se cuenta lo que este directorio lista. */
const SUSTANTIVO: SustantivoDelDirectorio = {
  singular: 'médico',
  plural: 'médicos',
};

/** Clave del chip de especialidad en la URL. */
const PARAM_ESPECIALIDAD = 'especialidad';

/**
 * El valor con el que la URL pide «los que no declaran especialidad».
 *
 * No es el id de ninguna especialidad porque no hay ninguna: es su ausencia. Va
 * en la misma clave a propósito —la portada ofrece una tarjeta más y la lista
 * la abre igual que a las otras—, y el prefijo lo hace imposible de confundir
 * con un uuid.
 */
const SIN_ESPECIALIDAD_URL = 'sin-especialidad';

/** Tope por página del backend. La guía las junta todas. */
const POR_PAGINA = 50;

/**
 * Cuántas páginas se recorren como máximo.
 *
 * La guía muestra a **todos**, y para eso agota el cursor. El techo existe
 * para que un catálogo que crezca sin control no encadene peticiones
 * indefinidamente: con 20 páginas de 50 son mil profesionales, y a partir de
 * ahí la pantalla lo dice en vez de seguir pidiendo en silencio.
 */
const MAX_PAGINAS = 20;

/**
 * Encabezado del directorio: una especialidad y quiénes la ejercen.
 *
 * Los nombres de los campos siguen siendo los del carril R2-1 y no los del
 * grupo genérico de `directory-page`: los usa el mapeo de acá y sus pruebas. La
 * traducción a {@link GrupoDeDirectorio} se hace en el `computed` que alimenta
 * a la pantalla, que es una línea.
 */
export interface GrupoDeEspecialidad {
  readonly conceptId: string;
  readonly nombre: string;
  readonly profesionales: readonly SearchResultItem[];
}

/** Lo que se lee cuando el profesional no declaró especialidad. */
const SIN_ESPECIALIDAD = 'Sin especialidad registrada';

/**
 * **La guía de profesionales** — `GET /profiles/practitioners`.
 *
 * ## Qué reemplaza, y por qué
 *
 * Ocupa el lugar del muro profesional en el menú. El cliente lo pidió
 * textual: «sacar del perfil de paciente muro profesional, o cambiarle su
 * enfoque: debe mostrar una especie de **guía telefónica de todos los
 * doctores agrupados por especialidad**».
 *
 * El muro **no se borra**: sigue existiendo como código y como ruta. Lo que
 * se le saca es la entrada del menú — borrarlo es una decisión de producto
 * que el cliente no pidió.
 *
 * ## Una guía se hojea, no se interroga
 *
 * Tres cosas que se cumplen literal o el punto no está hecho:
 *
 * 1. **Están todos**: se agotan las páginas del cursor al abrir, sin escribir
 *    nada. Un buscador que exige tipear primero no es una guía.
 * 2. **La especialidad es el encabezado**, no un filtro opcional.
 * 3. Un clic abre el **perfil completo** — el mismo componente con el que un
 *    doctor ve el suyo.
 *
 * El buscador de arriba filtra **encima** de esa estructura, en memoria, y
 * nunca es la puerta de entrada.
 *
 * ## Filas de médicos primero (propietario, 04/10/2026)
 *
 * «Primero ver la opción de ver como filas y solo doctores, no como un grid de
 * especialidad.» La portada de especialidades dejó de ser la entrada: se abre
 * la lista de médicos, en filas, y la especialidad es un filtro de la barra.
 * Cada fila dice las especialidades **reales** del médico —la elegida
 * primero—, no el título escrito a mano: un cardiólogo listado bajo
 * Cardiología decía «Médico especialista» o aparecía también en el grupo de
 * otra especialidad.
 *
 * ## Por qué agrupa en el cliente
 *
 * El backend pagina por cursor sin total y el filtro por especialidad devuelve
 * un subconjunto: agrupar del lado del servidor exigiría una lectura por
 * especialidad —tantas peticiones como especialidades haya— para una pantalla
 * que de todos modos las muestra todas juntas.
 */
@Component({
  selector: 'app-practitioners-directory',
  imports: [DirectoryPage],
  templateUrl: './practitioners-directory.html',
  styleUrls: ['../../../shared/styles/rejilla-de-tarjetas.css', './practitioners-directory.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionersDirectory {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly route = inject(ActivatedRoute);

  /**
   * La especialidad elegida, leída de la URL.
   *
   * Es la que decide qué pantalla se ve —portada o lista—, y por eso se lee acá
   * y no del organismo de filtros: el organismo vive DENTRO de la lista, así
   * que preguntarle a él cuál es la especialidad sería preguntarle a la pieza
   * que sólo existe cuando ya se eligió una.
   *
   * Que viva en la URL es lo que hace compartible «la guía, cardiología» y lo
   * que deja que el chequeo de síntomas mande directo a una especialidad,
   * salteándose la portada.
   */
  private readonly especialidadEnUrl = toSignal(
    this.route.queryParams.pipe(
      map((params) => {
        const valor = params[PARAM_ESPECIALIDAD];
        return typeof valor === 'string' && valor !== '' ? valor : null;
      }),
    ),
    { initialValue: null },
  );

  /** Búsqueda inicial en URL, para que los enlaces de ayuda abran el filtro ya aplicado. */
  private readonly busquedaEnUrl = toSignal(
    this.route.queryParams.pipe(
      map((params) => {
        const valor = params[SEARCH_PARAM];
        return typeof valor === 'string' ? valor : '';
      }),
    ),
    { initialValue: '' },
  );

  /** Los cortes en memoria que trae la URL al abrir: un enlace compartido los reproduce. */
  private readonly cortesEnUrl = toSignal(
    this.route.queryParams.pipe(map((params) => cortesDe(params))),
    { initialValue: {} as CortesDeLaGuia },
  );

  /** El recuento por especialidad: lo que dibuja la portada. */
  protected readonly recuento = signal<ViewState<readonly TarjetaDeEspecialidad[]>>(loading());

  /** Cuántos profesionales hay en total, para el subtítulo de la portada. */
  protected readonly totalDeProfesionales = signal(0);

  /** Las tarjetas ya listas, o vacío mientras el recuento no esté. */
  protected readonly tarjetas = computed<readonly TarjetaDeEspecialidad[]>(
    () => dataOf(this.recuento()) ?? [],
  );

  protected readonly sustantivo = SUSTANTIVO;

  /**
   * Los órdenes por actividad del «Ordenar por», además de nombre y nota: los
   * cuatro contadores de la ficha, de mayor a menor. Las claves son las de
   * `cifrasDe` en la tarjeta.
   */
  protected readonly criteriosDeOrden: readonly CriterioDeOrden[] = CONTADORES_DE_ACTIVIDAD.map(
    (contador) => ({ clave: contador.clave, etiqueta: `Más ${contador.rotulo.toLowerCase()}` }),
  );

  protected readonly estado = signal<ViewState<readonly GrupoDeEspecialidad[]>>(loading());

  /**
   * El título escrito de cada médico, por id: ya no se muestra —la fila dice
   * sus especialidades reales— pero se sigue pudiendo buscar por él.
   */
  private readonly titulosPorId = signal<ReadonlyMap<string, string>>(new Map());

  /** Las filas de la guía por id: los cortes en memoria leen sus datos. */
  private readonly filasPorId = signal<ReadonlyMap<string, PractitionerListItem>>(new Map());

  /** Los cortes en memoria que están puestos, leídos de la URL. */
  protected readonly cortes = signal<CortesDeLaGuia>({});

  /** Filtro en memoria: el directorio ya está entero en pantalla. */
  protected readonly filtro = signal('');

  /** La especialidad elegida por chip, o `null`. También en memoria. */
  protected readonly especialidad = signal<string | null>(null);

  /**
   * El filtro de especialidad: las que TIENEN gente, con su cantidad, del mismo
   * recuento del backend. Un chip que siempre devuelve cero es peor que no
   * tenerlo. Vive en la URL (la barra la escribe), así que elegir uno recarga
   * la lista filtrada en el servidor.
   */
  protected readonly filtros = computed<readonly FilterDef[]>(() => [
    {
      key: PARAM_ESPECIALIDAD,
      label: 'Especialidad',
      icon: 'stethoscope',
      placeholder: 'Todas las especialidades',
      // En la columna de facetas, como la categoría de una tienda
      // (propietario, 23/10/2026).
      asChips: true,
      options: this.tarjetas().map((tarjeta) => ({
        value: tarjeta.conceptId,
        label: `${tarjeta.nombre} (${tarjeta.cantidad})`,
      })),
    },
    ...filtrosDeLaGuia([...this.filasPorId().values()], this.cortes()),
  ]);

  /** Si el médico pasa los cortes en memoria; sin su fila, sólo sin cortes. */
  private pasaLosCortes(id: string): boolean {
    const fila = this.filasPorId().get(id);
    return fila === undefined
      ? Object.keys(this.cortes()).length === 0
      : pasaLosCortes(fila, this.cortes());
  }

  /** Si se cortó por el techo de páginas, para poder decirlo. */
  protected readonly recortada = signal(false);

  protected readonly aviso = computed(() =>
    this.recortada()
      ? 'Se muestran los primeros médicos del directorio. Use el buscador para encontrar a alguien que no aparezca en la lista.'
      : null,
  );

  protected readonly grupos = computed<readonly GrupoDeEspecialidad[]>(() => {
    const elegida = this.especialidad();
    // El chip acota **antes** que el texto: son dos cortes distintos —«sólo
    // cardiología» y «que se llame Quispe»— y aplicarlos en el otro orden daría
    // el mismo resultado con más trabajo.
    const hayCortes = Object.keys(this.cortes()).length > 0;
    const todos = (dataOf(this.estado()) ?? [])
      .filter((grupo) => elegida === null || grupo.conceptId === elegida)
      .map((grupo) =>
        hayCortes
          ? { ...grupo, profesionales: grupo.profesionales.filter((p) => this.pasaLosCortes(p.id)) }
          : grupo,
      )
      .filter((grupo) => !hayCortes || grupo.profesionales.length > 0);
    const busqueda = normalizar(this.filtro());
    if (busqueda === '') {
      return todos;
    }
    // Se filtran los profesionales y se descartan los grupos que quedan
    // vacíos: un encabezado de especialidad sin nadie debajo es ruido.
    return todos
      .map((grupo) => ({
        ...grupo,
        // Buscar «cardiología» tiene que traer a los cardiólogos, no a nadie:
        // el placeholder promete buscar por especialidad, y la especialidad es
        // el ENCABEZADO, no un dato de la tarjeta. Si el texto casa con el
        // grupo, el grupo entra entero (TJ-3).
        profesionales: normalizar(grupo.nombre).includes(busqueda)
          ? grupo.profesionales
          : grupo.profesionales.filter((profesional) =>
              coincide(profesional, busqueda, this.titulosPorId().get(profesional.id)),
            ),
      }))
      .filter((grupo) => grupo.profesionales.length > 0);
  });

  /** Los grupos, ya con la forma que consume el patrón común de directorio. */
  protected readonly tramos = computed(() =>
    this.grupos().map((grupo) => ({
      id: grupo.conceptId,
      nombre: grupo.nombre,
      resultados: grupo.profesionales,
    })),
  );

  /**
   * Qué decir cuando el filtro no dejó a nadie. `null` = no es ese caso.
   *
   * Hay directorio, pero lo que se pidió no encontró a nadie: es distinto de no
   * haber directorio, y el texto tiene que decir cuál de los dos es.
   */
  protected readonly sinCoincidencias = computed<string | null>(() => {
    if (this.grupos().length > 0) {
      return null;
    }
    const texto = this.filtro().trim();
    if (texto !== '') {
      return `Ningún médico coincide con «${texto}». Pruebe con otro nombre o con la especialidad.`;
    }
    if (Object.keys(this.cortes()).length > 0) {
      return 'Ningún médico cumple todos los filtros que puso. Pruebe quitando alguno.';
    }
    return this.especialidad() === null
      ? null
      : 'Ningún médico de esa especialidad está publicado todavía. Pruebe quitando el chip.';
  });

  /**
   * Lo que emite la barra: el texto bajo `q` y la especialidad bajo su clave.
   *
   * El filtrado sigue siendo **en memoria** —el directorio está entero en
   * pantalla desde que se abre, y ésa es la promesa de un directorio que se
   * hojea—, pero el estado vive en la URL igual que en los otros tres: un
   * enlace a «Directorio de médicos, cardiología» tiene que poder pegarse en un
   * mensaje.
   */
  protected filtrar(activos: Readonly<Record<string, string>>): void {
    this.filtro.set(activos[SEARCH_PARAM] ?? '');
    this.especialidad.set(activos[PARAM_ESPECIALIDAD] ?? null);
    this.cortes.set(cortesDe(activos));
  }

  constructor() {
    // `effect` y no una sola carga en el constructor: tocar una tarjeta cambia
    // la URL pero NO recrea el componente —es la misma ruta—, así que sin esto
    // la portada se quedaría dibujada sobre una especialidad ya elegida. Cada
    // cambio del parámetro es una pantalla distinta y una lectura distinta.
    // El recuento alimenta el filtro de especialidad: se pide una vez.
    this.cargarRecuento();
    effect(() => {
      const busqueda = this.busquedaEnUrl();
      untracked(() => this.filtro.set(busqueda));
    });
    effect(() => {
      const cortes = this.cortesEnUrl();
      untracked(() => this.cortes.set(cortes));
    });
    effect(() => {
      const elegida = this.especialidadEnUrl();
      untracked(() => this.cargarLista(elegida));
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargarLista(this.especialidadEnUrl());
  }

  /**
   * La portada: una tarjeta por especialidad con gente.
   *
   * Dos lecturas y ninguna página de la guía. Antes esta pantalla recorría el
   * cursor hasta agotarlo **sólo para contar**, y con un techo que la dejaba
   * recortada sin decirlo.
   */
  private cargarRecuento(): void {
    this.recuento.set(loading());

    this.profiles
      .getSpecialtyCounts()
      .pipe(
        switchMap((recuento: SpecialtyCounts) =>
          forkJoin({
            recuento: of(recuento),
            // Mismo trato que en la lista: sin catálogo la portada sigue
            // existiendo, con el concepto por nombre.
            etiquetas: this.terminology
              .readConceptLabels(recuento.items.map((fila) => fila.specialtyConceptId))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ recuento, etiquetas }) => {
          this.totalDeProfesionales.set(recuento.practitionerTotal);
          const tarjetas = recuento.items.map((fila) => ({
            conceptId: fila.specialtyConceptId,
            nombre: etiquetas.get(fila.specialtyConceptId)?.display ?? SIN_ESPECIALIDAD,
            cantidad: fila.practitionerCount,
          }));
          // Al final y sólo si hay alguien: es la puerta a los que no declaran
          // especialidad —quien se registra solo nace así—, y sin esta tarjeta
          // una guía que se recorre por especialidad no llega nunca a ellos.
          if (recuento.withoutSpecialtyCount > 0) {
            tarjetas.push({
              conceptId: SIN_ESPECIALIDAD_URL,
              nombre: 'Sin especialidad declarada',
              cantidad: recuento.withoutSpecialtyCount,
            });
          }
          this.recuento.set(ready(tarjetas));
        },
        error: (error: unknown) =>
          this.recuento.set(errorToViewState<readonly TarjetaDeEspecialidad[]>(error)),
      });
  }

  /**
   * La lista de UNA especialidad, pedida al servidor.
   *
   * El filtro va en la consulta y no en memoria: es la mitad del ahorro de la
   * portada —traer a los 88 de cardiología en vez de a los 836 para mostrar 88—
   * y encima el backend ya lo soportaba.
   */
  private cargarLista(specialtyConceptId: string | null): void {
    this.estado.set(loading());
    this.recortada.set(false);

    this.leerTodo([], undefined, 0, specialtyConceptId)
      .pipe(
        switchMap((filas) =>
          forkJoin({
            filas: of(filas),
            // El catálogo caído deja los encabezados sin nombre, no sin guía:
            // los profesionales siguen listados bajo «sin especialidad».
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(filas))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ filas, etiquetas }) => {
          this.filasPorId.set(new Map(filas.map((fila) => [fila.profileId, fila] as const)));
          this.titulosPorId.set(
            new Map(
              filas
                .filter((fila) => fila.professionalTitle)
                .map((fila) => [fila.profileId, fila.professionalTitle as string] as const),
            ),
          );
          this.estado.set(ready(agrupar(filas, etiquetas, specialtyConceptId)));
        },
        error: (error: unknown) =>
          this.estado.set(errorToViewState<readonly GrupoDeEspecialidad[]>(error)),
      });
  }

  /**
   * Recorre el cursor hasta agotarlo, o hasta el techo de páginas.
   *
   * Recursivo y no un bucle porque cada página depende del cursor de la
   * anterior: no se pueden pedir en paralelo.
   */
  private leerTodo(
    acumulado: readonly PractitionerListItem[],
    cursor: string | undefined,
    pagina: number,
    specialtyConceptId: string | null,
  ): Observable<readonly PractitionerListItem[]> {
    const filtro =
      specialtyConceptId === null
        ? {}
        : specialtyConceptId === SIN_ESPECIALIDAD_URL
          ? { withoutSpecialty: true }
          : { specialtyConceptId };
    return this.profiles.listPractitioners({ ...filtro, cursor, limit: POR_PAGINA }).pipe(
      switchMap((respuesta) => {
        // ALV-013: una misma persona, una sola tarjeta. El keyset del servidor
        // no repite filas, pero un cursor que se reutilice —o una fila que
        // cambie de orden entre dos páginas— la traería dos veces, y acumular a
        // ciegas la pintaba dos veces. Se deduplica por `profileId`, que es lo
        // que abre la ficha: dos tarjetas con el mismo id SON la misma persona.
        const filas = sinRepetidos([...acumulado, ...respuesta.items]);
        if (respuesta.nextCursor === null) {
          return of(filas);
        }
        if (pagina + 1 >= MAX_PAGINAS) {
          this.recortada.set(true);
          return of(filas);
        }
        return this.leerTodo(filas, respuesta.nextCursor, pagina + 1, specialtyConceptId);
      }),
    );
  }
}

/**
 * Las mismas filas, una por `profileId`, conservando la primera aparición y el
 * orden (ALV-013).
 */
function sinRepetidos(filas: readonly PractitionerListItem[]): readonly PractitionerListItem[] {
  const vistos = new Set<string>();
  return filas.filter((fila) => {
    if (vistos.has(fila.profileId)) {
      return false;
    }
    vistos.add(fila.profileId);
    return true;
  });
}

/**
 * Texto comparable: sin mayúsculas ni tildes.
 *
 * Sin esto, «cardiologia» no encuentra «Cardiología» y media guía queda
 * inalcanzable para quien no pone el acento —que es casi todo el mundo—.
 */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Si el profesional casa con el texto del filtro.
 *
 * Mira el nombre, el **subtítulo** y las líneas de contexto. El subtítulo se
 * nombra aparte desde que dejó de ser la primera línea de `meta`: es donde vive
 * el título profesional —«Pediatra»—, y el buscador que promete encontrar «por
 * nombre o especialidad» dejaría de encontrarlo si sólo mirara `meta`. Es
 * exactamente lo que pasó al mover el campo, y lo que la prueba de «el buscador
 * también encuentra por el título profesional» cazó.
 */
function coincide(profesional: SearchResultItem, busqueda: string, titulo?: string): boolean {
  if (normalizar(profesional.title).includes(busqueda)) {
    return true;
  }
  if (titulo !== undefined && normalizar(titulo).includes(busqueda)) {
    return true;
  }
  if (profesional.subtitle !== undefined && normalizar(profesional.subtitle).includes(busqueda)) {
    return true;
  }
  return (profesional.meta ?? []).some((linea) => normalizar(linea.text).includes(busqueda));
}

/** Todos los conceptos de la guía, para pedir el catálogo una sola vez. */
function conceptosDe(filas: readonly PractitionerListItem[]): readonly string[] {
  return filas.flatMap((fila) => fila.specialties.map((e) => e.specialtyConceptId));
}

/**
 * Arma la lista de la guía.
 *
 * Una sola tanda, sin repartir a cada médico en todas sus especialidades: eso
 * hacía que, buscando cardiólogos, aparecieran también grupos de Neumología o
 * Pediatría con la misma gente (propietario, 04/10/2026). Con especialidad
 * elegida, la tanda lleva su nombre; sin ella, son todos los médicos.
 */
function agrupar(
  filas: readonly PractitionerListItem[],
  etiquetas: ConceptLabels,
  elegida: string | null = null,
): readonly GrupoDeEspecialidad[] {
  if (filas.length === 0) return [];
  const nombres = filas
    .map((fila) => fila.displayName)
    .filter((nombre): nombre is string => nombre !== undefined && nombre !== '');
  const nombreDelGrupo =
    elegida === null
      ? 'Todos los médicos'
      : elegida === SIN_ESPECIALIDAD_URL
        ? SIN_ESPECIALIDAD
        : (etiquetas.get(elegida)?.display ?? SIN_ESPECIALIDAD);
  return [
    {
      conceptId: elegida ?? 'todos',
      nombre: nombreDelGrupo,
      profesionales: filas
        .map((fila) => toResultado(fila, nombres, etiquetas, elegida))
        .sort(porNombre),
    },
  ];
}
