import { OVERRIDE_MIN_LENGTH } from './adt.catalog';
import type {
  AdmissionRequest,
  BedBoardCell,
  CompatibilityViolation,
  OverrideRequest,
} from './adt.types';

/* ============================================================================
    Lógica pura de internación que la pantalla necesita para NO ofrecer lo que
    se sabe inválido. No decide nada: la API vuelve a validar cada regla.
    ========================================================================== */

/** Largo de una justificación sin contar los espacios de borde. */
export function justificationLength(text: string): number {
  return text.trim().length;
}

export function isJustificationValid(text: string): boolean {
  return justificationLength(text) >= OVERRIDE_MIN_LENGTH;
}

/** Cuántos caracteres faltan para llegar al mínimo (0 si ya alcanza). */
export function justificationMissing(text: string): number {
  return Math.max(0, OVERRIDE_MIN_LENGTH - justificationLength(text));
}

export const blockingOf = (v: readonly CompatibilityViolation[]): readonly CompatibilityViolation[] =>
  v.filter((x) => x.severity === 'BLOCKING');

export const overridableOf = (v: readonly CompatibilityViolation[]): readonly CompatibilityViolation[] =>
  v.filter((x) => x.severity === 'OVERRIDABLE');

/** Arma el cuerpo de `override` con las reglas forzables y el texto recortado. */
export function buildOverride(
  violations: readonly CompatibilityViolation[],
  justification: string,
): OverrideRequest {
  return {
    justification: justification.trim(),
    ruleCodes: [...new Set(overridableOf(violations).map((v) => v.rule))],
  };
}

/** Omite las claves vacías: la API valida con whitelist y una clave `undefined` viaja declarada. */
export function cleanAdmission(body: AdmissionRequest): AdmissionRequest {
  const entries = Object.entries(body).filter(([, v]) => v !== undefined && v !== '');
  return Object.fromEntries(entries) as unknown as AdmissionRequest;
}

/** Las celdas que se pueden ofrecer como destino: asignables y distintas de la de origen. */
export function candidateCells(cells: readonly BedBoardCell[], excludeId?: string | null): readonly BedBoardCell[] {
  return cells.filter((cell) => cell.assignable && cell.id !== excludeId);
}

export function cellsOfBoard(board: { readonly units: readonly { readonly cells: readonly BedBoardCell[] }[] }): readonly BedBoardCell[] {
  return board.units.flatMap((u) => u.cells);
}

/** Camino legible de una cama: «Edificio A › Piso 3 › Sala 3B › Habitación 301». */
export function bedPathText(path: readonly { readonly name: string }[]): string {
  return path.map((p) => p.name).join(' › ');
}

/** Días de estancia: fecha de egreso menos fecha de ingreso, mínimo 1 (`§F3.3`). */
export function stayDays(startIso: string, endIso: string, timeZoneOffsetMin = -240): number {
  const dia = (iso: string): number => Math.floor((new Date(iso).getTime() + timeZoneOffsetMin * 60_000) / 86_400_000);
  return Math.max(1, dia(endIso) - dia(startIso));
}
