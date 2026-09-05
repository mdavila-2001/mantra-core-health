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

import { AppButton } from '@shared/components/atoms/button/button';
import { AppMap } from '@shared/components/organisms/map/map';
import type { PinMapa, PuntoGeo } from '@shared/components/organisms/map/pin-mapa.types';
import { ContentDialog } from '@shared/components/organisms/content-dialog/content-dialog';

/** Radio de la Tierra en kilómetros, el valor medio de la esfera. */
const EARTH_RADIUS_KM = 6371;

/** La letra del pin del establecimiento; la del origen es la siguiente. */
const FACILITY_PIN = 'A';
const ORIGIN_PIN = 'B';

/** Escala de barrio: se ven las calles de alrededor del establecimiento. */
const NEIGHBOURHOOD_ZOOM = 15;

/** Desde dónde se mide, y cómo se lo nombra en pantalla. */
export interface OriginPoint extends PuntoGeo {
  /** Prosa en castellano: «tu ubicación», «el punto que marcaste». */
  readonly label: string;
}

/**
 * Distancia **en línea recta** entre dos puntos, en kilómetros.
 *
 * Haversine sobre una esfera: es la misma cuenta que hace `GET /public/nearby`
 * del lado del servidor, y por eso da el mismo número. **No es distancia de
 * recorrido** — no existe ningún servicio de ruteo en este sistema— y el
 * rótulo en pantalla tiene que decir lo mismo que el cálculo.
 */
export function straightLineKm(from: PuntoGeo, to: PuntoGeo): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** «1,2 km», con coma decimal. */
export function formatKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/**
 * **Cómo llegar** a un establecimiento concreto (AC-06-13 a AC-06-16).
 *
 * ## Por qué no es `/search/map`
 *
 * Porque aquella pantalla es «Cerca mío»: abre el mapa genérico **sin el
 * establecimiento elegido**. Quien tocó «Cómo llegar» en la tarjeta del
 * Hospital Japonés no está preguntando qué hay cerca suyo: está preguntando
 * dónde queda ese hospital. Este diálogo abre centrado en él.
 *
 * ## El origen se indica de dos maneras, y ninguna es obligatoria
 *
 * Con la ubicación del navegador, o **marcando un punto en el mapa**. Denegar
 * el permiso no rompe nada (AC-06-16): el establecimiento se sigue viendo y el
 * origen se puede marcar a mano. Sin origen, el diálogo igual sirve —muestra
 * dónde queda—, que es la mitad de la pregunta.
 *
 * ## Lo que NO promete: un trayecto
 *
 * No hay cálculo de recorrido en este sistema. Ni la API —`GET /public/nearby`
 * declara su distancia «en línea recta»— ni Leaflet lo traen, y traer un
 * proveedor externo significa abrir `connect-src` en
 * `src/server/security-headers.ts`, que tiene un `.spec.ts` que fija la
 * política. Así que la distancia que se muestra dice **«en línea recta»** en
 * el mismo renglón, y el diálogo aclara que no es tiempo de viaje. Presentar
 * una distancia recta como si fuera de trayecto es lo que AC-06-15 prohíbe.
 *
 * ## Mapa: Leaflet + OpenStreetMap, no Google
 *
 * El pedido decía «soportado por Google Maps». Google Maps JS API exige sumar
 * `https://maps.googleapis.com` a `script-src` y `connect-src` y sus hosts de
 * tiles a `img-src`, más una clave con facturación, más migrar las cinco
 * pantallas que ya usan `AppMap`. Eso es una decisión de arquitectura y de
 * costo (P-06-1), no de este carril, y una CSP mal armada **rompe la
 * aplicación entera en silencio**. Se sigue con Leaflet + OSM, que es lo que
 * el producto ya eligió y lo que la CSP ya permite.
 */
@Component({
  selector: 'app-facility-directions-dialog',
  imports: [AppButton, AppMap, ContentDialog],
  templateUrl: './facility-directions-dialog.html',
  styleUrl: './facility-directions-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FacilityDirectionsDialog {
  /** Cómo se llama el establecimiento. */
  readonly facilityName = input.required<string>();

  /** Dónde queda. Sin esto la pantalla que lo usa no dibuja el botón. */
  readonly facilityLocation = input.required<PuntoGeo>();

  /** La calle, si la ficha la publicó. */
  readonly facilityAddress = input<string | null>(null);

  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);

  /**
   * El mapa se instancia recién cuando el diálogo ya está abierto.
   *
   * Leaflet mide el contenedor al montarse: creado dentro de un `<dialog>`
   * todavía cerrado, mide 0×0 y se dibuja gris (AC-06-11).
   */
  protected readonly mapReady = signal(false);

  protected readonly origin = signal<OriginPoint | null>(null);
  protected readonly locating = signal(false);
  protected readonly locationDenied = signal(false);

  /** Mientras está en `true`, el próximo clic en el mapa fija el origen. */
  protected readonly pickingOnMap = signal(false);

  protected readonly selectedPin = signal<string | null>(null);

  protected readonly facilityPinCode = FACILITY_PIN;
  protected readonly originPinCode = ORIGIN_PIN;

  protected readonly pins = computed<readonly PinMapa[]>(() => {
    const address = this.facilityAddress();
    const marks: PinMapa[] = [
      {
        id: FACILITY_PIN,
        codigo: FACILITY_PIN,
        lat: this.facilityLocation().lat,
        lng: this.facilityLocation().lng,
        titulo: this.facilityName(),
        ...(address === null ? {} : { subtitulo: address }),
        estado: { etiqueta: 'El establecimiento', tono: 'info' as const },
      },
    ];
    const from = this.origin();
    if (from !== null) {
      marks.push({
        id: ORIGIN_PIN,
        codigo: ORIGIN_PIN,
        lat: from.lat,
        lng: from.lng,
        titulo: 'Tu punto de partida',
        subtitulo: from.label,
        estado: { etiqueta: 'Desde acá', tono: 'success' as const },
      });
    }
    return marks;
  });

  /**
   * Dónde encuadra el mapa.
   *
   * Sin origen, **centrado en el establecimiento**: es lo que se vino a ver.
   * Con origen, se devuelve `null` para que el organismo encuadre los dos
   * pines; imponer el centro dejaría el punto de partida fuera de la vista,
   * que es justo lo que se acaba de marcar.
   */
  protected readonly mapCenter = computed<PuntoGeo | null>(() =>
    this.origin() === null ? this.facilityLocation() : null,
  );

  protected readonly mapZoom = computed(() =>
    this.origin() === null ? NEIGHBOURHOOD_ZOOM : null,
  );

  /** La distancia recta hasta el establecimiento, o `null` sin origen. */
  protected readonly distanceKm = computed<number | null>(() => {
    const from = this.origin();
    return from === null ? null : straightLineKm(from, this.facilityLocation());
  });

  /**
   * El rótulo de la distancia. **Siempre dice qué distancia es** (AC-06-15).
   */
  protected readonly distanceText = computed<string | null>(() => {
    const km = this.distanceKm();
    return km === null ? null : `${formatKm(km)} en línea recta`;
  });

  protected readonly mapLabel = computed(() => {
    const from = this.origin();
    const base = `Mapa con la ubicación de ${this.facilityName()}.`;
    if (from === null) {
      return `${base} Podés marcar desde dónde salís tocando un punto del mapa; la dirección y la distancia también están escritas debajo.`;
    }
    return `${base} También está marcado tu punto de partida (${from.label}). La distancia en línea recta está escrita debajo.`;
  });

  /** Lo llama `content-dialog` después de `showModal()`. */
  protected handleOpened(): void {
    this.mapReady.set(true);
  }

  protected handleClosed(): void {
    this.closed.emit();
  }

  /**
   * Pide la ubicación al navegador. Sólo se llama desde el botón: la API de
   * geolocalización no se toca hasta que alguien la pide.
   */
  protected useMyLocation(): void {
    const geolocation = this.document.defaultView?.navigator?.geolocation;
    if (!geolocation) {
      // Sin API —navegador viejo, o el render del servidor— no hay nada que
      // pedir: queda marcar el punto a mano.
      this.locationDenied.set(true);
      return;
    }

    this.locating.set(true);
    geolocation.getCurrentPosition(
      (position) => {
        this.locating.set(false);
        this.locationDenied.set(false);
        this.pickingOnMap.set(false);
        this.origin.set({
          label: 'tu ubicación',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      // Denegado, no disponible o vencido llevan al mismo lugar: el aviso y la
      // alternativa. Distinguirlos no le cambia nada a quien mira, y la
      // pantalla **no se rompe** en ninguno de los tres casos (AC-06-16).
      () => {
        this.locating.set(false);
        this.locationDenied.set(true);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  /** Activa o cancela el modo «marcá tu punto en el mapa». */
  protected togglePickOnMap(): void {
    this.pickingOnMap.update((active) => !active);
  }

  /**
   * Un clic sobre el mapa. Sólo fija el origen si se pidió marcarlo: sin esa
   * puerta, cualquier arrastre para mover el mapa movería el punto de partida.
   */
  protected handleMapPoint(point: PuntoGeo): void {
    if (!this.pickingOnMap()) {
      return;
    }
    this.pickingOnMap.set(false);
    this.locationDenied.set(false);
    this.origin.set({ label: 'el punto que marcaste', lat: point.lat, lng: point.lng });
  }

  protected clearOrigin(): void {
    this.origin.set(null);
    this.pickingOnMap.set(false);
  }
}
