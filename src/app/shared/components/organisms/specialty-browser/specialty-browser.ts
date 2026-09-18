import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  inject,
  input,
  output,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { AppButton } from '../../atoms/button/button';
import { Skeleton } from '../../atoms/skeleton/skeleton';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { FilterBar, SEARCH_PARAM, type FilterDef } from '../filter-bar/filter-bar';
import { ViewStateHost } from '../view-state-host/view-state-host';
import type { SpecialtyGroup, SpecialtyItemContext } from './specialty-browser.types';

/** Instancias vivas, para que dos exploradores en la misma página no repitan ids. */
let nextInstanceId = 0;

/**
 * Explorar un catálogo **agrupado por especialidad**: buscador y filtros
 * arriba, y debajo una grilla con un encabezado por tramo.
 *
 * ```html
 * <app-specialty-browser [state]="catalogo()" [groups]="grupos()" [filters]="filtros">
 *   <ng-template let-formulario>
 *     <app-card>…</app-card>
 *   </ng-template>
 * </app-specialty-browser>
 * ```
 *
 * ## Qué no hace
 *
 * **No pide datos, no agrupa y no filtra.** Recibe el {@link ViewState} ya
 * resuelto y los grupos ya armados, y avisa hacia afuera cuando los filtros
 * cambian. Quién filtra —el servidor o la propia pantalla sobre lo que ya
 * tiene— es una decisión de cada consumidor, y no se puede unificar sin
 * empeorar a alguno.
 *
 * **Tampoco dibuja la tarjeta.** El consumidor proyecta un `ng-template` y el
 * organismo lo estampa por ítem con el {@link SpecialtyItemContext}. Por eso no
 * hay un evento de «elegí este»: las acciones viven en la tarjeta, donde está
 * el tipo real del ítem y el servicio que sabe atenderlas.
 *
 * ## Por qué se separó de la página de directorio
 *
 * `app-directory-page` es una **pantalla**: pone el encabezado, exige título y
 * bajada, y dibuja su propia tarjeta de resultado. Esto es una **sección
 * embebible**, que se monta dentro de una pantalla que ya tiene su encabezado
 * —el catálogo de formularios es la última sección de la de plantillas— y que
 * necesita tarjetas con acciones propias.
 */
@Component({
  selector: 'app-specialty-browser',
  imports: [AppButton, FilterBar, NgTemplateOutlet, Skeleton, ViewStateHost],
  templateUrl: './specialty-browser.html',
  styleUrl: './specialty-browser.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'specialty-browser',
  },
})
export class SpecialtyBrowser<T> {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = input.required<ViewState<unknown>>();
  readonly groups = input.required<readonly SpecialtyGroup<T>[]>();
  readonly filters = input<readonly FilterDef[]>([]);
  readonly searchLabel = input('Buscar por nombre o especialidad');

  /**
   * Qué decir cuando hay catálogo pero el filtro vigente no dejó nada.
   *
   * **No es el vacío del `ViewState`**: «todavía no hay nada cargado» y «tu
   * búsqueda no encontró nada» llevan a acciones distintas —esperar, o probar
   * otra palabra—, así que se dicen distinto.
   */
  readonly noMatchesText = input(
    'Nada coincide con lo que buscaste. Probá con otra palabra o quitá los filtros.',
  );

  /** Si el consumidor sabe que hay más para traer: al pie, «Cargar más». */
  readonly hasMore = input(false);

  /**
   * Grupos plegables (refactor UX). Con el catálogo entero abierto, «Formularios
   * clínicos» medía 26 792 px: la persona tenía que recorrer todas las
   * especialidades para llegar a la suya. Plegados, la lista de especialidades
   * con su cuenta ES el índice. `<details>` nativo: teclado y lector de pantalla
   * sin código propio. El primero viene abierto.
   */
  readonly collapsible = input(false);

  /** Abre todos los grupos: el consumidor lo prende mientras hay una búsqueda. */
  readonly expandAll = input(false);

  /** Los códigos activos, incluido el término de búsqueda. Viene del filtro. */
  readonly filtersChanged = output<Readonly<Record<string, string>>>();

  /** S8 y S9: la persona pide reintentar, y el dueño de los datos ejecuta. */
  readonly retry = output<void>();

  readonly moreRequested = output<void>();

  /**
   * La tarjeta del consumidor. Obligatoria: sin ella el explorador no tiene
   * nada que dibujar, y fallar al montarlo es mejor que una grilla vacía que
   * parece un problema de datos.
   */
  protected readonly itemTemplate =
    contentChild.required<TemplateRef<SpecialtyItemContext<T>>>(TemplateRef);

  private readonly instanceId = `specialty-browser-${(nextInstanceId += 1)}`;

  /**
   * Lo puesto en la URL, que es donde `app-filter-bar` guarda el estado.
   *
   * Se lee de ahí y no de las emisiones del filtro porque entrar por un enlace
   * ya filtrado no emite nada: con una copia local, ese caso —el de compartir
   * una búsqueda— mostraría la grilla vacía sin explicar por qué.
   */
  private readonly params = toSignal(
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)),
    { initialValue: {} as Record<string, string> },
  );

  protected readonly hasActiveFilters = computed(() => {
    const params = this.params();
    if (params[SEARCH_PARAM]) {
      return true;
    }
    return this.filters().some((filter) => Boolean(params[filter.key]));
  });

  protected readonly totalItems = computed(() =>
    this.groups().reduce((suma, group) => suma + group.items.length, 0),
  );

  /** Hay filtro puesto y no quedó nada: es un resultado, no un catálogo vacío. */
  protected readonly noMatches = computed(() => this.totalItems() === 0 && this.hasActiveFilters());

  /** Ata el encabezado del tramo con su grilla, sin chocar entre instancias. */
  protected headingId(group: SpecialtyGroup<T>): string {
    return `${this.instanceId}-${group.conceptId}`;
  }
}
