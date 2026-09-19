import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import { PublicCatalogClient } from '@core/data-access/public-catalog/public-catalog.client';
import type {
  PublicBranchAvailability,
  PublicGeoPoint,
  PublicPharmacyBranch,
  PublicPharmacyProduct,
} from '@core/data-access/public-catalog/public-catalog.types';
import type { PublicPage } from '@core/data-access/public-directory/public-directory.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { dataOf, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { Badge } from '@shared/components/atoms/badge/badge';
import { AppButton } from '@shared/components/atoms/button/button';
import { Chip } from '@shared/components/atoms/chip/chip';
import { ServiceIcon } from '@shared/components/atoms/service-icon/service-icon';
import { Skeleton } from '@shared/components/atoms/skeleton/skeleton';
import { Card } from '@shared/components/molecules/card/card';
import { FactList } from '@shared/components/molecules/fact-list/fact-list';
import { SearchField } from '@shared/components/molecules/search-field/search-field';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { Textarea } from '@shared/components/atoms/textarea/textarea';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { SectionHeading } from '@shared/components/molecules/section-heading/section-heading';
import { distanciaEnLineaRectaKm } from '@shared/components/organisms/map/geo';
import { AppMap } from '@shared/components/organisms/map/map';
import type { PinMapa } from '@shared/components/organisms/map/pin-mapa.types';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { PublicCatalogDetail } from '../public-catalog-detail';

/** El rótulo del grupo de los que no declararon ninguno. */
const SIN_GRUPO = 'Sin grupo declarado';

/**
 * Desde cuántos medicamentos aparece el buscador.
 *
 * El mismo siete de `laboratory-detail` y de `fact-section.types.ts`, y por el
 * mismo motivo: con menos se ven todos a la vez y un buscador sobre lo que ya
 * está entero en pantalla no ahorra nada — peor, sugiere que hay algo
 * escondido. Ninguna góndola del corpus baja de ocho productos, así que en la
 * práctica el buscador está siempre.
 */
const MINIMO_PARA_BUSCAR = 7;

/**
 * Cuántas sucursales muestra el resultado de una receta.
 *
 * La lista completa ya está arriba; repetirla entera con precios entierra la
 * recomendación bajo tres pantallas. La pantalla dice cuántas muestra y de
 * cuántas — esconder sin avisar es lo que no se puede hacer.
 */
const TOPE_DE_RESULTADOS = 8;

/** Cuánto se espera a que alguien conteste el cartel de ubicación. */
const ESPERA_DE_UBICACION_MS = 10_000;

/** Una lectura de hasta cinco minutos sirve: nadie cruza la ciudad en ese rato. */
const EDAD_DE_UBICACION_MS = 5 * 60 * 1000;

/** Baja a minúsculas y quita tildes, para que «Analgésicos» case con «analgesicos». */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * **La ficha de una farmacia**, dentro del panel.
 *
 * El hermano de {@link ClinicDetail}, por el mismo motivo: el clic en
 * «Directorio de farmacias» abría `/f/:slug` —la ficha anónima bajo el marco de
 * la red social— y se llevaba afuera de la aplicación a quien había entrado por
 * su menú.
 *
 * Muestra **dónde queda y qué medicamentos tiene a cuánto**, que es lo que hace
 * falta antes de mandar a alguien con una receta. Sin edición de precio: el
 * catálogo es de la farmacia.
 *
 * ## Por qué el mapa
 *
 * Porque «Av. 6 de Marzo N.º 220, El Alto» no contesta la pregunta que trae a
 * alguien a la ficha de una farmacia —si le queda cerca— y el punto ya viaja en
 * la ficha (`location`). Es el organismo compartido, el mismo de «Dónde comprar
 * mi receta»: Leaflet sobre mosaicos de CARTO, porque la política de seguridad
 * de contenido no abre `frame-src` para un *embed* ajeno. Sin coordenadas no se
 * dibuja nada — un mapa de la ciudad entera no ubica una farmacia.
 *
 * ## Por qué el grupo terapéutico es un chip y ya no un encabezado
 *
 * Hasta el 19/09/2026 el catálogo venía partido en tramos, uno por grupo, con
 * su `<h3>` encima. El cliente lo pidió sacar y tiene razón: con ocho o trece
 * productos, partirlos en cinco tramos de dos deja una pantalla de títulos con
 * una tarjeta debajo, y el grupo —que es un dato **del medicamento**— quedaba
 * escrito fuera de la tarjeta que lo describe. Ahora va adentro, como chip, y
 * el corte por grupo pasó a ser lo que siempre debió ser: **un filtro**, que a
 * diferencia del encabezado se puede combinar con el buscador y con el stock.
 */
@Component({
  selector: 'app-pharmacy-detail',
  imports: [
    AppButton,
    AppMap,
    Badge,
    Card,
    Chip,
    FactList,
    FormField,
    NavIcon,
    PageHeader,
    RouterLink,
    SearchField,
    SectionHeading,
    ServiceIcon,
    Skeleton,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './pharmacy-detail.html',
  styleUrls: ['../../../shared/styles/rejilla-de-tarjetas.css', '../../../shared/styles/ficha-publica.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyDetail extends PublicCatalogDetail<PublicPharmacyProduct> {
  private readonly catalogo = inject(PublicCatalogClient);

  protected readonly kind = 'PHARMACY' as const;
  protected readonly rutaDelDirectorio = '/pharmacies-directory';
  protected readonly rotuloDelDirectorio = 'Directorio de farmacias';

  /** El umbral, para la plantilla. */
  protected readonly MINIMO_PARA_BUSCAR = MINIMO_PARA_BUSCAR;

  /** Lo tecleado en el buscador de medicamentos. */
  protected readonly termino = signal('');

  /**
   * Los grupos terapéuticos elegidos. Vacío es **todos**, no ninguno: un
   * filtro que empieza filtrando esconde catálogo sin que nadie lo haya pedido.
   */
  private readonly gruposElegidos = signal<ReadonlySet<string>>(new Set<string>());

  protected readonly soloConStock = signal(false);
  protected readonly soloSinReceta = signal(false);

  /**
   * Los pines del mapa: **una sucursal, un pin**, y la que se está mirando
   * distinguida por su tono.
   *
   * Mientras las sucursales viajan —o si su lectura falla— queda el pin de la
   * propia ficha: el mapa nunca se va en blanco por una lectura que es
   * adicional. Sin coordenadas no hay pin, y ahí no se dibuja nada.
   */
  protected readonly pines = computed<readonly PinMapa[]>(() => {
    const sucursales = this.sucursales();
    if (sucursales.length > 0) {
      return sucursales
        .filter((sucursal) => sucursal.location !== null)
        .map((sucursal) => ({
          id: sucursal.slug,
          lat: sucursal.location!.lat,
          lng: sucursal.location!.lng,
          titulo: sucursal.name,
          ...(sucursal.addressText === null ? {} : { subtitulo: sucursal.addressText }),
          estado: sucursal.isCurrent
            ? { etiqueta: 'Estás viendo ésta', tono: 'info' as const }
            : { etiqueta: 'Otra sucursal', tono: 'neutral' as const },
        }));
    }

    const perfil = this.ficha();
    if (perfil?.location == null) return [];
    return [
      {
        id: perfil.slug,
        lat: perfil.location.lat,
        lng: perfil.location.lng,
        titulo: perfil.displayName,
        ...(perfil.address === null ? {} : { subtitulo: perfil.address }),
      },
    ];
  });

  protected readonly etiquetaDelMapa = computed(() =>
    this.sucursales().length > 1
      ? `Las ${this.sucursales().length} sucursales de ${this.titulo()}, en el mapa. La lista con sus direcciones está debajo.`
      : `Dónde queda ${this.titulo()}, en el mapa. La dirección está arriba, en el resumen.`,
  );

  /**
   * Los grupos terapéuticos del catálogo de **esta** farmacia, para los chips.
   *
   * Salen del catálogo y no de una lista fija: un chip de un grupo que esta
   * góndola no tiene sólo sirve para dejar la rejilla vacía. «Sin grupo
   * declarado» va al final y sólo si hay alguno — es la misma regla que tenía
   * el tramo homónimo: no se esconde a nadie, pero tampoco encabeza.
   */
  protected readonly grupos = computed<readonly string[]>(() => {
    const declarados = new Set<string>();
    let haySinGrupo = false;

    for (const producto of this.items()) {
      if (producto.therapeuticGroup === null || producto.therapeuticGroup === '') {
        haySinGrupo = true;
        continue;
      }
      declarados.add(producto.therapeuticGroup);
    }

    const ordenados = [...declarados].sort((a, b) => a.localeCompare(b, 'es'));
    return haySinGrupo ? [...ordenados, SIN_GRUPO] : ordenados;
  });

  /**
   * Los medicamentos que quedan tras el buscador y los filtros.
   *
   * El texto busca sobre genérico, marca, presentación y grupo —no sólo sobre
   * el genérico— por lo mismo que en la ficha de un laboratorio: quien teclea
   * «Bagó» busca una marca y quien teclea «jarabe» una presentación, y un
   * buscador que no los encontrara parecería roto.
   *
   * Los tres filtros se **combinan** (y, no o): elegir «Analgésicos» y «Con
   * stock» es pedir los analgésicos que están. Entre grupos, en cambio, la
   * suma es o — dos chips de grupo muestran los dos, que es lo que hace un
   * filtro de facetas.
   */
  protected readonly visibles = computed<readonly PublicPharmacyProduct[]>(() => {
    const termino = normalizar(this.termino());
    const grupos = this.gruposElegidos();
    const conStock = this.soloConStock();
    const sinReceta = this.soloSinReceta();

    return this.items()
      .filter((producto) => {
        if (conStock && !producto.inStock) return false;
        if (sinReceta && producto.requiresPrescription) return false;
        if (grupos.size > 0 && !grupos.has(this.grupoDe(producto))) return false;
        if (termino === '') return true;
        return normalizar(
          [
            producto.genericName,
            producto.brandName ?? '',
            producto.presentation ?? '',
            producto.therapeuticGroup ?? '',
          ].join(' '),
        ).includes(termino);
      })
      .sort((a, b) => a.genericName.localeCompare(b.genericName, 'es'));
  });

  /** Si hay algo que limpiar. Sin esto, «Limpiar filtros» sería un botón muerto. */
  protected readonly hayFiltros = computed(
    () =>
      this.termino().trim() !== '' ||
      this.gruposElegidos().size > 0 ||
      this.soloConStock() ||
      this.soloSinReceta(),
  );

  /**
   * Qué decir cuando no queda ninguno.
   *
   * Con término, lo repite entre comillas: la diferencia entre «no hay» y «no
   * hay *de eso*» es la que evita que alguien concluya que la farmacia está
   * vacía cuando lo que pasa es que escribió mal el nombre.
   */
  protected readonly mensajeSinCoincidencias = computed(() => {
    const termino = this.termino().trim();
    return termino === ''
      ? 'Ningún medicamento coincide con los filtros elegidos.'
      : `Ningún medicamento coincide con «${termino}» y los filtros elegidos.`;
  });

  /** El grupo del medicamento, con el rótulo del que no declaró ninguno. */
  protected grupoDe(producto: PublicPharmacyProduct): string {
    return producto.therapeuticGroup === null || producto.therapeuticGroup === ''
      ? SIN_GRUPO
      : producto.therapeuticGroup;
  }

  protected grupoElegido(grupo: string): boolean {
    return this.gruposElegidos().has(grupo);
  }

  protected alternarGrupo(grupo: string): void {
    this.gruposElegidos.update((elegidos) => {
      const siguiente = new Set(elegidos);
      if (!siguiente.delete(grupo)) siguiente.add(grupo);
      return siguiente;
    });
  }

  protected limpiarFiltros(): void {
    this.termino.set('');
    this.gruposElegidos.set(new Set<string>());
    this.soloConStock.set(false);
    this.soloSinReceta.set(false);
  }

  /* ==========================================================================
      Las sucursales, la ubicación y la receta (P37).

      Pedido del propietario del 19/09/2026: «debe mostrar todas sus sucursales
      y pedirle ubicación para la más cercana recomendar dada una receta
      médica». Las tres cosas son una sola pregunta —«¿a cuál voy con esto?»— y
      por eso viven en una sección y no en tres.
      ========================================================================== */

  private readonly destruccion = inject(DestroyRef);
  private readonly documento = inject(DOCUMENT);

  /**
   * Las sucursales de la cadena. Estado propio, como el catálogo y por el
   * mismo motivo: que su lectura falle no puede llevarse puesta la ficha.
   */
  protected readonly estadoDeSucursales = signal<ViewState<readonly PublicPharmacyBranch[]>>(
    loading(),
  );

  protected readonly sucursales = computed<readonly PublicPharmacyBranch[]>(
    () => dataOf(this.estadoDeSucursales()) ?? [],
  );

  /**
   * Las sucursales en el orden en que conviene mirarlas.
   *
   * Sin ubicación manda el orden del servidor: la que se está mirando primero
   * y el resto por ciudad. Con ubicación manda **la cercanía**, que es la
   * pregunta que se acaba de contestar — una cadena con treinta y cinco
   * sucursales ordenada alfabéticamente después de entregar dónde estás sería
   * ignorar el dato que te acaban de dar. Las que no tienen punto van al
   * final: no se las puede medir, pero existen.
   */
  protected readonly sucursalesOrdenadas = computed<readonly PublicPharmacyBranch[]>(() => {
    const origen = this.ubicacion();
    const lista = this.sucursales();
    if (origen === null) return lista;
    return [...lista].sort((a, b) => this.kmDesde(origen, a) - this.kmDesde(origen, b));
  });

  /**
   * El slug de la más cercana, o `null` si nadie entregó su ubicación.
   *
   * `null` **no es** «ninguna está cerca»: es que no hay con qué medir, y
   * ponerle el distintivo a la primera de la lista sería afirmarlo sin saberlo.
   */
  protected readonly slugMasCercano = computed<string | null>(() => {
    if (this.ubicacion() === null) return null;
    const primera = this.sucursalesOrdenadas().find((sucursal) => sucursal.location !== null);
    return primera?.slug ?? null;
  });

  /** Dónde está quien mira, si lo entregó. `null` es lo normal, no un error. */
  protected readonly ubicacion = signal<PublicGeoPoint | null>(null);
  protected readonly pidiendoUbicacion = signal(false);

  /**
   * Si el navegador no la dio: porque no la tiene, porque dijeron que no, o
   * porque nadie contestó el cartel. Los tres se dicen igual —la sección sigue
   * sirviendo sin ubicación— y ninguno bloquea la búsqueda.
   */
  protected readonly ubicacionRechazada = signal(false);

  /** Los renglones de la receta, tal como se escriben: uno por línea. */
  protected readonly receta = signal('');

  /**
   * Los renglones ya separados, sin repetidos ni vacíos.
   *
   * Corta por salto de línea **y por coma**: una receta se copia de las dos
   * formas y obligar a una de ellas sería una regla que nadie leyó.
   */
  protected readonly renglonesDeLaReceta = computed<readonly string[]>(() => {
    const vistos = new Set<string>();
    const renglones: string[] = [];
    for (const parte of this.receta().split(/[\n,;]+/u)) {
      const limpio = parte.trim();
      if (limpio === '' || vistos.has(normalizar(limpio))) continue;
      vistos.add(normalizar(limpio));
      renglones.push(limpio);
    }
    return renglones;
  });

  /**
   * El resultado de la última búsqueda, o `null` si todavía no se buscó.
   *
   * `null` **no es** «no hay resultados»: son dos pantallas distintas —una
   * invita a escribir la receta y la otra dice que ninguna sucursal la tiene— y
   * colapsarlas mostraría un «sin resultados» a quien no buscó nada.
   */
  protected readonly resultados = signal<readonly PublicBranchAvailability[] | null>(null);
  protected readonly buscando = signal(false);
  protected readonly falloLaBusqueda = signal(false);

  /** Las que se dibujan: las ocho primeras del orden que trajo el servidor. */
  protected readonly resultadosVisibles = computed<readonly PublicBranchAvailability[]>(() =>
    (this.resultados() ?? []).slice(0, TOPE_DE_RESULTADOS),
  );

  /**
   * La sucursal recomendada: la primera del resultado.
   *
   * El orden lo decide el servidor —primero las que tienen todo, y entre ésas
   * la más cercana— y acá no se reordena: recomendar una y listar otras en otro
   * orden es contradecirse en la misma pantalla. Sólo se recomienda la que
   * tiene **algo**; una que no tiene nada no es una recomendación.
   */
  protected readonly recomendada = computed<PublicBranchAvailability | null>(() => {
    const primera = this.resultados()?.[0];
    return primera === undefined || primera.matches.length === 0 ? null : primera;
  });

  /**
   * Por qué se la recomienda, en palabras.
   *
   * La frase cambia con lo que de verdad se sabe: sin ubicación no se puede
   * decir «la más cercana», y decirlo igual sería inventar.
   */
  protected readonly motivoDeLaRecomendacion = computed(() => {
    const elegida = this.recomendada();
    if (elegida === null) return '';
    const completa = elegida.complete ? 'tiene todo lo de tu receta' : 'es la que más tiene';
    if (elegida.distanceKm === null) {
      return `${completa}. Compartí tu ubicación para saber cuál te queda más cerca.`;
    }
    return `${completa} y es la más cercana: ${this.distancia(elegida.distanceKm)} en línea recta.`;
  });

  protected cargarSucursales(): void {
    const slug = this.slug;
    if (slug === null || slug === '') return;

    this.estadoDeSucursales.set(loading());
    this.catalogo
      .pharmacyBranches(slug)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (pagina) => this.estadoDeSucursales.set(ready(pagina.items)),
        error: (error: unknown) =>
          this.estadoDeSucursales.set(errorToViewState<readonly PublicPharmacyBranch[]>(error)),
      });
  }

  /**
   * Pide la ubicación al navegador y, si ya había una búsqueda, la repite con
   * ella.
   *
   * Nunca bloquea nada: sin ubicación la búsqueda anda igual, sólo que sin
   * distancias. Es la misma cortesía que el alta de paciente — la ubicación es
   * una comodidad, no un requisito.
   */
  protected usarMiUbicacion(): void {
    const geo = this.documento.defaultView?.navigator?.geolocation;
    if (geo === undefined) {
      this.ubicacionRechazada.set(true);
      return;
    }

    this.pidiendoUbicacion.set(true);
    geo.getCurrentPosition(
      (posicion) => {
        this.ubicacion.set({ lat: posicion.coords.latitude, lng: posicion.coords.longitude });
        this.ubicacionRechazada.set(false);
        this.pidiendoUbicacion.set(false);
        if (this.resultados() !== null) this.buscarLaReceta();
      },
      () => {
        this.ubicacionRechazada.set(true);
        this.pidiendoUbicacion.set(false);
      },
      { enableHighAccuracy: false, timeout: ESPERA_DE_UBICACION_MS, maximumAge: EDAD_DE_UBICACION_MS },
    );
  }

  protected buscarLaReceta(): void {
    const slug = this.slug;
    const renglones = this.renglonesDeLaReceta();
    if (slug === null || slug === '' || renglones.length === 0) return;

    this.buscando.set(true);
    this.falloLaBusqueda.set(false);
    this.catalogo
      .prescriptionAvailability(slug, renglones, this.ubicacion())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (items) => {
          this.resultados.set(items);
          this.buscando.set(false);
        },
        error: () => {
          this.falloLaBusqueda.set(true);
          this.buscando.set(false);
        },
      });
  }

  protected limpiarLaReceta(): void {
    this.receta.set('');
    this.resultados.set(null);
    this.falloLaBusqueda.set(false);
  }

  /** «1,2 km» con la coma de es-BO. Siempre con una decimal, como el contrato. */
  protected distancia(km: number): string {
    return `${km.toFixed(1).replace('.', ',')} km`;
  }

  /** La dirección de una sucursal en un renglón: la calle y la ciudad. */
  protected dondeQueda(sucursal: PublicPharmacyBranch): string {
    return [sucursal.addressText, sucursal.city]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(' · ');
  }

  /**
   * El aviso de que el punto de esa sucursal es aproximado, o `null`.
   *
   * Sólo cuando lo es: rotular también la ubicación exacta pondría un renglón
   * gris en las treinta y cinco tarjetas y ninguno diría nada.
   */
  protected puntoAproximado(sucursal: PublicPharmacyBranch): string | null {
    const precision = sucursal.locationAccuracy;
    if (precision === null || !precision.toLowerCase().includes('aproximada')) return null;
    return precision;
  }

  /** La ruta de la ficha de otra sucursal, dentro del panel. */
  protected fichaDe(sucursal: PublicPharmacyBranch): string {
    return `${this.rutaDelDirectorio}/${sucursal.slug}`;
  }

  /** La distancia de una sucursal, cuando hay ubicación con la que medirla. */
  protected distanciaDe(sucursal: PublicPharmacyBranch): string | null {
    const origen = this.ubicacion();
    if (origen === null || sucursal.location === null) return null;
    return this.distancia(this.kmDesde(origen, sucursal));
  }

  /** Kilómetros en línea recta; `Infinity` para la sucursal sin punto. */
  private kmDesde(origen: PublicGeoPoint, sucursal: PublicPharmacyBranch): number {
    if (sucursal.location === null) return Infinity;
    return distanciaEnLineaRectaKm(origen, {
      lat: sucursal.location.lat,
      lng: sucursal.location.lng,
    });
  }

  protected override cargar(): void {
    super.cargar();
    this.cargarSucursales();
  }

  /**
   * El segundo renglón de la tarjeta: la marca y la presentación.
   *
   * Devuelve `''` cuando no hay ninguna de las dos —y no «Sin presentación»—:
   * una línea que dice que falta un dato ocupa el mismo lugar que la que lo
   * trae, y en una rejilla de veinte tarjetas eso es veinte veces el mismo
   * aviso inútil.
   */
  protected marcaYPresentacion(producto: PublicPharmacyProduct): string {
    return [producto.brandName, producto.presentation]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(' · ');
  }

  protected leerCatalogo(slug: string): Observable<PublicPage<PublicPharmacyProduct>> {
    return this.catalogo.pharmacyProducts(slug);
  }
}
