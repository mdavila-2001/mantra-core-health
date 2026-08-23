import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of, switchMap, type Observable } from 'rxjs';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { PractitionerListItem } from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { SearchResultItem } from '../../../shared/components/molecules/search-result/search-result.types';
import { DirectoryPage } from '../../../shared/components/organisms/directory-page/directory-page';
import type { SustantivoDelDirectorio } from '../../../shared/components/organisms/directory-page/directory-page.types';
import {
  SEARCH_PARAM,
  type FilterDef,
} from '../../../shared/components/organisms/filter-bar/filter-bar';
import { subtituloProfesional } from '../subtitulo-profesional';

/** Cómo se cuenta lo que este directorio lista. */
const SUSTANTIVO: SustantivoDelDirectorio = {
  singular: 'médico',
  plural: 'médicos',
};

/** Clave del chip de especialidad en la URL. */
const PARAM_ESPECIALIDAD = 'especialidad';

/**
 * Cuántas especialidades se ofrecen como chips.
 *
 * Los chips valen porque **se ven todos**: en cuanto hay que desplazarse para
 * llegar al último, vuelven a esconder opciones, que es el defecto del
 * desplegable que vinieron a corregir. Con más de este tope, las de más abajo
 * siguen alcanzándose por el buscador y por su encabezado.
 */
const MAXIMO_DE_CHIPS = 12;

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionersDirectory {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);

  protected readonly sustantivo = SUSTANTIVO;

  protected readonly estado = signal<ViewState<readonly GrupoDeEspecialidad[]>>(loading());

  /** Filtro en memoria: el directorio ya está entero en pantalla. */
  protected readonly filtro = signal('');

  /** La especialidad elegida por chip, o `null`. También en memoria. */
  protected readonly especialidad = signal<string | null>(null);

  /**
   * Los chips de especialidad, sacados del propio directorio.
   *
   * **No de un catálogo**: el catálogo de terminología tiene especialidades que
   * en esta plataforma no ejerce nadie, y un chip que siempre devuelve cero
   * resultados es peor que no tenerlo. Se ordenan por cantidad —las que más
   * médicos tienen primero— porque son las que más gente busca, y recién
   * después alfabéticamente para que el orden sea estable entre cargas.
   */
  protected readonly filtros = computed<readonly FilterDef[]>(() => {
    const todos = dataOf(this.estado()) ?? [];
    const opciones = [...todos]
      .filter((grupo) => grupo.conceptId !== 'sin-especialidad')
      .sort(
        (a, b) =>
          b.profesionales.length - a.profesionales.length ||
          a.nombre.localeCompare(b.nombre, 'es'),
      )
      .slice(0, MAXIMO_DE_CHIPS)
      .map((grupo) => ({ value: grupo.conceptId, label: grupo.nombre }));

    return opciones.length === 0
      ? []
      : [{ key: PARAM_ESPECIALIDAD, label: 'Especialidad', asChips: true, options: opciones }];
  });

  /** Si se cortó por el techo de páginas, para poder decirlo. */
  protected readonly recortada = signal(false);

  protected readonly aviso = computed(() =>
    this.recortada()
      ? 'Se muestran los primeros médicos del directorio. Usá el buscador para encontrar a alguien que no aparezca en la lista.'
      : null,
  );

  protected readonly grupos = computed<readonly GrupoDeEspecialidad[]>(() => {
    const elegida = this.especialidad();
    // El chip acota **antes** que el texto: son dos cortes distintos —«sólo
    // cardiología» y «que se llame Quispe»— y aplicarlos en el otro orden daría
    // el mismo resultado con más trabajo.
    const todos = (dataOf(this.estado()) ?? []).filter(
      (grupo) => elegida === null || grupo.conceptId === elegida,
    );
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
          : grupo.profesionales.filter((profesional) => coincide(profesional, busqueda)),
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
      return `Ningún médico coincide con «${texto}». Probá con otro nombre o con la especialidad.`;
    }
    return this.especialidad() === null
      ? null
      : 'Ningún médico de esa especialidad está publicado todavía. Probá quitando el chip.';
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
  }

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.estado.set(loading());
    this.recortada.set(false);

    this.leerTodo([], undefined, 0)
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
        next: ({ filas, etiquetas }) => this.estado.set(ready(agrupar(filas, etiquetas))),
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
  ): Observable<readonly PractitionerListItem[]> {
    return this.profiles.listPractitioners({ cursor, limit: POR_PAGINA }).pipe(
      switchMap((respuesta) => {
        const filas = [...acumulado, ...respuesta.items];
        if (respuesta.nextCursor === null) {
          return of(filas);
        }
        if (pagina + 1 >= MAX_PAGINAS) {
          this.recortada.set(true);
          return of(filas);
        }
        return this.leerTodo(filas, respuesta.nextCursor, pagina + 1);
      }),
    );
  }
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

/** Si el profesional casa con el texto del filtro. */
function coincide(profesional: SearchResultItem, busqueda: string): boolean {
  if (normalizar(profesional.title).includes(busqueda)) {
    return true;
  }
  return (profesional.meta ?? []).some((linea) => normalizar(linea.text).includes(busqueda));
}

/** Todos los conceptos de la guía, para pedir el catálogo una sola vez. */
function conceptosDe(filas: readonly PractitionerListItem[]): readonly string[] {
  return filas.flatMap((fila) => fila.specialties.map((e) => e.specialtyConceptId));
}

/**
 * Arma los grupos de la guía.
 *
 * Un profesional con varias especialidades aparece **en cada una**: es lo que
 * hace una guía telefónica, y esconderlo bajo una sola dejaría a alguien fuera
 * del encabezado por el que lo buscan. Quien no declara ninguna va a un grupo
 * propio al final — existe igual y tiene que poder encontrarse.
 */
function agrupar(
  filas: readonly PractitionerListItem[],
  etiquetas: ConceptLabels,
): readonly GrupoDeEspecialidad[] {
  const porEspecialidad = new Map<string, { nombre: string; filas: PractitionerListItem[] }>();
  const sinEspecialidad: PractitionerListItem[] = [];
  // Los nombres de toda la respuesta, para que ninguna tarjeta pueda mostrar el
  // de otra como subtítulo (F-25). Se calculan una vez: es la comprobación
  // exacta, y la heurística de `subtituloProfesional` sólo cubre lo que esta no
  // puede ver.
  const nombres = filas
    .map((fila) => fila.displayName)
    .filter((nombre): nombre is string => nombre !== undefined && nombre !== '');

  for (const fila of filas) {
    if (fila.specialties.length === 0) {
      sinEspecialidad.push(fila);
      continue;
    }
    for (const especialidad of fila.specialties) {
      const clave = especialidad.specialtyConceptId;
      const grupo = porEspecialidad.get(clave) ?? {
        nombre: etiquetas.get(clave)?.display ?? SIN_ESPECIALIDAD,
        filas: [],
      };
      grupo.filas.push(fila);
      porEspecialidad.set(clave, grupo);
    }
  }

  const grupos = [...porEspecialidad.entries()]
    .map(([conceptId, grupo]) => ({
      conceptId,
      nombre: grupo.nombre,
      profesionales: grupo.filas.map((fila) => toResultado(fila, nombres)).sort(porNombre),
    }))
    // Alfabético por especialidad: es como se hojea una guía, no por cuántos
    // tenga cada una.
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  if (sinEspecialidad.length > 0) {
    grupos.push({
      conceptId: 'sin-especialidad',
      nombre: SIN_ESPECIALIDAD,
      profesionales: sinEspecialidad.map((fila) => toResultado(fila, nombres)).sort(porNombre),
    });
  }
  return grupos;
}

function porNombre(a: SearchResultItem, b: SearchResultItem): number {
  return a.title.localeCompare(b.title, 'es');
}

/**
 * Traduce el dominio a lo que la tarjeta de resultado muestra.
 *
 * La tarjeta no conoce al dominio a propósito (ver `search-result.types.ts`):
 * recibe figura, título, líneas de contexto y sellos, y quien la usa traduce.
 *
 * El `practitionerCode` no se muestra: es un identificador de sistema, y la
 * Guía es sólo del paciente (`navigation.map.ts`, `exclusiveRoles`), así que
 * no hay a quién mostrárselo por rol (feedback de la analista F-01, 18/08/2026).
 * Sigue viajando en el DTO por si una consola de administración lo necesita.
 */
function toResultado(
  fila: PractitionerListItem,
  nombresDeOtros: readonly string[] = [],
): SearchResultItem {
  const nombre = fila.displayName ?? 'Profesional sin nombre registrado';
  const meta = [];
  // El subtítulo pasa por el guardia de F-25: una tarjeta sin subtítulo es más
  // pobre, una con el nombre de otro es una guía que miente.
  const subtitulo = subtituloProfesional(fila.professionalTitle, nombre, nombresDeOtros);
  if (subtitulo !== undefined) {
    meta.push({ text: subtitulo });
  }

  const sellos = [];
  // Disponibilidad con palabras: es lo que decide si quien busca puede pedir
  // turno, y decirlo sólo con color lo deja fuera de un lector de pantalla.
  sellos.push(
    fila.acceptsNewPatients
      ? { label: 'Acepta pacientes nuevos', tone: 'ok' as const }
      : { label: 'No toma pacientes nuevos', tone: 'neutro' as const },
  );
  if (fila.telehealthAvailable) {
    sellos.push({ label: 'Telemedicina', tone: 'info' as const });
  }

  return {
    id: fila.profileId,
    title: nombre,
    link: `/directory/${fila.profileId}`,
    figureText: iniciales(nombre),
    meta,
    seals: sellos,
  };
}

/** Hasta dos iniciales del nombre, para el cuadrado sin foto. */
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter((parte) => /\p{L}/u.test(parte))
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('');
}
