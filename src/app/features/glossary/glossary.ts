import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, type Subscription } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type {
  GlossaryFacetCategory,
  GlossaryFacets,
  GlossaryFacetTag,
  GlossaryTerm,
} from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Chip } from '../../shared/components/atoms/chip/chip';
import { Card } from '../../shared/components/molecules/card/card';
import { Pagination } from '../../shared/components/molecules/pagination/pagination';
import {
  FilterBar,
  type FilterDef,
} from '../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  glossaryCategoryOrder,
  isGlossaryCategoryCode,
  GlossaryCategoryIcon,
} from './glossary-category-icon';
import { porInicial, type GrupoAlfabetico } from './glossary-index';

/**
 * Tamaños de página del cuerpo. Múltiplos de 12 para que la rejilla cierre
 * filas completas con una, dos, tres o cuatro columnas.
 */
export const TAMANOS_DE_PAGINA: readonly number[] = Object.freeze([12, 24, 48]);

/**
 * Cuántas etiquetas se muestran como chips en la tarjeta de una categoría.
 *
 * Con el glosario ampliado una categoría puede llevar todas las etiquetas: una
 * tarjeta con quince chips deja de ser una tarjeta. Se muestran las más
 * frecuentes y el resto se cuenta.
 */
export const CHIPS_POR_TARJETA = 4;

/** Tope de páginas para ofrecer el select «ir a la página»; ver `permiteSaltar`. */
export const MAX_PAGINAS_EN_SELECT = 200;

/** Una categoría de la rejilla, con las etiquetas que de verdad usan sus términos. */
export interface TarjetaDeCategoria {
  readonly id: string;
  readonly internalCode: string;
  readonly name: string;
  readonly description?: string;
  readonly cantidad: number;
  /** Cuántos de sus términos están en castellano, cuando la API lo dice. */
  readonly enCastellano?: number;
  /** Las etiquetas más frecuentes de la categoría, para los chips. */
  readonly etiquetas: readonly string[];
  /** Cuántas etiquetas más lleva y no entran como chip. */
  readonly etiquetasDeMas: number;
}

/**
 * Glosario médico — enciclopedia, **con carga bajo demanda**.
 *
 * ## Qué es esta pantalla
 *
 * Un diccionario médico que se **lee**, no un buscador que hay que interrogar.
 * Las tres piezas, en el orden en que se leen:
 *
 * 1. **La barra**, arriba: buscador (con la espera de 300 ms del propio
 *    `app-filter-bar`) y los filtros «Categoría» y «Etiqueta».
 * 2. **La rejilla de categorías**: una tarjeta por categoría, con su ícono,
 *    su conteo y chips con las etiquetas que sus términos realmente llevan.
 * 3. **El cuerpo**: las definiciones, en tarjetas, agrupadas por inicial y
 *    **paginadas por el servidor**, con desplazamiento sólo vertical y el
 *    paginador abajo a la derecha (ADR-0015, reglas 5–7).
 *
 * ## Por qué ya no carga el corpus entero (2026-09-30)
 *
 * Hasta acá la pantalla pedía hasta 200 términos de una vez y derivaba de ahí
 * los chips de cada categoría y el filtro por etiqueta. Con el glosario en
 * castellano de cientos de miles de términos (CIMA/AEMPS, CIE-10-ES,
 * MedlinePlus) eso deja de existir:
 *
 * - **Los conteos y los chips** salen de `readGlossaryFacets()`, una consulta
 *   agregada del servidor. La rejilla se pinta sin traer un solo término.
 * - **El cuerpo** es una página: `limit` y `offset` viajan al servidor, que
 *   devuelve también el `total` con el que se arma el paginador.
 * - **La etiqueta** también filtra en el servidor (`tagValueSetId`): filtrar
 *   en el navegador la página 3 dejaba páginas medio vacías.
 * - **El abecedario que saltaba de página en página se retiró**: saber en qué
 *   página empieza la «M» exige conocer el corpus entero. Las iniciales siguen
 *   encabezando los tramos de la página.
 *
 * ## El ruteo: query param, no ruta hija
 *
 * Categoría, etiqueta y texto viajan como `?category=`, `?tag=` y `?q=` en la
 * misma ruta `/glossary`, por su código interno y no por uuid: un enlace
 * compartido tiene que seguir sirviendo cuando el uuid del value set cambie.
 */
@Component({
  selector: 'app-glossary',
  imports: [
    Card,
    Chip,
    FilterBar,
    GlossaryCategoryIcon,
    PageHeader,
    Pagination,
    RouterLink,
    ViewStateHost,
  ],
  templateUrl: './glossary.html',
  styleUrl: './glossary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Glossary {
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /** Las facetas: categorías con su conteo, sus etiquetas, y las etiquetas del glosario. */
  protected readonly facetas = signal<ViewState<GlossaryFacets>>(loading());

  /** La página de términos que se está mirando. */
  protected readonly cuerpo = signal<ViewState<readonly GlossaryTerm[]>>(loading());

  /** Cuántos términos coinciden en total con lo que se está mirando, no sólo en la página. */
  protected readonly total = signal(0);

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

  /** La etiqueta por la que se está acotando, por su código interno. */
  protected readonly etiquetaCodigo = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('tag') ?? '')),
    { initialValue: '' },
  );

  /** Si hay algo puesto: texto, categoría o etiqueta. */
  protected readonly hayAlgoPuesto = computed(
    () => this.busqueda() !== '' || this.categoriaCodigo() !== '' || this.etiquetaCodigo() !== '',
  );

  protected readonly cargando = computed(() => this.cuerpo().status === 'loading');

  /** Las facetas ya leídas, o `null` mientras no lo estén (o si fallaron). */
  private readonly facetasLeidas = computed<GlossaryFacets | null>(() => {
    const estado = this.facetas();
    return estado.status === 'ready' ? estado.data : null;
  });

  /**
   * Las categorías del glosario con algo adentro, en el orden de la rejilla.
   *
   * El filtro por `glossary-category-*` es la segunda barrera: las facetas ya
   * vienen acotadas al glosario, pero un código que la pantalla no conoce no
   * tiene ícono ni lugar en el orden. Una categoría con cero términos es un clic
   * a una pantalla vacía.
   */
  protected readonly tarjetas = computed<readonly TarjetaDeCategoria[]>(() =>
    [...(this.facetasLeidas()?.categories ?? [])]
      .filter((categoria) => isGlossaryCategoryCode(categoria.internalCode) && categoria.count > 0)
      .sort(
        (a, b) => glossaryCategoryOrder(a.internalCode) - glossaryCategoryOrder(b.internalCode),
      )
      .map((categoria) => ({
        id: categoria.id,
        internalCode: categoria.internalCode,
        name: categoria.name,
        ...(categoria.description === undefined ? {} : { description: categoria.description }),
        cantidad: categoria.count,
        ...(categoria.translatedCount === undefined
          ? {}
          : { enCastellano: categoria.translatedCount }),
        etiquetas: categoria.tags.slice(0, CHIPS_POR_TARJETA).map((etiqueta) => etiqueta.name),
        etiquetasDeMas: Math.max(0, categoria.tags.length - CHIPS_POR_TARJETA),
      })),
  );

  /** La categoría activa resuelta contra las facetas, o `null` si no hay (o no existe). */
  protected readonly categoriaActiva = computed<GlossaryFacetCategory | null>(() => {
    const codigo = this.categoriaCodigo();
    if (codigo === '') return null;
    return this.facetasLeidas()?.categories.find((c) => c.internalCode === codigo) ?? null;
  });

  /** La etiqueta activa resuelta contra las facetas, o `null`. */
  protected readonly etiquetaActiva = computed<GlossaryFacetTag | null>(() => {
    const codigo = this.etiquetaCodigo();
    if (codigo === '') return null;
    return this.facetasLeidas()?.tags.find((t) => t.internalCode === codigo) ?? null;
  });

  /**
   * Los dos filtros de la barra: la categoría y la etiqueta clínica.
   *
   * Las opciones salen de las facetas y no de una lista escrita acá: ofrecer
   * una etiqueta que ningún término lleva es prometer un filtro vacío. Con una
   * categoría elegida, «Etiqueta» ofrece sólo las que aparecen en ella.
   */
  protected readonly filtros = computed<readonly FilterDef[]>(() => {
    const categoria = this.categoriaActiva();
    const etiquetas = categoria?.tags ?? this.facetasLeidas()?.tags ?? [];
    return [
      {
        key: 'category',
        label: 'Categoría',
        options: this.tarjetas().map((tarjeta) => ({
          value: tarjeta.internalCode,
          label: tarjeta.name,
        })),
        unavailableReason: 'No pudimos leer las categorías del glosario.',
      },
      {
        key: 'tag',
        label: 'Etiqueta',
        options: [...etiquetas]
          .sort((a, b) => a.name.localeCompare(b.name, 'es'))
          .map((etiqueta) => ({ value: etiqueta.internalCode, label: etiqueta.name })),
        unavailableReason: 'No hay etiquetas cargadas en el glosario.',
      },
    ];
  });

  protected readonly tamanosDePagina = TAMANOS_DE_PAGINA;

  /** Términos por página. */
  protected readonly porPagina = signal(TAMANOS_DE_PAGINA[0]);

  /** La página que se está mirando, 1-based. */
  protected readonly pagina = signal(1);

  /**
   * Si el paginador ofrece el select «ir a la página».
   *
   * Con el glosario entero son decenas de miles de páginas: un `<select>` con
   * 25 000 opciones es una pantalla trabada, no un atajo. Hasta
   * {@link MAX_PAGINAS_EN_SELECT} se ofrece; por encima quedan los botones
   * numerados, y lo que acorta el camino es buscar o elegir una categoría.
   */
  protected readonly permiteSaltar = computed(
    () => Math.ceil(this.total() / this.porPagina()) <= MAX_PAGINAS_EN_SELECT,
  );

  /** Los términos de la página, ya leídos. */
  private readonly enPagina = computed<readonly GlossaryTerm[]>(() => {
    const estado = this.cuerpo();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** El cuerpo de la enciclopedia: los términos de la página, agrupados por inicial. */
  protected readonly grupos = computed<readonly GrupoAlfabetico[]>(() =>
    porInicial(this.enPagina()),
  );

  /** Desde qué número de término va la página, para el aviso «del 25 al 48 de 1 200». */
  protected readonly desde = computed(() => (this.pagina() - 1) * this.porPagina() + 1);
  protected readonly hasta = computed(() => this.desde() + this.enPagina().length - 1);

  /**
   * Cuántos términos de **esta página** se muestran sin traducir.
   *
   * Se dice en pantalla en vez de disimularlo. Un término sin designación en
   * castellano se muestra igual —con su nombre original— porque dejarlo en
   * blanco o inventarle uno es peor; lo que no puede pasar es que se confunda
   * con uno traducido. Es de la página y no del total: el total no lo sabe el
   * servidor sin contarlo, y decir «en esta página» es exacto.
   */
  protected readonly sinTraduccion = computed(
    () => this.enPagina().filter((termino) => termino.translated === false).length,
  );

  /** La lectura en curso, para cancelarla si llega otro pedido antes. */
  private lectura: Subscription | null = null;

  constructor() {
    this.cargarFacetas();

    // Un filtro nuevo es otro resultado: quedarse en la página 4 de la búsqueda
    // anterior deja a la persona en un lugar que no eligió, o en ninguno.
    effect(() => {
      this.busqueda();
      this.categoriaCodigo();
      this.etiquetaCodigo();
      this.porPagina();
      untracked(() => this.pagina.set(1));
    });

    effect(() => {
      const texto = this.busqueda();
      const categoria = this.categoriaCodigo();
      const etiqueta = this.etiquetaCodigo();
      const pagina = this.pagina();
      const porPagina = this.porPagina();
      // Con una categoría o etiqueta en la URL no se puede pedir nada hasta
      // tener su uuid, así que el efecto depende de las facetas **sólo
      // entonces**: sin filtro, la llegada de las facetas no es motivo para
      // volver a pedir la misma página.
      const facetas = categoria !== '' || etiqueta !== '' ? this.facetas() : null;

      untracked(() => this.cargarPagina({ texto, categoria, etiqueta, pagina, porPagina, facetas }));
    });
  }

  /** Vuelve al índice completo: limpia categoría, etiqueta **y** texto. */
  protected verTodo(): void {
    this.navegar({ category: null, q: null, tag: null });
  }

  /** Cambia de página y lleva la lectura al principio del cuerpo, no al pie donde quedó. */
  protected irAPagina(pagina: number): void {
    this.pagina.set(pagina);
    afterNextRender(
      () => {
        this.document.getElementById('glosario-lista')?.scrollTo({ top: 0 });
        this.document
          .getElementById('glosario-cuerpo-titulo')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      { injector: this.injector },
    );
  }

  protected recargar(): void {
    this.cargarPagina({
      texto: this.busqueda(),
      categoria: this.categoriaCodigo(),
      etiqueta: this.etiquetaCodigo(),
      pagina: this.pagina(),
      porPagina: this.porPagina(),
      facetas: this.facetas(),
    });
  }

  protected recargarFacetas(): void {
    this.cargarFacetas();
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

  private cargarFacetas(): void {
    this.facetas.set(loading());

    this.terminology.readGlossaryFacets().subscribe({
      next: (facetas) => {
        this.facetas.set(
          facetas.categories.length > 0
            ? ready(facetas)
            : empty(
                { label: 'Volver al panel', route: '/dashboard' },
                'Todavía no hay categorías cargadas en el glosario.',
              ),
        );
      },
      error: (error: unknown) => {
        this.facetas.set(errorToViewState<GlossaryFacets>(error));
      },
    });
  }

  private cargarPagina(pedido: {
    readonly texto: string;
    readonly categoria: string;
    readonly etiqueta: string;
    readonly pagina: number;
    readonly porPagina: number;
    readonly facetas: ViewState<GlossaryFacets> | null;
  }): void {
    const { texto, categoria, etiqueta, pagina, porPagina, facetas } = pedido;
    const necesitaFacetas = categoria !== '' || etiqueta !== '';

    // Con una categoría o etiqueta en la URL no se puede pedir nada hasta saber
    // su uuid. Se espera en `loading` en vez de pedir sin filtro: mostrar el
    // glosario entero y después recortarlo haría parpadear resultados que nadie
    // pidió.
    if (necesitaFacetas && facetas?.status === 'loading') {
      this.cuerpo.set(loading());
      return;
    }

    // Si las facetas fallaron, la categoría pedida no se puede resolver: se
    // muestra el mismo fallo (con su reintento) en vez de afirmar que la
    // categoría no existe.
    if (
      necesitaFacetas &&
      facetas !== null &&
      facetas.status !== 'ready' &&
      facetas.status !== 'stale' &&
      facetas.status !== 'empty'
    ) {
      this.total.set(0);
      this.cuerpo.set(facetas);
      return;
    }

    const leidas = facetas?.status === 'ready' ? facetas.data : null;
    const conjuntoCategoria =
      categoria === '' ? undefined : leidas?.categories.find((c) => c.internalCode === categoria);
    const conjuntoEtiqueta =
      etiqueta === '' ? undefined : leidas?.tags.find((t) => t.internalCode === etiqueta);

    if (categoria !== '' && conjuntoCategoria === undefined) {
      // El enlace nombra una categoría que el glosario no tiene. Se dice cuál,
      // que es lo único útil que se puede decir.
      this.total.set(0);
      this.cuerpo.set(
        empty(
          { label: 'Ver todo el glosario', route: '/glossary' },
          `No hay ninguna categoría llamada «${categoria}».`,
        ),
      );
      return;
    }
    if (etiqueta !== '' && conjuntoEtiqueta === undefined) {
      this.total.set(0);
      this.cuerpo.set(
        empty(
          { label: 'Ver todo el glosario', route: '/glossary' },
          `No hay ninguna etiqueta llamada «${etiqueta}».`,
        ),
      );
      return;
    }

    this.cuerpo.set(loading());
    this.lectura?.unsubscribe();
    this.lectura = this.terminology
      .searchGlossary({
        limit: porPagina,
        offset: (pagina - 1) * porPagina,
        ...(texto === '' ? {} : { query: texto }),
        ...(conjuntoCategoria === undefined ? {} : { valueSetId: conjuntoCategoria.id }),
        ...(conjuntoEtiqueta === undefined ? {} : { tagValueSetId: conjuntoEtiqueta.id }),
      })
      .subscribe({
        next: (respuesta) => {
          // Una API anterior no publica `total`: lo que vino es todo lo que hay.
          this.total.set(respuesta.total ?? respuesta.items.length);
          this.cuerpo.set(
            respuesta.items.length > 0
              ? ready(respuesta.items)
              : this.vacio(texto, conjuntoCategoria, conjuntoEtiqueta),
          );
        },
        error: (error: unknown) => {
          this.total.set(0);
          this.cuerpo.set(errorToViewState<readonly GlossaryTerm[]>(error));
        },
      });
  }

  /** El vacío nombra qué se buscó y por dónde salir. */
  private vacio(
    texto: string,
    categoria: GlossaryFacetCategory | undefined,
    etiqueta: GlossaryFacetTag | undefined,
  ): ViewState<readonly GlossaryTerm[]> {
    const salida = { label: 'Ver todo el glosario', route: '/glossary' };
    const donde = [categoria?.name, etiqueta?.name].filter((n): n is string => n !== undefined);
    const lugar = donde.length === 0 ? '' : ` de «${donde.join('» con la etiqueta «')}»`;

    if (texto !== '') {
      return empty(salida, `Ningún término${lugar} coincide con «${texto}».`);
    }
    if (donde.length > 0) {
      return empty(salida, `Todavía no hay términos${lugar}.`);
    }
    return empty(
      { label: 'Volver al panel', route: '/dashboard' },
      'El glosario todavía no tiene términos cargados.',
    );
  }

  /**
   * Las etiquetas de un término, siempre recorribles.
   *
   * El tipo declara `tags` obligatorio, pero antes del arreglo del backend del
   * 2026-09-02 una búsqueda por texto sin `valueSetId` devolvía el concepto
   * pelado, y recorrer `tags` tiraba `TypeError` dejando el cuerpo sin dibujar.
   * El cinturón vive acá —donde es una afirmación sobre el dato real— y el
   * template llama a esto.
   */
  protected etiquetasDe(termino: GlossaryTerm): readonly string[] {
    return termino.tags ?? [];
  }
}
