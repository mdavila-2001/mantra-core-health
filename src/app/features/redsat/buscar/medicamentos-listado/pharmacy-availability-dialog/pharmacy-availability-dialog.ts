import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import type { OfertaDeFarmacia } from '@core/data-access/public-marketplace/public-marketplace.types';
import { Badge } from '@shared/components/atoms/badge/badge';
import { AppMap } from '@shared/components/organisms/map/map';
import type { PinMapa, PuntoGeo } from '@shared/components/organisms/map/pin-mapa.types';
import { ContentDialog } from '@shared/components/organisms/content-dialog/content-dialog';

import { formatDistance, formatMoney } from '../medication-card.mapper';

/** Las letras con que el mapa y la lista se refieren a la misma farmacia. */
const CODES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Una oferta con la letra que comparte con su pin en el mapa. */
export interface OfertaVisible extends OfertaDeFarmacia {
  readonly codigo: string;
}

/**
 * `true` si la farmacia se puede poner en el mapa.
 *
 * El contrato declara `latitude`/`longitude` como `number`, pero una sucursal
 * cargada sin geocodificar llega con el par en cero o sin número. Comprobarlo
 * acá es lo que permite **listarla igual con un aviso** en vez de omitirla en
 * silencio (AC-06-12): una farmacia que tiene el remedio y no aparece porque
 * nadie le cargó las coordenadas es un viaje que alguien no hizo.
 */
export function hasCoordinates(offer: OfertaDeFarmacia): boolean {
  if (!Number.isFinite(offer.latitude) || !Number.isFinite(offer.longitude)) {
    return false;
  }
  return offer.latitude !== 0 || offer.longitude !== 0;
}

/** El renglón secundario del pin: distancia rotulada y dirección, lo que haya. */
export function pinSubtitle(offer: OfertaDeFarmacia): string | undefined {
  const distance = formatDistance(offer.distanceKm);
  const parts = [
    distance === null ? null : `${distance} en línea recta`,
    offer.addressText,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** Le pone a cada oferta la letra con la que el mapa la nombra. */
export function withCodes(offers: readonly OfertaDeFarmacia[]): readonly OfertaVisible[] {
  return offers.map((offer, index) => ({
    ...offer,
    codigo: CODES[index] ?? String(index + 1),
  }));
}

/**
 * **Dónde conseguir un medicamento** — lista de farmacias y mapa, en un modal.
 *
 * ## Por qué modal y no el expansor que había
 *
 * Porque el expansor en línea era un bloque más dentro de la tarjeta: abría un
 * mapa de 16 rem adentro de una celda de grilla y empujaba media pantalla de
 * tarjetas hacia abajo. El pedido es explícito —«un botón que abre un modal
 * con la lista de farmacias más un mapa»— y además resuelve el problema: el
 * modal tiene el ancho que la lista necesita, y la grilla de atrás no se
 * mueve.
 *
 * ## Lista, no grilla, y es una decisión de accesibilidad
 *
 * La lista **es la alternativa textual del mapa**: dirección, precio,
 * disponibilidad y distancia de cada farmacia, en el orden en que el servidor
 * las devolvió. Un mapa sin esa lista es una imagen sin `alt` de la que
 * depende una decisión de compra.
 *
 * ## La sincronía lista ↔ mapa es la que ya funcionaba
 *
 * `selectedPharmacy` es el mismo `farmaciaElegida` del expansor, mudado acá:
 * el `model` de `AppMap` lo comparte en dos direcciones, resaltar una fila
 * resalta su pin, y el CTA del popup del pin lleva la vista a su fila
 * (AC-06-10). No se reescribió: se movió.
 *
 * ## El mapa se monta después de abrir
 *
 * Leaflet mide el contenedor al montarse. Dentro de un `<dialog>` todavía
 * cerrado mide 0×0 y se dibuja gris, así que el `<app-map>` está detrás de
 * `mapReady`, que `content-dialog` enciende recién después de `showModal()`
 * (AC-06-11).
 */
@Component({
  selector: 'app-pharmacy-availability-dialog',
  imports: [AppMap, Badge, ContentDialog],
  templateUrl: './pharmacy-availability-dialog.html',
  styleUrl: './pharmacy-availability-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyAvailabilityDialog {
  /** El principio activo que se está consultando. Encabeza el modal. */
  readonly medicationName = input.required<string>();

  /** Las ofertas tal como las devolvió la API, en su orden. */
  readonly offers = input.required<readonly OfertaDeFarmacia[]>();

  readonly loading = input(false);
  readonly failed = input(false);

  /** Dónde encuadra el mapa, cuando hay un origen elegido. */
  readonly mapCenter = input<PuntoGeo | null>(null);
  readonly mapZoom = input<number | null>(null);

  /** Cómo se llama el punto desde el que se mide. `null` = sin origen. */
  readonly originLabel = input<string | null>(null);

  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);

  protected readonly mapReady = signal(false);

  /** La farmacia resaltada, compartida entre el mapa y la lista. */
  protected readonly selectedPharmacy = signal<string | null>(null);

  protected readonly visibleOffers = computed(() => withCodes(this.offers()));

  /** Las que el mapa puede ubicar. Las otras siguen en la lista, con aviso. */
  protected readonly mappableOffers = computed(() =>
    this.visibleOffers().filter(hasCoordinates),
  );

  protected readonly pins = computed<readonly PinMapa[]>(() =>
    this.mappableOffers().map((offer) => {
      const subtitle = pinSubtitle(offer);
      return {
        // La letra y no el slug: nada del mapa debe poder filtrar identificadores.
        id: offer.codigo,
        codigo: offer.codigo,
        lat: offer.latitude,
        lng: offer.longitude,
        titulo: offer.pharmacyName,
        ...(subtitle === undefined ? {} : { subtitulo: subtitle }),
        estado: offer.inStock
          ? { etiqueta: 'Disponible hoy', tono: 'success' as const }
          : { etiqueta: 'Sin stock hoy', tono: 'warning' as const },
        ctaEtiqueta: 'Ver en la lista',
      };
    }),
  );

  protected readonly mapLabel = computed(() => {
    const count = this.pins().length;
    const marked = count === 1 ? '1 farmacia marcada' : `${count} farmacias marcadas`;
    const label = this.originLabel();
    const framing =
      label === null ? '' : ` El mapa abre centrado en ${label}; alejá para ver el resto.`;
    return `${marked} en el mapa.${framing} La lista completa, con dirección, precio y distancia en línea recta, está debajo.`;
  });

  /** Cuántas quedaron fuera del mapa por no tener coordenadas. */
  protected readonly unmappedCount = computed(
    () => this.visibleOffers().length - this.mappableOffers().length,
  );

  protected handleOpened(): void {
    this.mapReady.set(true);
  }

  protected handleClosed(): void {
    this.closed.emit();
  }

  protected isLocatable(offer: OfertaVisible): boolean {
    return hasCoordinates(offer);
  }

  protected priceOf(offer: OfertaDeFarmacia): string {
    return formatMoney(offer.price, offer.currency);
  }

  protected distanceOf(offer: OfertaDeFarmacia): string | null {
    return formatDistance(offer.distanceKm);
  }

  /** Lleva la vista a la fila de la farmacia cuyo pin se tocó (AC-06-10). */
  protected focusPharmacy(code: string): void {
    this.selectedPharmacy.set(code);
    const row = this.document.getElementById(`pharmacy-offer-${code}`);
    if (row === null) {
      return;
    }
    const reduceMotion =
      this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    row.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }
}
