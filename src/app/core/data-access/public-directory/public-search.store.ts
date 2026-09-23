/* ============================================================================
    El estado de una pantalla de búsqueda pública.

    Las seis pantallas de listado de V65 —la portada unificada, profesionales,
    medicamentos, hospitales, laboratorios y aseguradoras— hacen exactamente lo
    mismo con endpoints distintos: leen una página, muestran uno de cuatro
    estados, y avanzan por cursor. Esta clase es ese comportamiento, una vez.
    ========================================================================== */

import { DestroyRef, computed, inject, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
  type Observable,
} from 'rxjs';

import type {
  PublicPage,
  PublicSearchQuery,
  PublicSearchResult,
} from './public-directory.types';

/**
 * Los cuatro estados que la maqueta conmuta desde su `barra-maqueta`.
 *
 * Son los de `data-estado` en las 14 maquetas de V65, con los mismos nombres:
 * traducirlos a `loading`/`empty`/`error` obligaría a mapearlos de vuelta en
 * cada plantilla portada, que es donde el nombre tiene que coincidir.
 */
export type EstadoBusqueda = 'carga' | 'datos' | 'vacio' | 'error';

/**
 * Cómo se lee una página. La cierra quien crea el store sobre su endpoint.
 *
 * ## Por qué los filtros propios llegan por parámetro y no se leen del store
 *
 * Porque la primera lectura ocurre **dentro del constructor** de
 * `BusquedaPublica` —`queryParamMap` emite de forma síncrona al suscribirse—,
 * y en ese momento el campo del componente que guarda el store todavía no está
 * asignado. Una lectura que hiciera `this.busqueda.parametro('specialty')`
 * reventaría con un `TypeError` en el primer render; y como el flujo atrapa el
 * error para poder reintentar, la pantalla quedaría en estado de error sin una
 * sola pista en la consola.
 */
export type LecturaDeBusqueda = (
  filtros: PublicSearchQuery,
  /** Los filtros declarados que viajan en la URL, ya resueltos. `''` = sin filtro. */
  parametros: Readonly<Record<string, string>>,
) => Observable<PublicPage<PublicSearchResult>>;

/** Cuántos resultados pide una página. El servidor recorta a `[1, 50]`. */
export const TAMANO_DE_PAGINA = 25;

/**
 * Cuánto se espera antes de llevar lo tecleado a la URL.
 *
 * Sin esta pausa cada tecla sería una entrada en el historial del navegador y
 * una petición: escribir «cardiología» dejaría once estados y once lecturas, y
 * el botón «atrás» tardaría once toques en salir de la pantalla.
 */
const PAUSA_AL_ESCRIBIR_MS = 300;

/* ---- el corte territorial (subtarea 2.3) --------------------------------- */

/** Lo único que el corte territorial necesita saber de una fila para ubicarla. */
export interface FilaConCiudad {
  readonly city: string | null;
}

/**
 * El corte por lugar —departamento y después municipio— que una pantalla le
 * entrega al store.
 *
 * Es una interfaz y no la clase porque la implementación,
 * `shared/geo/filtro-territorial.ts`, habla con el catálogo de municipios y con
 * el router, y `core` no depende de `shared`. Al store le basta con saber qué
 * está elegido y cómo recortar.
 */
export interface CorteTerritorial {
  readonly departamentoElegido: Signal<string | null>;
  readonly ciudad: Signal<string | null>;
  readonly nombreDelDepartamento: Signal<string | null>;
  recortar<T extends FilaConCiudad>(filas: readonly T[]): readonly T[];
  ciudades(filas: readonly FilaConCiudad[]): readonly string[];
  cuentaPorDepartamento(filas: readonly FilaConCiudad[]): ReadonlyMap<string, number>;
  sinUbicar(filas: readonly FilaConCiudad[]): number;
}

/** Lo que una pantalla puede encender además de la lectura y sus filtros de URL. */
export interface OpcionesDeBusqueda {
  /**
   * El corte territorial. Sin él, el store se comporta exactamente como antes
   * de la subtarea 2.3: una página por petición, avanzando por cursor.
   */
  readonly territorio?: CorteTerritorial;

  /**
   * Enciende el corte por **categoría**: qué clase de cosa es cada resultado
   * dentro de su vertical (`PublicSearchResult.category`).
   *
   * Sólo tiene efecto junto con `territorio`, y no por capricho: el corte es en
   * memoria, y en memoria sólo está el directorio entero cuando el store lo
   * recorre —que es lo que enciende `territorio`—. Recortar **una página** de
   * veinticinco por categoría escondería lo que esa categoría tiene en la
   * página siguiente; el mismo defecto que ya se corrigió con el lugar.
   */
  readonly categorias?: boolean;
}

/** La clave del chip de categoría en la URL. */
export const PARAM_CATEGORIA = 'categoria';

/** Cuántos resultados pide cada petición al recorrer el directorio entero. Es el tope del servidor. */
export const POR_PETICION_TERRITORIAL = 50;

/**
 * Cuántas páginas se recorren como máximo al traer el directorio entero.
 *
 * El mismo techo que clínicas, farmacias y hospitales: un catálogo que crezca sin
 * control no puede encadenar peticiones indefinidamente. Cuando se llega, la
 * pantalla **lo dice** en vez de seguir pidiendo en silencio.
 */
export const MAX_PAGINAS_TERRITORIAL = 10;

/**
 * El estado de una pantalla de búsqueda pública, con paginación por cursor.
 *
 * ## Por qué una pila de cursores y no un número de página
 *
 * Porque el contrato pagina por cursor opaco: la API devuelve `nextCursor` y no
 * acepta un desplazamiento. «Anteriores» no se puede calcular —no existe un
 * `prevCursor`—, así que la única forma honesta de volver es recordar por dónde
 * se pasó. La pila guarda el cursor con el que se pidió cada página; volver es
 * desapilar y repetir la petición anterior.
 *
 * Se descartó ocultar «Anteriores»: la maqueta lo dibuja, y una lista pública
 * en la que sólo se puede avanzar obliga a empezar de cero para releer un
 * resultado que se acaba de pasar.
 *
 * ## Por qué `switchMap` y no un `resource`
 *
 * Porque cada tecla del buscador dispara una lectura y sólo interesa la última:
 * `switchMap` cancela la anterior en vuelo, así que dos respuestas fuera de
 * orden no pueden dejar en pantalla los resultados de una búsqueda vieja. Es
 * el fallo clásico de un buscador, y no se ve en desarrollo —donde la API
 * responde en 8 ms— sino con la red de quien lo usa.
 *
 * ## Un error no borra lo que ya se estaba leyendo
 *
 * `estado` pasa a `'error'` pero `resultados` conserva la página anterior, para
 * que reintentar no sea la única salida de una pantalla en blanco. La maqueta
 * lo dice en su propio texto de error: «tu búsqueda se mantiene escrita».
 *
 * ## Con corte territorial, el directorio se trae entero (subtarea 2.3)
 *
 * El contrato de estas búsquedas no acota por lugar: cada fila trae su ciudad y
 * nada más. Recortar **una página** de veinticinco por departamento escondería
 * lo que ese departamento tiene en la página siguiente —«no hay nada en Oruro»
 * cuando lo hay, tres páginas más allá—, que es el defecto que hospitales tuvo
 * que corregir. Así que con `territorio` el store recorre el cursor una vez,
 * con el texto y los filtros propios viajando al servidor como siempre, y
 * pagina en memoria sobre lo ya recortado. Cambiar el lugar no vuelve a pedir:
 * sólo vuelve a la primera página.
 */
export class BusquedaPublica {
  private readonly peticiones = new Subject<PublicSearchQuery>();

  /** El texto libre. Lo escribe la pantalla; acá sólo se lee al pedir. */
  readonly texto = signal('');

  /** La ciudad, `''` = sin filtro. */
  readonly ciudad = signal('');

  /**
   * Los filtros propios del vertical que viajan **en la URL** (AC-02-7).
   *
   * ## Por qué en la URL y no en una señal de la pantalla
   *
   * Por lo mismo que `?q=`: un directorio filtrado tiene que poder pegarse en
   * un mensaje, y el SSR no tiene una pantalla que leer —sólo la dirección—.
   * Un filtro guardado sólo en memoria renderiza en el servidor la lista sin
   * filtrar y la corrige después de hidratar, que es exactamente el parpadeo
   * que AC-02-11 prohíbe.
   *
   * Clave = nombre del parámetro (en inglés, TAREA-29); valor = `''` cuando no
   * hay filtro. Los declara la pantalla al construir el store, porque son
   * distintos por vertical.
   */
  private readonly _parametros = signal<Readonly<Record<string, string>>>({});

  readonly parametros = this._parametros.asReadonly();

  /** El valor de un filtro de URL, o `''`. */
  parametro(nombre: string): string {
    return this._parametros()[nombre] ?? '';
  }

  private readonly _estado = signal<EstadoBusqueda>('carga');
  private readonly _resultados = signal<readonly PublicSearchResult[]>([]);
  private readonly _nextCursor = signal<string | null>(null);
  private readonly _totalHint = signal<number | null>(null);

  /**
   * Los cursores con los que se pidió cada página ya vista.
   *
   * Vacía = primera página. El último elemento es el cursor de la página en
   * pantalla.
   */
  private readonly cursores = signal<readonly string[]>([]);

  /* ---- sólo con corte territorial ---------------------------------------- */

  /** El corte territorial, o `null` si la pantalla no lo encendió. */
  private readonly territorio: CorteTerritorial | null;

  /** Si la pantalla encendió el chip de categoría. Ver `OpcionesDeBusqueda`. */
  private readonly conCategorias: boolean;

  /**
   * Los parámetros de la dirección, leídos **aparte** de `nombresDeParametros`.
   *
   * La categoría no es un filtro del servidor: el contrato público no la
   * acepta, y el corte es en memoria sobre el directorio ya traído. Meterla en
   * `nombresDeParametros` la habría metido también en el canal que dispara una
   * lectura nueva, o sea que tocar un chip volvería a recorrer el cursor
   * entero para devolver exactamente las mismas filas.
   *
   * Lo asigna el constructor, antes de la primera lectura: `llaveDelLugar` la
   * consulta durante ese primer `recibir()`.
   */
  private parametrosDeRuta: Signal<Params> = signal({} as Params);

  /** El directorio entero, tal como llegó. Los cortes de lugar se aplican encima. */
  private readonly _todos = signal<readonly PublicSearchResult[]>([]);

  private readonly _recortada = signal(false);

  /** Si el recorrido se cortó por el techo de páginas, para poder decirlo. */
  readonly recortada = this._recortada.asReadonly();

  /**
   * En qué página local se está, atada al lugar con el que se llegó a ella.
   *
   * La página 3 de La Paz no es la página 3 de Cochabamba: si el lugar elegido
   * ya no es el de la llave, se está en la primera. Así cambiar de lugar vuelve
   * al principio sin una suscripción más a la URL.
   */
  private readonly _paginaLocal = signal<{ readonly llave: string; readonly indice: number }>({
    llave: '',
    indice: 0,
  });

  private readonly llaveDelLugar = computed(() =>
    this.territorio === null
      ? ''
      : `${this.territorio.departamentoElegido() ?? ''}|${this.territorio.ciudad() ?? ''}|${this.categoria() ?? ''}`,
  );

  private readonly indiceLocal = computed(() => {
    const pagina = this._paginaLocal();
    return pagina.llave === this.llaveDelLugar() ? pagina.indice : 0;
  });

  /**
   * La categoría elegida —el código, nunca la etiqueta—, o `null`.
   *
   * Vive en la URL como los demás filtros: un directorio acotado tiene que
   * poder pegarse en un mensaje, y el SSR sólo tiene la dirección que leer.
   */
  readonly categoria = computed<string | null>(() => {
    const valor: unknown = this.parametrosDeRuta()[PARAM_CATEGORIA];
    return typeof valor === 'string' && valor !== '' ? valor : null;
  });

  /** Lo que queda del directorio después del corte de categoría. */
  private readonly deLaCategoria = computed<readonly PublicSearchResult[]>(() => {
    const categoria = this.categoria();
    if (!this.conCategorias || categoria === null) {
      return this._todos();
    }
    return this._todos().filter((fila) => fila.category?.code === categoria);
  });

  /**
   * Las categorías que de verdad hay delante, de la que más tiene a la que
   * menos y a igualdad por nombre.
   *
   * Se cuentan sobre lo que el **lugar** deja ver pero sin el corte de la
   * propia categoría: con él, elegir una dejaría un solo chip y no habría cómo
   * pasar a otra sin quitar el filtro primero. Una fila sin categoría no
   * inventa una «Otras»: contra la API viva vuelven todas en `null`, no hay
   * dos categorías y la fila de chips no se dibuja.
   */
  readonly categoriasDisponibles = computed<
    readonly { readonly code: string; readonly label: string }[]
  >(() => {
    if (!this.conCategorias) {
      return [];
    }
    const base =
      this.territorio === null ? this._todos() : this.territorio.recortar(this._todos());
    const cuenta = new Map<string, { label: string; total: number }>();
    for (const fila of base) {
      const categoria = fila.category;
      if (categoria === null) continue;
      const anterior = cuenta.get(categoria.code);
      cuenta.set(categoria.code, { label: categoria.label, total: (anterior?.total ?? 0) + 1 });
    }
    return [...cuenta.entries()]
      .sort(([, a], [, b]) => b.total - a.total || a.label.localeCompare(b.label, 'es'))
      .map(([code, { label }]) => ({ code, label }));
  });

  /** Elegir categoría va a la URL, como los chips de lugar. */
  elegirCategoria(code: string | null): void {
    this.filtrarPor(PARAM_CATEGORIA, code ?? '');
  }

  /** Lo que queda del directorio después de los cortes de lugar y categoría. */
  private readonly filtradas = computed<readonly PublicSearchResult[]>(() =>
    this.territorio === null ? [] : this.territorio.recortar(this.deLaCategoria()),
  );

  /* ---- lo que lee la pantalla ------------------------------------------- */

  /**
   * El estado de la pantalla.
   *
   * Con corte territorial, un directorio que llegó con filas pero que el lugar
   * elegido deja sin ninguna es `'vacio'`, no `'datos'` con una grilla en
   * blanco.
   */
  readonly estado = computed<EstadoBusqueda>(() => {
    const estado = this._estado();
    if (this.territorio !== null && estado === 'datos' && this.filtradas().length === 0) {
      return 'vacio';
    }
    return estado;
  });

  /** Las filas de la página en pantalla. */
  readonly resultados = computed<readonly PublicSearchResult[]>(() => {
    if (this.territorio === null) {
      return this._resultados();
    }
    const desde = this.indiceLocal() * TAMANO_DE_PAGINA;
    return this.filtradas().slice(desde, desde + TAMANO_DE_PAGINA);
  });

  readonly totalHint = this._totalHint.asReadonly();

  /** En qué página se está, contando desde 1. Es para el rótulo, no para pedir. */
  readonly pagina = computed(() =>
    this.territorio === null ? this.cursores().length + 1 : this.indiceLocal() + 1,
  );

  readonly hayAnteriores = computed(() =>
    this.territorio === null ? this.cursores().length > 0 : this.indiceLocal() > 0,
  );

  readonly haySiguientes = computed(() =>
    this.territorio === null
      ? this._nextCursor() !== null
      : (this.indiceLocal() + 1) * TAMANO_DE_PAGINA < this.filtradas().length,
  );

  /**
   * El rótulo de la paginación, con el matiz que exige el contrato.
   *
   * `totalHint` es una **pista** y puede ser `null`; escribir «N resultados»
   * con ella sería afirmar un total que la API no calculó. Cuando no hay pista
   * el rótulo dice cuántos se están viendo y en qué página, que es cierto.
   *
   * Con corte territorial el total **es exacto** —el directorio está entero en
   * memoria—, así que se dice sin el «aproximadamente».
   */
  readonly rotuloDePagina = computed(() => {
    if (this.territorio !== null) {
      const total = this.filtradas().length;
      const paginas = Math.max(1, Math.ceil(total / TAMANO_DE_PAGINA));
      return `${this.resultados().length} de ${total} · página ${this.indiceLocal() + 1} de ${paginas}`;
    }
    const vistos = this._resultados().length;
    const total = this._totalHint();
    const pagina = this.pagina();
    if (total !== null) {
      return `${vistos} de aproximadamente ${total} · página ${pagina}`;
    }
    return `${vistos} en esta página · página ${pagina}`;
  });

  /** Los municipios del departamento elegido con algo publicado, para los chips. */
  readonly ciudadesDelLugar = computed<readonly string[]>(
    () => this.territorio?.ciudades(this._todos()) ?? [],
  );

  /** Cuánto tiene cada departamento, sin el corte del propio mapa. */
  readonly cuentaPorDepartamento = computed<ReadonlyMap<string, number>>(
    () => this.territorio?.cuentaPorDepartamento(this._todos()) ?? new Map<string, number>(),
  );

  /**
   * El resumen que acompaña al mapa. `null` sin departamento elegido: el propio
   * mapa ya escribe «Todavía no elegiste departamento».
   */
  readonly resumenDelLugar = computed<string | null>(() => {
    const territorio = this.territorio;
    const elegido = territorio?.departamentoElegido() ?? null;
    if (territorio === null || elegido === null) {
      return null;
    }
    const nombre = territorio.nombreDelDepartamento() ?? '';
    const cuantos = this.cuentaPorDepartamento().get(elegido) ?? 0;
    if (cuantos === 0) {
      return `Todavía no hay nada publicado en ${nombre}.`;
    }
    return `${cuantos} ${cuantos === 1 ? 'resultado' : 'resultados'} en ${nombre}. Tocá otra vez el departamento para ver todo el país.`;
  });

  /**
   * Lo que el corte de lugar no puede mostrar, dicho en vez de callado.
   *
   * Una ficha sin ciudad, con una ciudad que no es un municipio del catálogo o
   * con un nombre que el catálogo repite entre departamentos no se puede ubicar:
   * no aparece al acotar por departamento. Esconderla sin avisar sería decir que
   * no existe.
   */
  readonly avisoDelLugar = computed<string | null>(() => {
    if (this.territorio === null) {
      return null;
    }
    const avisos: string[] = [];
    if (this._recortada()) {
      avisos.push(
        'Se muestran los primeros resultados del directorio: usá el buscador para encontrar lo que no aparezca.',
      );
    }
    if (this.territorio.departamentoElegido() !== null) {
      const sinUbicar = this.territorio.sinUbicar(this._todos());
      if (sinUbicar === 1) {
        avisos.push(
          '1 resultado no declara una ciudad que diga de qué departamento es; aparece al ver todo el país.',
        );
      } else if (sinUbicar > 1) {
        avisos.push(
          `${sinUbicar} resultados no declaran una ciudad que diga de qué departamento son; aparecen al ver todo el país.`,
        );
      }
    }
    return avisos.length === 0 ? null : avisos.join(' ');
  });

  /**
   * @param lectura - Con qué endpoint se resuelve cada página. Se invoca en
   *   cada petición, así que puede leer señales de filtro propias de la
   *   pantalla y componerlas con los filtros comunes que recibe.
   */
  private readonly tecleo = new Subject<string>();

  /* El store se construye como campo de su componente, o sea dentro del
     contexto de inyección: `inject()` acá es válido y evita cargar el
     constructor con dos parámetros que no dicen nada. */
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  constructor(
    private readonly lectura: LecturaDeBusqueda,
    /**
     * Qué parámetros de la URL, además de `q`, son filtros de esta pantalla.
     * Ejemplo: `['specialty']` en el directorio de profesionales.
     */
    private readonly nombresDeParametros: readonly string[] = [],
    opciones: OpcionesDeBusqueda = {},
  ) {
    // Antes de cualquier suscripción: la primera lectura ocurre en este mismo
    // constructor y ya tiene que saber si recorre el directorio entero.
    this.territorio = opciones.territorio ?? null;
    this.conCategorias = opciones.categorias ?? false;
    this.parametrosDeRuta = toSignal(this.ruta.queryParams, { initialValue: {} as Params });

    const destroyRef = inject(DestroyRef);
    const ruta = this.ruta;
    const router = this.router;

    this.tecleo
      .pipe(debounceTime(PAUSA_AL_ESCRIBIR_MS), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe((q) => {
        void router.navigate([], {
          relativeTo: ruta,
          // `null` **quita** el parámetro; `''` dejaría `?q=` colgando en la
          // URL de alguien que borró lo que había escrito.
          queryParams: { q: q === '' ? null : q },
          queryParamsHandling: 'merge',
          // Reemplaza en vez de apilar: escribir no es navegar.
          replaceUrl: true,
        });
      });

    this.peticiones
      .pipe(
        tap(() => this._estado.set('carga')),
        switchMap((filtros) =>
          this.leer(filtros).pipe(
            // El error se convierte en un valor para que el flujo siga vivo:
            // un `error` que sube mata la suscripción, y la pantalla quedaría
            // sin poder reintentar sin recargarse entera.
            catchError(() => of(null)),
          ),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((pagina) => this.recibir(pagina));

    // **La suscripción a `peticiones` va primero, y no es cosmético.**
    // `queryParamMap` emite de forma síncrona al suscribirse, así que la línea
    // de abajo dispara la primera lectura durante este mismo constructor. Si
    // `peticiones` todavía no tuviera suscriptor, ese `next` se perdería —un
    // `Subject` descarta lo que emite sin nadie escuchando— y la pantalla se
    // quedaría en el esqueleto de carga **para siempre**, sin un error en la
    // consola y sin una petición en la pestaña de red. Hay una prueba que monta
    // el store y afirma que leyó, y falla si alguien reordena esto.
    // `?q=` es la fuente de verdad del texto buscado, no una copia de lo que
    // hay en la caja. Así una búsqueda se puede pegar en un mensaje, el
    // servidor la renderiza con resultados —el SSR no tiene una caja que
    // leer, sólo la URL— y el buscador del header público, que vive en otro
    // componente y no conoce a este, sólo tiene que navegar.
    //
    // Los filtros extra viajan por el MISMO canal que `q` y no por uno propio:
    // dos suscripciones al mismo `queryParamMap` dispararían dos lecturas por
    // cada cambio que toque las dos cosas —elegir una especialidad teniendo
    // texto escrito—, y `switchMap` cancelaría la primera a mitad de vuelo.
    ruta.queryParamMap
      .pipe(
        map((params) => ({
          q: params.get('q') ?? '',
          extra: Object.fromEntries(
            this.nombresDeParametros.map((nombre) => [nombre, params.get(nombre) ?? '']),
          ),
        })),
        distinctUntilChanged(
          (anterior, actual) =>
            anterior.q === actual.q &&
            this.nombresDeParametros.every(
              (nombre) => anterior.extra[nombre] === actual.extra[nombre],
            ),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(({ q, extra }) => {
        this.texto.set(q);
        this._parametros.set(extra);
        this.buscar();
      });
  }

  /**
   * Fija un filtro de URL, o lo quita con `''`.
   *
   * No llama a `buscar()`: la lectura la dispara el cambio de la dirección,
   * igual que con `q`. Llamarla acá además pediría dos veces.
   *
   * `replaceUrl` es `false` a propósito, al revés que al teclear: elegir una
   * especialidad **sí** es navegar, y «atrás» tiene que deshacerlo.
   */
  filtrarPor(nombre: string, valor: string): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      // `null` quita el parámetro; `''` dejaría `?specialty=` colgando.
      queryParams: { [nombre]: valor === '' ? null : valor },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Lo que se escribió en la caja.
   *
   * Refleja la tecla en el acto —la caja no puede ir a destiempo de los dedos—
   * y lleva el valor a `?q=` con una pausa; la lectura la dispara el cambio de
   * la URL, no esta llamada.
   */
  escribir(valor: string): void {
    this.texto.set(valor);
    this.tecleo.next(valor);
  }

  /** Busca desde la primera página. Es lo que hace escribir o filtrar. */
  buscar(): void {
    this.cursores.set([]);
    this.pedir(undefined);
  }

  /** Avanza. No hace nada si no hay siguiente: el botón va deshabilitado. */
  siguiente(): void {
    if (this.territorio !== null) {
      if (this.haySiguientes()) {
        this._paginaLocal.set({ llave: this.llaveDelLugar(), indice: this.indiceLocal() + 1 });
      }
      return;
    }
    const cursor = this._nextCursor();
    if (cursor === null) return;
    this.cursores.update((pila) => [...pila, cursor]);
    this.pedir(cursor);
  }

  /** Retrocede una página repitiendo la petición con la que se llegó a ella. */
  anterior(): void {
    if (this.territorio !== null) {
      if (this.hayAnteriores()) {
        this._paginaLocal.set({ llave: this.llaveDelLugar(), indice: this.indiceLocal() - 1 });
      }
      return;
    }
    if (this.cursores().length === 0) return;
    const pila = this.cursores().slice(0, -1);
    this.cursores.set(pila);
    this.pedir(pila.at(-1));
  }

  /** Reintenta la página en pantalla, sin perder la posición ni los filtros. */
  reintentar(): void {
    this.pedir(this.territorio === null ? this.cursores().at(-1) : undefined);
  }

  private pedir(cursor: string | undefined): void {
    const filtros: PublicSearchQuery = {
      q: this.texto().trim(),
      city: this.ciudad(),
      limit: this.territorio === null ? TAMANO_DE_PAGINA : POR_PETICION_TERRITORIAL,
      ...(cursor === undefined ? {} : { cursor }),
    };
    this.peticiones.next(filtros);
  }

  /** Una página, o con corte territorial el directorio entero en una sola página. */
  private leer(filtros: PublicSearchQuery): Observable<PublicPage<PublicSearchResult>> {
    if (this.territorio === null) {
      return this.lectura(filtros, this._parametros());
    }
    this._recortada.set(false);
    return this.leerTodo(filtros, [], 0);
  }

  /**
   * Recorre el cursor hasta agotarlo, o hasta el techo de páginas.
   *
   * Recursivo y no un bucle porque cada página depende del cursor de la
   * anterior: no se pueden pedir en paralelo.
   */
  private leerTodo(
    filtros: PublicSearchQuery,
    acumulado: readonly PublicSearchResult[],
    paginasLeidas: number,
  ): Observable<PublicPage<PublicSearchResult>> {
    return this.lectura(filtros, this._parametros()).pipe(
      switchMap((pagina) => {
        const items = [...acumulado, ...pagina.items];
        if (pagina.nextCursor === null || paginasLeidas + 1 >= MAX_PAGINAS_TERRITORIAL) {
          if (pagina.nextCursor !== null) {
            this._recortada.set(true);
          }
          return of({ ...pagina, items, nextCursor: null, totalHint: items.length });
        }
        return this.leerTodo({ ...filtros, cursor: pagina.nextCursor }, items, paginasLeidas + 1);
      }),
    );
  }

  private recibir(pagina: PublicPage<PublicSearchResult> | null): void {
    if (pagina === null) {
      this._estado.set('error');
      return;
    }
    if (this.territorio !== null) {
      this._todos.set(pagina.items);
      this._paginaLocal.set({ llave: this.llaveDelLugar(), indice: 0 });
      this._nextCursor.set(null);
      this._totalHint.set(pagina.items.length);
      this._estado.set(pagina.items.length === 0 ? 'vacio' : 'datos');
      return;
    }
    this._resultados.set(pagina.items);
    this._nextCursor.set(pagina.nextCursor);
    this._totalHint.set(pagina.totalHint);
    this._estado.set(pagina.items.length === 0 ? 'vacio' : 'datos');
  }
}
