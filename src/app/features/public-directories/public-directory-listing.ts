import { computed, DestroyRef, Directive, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import { map, of, switchMap, type Observable } from 'rxjs';

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
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';
import type { DepartamentoElegible } from '@shared/components/organisms/department-map/department-map';

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

/** Clave del departamento elegido en el mapa, en la URL. */
const PARAM_DEPARTAMENTO = 'departamento';

/**
 * Quita tildes y baja a minúsculas, para casar el nombre de ciudad que trae el
 * directorio con el del municipio del catálogo.
 *
 * Los dos vienen escritos por gente distinta —uno lo cargó la organización en
 * su ficha, el otro lo siembra terminología— y «Potosí» y «potosi» tienen que
 * ser la misma ciudad. Sin esto el mapa dejaría fuera justo a los
 * departamentos cuyo nombre lleva tilde, que son la mitad.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .trim();
}

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

  /** Los tres cortes que se aplican en memoria. */
  protected readonly ciudad = signal<string | null>(null);
  protected readonly soloVerificados = signal(false);

  /* ---- el mapa de Bolivia como filtro ------------------------------------ */

  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

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
   * no es un filtro honesto, es un dibujo roto — y quien lo mira no sabría si
   * Pando no está porque no hay farmacias o porque el mapa está mal. Se dibuja
   * el país entero y cada departamento dice **cuántos** tiene, que es la
   * información que el chip escondía.
   */
  protected readonly departamentos = computed<readonly DepartamentoElegible[]>(() =>
    this.ramas().map((rama) => ({
      conceptId: rama.conceptId,
      sigla: rama.sigla,
      nombre: rama.nombre,
    })),
  );

  /**
   * De cada ciudad publicada al `conceptId` de su departamento.
   *
   * Se arma con los municipios del catálogo, que es el dueño del dato: una
   * tabla de ciudades escrita acá se separaría del catálogo en cuanto alguien
   * sembrara un municipio nuevo, y el directorio empezaría a esconder centros
   * sin que nadie lo notara.
   */
  private readonly departamentoPorCiudad = computed<ReadonlyMap<string, string>>(() => {
    const mapa = new Map<string, string>();
    for (const rama of this.ramas()) {
      for (const municipio of rama.municipios) {
        mapa.set(normalizar(municipio.nombre), rama.conceptId);
      }
    }
    return mapa;
  });

  /** El departamento elegido en el mapa, leído de la URL. */
  private readonly departamentoEnUrl = toSignal(
    this.ruta.queryParams.pipe(
      map((params: Params) => {
        const valor: unknown = params[PARAM_DEPARTAMENTO];
        return typeof valor === 'string' && valor !== '' ? valor : null;
      }),
    ),
    { initialValue: null },
  );

  protected readonly departamentoElegido = computed(() => this.departamentoEnUrl());

  /**
   * Cuántos resultados tiene cada departamento, con los **otros** filtros
   * puestos pero no con el del propio mapa.
   *
   * Contar con el mapa aplicado dejaría a los ocho departamentos no elegidos en
   * cero, o sea el mapa diciendo que sólo hay centros donde uno acaba de
   * pulsar. La cuenta que sirve es la de «cuánto hay ahí si voy».
   */
  protected readonly cuentaPorDepartamento = computed<ReadonlyMap<string, number>>(() => {
    const porCiudad = this.departamentoPorCiudad();
    const cuenta = new Map<string, number>();
    for (const fila of this.filtradasSinDepartamento()) {
      const conceptId = fila.city === null ? undefined : porCiudad.get(normalizar(fila.city));
      if (conceptId === undefined) continue;
      cuenta.set(conceptId, (cuenta.get(conceptId) ?? 0) + 1);
    }
    return cuenta;
  });

  /**
   * El resumen que acompaña al mapa: cuántos hay y cómo se vuelve.
   *
   * `null` cuando no hay departamento elegido, y no un «tocá un departamento»:
   * el propio mapa ya escribe «Todavía no elegiste departamento» en su línea
   * viva —es la tercera señal de su estado, la que no depende del color— y dos
   * renglones seguidos diciendo lo mismo se leen como un error de la pantalla.
   */
  protected readonly resumenDelMapa = computed<string | null>(() => {
    const elegido = this.departamentoElegido();
    if (elegido === null) {
      return null;
    }
    const nombre = this.ramas().find((rama) => rama.conceptId === elegido)?.nombre ?? '';
    const cuantos = this.cuentaPorDepartamento().get(elegido) ?? 0;
    if (cuantos === 0) {
      return `Todavía no hay nada publicado en ${nombre}.`;
    }
    return `${cuantos} en ${nombre}. Tocá otra vez el departamento para ver todo el país.`;
  });

  /**
   * Elegir en el mapa va a la URL, como los chips.
   *
   * `null` **quita** el parámetro; dejar `?departamento=` colgando ensuciaría
   * el enlace de quien volvió a ver todo el país.
   */
  protected elegirDepartamento(conceptId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [PARAM_DEPARTAMENTO]: conceptId },
      queryParamsHandling: 'merge',
    });
  }

  constructor() {
    // El catálogo geográfico se pide una vez, acá y no en cada subclase: los
    // dos directorios dibujan el mismo mapa y `BoMunicipalitiesService` ya
    // cachea la lectura, así que abrir uno y después el otro no vuelve a pedir.
    this.leerGeografia();
  }

  /** Reintenta la lectura del catálogo geográfico tras un fallo. */
  protected reintentarGeo(): void {
    this.municipios.olvidar();
    this.leerGeografia();
  }

  protected leerGeografia(): void {
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

  protected readonly aviso = computed(() =>
    this.recortada()
      ? `Se muestran los primeros resultados. Usá el buscador para encontrar ${this.queSonEnSingular} que no aparezca en la lista.`
      : null,
  );

  /**
   * Las filas que quedan tras los cortes de chip, **sin** el del mapa.
   *
   * Existe aparte porque es la base con la que el mapa cuenta: ver
   * `cuentaPorDepartamento`.
   */
  private readonly filtradasSinDepartamento = computed(() => {
    const ciudad = this.ciudad();
    const soloVerificados = this.soloVerificados();
    return (dataOf(this.estado()) ?? []).filter(
      (fila) =>
        (ciudad === null || fila.city === ciudad) && (!soloVerificados || fila.verified),
    );
  });

  /** Las filas que quedan después de los tres cortes en memoria. */
  private readonly filtradas = computed(() => {
    const departamento = this.departamentoElegido();
    if (departamento === null) {
      return this.filtradasSinDepartamento();
    }
    const porCiudad = this.departamentoPorCiudad();
    return this.filtradasSinDepartamento().filter(
      (fila) => fila.city !== null && porCiudad.get(normalizar(fila.city)) === departamento,
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
        // Sin insignia de vertical: este directorio es de una sola clase, y
        // repetirla en cada tarjeta le roba el renglón al subtítulo. Ver
        // `OpcionesDeTarjeta`.
        resultados: filas
          .map((fila) => aTarjeta(fila, { mostrarTipo: false }))
          .sort((a, b) => a.title.localeCompare(b.title, 'es')),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    if (sinCiudad.length > 0) {
      tramos.push({
        id: 'sin-ciudad',
        nombre: 'Sin ciudad declarada',
        resultados: sinCiudad
          .map((fila) => aTarjeta(fila, { mostrarTipo: false }))
          .sort((a, b) => a.title.localeCompare(b.title, 'es')),
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
    return this.departamentoElegido() === null
      ? 'Ninguno de los resultados coincide con los filtros que pusiste. Probá quitando alguno.'
      : 'No hay nada publicado en ese departamento con los filtros que pusiste. Tocalo otra vez en el mapa para ver todo el país.';
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
