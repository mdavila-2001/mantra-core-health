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
import { CARGADOR_DE_PROVINCIAS, type ProvinciasDeBolivia, provinciaEn } from './provincias';

/**
 * Mosaicos del servidor comunitario de OpenStreetMap, sin clave de API.
 *
 * **Por qué ya no son los de CARTO** (19/09/2026): CARTO dejó de servir sus
 * basemaps de forma anónima y ahora estampa «API KEY REQUIRED ·
 * carto.com/basemaps/apikey» **en diagonal sobre cada mosaico**. No es un
 * fallo de carga que se vea en la consola: el mosaico llega con 200 y con la
 * marca de agua pintada encima, así que TODOS los mapas del producto —el de
 * los directorios, «Dónde comprar», las sedes del perfil— se veían rotos y
 * nada lo delataba salvo mirarlos. Medido pidiendo el mismo mosaico de Santa
 * Cruz a los dos proveedores: CARTO 26 441 B con la marca, OSM 34 984 B
 * limpio.
 *
 * El comentario que estaba acá decía que OSM «bloquea las solicitudes de esta
 * aplicación por su política de uso». No se sostiene: el mismo mosaico, con el
 * agente y el referente del navegador, responde 200 y se lee. La política de
 * OSM pide atribución visible y uso moderado —las dos se cumplen—, y es
 * además la decisión ya escrita del proyecto: Leaflet + OpenStreetMap sin
 * clave, que es lo que la CSP del servidor permitía antes de que alguien la
 * abriera a CARTO.
 *
 * Un solo host: el servidor de OSM ya no reparte por subdominios `a`/`b`/`c`,
 * así que la plantilla no lleva `{s}` ni la capa `subdomains`.
 */
const DEMO_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** La atribución de OSM es condición de uso, no un adorno. */
const DEMO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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

/**
 * Desde qué zoom se escriben los nombres de las provincias sobre el mapa. Más
 * lejos se pisan unas con otras —en 8 ya se encima el valle de Cochabamba,
 * medido en pantalla el 24/09/2026— y el plano se vuelve ilegible; los
 * límites se dibujan siempre, y la provincia del centro la dice el rótulo fijo.
 */
const ZOOM_DE_NOMBRES_DE_PROVINCIA = 9;

/**
 * El panel propio de las provincias: por encima de los mosaicos (200) y por
 * debajo de los pines (600), para que un límite o un nombre nunca tape un pin.
 */
const PANEL_DE_PROVINCIAS = 'provincias';
const Z_DEL_PANEL_DE_PROVINCIAS = '350';

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
  private readonly cargarProvincias = inject(CARGADOR_DE_PROVINCIAS);
  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');

  protected readonly listo = signal(false);

  /** «Provincia X · Departamento» del punto que está en el centro del mapa. */
  protected readonly provinciaAlCentro = signal<string | null>(null);

  private leaflet: typeof Leaflet | null = null;
  private mapa: Leaflet.Map | null = null;
  private capaDePines: Leaflet.LayerGroup | null = null;
  private readonly marcadores = new Map<string, Leaflet.Marker>();
  private pinesDibujados: readonly PinMapa[] | null = null;
  private destruido = false;
  private observadorDeTamano: ResizeObserver | null = null;
  /** Si el lienzo llegó a medir algo alguna vez. Ver {@link vigilarElTamano}. */
  private tuvoTamano = false;

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
    this.observadorDeTamano?.disconnect();
    this.observadorDeTamano = null;
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

    const lienzo = this.lienzo().nativeElement;
    // Leaflet mide el contenedor al montarse y, si lo encuentra `static`, le
    // escribe `position: relative` EN LÍNEA — y una regla en línea le gana a
    // `map.css`, así que `inset: 0` deja de aplicar, el lienzo queda de alto 0
    // y el mapa se dibuja al zoom máximo sobre un punto, en blanco.
    //
    // Pasa cuando el mapa se monta en el mismo ciclo en que se insertan sus
    // estilos —un mapa dentro de una pestaña que recién se abre—. La geometría
    // se fija acá, antes de que Leaflet la mire: es la misma que declara
    // `map.css`, escrita donde el orden de carga no la puede perder.
    lienzo.style.position = 'absolute';
    lienzo.style.inset = '0';
    const mapa = L.map(lienzo, { maxZoom: ZOOM_MAXIMO });
    mapa.setView(CENTRO_POR_DEFECTO, ZOOM_POR_DEFECTO);
    L.tileLayer(DEMO_TILES, {
      attribution: DEMO_ATTRIBUTION,
      maxZoom: ZOOM_MAXIMO,
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
    this.vigilarElTamano(lienzo);
    void this.dibujarProvincias(L, mapa, lienzo);
  }

  /**
   * Los límites de las 112 provincias, sus nombres, y cuál es la del centro.
   *
   * Llega después del mapa y no lo demora: los mosaicos y los pines ya están
   * cuando el archivo termina de bajar. Si no baja, el mapa queda como era.
   *
   * Nada de esto es interactivo: un clic sobre un límite tiene que seguir
   * llegando al mapa, que es lo que usa «marcá en el mapa dónde vivís».
   */
  private async dibujarProvincias(
    L: typeof Leaflet,
    mapa: Leaflet.Map,
    lienzo: HTMLElement,
  ): Promise<void> {
    if (typeof L.geoJSON !== 'function' || typeof mapa.createPane !== 'function') {
      return;
    }
    const provincias = await this.cargarProvincias();
    if (provincias === null || this.destruido || this.mapa !== mapa) {
      return;
    }

    const panel = mapa.createPane(PANEL_DE_PROVINCIAS);
    panel.style.zIndex = Z_DEL_PANEL_DE_PROVINCIAS;
    panel.style.pointerEvents = 'none';

    // `L.geoJSON` pide el tipo de `@types/geojson`; el nuestro es el mismo
    // contrato escrito en `provincias.ts`, sin depender de ese paquete.
    L.geoJSON(provincias as unknown as Parameters<typeof L.geoJSON>[0], {
      pane: PANEL_DE_PROVINCIAS,
      interactive: false,
      style: () => ({ className: 'mapa__provincia', weight: 1.5, fill: false }),
    }).addTo(mapa);

    for (const { properties } of provincias.features) {
      const nombre = this.documento.createElement('span');
      nombre.className = 'mapa__provincia-nombre';
      nombre.textContent = properties.nombre;
      L.marker([properties.rotulo[1], properties.rotulo[0]], {
        pane: PANEL_DE_PROVINCIAS,
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: 'mapa__provincia-rotulo', html: nombre, iconSize: [0, 0] }),
      }).addTo(mapa);
    }

    const alMoverse = (): void => {
      lienzo.classList.toggle(
        'mapa__lienzo--con-nombres',
        mapa.getZoom() >= ZOOM_DE_NOMBRES_DE_PROVINCIA,
      );
      this.provinciaAlCentro.set(this.nombrarProvincia(provincias, mapa.getCenter()));
    };
    mapa.on('moveend', alMoverse);
    alMoverse();
  }

  private nombrarProvincia(provincias: ProvinciasDeBolivia, centro: PuntoGeo): string | null {
    const provincia = provinciaEn(provincias, centro);
    return provincia === null
      ? null
      : `Provincia ${provincia.properties.nombre} · ${provincia.properties.departamento}`;
  }

  /**
   * Corrige el encuadre cuando el lienzo cambia de tamaño.
   *
   * Leaflet mide UNA vez, al montarse, y no vuelve a mirar: un mapa que nació
   * en una caja de alto 0 —dentro de una pestaña que todavía no se abrió, de
   * un modal que no se mostró, de un acordeón plegado— se queda encuadrado al
   * zoom máximo sobre un punto y se ve gris para siempre.
   *
   * La primera vez que el lienzo mide algo se reencuadra: ése es el momento en
   * que el mapa recién puede saber qué entra en pantalla. De ahí en más sólo
   * se le avisa del cambio de tamaño (`invalidateSize`), sin tocar el encuadre
   * —quien arrastró el mapa no quiere que una rotación de pantalla se lo
   * devuelva al principio—.
   */
  private vigilarElTamano(lienzo: HTMLElement): void {
    if (typeof ResizeObserver !== 'function') {
      return;
    }
    this.tuvoTamano = lienzo.clientHeight > 0 && lienzo.clientWidth > 0;
    this.observadorDeTamano = new ResizeObserver(() => {
      const L = this.leaflet;
      const mapa = this.mapa;
      if (L === null || mapa === null || typeof mapa.invalidateSize !== 'function') {
        return;
      }
      mapa.invalidateSize();
      if (!this.tuvoTamano && lienzo.clientHeight > 0 && lienzo.clientWidth > 0) {
        this.tuvoTamano = true;
        this.encuadrar(L, mapa, this.pines());
      }
    });
    this.observadorDeTamano.observe(lienzo);
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
