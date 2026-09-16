import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  Injector,
  OnDestroy,
  PLATFORM_ID,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';

import type { PinMapa, PuntoGeo } from './pin-mapa.types';

/**
 * Mosaicos de CARTO para la demo: no carga el servidor comunitario de OSM,
 * que bloquea las solicitudes de esta aplicación por su política de uso.
 */
const DEMO_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

/** La atribución de OSM y CARTO es condición de uso, no un adorno. */
const DEMO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const ZOOM_MAXIMO = 19;

/** Con un solo pin no hay recuadro que encuadrar: se abre a escala de barrio. */
const ZOOM_DE_UN_PIN = 15;

/** Aire alrededor del recuadro de pines, para que ninguno quede pegado al borde. */
const MARGEN_DE_ENCUADRE: Leaflet.PointTuple = [32, 32];

/**
 * Vista por defecto mientras no hay pines ni centro: la ciudad más poblada
 * donde la red opera (el mismo punto público que usan las pantallas para
 * medir distancias sin pedir la ubicación).
 */
const CENTRO_POR_DEFECTO: Leaflet.LatLngTuple = [-17.7833, -63.1821];
const ZOOM_POR_DEFECTO = 12;

/** El `<link>` del CSS de Leaflet, compartido entre todas las instancias. */
const ID_DE_ESTILOS = 'leaflet-css';
const RUTA_DE_ESTILOS = 'assets/leaflet/leaflet.css';

/** El namespace de Leaflet, venga como ESM o como CJS interoperado. */
type ModuloLeaflet = typeof Leaflet & { readonly default?: typeof Leaflet };

export type CargadorDeLeaflet = () => Promise<ModuloLeaflet>;

/**
 * Cómo llega Leaflet al organismo: en producción, el `import()` dinámico
 * (chunk propio, solo se descarga en el navegador y cuando hay un mapa en
 * pantalla); en los specs, un doble que no necesita layout real.
 */
export const CARGADOR_DE_LEAFLET = new InjectionToken<CargadorDeLeaflet>('CARGADOR_DE_LEAFLET', {
  providedIn: 'root',
  factory: () => () => import('leaflet'),
});

/**
 * El contenido del popup, armado con DOM propio: Leaflet vive fuera del
 * template de Angular, así que acá no hay proyección de contenido — el CTA
 * entra como etiqueta y sale como callback. Todo texto va por `textContent`:
 * los nombres vienen de datos y jamás se interpolan como HTML.
 */
export function construirPopup(
  documento: Document,
  pin: PinMapa,
  alElegir: () => void,
): HTMLElement {
  const caja = documento.createElement('div');
  caja.className = 'mapa__popup';

  const titulo = documento.createElement('strong');
  titulo.className = 'mapa__popup-titulo';
  titulo.textContent = pin.titulo;
  caja.appendChild(titulo);

  if (pin.estado !== undefined) {
    const estado = documento.createElement('span');
    estado.className = `mapa__popup-estado mapa__popup-estado--${pin.estado.tono}`;
    estado.textContent = pin.estado.etiqueta;
    caja.appendChild(estado);
  }

  if (pin.subtitulo !== undefined) {
    const detalle = documento.createElement('p');
    detalle.className = 'mapa__popup-detalle';
    detalle.textContent = pin.subtitulo;
    caja.appendChild(detalle);
  }

  if (pin.ctaEtiqueta !== undefined) {
    const cta = documento.createElement('button');
    cta.type = 'button';
    cta.className = 'mapa__popup-cta';
    cta.textContent = pin.ctaEtiqueta;
    cta.addEventListener('click', alElegir);
    caja.appendChild(cta);
  }

  return caja;
}

/**
 * **El mapa compartido** (carril FAR-I1): Leaflet + OpenStreetMap como
 * organismo del banco, para toda pantalla que ubique lugares — sucursales
 * que pueden surtir una receta, sedes de laboratorio, resultados cercanos.
 *
 * ## SSR y presupuesto
 *
 * Leaflet toca `window` al importarse, así que acá no entra hasta
 * `afterNextRender` y solo en navegador; el servidor pinta el lienzo vacío
 * con su aviso. El `import()` dinámico lo deja en un chunk propio: el bundle
 * inicial no lo carga nunca. Su CSS viaja como asset (`assets/leaflet/`) y
 * se engancha una sola vez por documento.
 *
 * ## El mapa es progresivo
 *
 * Nada existe solo acá: la pantalla que lo monta mantiene la lista con el
 * mismo dato (y `etiqueta` debe decirlo). La selección cruzada viaja por
 * `seleccionado` (two-way) y el CTA del popup por `pinElegido` — los pines
 * no participan del orden de tabulación: el camino por teclado es la lista.
 */
@Component({
  selector: 'app-map',
  imports: [],
  templateUrl: './map.html',
  styleUrl: './map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Leaflet arma su DOM (pines, popups, controles) fuera del template: con
  // encapsulación emulada estas reglas no lo alcanzarían. Todo va bajo `.mapa`.
  encapsulation: ViewEncapsulation.None,
})
export class AppMap implements OnDestroy {
  readonly pines = input.required<readonly PinMapa[]>();

  /** Nombre accesible del mapa; debe remitir a la lista que repite el dato. */
  readonly etiqueta = input.required<string>();

  /** Centro impuesto; sin él, el encuadre lo deciden los pines. */
  readonly centro = input<PuntoGeo | null>(null);
  readonly zoom = input<number | null>(null);

  /** El `id` del pin resaltado; la lista y el mapa lo comparten en two-way. */
  readonly seleccionado = model<string | null>(null);

  /** El `id` del pin cuyo CTA se activó en el popup. */
  readonly pinElegido = output<string>();

  /**
   * El punto del mapa donde alguien hizo clic (TAREA 06, AC-06-14).
   *
   * Existe porque «Cómo llegar» tiene que dejar **marcar el origen** a quien no
   * quiere —o no puede— entregar su ubicación del navegador, y ese punto sólo
   * lo sabe Leaflet: del lado del template no hay forma de convertir píxeles a
   * grados. Es aditivo: quien no lo escucha no cambia en nada.
   */
  readonly pointPicked = output<PuntoGeo>();

  /**
   * Si el mapa está esperando que alguien **toque un punto**.
   *
   * No cambia lo que se emite —`pointPicked` sale siempre—; cambia lo que se
   * ve: el cursor pasa de la mano de arrastrar a la cruz de apuntar, que es la
   * única pista visual de que acá un clic hace algo. Sin ella, quien llegó a
   * «marcá en el mapa dónde vivís» arrastra el plano y no entiende por qué el
   * pin no aparece.
   */
  readonly seleccionable = input(false);

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly documento = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly cargarLeaflet = inject(CARGADOR_DE_LEAFLET);
  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');

  protected readonly listo = signal(false);

  private leaflet: typeof Leaflet | null = null;
  private mapa: Leaflet.Map | null = null;
  private capaDePines: Leaflet.LayerGroup | null = null;
  private readonly marcadores = new Map<string, Leaflet.Marker>();
  private pinesDibujados: readonly PinMapa[] | null = null;
  private destruido = false;

  constructor() {
    if (!this.isBrowser) {
      return;
    }
    // Montar exige el lienzo ya pintado — el mismo motivo por el que el menú
    // difiere su medición (`menu.ts`): acá `L.map(el)` necesita el elemento.
    afterNextRender(() => void this.montar(), { injector: this.injector });
    effect(() => {
      const pines = this.pines();
      const elegido = this.seleccionado();
      if (this.mapa === null) {
        return;
      }
      if (pines !== this.pinesDibujados) {
        this.dibujar(pines);
      }
      this.resaltar(elegido);
    });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.mapa?.remove();
    this.mapa = null;
    this.leaflet = null;
    this.capaDePines = null;
    this.marcadores.clear();
  }

  private async montar(): Promise<void> {
    this.asegurarEstilos();
    const modulo = await this.cargarLeaflet();
    if (this.destruido) {
      return;
    }
    const L = modulo.default ?? modulo;
    this.leaflet = L;

    const mapa = L.map(this.lienzo().nativeElement, { maxZoom: ZOOM_MAXIMO });
    mapa.setView(CENTRO_POR_DEFECTO, ZOOM_POR_DEFECTO);
    L.tileLayer(DEMO_TILES, {
      attribution: DEMO_ATTRIBUTION,
      maxZoom: ZOOM_MAXIMO,
      subdomains: 'abcd',
    }).addTo(mapa);
    this.mapa = mapa;
    // El bus de eventos de Leaflet no existe en el doble de `map.spec.ts` ni
    // en jsdom: el mismo resguardo que usa `dialog.ts` con `showModal()`.
    if (typeof mapa.on === 'function') {
      mapa.on('click', (evento: Leaflet.LeafletMouseEvent) => {
        this.pointPicked.emit({ lat: evento.latlng.lat, lng: evento.latlng.lng });
      });
    }
    this.listo.set(true);

    this.dibujar(this.pines());
    this.resaltar(this.seleccionado());
  }

  /** Engancha el CSS de Leaflet una sola vez por documento. */
  private asegurarEstilos(): void {
    if (this.documento.getElementById(ID_DE_ESTILOS) !== null) {
      return;
    }
    const enlace = this.documento.createElement('link');
    enlace.id = ID_DE_ESTILOS;
    enlace.rel = 'stylesheet';
    enlace.href = RUTA_DE_ESTILOS;
    this.documento.head.appendChild(enlace);
  }

  private dibujar(pines: readonly PinMapa[]): void {
    const L = this.leaflet;
    const mapa = this.mapa;
    if (L === null || mapa === null) {
      return;
    }

    this.capaDePines?.remove();
    this.marcadores.clear();

    const capa = L.layerGroup();
    for (const pin of pines) {
      const marcador = L.marker([pin.lat, pin.lng], {
        icon: this.iconoDe(L, pin),
        alt: pin.titulo,
        // El camino por teclado es la lista: los pines no entran al tab order.
        keyboard: false,
      });
      marcador.bindPopup(
        construirPopup(this.documento, pin, () => this.pinElegido.emit(pin.id)),
      );
      marcador.on('click', () => this.seleccionado.set(pin.id));
      marcador.addTo(capa);
      this.marcadores.set(pin.id, marcador);
    }
    capa.addTo(mapa);

    this.capaDePines = capa;
    this.pinesDibujados = pines;
    this.encuadrar(L, mapa, pines);
  }

  private encuadrar(L: typeof Leaflet, mapa: Leaflet.Map, pines: readonly PinMapa[]): void {
    const centro = this.centro();
    if (centro !== null) {
      mapa.setView([centro.lat, centro.lng], this.zoom() ?? ZOOM_POR_DEFECTO);
      return;
    }
    if (pines.length === 0) {
      return;
    }
    if (pines.length === 1) {
      mapa.setView([pines[0].lat, pines[0].lng], this.zoom() ?? ZOOM_DE_UN_PIN);
      return;
    }
    mapa.fitBounds(
      L.latLngBounds(pines.map((pin): Leaflet.LatLngTuple => [pin.lat, pin.lng])),
      { padding: MARGEN_DE_ENCUADRE },
    );
  }

  private iconoDe(L: typeof Leaflet, pin: PinMapa): Leaflet.DivIcon {
    const cara = this.documento.createElement('span');
    cara.className = `mapa__pin mapa__pin--${pin.estado?.tono ?? 'neutral'}`;
    cara.textContent = pin.codigo ?? '';
    return L.divIcon({
      className: 'mapa__marcador',
      html: cara,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -18],
    });
  }

  /**
   * Marca visualmente el pin seleccionado. A propósito no abre el popup ni
   * recentra: la selección llega también del hover de la lista, y mover el
   * mapa a cada rozón lo vuelve inusable. El popup se abre al tocar el pin.
   */
  private resaltar(elegido: string | null): void {
    for (const [id, marcador] of this.marcadores) {
      const cara = marcador.getElement()?.querySelector('.mapa__pin');
      cara?.classList.toggle('mapa__pin--activo', id === elegido);
    }
  }
}
