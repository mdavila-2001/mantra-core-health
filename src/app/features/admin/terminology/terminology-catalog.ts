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

import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type {
  ConceptSearchPage,
  ValueSetOption,
} from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Card } from '../../../shared/components/molecules/card/card';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Tope de resultados. La API aplica 50 por omisión y admite más. */
const TOPE = 50;

/**
 * Catálogo de terminología — la sección **M03** que hasta ahora era un cartel.
 *
 * ## Por qué deja de ser un placeholder
 *
 * `APP_SECTIONS` la declaraba `planificada` con el motivo general del vault:
 * «674 de 693 vistas están marcadas *Listado pendiente*, se pueden diseñar pero
 * no implementar hasta que el backend exponga el `GET` de colección». Para esta
 * sección **ese `GET` ya existía**: `GET /terminology/concepts` (UC-03-13) busca
 * por código o denominación, y no exige rol de administración porque el catálogo
 * es metadato compartido sin datos de paciente.
 *
 * Lo que faltaba no era backend: era que `TerminologyClient` sólo implementaba
 * **la mitad** del endpoint. Usaba `?ids=` —el camino concepto → etiqueta, el que
 * necesita cualquier pantalla que muestre lo que el contrato devuelve— y nunca
 * `?q=`, el camino inverso. Con las dos, la sección se enciende.
 *
 * ## Para qué sirve de verdad
 *
 * Todo el contrato viaja con `*ConceptId` en uuid: estados, ciclos de vida,
 * clasificaciones. Cuando algo no cuadra —una ficha que muestra «Sin determinar»,
 * un alta que rechaza un concepto— la pregunta es siempre la misma: *qué uuid es
 * éste, y qué uuid tengo que mandar*. Sin esta pantalla eso se responde con
 * `curl`, y quien administra la organización no tiene `curl`.
 *
 * Por eso la tabla muestra el `conceptId` completo y seleccionable en vez de
 * esconderlo: **es el dato que se vino a buscar**, no ruido técnico.
 *
 * ## La búsqueda vive en la URL
 *
 * `?q=`, igual que el listado de pacientes y por las mismas tres razones: el
 * enlace se comparte con el filtro puesto, «atrás» deshace la búsqueda, y el
 * vacío por filtro puede ofrecer una salida que de verdad funciona.
 */
@Component({
  selector: 'app-terminology-catalog',
  imports: [Badge, Card, DataTable, PageHeader, SearchField],
  templateUrl: './terminology-catalog.html',
  styleUrl: './terminology-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerminologyCatalog {
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly celdaConcepto =
    viewChild.required<TemplateRef<{ $implicit: ValueSetOption }>>('celdaConcepto');
  private readonly celdaId =
    viewChild.required<TemplateRef<{ $implicit: ValueSetOption }>>('celdaId');
  private readonly celdaUso =
    viewChild.required<TemplateRef<{ $implicit: ValueSetOption }>>('celdaUso');

  protected readonly resultados = signal<ViewState<readonly ValueSetOption[]>>(loading());

  /** El filtro vigente, leído de la URL. Vacío es «sin filtro», no «buscar nada». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  /** Cuántos devolvió la API, que puede ser más de los que caben en el tope. */
  private readonly total = signal<number | null>(null);

  /**
   * Si la respuesta llegó recortada por el tope.
   *
   * La API no publica cursor para esta búsqueda —acotar hasta encontrar no es
   * pasear por el catálogo— así que cuando hay más de los que entran, lo único
   * honesto es decirlo y sugerir afinar el texto. Callarlo haría creer que el
   * catálogo tiene exactamente cincuenta conceptos.
   */
  protected readonly recortado = computed(() => {
    const total = this.total();
    return total !== null && total > TOPE;
  });

  protected readonly totalDeclarado = this.total.asReadonly();
  protected readonly tope = TOPE;

  protected readonly columnas = computed<readonly ColumnDef<ValueSetOption>[]>(() => [
    { key: 'display', header: 'Denominación', priority: 1, cell: this.celdaConcepto() },
    { key: 'code', header: 'Código', priority: 1 },
    // Prioridad 2: en móvil cae a la fila de detalle en vez de ocultarse, que es
    // la regla del M34. Y es justo el dato que se vino a copiar, así que
    // esconderlo del todo dejaría la pantalla sin su motivo.
    { key: 'conceptId', header: 'Identificador de concepto', priority: 2, cell: this.celdaId() },
    { key: 'selectable', header: 'Uso', priority: 2, cell: this.celdaUso() },
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

  /**
   * De la página al estado.
   *
   * El vacío distingue los dos casos que se viven distinto: el catálogo no tiene
   * conceptos cargados —que en una organización recién creada es lo normal— o
   * los tiene pero ninguno casa con el texto. Ofrecer «ver todo» cuando en
   * realidad no hay nada mandaría a otra pantalla igual de vacía.
   */
  private estadoDe(pagina: ConceptSearchPage): ViewState<readonly ValueSetOption[]> {
    if (pagina.items.length > 0) {
      return ready(pagina.items);
    }

    return this.busqueda() === ''
      ? // Sin conceptos no hay nada que hacer **acá**: el catálogo lo carga el
        // backend, no esta pantalla. La salida es irse, y decirlo es más honesto
        // que ofrecer una acción que no existe.
        empty(
          { label: 'Volver al panel', route: '/dashboard' },
          'El catálogo de esta organización todavía no tiene conceptos cargados.',
        )
      : empty(
          { label: 'Ver todo el catálogo', route: '/administration/terminology' },
          `Ningún concepto coincide con «${this.busqueda()}».`,
        );
  }
}
