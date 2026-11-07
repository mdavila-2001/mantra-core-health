import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../../../core/http/api-error';

/** Los campos de la sección donde puede mostrarse un error del servidor. */
export type StudyDetailField =
  'specimen' | 'modality' | 'bodySite' | 'structure' | 'laterality' | 'boneType' | 'contrast';

/**
 * Por cada `details.reason` del 422 de la orden: en qué campo se muestra y qué
 * se le dice a la persona (qué pasó y qué puede hacer). Los motivos salen de
 * `StudyDetailReason` de la API (`clinical.error-reasons.ts`); uno que no esté
 * acá se muestra como el error general del pedido, nunca se descarta.
 */
const REASONS: Readonly<
  Record<string, { readonly field: StudyDetailField; readonly message: string }>
> = {
  SPECIMEN_NOT_ALLOWED_FOR_CATEGORY: {
    field: 'specimen',
    message:
      'La muestra se indica sólo en estudios de laboratorio. Quítela o elija un estudio de laboratorio.',
  },
  SPECIMEN_TYPE_NOT_IN_CATALOG: {
    field: 'specimen',
    message: 'Esa muestra no está en el catálogo. Elija una de la lista.',
  },
  SPECIMEN_AND_IMAGING_FIELDS_EXCLUSIVE: {
    field: 'specimen',
    message:
      'Una orden lleva muestra (laboratorio) o datos de imagen, no las dos cosas. Quite una.',
  },
  IMAGING_FIELDS_NOT_ALLOWED: {
    field: 'bodySite',
    message: 'La región, la modalidad y el lado se indican sólo en estudios de imagen.',
  },
  MODALITY_REQUIRED: {
    field: 'modality',
    message: 'Este estudio necesita la modalidad (radiografía, ecografía…). Elíjala.',
  },
  MODALITY_NOT_IN_CATALOG: {
    field: 'modality',
    message: 'Esa modalidad no está en el catálogo. Elija una de la lista.',
  },
  MODALITY_STUDY_MISMATCH: {
    field: 'modality',
    message:
      'La modalidad no es la que el catálogo fija para este estudio. Déjela sin especificar o elija la del estudio.',
  },
  BODY_SITE_REQUIRED: {
    field: 'bodySite',
    message: 'Un estudio de imagen necesita la región del cuerpo. Elíjala de la lista.',
  },
  IMAGING_FIELD_CONFLICT: {
    field: 'bodySite',
    message: 'Un dato de imagen llegó dos veces con valores distintos. Vuelva a elegirlo.',
  },
  BODY_SITE_NOT_IN_CATALOG: {
    field: 'bodySite',
    message: 'Esa región no está en el catálogo. Elija una de la lista.',
  },
  LATERALITY_NOT_IN_CATALOG: {
    field: 'laterality',
    message: 'Ese lado no está en el catálogo. Elija izquierda, derecha o bilateral.',
  },
  LATERALITY_REQUIRES_BODY_SITE: {
    field: 'laterality',
    message: 'Para indicar el lado, primero elija la región del cuerpo.',
  },
  LATERALITY_NOT_APPLICABLE: {
    field: 'laterality',
    message: 'Esa región no tiene lado (es una estructura única). Deje el lado sin especificar.',
  },
  BODY_STRUCTURE_FORMAT_INVALID: {
    field: 'structure',
    message: 'La parte marcada en el cuerpo no tiene un código válido. Vuelva a elegirla.',
  },
  BODY_MESH_ID_FORMAT_INVALID: {
    field: 'structure',
    message: 'La parte marcada en el cuerpo no tiene un código válido. Vuelva a elegirla.',
  },
  BONE_TYPE_REQUIRES_BODY_STRUCTURE: {
    field: 'boneType',
    message: 'El tipo de hueso necesita una parte del cuerpo marcada. Márquela o quite el tipo.',
  },
  CONTRAST_NOT_IN_CATALOG: {
    field: 'contrast',
    message: 'Ese contraste no está en el catálogo. Elija una opción de la lista.',
  },
  CONTRAST_REQUIRES_MODALITY: {
    field: 'contrast',
    message: 'Para indicar el contraste, primero elija el tipo de imagen.',
  },
  BONE_TYPE_NOT_IN_CATALOG: {
    field: 'boneType',
    message: 'Ese tipo de hueso no está en el catálogo. Elija uno de la lista.',
  },
};

/** El nombre de la propiedad del cuerpo (`imaging.bodySiteConceptId`) → el campo de la sección. */
const FIELD_OF_KEY: Readonly<Record<string, StudyDetailField>> = {
  specimenTypeConceptId: 'specimen',
  modalityConceptId: 'modality',
  bodySiteConceptId: 'bodySite',
  bodyStructureUberon: 'structure',
  bodyMeshId: 'structure',
  lateralityConceptId: 'laterality',
  boneTypeConceptId: 'boneType',
  contrastConceptId: 'contrast',
};

/** Un error del servidor ya ubicado en su campo. */
export interface StudyDetailError {
  readonly field: StudyDetailField;
  readonly message: string;
}

/**
 * Ubica un 422 de la orden en el campo de la sección de detalle, o `null` si el
 * error no es de esta sección (se queda como error general del pedido).
 *
 * Manda `details.reason` (el motivo estable); `details.field` sólo desempata
 * motivos que viven en más de un campo y ubica los que no están en la tabla.
 */
export function studyDetailErrorOf(error: unknown): StudyDetailError | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 422) return null;
  const details = readApiError(error)?.details;
  const reason = typeof details?.['reason'] === 'string' ? details['reason'] : undefined;
  const key =
    typeof details?.['field'] === 'string' ? (details['field'].split('.').pop() ?? '') : '';
  const known = reason === undefined ? undefined : REASONS[reason];
  if (known === undefined) return null;
  const field = FIELD_OF_KEY[key] ?? known.field;
  // La API pide la región también para el lado (BODY_SITE_REQUIRED sobre `lateralityConceptId`): se dice en ese campo.
  const message =
    reason === 'BODY_SITE_REQUIRED' && field === 'laterality'
      ? REASONS['LATERALITY_REQUIRES_BODY_SITE']!.message
      : known.message;
  return { field, message };
}
