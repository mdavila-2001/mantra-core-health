import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { DiagnosisOption } from './medication-block/medication-block';

/**
 * Los diagnósticos de la persona como opciones de un vínculo de la red clínica
 * (patch v4291): «Para qué diagnóstico» de una orden de estudio y «Se confirmó
 * en su lugar» de un rechazo.
 *
 * Salen de {@link DiagnosisOption} —la misma lista que ya arma la receta con
 * `diagnosticoParaReceta`— para que las tres pantallas digan lo mismo de cada
 * diagnóstico. Un **descartado** no se ofrece: no hay nada que confirmar ni
 * que seguir de él. `excludeId` deja afuera el propio diagnóstico (un
 * rechazado no se reemplaza a sí mismo). Sin opción vacía propia: el
 * `placeholder` de `app-select` ya es la opción nula.
 */
export function diagnosisLinkOptions(
  diagnoses: readonly DiagnosisOption[],
  excludeId?: string,
): readonly SelectOption<string | null>[] {
  return diagnoses
    .filter((dx) => dx.descartado !== true && dx.id !== excludeId)
    .map((dx) => ({
      value: dx.id,
      label: `${dx.etiqueta} · ${dx.confirmado === true ? 'Confirmado' : 'En estudio'}`,
    }));
}

/**
 * «Se confirmó en su lugar» of a rejection: only a **confirmed** diagnosis can
 * have been confirmed instead (an «En estudio» one has not been, yet). Same
 * labels as {@link diagnosisLinkOptions}; the rejected one itself is left out.
 */
export function replacementOptions(
  diagnoses: readonly DiagnosisOption[],
  excludeId: string,
): readonly SelectOption<string | null>[] {
  return diagnosisLinkOptions(diagnoses.filter((dx) => dx.confirmado === true), excludeId);
}

/**
 * El mensaje de un 422 de vínculo (patch v4291) si su `reason` es uno de
 * `reasons`, o `null`. La API los manda como `PreconditionFailedException`
 * con el campo en `details.field`: el formulario lo muestra **en el control**
 * que lo corrige, no como un error suelto arriba.
 */
export function linkFailureMessage(error: unknown, reasons: readonly string[]): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = readApiError(error);
  if (body === null || body.reason === undefined || !reasons.includes(body.reason)) return null;
  return body.message || 'El diagnóstico indicado no existe o no es de esta persona.';
}
