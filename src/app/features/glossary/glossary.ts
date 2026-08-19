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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type {
  GlossaryTag,
  GlossaryTerm,
  GlossaryTermPage,
} from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Chip } from '../../shared/components/atoms/chip/chip';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  glossaryCategoryOrder,
  isGlossaryCategoryCode,
  GlossaryCategoryIcon,
} from './glossary-category-icon';

/**
 * Tope de términos por lectura de la tabla (categoría o búsqueda).
 *
 * La API acota a 500; 200 cubre con holgura cualquier categoría del catálogo
 * clínico y sigue avisando cuando algo quedó afuera — ver {@link recortado}.
 */
const TOPE = 200;

/** Tope de conjuntos de valores al leer las categorías. El catálogo tiene un puñado. */
const TOPE_CATEGORIAS = 200;

/**
 * Glosario — reconstrucción completa, punto 6 del reclamo, tercera ronda.
 *
 * ## Qué cambió, y por qué
 *
 * La ronda anterior armó un glosario que se hojea por etiquetas sueltas y un
 * índice alfabético, sin tabla, porque el cliente había rechazado por escrito
 * «una tabla simplona». El cliente **volvió a corregir el rumbo**, esta vez con
 * instrucciones más precisas: quiere un diccionario médico **por categorías**,
 * en grilla, con íconos y conteo — y recién cuando se escribe algo, una tabla
 * de resultados. La instrucción nueva es más reciente y más específica que la
 * que motivó la ronda anterior, así que manda.
 *
 * - **Landing = grilla de categorías.** Once categorías clínicas
 *   (`glossary-category-*`), cada una con su ícono y su conteo de términos —
 *   el mismo dato (`memberCount`) que antes se mostraba en un chip. No hace
 *   falta traer términos para pintar la grilla: alcanza con `listValueSets()`.
 * - **Entrar a una categoría, o escribir una búsqueda, cambia a tabla.** Es
 *   la misma tabla (`app-data-table`, la que ya usa el catálogo de
 *   administración) para las dos entradas: term, categoría, definición breve,
 *   etiquetas y relaciones. El cliente pidió explícitamente una tabla acá —
 *   la objeción anterior era sobre la **landing**, no sobre esta pantalla.
 * - **Las etiquetas clínicas** (`glossary-tag-*`, 15 en total) ya no son una
 *   forma de navegar: son metadato de cada término, visible como chips en la
 *   fila y en la ficha, pero no un filtro con su propia URL. La instrucción
 *   nueva las pide como «tags por término», no como puerta de entrada.
 *
 * ## Qué se conservó
 *
 * El filtro en la URL (`q`, y ahora `category` en vez de `etiqueta`) sigue
 * publicado con `replaceUrl`, así que un glosario filtrado por categoría o por
 * texto se sigue compartiendo por enlace. El aviso de recorte y los vacíos
 * distintos según qué se estaba mirando también se conservan — esa mecánica
 * nunca fue lo que el cliente objetó.
 *
 * ## La decisión de ruteo: query param, no ruta hija
 *
 * «Entrar a una categoría» viaja como `?category=<internalCode>` en la misma
 * ruta `/glossary`, igual que `?q=` y que la vieja `?etiqueta=`. Es el patrón
 * ya establecido en esta pantalla y en `terminology-catalog.ts`: un único
 * componente que lee sus filtros de la URL con `queryParamMap` y
 * `queryParamsHandling: 'merge'`. Una ruta hija (`/glossary/category/:code`)
 * hubiera exigido un componente nuevo casi idéntico a éste, más lógica para
 * decidir cuál de los dos manda cuando además hay `q` — exactamente el problema
 * que el query param ya resuelve solo, porque los dos filtros conviven en el
 * mismo lugar.
 *
 * ## Quién la ve
 *
 * `navigation.map.ts` la deja sin roles — no se toca, el pedido fue explícito
 * y la lectura del catálogo tampoco los exige.
 */
@Component({
  selector: 'app-glossary',
  imports: [Chip, DataTable, GlossaryCategoryIcon, PageHeader, RouterLink, SearchField, ViewStateHost],
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
    viewChild.required<TemplateRef<{ $implicit: GlossaryTerm }>>('celdaTermino');
  private readonly celdaCategoria =
    viewChild.required<TemplateRef<{ $implicit: GlossaryTerm }>>('celdaCategoria');
  private readonly celdaDefinicion =
    viewChild.required<TemplateRef<{ $implicit: GlossaryTerm }>>('celdaDefinicion');
  private readonly celdaEtiquetas =
    viewChild.required<TemplateRef<{ $implicit: GlossaryTerm }>>('celdaEtiquetas');
  private readonly celdaRelaciones =
    viewChild.required<TemplateRef<{ $implicit: GlossaryTerm }>>('celdaRelaciones');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: GlossaryTerm }>>('celdaEstado');

  protected readonly categorias = signal<ViewState<readonly GlossaryTag[]>>(loading());
  protected readonly terminos = signal<ViewState<readonly GlossaryTerm[]>>(loading());

  /** El texto buscado, leído de la URL. Vacío es «sin filtro», no «buscar nada». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  /**
   * La categoría por la que se está navegando, por su código interno.
   *
   * En la URL viaja el código (`category=glossary-category-disease`) y no el
   * uuid: un enlace compartido tiene que seguir sirviendo cuando el uuid del
   * value set ya no sea el mismo.
   */
  protected readonly categoriaCodigo = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('category') ?? '')),
    { initialValue: '' },
  );

  /** Si hay algo que buscar o filtrar: la señal que decide grilla vs. tabla. */
  protected readonly mostrarTabla = computed(
    () => this.busqueda() !== '' || this.categoriaCodigo() !== '',
  );

  /** Cuántos términos devolvió la API, que puede ser más de los que caben en el tope. */
  private readonly total = signal<number | null>(null);

  protected readonly recortado = computed(() => {
    const total = this.total();
    return total !== null && total >= TOPE;
  });

  protected readonly totalDeclarado = this.total.asReadonly();
  protected readonly tope = TOPE;

  protected readonly cargando = computed(() => this.terminos().status === 'loading');

  /** Las categorías ya leídas, o vacío mientras no lo estén. */
  private readonly listaDeCategorias = computed<readonly GlossaryTag[]>(() => {
    const estado = this.categorias();
    return estado.status === 'ready' ? estado.data : [];
  });

  /**
   * Sólo las 11 categorías del glosario, con algo adentro, en el orden de la
   * grilla.
   *
   * `listValueSets()` lee **todo** el catálogo de conjuntos de valores de la
   * plataforma —género, estados administrativos, lo que sea—, no sólo el
   * glosario: sin el filtro por `glossary-category-*` la grilla mostraría
   * enums que no tienen nada de médico. Y una categoría con cero términos es
   * un clic a una pantalla vacía, igual que antes con las etiquetas.
   */
  protected readonly categoriasConTerminos = computed(() =>
    [
      ...this.listaDeCategorias().filter(
        (categoria) =>
          isGlossaryCategoryCode(categoria.internalCode) && (categoria.memberCount ?? 0) > 0,
      ),
    ].sort((a, b) => glossaryCategoryOrder(a.internalCode) - glossaryCategoryOrder(b.internalCode)),
  );

  /** La categoría activa resuelta contra el catálogo, o `null` si no hay filtro. */
  protected readonly categoriaActiva = computed<GlossaryTag | null>(() => {
    const codigo = this.categoriaCodigo();
    if (codigo === '') return null;
    return this.listaDeCategorias().find((c) => c.internalCode === codigo) ?? null;
  });

  /** Los términos ya leídos, o vacío mientras no lo estén. */
  private readonly listaDeTerminos = computed<readonly GlossaryTerm[]>(() => {
    const estado = this.terminos();
    return estado.status === 'ready' ? estado.data : [];
  });

  /**
   * Cuántas de las filas visibles se están mostrando sin traducir.
   *
   * Se cuenta y se dice en pantalla en vez de disimularlo. Un término sin
   * designación en castellano se muestra igual —con su nombre original— porque
   * dejarlo en blanco o inventarle uno es peor; lo que no puede pasar es que se
   * confunda con uno traducido.
   */
  protected readonly sinTraduccion = computed(
    () => this.listaDeTerminos().filter((termino) => termino.translated === false).length,
  );

  protected readonly columnas = computed<readonly ColumnDef<GlossaryTerm>[]>(() => [
    { key: 'display', header: 'Término', priority: 1, cell: this.celdaTermino() },
    { key: 'shortDefinition', header: 'Definición breve', priority: 1, cell: this.celdaDefinicion() },
    { key: 'category', header: 'Categoría', priority: 2, cell: this.celdaCategoria() },
    { key: 'tags', header: 'Etiquetas', priority: 2, cell: this.celdaEtiquetas() },
    { key: 'relationsCount', header: 'Relaciones', priority: 2, cell: this.celdaRelaciones() },
    { key: 'status', header: 'Estado', priority: 2, cell: this.celdaEstado() },
  ]);

  protected readonly porConcepto = (row: GlossaryTerm): string => row.conceptId;

  constructor() {
    this.cargarCategorias();

    effect(() => {
      const texto = this.busqueda();
      const codigo = this.categoriaCodigo();
      const enModoTabla = texto !== '' || codigo !== '';
      // Se declara la dependencia para que el efecto vuelva a correr cuando las
      // categorías terminan de llegar: con `category=` en la URL, la categoría
      // no se puede resolver a su uuid antes de tenerlas.
      const categorias = this.listaDeCategorias();
      const categoriasCargando = this.categorias().status === 'loading';

      untracked(() => {
        if (!enModoTabla) {
          // Landing: la grilla sólo necesita las categorías, ya en camino.
          return;
        }
        this.cargarTerminos(texto, codigo, categorias, categoriasCargando);
      });
    });
  }

  /** La búsqueda se publica en la URL; el efecto hace el resto. */
  protected buscar(texto: string): void {
    this.navegar({ q: texto === '' ? null : texto });
  }

  /** Entrar a una categoría desde la grilla, o cambiar de categoría desde la tabla. */
  protected elegirCategoria(internalCode: string): void {
    this.navegar({ category: internalCode });
  }

  /** Vuelve a la grilla: limpia categoría **y** texto, que es lo que dibuja la landing. */
  protected volverALaGrilla(): void {
    this.navegar({ category: null, q: null });
  }

  protected recargar(): void {
    this.cargarTerminos(
      this.busqueda(),
      this.categoriaCodigo(),
      this.listaDeCategorias(),
      this.categorias().status === 'loading',
    );
  }

  protected recargarCategorias(): void {
    this.cargarCategorias();
  }

  /**
   * Publica el filtro en la URL sin apilar historial.
   *
   * `merge` conserva el otro filtro: elegir una categoría no debe borrar lo que
   * la persona escribió, y viceversa. `replaceUrl` porque cada tecleo no es un
   * paso del historial — mismo criterio que ya tenía la búsqueda.
   */
  private navegar(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private cargarCategorias(): void {
    this.categorias.set(loading());

    this.terminology.listValueSets({ limit: TOPE_CATEGORIAS }).subscribe({
      next: (pagina) => {
        this.categorias.set(
          pagina.items.length > 0
            ? ready(pagina.items)
            : empty(
                { label: 'Volver al panel', route: '/dashboard' },
                'Todavía no hay categorías cargadas en esta organización.',
              ),
        );
      },
      error: (error: unknown) => {
        this.categorias.set(errorToViewState<readonly GlossaryTag[]>(error));
      },
    });
  }

  private cargarTerminos(
    texto: string,
    codigoDeCategoria: string,
    categorias: readonly GlossaryTag[],
    categoriasCargando: boolean,
  ): void {
    // Con una categoría en la URL no se puede pedir nada hasta saber su uuid.
    // Se espera en `loading` en vez de pedir sin filtro: mostrar el catálogo
    // entero y después recortarlo haría parpadear resultados que nadie pidió.
    if (codigoDeCategoria !== '' && categoriasCargando) {
      this.terminos.set(loading());
      return;
    }

    const categoria =
      codigoDeCategoria === ''
        ? undefined
        : categorias.find((c) => c.internalCode === codigoDeCategoria);

    if (codigoDeCategoria !== '' && categoria === undefined) {
      // El enlace nombra una categoría que el catálogo no tiene. Se dice cuál,
      // que es lo único útil que se puede decir.
      this.total.set(null);
      this.terminos.set(
        empty(
          { label: 'Ver todas las categorías', route: '/glossary' },
          `No hay ninguna categoría llamada «${codigoDeCategoria}».`,
        ),
      );
      return;
    }

    this.terminos.set(loading());

    this.terminology
      .searchGlossary({
        limit: TOPE,
        ...(texto === '' ? {} : { query: texto }),
        ...(categoria === undefined ? {} : { valueSetId: categoria.id }),
      })
      .subscribe({
        next: (pagina) => {
          this.total.set(pagina.count);
          this.terminos.set(this.estadoDe(pagina, texto, categoria));
        },
        error: (error: unknown) => {
          this.total.set(null);
          this.terminos.set(errorToViewState<readonly GlossaryTerm[]>(error));
        },
      });
  }

  /** De la página al estado. Los vacíos nombran qué se buscó y por dónde salir. */
  private estadoDe(
    pagina: GlossaryTermPage,
    texto: string,
    categoria: GlossaryTag | undefined,
  ): ViewState<readonly GlossaryTerm[]> {
    if (pagina.items.length > 0) {
      return ready(pagina.items);
    }

    const salida = { label: 'Ver todas las categorías', route: '/glossary' };

    if (texto !== '' && categoria !== undefined) {
      return empty(salida, `Ningún término de «${categoria.name}» coincide con «${texto}».`);
    }
    if (categoria !== undefined) {
      return empty(salida, `La categoría «${categoria.name}» todavía no tiene términos.`);
    }
    return empty(salida, `Ningún término coincide con «${texto}».`);
  }
}
