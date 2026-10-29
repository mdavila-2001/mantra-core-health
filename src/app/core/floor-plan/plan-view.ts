/* ============================================================================
    Del DTO de la API al modelo de dibujo: contornos, rutas SVG, aberturas
    resueltas sobre su muro y orden de pintado (CONTRATO-PLANO §5.5).

    Todo en metros. Sin Angular ni DOM: se prueba con datos.
    ========================================================================== */

import type { PlacementCard, PlanElementDTO, PlanElementKind, SpacePlacementDTO } from '../data-access/floor-plan/floor-plan.types';
import { bboxCenter, pointAlongPolyline, rectVertices, type BBox, type Point } from './geometry';

export type SpaceBand = 'zone' | 'room' | 'bed';

export interface SpaceView {
  readonly id: string;
  readonly placementId: string;
  readonly rowVersion: number;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly formCode: string;
  readonly functionCode: string;
  readonly inScope: boolean;
  readonly locked: boolean;
  readonly zOrder: number;
  readonly vertices: readonly Point[];
  readonly bbox: BBox;
  readonly center: Point;
  readonly areaCalcM2: number;
  readonly path: string;
  readonly band: SpaceBand;
  readonly inFocus: boolean | undefined;
  readonly card: PlacementCard | undefined;
  readonly isRect: boolean;
}

/** Banda de pintura de un espacio según su forma (§5.5: zonas → locales → camas). */
export function bandOf(formCode: string | undefined): SpaceBand {
  switch (formCode) {
    case 'BUILDING':
    case 'LEVEL':
    case 'AREA':
    case 'WARD':
      return 'zone';
    case 'BED':
      return 'bed';
    default:
      return 'room';
  }
}

const num = (value: number): string => String(Math.round(value * 1000) / 1000);

/** `M x y L x y … Z` en metros. */
export function pathOf(vertices: readonly Point[], closed = true): string {
  if (vertices.length === 0) return '';
  const body = vertices.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${num(x)} ${num(y)}`).join(' ');
  return closed ? `${body} Z` : body;
}

export function verticesOfGeometry(geometry: SpacePlacementDTO['geometry']): Point[] {
  return geometry.kind === 'RECT'
    ? rectVertices(geometry.centerXM, geometry.centerYM, geometry.widthM, geometry.depthM, geometry.rotationDeg)
    : geometry.vertices.map(([x, y]) => [x, y] as Point);
}

export function toSpaceView(dto: SpacePlacementDTO): SpaceView {
  const vertices = verticesOfGeometry(dto.geometry);
  const bbox = dto.bbox as BBox;
  const formCode = dto.form?.code ?? '';
  return {
    id: dto.spaceId,
    placementId: dto.placementId,
    rowVersion: dto.rowVersion,
    code: dto.code ?? '',
    name: dto.name ?? '',
    parentId: dto.parentId ?? null,
    formCode,
    functionCode: dto.function?.code ?? '',
    inScope: dto.inScope,
    locked: dto.locked,
    zOrder: dto.zOrder,
    vertices,
    bbox,
    center: bboxCenter(bbox),
    areaCalcM2: dto.areaCalcM2,
    path: pathOf(vertices),
    band: dto.inScope ? bandOf(formCode) : 'zone',
    inFocus: dto.inFocus,
    card: dto.card,
    isRect: dto.geometry.kind === 'RECT',
  };
}

/** Orden de pintado dentro de la capa de espacios: banda, luego `zOrder`, luego `id` (estable). */
export function paintOrder(spaces: readonly SpaceView[]): SpaceView[] {
  const rank: Record<SpaceBand, number> = { zone: 0, room: 1, bed: 2 };
  return [...spaces].sort((a, b) => rank[a.band] - rank[b.band] || a.zOrder - b.zOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/* ---- elementos --------------------------------------------------------------- */

export interface OpeningGeometry {
  /** Centro de la abertura sobre el eje del muro. */
  readonly center: Point;
  readonly tangent: Point;
  readonly normal: Point;
  readonly widthM: number;
  readonly thicknessM: number;
  /** Bisagra y extremo libre de la hoja de una puerta. */
  readonly hinge: Point;
  readonly leafEnd: Point;
  /** Arco de apertura. */
  readonly arc: string;
  /** Boquete en el muro: un segmento corto con el espesor del muro. */
  readonly gap: string;
}

export interface ElementView {
  readonly id: string;
  readonly kind: PlanElementKind;
  readonly zOrder: number;
  readonly rowVersion: number;
  readonly label: string | undefined;
  readonly path: string | undefined;
  readonly vertices: readonly Point[];
  readonly thicknessM: number | undefined;
  readonly widthM: number | undefined;
  readonly swing: PlanElementDTO['swing'];
  readonly hostId: string | undefined;
  readonly verticalLinkCode: string | undefined;
  readonly opening: OpeningGeometry | undefined;
  readonly connects: string | null | undefined;
}

function resolveOpening(el: PlanElementDTO, host: PlanElementDTO | undefined): OpeningGeometry | undefined {
  if (!host?.vertices || el.offsetM === undefined || el.widthM === undefined) return undefined;
  const wallVertices = host.vertices as readonly Point[];
  const startPoint = pointAlongPolyline(wallVertices, el.offsetM);
  const endPoint = pointAlongPolyline(wallVertices, el.offsetM + el.widthM);
  if (!startPoint || !endPoint) return undefined;
  const dx = endPoint.point[0] - startPoint.point[0];
  const dy = endPoint.point[1] - startPoint.point[1];
  const length = Math.hypot(dx, dy) || 1;
  const tangent: Point = [dx / length, dy / length];
  // A = lado derecho del recorrido del muro; en un lazo horario es el interior del local.
  const side = el.swingSide === 'B' ? -1 : 1;
  const normal: Point = [-tangent[1] * side, tangent[0] * side];
  const thickness = host.thicknessM ?? 0.12;
  const center: Point = [(startPoint.point[0] + endPoint.point[0]) / 2, (startPoint.point[1] + endPoint.point[1]) / 2];
  const left = el.swing === 'RIGHT' ? false : true;
  const hinge = left ? startPoint.point : endPoint.point;
  const free = left ? endPoint.point : startPoint.point;
  const dir: Point = left ? tangent : [-tangent[0], -tangent[1]];
  const leafEnd: Point = [hinge[0] + normal[0] * el.widthM, hinge[1] + normal[1] * el.widthM];
  // Arco de 90° desde el extremo libre cerrado hasta la hoja abierta.
  const sweep = (dir[0] * normal[1] - dir[1] * normal[0]) > 0 ? 0 : 1;
  const arc = `M${num(free[0])} ${num(free[1])} A${num(el.widthM)} ${num(el.widthM)} 0 0 ${sweep} ${num(leafEnd[0])} ${num(leafEnd[1])}`;
  return {
    center, tangent, normal, widthM: el.widthM, thicknessM: thickness, hinge, leafEnd, arc,
    gap: `M${num(startPoint.point[0])} ${num(startPoint.point[1])} L${num(endPoint.point[0])} ${num(endPoint.point[1])}`,
  };
}

export function toElementViews(dtos: readonly PlanElementDTO[]): ElementView[] {
  const byId = new Map(dtos.map((d) => [d.id, d]));
  return dtos.map((el) => {
    const vertices = (el.vertices ?? []) as readonly Point[];
    const hosted = el.kind === 'DOOR' || el.kind === 'WINDOW' || el.kind === 'OPENING';
    const closed = el.kind === 'CIRCULATION' || el.kind === 'STAIRS' || el.kind === 'ELEVATOR' || el.kind === 'COLUMN';
    return {
      id: el.id,
      kind: el.kind,
      zOrder: el.zOrder,
      rowVersion: el.rowVersion,
      label: el.label,
      path: vertices.length > 0 && el.kind !== 'ANNOTATION' ? pathOf(vertices, closed) : undefined,
      vertices,
      thicknessM: el.thicknessM,
      widthM: el.widthM,
      swing: el.swing,
      hostId: el.hostElementId,
      verticalLinkCode: el.verticalLinkCode,
      opening: hosted ? resolveOpening(el, el.hostElementId ? byId.get(el.hostElementId) : undefined) : undefined,
      connects: el.connectsSpaceAId,
    };
  });
}

/** Bandas de elementos según §5.5: circulación abajo, luego verticales, muros, ventanas y puertas, y anotaciones. */
export const ELEMENT_LAYER: Readonly<Record<PlanElementKind, 'circulation' | 'vertical' | 'walls' | 'openings' | 'labels'>> = {
  CIRCULATION: 'circulation',
  COLUMN: 'walls',
  WALL: 'walls',
  STAIRS: 'vertical',
  ELEVATOR: 'vertical',
  WINDOW: 'openings',
  DOOR: 'openings',
  OPENING: 'openings',
  ANNOTATION: 'labels',
};

export function sortedElements(elements: readonly ElementView[], layer: (typeof ELEMENT_LAYER)[PlanElementKind]): ElementView[] {
  return elements
    .filter((e) => ELEMENT_LAYER[e.kind] === layer)
    .sort((a, b) => a.zOrder - b.zOrder || (a.id < b.id ? -1 : 1));
}
