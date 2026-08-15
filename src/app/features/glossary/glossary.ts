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
import { Card } from '../../shared/components/molecules/card/card';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { agruparPorLetra, LETRA_OTRAS, type GrupoAlfabetico } from './glossary-index';

/**
 * Tope de términos por lectura.
 *
 * Más alto que el de la tabla anterior (50) porque acá el tope tiene otro
 * trabajo: navegando por etiqueta hay que traer **la categoría entera**, o el
 * índice alfabético mentiría —diría que en la M no hay nada cuando lo que pasa
 * es que la M quedó fuera del recorte—. La API acota a 500; 200 cubre con
 * holgura cualquier conjunto de valores del catálogo y sigue avisando si algo
 * quedó afuera.
 */
const TOPE = 200;

/** Tope de etiquetas. El catálogo tiene medio centenar; 200 deja margen. */
const TOPE_ETIQUETAS = 200;

/**
 * Glosario — punto 6 del reclamo, segunda ronda.
 *
 * ## Qué se rehizo, y por qué no alcanzaba con agregarle una columna
 *
 * La ronda anterior entregó un `app-search-field` sobre una tabla de dos
 * columnas. El cliente lo rechazó por escrito y con las palabras exactas: «con
 * etiquetas, **no una tabla simplona**». Meter un chip dentro de una celda de
 * esa tabla no habría cumplido el punto — habría seguido siendo la tabla que
 * rebotó.
 *
 * Un glosario que exige saber la palabra antes de poder buscarla no es un
 * glosario, es un autocompletado. **Un glosario se hojea.** Entonces:
 *
 * - **No hay tabla.** Las entradas son entradas de glosario: término,
 *   definición y sus etiquetas visibles en la propia entrada.
 * - **Se entra por las etiquetas.** Al abrir, las categorías están en pantalla
 *   con su conteo, sin escribir nada. Son los conjuntos de valores del catálogo
 *   —«Diagnóstico», «Severidad», «Vía de administración»—, que existían en el
 *   modelo desde siempre y que el glosario nunca había pedido.
 * - **Hay índice alfabético**, que es lo que un glosario tiene y esta pantalla
 *   no tenía: saltar a una letra sin pasar por el buscador.
 * - **Todo se lee en castellano.** No es un problema de rótulos de interfaz
 *   —ésos ya estaban— sino de datos: el catálogo guardaba los nombres en inglés
 *   y las definiciones vacías. Se sembraron (`terminology-designations.es.ts` en
 *   el backend) y la lectura los devuelve con `lang=ES`.
 *
 * ## Lo que se conservó de la ronda anterior
 *
 * La mecánica estaba bien y tenía pruebas: la búsqueda publicada en la URL con
 * `replaceUrl`, el aviso honesto cuando la respuesta viene recortada, y los dos
 * vacíos distintos según haya o no filtro. Nada de eso se tocó. El filtro por
 * etiqueta sigue el mismo criterio y también viaja en la URL: un glosario
 * filtrado por «Diagnóstico» se comparte por enlace.
 *
 * ## Quién la ve
 *
 * `navigation.map.ts` la deja sin roles, a pedido explícito del cliente, y eso
 * no se toca: fue lo que sí se acertó la ronda pasada. La lectura del catálogo
 * tampoco exige rol.
 */
@Component({
  selector: 'app-glossary',
  imports: [Card, Chip, PageHeader, RouterLink, SearchField, ViewStateHost],
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

  protected readonly etiquetas = signal<ViewState<readonly GlossaryTag[]>>(loading());
  protected readonly terminos = signal<ViewState<readonly GlossaryTerm[]>>(loading());

  /** El texto buscado, leído de la URL. Vacío es «sin filtro», no «buscar nada». */
  protected readonly busqueda = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  /**
   * La etiqueta por la que se está navegando, por su código interno.
   *
   * En la URL viaja el código (`etiqueta=condition-severity`) y no el uuid: un
   * enlace compartido tiene que seguir sirviendo, y decir qué muestra.
   */
  protected readonly etiquetaCodigo = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('etiqueta') ?? '')),
    { initialValue: '' },
  );

  /**
   * La letra elegida en el índice, o `null` para todas.
   *
   * A diferencia del texto y de la etiqueta, **no** viaja en la URL: es un salto
   * dentro de lo que ya está en pantalla, no un filtro que alguien quiera
   * compartir. Se reinicia sola cuando cambia lo que se está mirando.
   */
  protected readonly letra = signal<string | null>(null);

  /** Cuántos devolvió la API, que puede ser más de los que caben en el tope. */
  private readonly total = signal<number | null>(null);

  protected readonly recortado = computed(() => {
    const total = this.total();
    return total !== null && total >= TOPE;
  });

  protected readonly totalDeclarado = this.total.asReadonly();
  protected readonly tope = TOPE;

  protected readonly cargando = computed(() => this.terminos().status === 'loading');

  /** Las etiquetas ya leídas, o vacío mientras no lo estén. */
  protected readonly listaDeEtiquetas = computed<readonly GlossaryTag[]>(() => {
    const estado = this.etiquetas();
    return estado.status === 'ready' ? estado.data : [];
  });

  /**
   * Sólo se ofrecen las etiquetas que tienen algo dentro.
   *
   * Una categoría con cero términos es un clic a una pantalla vacía. El conteo
   * lo devuelve el listado justamente para poder no ofrecerla.
   */
  protected readonly etiquetasConTerminos = computed(() =>
    this.listaDeEtiquetas().filter((etiqueta) => (etiqueta.memberCount ?? 0) > 0),
  );

  /** La etiqueta activa resuelta contra el catálogo, o `null` si no hay filtro. */
  protected readonly etiquetaActiva = computed<GlossaryTag | null>(() => {
    const codigo = this.etiquetaCodigo();
    if (codigo === '') return null;
    return this.listaDeEtiquetas().find((e) => e.internalCode === codigo) ?? null;
  });

  /** Los términos ya leídos, o vacío mientras no lo estén. */
  private readonly listaDeTerminos = computed<readonly GlossaryTerm[]>(() => {
    const estado = this.terminos();
    return estado.status === 'ready' ? estado.data : [];
  });

  /** Las entradas agrupadas por inicial — la forma que tiene un glosario. */
  protected readonly grupos = computed<readonly GrupoAlfabetico[]>(() =>
    agruparPorLetra(this.listaDeTerminos()),
  );

  /** Las letras que hoy tienen entradas. Las demás se ofrecen deshabilitadas. */
  protected readonly letrasDisponibles = computed(
    () => new Set(this.grupos().map((grupo) => grupo.letra)),
  );

  /** El abecedario del índice, con «Otras» al final para lo que no empieza con letra. */
  protected readonly abecedario = [
    ...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ',
    LETRA_OTRAS,
  ] as readonly string[];

  /** Los grupos que se muestran: todos, o sólo el de la letra elegida. */
  protected readonly gruposVisibles = computed(() => {
    const letra = this.letra();
    return letra === null ? this.grupos() : this.grupos().filter((g) => g.letra === letra);
  });

  /**
   * Cuántas entradas se están mostrando sin traducir.
   *
   * Se cuenta y se dice en pantalla en vez de disimularlo. Un término sin
   * designación en castellano se muestra igual —con su nombre original— porque
   * dejarlo en blanco o inventarle uno es peor; lo que no puede pasar es que se
   * confunda con uno traducido.
   */
  protected readonly sinTraduccion = computed(
    () => this.listaDeTerminos().filter((termino) => termino.translated === false).length,
  );

  constructor() {
    this.cargarEtiquetas();

    effect(() => {
      const texto = this.busqueda();
      const codigo = this.etiquetaCodigo();
      // Se declara la dependencia para que el efecto vuelva a correr cuando las
      // etiquetas terminan de llegar: con `etiqueta=` en la URL, la categoría no
      // se puede resolver a su uuid antes de tenerlas.
      const etiquetas = this.listaDeEtiquetas();
      const etiquetasCargando = this.etiquetas().status === 'loading';

      untracked(() => {
        // Cambió lo que se está mirando: la letra elegida ya no aplica.
        this.letra.set(null);
        this.cargarTerminos(texto, codigo, etiquetas, etiquetasCargando);
      });
    });
  }

  /** La búsqueda se publica en la URL; el efecto hace el resto. */
  protected buscar(texto: string): void {
    this.navegar({ q: texto === '' ? null : texto });
  }

  /**
   * Elegir una etiqueta. La misma otra vez la quita — es un interruptor, que es
   * lo que la persona espera de un chip que ya está marcado.
   */
  protected filtrarPorEtiqueta(internalCode: string): void {
    this.navegar({
      etiqueta: this.etiquetaCodigo() === internalCode ? null : internalCode,
    });
  }

  protected quitarEtiqueta(): void {
    this.navegar({ etiqueta: null });
  }

  /** Saltar a una letra. La misma otra vez vuelve a mostrarlas todas. */
  protected elegirLetra(letra: string): void {
    this.letra.set(this.letra() === letra ? null : letra);
  }

  protected verTodasLasLetras(): void {
    this.letra.set(null);
  }

  protected recargar(): void {
    this.cargarTerminos(
      this.busqueda(),
      this.etiquetaCodigo(),
      this.listaDeEtiquetas(),
      this.etiquetas().status === 'loading',
    );
  }

  protected recargarEtiquetas(): void {
    this.cargarEtiquetas();
  }

  /**
   * Publica el filtro en la URL sin apilar historial.
   *
   * `merge` conserva el otro filtro: elegir una etiqueta no debe borrar lo que
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

  private cargarEtiquetas(): void {
    this.etiquetas.set(loading());

    this.terminology.listValueSets({ limit: TOPE_ETIQUETAS }).subscribe({
      next: (pagina) => {
        this.etiquetas.set(
          pagina.items.length > 0
            ? ready(pagina.items)
            : empty(
                { label: 'Volver al panel', route: '/dashboard' },
                'Todavía no hay categorías cargadas en esta organización.',
              ),
        );
      },
      error: (error: unknown) => {
        this.etiquetas.set(errorToViewState<readonly GlossaryTag[]>(error));
      },
    });
  }

  private cargarTerminos(
    texto: string,
    codigoDeEtiqueta: string,
    etiquetas: readonly GlossaryTag[],
    etiquetasCargando: boolean,
  ): void {
    // Con una etiqueta en la URL no se puede pedir nada hasta saber su uuid. Se
    // espera en `loading` en vez de pedir sin filtro: mostrar el catálogo entero
    // y después recortarlo haría parpadear resultados que nadie pidió.
    if (codigoDeEtiqueta !== '' && etiquetasCargando) {
      this.terminos.set(loading());
      return;
    }

    const etiqueta =
      codigoDeEtiqueta === ''
        ? undefined
        : etiquetas.find((e) => e.internalCode === codigoDeEtiqueta);

    if (codigoDeEtiqueta !== '' && etiqueta === undefined) {
      // El enlace nombra una categoría que el catálogo no tiene. Se dice cuál,
      // que es lo único útil que se puede decir.
      this.total.set(null);
      this.terminos.set(
        empty(
          { label: 'Ver todo el glosario', route: '/glossary' },
          `No hay ninguna categoría llamada «${codigoDeEtiqueta}».`,
        ),
      );
      return;
    }

    this.terminos.set(loading());

    this.terminology
      .searchGlossary({
        limit: TOPE,
        ...(texto === '' ? {} : { query: texto }),
        ...(etiqueta === undefined ? {} : { valueSetId: etiqueta.id }),
      })
      .subscribe({
        next: (pagina) => {
          this.total.set(pagina.count);
          this.terminos.set(this.estadoDe(pagina, texto, etiqueta));
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
    etiqueta: GlossaryTag | undefined,
  ): ViewState<readonly GlossaryTerm[]> {
    if (pagina.items.length > 0) {
      return ready(pagina.items);
    }

    if (texto === '' && etiqueta === undefined) {
      return empty(
        { label: 'Volver al panel', route: '/dashboard' },
        'El glosario todavía no tiene términos cargados en esta organización.',
      );
    }

    const salida = { label: 'Ver todo el glosario', route: '/glossary' };

    if (texto !== '' && etiqueta !== undefined) {
      return empty(salida, `Ningún término de «${etiqueta.name}» coincide con «${texto}».`);
    }
    if (etiqueta !== undefined) {
      return empty(salida, `La categoría «${etiqueta.name}» todavía no tiene términos.`);
    }
    return empty(salida, `Ningún término coincide con «${texto}».`);
  }
}
