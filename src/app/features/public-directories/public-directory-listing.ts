import { computed, Directive, signal } from '@angular/core';
import { of, switchMap, type Observable } from 'rxjs';

import type {
  PublicPage,
  PublicSearchQuery,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import type { GrupoDeDirectorio } from '@shared/components/organisms/directory-page/directory-page.types';
import { SEARCH_PARAM, type FilterDef } from '@shared/components/organisms/filter-bar/filter-bar';

import { aTarjeta } from '../alovida/buscar/public-result.mapper';

/** Tope por página que acepta el contrato público (`limit` se recorta a 50). */
const POR_PAGINA = 50;

/**
 * Cuántas páginas se recorren como máximo.
 *
 * El mismo techo y por el mismo motivo que el directorio de médicos: un
 * directorio se hojea entero, y el tope existe para que un catálogo que crezca
 * sin control no encadene peticiones indefinidamente. Cuando se llega, la
 * pantalla **lo dice** en vez de seguir pidiendo en silencio.
 */
const MAX_PAGINAS = 10;

/** Clave del chip de ciudad en la URL. */
const PARAM_CIUDAD = 'ciudad';

/** Clave del chip de verificación en la URL. */
const PARAM_VERIFICADO = 'verificado';

/**
 * Cuántas ciudades se ofrecen como chips. Ver el porqué del tope en el
 * directorio de médicos: los chips valen porque se ven todos.
 */
const MAXIMO_DE_CHIPS = 10;

/**
 * Lo común a los dos directorios públicos nuevos: clínicas y farmacias
 * (A5 y A6 del plan de UX del 22/08/2026).
 *
 * ## Por qué se pudieron construir sin tocar el backend
 *
 * El plan los daba por bloqueados —«casi seguro necesitan endpoints públicos
 * que hoy no están»— y no lo estaban: `GET /public/search/organizations` y
 * `GET /public/search/pharmacies` existen desde el contrato público del
 * 17/08/2026 y ya los consumía la búsqueda sin sesión de ALOVIDA. Lo que
 * faltaba era la **sección dentro del armazón**, que es lo que un paciente con
 * sesión puede recorrer desde su menú.
 *
 * ## Por qué filtra en memoria y no le pasa los filtros al servidor
 *
 * Porque el controlador público **sólo lee `q`** (y `verified`, sólo en el
 * vertical de profesionales): `city` figura en el contrato pero no se aplica.
 * Mandarle `?city=Cochabamba` devolvería la lista entera y la pantalla diría,
 * sin decirlo, que todos esos resultados son de Cochabamba. Es exactamente la
 * «pantalla que aparenta funcionar» que la corrección #7 prohíbe.
 *
 * Así que el chip de ciudad acota **sobre lo que ya está en pantalla**, que es
 * honesto y funciona: el directorio se trae entero al abrirse, igual que el de
 * médicos. El día que el controlador lea `city`, el cambio es mover el filtro a
 * la consulta y borrar el `filter` de acá.
 *
 * ## Y por qué las ciudades salen de los resultados y no de un catálogo
 *
 * Un chip que siempre devuelve cero es peor que no tenerlo. Estas ciudades son
 * las que de verdad tienen algo publicado.
 */
@Directive()
export abstract class PublicDirectoryListing {
  /** La búsqueda del vertical concreto. La declara cada subclase. */
  protected abstract buscar(filtros: PublicSearchQuery): Observable<PublicPage<PublicSearchResult>>;

  /** Cómo se llama en singular lo que este directorio lista, para el vacío. */
  protected abstract readonly queSonEnSingular: string;

  protected readonly estado = signal<ViewState<readonly PublicSearchResult[]>>(loading());

  /** Si se cortó por el techo de páginas, para poder decirlo. */
  protected readonly recortada = signal(false);

  /** El texto libre, que sí viaja al servidor bajo `q`. */
  private readonly termino = signal('');

  /** Los dos cortes que se aplican en memoria. */
  protected readonly ciudad = signal<string | null>(null);
  protected readonly soloVerificados = signal(false);

  protected readonly aviso = computed(() =>
    this.recortada()
      ? `Se muestran los primeros resultados. Usá el buscador para encontrar ${this.queSonEnSingular} que no aparezca en la lista.`
      : null,
  );

  /** Las filas que quedan después de los cortes en memoria. */
  private readonly filtradas = computed(() => {
    const ciudad = this.ciudad();
    const soloVerificados = this.soloVerificados();
    return (dataOf(this.estado()) ?? []).filter(
      (fila) =>
        (ciudad === null || fila.city === ciudad) && (!soloVerificados || fila.verified),
    );
  });

  /**
   * Los tramos del directorio: uno por ciudad, y uno final para las fichas que
   * no la declararon.
   *
   * Sin ciudad **no se esconde a nadie**: una clínica que no la cargó existe
   * igual y tiene que poder encontrarse. Va al final porque es lo menos útil
   * para hojear, no porque valga menos.
   */
  protected readonly tramos = computed<readonly GrupoDeDirectorio[]>(() => {
    const porCiudad = new Map<string, PublicSearchResult[]>();
    const sinCiudad: PublicSearchResult[] = [];

    for (const fila of this.filtradas()) {
      if (fila.city === null || fila.city === '') {
        sinCiudad.push(fila);
        continue;
      }
      porCiudad.set(fila.city, [...(porCiudad.get(fila.city) ?? []), fila]);
    }

    const tramos = [...porCiudad.entries()]
      .map(([ciudad, filas]) => ({
        id: ciudad,
        nombre: ciudad,
        resultados: filas.map(aTarjeta).sort((a, b) => a.title.localeCompare(b.title, 'es')),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    if (sinCiudad.length > 0) {
      tramos.push({
        id: 'sin-ciudad',
        nombre: 'Sin ciudad declarada',
        resultados: sinCiudad.map(aTarjeta).sort((a, b) => a.title.localeCompare(b.title, 'es')),
      });
    }
    return tramos;
  });

  /** Los chips: las ciudades que de verdad tienen algo, y la verificación. */
  protected readonly filtros = computed<readonly FilterDef[]>(() => {
    const cuentaPorCiudad = new Map<string, number>();
    for (const fila of dataOf(this.estado()) ?? []) {
      if (fila.city !== null && fila.city !== '') {
        cuentaPorCiudad.set(fila.city, (cuentaPorCiudad.get(fila.city) ?? 0) + 1);
      }
    }

    const ciudades = [...cuentaPorCiudad.entries()]
      .sort(([a, cuentaA], [b, cuentaB]) => cuentaB - cuentaA || a.localeCompare(b, 'es'))
      .slice(0, MAXIMO_DE_CHIPS)
      .map(([ciudad]) => ({ value: ciudad, label: ciudad }));

    const filtros: FilterDef[] = [
      {
        key: PARAM_VERIFICADO,
        label: 'Verificación',
        asChips: true,
        options: [{ value: 'true', label: 'Sólo verificadas' }],
      },
    ];
    if (ciudades.length > 1) {
      // Con una sola ciudad el chip no acota nada: sería un botón que no hace
      // nada, dibujado con la misma pinta que los que sí.
      filtros.unshift({ key: PARAM_CIUDAD, label: 'Ciudad', asChips: true, options: ciudades });
    }
    return filtros;
  });

  protected readonly sinCoincidencias = computed<string | null>(() => {
    if (this.tramos().length > 0 || this.estado().status !== 'ready') {
      return null;
    }
    return 'Ninguno de los resultados coincide con los filtros que pusiste. Probá quitando alguno.';
  });

  /**
   * La barra cambió.
   *
   * El texto **vuelve a pedirle al servidor** —es el único filtro que el
   * controlador público aplica de verdad— y los chips se resuelven en memoria.
   */
  protected filtrar(activos: Readonly<Record<string, string>>): void {
    const termino = activos[SEARCH_PARAM] ?? '';
    this.ciudad.set(activos[PARAM_CIUDAD] ?? null);
    this.soloVerificados.set(activos[PARAM_VERIFICADO] === 'true');

    if (termino !== this.termino()) {
      this.termino.set(termino);
      this.cargar();
    }
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.recortada.set(false);

    const termino = this.termino();
    const consulta: PublicSearchQuery = termino === '' ? {} : { q: termino };

    this.leerTodo(consulta, [], undefined, 0).subscribe({
      next: (filas) =>
        this.estado.set(
          filas.length === 0
            ? empty(
                { label: 'Volver al panel', route: '/dashboard' },
                termino === ''
                  ? `Todavía no hay ${this.queSonEnSingular} con ficha pública publicada.`
                  : `No encontramos ${this.queSonEnSingular} que coincida con «${termino}».`,
              )
            : ready(filas),
        ),
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly PublicSearchResult[]>(error)),
    });
  }

  /**
   * Recorre el cursor hasta agotarlo, o hasta el techo de páginas.
   *
   * Recursivo y no un bucle porque cada página depende del cursor de la
   * anterior: no se pueden pedir en paralelo. Es el mismo recorrido que ya hace
   * el directorio de médicos.
   */
  private leerTodo(
    consulta: PublicSearchQuery,
    acumulado: readonly PublicSearchResult[],
    cursor: string | undefined,
    pagina: number,
  ): Observable<readonly PublicSearchResult[]> {
    return this.buscar({ ...consulta, limit: POR_PAGINA, ...(cursor ? { cursor } : {}) }).pipe(
      switchMap((respuesta) => {
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
