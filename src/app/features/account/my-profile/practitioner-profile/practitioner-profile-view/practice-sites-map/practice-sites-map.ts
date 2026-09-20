import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  type OnDestroy,
} from '@angular/core';

import { AppMap } from '../../../../../../shared/components/organisms/map/map';
import type { PinMapa } from '../../../../../../shared/components/organisms/map/pin-mapa.types';
import type { SedeVisible } from '../practitioner-profile-view.types';

/**
 * **Dónde atendés, en el mapa** — el bloque «Tus consultorios y sedes» de la
 * ficha propia.
 *
 * ## Por qué existe
 *
 * Era una lista de cuatro renglones con la dirección en mayúsculas y un
 * enlace «Ver en el mapa» que abría Google Maps en otra pestaña: cuatro
 * direcciones de la misma ciudad, sin forma de ver dónde caen unas respecto de
 * otras, y el único mapa que había estaba fuera de la aplicación. El cliente
 * lo rechazó con esas palabras el 19/09/2026 («esto debe ser un mapa»).
 *
 * Ahora el mapa es el bloque, y la lista queda al lado como su índice: es el
 * mismo reparto que ya usan la ficha pública (`public-profile-card`) y el
 * detalle de farmacia. El mapa lo pone {@link AppMap} —Leaflet +
 * OpenStreetMap, sin clave de API—, que es el organismo del banco y no una
 * integración nueva: traer Google Maps exigiría cambiar la CSP del servidor.
 *
 * ## La lista no es decorado
 *
 * Los pines de Leaflet no participan del orden de tabulación, así que el
 * camino por teclado —y el del lector de pantalla— **es la lista**. Elegir un
 * renglón resalta su pin (`seleccionado` viaja en two-way), y cada uno
 * conserva su enlace a la ruta para llegar.
 *
 * ## El mapa no se monta hasta que se ve
 *
 * El contenido de una pestaña **se instancia aunque la pestaña esté cerrada**:
 * el `@if` de `app-tab` decide si se inserta en el DOM, no si se construye.
 * Leaflet creado contra un elemento desprendido mide 0×0, encuadra al zoom
 * máximo y se queda así para siempre —el mapa aparecía en blanco al abrir
 * «Dónde atiendo»—. Por eso el lienzo espera a que un `IntersectionObserver`
 * diga que está en pantalla. Donde no hay observador (jsdom, o un navegador
 * viejo) se monta directo: la degradación es mostrar el mapa, no esconderlo.
 *
 * ## Una sede sin coordenadas sigue existiendo
 *
 * Se lista igual, con su dirección y sin pin: esconderla sería borrar del
 * perfil un consultorio por un dato que falta. Si NINGUNA tiene coordenadas no
 * se dibuja el mapa, que es lo mismo que decir que no hay nada que ubicar.
 */
@Component({
  selector: 'app-practice-sites-map',
  imports: [AppMap],
  templateUrl: './practice-sites-map.html',
  styleUrl: './practice-sites-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PracticeSitesMap implements OnDestroy {
  /** Las sedes a ubicar, en el orden en que vienen. */
  readonly sedes = input.required<readonly SedeVisible[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observador: IntersectionObserver | null = null;

  /** Si el bloque ya está en pantalla y Leaflet puede medirse. */
  protected readonly enPantalla = signal(false);

  constructor() {
    afterNextRender(() => {
      if (typeof IntersectionObserver !== 'function') {
        this.enPantalla.set(true);
        return;
      }
      this.observador = new IntersectionObserver((entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          this.enPantalla.set(true);
          this.observador?.disconnect();
        }
      });
      this.observador.observe(this.host.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  /** Qué sede está resaltada. La comparten la lista y el mapa. */
  protected readonly seleccionada = signal<string | null>(null);

  /**
   * Un pin por sede con coordenadas.
   *
   * El `codigo` es el ordinal que la lista muestra al lado del nombre: es lo
   * que ata un renglón a su pin sin obligar a leer el popup.
   */
  protected readonly pines = computed<readonly PinMapa[]>(() =>
    this.sedes()
      .map((sede, indice) => ({ sede, orden: indice + 1 }))
      .filter(({ sede }) => sede.punto !== null)
      .map(({ sede, orden }) => ({
        id: sede.id,
        codigo: String(orden),
        lat: sede.punto!.lat,
        lng: sede.punto!.lng,
        titulo: sede.nombre,
        ...(sede.direccion === '' ? {} : { subtitulo: sede.direccion }),
      })),
  );

  /** Las sedes con su ordinal y su enlace a la ruta, listas para la lista. */
  protected readonly renglones = computed(() =>
    this.sedes().map((sede, indice) => ({
      ...sede,
      orden: indice + 1,
      ubicada: sede.punto !== null,
      comoLlegar:
        sede.punto === null
          ? null
          : `https://www.openstreetmap.org/directions?to=${sede.punto.lat},${sede.punto.lng}`,
    })),
  );

  /** Cuántas quedaron sin ubicar: lo que el mapa no puede mostrar, se dice. */
  protected readonly sinUbicar = computed(
    () => this.sedes().filter((sede) => sede.punto === null).length,
  );

  protected readonly etiquetaDelMapa = computed(
    () => `Tus consultorios y sedes en el mapa: ${this.pines().length} ubicados.`,
  );

  /** Alternar: volver a tocar el renglón resaltado lo suelta. */
  protected alternar(id: string): void {
    this.seleccionada.update((actual) => (actual === id ? null : id));
  }
}
