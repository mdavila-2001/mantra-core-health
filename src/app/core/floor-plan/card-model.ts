/* ============================================================================
    Modelo de la tarjeta de detalle (CONTRATO-PLANO §5.6): qué filas tiene y de
    dónde sale cada una. Función pura: la tarjeta es presentacional.

    **Regla del paciente.** La interfaz no decide quién ve a quién: la fila de
    paciente existe solo si `canSeePatient` es verdadero Y la API mandó la clave
    `patient`. Ausente ≠ nulo. Para Limpieza y Mantenimiento la ocupación es
    «Ocupada» sin un solo dato de persona.
    ========================================================================== */

import type { PlanRollup, SpaceState } from '../data-access/floor-plan/floor-plan.types';
import type { SpaceView } from './plan-view';
import { ISOLATION } from '../data-access/floor-plan/floor-plan.codes';
import { ageLabel, isStale, rollupSentence, sinceLabel, stateVisual, type StateVisual } from './state-visuals';

export interface CardAxisRow {
  readonly axis: 'availability' | 'occupancy' | 'hygiene' | 'isolation';
  readonly title: string;
  readonly visual: StateVisual;
  readonly detail: string | null;
}

export interface PlanCardModel {
  readonly spaceId: string;
  readonly title: string;
  readonly path: string | null;
  readonly kind: string | null;
  readonly ownerUnit: string | null;
  readonly lifecycle: string | null;
  readonly rows: readonly CardAxisRow[];
  /** Texto que explica por qué no hay estado (rol sin acceso o dato aún sin cargar). */
  readonly noStateText: string | null;
  readonly capacity: string | null;
  readonly technical: readonly { readonly label: string; readonly value: string }[];
  readonly ageText: string | null;
  readonly stale: boolean;
  readonly patientLine: string | null;
  readonly patientName: string | null;
  /** Mientras el layout `lite` no trajo la ficha: filas de esqueleto. */
  readonly loadingStatic: boolean;
  readonly assignable: boolean | null;
  readonly notAssignableWhy: string | null;
  readonly inScope: boolean;
}

export interface CardInput {
  readonly space: SpaceView;
  readonly state: SpaceState | undefined;
  readonly rollup: PlanRollup | undefined;
  readonly asOf: string | null;
  readonly now: number;
  readonly canSeeState: boolean;
  readonly canSeePatient: boolean;
  readonly patientName: string | null;
  /** Modo elegir cama: se explica por qué no se puede elegir. */
  readonly pickMode?: boolean;
}

const SEX: Readonly<Record<string, string>> = { F: 'Femenino', M: 'Masculino' };

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function buildCardModel(input: CardInput): PlanCardModel {
  const { space, state, now } = input;
  if (!space.inScope) {
    return {
      spaceId: space.id, title: 'Espacio fuera de su alcance', path: null, kind: null, ownerUnit: null, lifecycle: null, rows: [],
      noStateText: null, capacity: null, technical: [], ageText: null, stale: false, patientLine: null, patientName: null,
      loadingStatic: false, assignable: null, notAssignableWhy: null, inScope: false,
    };
  }
  const card = space.card;
  const rows: CardAxisRow[] = [];
  let patientLine: string | null = null;
  if (state && input.canSeeState) {
    const availability = stateVisual('availability', state);
    const availabilityDetail = [
      state.availability.reasonText,
      state.availability.expectedUntil ? `hasta ${fmtDate(state.availability.expectedUntil)}` : null,
    ].filter(Boolean).join(' · ');
    rows.push({ axis: 'availability', title: 'Disponibilidad', visual: availability, detail: availabilityDetail || null });
    const occupancy = stateVisual('occupancy', state);
    rows.push({ axis: 'occupancy', title: 'Ocupación', visual: occupancy, detail: `desde ${sinceLabel(state.occupancy.since, now)}` });
    const hygiene = stateVisual('hygiene', state);
    rows.push({
      axis: 'hygiene', title: 'Higiene', visual: hygiene,
      detail: [`desde ${sinceLabel(state.hygiene.since, now)}`, state.hygiene.terminalRequired ? 'limpieza terminal requerida' : null].filter(Boolean).join(' · '),
    });
    const isolation = stateVisual('isolation', state);
    rows.push({
      axis: 'isolation', title: 'Aislamiento', visual: isolation,
      detail: state.isolation.code === ISOLATION.NONE ? null : [state.isolation.organism, `desde ${sinceLabel(state.isolation.since, now)}`].filter(Boolean).join(' · '),
    });
    const patient = state.occupancy.patient;
    if (input.canSeePatient && patient !== undefined) {
      patientLine = `${patient.initials} · ${SEX[patient.sexCode] ?? patient.sexCode} · ${patient.ageYears} años`;
    }
  }
  const technical: { label: string; value: string }[] = [];
  if (card?.areaDeclaredM2 != null) technical.push({ label: 'Área declarada', value: `${card.areaDeclaredM2} m²` });
  technical.push({ label: 'Área dibujada', value: `${space.areaCalcM2} m²` });
  const t = card?.technical;
  if (t?.asepsis) technical.push({ label: 'Asepsia', value: t.asepsis });
  if (t?.pressure) technical.push({ label: 'Presión', value: t.pressure });
  if (t?.airChangesPerHour != null) technical.push({ label: 'Recambios de aire', value: `${t.airChangesPerHour} por hora` });
  if (t?.hvacValidatedOn) technical.push({ label: 'Validación HVAC', value: t.hvacValidatedOn });
  if (t?.sexRestriction) technical.push({ label: 'Restricción de sexo', value: t.sexRestriction });
  if (t?.ageGroup) technical.push({ label: 'Grupo etario', value: t.ageGroup });
  if (t?.bedCategory) technical.push({ label: 'Categoría de cama', value: t.bedCategory });

  const noStateText = !input.canSeeState
    ? 'El estado operativo no está disponible para su rol.'
    : state === undefined && space.formCode !== '' && (space.band === 'room' || space.band === 'bed')
      ? 'Sin estado operativo para este espacio.'
      : null;
  let assignable: boolean | null = null;
  let why: string | null = null;
  if (input.pickMode && state) {
    assignable = state.assignable;
    if (!state.assignable) why = reasonNotAssignable(state);
  }
  return {
    spaceId: space.id,
    title: `${space.code} · ${space.name}`,
    path: card ? card.path.map((p) => p.name).join(' › ') : null,
    kind: card ? `${card.functionDisplay} · ${card.formDisplay}` : null,
    ownerUnit: card?.ownerUnit?.name ?? null,
    lifecycle: card?.lifecycle.display ?? null,
    rows,
    noStateText,
    capacity: rollupSentence(input.rollup) ?? (card?.capacity ? `${card.capacity} ${card.capacity === 1 ? 'cama' : 'camas'}` : null),
    technical,
    ageText: state && input.asOf ? ageLabel(input.asOf, now) : null,
    stale: input.asOf ? isStale(input.asOf, now) : false,
    patientLine,
    patientName: patientLine ? input.patientName : null,
    loadingStatic: card === undefined,
    assignable,
    notAssignableWhy: why,
    inScope: true,
  };
}

/** Por qué una cama no es asignable, con las mismas reglas de bloqueo que F2/F3. */
export function reasonNotAssignable(state: SpaceState): string {
  if (state.lifecycle.code !== 'SPACE_ACTIVE') return 'El espacio no está activo.';
  if (state.availability.code !== 'SPACE_OP_AVAILABLE') return state.availability.reasonText ?? 'No está disponible.';
  if (state.occupancy.code === 'OCC_OCCUPIED') return 'Está ocupada.';
  if (state.occupancy.code === 'OCC_RESERVED') return 'Está reservada.';
  if (state.hygiene.code !== 'HYG_INSPECTED') return 'Falta limpiarla o inspeccionarla.';
  if (state.hygiene.terminalRequired) return 'Requiere limpieza terminal.';
  return 'No es asignable en este momento.';
}
