import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of, switchMap, type Observable } from 'rxjs';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { PractitionerListItem } from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { SearchResult } from '../../../shared/components/molecules/search-result/search-result';
import type { SearchResultItem } from '../../../shared/components/molecules/search-result/search-result.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

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

/** Encabezado de la guía: una especialidad y quiénes la ejercen. */
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
  imports: [PageHeader, SearchField, SearchResult, ViewStateHost],
  templateUrl: './practitioners-directory.html',
  styleUrl: './practitioners-directory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionersDirectory {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);

  protected readonly estado = signal<ViewState<readonly GrupoDeEspecialidad[]>>(loading());

  /** Filtro en memoria: la guía ya está entera en pantalla. */
  protected readonly filtro = signal('');

  /** Si se cortó por el techo de páginas, para poder decirlo. */
  protected readonly recortada = signal(false);

  protected readonly grupos = computed<readonly GrupoDeEspecialidad[]>(() => {
    const todos = dataOf(this.estado()) ?? [];
    const busqueda = this.filtro().trim().toLowerCase();
    if (busqueda === '') {
      return todos;
    }
    // Se filtran los profesionales y se descartan los grupos que quedan
    // vacíos: un encabezado de especialidad sin nadie debajo es ruido.
    return todos
      .map((grupo) => ({
        ...grupo,
        profesionales: grupo.profesionales.filter((profesional) =>
          coincide(profesional, busqueda),
        ),
      }))
      .filter((grupo) => grupo.profesionales.length > 0);
  });

  protected readonly total = computed(() =>
    this.grupos().reduce((suma, grupo) => suma + grupo.profesionales.length, 0),
  );

  /** Hay guía, pero el filtro no dejó a nadie. Es distinto de no haber guía. */
  protected readonly sinCoincidencias = computed(
    () => this.filtro().trim() !== '' && this.grupos().length === 0,
  );

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

/** Si el profesional casa con el texto del filtro. */
function coincide(profesional: SearchResultItem, busqueda: string): boolean {
  if (profesional.title.toLowerCase().includes(busqueda)) {
    return true;
  }
  return (profesional.meta ?? []).some((linea) => linea.text.toLowerCase().includes(busqueda));
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
      profesionales: grupo.filas.map(toResultado).sort(porNombre),
    }))
    // Alfabético por especialidad: es como se hojea una guía, no por cuántos
    // tenga cada una.
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  if (sinEspecialidad.length > 0) {
    grupos.push({
      conceptId: 'sin-especialidad',
      nombre: SIN_ESPECIALIDAD,
      profesionales: sinEspecialidad.map(toResultado).sort(porNombre),
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
function toResultado(fila: PractitionerListItem): SearchResultItem {
  const nombre = fila.displayName ?? 'Profesional sin nombre registrado';
  const meta = [];
  if (fila.professionalTitle !== undefined && fila.professionalTitle !== '') {
    meta.push({ text: fila.professionalTitle });
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
