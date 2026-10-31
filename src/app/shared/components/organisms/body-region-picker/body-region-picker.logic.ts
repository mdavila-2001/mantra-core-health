import type { AnatomyLayer, AnatomyPart } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import type {
  BodyRegionCatalogEntry,
  BodyRegionMap,
  BodyRegionMesh,
  ImagingModalityCode,
  Laterality,
} from '../../../../core/data-access/anatomy-atlas/body-regions.types';
import {
  boxContains,
  MIN_INTERSECTION_M,
  withMinSize,
  type AnatomyFocus,
  type AnatomyPick,
} from '../anatomy-viewer/anatomy-focus.logic';

/** Lo único que se guarda: la región del catálogo y el lado. Nunca ids de malla. */
export interface BodyRegionValue {
  readonly region: string | null;
  readonly laterality: Laterality | null;
}

export const EMPTY_BODY_REGION: BodyRegionValue = { region: null, laterality: null };

export const LATERALITY_LABEL: Readonly<Record<Laterality, string>> = {
  IZQ: 'izquierda',
  DER: 'derecha',
  BIL: 'bilateral',
  UNI: 'un lado (sin especificar)',
};

/** Atribución obligatoria de lo que dibuja el visor y de los nombres. */
export const BODY_REGION_ATTRIBUTION = [
  {
    text: 'Modelo 3D: BodyParts3D, © The Database Center for Life Science, licencia CC BY-SA 2.1 JP',
    url: 'https://creativecommons.org/licenses/by-sa/2.1/jp/',
  },
  {
    text: 'Ontologías UBERON y FMA, licencia CC BY 3.0',
    url: 'https://creativecommons.org/licenses/by/3.0/',
  },
] as const;

/** La capa base según la modalidad; `null` = la que prefiera la región. */
const CAPA_DE_MODALIDAD: Readonly<Record<string, AnatomyLayer | null>> = {
  RX: 'skeleton',
  DXA: 'skeleton',
  BDUS: 'skeleton',
  PANORAMICA: 'skeleton',
  INTRAORAL: 'skeleton',
  CBCT: 'skeleton',
  US: 'organs',
  XA: 'vessels',
};

/**
 * Capas a dibujar: la de la modalidad y, siempre, las que tienen las mallas de
 * la región (la región se ve aunque la modalidad diga otra cosa).
 */
export function layersFor(modality: ImagingModalityCode | null, def: BodyRegionMesh | null): readonly AnatomyLayer[] {
  const base = (modality !== null ? CAPA_DE_MODALIDAD[modality] : null) ?? def?.capa ?? 'skeleton';
  const capas = new Set<AnatomyLayer>([base]);
  if (def !== null && def.tipo !== 'ninguna') for (const c of def.capas) capas.add(c);
  return [...capas];
}

/** Las mallas de la región para un lado: `IZQ`/`DER` incluyen las centrales; el resto, todo. */
export function meshesOf(def: BodyRegionMesh | null, lateral: boolean, laterality: Laterality | null): readonly string[] {
  if (def === null) return [];
  if (!lateral || laterality === null || laterality === 'BIL' || laterality === 'UNI') {
    return [...def.izq, ...def.der, ...def.centro];
  }
  return [...(laterality === 'IZQ' ? def.izq : def.der), ...def.centro];
}

/** Qué encuadrar para la región y el lado. `null` si no hay nada que mostrar. */
export function focusFor(def: BodyRegionMesh | null, lateral: boolean, laterality: Laterality | null): AnatomyFocus | null {
  if (def === null) return null;
  const e = def.encuadre;
  const unLado = lateral && (laterality === 'IZQ' || laterality === 'DER');
  if (e !== null && unLado) {
    return { mode: e.modo === 'interseccion' ? 'intersection' : 'union', groups: laterality === 'IZQ' ? e.izq : e.der };
  }
  const todas = meshesOf(def, lateral, laterality);
  return todas.length === 0 ? null : { mode: 'union', groups: [todas] };
}

export type TouchOutcome =
  | { readonly kind: 'chosen'; readonly value: BodyRegionValue }
  | { readonly kind: 'not-allowed'; readonly region: string }
  | { readonly kind: 'select-only' }
  | { readonly kind: 'none' };

function sideOfPart(part: AnatomyPart | undefined): 'izq' | 'der' | null {
  return part?.side === 'left' ? 'izq' : part?.side === 'right' ? 'der' : null;
}

/** Si el punto tocado cae en la caja de una articulación que incluye esa malla, gana la articulación. */
function jointAt(map: BodyRegionMap, pick: AnatomyPick, side: 'izq' | 'der' | null): { region: string; side: 'izq' | 'der' } | null {
  let mejor: { region: string; side: 'izq' | 'der'; volumen: number } | null = null;
  for (const [codigo, r] of Object.entries(map.regiones)) {
    const e = r.encuadre;
    if (r.tocar !== 'punto' || e === null || e.modo !== 'interseccion') continue;
    if (![...r.izq, ...r.der, ...r.centro].includes(pick.meshId)) continue;
    for (const lado of side === null ? (['izq', 'der'] as const) : [side]) {
      const caja = withMinSize(e.caja[lado], MIN_INTERSECTION_M);
      if (!boxContains(caja, pick.point)) continue;
      const volumen = (caja[3] - caja[0]) * (caja[4] - caja[1]) * (caja[5] - caja[2]);
      if (mejor === null || volumen < mejor.volumen) mejor = { region: codigo, side: lado, volumen };
    }
  }
  return mejor;
}

/**
 * Qué cambia al tocar el modelo. Puro: no escribe nada, devuelve el resultado
 * y quien lo llama decide. La lateralidad sale del `side` de la malla (lado
 * del paciente) y sólo si la región es lateral; si la malla es central
 * conserva la que había. Nunca devuelve `BIL`: bilateral se elige a mano.
 */
export function resolveTouch(args: {
  readonly pick: AnatomyPick;
  readonly map: BodyRegionMap;
  readonly partById: ReadonlyMap<string, AnatomyPart>;
  readonly catalog: ReadonlyMap<string, BodyRegionCatalogEntry>;
  readonly allowed: ReadonlySet<string>;
  readonly current: BodyRegionValue;
}): TouchOutcome {
  const { pick, map, partById, catalog, allowed, current } = args;
  const lado = sideOfPart(partById.get(pick.meshId));
  const articulacion = jointAt(map, pick, lado);
  const region = articulacion?.region ?? map.regionDeMalla.get(pick.meshId) ?? null;
  if (region === null || !catalog.has(region)) return { kind: 'none' };
  if (map.regiones[region]?.tocar === 'solo_select') return { kind: 'select-only' };
  if (allowed.size > 0 && !allowed.has(region)) return { kind: 'not-allowed', region };
  if (catalog.get(region)?.admite_lateralidad !== true) return { kind: 'chosen', value: { region, laterality: null } };
  const efectivo = lado ?? articulacion?.side ?? null;
  const laterality: Laterality | null =
    efectivo === 'izq' ? 'IZQ' : efectivo === 'der' ? 'DER' : current.laterality;
  return { kind: 'chosen', value: { region, laterality } };
}

/** Al elegir desde la lista: conserva el lado sólo si la región nueva es lateral. */
export function afterSelect(region: string | null, catalog: ReadonlyMap<string, BodyRegionCatalogEntry>, current: BodyRegionValue): BodyRegionValue {
  if (region === null) return EMPTY_BODY_REGION;
  const lateral = catalog.get(region)?.admite_lateralidad === true;
  return { region, laterality: lateral ? current.laterality : null };
}

/** La región raíz de cada una (CABEZA para ORBITA), con cuidado de ciclos. */
export function rootOf(codigo: string, catalog: ReadonlyMap<string, BodyRegionCatalogEntry>): string | null {
  let actual = codigo;
  for (let i = 0; i < 8; i++) {
    const padre = catalog.get(actual)?.padre ?? null;
    if (padre === null) return actual;
    if (!catalog.has(padre)) return null;
    actual = padre;
  }
  return null;
}

export interface RegionGroup {
  readonly label: string;
  readonly items: readonly { readonly value: string; readonly label: string; readonly hint?: string }[];
}

/**
 * Las regiones permitidas, agrupadas por su región raíz. La raíz es también
 * una región elegible (primera de su grupo, «Cabeza (completa)»).
 */
export function groupRegions(
  regions: readonly BodyRegionCatalogEntry[],
  allowed: ReadonlySet<string>,
  map: BodyRegionMap | null,
): readonly RegionGroup[] {
  const catalog = new Map(regions.map((r) => [r.codigo, r]));
  const grupos = new Map<string, { label: string; items: { value: string; label: string; hint?: string }[] }>();
  for (const r of regions) {
    if (allowed.size > 0 && !allowed.has(r.codigo)) continue;
    const raiz = rootOf(r.codigo, catalog) ?? '__otras';
    const etiqueta = raiz === '__otras' ? 'Otras' : (catalog.get(raiz)?.nombre ?? raiz);
    const grupo = grupos.get(raiz) ?? { label: etiqueta, items: [] };
    grupos.set(raiz, grupo);
    const sinModelo = map !== null && (map.regiones[r.codigo]?.tipo ?? 'ninguna') !== 'propia';
    grupo.items.push({
      value: r.codigo,
      label: r.codigo === raiz ? `${r.nombre} (completa)` : r.nombre,
      ...(sinModelo ? { hint: 'sin modelo 3D' } : {}),
    });
  }
  return [...grupos.values()];
}

/** Lo que se dice de la región elegida, para quien no ve el lienzo. */
export function describeRegion(
  value: BodyRegionValue,
  entry: BodyRegionCatalogEntry | null,
  def: BodyRegionMesh | null,
  mapReady: boolean,
): string {
  if (value.region === null || entry === null) return 'Ninguna región elegida.';
  const lado = value.laterality === null ? '' : `, ${LATERALITY_LABEL[value.laterality]}`;
  const base = `Región: ${entry.nombre}${lado}.`;
  const nota = noteOf(def, mapReady, entry.nombre);
  return nota === null ? base : `${base} ${nota}`;
}

/** El aviso de una región sin malla propia; `null` si tiene modelo (o no se sabe aún). */
export function noteOf(def: BodyRegionMesh | null, mapReady: boolean, nombre: string): string | null {
  if (!mapReady || def === null) return null;
  switch (def.tipo) {
    case 'contenedora':
      return `${nombre} no tiene modelo 3D propio: se muestra la zona que la contiene.`;
    case 'referencia':
      return `${nombre} no tiene modelo 3D: se muestra una estructura vecina como referencia aproximada.`;
    case 'ninguna':
      return `${nombre} no tiene modelo 3D: se elige desde la lista.`;
    default:
      return null;
  }
}
