/* ============================================================================
    Forma del estado de edición (CONTRATO-PLANO §5.3). Solo tipos y una constante:
    lo comparten `editor-model` y `editor-elements` sin importarse entre sí.
    ========================================================================== */

import type { DoorSwing, PlacementGeometry } from '../data-access/floor-plan/floor-plan.types';

export interface EditSpace {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly formCode: string;
  readonly geometry: PlacementGeometry;
  readonly zOrder: number;
  readonly locked: boolean;
  /** `null` = figura nueva (todavía sin fila en el servidor). */
  readonly rowVersion: number | null;
}

/** Los elementos que el editor sabe dibujar: muros, puertas y ventanas. Los demás se conservan tal cual. */
export type EditableElementKind = 'WALL' | 'DOOR' | 'WINDOW';
export const EDITABLE_ELEMENT_KINDS: readonly string[] = ['WALL', 'DOOR', 'WINDOW'];

export interface EditElement {
  readonly id: string;
  readonly kind: EditableElementKind;
  /** Eje del muro (metros). */
  readonly vertices?: readonly (readonly [number, number])[];
  readonly thicknessM?: number;
  /** Puertas y ventanas: el muro que las aloja y dónde caen sobre su eje. */
  readonly hostElementId?: string;
  readonly offsetM?: number;
  readonly widthM?: number;
  readonly swing?: DoorSwing;
  readonly swingSide?: 'A' | 'B';
  readonly zOrder: number;
  /** `null` = elemento nuevo (todavía sin fila en el servidor). */
  readonly rowVersion: number | null;
}

export interface EditState {
  readonly spaces: ReadonlyMap<string, EditSpace>;
  /** Espacios que se sacan del plano (no se borran del árbol). */
  readonly removed: ReadonlySet<string>;
  readonly elements: ReadonlyMap<string, EditElement>;
  readonly removedElements: ReadonlySet<string>;
}

