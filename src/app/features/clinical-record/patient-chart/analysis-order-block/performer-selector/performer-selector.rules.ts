/**
 * Reglas puras del selector de ejecutor de una orden de procedimiento.
 *
 * Sin Angular ni HTTP: reciben lo ya leído y devuelven lo que la pantalla
 * muestra o lo que el alta envía. Así se prueban solas, antes de que exista
 * ninguna de las lecturas de las que dependen.
 */

import { roleAssignmentState } from '../../../../../core/data-access/role-assignments/role-assignment-status';

/** Los tres modos del conjunto `service-request-performer-selection`. */
export type PerformerMode = 'SELF' | 'ORGANIZATION' | 'PATIENT_CHOICE';

/** La elección del médico: el modo y, salvo «Que elija el paciente», la sede. */
export interface PerformerChoice {
  readonly mode: PerformerMode;
  readonly siteId: string | null;
}

/**
 * El modo con el que arranca toda orden de procedimiento.
 *
 * Es un **código**, no un uuid: el uuid sale de expandir el conjunto en
 * terminología y un re-seed puede moverlo.
 */
export const DEFAULT_PERFORMER_SELECTION: PerformerMode = 'PATIENT_CHOICE';

export const DEFAULT_PERFORMER_CHOICE: PerformerChoice = {
  mode: DEFAULT_PERFORMER_SELECTION,
  siteId: null,
};

/** El uuid del concepto de cada modo, tomado de la expansión del conjunto. */
export type PerformerSelectionConcepts = Readonly<Record<PerformerMode, string>>;

/** Una sede que se puede recomendar, tal como la devuelve la búsqueda. */
export interface PerformerSite {
  readonly practiceSiteId: string;
  readonly name: string;
  readonly addressText: string | null;
}

/** Lo que el selector necesita de una vinculación del médico. */
export interface OwnAssignment {
  readonly practiceSiteId: string | null;
  readonly serviceConceptId: string | null;
  readonly statusCode: string;
}

/** Las claves nuevas de `POST /clinical/service-requests`. */
export interface PerformerFields {
  readonly performerSelectionConceptId?: string;
  readonly performerPractitionerProfileId?: string;
  readonly suggestedPracticeSiteId?: string;
}

/**
 * Los códigos con los que la API puede nombrar la categoría procedimiento
 *. Terminología devuelve el código simple o con el prefijo del
 * módulo, así que se aceptan las dos formas.
 */
export const PROCEDURE_CATEGORY_CODES: readonly string[] = [
  'SRQ-PROCEDURE',
  'SR_PROCEDURE',
  'clinical:SERVICE_REQUEST_CATEGORY_PROCEDURE',
];

/** El código sin el prefijo del módulo: `clinical:SR_X` → `SR_X`. */
function withoutPrefix(code: string): string {
  const corte = code.indexOf(':');
  return corte === -1 ? code : code.slice(corte + 1);
}

const PROCEDURE_CATEGORY_WITHOUT_PREFIX = new Set(PROCEDURE_CATEGORY_CODES.map(withoutPrefix));

/** Si el código de una categoría es el de procedimiento. */
export function isProcedureCategoryCode(code: string | null | undefined): boolean {
  if (code === null || code === undefined) {
    return false;
  }
  return PROCEDURE_CATEGORY_CODES.includes(code) || PROCEDURE_CATEGORY_WITHOUT_PREFIX.has(withoutPrefix(code));
}

/**
 * El modo que nombra un código de concepto. Terminología lo devuelve como
 * `clinical:SERVICE_REQUEST_PERFORMER_SELF`; también se aceptan `SR_PERF_SELF`,
 * `clinical:SR_PERF_SELF` y el simple `SELF`.
 */
export function performerModeOfCode(code: string): PerformerMode | null {
  const simple = withoutPrefix(code).replace(/^(?:SR_PERF_|SERVICE_REQUEST_PERFORMER_)/, '');
  return simple === 'SELF' || simple === 'ORGANIZATION' || simple === 'PATIENT_CHOICE'
    ? simple
    : null;
}

/**
 * Los tres uuids a partir de las opciones del conjunto expandido, o `null` si
 * falta alguno: con un conjunto incompleto no se puede enviar un modo válido.
 */
export function performerSelectionConceptsOf(
  options: readonly { readonly conceptId: string; readonly code: string }[],
): PerformerSelectionConcepts | null {
  const found: Partial<Record<PerformerMode, string>> = {};
  for (const option of options) {
    const mode = performerModeOfCode(option.code);
    if (mode !== null && found[mode] === undefined) {
      found[mode] = option.conceptId;
    }
  }
  const { SELF, ORGANIZATION, PATIENT_CHOICE } = found;
  return SELF === undefined || ORGANIZATION === undefined || PATIENT_CHOICE === undefined
    ? null
    : { SELF, ORGANIZATION, PATIENT_CHOICE };
}

/**
 * El cuerpo por modo.
 *
 * - `PATIENT_CHOICE`: ningún campo de ejecutor; sólo el concepto del modo (o
 *   nada, que la API toma como `PATIENT_CHOICE`) si el conjunto no se leyó.
 * - `SELF`: el concepto, el médico que pide y la sede.
 * - `ORGANIZATION`: el concepto y la sede, sin médico.
 *
 * Devuelve `null` cuando la elección no se puede enviar (falta la sede o el
 * concepto del modo): el formulario no emite en ese caso, en vez de mandar una
 * recomendación a medias que la API rechazaría con 422.
 *
 * **Nunca** produce `performerTenantId`: la recomendación no le da al centro
 * acceso a la orden .
 */
export function performerFieldsOf(
  choice: PerformerChoice,
  requesterProfileId: string | null,
  selectionConcepts: PerformerSelectionConcepts | null,
): PerformerFields | null {
  if (choice.mode === 'PATIENT_CHOICE') {
    return selectionConcepts === null
      ? {}
      : { performerSelectionConceptId: selectionConcepts.PATIENT_CHOICE };
  }

  if (selectionConcepts === null || choice.siteId === null) {
    return null;
  }

  if (choice.mode === 'ORGANIZATION') {
    return {
      performerSelectionConceptId: selectionConcepts.ORGANIZATION,
      suggestedPracticeSiteId: choice.siteId,
    };
  }

  if (requesterProfileId === null) {
    return null;
  }
  return {
    performerSelectionConceptId: selectionConcepts.SELF,
    performerPractitionerProfileId: requesterProfileId,
    suggestedPracticeSiteId: choice.siteId,
  };
}

/**
 * Las sedes de «Lo hago yo»: vinculaciones ACTIVE **de este procedimiento**
 * (una fila ACTIVE de otro procedimiento no cuenta) intersecadas con las sedes
 * que lo publican con precio, en el orden de la búsqueda. El front no reordena.
 * Vacía ⇒ la opción se deshabilita.
 */
export function ownSiteOptions(
  assignments: readonly OwnAssignment[],
  searchItems: readonly PerformerSite[],
  procedureConceptId: string,
): readonly PerformerSite[] {
  const ownSiteIds = new Set(
    assignments
      .filter(
        (row) =>
          roleAssignmentState(row.statusCode) === 'ACTIVE' &&
          row.serviceConceptId === procedureConceptId &&
          row.practiceSiteId !== null,
      )
      .map((row) => row.practiceSiteId),
  );
  const seen = new Set<string>();
  return searchItems.filter((site) => {
    if (!ownSiteIds.has(site.practiceSiteId) || seen.has(site.practiceSiteId)) {
      return false;
    }
    seen.add(site.practiceSiteId);
    return true;
  });
}

/** Si la elección está completa para enviarse: los modos con sede la exigen. */
export function isPerformerChoiceComplete(choice: PerformerChoice): boolean {
  return choice.mode === 'PATIENT_CHOICE' || choice.siteId !== null;
}
