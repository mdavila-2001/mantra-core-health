import { computed, DestroyRef, Directive, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import type { Observable } from 'rxjs';

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

import { departmentByCity, normalizePlace } from '@shared/geo/city-department';

import { aTarjeta } from '../alovida/buscar/public-result.mapper';

import * as placeCuts from '@shared/directory/public-directory-cuts';

import * as cortes from './public-directory-filters';

/** Clave del chip de ciudad en la URL. */
const PARAM_CIUDAD = 'ciudad';

/** Clave del departamento elegido en el mapa, en la URL. */
const PARAM_DEPARTAMENTO = 'departamento';

/** Clave de la categoría elegida por chip, en la URL. */
const PARAM_CATEGORIA = 'categoria';

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
  /**
   * Si el directorio va embebido en otro contenedor.
   *
   * Lo pone el modal de consulta que abre «Tus accesos» (corrección del
   * 10/09/2026): el mismo directorio, con sus mismos filtros y su misma
   * autorización, sin el encabezado de página que el diálogo ya dibuja. La ruta
   * sigue existiendo y sigue abriendo la pantalla completa.
   */
  readonly embebido = input(false);

  /** La búsqueda del vertical concreto. La declara cada subclase. */
  protected abstract buscar(filtros: PublicSearchQuery): Observable<PublicPage<PublicSearchResult>>;

  /** Cómo se llama en singular lo que este directorio lista, para el vacío. */
  protected abstract readonly queSonEnSingular: string;

  /**
   * De dónde cuelga la ficha de un resultado, **dentro del panel**.
   *
   * Los dos directorios llevaban a `/o/:slug` y `/f/:slug`, que es la ficha
   * anónima bajo el marco de la red social: quien entraba desde su menú se
   * encontraba, sin pedirlo, fuera de la aplicación y en el buscador público.
   * El cliente lo pidió expresamente y no admite excepciones, así que la ruta
   * de la ficha la declara cada directorio y **no** sale del vertical.
   *
   * Es el mismo camino que ya hacía el directorio de laboratorios, que abre
   * `/laboratory-directory/:unitId` sin salir nunca del armazón.
   */
  protected abstract readonly rutaDeLaFicha: string;

  /** El botón de cada tarjeta; `null` deja la tarjeta sin botón. */
  protected readonly accionDeLaFicha: cortes.AccionDeLaFicha | null = null;

  private tarjetaDe(fila: PublicSearchResult) {
    return cortes.conAccion(aTarjeta(fila, this.opcionesDeTarjeta), this.accionDeLaFicha);
  }

  /**
   * Cómo se dibuja cada tarjeta: sin la insignia del vertical —este directorio
   * es de una sola clase— y con el destino de arriba.
   */
  private readonly opcionesDeTarjeta = {
    mostrarTipo: false,
    ruta: (fila: PublicSearchResult) => `${this.rutaDeLaFicha}/${encodeURIComponent(fila.slug)}`,
  } as const;

  protected readonly estado = signal<ViewState<readonly PublicSearchResult[]>>(loading());

  /** Si se cortó por el techo de páginas, para poder decirlo. */
  protected readonly recortada = signal(false);

  /** El texto libre, que sí viaja al servidor bajo `q`. */
  private readonly termino = signal('');

  /* ---- el mapa de Bolivia como filtro ------------------------------------ */

  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** El árbol de departamentos y municipios. Vacío mientras no llegue. */
  private readonly ramas = signal<readonly RamaDepartamento[]>([]);

  /** El catálogo no llegó: el mapa no se dibuja y se ofrece reintentar. */
  protected readonly catalogoGeoCaido = signal(false);

  /** De cada ciudad publicada al `conceptId` de su departamento. */
  private readonly porCiudad = computed(() => departmentByCity(this.ramas()));

  /**
   * Los parámetros de la URL, que son **la** fuente de los tres cortes en
   * memoria: el departamento del mapa, la ciudad y la verificación.
   *
   * Antes sólo el departamento se leía de acá y los otros dos vivían en
   * señales que escribía `filtrar()` cuando la barra emitía. Eso se rompía de
   * dos maneras que se ven en pantalla: al abrir un enlace con `?ciudad=…` la
   * barra dibujaba el chip puesto y la lista no estaba filtrada, y al tocar el
   * mapa —que navega sin pasar por la barra— la ciudad anterior seguía
   * acotando. Con una sola fuente las dos desaparecen.
   */
  private readonly parametros = toSignal(this.ruta.queryParams, {
    initialValue: {} as Params,
  });

  /** El valor de un parámetro, o `null` si no está o viene vacío. */
  private parametro(clave: string): string | null {
    const valor: unknown = this.parametros()[clave];
    return typeof valor === 'string' && valor !== '' ? valor : null;
  }

  /** El departamento elegido en el mapa. */
  protected readonly departamentoElegido = computed(() => this.parametro(PARAM_DEPARTAMENTO));

  /**
   * La ciudad elegida por chip, dentro del departamento.
   *
   * Una ciudad que no es del departamento elegido no cuenta: el departamento
   * se cambia desde la columna de facetas, que no sabe soltar la ciudad, y
   * Cochabamba dentro de La Paz dejaría la lista en cero sin nada que lo
   * explique.
   */
  protected readonly ciudad = computed(() => {
    const ciudad = this.parametro(PARAM_CIUDAD);
    const departamento = this.departamentoElegido();
    if (ciudad === null || departamento === null) {
      return ciudad;
    }
    return this.porCiudad().get(normalizePlace(ciudad)) === departamento ? ciudad : null;
  });

  /** Los cortes comunes puestos: verificación, nota y agenda. */
  private readonly cortesComunes = computed(() => cortes.cortesComunesDe((c) => this.parametro(c)));

  /**
   * La categoría elegida por chip: el código, nunca la etiqueta.
   *
   * Es el corte de **qué clase de sitio** es, que va antes que el de dónde
   * queda: entre una clínica privada y una caja de salud no decide la
   * distancia, decide si a uno lo atienden. Ver
   * `PublicSearchResult.category`.
   */
  protected readonly categoria = computed(() => this.parametro(PARAM_CATEGORIA));

  /**
   * Cuántos resultados tiene cada departamento, con los **otros** filtros
   * puestos pero no con el del propio mapa.
   *
   * Contar con el mapa aplicado dejaría a los ocho departamentos no elegidos en
   * cero, o sea el mapa diciendo que sólo hay centros donde uno acaba de
   * pulsar. La cuenta que sirve es la de «cuánto hay ahí si voy».
   */
  protected readonly cuentaPorDepartamento = computed<ReadonlyMap<string, number>>(() =>
    placeCuts.countByDepartment(this.paraElMapa(), this.porCiudad()),
  );

  /**
   * Elegir en el mapa va a la URL, como los chips.
   *
   * `null` **quita** el parámetro; dejar `?departamento=` colgando ensuciaría
   * el enlace de quien volvió a ver todo el país.
   *
   * Y **suelta la ciudad**: los chips de ciudad son los del departamento que
   * está elegido, así que al cambiar de departamento el chip anterior deja de
   * existir en la barra. Conservarlo dejaría un filtro invisible acotando la
   * lista a cero —Cochabamba dentro de La Paz no devuelve nada— sin nada en
   * pantalla que explique por qué.
   */
  protected elegirDepartamento(conceptId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { [PARAM_DEPARTAMENTO]: conceptId, [PARAM_CIUDAD]: null },
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
      ? `Se muestran los primeros resultados. Use el buscador para encontrar ${this.queSonEnSingular} que no aparezca en la lista.`
      : null,
  );

  /**
   * La base con la que el mapa cuenta: todo lo traído, con el único corte que
   * es independiente de dónde queda cada ficha.
   *
   * Ni el departamento ni la ciudad entran acá. El del mapa, porque contar con
   * él aplicado dejaría a los otros ocho departamentos en cero —el mapa
   * diciendo que sólo hay centros donde uno acaba de pulsar—. El de ciudad,
   * porque ahora es un corte **dentro** del departamento elegido: contarlo
   * haría exactamente lo mismo un nivel más abajo. La cuenta que sirve sigue
   * siendo la de «cuánto hay ahí si voy».
   */
  private readonly paraElMapa = computed(() => {
    const categoria = this.categoria();
    return (dataOf(this.estado()) ?? []).filter(
      (fila) =>
        cortes.pasaLosCortesComunes(fila, this.cortesComunes()) &&
        (categoria === null || fila.category?.code === categoria),
    );
  });

  /**
   * Las filas del departamento elegido, **sin** el corte de ciudad.
   *
   * Es la base con la que se arman los chips de ciudad, y por eso no puede
   * llevar el corte que esos chips aplican: calculados sobre lo ya filtrado,
   * tocar «Sucre» dejaría un solo chip en la barra y no habría cómo pasar a
   * otra ciudad sin quitar el filtro primero.
   */
  private readonly delDepartamento = computed<readonly PublicSearchResult[]>(() =>
    placeCuts.byDepartment(dataOf(this.estado()) ?? [], this.departamentoElegido(), this.porCiudad()),
  );

  /** Las filas que quedan después de los tres cortes en memoria. */
  private readonly filtradas = computed(() =>
    placeCuts.byCategory(this.paraLasCategorias(), this.categoria()),
  );

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
          .map((fila) => this.tarjetaDe(fila))
          .sort((a, b) => a.title.localeCompare(b.title, 'es')),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    if (sinCiudad.length > 0) {
      tramos.push({
        id: 'sin-ciudad',
        nombre: 'Sin ciudad declarada',
        resultados: sinCiudad
          .map((fila) => this.tarjetaDe(fila))
          .sort((a, b) => a.title.localeCompare(b.title, 'es')),
      });
    }
    return tramos;
  });

  /**
   * Las filas con **todos los cortes menos el de categoría**.
   *
   * Es la base con la que se arman los chips de categoría, y por eso no puede
   * llevar el corte que esos chips aplican: calculada sobre lo ya filtrado,
   * tocar «Clínica privada» dejaría un solo chip en la barra y no habría cómo
   * pasar a «Hospital público» sin quitar el filtro primero. Es la misma razón
   * por la que `delDepartamento` no lleva el corte de ciudad.
   */
  private readonly paraLasCategorias = computed<readonly PublicSearchResult[]>(() =>
    placeCuts
      .byCity(this.delDepartamento(), this.ciudad())
      .filter((fila) => cortes.pasaLosCortesComunes(fila, this.cortesComunes())),
  );

  /**
   * Las categorías que de verdad hay delante, de la que más tiene a la que
   * menos y a igualdad por nombre — el mismo orden que los chips de ciudad.
   *
   * Salen de los resultados y **no** de un catálogo, por el motivo de siempre:
   * un chip que devuelve cero es peor que no tenerlo. Y una fila sin categoría
   * no inventa una «Otras»: el contrato público todavía no sirve el campo
   * (ver `PublicSearchResult.category`), así que contra la API viva vuelven
   * todas en `null`, no hay dos categorías y la fila de chips no se dibuja
   * —que es exactamente lo que tiene que pasar—.
   */
  protected readonly categoriasDisponibles = computed<
    readonly { readonly code: string; readonly label: string }[]
>(() => placeCuts.publishedCategories(this.paraLasCategorias()));

  /**
   * Los chips: las ciudades **del departamento elegido**, y la verificación.
   *
   * ## Primero el departamento, y recién ahí las ciudades
   *
   * Es la corrección que pidió el cliente, y arregla algo que se veía: antes
   * los chips eran las diez ciudades con más fichas **del país**, y seguían
   * enteros después de elegir en el mapa. Quien tocaba Cochabamba se quedaba
   * mirando chips de Trinidad y de Sucre que no acotaban nada de lo que tenía
   * en pantalla —los tramos ya eran sólo de Cochabamba— y que al tocarlos
   * vaciaban la lista. Y las ciudades chicas del departamento que sí tenía
   * delante no estaban, porque el tope de diez se lo había comido el país.
   *
   * Así que sin departamento no se dibuja ninguno —el mapa es el corte de
   * arriba, y ofrecer las dos escalas a la vez es ofrecer dos preguntas para
   * una— y con departamento elegido están **todas** sus ciudades publicadas,
   * sin tope: son pocas y entran, que es lo que hace rápido el filtro.
   *
   * Siguen saliendo de los resultados y no del catálogo de municipios: de los
   * ochenta y siete de La Paz, la mayoría no tiene nada publicado, y un chip
   * que siempre devuelve cero es peor que no tenerlo.
   */
  protected readonly filtros = computed<readonly FilterDef[]>(() => {
    // Verificación, nota y agenda: ver `public-directory-filters.ts`.
    const filtros = [...cortes.filtrosComunes(dataOf(this.estado()) ?? [], this.cortesComunes())];

    /* ---- la categoría, que es el corte de arriba de todos --------------- */
    const categorias = this.categoriasDisponibles();
    if (categorias.length > 1) {
      // Va **primera** en la barra: es la pregunta más gruesa —qué clase de
      // sitio— y las de abajo acotan dentro de la respuesta. Con una sola
      // categoría no se dibuja, por lo mismo que no se dibuja el chip de una
      // única ciudad: un botón que no acota nada.
      filtros.unshift({
        key: PARAM_CATEGORIA,
        label: 'Categoría',
        icon: 'tag',
        asChips: true,
        options: categorias.map(({ code, label }) => ({ value: code, label })),
      });
    }

    /* ---- el departamento, en lugar del mapa (propietario, 23/10/2026) ---
       Sólo los que tienen algo, con cuántos: una opción que devuelve cero es
       un botón inútil. */
    const cuentas = this.cuentaPorDepartamento();
    const conFichas = this.ramas()
      .filter((rama) => (cuentas.get(rama.conceptId) ?? 0) > 0)
      .map((rama) => ({
        value: rama.conceptId,
        label: `${rama.nombre} (${cuentas.get(rama.conceptId)})`,
      }));
    const elegido = this.departamentoElegido();
    if (conFichas.length > 1 || elegido !== null) {
      filtros.unshift({
        key: PARAM_DEPARTAMENTO,
        label: 'Departamento',
        icon: 'pin',
        asChips: true,
        options: conFichas,
      });
    }

    if (elegido === null) {
      return filtros;
    }

    const ciudades = placeCuts
      .publishedCities(this.delDepartamento())
      .map((ciudad) => ({ value: ciudad, label: ciudad }));

    if (ciudades.length > 1) {
      // Con una sola ciudad el chip no acota nada: sería un botón que no hace
      // nada, dibujado con la misma pinta que los que sí. Va debajo del
      // departamento: acota dentro de él.
      const despuesDelDepartamento =
        filtros.findIndex((filtro) => filtro.key === PARAM_DEPARTAMENTO) + 1;
      filtros.splice(despuesDelDepartamento, 0, {
        key: PARAM_CIUDAD,
        label: 'Ciudad',
        icon: 'building',
        asChips: true,
        options: ciudades,
      });
    }
    return filtros;
  });

  protected readonly sinCoincidencias = computed<string | null>(() => {
    if (this.tramos().length > 0 || this.estado().status !== 'ready') {
      return null;
    }
    return this.departamentoElegido() === null
      ? 'Ninguno de los resultados coincide con los filtros que puso. Pruebe quitando alguno.'
      : 'No hay nada publicado en ese departamento con los filtros que puso. Quite el departamento para ver todo el país.';
  });

  /**
   * La barra cambió.
   *
   * El texto **vuelve a pedirle al servidor** —es el único filtro que el
   * controlador público aplica de verdad—. Los chips no se copian acá: la
   * barra ya los escribió en la URL antes de emitir, y de la URL los leen
   * `ciudad` y los cortes comunes.
   */
  protected filtrar(activos: Readonly<Record<string, string>>): void {
    const termino = activos[SEARCH_PARAM] ?? '';
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

    placeCuts.readWholeDirectory((filtros) => this.buscar(filtros), consulta).subscribe({
      next: ({ rows: filas, truncated }) => {
        this.recortada.set(truncated);
        this.estado.set(
          filas.length === 0
            ? empty(
                { label: 'Volver al panel', route: '/dashboard' },
                termino === ''
                  ? `Todavía no hay ${this.queSonEnSingular} con ficha pública publicada.`
                  : `No encontramos ${this.queSonEnSingular} que coincida con «${termino}».`,
              )
            : ready(filas),
        );
      },
      error: (error: unknown) =>
        this.estado.set(errorToViewState<readonly PublicSearchResult[]>(error)),
    });
  }
}
