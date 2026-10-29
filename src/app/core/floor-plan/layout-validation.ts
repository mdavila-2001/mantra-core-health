/* ============================================================================
    Validación local del dibujo — la «ayuda inmediata» del editor.

    Reproduce, con la geometría de `geometry.ts`, las invariantes del plano que
    el servidor garantiza (INV-PL-02…05 y 08): geometría válida, dentro del
    lienzo, hermanos sin solape, hijo dentro del padre, padre ya dibujado y
    abertura dentro de su muro. **La autoridad es `dryRun` + el guardado**
    (CONTRATO-PLANO §5.3): este resultado pinta el error mientras se arrastra;
    si discrepa con la API, gana la API.
    ========================================================================== */

import {
  bboxInflate,
  bboxOf,
  containedWithin,
  contactOverlapArea,
  polylineLength,
  spillArea,
  validatePolygon,
  withinCanvas,
  type Point,
} from './geometry';
import { defaultCellSize, GridIndex } from './spatial-index';

export interface LayoutShape {
  readonly spaceId: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly vertices: readonly Point[];
}

export interface LayoutWall {
  readonly id: string;
  readonly vertices: readonly Point[];
}

export interface LayoutOpening {
  readonly id: string;
  readonly hostId: string;
  readonly offsetM: number;
  readonly widthM: number;
}

export interface LayoutValidationInput {
  readonly canvas: {
    readonly widthM: number;
    readonly heightM: number;
    readonly contactToleranceM: number;
    /** Espacio ancla del lienzo (su hijo directo no necesita padre dibujado). `null` en el campus. */
    readonly anchorSpaceId: string | null;
  };
  readonly shapes: readonly LayoutShape[];
  readonly walls?: readonly LayoutWall[];
  readonly openings?: readonly LayoutOpening[];
  /** Ids de espacios del árbol que son raíces (sin padre). */
  readonly rootsAllowedWithoutParent?: boolean;
}

export type LayoutIssueCode =
  | 'PLAN_SIBLING_OVERLAP'
  | 'PLAN_CHILD_OUTSIDE_PARENT'
  | 'PLAN_OUT_OF_BOUNDS'
  | 'PLAN_GEOMETRY_INVALID'
  | 'PLAN_PARENT_NOT_PLACED'
  | 'PLAN_OPENING_OUTSIDE_WALL'
  | 'PLAN_HOST_NOT_WALL';

export interface LayoutIssueConflict {
  readonly kind: 'SPACE' | 'ELEMENT';
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly overlapAreaM2?: number;
}

export interface LayoutIssue {
  readonly kind: 'SPACE' | 'ELEMENT' | 'CANVAS';
  readonly id: string;
  readonly code: LayoutIssueCode;
  readonly field: 'geometry' | 'parent' | 'host' | 'size';
  readonly message: string;
  readonly conflictsWith?: readonly LayoutIssueConflict[];
  readonly nextAction?: { readonly label: string; readonly hint: string };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Valida el dibujo completo (o solo lo que toca `focusIds`, que es lo que hace
 * falta mientras se arrastra uno o dos locales).
 */
export function validateLayout(input: LayoutValidationInput, focusIds?: ReadonlySet<string>): LayoutIssue[] {
  const { canvas, shapes } = input;
  const issues: LayoutIssue[] = [];
  const bySpace = new Map(shapes.map((shape) => [shape.spaceId, shape]));
  const wanted = (id: string): boolean => focusIds === undefined || focusIds.has(id);

  const validShapes = shapes.filter((shape) => validatePolygon(shape.vertices) === null);
  for (const shape of shapes) {
    if (!wanted(shape.spaceId)) continue;
    const problem = validatePolygon(shape.vertices);
    if (problem !== null) {
      issues.push({
        kind: 'SPACE',
        id: shape.spaceId,
        code: 'PLAN_GEOMETRY_INVALID',
        field: 'geometry',
        message: `La figura de ${shape.code} no es válida (${describeProblem(problem)}).`,
        nextAction: { label: 'Corregir la figura', hint: 'Use un rectángulo o un polígono simple, sin cruces ni vértices repetidos.' },
      });
    }
  }

  // Límites del lienzo (INV-PL-03).
  for (const shape of validShapes) {
    if (!wanted(shape.spaceId)) continue;
    if (!withinCanvas(shape.vertices, canvas.widthM, canvas.heightM, canvas.contactToleranceM)) {
      issues.push({
        kind: 'SPACE',
        id: shape.spaceId,
        code: 'PLAN_OUT_OF_BOUNDS',
        field: 'geometry',
        message: `${shape.code} se sale del lienzo (${canvas.widthM} × ${canvas.heightM} m).`,
        nextAction: { label: 'Moverlo dentro del lienzo', hint: 'Arrástrelo hacia adentro o agrande el lienzo.' },
      });
    }
  }

  // Padre dibujado y contención (INV-PL-05).
  for (const shape of validShapes) {
    if (!wanted(shape.spaceId) && !(shape.parentId !== null && wanted(shape.parentId))) continue;
    if (shape.parentId === null) continue;
    const parent = bySpace.get(shape.parentId);
    if (parent === undefined) {
      if (shape.parentId !== canvas.anchorSpaceId && wanted(shape.spaceId)) {
        issues.push({
          kind: 'SPACE',
          id: shape.spaceId,
          code: 'PLAN_PARENT_NOT_PLACED',
          field: 'parent',
          message: `${shape.code} no puede dibujarse: su espacio padre todavía no está en este plano.`,
          nextAction: { label: 'Ubicar primero el padre', hint: 'Dibuje el espacio que lo contiene y vuelva a ubicarlo.' },
        });
      }
      continue;
    }
    if (validatePolygon(parent.vertices) !== null) continue;
    if (!containedWithin(shape.vertices, parent.vertices, canvas.contactToleranceM)) {
      const spill = round2(spillArea(shape.vertices, parent.vertices));
      issues.push({
        kind: 'SPACE',
        id: shape.spaceId,
        code: 'PLAN_CHILD_OUTSIDE_PARENT',
        field: 'geometry',
        message: `${shape.code} sobresale de ${parent.code} (${spill} m² fuera).`,
        conflictsWith: [{ kind: 'SPACE', id: parent.spaceId, code: parent.code, name: parent.name, overlapAreaM2: spill }],
        nextAction: { label: 'Meterlo dentro de su padre', hint: `Muévalo o achíquelo para que quede dentro de ${parent.name}.` },
      });
    }
  }

  // Solape entre hermanos (INV-PL-04), con un índice para no comparar todos contra todos.
  if (validShapes.length > 1) {
    const index = new GridIndex(canvas.widthM, canvas.heightM, defaultCellSize(canvas.widthM, canvas.heightM));
    const boxes = new Map<string, readonly [number, number, number, number]>();
    for (const shape of validShapes) {
      const box = bboxOf(shape.vertices);
      boxes.set(shape.spaceId, box);
      index.insert(shape.spaceId, box);
    }
    const reported = new Set<string>();
    for (const shape of validShapes) {
      const candidates = index.query(bboxInflate(boxes.get(shape.spaceId)!, 0.001));
      const conflicts: LayoutIssueConflict[] = [];
      for (const otherId of candidates) {
        if (otherId === shape.spaceId) continue;
        const other = bySpace.get(otherId)!;
        if (other.parentId !== shape.parentId) continue;
        if (focusIds !== undefined && !focusIds.has(shape.spaceId) && !focusIds.has(otherId)) continue;
        const area = contactOverlapArea(shape.vertices, other.vertices, canvas.contactToleranceM);
        if (area > 0) {
          conflicts.push({ kind: 'SPACE', id: other.spaceId, code: other.code, name: other.name, overlapAreaM2: round2(area) });
        }
      }
      if (conflicts.length === 0) continue;
      // Un error por elemento (cada uno de los dos queda señalado), con su vecino.
      if (reported.has(shape.spaceId)) continue;
      reported.add(shape.spaceId);
      issues.push({
        kind: 'SPACE',
        id: shape.spaceId,
        code: 'PLAN_SIBLING_OVERLAP',
        field: 'geometry',
        message: `${shape.code} se solapa con ${conflicts.map((c) => c.code).join(', ')}.`,
        conflictsWith: conflicts,
        nextAction: { label: 'Separar los locales', hint: 'Dos locales pueden tocarse por la pared, pero no pisarse.' },
      });
    }
  }

  // Aberturas dentro de su muro (INV-PL-08).
  if (input.openings !== undefined && input.walls !== undefined) {
    const walls = new Map(input.walls.map((wall) => [wall.id, wall]));
    for (const opening of input.openings) {
      if (focusIds !== undefined && !focusIds.has(opening.id)) continue;
      const host = walls.get(opening.hostId);
      if (host === undefined) {
        issues.push({
          kind: 'ELEMENT',
          id: opening.id,
          code: 'PLAN_HOST_NOT_WALL',
          field: 'host',
          message: 'La abertura no está sobre un muro de este plano.',
          nextAction: { label: 'Apoyarla en un muro', hint: 'Arrastre la puerta o la ventana sobre un muro.' },
        });
        continue;
      }
      const length = polylineLength(host.vertices);
      if (opening.offsetM < -1e-6 || opening.offsetM + opening.widthM > length + 1e-6) {
        issues.push({
          kind: 'ELEMENT',
          id: opening.id,
          code: 'PLAN_OPENING_OUTSIDE_WALL',
          field: 'host',
          message: `La abertura no cabe en su muro (muro de ${round2(length)} m, abertura de ${opening.widthM} m).`,
          nextAction: { label: 'Achicarla o moverla', hint: 'Debe quedar íntegra dentro del largo del muro.' },
        });
      }
    }
  }
  return issues;
}

function describeProblem(problem: string): string {
  switch (problem) {
    case 'TOO_FEW_VERTICES':
      return 'tiene menos de tres vértices';
    case 'TOO_MANY_VERTICES':
      return 'tiene más de 64 vértices';
    case 'NON_FINITE':
      return 'tiene coordenadas fuera de rango';
    case 'REPEATED_VERTEX':
      return 'repite un vértice';
    case 'SELF_INTERSECTION':
      return 'se cruza consigo misma';
    case 'STRAIGHT_ANGLE':
      return 'tiene un vértice sobre una recta';
    case 'ZERO_AREA':
      return 'no encierra área';
    default:
      return problem;
  }
}
