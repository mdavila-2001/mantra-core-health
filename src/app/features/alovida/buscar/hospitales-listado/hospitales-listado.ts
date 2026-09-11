/* V65-04·L · Hospitales y clínicas
   El listado de centros de salud de la superficie pública. */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type Params } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, of, Subject, switchMap, type Observable } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicPage,
  PublicSearchQuery,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';
import { CardDetailPanel } from '@shared/components/molecules/card-detail-panel/card-detail-panel';
import {
  DepartmentMap,
  type DepartamentoElegible,
} from '@shared/components/organisms/department-map/department-map';
import { departamentoPorCiudad, normalizarLugar } from '@shared/geo/departamento-de-ciudad';

import { CentroCard } from '../centro-card/centro-card';
import { toFacilityCard, type FacilityCard } from './facility-card.mapper';
import { FacilityDirectionsDialog } from './facility-directions-dialog/facility-directions-dialog';

/** Tope por página que acepta el contrato público (`limit` se recorta a 50). */
const POR_PETICION = 50;

/**
 * Cuántas páginas se recorren como máximo al traer el directorio.
 *
 * El mismo techo y por el mismo motivo que los otros directorios: se hojea
 * entero, y el tope existe para que un catálogo que crezca sin control no
 * encadene peticiones indefinidamente. Cuando se llega, la pantalla **lo dice**
 * en vez de seguir pidiendo en silencio.
 */
const MAX_PAGINAS = 10;

/**
 * Cuántas tarjetas se ven de una vez.
 *
 * Veinticuatro y no veinticinco: la grilla es de cuatro columnas en escritorio
 * y de dos en tableta, así que veinticuatro cierra la última fila en los dos
 * anchos. Una tarjeta huérfana al pie parece un error de carga.
 */
const POR_PAGINA = 24;

/** Cuánto se espera antes de llevar lo tecleado a la URL. */
const PAUSA_AL_ESCRIBIR_MS = 300;

/** Clave del texto buscado en la URL. */
const PARAM_TEXTO = 'q';

/** Clave del departamento elegido en el mapa, en la URL. */
const PARAM_DEPARTAMENTO = 'departamento';

/** Clave de la ciudad elegida por chip, en la URL. */
const PARAM_CIUDAD = 'ciudad';

/** Los cuatro estados que la maqueta conmuta desde su `data-estado`. */
type EstadoDeBusqueda = 'carga' | 'datos' | 'vacio' | 'error';

/**
 * El directorio de hospitales, clínicas y centros, desde
 * `GET /public/search/organizations`.
 *
 * Una organización aparece cuando publicó su ficha pública; las que no la
 * publicaron existen en la plataforma y **no** son visibles sin sesión, que es
 * lo que dice el estado vacío.
 *
 * ## Por qué esta pantalla se dibuja en grilla con foto y no en lista
 *
 * Porque un centro de salud se elige como se elige un lugar al que hay que ir.
 * La lista de filas que tenía antes esta pantalla mostraba, por resultado, una
 * inicial gris y dos renglones: cuarenta clínicas indistinguibles, con el
 * nombre repetido como único dato, y la ciudad como único criterio. La forma
 * que sirve para eso es la de los directorios de lugares —foto primero,
 * atributos en una fila que se barre, la acción a mano—, que es lo que pidió
 * el cliente por su nombre: «como InfoCasas».
 *
 * Ver `CentroCard` para lo que la tarjeta pinta y para lo que deliberadamente
 * **no** pinta.
 *
 * ## El lugar se elige en dos pasos: primero el departamento, después la ciudad
 *
 * Es la corrección que pidió el cliente el 08/09/2026 y que ya estaba en los
 * directorios de clínicas y farmacias. Antes esta pantalla dibujaba una fila
 * plana de ocho ciudades **fijas**, escritas acá: las ocho donde la plataforma
 * opera. Eso fallaba de las dos maneras a la vez. Ofrecía ciudades donde no
 * había ningún centro publicado —un chip que siempre devuelve cero—, y no
 * ofrecía las ciudades chicas donde sí lo había, porque no estaban en la lista.
 *
 * Ahora el mapa es el corte de arriba y los chips cuelgan de él: sin
 * departamento elegido no se dibuja ninguno —ofrecer las dos escalas a la vez
 * es hacer dos preguntas para una sola decisión— y con departamento elegido
 * están **todas** sus ciudades publicadas, sin tope, ordenadas por cuántos
 * centros tiene cada una. Salen de los resultados y no del catálogo de
 * municipios: de los ochenta y siete de La Paz la mayoría no tiene nada
 * publicado.
 *
 * ## Por qué ahora se trae el directorio entero y se filtra en memoria
 *
 * Porque el departamento **no existe como filtro en la API**: el contrato
 * público acepta `q` y `city`, y nada más. Un mapa que no acotara la lista
 * sería un adorno, y pedirle al servidor una ciudad por vez para reconstruir un
 * departamento serían ochenta y siete peticiones. Así que se recorre el cursor
 * una vez —lo mismo que ya hacen los otros dos directorios— y los tres cortes
 * se aplican sobre lo traído; el texto sigue viajando a `q`, que es el único
 * que el controlador aplica de verdad. La paginación pasa a ser de la lista ya
 * filtrada, que además es lo que arregla el «Anteriores» que antes devolvía la
 * página del país entero cuando había una ciudad elegida.
 *
 * ## Por qué el filtro de ciudad sí está y los otros no
 *
 * La maqueta dibuja además especialidad, aseguradora, disponibilidad y precio.
 * Esos cuatro **no existen en la API**, y dibujarlos habría sido peor que
 * omitirlos: alguien filtra «atiende hoy», la lista no cambia, y la pantalla le
 * dice —sin decirlo— que todos atienden hoy. Un filtro que no filtra no es un
 * pendiente visual: es una respuesta equivocada a una pregunta que la persona
 * sí hizo.
 */
@Component({
  selector: 'app-alovida-buscar-hospitales-listado',
  imports: [CardDetailPanel, CentroCard, DepartmentMap, FacilityDirectionsDialog, RouterLink],
  templateUrl: './hospitales-listado.html',
  styleUrls: [
    './hospitales-listado.css',
    '../centro-card/centro-grid.css',
    '../../../public-directories/mapa-directorio.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarHospitalesListado {
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Cuántos esqueletos dibujar mientras carga.
   *
   * Seis y no veinticuatro: llenan la primera pantalla en cualquier ancho sin
   * pedirle al navegador que dibuje una página entera de cajas grises que
   * nadie va a ver.
   */
  protected readonly huecos = [0, 1, 2, 3, 4, 5];

  /* ---- lo que se trajo --------------------------------------------------- */

  protected readonly estado = signal<EstadoDeBusqueda>('carga');

  /** El directorio entero, tal como llegó. Los cortes se aplican encima. */
  private readonly todos = signal<readonly PublicSearchResult[]>([]);

  /** Si se cortó por el techo de páginas, para poder decirlo. */
  private readonly recortada = signal(false);

  /** En qué página de la lista **ya filtrada** se está, contando desde 0. */
  private readonly pagina = signal(0);

  /* ---- los tres cortes, que viven en la URL ------------------------------ */

  /**
   * Los parámetros de la dirección, que son **la** fuente de los tres cortes.
   *
   * En la URL y no en señales de la pantalla por lo mismo que `?q=`: un
   * directorio filtrado tiene que poder pegarse en un mensaje, y el SSR no
   * tiene una pantalla que leer, sólo la dirección.
   */
  private readonly parametros = toSignal(this.ruta.queryParams, {
    initialValue: {} as Params,
  });

  private parametro(clave: string): string | null {
    const valor: unknown = this.parametros()[clave];
    return typeof valor === 'string' && valor !== '' ? valor : null;
  }

  /**
   * Lo escrito en la caja.
   *
   * Se refleja en el acto —la caja no puede ir a destiempo de los dedos— y
   * llega a `?q=` con una pausa; la lectura la dispara el cambio de la URL.
   */
  protected readonly texto = signal('');
  private readonly tecleo = new Subject<string>();

  protected readonly departamentoElegido = computed(() => this.parametro(PARAM_DEPARTAMENTO));
  protected readonly ciudad = computed(() => this.parametro(PARAM_CIUDAD));

  /* ---- el mapa ----------------------------------------------------------- */

  /** El árbol de departamentos y municipios. Vacío mientras no llegue. */
  private readonly ramas = signal<readonly RamaDepartamento[]>([]);

  /** El catálogo no llegó: el mapa no se dibuja y se ofrece reintentar. */
  protected readonly catalogoGeoCaido = signal(false);

  /**
   * Los nueve departamentos, para el mapa.
   *
   * **Todos**, no sólo los que tienen algo publicado, al revés que los chips de
   * ciudad. No es una inconsistencia: un chip que siempre devuelve cero es un
   * botón inútil, pero un mapa de Bolivia al que le faltan seis departamentos
   * no es un filtro honesto, es un dibujo roto, y quien lo mira no sabría si
   * Pando no está porque no hay centros o porque el mapa está mal.
   */
  protected readonly departamentos = computed<readonly DepartamentoElegible[]>(() =>
    this.ramas().map((rama) => ({
      conceptId: rama.conceptId,
      sigla: rama.sigla,
      nombre: rama.nombre,
    })),
  );

  private readonly porCiudad = computed(() => departamentoPorCiudad(this.ramas()));

  /**
   * Cuántos centros tiene cada departamento, **sin** el corte del propio mapa.
   *
   * Contar con el mapa aplicado dejaría a los ocho departamentos no elegidos en
   * cero, o sea el mapa diciendo que sólo hay centros donde uno acaba de
   * pulsar. La cuenta que sirve es la de «cuánto hay ahí si voy».
   */
  private readonly cuentaPorDepartamento = computed<ReadonlyMap<string, number>>(() => {
    const porCiudad = this.porCiudad();
    const cuenta = new Map<string, number>();
    for (const fila of this.todos()) {
      const conceptId = fila.city === null ? undefined : porCiudad.get(normalizarLugar(fila.city));
      if (conceptId === undefined) continue;
      cuenta.set(conceptId, (cuenta.get(conceptId) ?? 0) + 1);
    }
    return cuenta;
  });

  /**
   * El resumen que acompaña al mapa: cuántos hay y cómo se vuelve.
   *
   * `null` sin departamento elegido, y no un «tocá un departamento»: el propio
   * mapa ya lo escribe en su línea viva, y dos renglones seguidos diciendo lo
   * mismo se leen como un error de la pantalla.
   */
  protected readonly resumenDelMapa = computed<string | null>(() => {
    const elegido = this.departamentoElegido();
    if (elegido === null) {
      return null;
    }
    const nombre = this.ramas().find((rama) => rama.conceptId === elegido)?.nombre ?? '';
    const cuantos = this.cuentaPorDepartamento().get(elegido) ?? 0;
    if (cuantos === 0) {
      return `Todavía no hay centros publicados en ${nombre}.`;
    }
    return `${cuantos} ${cuantos === 1 ? 'centro' : 'centros'} en ${nombre}. Tocá otra vez el departamento para ver todo el país.`;
  });

  /* ---- los cortes en memoria --------------------------------------------- */

  /**
   * Las filas del departamento elegido, **sin** el corte de ciudad.
   *
   * Es la base con la que se arman los chips, y por eso no puede llevar el
   * corte que esos chips aplican: calculados sobre lo ya filtrado, tocar
   * «Sucre» dejaría un solo chip y no habría cómo pasar a otra ciudad sin
   * quitar el filtro primero.
   */
  private readonly delDepartamento = computed<readonly PublicSearchResult[]>(() => {
    const departamento = this.departamentoElegido();
    const todas = this.todos();
    if (departamento === null) {
      return todas;
    }
    const porCiudad = this.porCiudad();
    return todas.filter(
      (fila) => fila.city !== null && porCiudad.get(normalizarLugar(fila.city)) === departamento,
    );
  });

  /**
   * Los chips: **todas** las ciudades publicadas del departamento elegido, la
   * que más centros tiene primero.
   *
   * Vacío sin departamento: el mapa es el corte de arriba.
   */
  protected readonly ciudades = computed<readonly string[]>(() => {
    if (this.departamentoElegido() === null) {
      return [];
    }
    const cuenta = new Map<string, number>();
    for (const fila of this.delDepartamento()) {
      if (fila.city !== null && fila.city !== '') {
        cuenta.set(fila.city, (cuenta.get(fila.city) ?? 0) + 1);
      }
    }
    return [...cuenta.entries()]
      .sort(([a, cuentaA], [b, cuentaB]) => cuentaB - cuentaA || a.localeCompare(b, 'es'))
      .map(([ciudad]) => ciudad);
  });

  /** Lo que queda después de los dos cortes de lugar. */
  private readonly filtradas = computed<readonly PublicSearchResult[]>(() => {
    const ciudad = this.ciudad();
    if (ciudad === null) {
      return this.delDepartamento();
    }
    const buscada = normalizarLugar(ciudad);
    return this.delDepartamento().filter(
      (fila) => fila.city !== null && normalizarLugar(fila.city) === buscada,
    );
  });

  /** La página que se está viendo, ya en forma de tarjeta. */
  protected readonly centros = computed<readonly FacilityCard[]>(() => {
    const desde = this.pagina() * POR_PAGINA;
    return this.filtradas()
      .slice(desde, desde + POR_PAGINA)
      .map(toFacilityCard);
  });

  protected readonly hayAnteriores = computed(() => this.pagina() > 0);
  protected readonly haySiguientes = computed(
    () => (this.pagina() + 1) * POR_PAGINA < this.filtradas().length,
  );

  /**
   * El rótulo de la paginación.
   *
   * Ahora dice un total **exacto**: el directorio está entero en memoria, así
   * que ya no hace falta el «aproximadamente» que exigía `totalHint`, que era
   * una pista del servidor y no un `COUNT`.
   */
  protected readonly rotuloDePagina = computed(() => {
    const total = this.filtradas().length;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    return `${this.centros().length} de ${total} · página ${this.pagina() + 1} de ${paginas}`;
  });

  /** El recuento de arriba de la grilla. */
  protected readonly recuento = computed(() => {
    const total = this.filtradas().length;
    const ciudad = this.ciudad();
    const departamento =
      this.ramas().find((rama) => rama.conceptId === this.departamentoElegido())?.nombre ?? null;
    const donde = ciudad !== null ? ` en ${ciudad}` : departamento !== null ? ` en ${departamento}` : '';
    return `${total} ${total === 1 ? 'centro' : 'centros'}${donde}`;
  });

  protected readonly aviso = computed(() =>
    this.recortada()
      ? 'Se muestran los primeros resultados. Usá el buscador para encontrar un centro que no aparezca en la lista.'
      : null,
  );

  /**
   * El establecimiento cuyo «Cómo llegar» está abierto; `null` si ninguno.
   *
   * Uno solo a la vez y colgado de la pantalla, no de la tarjeta: el diálogo es
   * modal, y montar veinticinco mapas de Leaflet —uno por tarjeta, apagados—
   * descarga el chunk veinticinco veces para no mostrar nada.
   */
  protected readonly comoLlegar = signal<FacilityCard | null>(null);

  constructor() {
    this.leerGeografia();

    this.tecleo
      .pipe(
        debounceTime(PAUSA_AL_ESCRIBIR_MS),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => {
        void this.router.navigate([], {
          relativeTo: this.ruta,
          // `null` **quita** el parámetro; `''` dejaría `?q=` colgando en la
          // URL de alguien que borró lo que había escrito.
          queryParams: { [PARAM_TEXTO]: q === '' ? null : q },
          queryParamsHandling: 'merge',
          // Reemplaza en vez de apilar: escribir no es navegar.
          replaceUrl: true,
        });
      });

    // `?q=` es la fuente de verdad de lo buscado, no una copia de lo que hay en
    // la caja: así una búsqueda se puede pegar en un mensaje y el servidor la
    // renderiza con resultados.
    this.ruta.queryParamMap
      .pipe(
        map((params) => params.get(PARAM_TEXTO) ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((q) => {
        this.texto.set(q);
        this.cargar();
      });

    // Cambiar cualquiera de los dos cortes de lugar vuelve a la primera página:
    // la página 3 de La Paz no es la página 3 de Cochabamba.
    this.ruta.queryParamMap
      .pipe(
        map((params) => `${params.get(PARAM_DEPARTAMENTO) ?? ''}|${params.get(PARAM_CIUDAD) ?? ''}`),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.pagina.set(0));
  }

  /* ---- acciones ----------------------------------------------------------- */

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.texto.set(valor);
    this.tecleo.next(valor);
  }

  /**
   * Elegir en el mapa va a la URL, como los chips, y **suelta la ciudad**.
   *
   * Los chips de ciudad son los del departamento elegido, así que al cambiar de
   * departamento el chip anterior deja de existir. Conservarlo dejaría un
   * filtro invisible acotando la lista a cero —Cochabamba dentro de La Paz no
   * devuelve nada— sin nada en pantalla que explique por qué.
   */
  protected elegirDepartamento(conceptId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [PARAM_DEPARTAMENTO]: conceptId, [PARAM_CIUDAD]: null },
      queryParamsHandling: 'merge',
    });
  }

  protected alElegirCiudad(nombre: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [PARAM_CIUDAD]: nombre },
      queryParamsHandling: 'merge',
    });
  }

  protected siguiente(): void {
    if (this.haySiguientes()) {
      this.pagina.update((n) => n + 1);
    }
  }

  protected anterior(): void {
    if (this.hayAnteriores()) {
      this.pagina.update((n) => n - 1);
    }
  }

  protected reintentar(): void {
    this.cargar();
  }

  /** Reintenta la lectura del catálogo geográfico tras un fallo. */
  protected reintentarGeo(): void {
    this.municipios.olvidar();
    this.leerGeografia();
  }

  /** Abre «Cómo llegar» del establecimiento elegido. */
  protected abrirComoLlegar(centro: FacilityCard): void {
    this.comoLlegar.set(centro);
  }

  protected cerrarComoLlegar(): void {
    this.comoLlegar.set(null);
  }

  /* ---- lectura ------------------------------------------------------------ */

  private leerGeografia(): void {
    this.catalogoGeoCaido.set(false);
    this.municipios
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ramas: readonly RamaDepartamento[]) => this.ramas.set(ramas),
        error: () => {
          this.ramas.set([]);
          this.catalogoGeoCaido.set(true);
        },
      });
  }

  private cargar(): void {
    this.estado.set('carga');
    this.recortada.set(false);
    this.pagina.set(0);

    const termino = this.texto().trim();
    const consulta: PublicSearchQuery = termino === '' ? {} : { q: termino };

    this.leerTodo(consulta, [], undefined, 0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (filas) => {
          this.todos.set(filas);
          this.estado.set(filas.length === 0 ? 'vacio' : 'datos');
        },
        error: () => this.estado.set('error'),
      });
  }

  /**
   * Recorre el cursor hasta agotarlo, o hasta el techo de páginas.
   *
   * Recursivo y no un bucle porque cada página depende del cursor de la
   * anterior: no se pueden pedir en paralelo.
   */
  private leerTodo(
    consulta: PublicSearchQuery,
    acumulado: readonly PublicSearchResult[],
    cursor: string | undefined,
    pagina: number,
  ): Observable<readonly PublicSearchResult[]> {
    return this.directorio
      .searchOrganizations({ ...consulta, limit: POR_PETICION, ...(cursor ? { cursor } : {}) })
      .pipe(
        switchMap((respuesta: PublicPage<PublicSearchResult>) => {
          const filas = [...acumulado, ...respuesta.items];
          if (respuesta.nextCursor === null) {
            return of(filas);
          }
          if (pagina + 1 >= MAX_PAGINAS) {
            this.recortada.set(true);
            return of(filas);
          }
          return this.leerTodo(consulta, filas, respuesta.nextCursor, pagina + 1);
        }),
      );
  }
}
