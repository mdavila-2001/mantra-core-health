import type {
  ActionConditions,
  SupportCondition,
} from '../../../core/data-access/access-governance/conditions.types';
import type { SimulationDraftGrant } from '../../../core/data-access/access-governance/access-explain.types';
import {
  SUPPORT_ACTION_CODES,
  type ExpansionMode,
  type SupportActionCode,
  type SupportGrant,
} from '../../../core/data-access/support-access/support-access.types';
import type {
  AtomGrantChange,
  NewAtomGrant,
  SupportActionInput,
} from '../../../core/data-access/support-access/support-atom-grants.types';
import type { GrantEffect } from '../../../core/data-access/support-access/support-decision.types';
import {
  LEGACY_ALIAS_ATOMS,
  SUPPORT_ATOM_CODES,
  expandSupportAction,
  isSupportAtom,
  type SupportAtom,
} from '../../../core/data-access/support-access/support-atoms';
import type { DraftGrant } from '../../../core/data-access/support-access/support-grant-draft';

/* ============================================================================
    El permiso que edita la pantalla, con efecto, átomos y condiciones.

    `DraftGrant` (core) solo conoce los 15 códigos antiguos. Acá una fila puede traer alias, átomos o una mezcla;
    el servidor normaliza a átomos al guardar (CONTRATO-GOBIERNO §2.3 punto 5). Todo es puro: la pantalla guarda
    el resultado en una señal. Lo que se manda a `simulate` y lo que se manda a guardar salen del MISMO objeto
    (`PendingWrite`), para que la huella (`simulationToken`) coincida.
   ========================================================================== */

/** Una fila del editor: un permiso con un objetivo. Una fila guardada conserva su `id`. */
export interface EditorGrant extends Omit<DraftGrant, 'actions'> {
  /** Alias (los 15 códigos de siempre), átomos o ambos, en orden canónico. */
  readonly actions: readonly SupportActionInput[];
  /** La oración con las condiciones, la arma el servidor (solo se muestra). */
  readonly conditionsSummary?: string;
}

/** Sobre qué parte del permiso va una condición: todo el permiso o un átomo. */
export type ConditionScope = 'ALL' | SupportAtom;

/** Un código válido de alias o de átomo. */
export function isActionInput(value: string): value is SupportActionInput {
  return (SUPPORT_ACTION_CODES as readonly string[]).includes(value) || isSupportAtom(value);
}

/** Quita lo que no es una acción, no repite y deja el orden canónico: primero los alias, luego los átomos. */
export function normalizeActions(codes: readonly string[]): readonly SupportActionInput[] {
  const wanted = new Set(codes);
  const aliases = SUPPORT_ACTION_CODES.filter((code) => wanted.has(code));
  const atoms = SUPPORT_ATOM_CODES.filter((code) => wanted.has(code));
  return [...aliases, ...atoms];
}

/** Del permiso guardado a la fila que se edita. */
export function toEditorGrant(grant: SupportGrant): EditorGrant {
  // Un permiso con alias se muestra como alias; uno escrito con átomos, con sus átomos.
  const legacy =
    grant.origin === 'LEGACY' || (grant.origin === undefined && grant.atoms === undefined);
  const actions = legacy ? [...grant.actions] : [...(grant.atoms ?? grant.actions)];
  return {
    key: grant.id,
    id: grant.id,
    targetKind: grant.targetKind,
    expansionMode: grant.expansionMode,
    actions: normalizeActions(actions),
    effect: grant.effect ?? 'ALLOW',
    ...(grant.practitionerRoleAssignmentId === undefined
      ? {}
      : { practitionerRoleAssignmentId: grant.practitionerRoleAssignmentId }),
    ...(grant.healthcareServiceId === undefined
      ? {}
      : { healthcareServiceId: grant.healthcareServiceId }),
    ...(grant.careSpaceId === undefined ? {} : { careSpaceId: grant.careSpaceId }),
    ...(grant.practiceSiteId === undefined ? {} : { practiceSiteId: grant.practiceSiteId }),
    ...(grant.validFrom === undefined ? {} : { validFrom: grant.validFrom }),
    ...(grant.validTo === undefined ? {} : { validTo: grant.validTo }),
    ...(grant.condition === undefined ? {} : { condition: grant.condition }),
    ...(grant.actionConditions === undefined ? {} : { actionConditions: grant.actionConditions }),
    ...(grant.conditionsSummary === undefined
      ? {}
      : { conditionsSummary: grant.conditionsSummary }),
  };
}

/**
 * La lista de vínculos de la API real (`SupportGrantViewDto`) trae de cada permiso solo los 15 códigos antiguos: **no** trae el efecto, los
 * átomos ni las condiciones, así que un permiso `DENY` o escrito solo con átomos llegaba como un permiso vacío. Lo que sí dice es
 * `GET /org/support-engagements/:id/summary` (por permiso: efecto y átomos). Se mezcla acá, por id. Las condiciones no las devuelve
 * ninguna ruta de lectura: un permiso condicionado se edita sin verlas (el PATCH que no las manda no las toca).
 */
export function withGrantSummary(
  grants: readonly SupportGrant[],
  summary: {
    readonly grants: readonly {
      readonly grantId: string;
      readonly effect: GrantEffect;
      readonly atoms: readonly string[];
    }[];
  } | null,
): readonly SupportGrant[] {
  if (summary === null) return grants;
  const byId = new Map(summary.grants.map((g) => [g.grantId, g]));
  return grants.map((grant) => {
    const known = byId.get(grant.id);
    if (known === undefined || grant.atoms !== undefined) return grant;
    return {
      ...grant,
      effect: known.effect,
      atoms: known.atoms.filter(isSupportAtom),
      origin: 'ATOM',
    };
  });
}

/* ---- lo que la fila da ---------------------------------------------------------------- */

/** Los átomos que la fila da, con los alias expandidos, en orden canónico. */
export function rowAtoms(row: Pick<EditorGrant, 'actions'>): readonly SupportAtom[] {
  const all = new Set(row.actions.flatMap((code) => expandSupportAction(code)));
  return SUPPORT_ATOM_CODES.filter((code) => all.has(code));
}

/** Los alias antiguos que la fila todavía trae. */
export function rowAliases(row: Pick<EditorGrant, 'actions'>): readonly SupportActionCode[] {
  return row.actions.filter((code): code is SupportActionCode =>
    (SUPPORT_ACTION_CODES as readonly string[]).includes(code),
  );
}

/** El átomo queda dado por la fila (directo o por un alias). */
export function rowHasAtom(row: Pick<EditorGrant, 'actions'>, atom: string): boolean {
  return row.actions.some((code) => expandSupportAction(code).includes(atom as SupportAtom));
}

/** El alias lo trae la fila tal cual. */
export function rowHasAlias(row: Pick<EditorGrant, 'actions'>, alias: SupportActionCode): boolean {
  return row.actions.includes(alias);
}

/** Los alias que la fila cubre: los que trae y los que sus átomos completan (para el resumen local). */
export function coveredAliases(row: Pick<EditorGrant, 'actions'>): readonly SupportActionCode[] {
  const atoms = new Set<string>(rowAtoms(row));
  return SUPPORT_ACTION_CODES.filter(
    (alias) =>
      row.actions.includes(alias) ||
      (LEGACY_ALIAS_ATOMS[alias] ?? []).every((atom) => atoms.has(atom)),
  );
}

/* ---- ediciones puras ------------------------------------------------------------------ */

function mapRow(
  draft: readonly EditorGrant[],
  key: string,
  change: (row: EditorGrant) => EditorGrant,
): readonly EditorGrant[] {
  return draft.map((row) => (row.key === key ? change(row) : row));
}

/** Quita las condiciones que hablan de un átomo que la fila ya no da (el servidor las rechazaría). */
export function pruneConditions(row: EditorGrant): EditorGrant {
  const atoms = new Set<string>(rowAtoms(row));
  const prune = (condition: SupportCondition): SupportCondition => {
    if (condition.fields === undefined) return condition;
    const kept = Object.fromEntries(
      Object.entries(condition.fields).filter(([atom]) => atoms.has(atom)),
    );
    const { fields: _fields, ...rest } = condition;
    return Object.keys(kept).length === 0 ? rest : { ...rest, fields: kept };
  };
  const { condition, actionConditions, ...rest } = row;
  const next: EditorGrant = {
    ...rest,
    ...(condition === undefined ? {} : { condition: prune(condition) }),
  };
  if (actionConditions === undefined) return next;
  const kept = Object.fromEntries(
    Object.entries(actionConditions)
      .filter(([atom]) => atoms.has(atom))
      .map(([atom, c]) => [atom, prune(c)]),
  );
  return Object.keys(kept).length === 0 ? next : { ...next, actionConditions: kept };
}

/** Cambia los alias de la fila por los átomos que dan: lo que la persona puede hacer no cambia. */
export function expandAliases(draft: readonly EditorGrant[], key: string): readonly EditorGrant[] {
  const target = draft.find((row) => row.key === key);
  if (target === undefined || rowAliases(target).length === 0) return draft;
  return mapRow(draft, key, (row) => ({ ...row, actions: rowAtoms(row) }));
}

/** Marca o desmarca **un** átomo de **una** fila. Si la fila traía alias, primero los convierte en átomos. */
export function toggleAtom(
  draft: readonly EditorGrant[],
  key: string,
  atom: SupportAtom,
  on: boolean,
): readonly EditorGrant[] {
  return mapRow(expandAliases(draft, key), key, (row) => {
    const current = new Set<string>(row.actions);
    if (on) current.add(atom);
    else current.delete(atom);
    return pruneConditions({ ...row, actions: normalizeActions([...current]) });
  });
}

export function setEffect(
  draft: readonly EditorGrant[],
  key: string,
  effect: GrantEffect,
): readonly EditorGrant[] {
  return mapRow(draft, key, (row) => ({ ...row, effect }));
}

export function setValidTo(
  draft: readonly EditorGrant[],
  key: string,
  validTo: string | undefined,
): readonly EditorGrant[] {
  return mapRow(draft, key, (row) => {
    const { validTo: _validTo, ...rest } = row;
    return validTo === undefined || validTo === '' ? rest : { ...rest, validTo };
  });
}

/** Pone o quita la condición de todo el permiso o de un átomo. `undefined` la quita. */
export function setCondition(
  draft: readonly EditorGrant[],
  key: string,
  scope: ConditionScope,
  condition: SupportCondition | undefined,
): readonly EditorGrant[] {
  return mapRow(draft, key, (row) => {
    if (scope === 'ALL') {
      const { condition: _condition, ...rest } = row;
      return condition === undefined ? rest : { ...rest, condition };
    }
    const { actionConditions, ...rest } = row;
    const next: Record<string, SupportCondition> = { ...(actionConditions ?? {}) };
    if (condition === undefined) delete next[scope];
    else next[scope] = condition;
    return Object.keys(next).length === 0
      ? rest
      : { ...rest, actionConditions: next as ActionConditions };
  });
}

/** La condición de un alcance. */
export function conditionOf(row: EditorGrant, scope: ConditionScope): SupportCondition | undefined {
  return scope === 'ALL' ? row.condition : row.actionConditions?.[scope];
}

/** ¿Cuántas condiciones tiene la fila en total (permiso entero más átomos)? */
export function rowConditionCount(row: EditorGrant): number {
  const count = (c: SupportCondition | undefined): number =>
    c === undefined ? 0 : Object.keys(c).filter((k) => k !== 'schemaVersion').length;
  return (
    count(row.condition) +
    Object.values(row.actionConditions ?? {}).reduce((sum, c) => sum + count(c), 0)
  );
}

/* ---- qué hay que mandar --------------------------------------------------------------- */

/**
 * Un cambio que hay que guardar, con lo que se simula y lo que se manda. Los dos salen de los mismos campos:
 * la huella del servidor (`simulationToken`) es del borrador **de un solo permiso**.
 */
export interface PendingWrite {
  readonly kind: 'create' | 'change';
  /** La fila del editor que lo origina. */
  readonly key: string;
  /** Lo que se simula (`simulate` → `draft.grants[]`). */
  readonly draftGrant: SimulationDraftGrant;
  /** `true` si el servidor comprueba la huella al guardar (cambia acciones, condiciones o vigencia). */
  readonly needsToken: boolean;
  readonly create?: Omit<NewAtomGrant, 'simulationToken'>;
  readonly change?: Omit<AtomGrantChange, 'simulationToken'>;
}

export interface ChangeSet {
  readonly writes: readonly PendingWrite[];
  /** Permisos que se retiran (no llevan huella). */
  readonly revokeIds: readonly string[];
}

const canonical = (value: unknown): string => JSON.stringify(value ?? null);
const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((code) => b.includes(code));

function refsOf(
  row: EditorGrant,
): Pick<
  EditorGrant,
  'practitionerRoleAssignmentId' | 'healthcareServiceId' | 'careSpaceId' | 'practiceSiteId'
> {
  return {
    ...(row.practitionerRoleAssignmentId === undefined
      ? {}
      : { practitionerRoleAssignmentId: row.practitionerRoleAssignmentId }),
    ...(row.healthcareServiceId === undefined
      ? {}
      : { healthcareServiceId: row.healthcareServiceId }),
    ...(row.careSpaceId === undefined ? {} : { careSpaceId: row.careSpaceId }),
    ...(row.practiceSiteId === undefined ? {} : { practiceSiteId: row.practiceSiteId }),
  };
}

function createWrite(row: EditorGrant): PendingWrite {
  const effect: GrantEffect = row.effect ?? 'ALLOW';
  const body: Omit<NewAtomGrant, 'simulationToken'> = {
    targetKind: row.targetKind,
    ...refsOf(row),
    expansionMode: row.expansionMode,
    actions: row.actions,
    effect,
    ...(row.condition === undefined ? {} : { condition: row.condition }),
    ...(row.actionConditions === undefined ? {} : { actionConditions: row.actionConditions }),
    ...(row.validFrom === undefined ? {} : { validFrom: row.validFrom }),
    ...(row.validTo === undefined ? {} : { validTo: row.validTo }),
  };
  return {
    kind: 'create',
    key: row.key,
    needsToken: true,
    create: body,
    draftGrant: {
      effect,
      actions: row.actions,
      targetKind: row.targetKind,
      ...refsOf(row),
      expansionMode: row.expansionMode,
      ...(row.condition === undefined ? {} : { condition: row.condition }),
      ...(row.actionConditions === undefined ? {} : { actionConditions: row.actionConditions }),
      ...(row.validTo === undefined ? {} : { validTo: row.validTo }),
    },
  };
}

function changeWrite(saved: EditorGrant, row: EditorGrant): PendingWrite | null {
  const actionsChanged = !sameSet(saved.actions, row.actions);
  const conditionChanged = canonical(saved.condition) !== canonical(row.condition);
  const perAtomChanged = canonical(saved.actionConditions) !== canonical(row.actionConditions);
  // La API no sabe «quitar» una fecha de vencimiento: solo se cambia por otra.
  const validToChanged = row.validTo !== undefined && row.validTo !== saved.validTo;
  const modeChanged = saved.expansionMode !== row.expansionMode;
  if (!actionsChanged && !conditionChanged && !perAtomChanged && !validToChanged && !modeChanged)
    return null;

  const needsToken = actionsChanged || conditionChanged || perAtomChanged || validToChanged;
  // Quitar todas las condiciones de un permiso que ya las tenía se escribe como una condición vacía (la API ignora «nada»).
  const condition =
    row.condition ??
    (saved.condition === undefined ? undefined : ({ schemaVersion: 1 } as SupportCondition));
  const sentCondition = conditionChanged ? condition : undefined;
  const sentPerAtom = perAtomChanged ? (row.actionConditions ?? {}) : undefined;
  const sentValidTo = validToChanged ? row.validTo : undefined;
  const change: Omit<AtomGrantChange, 'simulationToken'> = {
    grantId: saved.id ?? row.key,
    ...(needsToken ? { actions: row.actions } : {}),
    ...(modeChanged ? { expansionMode: row.expansionMode as ExpansionMode } : {}),
    ...(sentCondition === undefined ? {} : { condition: sentCondition }),
    ...(sentPerAtom === undefined ? {} : { actionConditions: sentPerAtom }),
    ...(sentValidTo === undefined ? {} : { validTo: sentValidTo }),
  };
  return {
    kind: 'change',
    key: row.key,
    needsToken,
    change,
    draftGrant: {
      id: saved.id ?? row.key,
      effect: saved.effect ?? 'ALLOW',
      actions: row.actions,
      targetKind: row.targetKind,
      ...refsOf(row),
      expansionMode: row.expansionMode,
      ...(sentCondition === undefined ? {} : { condition: sentCondition }),
      ...(sentPerAtom === undefined ? {} : { actionConditions: sentPerAtom }),
      ...((sentValidTo ?? saved.validTo) === undefined
        ? {}
        : { validTo: (sentValidTo ?? saved.validTo) as string }),
    },
  };
}

/**
 * Lo mínimo que hay que mandar para que la API quede como el borrador.
 *
 * Un permiso guardado que cambia de efecto (Permitir ↔ Denegar) no se edita: se retira y se crea otro, porque el
 * efecto no se puede cambiar con `PATCH`.
 */
export function buildChangeSet(
  saved: readonly SupportGrant[],
  draft: readonly EditorGrant[],
): ChangeSet {
  const live = saved.filter((grant) => grant.status === 'ACTIVE');
  const byId = new Map(live.map((grant) => [grant.id, toEditorGrant(grant)]));
  const writes: PendingWrite[] = [];
  const revokeIds: string[] = [];

  for (const row of draft) {
    const previous = row.id === undefined ? undefined : byId.get(row.id);
    if (previous === undefined) {
      writes.push(createWrite(row));
    } else if ((previous.effect ?? 'ALLOW') !== (row.effect ?? 'ALLOW')) {
      revokeIds.push(previous.id!);
      const { id: _id, ...fresh } = row;
      writes.push(createWrite({ ...fresh, key: row.key }));
    } else {
      const write = changeWrite(previous, row);
      if (write !== null) writes.push(write);
    }
  }

  const kept = new Set(draft.flatMap((row) => (row.id === undefined ? [] : [row.id])));
  for (const grant of live)
    if (!kept.has(grant.id) && !revokeIds.includes(grant.id)) revokeIds.push(grant.id);
  return { writes, revokeIds };
}

/** ¿El borrador difiere de lo guardado? Habilita «Guardar» y avisa de cambios sin guardar. */
export function hasChanges(saved: readonly SupportGrant[], draft: readonly EditorGrant[]): boolean {
  const set = buildChangeSet(saved, draft);
  return set.writes.length + set.revokeIds.length > 0;
}
