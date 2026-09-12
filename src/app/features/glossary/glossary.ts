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
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  glossaryCategoryOrder,
  isGlossaryCategoryCode,
  GlossaryCategoryIcon,
} from './glossary-category-icon';
import { inicialDe, porInicial, type GrupoAlfabetico } from './glossary-index';

/**
 * Tope de términos por lectura.
 *
 * La API acota a 500; 200 cubre con holgura el catálogo curado (69 términos) y
 * sigue avisando cuando algo quedó afuera — ver {@link recortado}.
 */
const TOPE = 200;

/** Tope de conjuntos de valores al leer las categorías. El catálogo tiene un puñado. */
const TOPE_CATEGORIAS = 200;

/** Una categoría de la fila de tarjetas, con las etiquetas que de verdad usa. */
export interface TarjetaDeCategoria {
  readonly id: string;
  readonly internalCode: string;
  readonly name: string;
  readonly description?: string;
  readonly cantidad: number;
  /** Las etiquetas clínicas presentes en los términos de esta categoría. */
  readonly etiquetas: readonly string[];
}

/**
 * Glosario médico — enciclopedia.
 *
 * ## Qué es esta pantalla
 *
 * Un diccionario médico que se **lee**, no un buscador que hay que interrogar.
 * Las tres piezas, en el orden en que se leen:
 *
 * 1. **El buscador**, arriba y ancho, como en cualquier enciclopedia.
 * 2. **La fila de categorías**: una tarjeta por categoría clínica, con su
 *    ícono, su conteo y **chips con las etiquetas que sus términos realmente
 *    llevan** — no una lista fija, sino las que salen del propio corpus. Es
 *    una fila y no una grilla alta: las doce categorías tienen que verse de un
 *    vistazo por encima del contenido, que es lo que se vino a leer.
 * 3. **El cuerpo**: las definiciones. Sin filtro son **todas**, agrupadas por
 *    inicial con su índice alfabético; con filtro, las que coinciden. En los
 *    dos casos se ven la definición y las etiquetas sin abrir nada.
 *
 * La tabla de resultados que traía la ronda anterior se retiró: el propietario
 * pidió una enciclopedia al estilo Wikipedia, y un artículo no se hojea en una
 * grilla de celdas. La ficha de cada término (`glossary-term.ts`) es el
 * artículo; esto es el índice.
 *
 * ## Por qué carga el corpus entero
 *
 * Sin filtro, el cuerpo **son** todos los términos, así que la lectura que
 * los trae no es un extra. Y esa misma lectura es la que permite decir qué
 * etiquetas tiene cada categoría: `listValueSets()` da el conteo, pero no de
 * qué habla lo que hay adentro. Con filtro se pide aparte, porque el filtro lo
 * resuelve el backend (`q` y `valueSetId`) y no este componente.
 *
 * ## El ruteo: query param, no ruta hija
 *
 * «Entrar a una categoría» viaja como `?category=<internalCode>` en la misma
 * ruta `/glossary`, igual que `?q=`. Es el patrón ya establecido acá y en
 * `terminology-catalog.ts`: un único componente que lee sus filtros de la URL
 * con `queryParamMap` y `queryParamsHandling: 'merge'`. El código y no el uuid
 * porque un enlace compartido tiene que seguir sirviendo cuando el uuid del
 * value set ya no sea el mismo.
 */
@Component({
  selector: 'app-glossary',
  imports: [Chip, GlossaryCategoryIcon, PageHeader, RouterLink, SearchField, ViewStateHost],
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

  protected readonly categorias = signal<ViewState<readonly GlossaryTag[]>>(loading());

  /** El corpus entero, que es a la vez el cuerpo sin filtro y la fuente de los chips. */
  private readonly corpus = signal<ViewState<readonly GlossaryTerm[]>>(loading());

  /** Los términos que coinciden con el filtro. Sin filtro no se pide: es el corpus. */
  private readonly filtrados = signal<ViewState<readonly GlossaryTerm[]>>(loading());

  /** El texto buscado, leído de la URL. Vacío es «sin filtro», no «buscar nada». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  /** La categoría por la que se está navegando, por su código interno. */
  protected readonly categoriaCodigo = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('category') ?? '')),
    { initialValue: '' },
  );

  /** Si hay algo que buscar o filtrar. */
  protected readonly hayFiltro = computed(
    () => this.busqueda() !== '' || this.categoriaCodigo() !== '',
  );

  /**
   * Cuántos términos declaró la API, que puede ser más de los que caben en el
   * tope. Van separados —y no en una sola señal— por el mismo motivo que
   * `corpus` y `filtrados`: el efecto que limpia el filtro corre **después**
   * de que el corpus respondió, y con una sola señal le borraba el contero
   * recién traído. El resultado era un recorte silencioso en la landing, que
   * es exactamente lo que el aviso existe para impedir.
   */
  private readonly totalDelCorpus = signal<number | null>(null);
  private readonly totalFiltrado = signal<number | null>(null);

  /** El conteo que manda: el del filtro si lo hay, el del corpus si no. */
  private readonly total = computed<number | null>(() =>
    this.hayFiltro() ? this.totalFiltrado() : this.totalDelCorpus(),
  );

  protected readonly recortado = computed(() => {
    const total = this.total();
    return total !== null && total > TOPE;
  });

  protected readonly tope = TOPE;

  /** El estado que pinta el cuerpo: el corpus sin filtro, los resultados con él. */
  protected readonly cuerpo = computed<ViewState<readonly GlossaryTerm[]>>(() =>
    this.hayFiltro() ? this.filtrados() : this.corpus(),
  );

  protected readonly cargando = computed(() => this.cuerpo().status === 'loading');

  /** Las categorías ya leídas, o vacío mientras no lo estén. */
  private readonly listaDeCategorias = computed<readonly GlossaryTag[]>(() => {
    const estado = this.categorias();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** El corpus ya leído, o vacío mientras no lo esté. */
  private readonly listaDelCorpus = computed<readonly GlossaryTerm[]>(() => {
    const estado = this.corpus();
    return estado.status === 'ready' ? estado.data : [];
  });

  /**
   * Las etiquetas clínicas presentes en cada categoría, sacadas del corpus.
   *
   * Son los chips de la tarjeta. Se derivan y no se declaran: una lista fija
   * quedaría desactualizada en cuanto el catálogo sume un término, y mostraría
   * una etiqueta que no lleva ninguno.
   */
  private readonly etiquetasPorCategoria = computed<ReadonlyMap<string, readonly string[]>>(() => {
    const porCategoria = new Map<string, Set<string>>();
    for (const termino of this.listaDelCorpus()) {
      const codigo = termino.category?.internalCode;
      if (codigo === undefined) continue;
      const acumulado = porCategoria.get(codigo) ?? new Set<string>();
      // `?? []` no es defensa por las dudas: antes del arreglo del backend del
      // 2026-09-02 una búsqueda sin `valueSetId` devolvía el concepto pelado,
      // sin `tags`, y recorrerlo tiraba `TypeError`. Ver el spec.
      for (const etiqueta of termino.tags ?? []) acumulado.add(etiqueta);
      porCategoria.set(codigo, acumulado);
    }
    return new Map([...porCategoria].map(([codigo, etiquetas]) => [codigo, [...etiquetas].sort()]));
  });

  /**
   * Las categorías del glosario con algo adentro, en el orden de la fila.
   *
   * `listValueSets()` lee **todo** el catálogo de conjuntos de valores de la
   * plataforma —género, estados administrativos, lo que sea—, no sólo el
   * glosario: sin el filtro por `glossary-category-*` la fila mostraría enums
   * que no tienen nada de médico. Y una categoría con cero términos es un clic
   * a una pantalla vacía.
   */
  protected readonly tarjetas = computed<readonly TarjetaDeCategoria[]>(() => {
    const etiquetas = this.etiquetasPorCategoria();
    return [
      ...this.listaDeCategorias().filter(
        (categoria) =>
          isGlossaryCategoryCode(categoria.internalCode) && (categoria.memberCount ?? 0) > 0,
      ),
    ]
      .sort(
        (a, b) => glossaryCategoryOrder(a.internalCode) - glossaryCategoryOrder(b.internalCode),
      )
      .map((categoria) => ({
        id: categoria.id,
        internalCode: categoria.internalCode,
        name: categoria.name,
        ...(categoria.description === undefined ? {} : { description: categoria.description }),
        cantidad: categoria.memberCount ?? 0,
        etiquetas: etiquetas.get(categoria.internalCode) ?? [],
      }));
  });

  /** La categoría activa resuelta contra el catálogo, o `null` si no hay filtro. */
  protected readonly categoriaActiva = computed<GlossaryTag | null>(() => {
    const codigo = this.categoriaCodigo();
    if (codigo === '') return null;
    return this.listaDeCategorias().find((c) => c.internalCode === codigo) ?? null;
  });

  /** Los términos que se están mostrando, ya leídos. */
  private readonly visibles = computed<readonly GlossaryTerm[]>(() => {
    const estado = this.cuerpo();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** El cuerpo de la enciclopedia: los términos agrupados por inicial. */
  protected readonly grupos = computed<readonly GrupoAlfabetico[]>(() =>
    porInicial(this.visibles()),
  );

  /** Las iniciales con términos, para el índice alfabético de arriba. */
  protected readonly iniciales = computed<readonly string[]>(() =>
    this.grupos().map((grupo) => grupo.letra),
  );

  protected readonly cantidadVisible = computed(() => this.visibles().length);

  /**
   * Cuántas de las entradas visibles se muestran sin traducir.
   *
   * Se cuenta y se dice en pantalla en vez de disimularlo. Un término sin
   * designación en castellano se muestra igual —con su nombre original— porque
   * dejarlo en blanco o inventarle uno es peor; lo que no puede pasar es que se
   * confunda con uno traducido.
   */
  protected readonly sinTraduccion = computed(
    () => this.visibles().filter((termino) => termino.translated === false).length,
  );

  constructor() {
    this.cargarCategorias();
    this.cargarCorpus();

    effect(() => {
      const texto = this.busqueda();
      const codigo = this.categoriaCodigo();
      // Se declaran las dependencias para que el efecto vuelva a correr cuando
      // las categorías terminan de llegar: con `category=` en la URL, no se
      // puede resolver a su uuid antes de tenerlas.
      const categorias = this.listaDeCategorias();
      const categoriasCargando = this.categorias().status === 'loading';

      untracked(() => {
        if (texto === '' && codigo === '') {
          // Sin filtro el cuerpo es el corpus, con su propio conteo.
          this.totalFiltrado.set(null);
          return;
        }
        this.cargarFiltrados(texto, codigo, categorias, categoriasCargando);
      });
    });
  }

  /** La búsqueda se publica en la URL; el efecto hace el resto. */
  protected buscar(texto: string): void {
    this.navegar({ q: texto === '' ? null : texto });
  }

  /** Vuelve al índice completo: limpia categoría **y** texto. */
  protected verTodo(): void {
    this.navegar({ category: null, q: null });
  }

  protected recargar(): void {
    if (this.hayFiltro()) {
      this.cargarFiltrados(
        this.busqueda(),
        this.categoriaCodigo(),
        this.listaDeCategorias(),
        this.categorias().status === 'loading',
      );
      return;
    }
    this.cargarCorpus();
  }

  protected recargarCategorias(): void {
    this.cargarCategorias();
  }

  /**
   * Publica el filtro en la URL sin apilar historial.
   *
   * `merge` conserva el otro filtro: elegir una categoría no debe borrar lo que
   * la persona escribió, y viceversa. `replaceUrl` porque cada tecleo no es un
   * paso del historial.
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

  private cargarCorpus(): void {
    this.corpus.set(loading());

    this.terminology.searchGlossary({ limit: TOPE }).subscribe({
      next: (pagina) => {
        this.totalDelCorpus.set(pagina.count);
        this.corpus.set(
          pagina.items.length > 0
            ? ready(pagina.items)
            : empty(
                { label: 'Volver al panel', route: '/dashboard' },
                'El glosario todavía no tiene términos cargados en esta organización.',
              ),
        );
      },
      error: (error: unknown) => {
        this.corpus.set(errorToViewState<readonly GlossaryTerm[]>(error));
      },
    });
  }

  private cargarFiltrados(
    texto: string,
    codigoDeCategoria: string,
    categorias: readonly GlossaryTag[],
    categoriasCargando: boolean,
  ): void {
    // Con una categoría en la URL no se puede pedir nada hasta saber su uuid.
    // Se espera en `loading` en vez de pedir sin filtro: mostrar el catálogo
    // entero y después recortarlo haría parpadear resultados que nadie pidió.
    if (codigoDeCategoria !== '' && categoriasCargando) {
      this.filtrados.set(loading());
      return;
    }

    const categoria =
      codigoDeCategoria === ''
        ? undefined
        : categorias.find((c) => c.internalCode === codigoDeCategoria);

    if (codigoDeCategoria !== '' && categoria === undefined) {
      // El enlace nombra una categoría que el catálogo no tiene. Se dice cuál,
      // que es lo único útil que se puede decir.
      this.totalFiltrado.set(null);
      this.filtrados.set(
        empty(
          { label: 'Ver todo el glosario', route: '/glossary' },
          `No hay ninguna categoría llamada «${codigoDeCategoria}».`,
        ),
      );
      return;
    }

    this.filtrados.set(loading());

    this.terminology
      .searchGlossary({
        limit: TOPE,
        ...(texto === '' ? {} : { query: texto }),
        ...(categoria === undefined ? {} : { valueSetId: categoria.id }),
      })
      .subscribe({
        next: (pagina) => {
          this.totalFiltrado.set(pagina.count);
          this.filtrados.set(this.estadoDe(pagina, texto, categoria));
        },
        error: (error: unknown) => {
          this.totalFiltrado.set(null);
          this.filtrados.set(errorToViewState<readonly GlossaryTerm[]>(error));
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

    const salida = { label: 'Ver todo el glosario', route: '/glossary' };

    if (texto !== '' && categoria !== undefined) {
      return empty(salida, `Ningún término de «${categoria.name}» coincide con «${texto}».`);
    }
    if (categoria !== undefined) {
      return empty(salida, `La categoría «${categoria.name}» todavía no tiene términos.`);
    }
    return empty(salida, `Ningún término coincide con «${texto}».`);
  }

  /** La inicial de un término, para el ancla del índice alfabético. */
  protected readonly inicial = inicialDe;

  /**
   * Las etiquetas de un término, siempre recorribles.
   *
   * El tipo declara `tags` obligatorio y el template, por eso, marcaría un
   * `?? []` como removible (NG8102). Pero el tipo describe la respuesta
   * **arreglada**: antes del arreglo del backend del 2026-09-02 una búsqueda
   * por texto sin `valueSetId` devolvía el concepto pelado, y recorrer
   * `tags` tiraba `TypeError` dejando el cuerpo sin dibujar. El cinturón vive
   * acá —donde es una afirmación sobre el dato real y no ruido del compilador—
   * y el template llama a esto. Ver el spec, que reproduce esa forma parcial.
   */
  protected etiquetasDe(termino: GlossaryTerm): readonly string[] {
    return termino.tags ?? [];
  }
}
