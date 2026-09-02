/* V65-03·L · Medicamentos y farmacias — la vitrina pública.
   La maqueta original salía de scripts/port-vistas-redsat.mjs; esta pantalla
   ya no la sigue: se reescribió contra `GET /public/medications`. */

import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { PublicMarketplaceClient } from '@core/data-access/public-marketplace/public-marketplace.client';
import type {
  DisponibilidadDeMedicamento,
  PaginaDeVitrina,
  PuntoDeOrigen,
  TarjetaDeMedicamento,
} from '@core/data-access/public-marketplace/public-marketplace.types';

import { AppButton } from '@shared/components/atoms/button/button';
import { Chip } from '@shared/components/atoms/chip/chip';
import { CardDetailPanel } from '@shared/components/molecules/card-detail-panel/card-detail-panel';
import { SearchField } from '@shared/components/molecules/search-field/search-field';

import { CentroCard } from '../centro-card/centro-card';
import { toMedicationCard, type MedicationCard } from './medication-card.mapper';
import { PharmacyAvailabilityDialog } from './pharmacy-availability-dialog/pharmacy-availability-dialog';

/** Tope de tarjetas de la vitrina. El backend no deja pasar de 60. */
const TOPE = 36;

/**
 * Radio por defecto cuando hay origen.
 *
 * 25 km cubre cualquiera de las tres ciudades entera y deja afuera las otras
 * dos: sin él, «cerca tuyo» listaría una farmacia a 544 km, que es exactamente
 * lo que la pantalla promete no hacer.
 */
const RADIO_KM = 25;

/**
 * Puntos públicos desde donde medir sin entregar la ubicación: las plazas
 * centrales de las ciudades donde la red opera. Son datos del mapa, no de la
 * persona — el mismo criterio que «Dónde comprar mi receta».
 */
const CIUDADES: readonly PuntoDeReferencia[] = [
  { etiqueta: 'Santa Cruz', lat: -17.7833, lng: -63.1821 },
  { etiqueta: 'La Paz', lat: -16.4957, lng: -68.1335 },
  { etiqueta: 'Cochabamba', lat: -17.3895, lng: -66.1568 },
];

/** Un lugar con nombre desde donde medir distancias. */
export interface PuntoDeReferencia {
  readonly etiqueta: string;
  readonly lat: number;
  readonly lng: number;
}

/** En qué estado está la vitrina. */
type Estado = 'carga' | 'datos' | 'vacio' | 'error';

/**
 * **Medicamentos** — la vitrina pública de exhibición y consulta.
 *
 * ## Qué es y qué no es
 *
 * Es un escaparate: qué medicamentos se consiguen, a qué precio y en qué
 * farmacia cerca. **No es una tienda.** No hay carrito, ni reserva, ni pedido,
 * y la API que la alimenta no devuelve ningún identificador con el que se
 * pudiera armar uno. AloVida no vende medicamentos ni cobra comisión sobre
 * estos precios, y la pantalla lo dice donde se ve, no en letra chica.
 *
 * ## La misma tarjeta que los otros tres verticales (AC-06-2, AC-06-3)
 *
 * Antes tenía una tarjeta propia (`vitrina-tarjeta`) sin imagen, así que la
 * misma búsqueda cambiaba de anatomía según la pestaña. Ahora usa `CentroCard`
 * —portada, logo, nombre, atributos, pie— con los datos de este vertical:
 * precio desde, en cuántas farmacias se consigue y si requiere receta. La
 * portada degrada al degradado del tema con las iniciales del principio
 * activo: `TarjetaDeMedicamento` no trae imagen y una foto de archivo de la
 * caja no es la caja de este medicamento (P-06-3, regla 00.8).
 *
 * ## Las farmacias van a un modal, no a un expansor (AC-06-9)
 *
 * El expansor en línea abría un mapa dentro de la celda de la grilla y
 * empujaba media pantalla de tarjetas. Ahora «Ver farmacias donde está
 * disponible» abre `PharmacyAvailabilityDialog`, con la misma lista y el mismo
 * mapa y la misma sincronía entre los dos.
 *
 * ## Por qué ya no usa el buscador público
 *
 * Antes pegaba a `GET /public/search/medications`, que devuelve vacío **por
 * construcción**: su índice son `community.public_profiles` y un medicamento
 * no es un perfil. El catálogo vive en el módulo de farmacia, así que esta
 * pantalla habla con su cara pública, `GET /public/medications`.
 *
 * ## La ubicación se pide, no se toma
 *
 * La vitrina carga **sin coordenadas** y funciona igual: las tarjetas salen
 * ordenadas por en cuántas farmacias se consigue. La API de geolocalización
 * del navegador no se toca hasta que alguien aprieta el botón; la alternativa
 * sin entregar nada es medir desde una ciudad. Con origen, el orden pasa a ser
 * por cercanía y aparece el radio de {@link RADIO_KM}.
 *
 * ## Las distancias son en línea recta y se rotulan así
 *
 * La ruta real depende de un servicio de mapas que no existe en este sistema.
 * Prometer «a 10 minutos» sería inventar; cada número dice «en línea recta».
 */
@Component({
  selector: 'app-redsat-buscar-medicamentos-listado',
  imports: [
    AppButton,
    CardDetailPanel,
    CentroCard,
    Chip,
    PharmacyAvailabilityDialog,
    SearchField,
  ],
  templateUrl: './medicamentos-listado.html',
  styleUrls: ['./medicamentos-listado.css', '../centro-card/centro-grid.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarMedicamentosListado {
  private readonly vitrina = inject(PublicMarketplaceClient);
  private readonly documento = inject(DOCUMENT);

  protected readonly ciudades = CIUDADES;
  protected readonly radioKm = RADIO_KM;

  /** Cuántos esqueletos dibujar mientras carga. */
  protected readonly huecos = [0, 1, 2, 3, 4, 5];

  /* ---- la vitrina --------------------------------------------------------- */

  protected readonly estado = signal<Estado>('carga');
  protected readonly pagina = signal<PaginaDeVitrina | null>(null);

  protected readonly texto = signal('');
  protected readonly grupo = signal<string | null>(null);

  protected readonly tarjetas = computed<readonly MedicationCard[]>(() =>
    (this.pagina()?.items ?? []).map(toMedicationCard),
  );
  protected readonly grupos = computed(() => this.pagina()?.groups ?? []);
  protected readonly total = computed(() => this.pagina()?.total ?? 0);

  /* ---- el origen: se pide, no se toma ------------------------------------- */

  protected readonly origen = signal<PuntoDeReferencia | null>(null);
  protected readonly pidiendoUbicacion = signal(false);
  protected readonly ubicacionDenegada = signal(false);

  /* ---- el detalle de disponibilidad --------------------------------------- */

  /** El medicamento cuyo modal de farmacias está abierto; `null` si ninguno. */
  protected readonly abierto = signal<TarjetaDeMedicamento | null>(null);
  protected readonly cargandoDetalle = signal(false);
  protected readonly detalle = signal<DisponibilidadDeMedicamento | null>(null);
  protected readonly errorDetalle = signal(false);

  /** Las ofertas del medicamento abierto, tal como las devolvió la API. */
  protected readonly ofertas = computed(() => this.detalle()?.offers ?? []);

  /**
   * Dónde se centra el mapa del modal: en el punto elegido, cuando lo hay.
   *
   * Sin esto el mapa encuadra **todos** los pines, y el detalle lista a
   * propósito las farmacias de todo el país —quien abre la ficha quiere saber
   * dónde se consigue, aunque sea lejos—. El resultado era un mapa de Bolivia
   * entera para contestar «¿dónde lo compro cerca?». Con centro impuesto, la
   * vista abre en la zona elegida y las lejanas siguen ahí, a un zoom de
   * distancia, además de estar todas en la lista.
   */
  protected readonly centroDelMapa = computed<PuntoDeOrigen | null>(() => {
    const punto = this.origen();
    return punto === null ? null : { lat: punto.lat, lng: punto.lng };
  });

  /** Escala de ciudad: se ven los barrios y la farmacia de al lado. */
  protected readonly zoomDelMapa = computed(() => (this.origen() === null ? null : 12));

  protected readonly etiquetaDelOrigen = computed(() => this.origen()?.etiqueta ?? null);

  constructor() {
    this.consultar();
  }

  /* ---- la consulta -------------------------------------------------------- */

  protected consultar(): void {
    this.estado.set('carga');
    const punto = this.origen();
    this.vitrina
      .listMedications({
        q: this.texto(),
        group: this.grupo() ?? undefined,
        origin: punto === null ? undefined : puntoGeoDe(punto),
        radiusKm: punto === null ? undefined : RADIO_KM,
        limit: TOPE,
      })
      .subscribe({
        next: (pagina) => {
          this.pagina.set(pagina);
          this.estado.set(pagina.items.length === 0 ? 'vacio' : 'datos');
          // Un filtro que deja la vitrina vacía también deja sin sentido el
          // modal abierto: se cierra en vez de quedar colgando de una tarjeta
          // que ya no está en pantalla.
          if (pagina.items.length === 0) this.cerrarDetalle();
        },
        error: () => {
          this.pagina.set(null);
          this.estado.set('error');
        },
      });
  }

  protected buscar(valor: string): void {
    this.texto.set(valor);
    this.consultar();
  }

  /** Alterna el grupo terapéutico: volver a tocarlo lo quita. */
  protected alternarGrupo(nombre: string): void {
    this.grupo.set(this.grupo() === nombre ? null : nombre);
    this.consultar();
  }

  protected limpiarFiltros(): void {
    this.texto.set('');
    this.grupo.set(null);
    this.consultar();
  }

  protected get hayFiltros(): boolean {
    return this.texto() !== '' || this.grupo() !== null;
  }

  /* ---- el detalle --------------------------------------------------------- */

  /** Abre el modal de farmacias de una tarjeta y pide su disponibilidad. */
  protected abrirDetalle(tarjeta: TarjetaDeMedicamento): void {
    this.abierto.set(tarjeta);
    this.detalle.set(null);
    this.errorDetalle.set(false);
    this.cargandoDetalle.set(true);

    const punto = this.origen();
    this.vitrina
      .getAvailability(tarjeta.conceptId, {
        origin: punto === null ? undefined : puntoGeoDe(punto),
        // El radio NO viaja acá a propósito: quien abrió la ficha quiere saber
        // dónde se consigue, aunque sea lejos. La vitrina acota; el detalle
        // informa, y ordena por cercanía.
      })
      .subscribe({
        next: (disponibilidad) => {
          this.detalle.set(disponibilidad);
          this.cargandoDetalle.set(false);
        },
        error: () => {
          this.errorDetalle.set(true);
          this.cargandoDetalle.set(false);
        },
      });
  }

  protected cerrarDetalle(): void {
    this.abierto.set(null);
    this.detalle.set(null);
    this.errorDetalle.set(false);
    this.cargandoDetalle.set(false);
  }

  /* ---- la ubicación ------------------------------------------------------- */

  /** Pide la ubicación al navegador. Sólo se llama desde el botón. */
  protected compartirUbicacion(): void {
    const geo = this.documento.defaultView?.navigator?.geolocation;
    if (!geo) {
      // Sin API de geolocalización —navegador viejo, o el render del
      // servidor— no hay nada que pedir: quedan las ciudades.
      this.ubicacionDenegada.set(true);
      return;
    }

    this.pidiendoUbicacion.set(true);
    geo.getCurrentPosition(
      (posicion) => {
        this.pidiendoUbicacion.set(false);
        this.ubicacionDenegada.set(false);
        this.medirDesde({
          etiqueta: 'tu ubicación',
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        });
      },
      // Denegado, no disponible o vencido llevan al mismo lugar: las
      // alternativas escritas. Distinguirlos no le cambia nada a quien mira.
      () => {
        this.pidiendoUbicacion.set(false);
        this.ubicacionDenegada.set(true);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  protected medirDesde(punto: PuntoDeReferencia): void {
    this.origen.set(punto);
    this.consultar();
    // El modal abierto se rearma con el nuevo origen: si no, seguiría
    // mostrando las distancias medidas desde el punto anterior.
    this.rearmarDetalle();
  }

  protected quitarOrigen(): void {
    this.origen.set(null);
    this.consultar();
    this.rearmarDetalle();
  }

  private rearmarDetalle(): void {
    const abierto = this.abierto();
    if (abierto !== null) {
      this.abrirDetalle(abierto);
    }
  }
}

/* ---- funciones puras ------------------------------------------------------ */

/** El punto, en el contrato que viaja a la API. */
function puntoGeoDe(punto: PuntoDeReferencia): PuntoDeOrigen {
  return { lat: punto.lat, lng: punto.lng };
}
