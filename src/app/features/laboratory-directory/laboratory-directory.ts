import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { DiagnosticUnitsClient } from '../../core/data-access/diagnostic-units/diagnostic-units.client';
import type {
  DiagnosticUnitSearchItem,
  DiagnosticUnitSearchQuery,
} from '../../core/data-access/diagnostic-units/diagnostic-units.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import type { SearchResultItem } from '../../shared/components/molecules/search-result/search-result.types';
import { DirectoryPage } from '../../shared/components/organisms/directory-page/directory-page';
import type {
  GrupoDeDirectorio,
  SustantivoDelDirectorio,
} from '../../shared/components/organisms/directory-page/directory-page.types';
import type { FilterDef } from '../../shared/components/organisms/filter-bar/filter-bar';

/**
 * Un tramo del directorio de laboratorios.
 *
 * Sigue siendo un alias del grupo genérico y no un tipo propio: las pruebas del
 * carril lo importan por nombre y el mapeo no cambió, sólo se mudó la forma.
 */
export type LaboratoryCategoryGroup = GrupoDeDirectorio;

/** Cómo se cuenta lo que este directorio lista. */
const SUSTANTIVO: SustantivoDelDirectorio = {
  singular: 'centro encontrado',
  plural: 'centros encontrados',
};

/**
 * Los filtros que la barra ofrece.
 *
 * Son selectores cerrados y no texto libre porque es lo que el organismo exige,
 * y porque un texto libre sobre «acepta órdenes externas» no puede resolverse a
 * nada. El término de búsqueda libre viaja aparte, bajo `q`, y el backend lo
 * aplica sobre el nombre y el código del centro.
 *
 * **Faltan tres de la especificación** —estudio, aseguradora y precio máximo— y
 * no por olvido: el endpoint los acepta, pero dibujarlos como selector exige un
 * catálogo de estudios y uno de aseguradoras que hoy no tienen lectura de
 * colección. Un campo de texto donde va un identificador sería pedirle a la
 * persona que escriba un uuid.
 */
const FILTROS: readonly FilterDef[] = [
  {
    key: 'kind',
    label: 'Tipo de centro',
    // Chips y no desplegable (A3 del plan de UX): son dos opciones, y
    // esconderlas detrás de un control que hay que abrir era la razón por la
    // que casi nadie acotaba el directorio.
    asChips: true,
    options: [
      { value: 'LABORATORY', label: 'Laboratorio clínico' },
      { value: 'IMAGING', label: 'Imagenología' },
    ],
  },
  {
    key: 'homeCollection',
    label: 'Toma a domicilio',
    // Las dos comodidades comparten renglón: son dos claves de la URL y una
    // sola pregunta de quien busca. Y van en forma **afirmativa** — «no toma a
    // domicilio» es un filtro que nadie pone a propósito, y ocupaba la mitad
    // del renglón.
    asChips: true,
    chipsGroup: 'Comodidades',
    options: [{ value: 'true', label: 'Toma a domicilio' }],
  },
  {
    key: 'walkIn',
    label: 'Atiende sin cita',
    asChips: true,
    chipsGroup: 'Comodidades',
    options: [{ value: 'true', label: 'Atiende sin cita' }],
  },
  {
    key: 'minRating',
    label: 'Calificación',
    options: [
      { value: '4.5', label: '4,5 o más' },
      { value: '4', label: '4 o más' },
      { value: '3', label: '3 o más' },
    ],
  },
];

/**
 * El buscador de centros de diagnóstico, laboratorio e imagen.
 *
 * ## Por qué busca y no lista
 *
 * Antes pedía `GET /diagnostic-units`, que devuelve el directorio **de la
 * organización de la sesión** y sin filtros. Eso contesta «qué laboratorios
 * tiene mi institución», que es una pregunta del personal. La que trae acá a un
 * paciente es otra: «dónde me hago este estudio», entre todos los centros
 * publicados y acotando por lo que le importa. La contesta
 * `GET /diagnostic-units/search`, que no se acota al tenant y sí acepta filtros.
 *
 * ## La URL manda
 *
 * El filtrado vive en los query params, no en una copia local: recargar o
 * compartir el enlace reproduce exactamente la misma búsqueda, y el `back` del
 * navegador no deja la barra mostrando algo distinto de lo que se consultó. Lo
 * resuelve `FilterBar`; esta pantalla sólo reacciona a lo que emite.
 *
 * ## Sin reseñas no es cero
 *
 * Un centro recién publicado no tiene calificación, y eso no es una nota baja.
 * La tarjeta lo dice con palabras («sin calificaciones») en vez de mostrar un
 * cero que el centro no se ganó.
 */
@Component({
  selector: 'app-laboratory-directory',
  imports: [DirectoryPage],
  templateUrl: './laboratory-directory.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryDirectory {
  private readonly units = inject(DiagnosticUnitsClient);

  protected readonly filtros = FILTROS;
  protected readonly sustantivo = SUSTANTIVO;

  protected readonly state = signal<ViewState<readonly LaboratoryCategoryGroup[]>>(loading());
  protected readonly groups = computed(() => dataOf(this.state()) ?? []);

  /** Los filtros vigentes, tal como los emitió la barra. */
  private activos: Readonly<Record<string, string>> = {};

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  /** La barra cambió: se rehace la búsqueda con lo que quedó activo. */
  protected filtrar(activos: Readonly<Record<string, string>>): void {
    this.activos = activos;
    this.load();
  }

  private load(): void {
    this.state.set(loading());
    this.units.search(aConsulta(this.activos)).subscribe({
      next: (pagina) => {
        this.state.set(
          pagina.items.length === 0
            ? empty(
                { label: 'Volver al panel', route: '/dashboard' },
                hayFiltros(this.activos)
                  ? 'Ningún centro verificado coincide con esa búsqueda. Probá quitando algún filtro.'
                  : 'Todavía no hay centros verificados publicados.',
              )
            : ready(groupUnits(pagina.items)),
        );
      },
      error: (error: unknown) =>
        this.state.set(errorToViewState<readonly LaboratoryCategoryGroup[]>(error)),
    });
  }
}

/** ¿Quedó algún filtro puesto? Decide qué texto muestra el vacío. */
function hayFiltros(activos: Readonly<Record<string, string>>): boolean {
  return Object.values(activos).some((valor) => valor !== '');
}

/**
 * Los filtros de la barra como consulta del buscador.
 *
 * Las claves coinciden con las del contrato a propósito —`kind`, `walkIn`,
 * `homeCollection`, `minRating`, `q`— así que la traducción es sólo de tipo: el
 * organismo entrega texto y el cliente pide booleanos y números. Una clave que
 * no se reconoce se descarta en vez de viajar: el backend valida con
 * `forbidNonWhitelisted` y la rechazaría con un 400.
 */
export function aConsulta(
  activos: Readonly<Record<string, string>>,
): DiagnosticUnitSearchQuery {
  const consulta: {
    -readonly [K in keyof DiagnosticUnitSearchQuery]: DiagnosticUnitSearchQuery[K];
  } = {};
  if (activos['q'] !== undefined && activos['q'] !== '') {
    consulta.q = activos['q'];
  }
  if (activos['kind'] === 'LABORATORY' || activos['kind'] === 'IMAGING') {
    consulta.kind = activos['kind'];
  }
  for (const clave of ['homeCollection', 'walkIn'] as const) {
    const valor = activos[clave];
    if (valor === 'true' || valor === 'false') {
      consulta[clave] = valor === 'true';
    }
  }
  const nota = Number(activos['minRating']);
  if (activos['minRating'] !== undefined && activos['minRating'] !== '' && !Number.isNaN(nota)) {
    consulta.minRating = nota;
  }
  return consulta;
}

export function groupUnits(
  units: readonly DiagnosticUnitSearchItem[],
): readonly LaboratoryCategoryGroup[] {
  const groups = new Map<string, DiagnosticUnitSearchItem[]>();
  for (const unit of units) {
    const current = groups.get(unit.type.code) ?? [];
    current.push(unit);
    groups.set(unit.type.code, current);
  }
  return [...groups.entries()]
    .map(([code, rows]) => ({
      id: code,
      nombre: categoryName(code, rows[0]?.type.display ?? 'Otra categoría'),
      resultados: rows.map(toSearchResult).sort((a, b) => a.title.localeCompare(b.title, 'es')),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function categoryName(code: string, fallback: string): string {
  if (code === 'DU_TYPE_LAB') return 'Laboratorio clínico';
  if (code === 'DU_TYPE_IMAGING') return 'Imagenología diagnóstica';
  return fallback;
}

function toSearchResult(unit: DiagnosticUnitSearchItem): SearchResultItem {
  const seals = [];
  if (unit.walkInAvailable) seals.push({ label: 'Atención sin cita', tone: 'ok' as const });
  if (unit.homeCollectionAvailable) {
    seals.push({ label: 'Toma a domicilio', tone: 'info' as const });
  }
  if (unit.acceptsExternalOrders) {
    seals.push({ label: 'Recibe órdenes externas', tone: 'neutro' as const });
  }
  return {
    id: unit.id,
    title: unit.name,
    link: `/laboratory-directory/${unit.id}`,
    figureText: initials(unit.name),
    kind: { label: categoryName(unit.type.code, unit.type.display), tone: 'info' },
    meta: [
      { text: `Código ${unit.code}` },
      { text: `${unit.siteCount} ${unit.siteCount === 1 ? 'sede' : 'sedes'}` },
      { text: `${unit.studyCount} ${unit.studyCount === 1 ? 'estudio' : 'estudios'}` },
      { text: `${unit.equipmentCount} ${unit.equipmentCount === 1 ? 'equipo' : 'equipos'}` },
      { text: calificacion(unit) },
    ],
    seals,
  };
}

/**
 * Cómo se dice la calificación.
 *
 * «Sin calificaciones» y no «0»: un centro recién publicado no tiene una nota
 * mala, tiene ninguna, y mostrarlo como cero lo castigaría por ser nuevo.
 */
function calificacion(unit: DiagnosticUnitSearchItem): string {
  if (unit.rating === null || unit.ratingCount === 0) {
    return 'Sin calificaciones';
  }
  const nota = unit.rating.toFixed(1).replace('.', ',');
  return `${nota} · ${unit.ratingCount} ${unit.ratingCount === 1 ? 'reseña' : 'reseñas'}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
