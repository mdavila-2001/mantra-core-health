/* ============================================================================
    De un punto del mapa al lugar donde cae: departamento, provincia, municipio.

    Lo usa el alta cuando alguien toca el mapa: el formulario de dirección
    aparece **ya lleno**. No sale a la red ni a un geocodificador externo (la
    política de seguridad del servidor no lo permite, ver
    `src/server/security-headers.ts`): cruza el punto con los límites que el
    producto ya trae, que son datos públicos de GeoBolivia.

    | Qué | De dónde |
    |---|---|
    | Provincia y su departamento | `public/geo/bolivia-provincias.geojson` (ADM2), el mismo que dibuja el mapa |
    | Municipio | `bolivia-municipalities.geometry.ts` (ADM3, código INE `DDPPMM`) |

    ## Por qué el departamento sale de la provincia y no del municipio

    Los contornos municipales están simplificados a ~2 km; los de provincia, a
    4 decimales. Cerca de un límite departamental los dos pueden discrepar, y un
    domicilio con el municipio de un departamento y la provincia de otro es
    peor que un campo vacío. Por eso manda la provincia —el departamento es el
    suyo— y el municipio se busca **dentro** de ese departamento. Si las
    provincias no cargaron, el departamento sale del municipio que contiene el
    punto.

    ## Qué no hace

    Ni el **distrito** ni la **calle** salen de acá: no hay una capa de
    distritos municipales ni un nomenclátor de calles en el producto. Esos dos
    los escribe la persona.
    ========================================================================== */

import type { Municipio, RamaDepartamento } from '@core/data-access/terminology/bo-municipalities.service';
import type { PuntoGeo } from '@shared/components/organisms/map/map-pin.types';
import {
  provinceIn,
  type CargadorDeProvincias,
  type ProvinciasDeBolivia,
} from '@shared/components/organisms/map/provinces';

import { normalizePlace } from './city-department';

/** Lo que se pudo saber de un punto. Cada parte es `null` si no se pudo. */
export interface UbicacionResuelta {
  readonly departamento: RamaDepartamento | null;
  /** El nombre de la provincia, tal como lo trae la capa ADM2. */
  readonly provincia: string | null;
  readonly municipio: Municipio | null;
}

/** Sin nada resuelto: el punto cae fuera de Bolivia o no hay datos. */
export const UBICACION_VACIA: UbicacionResuelta = {
  departamento: null,
  provincia: null,
  municipio: null,
};

type Anillo = readonly (readonly [number, number])[];

/** Un contorno ya leído: sus anillos y la caja que los encierra. */
interface ContornoLeido {
  readonly ine: string;
  readonly sigla: string;
  readonly nombre: string;
  readonly x: number;
  readonly y: number;
  readonly anillos: readonly Anillo[];
  readonly caja: readonly [number, number, number, number];
}

let contornosLeidos: Promise<{
  readonly contornos: readonly ContornoLeido[];
  readonly proyectar: (punto: PuntoGeo) => { x: number; y: number };
  readonly desproyectar: (x: number, y: number) => PuntoGeo;
}> | null = null;

/**
 * Lee los contornos municipales **una vez** (~107 kB, por import dinámico) y
 * arma la proyección del punto al mismo plano en que están dibujados.
 */
function cargarContornos(): NonNullable<typeof contornosLeidos> {
  contornosLeidos ??= import('@shared/components/organisms/department-map/bolivia-municipalities.geometry').then(
    (modulo) => {
      const p = modulo.PROYECCION_DE_BOLIVIA;
      return {
        contornos: modulo.CONTORNOS_DE_MUNICIPIOS.map(leerContorno),
        proyectar: (punto: PuntoGeo) => ({
          x: (punto.lng - p.lng0) * p.coseno * p.escala,
          y: (p.lat1 - punto.lat) * p.escala,
        }),
        desproyectar: (x: number, y: number) => ({
          lng: x / (p.coseno * p.escala) + p.lng0,
          lat: p.lat1 - y / p.escala,
        }),
      };
    },
  );
  return contornosLeidos;
}

/** Un `d` hecho sólo de `M`, `L` y `Z` con pares `x y`, a sus anillos. */
function leerContorno(c: {
  ine: string;
  sigla: string;
  nombre: string;
  x: number;
  y: number;
  d: string;
}): ContornoLeido {
  const anillos = c.d
    .split(/(?=M)/)
    .map((trozo) => {
      const cifras = trozo.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      const puntos: [number, number][] = [];
      for (let i = 0; i + 1 < cifras.length; i += 2) puntos.push([cifras[i], cifras[i + 1]]);
      return puntos;
    })
    .filter((anillo) => anillo.length >= 3);
  const xs = anillos.flatMap((a) => a.map((p) => p[0]));
  const ys = anillos.flatMap((a) => a.map((p) => p[1]));
  return {
    ine: c.ine,
    sigla: c.sigla,
    nombre: c.nombre,
    x: c.x,
    y: c.y,
    anillos,
    caja: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  };
}

/** Par-impar sobre un anillo: el rayo hacia el este. */
function dentroDelAnillo(x: number, y: number, anillo: Anillo): boolean {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function contiene(contorno: ContornoLeido, x: number, y: number): boolean {
  const [x0, y0, x1, y1] = contorno.caja;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  return contorno.anillos.some((anillo) => dentroDelAnillo(x, y, anillo));
}

/** El departamento del catálogo que se llama como la provincia dice. */
function ramaPorNombre(
  ramas: readonly RamaDepartamento[],
  nombre: string,
): RamaDepartamento | null {
  const buscado = normalizePlace(nombre);
  return ramas.find((r) => normalizePlace(r.nombre) === buscado) ?? null;
}

/** El municipio del catálogo que corresponde a un contorno: por INE, y si no por nombre. */
function municipioDelCatalogo(rama: RamaDepartamento, contorno: ContornoLeido): Municipio | null {
  const porIne = rama.municipios.find((m) => m.ine === contorno.ine);
  if (porIne !== undefined) return porIne;
  const nombre = normalizePlace(contorno.nombre);
  return rama.municipios.find((m) => normalizePlace(m.nombre) === nombre) ?? null;
}

/**
 * Dice dónde cae un punto.
 *
 * Nunca lanza: si algo no se puede leer (las provincias no bajaron, el punto
 * está fuera del país) devuelve lo que sí supo y deja el resto en `null`. Quien
 * lo llama muestra el formulario igual, con los selects para completar a mano.
 *
 * @param punto - Latitud y longitud, como las da el mapa.
 * @param ramas - Los departamentos del catálogo, con sus municipios.
 * @param cargarProvincias - De dónde salen las provincias (el token del mapa).
 */
export async function resolverUbicacion(
  punto: PuntoGeo,
  ramas: readonly RamaDepartamento[],
  cargarProvincias: CargadorDeProvincias,
): Promise<UbicacionResuelta> {
  let provincias: ProvinciasDeBolivia | null;
  try {
    provincias = await cargarProvincias();
  } catch {
    provincias = null;
  }
  const provincia = provincias === null ? null : provinceIn(provincias, punto);

  let leidos: Awaited<NonNullable<typeof contornosLeidos>>;
  try {
    leidos = await cargarContornos();
  } catch {
    contornosLeidos = null;
    const departamento =
      provincia === null ? null : ramaPorNombre(ramas, provincia.properties.departamento);
    return {
      departamento,
      provincia: provincia?.properties.nombre ?? null,
      municipio: null,
    };
  }

  const { x, y } = leidos.proyectar(punto);
  const departamentoDeLaProvincia =
    provincia === null ? null : ramaPorNombre(ramas, provincia.properties.departamento);

  // Sólo se mira dentro del departamento de la provincia, si se lo conoce.
  const candidatos =
    departamentoDeLaProvincia === null
      ? leidos.contornos
      : leidos.contornos.filter((c) => c.sigla === departamentoDeLaProvincia.sigla);

  let contorno = candidatos.find((c) => contiene(c, x, y)) ?? null;
  if (contorno === null && provincia !== null) {
    // Dentro de la provincia pero fuera de todo contorno (los contornos están
    // simplificados y dejan rendijas, y algunos municipios no cruzaron con el
    // catálogo): se toma el de punto interior más cercano.
    let mejor = Number.POSITIVE_INFINITY;
    for (const c of candidatos) {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < mejor) {
        mejor = d;
        contorno = c;
      }
    }
  }

  const departamento =
    departamentoDeLaProvincia ??
    (contorno === null ? null : (ramas.find((r) => r.sigla === contorno.sigla) ?? null));
  const municipio =
    contorno === null || departamento === null ? null : municipioDelCatalogo(departamento, contorno);

  return {
    departamento,
    provincia: provincia?.properties.nombre ?? null,
    municipio,
  };
}

/**
 * La provincia de un municipio elegido a mano en el select.
 *
 * Cuando la persona corrige el municipio que dedujo el mapa, la provincia que
 * se mostró ya no vale. Se la vuelve a deducir con el punto interior del
 * contorno del municipio nuevo, que por construcción cae dentro de él.
 *
 * @returns El nombre de la provincia, o `null` si no se pudo saber.
 */
export async function provinciaDeMunicipio(
  municipio: Municipio,
  siglaDelDepartamento: string,
  cargarProvincias: CargadorDeProvincias,
): Promise<string | null> {
  try {
    const [provincias, leidos] = await Promise.all([cargarProvincias(), cargarContornos()]);
    if (provincias === null) return null;
    const nombre = normalizePlace(municipio.nombre);
    const contorno = leidos.contornos.find(
      (c) =>
        c.sigla === siglaDelDepartamento &&
        (c.ine === municipio.ine || normalizePlace(c.nombre) === nombre),
    );
    if (contorno === undefined) return null;
    const punto = leidos.desproyectar(contorno.x, contorno.y);
    return provinceIn(provincias, punto)?.properties.nombre ?? null;
  } catch {
    return null;
  }
}
