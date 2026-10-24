import type {
  ProvinceRings as Anillos,
  ProvinciaGeo,
  ProvinciasDeBolivia,
} from '../../../../core/data-access/geo/bolivia-provinces.client';
import type { PuntoGeo } from './pin-mapa.types';

export {
  CARGADOR_DE_PROVINCIAS,
  RUTA_DE_PROVINCIAS,
  type CargadorDeProvincias,
  type GeometriaDeProvincia,
  type ProvinciaGeo,
  type ProvinciasDeBolivia,
} from '../../../../core/data-access/geo/bolivia-provinces.client';

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
