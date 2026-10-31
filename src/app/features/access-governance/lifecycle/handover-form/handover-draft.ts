import type {
  Handover,
  HandoverPreview,
} from '../../../../core/data-access/access-governance/access-lifecycle.types';
import { handoverKindOf, isSupervisedKind } from '../lifecycle.labels';

/* ============================================================================
    Lo que se decide en «¿A quién se lo pasa?» (CONTRATO-GOBIERNO §6.1, §9.5): un destino por tipo de trabajo (una persona,
    o «devolver a la bandeja común») y, obligatorio, el nuevo dueño de las cuentas que la persona supervisaba.
    Puro: arma lo que viaja en `handover` y dice qué falta. La API valida de nuevo (`HANDOVER_TARGET_INELIGIBLE`,
    `HANDOVER_SUPERVISOR_REQUIRED`).
   ========================================================================== */

export interface HandoverDraft {
  /** Destino por tipo normalizado (`CONVERSATION`, `TASK`, `PENDING_APPOINTMENT`); `''` = bandeja común. */
  readonly targets: Readonly<Record<string, string>>;
  /** Nuevo dueño de las cuentas supervisadas; `''` = sin elegir. */
  readonly supervisedTo: string;
}

export const EMPTY_HANDOVER_DRAFT: HandoverDraft = { targets: {}, supervisedTo: '' };

/** Cuántos elementos de cada tipo normalizado trae la vista previa. */
export function countsOf(
  preview: HandoverPreview,
): readonly { readonly kind: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const item of preview.items) {
    const kind = handoverKindOf(item.kind);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
}

/** Lo que falta para poder traspasar, en palabras de quien decide. */
export function handoverIssues(draft: HandoverDraft, preview: HandoverPreview): readonly string[] {
  const supervised = preview.items.filter((i) => isSupervisedKind(i.kind)).length;
  if (supervised > 0 && draft.supervisedTo === '') {
    return [
      supervised === 1
        ? 'Elija quién será responsable de la cuenta que esta persona supervisaba.'
        : `Elija quién será responsable de las ${supervised} cuentas que esta persona supervisaba.`,
    ];
  }
  return [];
}

/** El cuerpo de `handover` de la petición. Si todo va a la misma persona viaja como destino por omisión. */
export function toHandover(draft: HandoverDraft, preview: HandoverPreview): Handover {
  const work = preview.items.filter((i) => !isSupervisedKind(i.kind));
  const withTarget = work.flatMap((i) => {
    const toUserId = draft.targets[handoverKindOf(i.kind)] ?? '';
    return toUserId === '' ? [] : [{ id: i.id, toUserId }];
  });
  const distinct = new Set(withTarget.map((i) => i.toUserId));
  const uniform = withTarget.length > 0 && withTarget.length === work.length && distinct.size === 1;
  return {
    ...(uniform
      ? { defaultToUserId: withTarget[0]!.toUserId }
      : withTarget.length > 0
        ? { items: withTarget }
        : {}),
    ...(draft.supervisedTo === '' ? {} : { supervisedTo: draft.supervisedTo }),
  };
}
