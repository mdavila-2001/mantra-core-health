/* V65-12·D · Cerca mío
   Portada de V65-buscador/publico/V65-12-cercania-detalle.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type { PublicNearbyResult } from '@core/data-access/public-directory/public-directory.types';
import { rutaDeFicha } from '../public-result.mapper';

/** Radio por omisión de la consulta, en kilómetros. El contrato lo acota a `[1, 50]`. */
const RADIO_KM = 5;

/** Las letras con las que el mapa y la tabla se refieren al mismo lugar. */
const CODIGOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Cómo se rotula cada vertical en la columna «Qué es». */
const ROTULO: Readonly<Record<string, string>> = {
  PRACTITIONER: 'Profesional',
  ORGANIZATION: 'Hospital o clínica',
  PHARMACY: 'Farmacia',
  DIAGNOSTIC_UNIT: 'Laboratorio',
  INSURER: 'Aseguradora',
  MEDICATION: 'Medicamento',
};

/** Un lugar cercano ya listo para pintarse en el mapa y en la tabla. */
export interface LugarCercano {
  readonly codigo: string;
  readonly nombre: string;
  readonly queEs: string;
  readonly distancia: string;
  readonly enlace: string;
  /** Posición dentro del recuadro del mapa, en el sistema del `viewBox`. */
  readonly x: number;
  readonly y: number;
}

/** En qué punto del recorrido está la pantalla. */
export type EstadoCercania =
  | 'consentimiento'
  | 'localizando'
  | 'carga'
  | 'datos'
  | 'vacio'
  | 'denegado'
  | 'error';

/**
 * V65-12 · Cerca mío.
 *
 * ## La ubicación se pide, no se toma
 *
 * La pantalla abre en `consentimiento` y **no llama a la API de geolocalización
 * hasta que alguien aprieta el botón**. No es un formalismo: el navegador
 * muestra su propio permiso, pero disparar el pedido al entrar convierte una
 * visita a un directorio de salud en un diálogo de sistema que nadie provocó, y
 * la mitad de las veces se contesta «bloquear» por reflejo —y esa respuesta es
 * permanente para el sitio—. Pidiéndolo con un botón, quien lo aprieta ya sabe
 * para qué es.
 *
 * La alternativa escrita está siempre visible, no sólo cuando se deniega el
 * permiso: buscar por zona da el mismo resultado sin entregar la ubicación (la
 * ficha lo exige, F6.72).
 *
 * ## La tabla no es un respaldo del mapa: es el dato
 *
 * `PAC-MED-005` —regla NO-ESTRUCTURAL de la ficha— pide la tabla **debajo** del
 * mapa con la misma información, y el rótulo «distancia en línea recta» al pie.
 * El mapa lleva `role="img"` y su descripción remite a la tabla: quien navega
 * con lector de pantalla, o con el mapa sin cargar, llega al mismo dato por el
 * mismo camino.
 *
 * La distancia es **en línea recta** y el rótulo dice exactamente eso. Un «1,2
 * km» que alguien lea como recorrido en una ciudad con quebradas es una
 * caminata de veinte minutos presentada como de cinco.
 *
 * ## Por qué hoy esta pantalla no muestra lugares
 *
 * `GET /public/nearby` valida las coordenadas y devuelve la envoltura del
 * contrato con `items: []`: el directorio todavía **no tiene coordenadas
 * propias** —`geo_point` llega con otro carril— y el servicio lo dice en su
 * propio log en vez de inventar posiciones. El recorrido completo está
 * cableado contra el endpoint real, así que el día que haya coordenadas la
 * pantalla las pinta sin tocar una línea; hasta entonces cae en el estado
 * vacío, que explica qué falta.
 */
@Component({
  selector: 'app-alovida-buscar-cercania-detalle',
  imports: [RouterLink],
  templateUrl: './cercania-detalle.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarCercaniaDetalle {
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly documento = inject(DOCUMENT);
  private readonly router = inject(Router);

  protected readonly estado = signal<EstadoCercania>('consentimiento');
  private readonly crudos = signal<readonly PublicNearbyResult[]>([]);

  protected readonly radioKm = RADIO_KM;

  /** Cuántos lugares se encontraron, para el rótulo de la cabecera. */
  protected readonly cuantos = computed(() => this.crudos().length);

  /**
   * Los lugares, con su letra y su posición en el mapa.
   *
   * La posición es una **proyección lineal del recuadro que ocupan los
   * resultados**, no una proyección cartográfica: a la escala de una ciudad la
   * diferencia es de píxeles, y el mapa es un esquema de posiciones relativas
   * —lo dice su descripción— y no una carta de navegación. Con un solo
   * resultado, o con todos en el mismo punto, el recuadro es degenerado y todo
   * va al centro en vez de dividir por cero.
   */
  protected readonly lugares = computed<readonly LugarCercano[]>(() => {
    const items = this.crudos();
    if (items.length === 0) return [];

    const lats = items.map((i) => i.location.lat);
    const lngs = items.map((i) => i.location.lng);
    const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
    const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];

    const proyecta = (valor: number, min: number, max: number, largo: number): number =>
      max === min ? largo / 2 : 60 + ((valor - min) / (max - min)) * (largo - 120);

    return items.map((item, i) => ({
      codigo: CODIGOS[i] ?? String(i + 1),
      nombre: item.displayName,
      queEs: ROTULO[item.kind] ?? 'Lugar de atención',
      // Una decimal y coma decimal, como el contrato y como se lee acá.
      distancia: `${item.distanceKm.toFixed(1).replace('.', ',')} km`,
      enlace: rutaDeFicha(item),
      x: proyecta(item.location.lng, minLng, maxLng, 800),
      // La latitud crece hacia el norte y la `y` del SVG hacia abajo: sin
      // invertirla el mapa sale reflejado y los puntos del norte aparecen al
      // sur, que es peor que no dibujarlos.
      y: 400 - proyecta(item.location.lat, minLat, maxLat, 400),
    }));
  });

  /**
   * Pide la ubicación al navegador y, con ella, los lugares cercanos.
   *
   * Sólo se llama desde el botón.
   */
  protected compartirUbicacion(): void {
    const geo = this.documento.defaultView?.navigator?.geolocation;
    if (!geo) {
      // Sin API de geolocalización —navegador viejo, o el render del servidor—
      // no hay nada que pedir: se ofrece la alternativa escrita directamente.
      this.estado.set('denegado');
      return;
    }

    this.estado.set('localizando');
    geo.getCurrentPosition(
      (posicion) =>
        this.consultar(posicion.coords.latitude, posicion.coords.longitude),
      // Denegado, no disponible o vencido llevan al mismo lugar: la alternativa
      // escrita. Distinguirlos en pantalla no le cambia nada a quien mira.
      () => this.estado.set('denegado'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  /** Vuelve a preguntar, después de un error. */
  protected reintentar(): void {
    this.estado.set('consentimiento');
  }

  /** Lleva la búsqueda por zona escrita a la búsqueda unificada. */
  protected buscarPorZona(evento: Event): void {
    evento.preventDefault();
    const q = new FormData(evento.target as HTMLFormElement).get('zona');
    const texto = typeof q === 'string' ? q.trim() : '';
    if (texto === '') return;
    void this.router.navigate(['/search'], { queryParams: { q: texto } });
  }

  private consultar(lat: number, lng: number): void {
    this.estado.set('carga');
    this.directorio.nearby({ lat, lng, radiusKm: RADIO_KM }).subscribe({
      next: (pagina) => {
        this.crudos.set(pagina.items);
        this.estado.set(pagina.items.length === 0 ? 'vacio' : 'datos');
      },
      error: () => this.estado.set('error'),
    });
  }
}
