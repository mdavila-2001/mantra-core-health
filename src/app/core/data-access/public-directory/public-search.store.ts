/* ============================================================================
    El estado de una pantalla de búsqueda pública.

    Las seis pantallas de listado de V65 —la portada unificada, profesionales,
    medicamentos, hospitales, laboratorios y aseguradoras— hacen exactamente lo
    mismo con endpoints distintos: leen una página, muestran uno de cuatro
    estados, y avanzan por cursor. Esta clase es ese comportamiento, una vez.
    ========================================================================== */

import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
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

/** Cómo se lee una página. La cierra quien crea el store sobre su endpoint. */
export type LecturaDeBusqueda = (
  filtros: PublicSearchQuery,
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
 */
export class BusquedaPublica {
  private readonly peticiones = new Subject<PublicSearchQuery>();

  /** El texto libre. Lo escribe la pantalla; acá sólo se lee al pedir. */
  readonly texto = signal('');

  /** La ciudad, `''` = sin filtro. */
  readonly ciudad = signal('');

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

  readonly estado = this._estado.asReadonly();
  readonly resultados = this._resultados.asReadonly();
  readonly totalHint = this._totalHint.asReadonly();

  /** En qué página se está, contando desde 1. Es para el rótulo, no para pedir. */
  readonly pagina = computed(() => this.cursores().length + 1);

  readonly hayAnteriores = computed(() => this.cursores().length > 0);
  readonly haySiguientes = computed(() => this._nextCursor() !== null);

  /**
   * El rótulo de la paginación, con el matiz que exige el contrato.
   *
   * `totalHint` es una **pista** y puede ser `null`; escribir «N resultados»
   * con ella sería afirmar un total que la API no calculó. Cuando no hay pista
   * el rótulo dice cuántos se están viendo y en qué página, que es cierto.
   */
  readonly rotuloDePagina = computed(() => {
    const vistos = this._resultados().length;
    const total = this._totalHint();
    const pagina = this.pagina();
    if (total !== null) {
      return `${vistos} de aproximadamente ${total} · página ${pagina}`;
    }
    return `${vistos} en esta página · página ${pagina}`;
  });

  /**
   * @param lectura - Con qué endpoint se resuelve cada página. Se invoca en
   *   cada petición, así que puede leer señales de filtro propias de la
   *   pantalla y componerlas con los filtros comunes que recibe.
   */
  private readonly tecleo = new Subject<string>();

  constructor(private readonly lectura: LecturaDeBusqueda) {
    const destroyRef = inject(DestroyRef);
    const ruta = inject(ActivatedRoute);
    const router = inject(Router);

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
          this.lectura(filtros).pipe(
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
    ruta.queryParamMap
      .pipe(
        map((params) => params.get('q') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((q) => {
        this.texto.set(q);
        this.buscar();
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
    const cursor = this._nextCursor();
    if (cursor === null) return;
    this.cursores.update((pila) => [...pila, cursor]);
    this.pedir(cursor);
  }

  /** Retrocede una página repitiendo la petición con la que se llegó a ella. */
  anterior(): void {
    if (this.cursores().length === 0) return;
    const pila = this.cursores().slice(0, -1);
    this.cursores.set(pila);
    this.pedir(pila.at(-1));
  }

  /** Reintenta la página en pantalla, sin perder la posición ni los filtros. */
  reintentar(): void {
    this.pedir(this.cursores().at(-1));
  }

  private pedir(cursor: string | undefined): void {
    const filtros: PublicSearchQuery = {
      q: this.texto().trim(),
      city: this.ciudad(),
      limit: TAMANO_DE_PAGINA,
      ...(cursor === undefined ? {} : { cursor }),
    };
    this.peticiones.next(filtros);
  }

  private recibir(pagina: PublicPage<PublicSearchResult> | null): void {
    if (pagina === null) {
      this._estado.set('error');
      return;
    }
    this._resultados.set(pagina.items);
    this._nextCursor.set(pagina.nextCursor);
    this._totalHint.set(pagina.totalHint);
    this._estado.set(pagina.items.length === 0 ? 'vacio' : 'datos');
  }
}
