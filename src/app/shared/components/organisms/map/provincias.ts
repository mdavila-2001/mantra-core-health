import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject } from '@angular/core';

import type { PuntoGeo } from './pin-mapa.types';

/* ============================================================================
    Las 112 provincias de Bolivia, para dibujarlas en todo mapa del producto.

    Pedido del cliente del 24/09/2026: «en TODOS LOS MAPAS se pongan las
    provincias».

    ## Fuente declarada — regla `.claude/rules/70-data-seeders.md`

    | | |
    |---|---|
    | `source_name` | geoBoundaries **gbOpen** — `BOL / ADM2`, `boundaryID` `BOL-ADM2-80513517` |
    | Origen del dato | **GeoBolivia** (`geo.gob.bo`), capa ADM3 agregada a ADM2 |
    | Referencia | `github.com/wmgeolab/geoBoundaries` `9469f09` `releaseData/gbOpen/BOL/ADM2/geoBoundaries-BOL-ADM2_simplified.geojson` |
    | Licencia | **Dominio público** (`boundaryLicense: "Public Domain"`) |
    | Año representado | 2015; dato de origen actualizado 2023-01-19 |
    | Obtenido | 2026-09-24 |

    Es la misma fuente que ya dibuja los nueve departamentos
    (`department-map/bolivia-departments.geometry.ts`), un nivel más abajo.

    ## Qué se le hizo al dato, y por qué

    1. **Simplificado al 10 %** con `mapshaper -simplify 10% keep-shapes`, que
       conserva la topología: dos provincias vecinas siguen compartiendo el
       mismo borde, sin rendijas ni líneas dobles. Coordenadas a 4 decimales
       (≈ 11 m). Quedan ~150 kB (~39 kB comprimido), que el mapa baja una sola
       vez y sólo cuando hay un mapa en pantalla.
    2. **La fuente trae 110 unidades y Bolivia tiene 112.** Dos defectos de la
       fuente, corregidos acá y no a ojo:
       - las cuatro «Cercado» (Beni, Cochabamba, Oruro y Tarija) llegan
         fundidas en UN solo multipolígono. Se separan por departamento
         —cada parte cae dentro de uno solo— y quedan cuatro.
       - «Gualberto Villarroel» (La Paz) llega partida en dos, una con el
         nombre truncado («Gualberto Villarroe»). Se unen.
       Resultado por departamento: LP 20 · CB 16 · OR 16 · PT 16 · SC 15 ·
       CH 10 · BE 8 · TJ 6 · PA 5, que es la división política vigente.
    3. Tres grafías corregidas a la oficial: «Bolívar», «Charcas» y «Ñuflo de
       Chávez».
    4. `departamento` sale de cruzar cada provincia con la capa ADM1 de la
       misma fuente, y `rotulo` es un punto **interior** de su parte mayor
       (no el centroide: hay provincias cóncavas cuyo centroide cae afuera).

    El archivo vive en `public/geo/` y **no se edita a mano**: si hace falta
    más detalle, se vuelve a la fuente y se baja la simplificación.
    ========================================================================== */

/** Anillos de un polígono en `[lng, lat]`, el primero exterior y el resto huecos. */
type Anillos = readonly (readonly (readonly number[])[])[];

export type GeometriaDeProvincia =
  | { readonly type: 'Polygon'; readonly coordinates: Anillos }
  | { readonly type: 'MultiPolygon'; readonly coordinates: readonly Anillos[] };

export interface ProvinciaGeo {
  readonly type: 'Feature';
  readonly properties: {
    readonly nombre: string;
    readonly departamento: string;
    /** Dónde va el nombre, en `[lng, lat]` como el resto del GeoJSON. */
    readonly rotulo: readonly [number, number];
  };
  readonly geometry: GeometriaDeProvincia;
}

export interface ProvinciasDeBolivia {
  readonly type: 'FeatureCollection';
  readonly features: readonly ProvinciaGeo[];
}

/** Relativa al `<base href>`, igual que el CSS de Leaflet. */
export const RUTA_DE_PROVINCIAS = 'geo/bolivia-provincias.geojson';

/** `null` es «no hay provincias»: el mapa se dibuja igual, sin ellas. */
export type CargadorDeProvincias = () => Promise<ProvinciasDeBolivia | null>;

/**
 * Cómo llegan las provincias al mapa.
 *
 * Con `fetch` y no con `HttpClient` a propósito: es un archivo estático del
 * propio sitio, y por `HttpClient` pasaría por los interceptores —la sesión,
 * y en el despliegue de maqueta el simulador, que respondería por él—.
 *
 * Una sola descarga por sesión: el token es de raíz y el pedido queda
 * guardado. Si falla se olvida, para que el próximo mapa lo vuelva a intentar.
 */
export const CARGADOR_DE_PROVINCIAS = new InjectionToken<CargadorDeProvincias>(
  'CARGADOR_DE_PROVINCIAS',
  {
    providedIn: 'root',
    factory: () => {
      const documento = inject(DOCUMENT);
      let pedido: Promise<ProvinciasDeBolivia | null> | null = null;
      return () => {
        if (typeof fetch !== 'function') {
          return Promise.resolve(null);
        }
        pedido ??= fetch(new URL(RUTA_DE_PROVINCIAS, documento.baseURI))
          .then((respuesta) =>
            respuesta.ok ? (respuesta.json() as Promise<ProvinciasDeBolivia>) : null,
          )
          .catch(() => null)
          .then((provincias) => {
            if (provincias === null) {
              pedido = null;
            }
            return provincias;
          });
        return pedido;
      };
    },
  },
);

/** Si el punto cae dentro del anillo (rayo hacia el este, regla par-impar). */
function dentroDelAnillo(lng: number, lat: number, anillo: Anillos[number]): boolean {
  let adentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      adentro = !adentro;
    }
  }
  return adentro;
}

function dentroDelPoligono(lng: number, lat: number, anillos: Anillos): boolean {
  const [exterior, ...huecos] = anillos;
  return (
    exterior !== undefined &&
    dentroDelAnillo(lng, lat, exterior) &&
    !huecos.some((hueco) => dentroDelAnillo(lng, lat, hueco))
  );
}

/** La provincia donde cae el punto, o `null` si cae fuera de Bolivia. */
export function provinciaEn(provincias: ProvinciasDeBolivia, punto: PuntoGeo): ProvinciaGeo | null {
  for (const provincia of provincias.features) {
    const { geometry } = provincia;
    const poligonos = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    if (poligonos.some((anillos) => dentroDelPoligono(punto.lng, punto.lat, anillos))) {
      return provincia;
    }
  }
  return null;
}
