import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import type { DiagnosisOption } from './medication-block/medication-block';

/**
 * The person's diagnoses as options of a clinical network link (patch
 * v4291): a study order's «Para qué diagnóstico» and a rejection's «Se
 * confirmó en su lugar».
 *
 * They come from {@link DiagnosisOption} —the same list the prescription
 * already builds with `diagnosticoParaReceta`— so the three screens say the
 * same of each diagnosis. A **ruled-out** one is not offered: there is nothing
 * to confirm nor follow from it. `excludeId` leaves out the diagnosis itself
 * (a rejected one does not replace itself). No empty option of its own: the
 * `placeholder` of `app-select` already is the null option.
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
 * The message of a link 422 (patch v4291) if its `reason` is one of
 * `reasons`, or `null`. The API sends them as `PreconditionFailedException`
 * with the field in `details.field`: the form shows it **on the control**
 * that fixes it, not as a loose error on top.
 */
export function linkFailureMessage(error: unknown, reasons: readonly string[]): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = readApiError(error);
  if (body === null || body.reason === undefined || !reasons.includes(body.reason)) return null;
  return body.message || 'El diagnóstico indicado no existe o no es de esta persona.';
}
