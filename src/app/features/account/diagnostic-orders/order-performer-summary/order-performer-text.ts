import type { PerformerSelectionCode } from '../../../../core/data-access/diagnostics/service-request-performer.types';

/** Lo que el paciente lee de la elección del médico sobre quién hace el procedimiento. */
export interface OrderPerformerText {
  /** El modo, en una línea. */
  readonly mode: string;
  /** «Es una recomendación…»; `null` cuando no hay nada que recomendar (`PATIENT_CHOICE`). */
  readonly recommendation: string | null;
  /** La sede que sugirió el médico, por su nombre; `null` sin sede. */
  readonly site: string | null;
}

const TEXTO_DEL_MODO: Readonly<Record<PerformerSelectionCode, string>> = {
  PATIENT_CHOICE: 'Puede elegir dónde hacérselo',
  ORGANIZATION: 'Su médico sugirió un centro',
  SELF: 'Su médico se ofreció a hacerlo',
};

const AVISO_DE_RECOMENDACION = 'Es una recomendación: puede elegir otro centro.';

/**
 * El texto de la fila de una orden de procedimiento, según el **código** del modo.
 *
 * La elección del médico es una recomendación y no un candado, así que con
 * `SELF` u `ORGANIZATION` siempre se dice. La sede va por su nombre (`siteName`),
 * nunca por su uuid, y sólo cuando hay algo sugerido: con `PATIENT_CHOICE` no se
 * pinta aunque llegue.
 */
export function orderPerformerText(mode: PerformerSelectionCode, siteName: string | null): OrderPerformerText {
  const recomienda = mode !== 'PATIENT_CHOICE';
  return {
    mode: TEXTO_DEL_MODO[mode],
    recommendation: recomienda ? AVISO_DE_RECOMENDACION : null,
    site: recomienda && siteName !== null && siteName.trim() !== '' ? `Sede sugerida: ${siteName}` : null,
  };
}
