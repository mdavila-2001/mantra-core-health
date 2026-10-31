import type {
  SupportActionCode,
  SupportEngagementRequest,
  SupportItemVerdict,
  SupportRequestDecision,
} from '../../../core/data-access/support-access/support-access.types';

/**
 * Lo que la persona va decidiendo, ítem por ítem, antes de mandarlo.
 *
 * Es el borrador de la pantalla: nada de esto llega a la API hasta que se
 * guarda, y la API vuelve a validar todo (acá solo se evita mandar lo que se
 * sabe que va a volver rechazado).
 */
export interface ItemDraft {
  readonly decision?: 'APPROVED' | 'ADJUSTED' | 'REJECTED';
  /** Para `ADJUSTED`: las acciones que sí se conceden. */
  readonly actions: readonly SupportActionCode[];
  readonly comment: string;
}

export type RequestDrafts = Readonly<Record<string, ItemDraft>>;

/** Borrador de partida: sin decisión, con lo que la persona pidió preseleccionado. */
export function initialDrafts(request: SupportEngagementRequest): RequestDrafts {
  return Object.fromEntries(
    request.items.map((item) => [item.id, { actions: [...item.proposedActions], comment: '' } satisfies ItemDraft]),
  );
}

export interface DecisionCheck {
  /** Lo que se puede mandar, o `null` si todavía falta algo. */
  readonly decision: SupportRequestDecision | null;
  /** Por qué no se puede mandar, en palabras de quien decide. */
  readonly problems: readonly string[];
}

/**
 * Arma la decisión a partir del borrador o dice qué falta.
 *
 * Reglas (las mismas que aplica la API):
 * - cada ítem necesita su decisión;
 * - un ítem **ajustado** necesita al menos una acción;
 * - un ítem **rechazado** necesita su motivo.
 */
export function buildDecision(
  request: SupportEngagementRequest,
  drafts: RequestDrafts,
  itemName: (itemId: string) => string,
  reasonText: string,
): DecisionCheck {
  const problems: string[] = [];
  const verdicts: SupportItemVerdict[] = [];

  for (const item of request.items) {
    const draft = drafts[item.id];
    const name = itemName(item.id);
    if (draft?.decision === undefined) {
      problems.push(`Falta decidir: ${name}.`);
      continue;
    }
    if (draft.decision === 'ADJUSTED' && draft.actions.length === 0) {
      problems.push(`Elija al menos una acción para ajustar: ${name}.`);
      continue;
    }
    if (draft.decision === 'REJECTED' && draft.comment.trim() === '') {
      problems.push(`Escriba el motivo del rechazo: ${name}.`);
      continue;
    }
    verdicts.push({
      itemId: item.id,
      decision: draft.decision,
      ...(draft.decision === 'ADJUSTED' ? { actions: draft.actions } : {}),
      ...(draft.comment.trim() === '' ? {} : { comment: draft.comment.trim() }),
    });
  }

  if (problems.length > 0) return { decision: null, problems };
  return {
    decision: {
      items: verdicts,
      ...(reasonText.trim() === '' ? {} : { reasonText: reasonText.trim() }),
    },
    problems: [],
  };
}

/** Atajo: aprobar todo lo pendiente tal como se pidió. */
export function approveAll(request: SupportEngagementRequest, drafts: RequestDrafts): RequestDrafts {
  return Object.fromEntries(
    request.items.map((item) => [
      item.id,
      { ...(drafts[item.id] ?? { actions: [...item.proposedActions], comment: '' }), decision: 'APPROVED' as const, actions: [...item.proposedActions] },
    ]),
  );
}
