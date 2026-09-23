import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { AppButton } from '../../atoms/button/button';
import { Chip } from '../../atoms/chip/chip';
import { SearchField } from '../../molecules/search-field/search-field';
import { Select } from '../../atoms/select/select';
import type { SelectOption } from '../../atoms/select/select.types';

/** Clave del término de búsqueda en la URL. */
export const SEARCH_PARAM = 'q';

/**
 * Un filtro de value set. **Siempre selector, nunca texto libre**: todo lo que
 * en el modelo es `*_concept_id` se elige de una lista cerrada, porque un
 * texto libre no puede resolverse a un concepto.
 */
export interface FilterDef {
  /** Clave estable; es la que viaja a la URL y al backend. */
  readonly key: string;
  readonly label: string;
  /** Opciones del value set. Vacío ⇒ el filtro se muestra deshabilitado. */
  readonly options: readonly SelectOption<string>[];
  /** Motivo visible cuando el value set no está disponible. */
  readonly unavailableReason?: string;
  /**
   * Se dibuja como **una fila de chips que se tocan**, no como un desplegable.
   *
   * Lo pidió el cliente para los cuatro directorios (A3 del plan de UX del
   * 22/08/2026: «Chips de filtro»), y la diferencia no es estética: un
   * desplegable **esconde** las opciones hasta que alguien lo abre, así que
   * quien entra al directorio de laboratorios no se entera de que puede acotar
   * por categoría. Los chips las muestran, y acotar pasa a ser un toque.
   *
   * Por eso mismo es para value sets **cortos**: doce especialidades entran en
   * dos renglones, ciento veinte ciudades no. Cuando la lista es larga sigue
   * ganando el desplegable, que es el valor por omisión.
   */
  readonly asChips?: boolean;

  /**
   * Rótulo del renglón de chips en el que este filtro se dibuja.
   *
   * Los filtros que declaran el **mismo** `chipsGroup` comparten renglón y
   * encabezado. Existe porque «toma a domicilio» y «atiende sin cita» son dos
   * claves distintas de la URL y una sola pregunta de la persona —«¿qué
   * comodidades?»—, y darles un encabezado a cada una ponía dos renglones que
   * decían lo mismo dos veces.
   *
   * Sin él, cada filtro es su propio renglón, rotulado con su `label`.
   */
  readonly chipsGroup?: string;
}

/** Un renglón de chips ya resuelto: su rótulo y los filtros que lo componen. */
export interface ChipGroup {
  readonly label: string;
  readonly filters: readonly FilterDef[];
}

/** Un filtro activo, listo para dibujarse como chip. */
export interface ActiveFilter {
  readonly key: string;
  readonly code: string;
  readonly label: string;
}

/**
 * Barra de filtros de un listado. **La URL es la fuente de verdad**: el
 * organismo no guarda una copia del estado, lo lee de los query params y lo
 * escribe ahí. Recargar o compartir el enlace reproduce el filtrado exacto,
 * que es lo que pide el M34.
 *
 * ```html
 * <app-filter-bar [filters]="filtros" (filtersChanged)="recargar($event)" />
 * ```
 *
 * Cada chip activo muestra la **etiqueta legible** y emite el **código**: las
 * etiquetas son presentación y cambian con el value set o el idioma.
 *
 * **Receta de buscador multicampo** (ADR-0015, regla 5): el organismo emite
 * un único término normalizado bajo `q` — filtrar por varios campos a la vez
 * es responsabilidad del consumidor, no de la barra:
 *
 * ```ts
 * const termino = normalizar(this.filtersChanged$().q ?? '');
 * this.filas = this.todas.filter((fila) =>
 *   normalizar(fila.nombre).includes(termino) || normalizar(fila.direccion).includes(termino),
 * );
 * ```
 *
 * **Hueco de acción** (regla 5): un botón proyectado con `filter-bar-action`
 * queda a la derecha de la fila de controles en escritorio y debajo en
 * móvil:
 *
 * ```html
 * <app-filter-bar [filters]="filtros" (filtersChanged)="recargar($event)">
 *   <button filter-bar-action app-button variant="primary" (clicked)="abrirAlta()">
 *     <svg app-icon>…</svg>
 *     Agregar
 *   </button>
 * </app-filter-bar>
 * ```
 */
@Component({
  selector: 'app-filter-bar',
  imports: [AppButton, Chip, SearchField, Select],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'filter-bar',
  },
})
export class FilterBar {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly filters = input<readonly FilterDef[]>([]);
  readonly searchLabel = input<string>('Buscar en el listado');

  /**
   * El texto de ejemplo dentro del campo. Por omisión, el del átomo.
   *
   * No es decoración: en un glosario médico, «Por ejemplo "hipertensión",
   * "disnea" o "paracetamol"» es lo que dice **por qué datos** se puede buscar,
   * que es justo lo que un campo vacío rotulado «Buscar» no dice. El rótulo
   * accesible sigue siendo `searchLabel`.
   */
  readonly searchPlaceholder = input<string>('Buscar');

  /**
   * Si la consulta está viajando. Pone el `app-spinner` del campo.
   *
   * Lo sabe quien muestra los resultados, no la barra: ella publica el filtro
   * en la URL y ahí termina su trabajo.
   */
  readonly searchLoading = input(false, { transform: booleanAttribute });

  /** Los códigos activos, incluido el término de búsqueda bajo `q`. */
  readonly filtersChanged = output<Readonly<Record<string, string>>>();

  /**
   * Estado leído de la URL. No hay copia local: si existiera, un `back` del
   * navegador dejaría la barra mostrando algo distinto de lo que se consultó.
   */
  private readonly params = toSignal(
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)),
    { initialValue: {} as Record<string, string> },
  );

  protected readonly searchTerm = computed(() => this.params()[SEARCH_PARAM] ?? '');

  /** Los filtros con opciones; sin ellas el value set no llegó. */
  protected isAvailable(filter: FilterDef): boolean {
    return filter.options.length > 0;
  }

  protected valueOf(filter: FilterDef): string | null {
    return this.params()[filter.key] ?? null;
  }

  /** Chips de lo activo, con la etiqueta legible del value set. */
  readonly activeFilters = computed<readonly ActiveFilter[]>(() => {
    const params = this.params();
    return this.filters()
      .map((filter) => {
        const code = params[filter.key];
        if (!code) {
          return null;
        }
        const option = filter.options.find((candidate) => candidate.value === code);
        return {
          key: filter.key,
          code,
          // Sin etiqueta en el value set se muestra el código: mentir con una
          // etiqueta inventada sería peor.
          label: `${filter.label}: ${option?.label ?? code}`,
        };
      })
      .filter((active): active is ActiveFilter => active !== null);
  });

  protected readonly hasActiveFilters = computed(
    () => this.activeFilters().length > 0 || this.searchTerm() !== '',
  );

  /** Los filtros que se dibujan como desplegable, que sigue siendo lo normal. */
  protected readonly selectFilters = computed(() =>
    this.filters().filter((filtro) => filtro.asChips !== true),
  );

  /**
   * Los renglones de chips, ya agrupados por {@link FilterDef.chipsGroup}.
   *
   * Se conserva el orden de declaración: el primer filtro de cada grupo fija
   * dónde aparece el renglón, así que reordenar la pantalla es reordenar el
   * array de filtros y nada más.
   */
  protected readonly chipGroups = computed<readonly ChipGroup[]>(() => {
    const grupos: { label: string; filters: FilterDef[] }[] = [];
    for (const filtro of this.filters()) {
      if (filtro.asChips !== true) {
        continue;
      }
      const rotulo = filtro.chipsGroup ?? filtro.label;
      const existente = grupos.find((grupo) => grupo.label === rotulo);
      if (existente === undefined) {
        grupos.push({ label: rotulo, filters: [filtro] });
      } else {
        existente.filters.push(filtro);
      }
    }
    return grupos;
  });

  /** Si esa opción es la que está puesta hoy para ese filtro. */
  protected isChipSelected(filter: FilterDef, code: string): boolean {
    return this.valueOf(filter) === code;
  }

  /**
   * Alterna un chip de filtro.
   *
   * Tocar el que ya está puesto lo **quita**, que es lo que espera cualquiera
   * que haya usado un filtro de chips: si el único modo de sacarlo fuera el
   * chip de «activos» de abajo, un toque de más dejaría a la persona sin
   * salida visible.
   *
   * Un filtro, un valor: el segundo chip reemplaza al primero. La selección
   * múltiple exigiría que la URL llevara listas y que el backend aceptara
   * `?tipo=a,b`, y hoy ninguno de los dos lo hace — ofrecerla en la pantalla
   * sería prometer un filtrado que la respuesta no aplica.
   */
  protected toggleChip(filter: FilterDef, code: string): void {
    this.applyParams({ [filter.key]: this.isChipSelected(filter, code) ? null : code }, false);
  }

  /** Mientras se tipea se reemplaza la entrada del historial: no se ensucia. */
  protected onSearch(term: string): void {
    this.applyParams({ [SEARCH_PARAM]: term || null }, true);
  }

  /** Elegir un filtro es una decisión: queda en el historial. */
  protected onFilterChange(filter: FilterDef, code: string | null): void {
    this.applyParams({ [filter.key]: code }, false);
  }

  protected removeFilter(active: ActiveFilter): void {
    this.applyParams({ [active.key]: null }, false);
  }

  protected clearAll(): void {
    const vacios: Record<string, null> = { [SEARCH_PARAM]: null };
    for (const filter of this.filters()) {
      vacios[filter.key] = null;
    }
    this.applyParams(vacios, false);
  }

  private applyParams(changes: Record<string, string | null>, replaceUrl: boolean): void {
    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: changes,
        queryParamsHandling: 'merge',
        replaceUrl,
      })
      .then(() => this.emitCurrent());
  }

  private emitCurrent(): void {
    const activos: Record<string, string> = {};
    const term = this.searchTerm();
    if (term) {
      activos[SEARCH_PARAM] = term;
    }
    for (const active of this.activeFilters()) {
      // El CÓDIGO, no la etiqueta: es lo único estable.
      activos[active.key] = active.code;
    }
    this.filtersChanged.emit(activos);
  }
}
