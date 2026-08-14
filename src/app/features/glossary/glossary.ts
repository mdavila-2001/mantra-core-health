import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type {
  ConceptSearchPage,
  ValueSetOption,
} from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Card } from '../../shared/components/molecules/card/card';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Tope de resultados. La API aplica 50 por omisión y admite más. */
const TOPE = 50;

/**
 * Glosario — carril 2, punto 4 del reclamo.
 *
 * ## Por qué existe una pantalla nueva y no basta con abrirle la puerta a `TerminologyCatalog`
 *
 * `TerminologyCatalog` (`features/admin/terminology/`) ya resuelve el mismo
 * `GET /terminology/concepts?q=` y sigue siendo **suya**: es un buscador
 * técnico de `conceptId` pensado para configuración («qué uuid mandar»), y esa
 * pantalla lo dice explícitamente. Reutilizar el componente para consulta
 * clínica habría significado esconder columnas a fuerza de flags, o mostrar
 * el uuid a quien sólo quiere entender una palabra. Dos audiencias, dos
 * pantallas — mismo cliente (`TerminologyClient`, sin tocar) por debajo.
 *
 * ## Quién la ve
 *
 * `navigation.map.ts` la deja **sin roles**, a pedido explícito del cliente: el
 * glosario es para cualquier profesional de salud en consulta, no sólo para
 * quien administra. La lectura del catálogo tampoco exige rol — UC-03-13 lo
 * declara así — así que no hay puerta del backend que abrir, sólo la del menú.
 *
 * ## Lenguaje llano, sin `conceptId`
 *
 * A diferencia del catálogo de administración, acá el identificador no se
 * muestra: no es el dato que alguien en consulta vino a buscar, y un uuid en
 * pantalla no ayuda a nadie que no vaya a pegarlo en un formulario.
 */
@Component({
  selector: 'app-glossary',
  imports: [Card, DataTable, PageHeader, SearchField],
  templateUrl: './glossary.html',
  styleUrl: './glossary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Glossary {
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly celdaTermino =
    viewChild.required<TemplateRef<{ $implicit: ValueSetOption }>>('celdaTermino');

  protected readonly resultados = signal<ViewState<readonly ValueSetOption[]>>(loading());

  /** El filtro vigente, leído de la URL. Vacío es «sin filtro», no «buscar nada». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  /** Cuántos devolvió la API, que puede ser más de los que caben en el tope. */
  private readonly total = signal<number | null>(null);

  /** Si la respuesta llegó recortada por el tope — mismo criterio que el catálogo de administración. */
  protected readonly recortado = computed(() => {
    const total = this.total();
    return total !== null && total > TOPE;
  });

  protected readonly totalDeclarado = this.total.asReadonly();
  protected readonly tope = TOPE;

  protected readonly columnas = computed<readonly ColumnDef<ValueSetOption>[]>(() => [
    { key: 'display', header: 'Término', priority: 1, cell: this.celdaTermino() },
    { key: 'definition', header: 'Qué significa', priority: 2 },
  ]);

  protected readonly porConcepto = (row: ValueSetOption): string => row.conceptId;

  protected readonly cargando = computed(() => this.resultados().status === 'loading');

  constructor() {
    effect(() => {
      this.busqueda();
      untracked(() => this.cargar());
    });
  }

  /** La búsqueda se publica en la URL; el efecto hace el resto. */
  protected buscar(texto: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: texto === '' ? {} : { q: texto },
      // Reemplaza en vez de apilar: cada tecleo no es un paso del historial.
      replaceUrl: true,
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.resultados.set(loading());

    const texto = this.busqueda();

    this.terminology
      .searchConcepts({ limit: TOPE, ...(texto === '' ? {} : { query: texto }) })
      .subscribe({
        next: (pagina) => {
          this.total.set(pagina.count);
          this.resultados.set(this.estadoDe(pagina));
        },
        error: (error: unknown) => {
          this.total.set(null);
          this.resultados.set(errorToViewState<readonly ValueSetOption[]>(error));
        },
      });
  }

  /** De la página al estado. Mismo criterio que el catálogo de administración. */
  private estadoDe(pagina: ConceptSearchPage): ViewState<readonly ValueSetOption[]> {
    if (pagina.items.length > 0) {
      return ready(pagina.items);
    }

    return this.busqueda() === ''
      ? empty(
          { label: 'Volver al panel', route: '/dashboard' },
          'El glosario todavía no tiene términos cargados en esta organización.',
        )
      : empty(
          { label: 'Ver todo el glosario', route: '/glossary' },
          `Ningún término coincide con «${this.busqueda()}».`,
        );
  }
}
