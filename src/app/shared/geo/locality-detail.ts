import { normalizePlace } from './city-department';
import type { PuntoGeo } from '../components/organisms/map/map-pin.types';
import {
  provinceIn,
  type ProvinciasDeBolivia,
} from '../components/organisms/map/provinces';

/**
 * Lo que se sabe de una localidad sin salir a la red: su departamento, su
 * provincia y su municipio.
 *
 * El departamento y el municipio los trae el catálogo; la **provincia** no está
 * en ningún catálogo del producto, así que se deduce del dibujo: el punto
 * interior del contorno del municipio (que cae lejos de su borde) se busca
 * entre las 112 provincias de `public/geo/bolivia-provincias.geojson`. Es la
 * misma fuente que ya dibuja las provincias en el mapa, no un dato nuevo.
 */
export interface LocalityDetail {
  readonly departamento: string;
  /** `null` cuando no se pudo deducir: el formulario lo dice, no lo inventa. */
  readonly provincia: string | null;
  readonly municipio: string;
}

/** Lo mínimo del contorno de un municipio que hace falta para ubicarlo. */
export interface MunicipalityOutlineRef {
  readonly ine: string;
  readonly sigla: string;
  readonly nombre: string;
  readonly x: number;
  readonly y: number;
}

/** La proyección del `viewBox` de las siluetas (ver `bolivia-municipalities.geometry`). */
export interface ProjectionOfBolivia {
  readonly lng0: number;
  readonly lat1: number;
  readonly coseno: number;
  readonly escala: number;
}

/** Del `viewBox` a latitud/longitud: la inversa de la proyección de las siluetas. */
export function unproject(x: number, y: number, p: ProjectionOfBolivia): PuntoGeo {
  return { lng: x / (p.coseno * p.escala) + p.lng0, lat: p.lat1 - y / p.escala };
}

/**
 * Busca el contorno de un municipio: por código INE (`DDPPMM`) dentro de su
 * departamento y, si el catálogo trae un código legado (la maqueta siembra
 * `SC-SCZ`), por nombre normalizado dentro de ese mismo departamento.
 */
export function findOutline<T extends MunicipalityOutlineRef>(
  contornos: readonly T[],
  sigla: string,
  ine: string,
  nombre: string,
): T | null {
  if (/^\d{6}$/.test(ine)) {
    const porIne = contornos.find((c) => c.ine === ine && c.sigla === sigla);
    if (porIne !== undefined) return porIne;
  }
  const buscado = normalizePlace(nombre);
  return contornos.find((c) => c.sigla === sigla && normalizePlace(c.nombre) === buscado) ?? null;
}

/**
 * La provincia de un municipio, o `null` si no hay contorno ni provincias con
 * qué deducirla.
 */
export function provinceOfMunicipality(
  provincias: ProvinciasDeBolivia | null,
  contorno: MunicipalityOutlineRef | null,
  proyeccion: ProjectionOfBolivia,
): string | null {
  if (provincias === null || contorno === null) return null;
  const punto = unproject(contorno.x, contorno.y, proyeccion);
  return provinceIn(provincias, punto)?.properties.nombre ?? null;
}

/** Lo mínimo del contorno para decidir si un punto cae adentro. */
export interface MunicipalityOutline extends MunicipalityOutlineRef {
  /** Trazado SVG absoluto (`M`, `L`, `Z`) en coordenadas del `viewBox`. */
  readonly d: string;
}

/** Los anillos de un trazado `M…L…Z` como listas de vértices. */
function ringsOf(d: string): readonly (readonly [number, number])[][] {
  const anillos: [number, number][][] = [];
  for (const tramo of d.split('M').filter((t) => t.trim() !== '')) {
    const cifras = tramo.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const anillo: [number, number][] = [];
    for (let i = 0; i + 1 < cifras.length; i += 2) anillo.push([cifras[i]!, cifras[i + 1]!]);
    if (anillo.length >= 3) anillos.push(anillo);
  }
  return anillos;
}

/** Par-impar (ray casting): si el punto cae dentro del anillo. */
function insideRing(x: number, y: number, anillo: readonly (readonly [number, number])[]): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]!;
    const [xj, yj] = anillo[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/**
 * El municipio donde cae un punto GPS, o `null` si no cae en ninguno.
 *
 * Es lo que permite que «Usar mi ubicación» marque también el municipio en el
 * mapa (pedido del cliente del 26/10/2026), sin salir a la red: el punto se
 * proyecta al `viewBox` de las siluetas y se busca el contorno que lo contiene.
 * Los contornos están simplificados a ~2 km, así que un punto pegado a un
 * límite puede caer en el vecino: por eso el municipio queda **elegido, no
 * bloqueado** — la persona lo corrige en el desplegable si hace falta.
 */
export function municipalityAt<T extends MunicipalityOutline>(
  contornos: readonly T[],
  punto: PuntoGeo,
  proyeccion: ProjectionOfBolivia,
): T | null {
  const x = (punto.lng - proyeccion.lng0) * proyeccion.coseno * proyeccion.escala;
  const y = (proyeccion.lat1 - punto.lat) * proyeccion.escala;
  return contornos.find((c) => ringsOf(c.d).some((anillo) => insideRing(x, y, anillo))) ?? null;
}
