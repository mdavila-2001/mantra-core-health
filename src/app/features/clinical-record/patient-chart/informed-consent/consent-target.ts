import { computed, signal, type Signal, type WritableSignal } from '@angular/core';

import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { consentEncounter } from './consent-encounter';
import { patientConsents, type PatientConsents } from './patient-consents';

/** Lo que un bloque necesita para ofrecer el consentimiento dirigido de sus ítems. */
export interface ConsentTargetState<T> {
  /** Los consentimientos de la persona, para la insignia de cada ítem. */
  readonly consents: PatientConsents;
  /** El ítem cuyo consentimiento está abierto, o `null`. */
  readonly target: WritableSignal<T | null>;
  /**
   * La atención a la que se ata: la del ítem, si no la abierta del contexto,
   * si no la cita en curso. Sin ninguna, `null`: el panel muestra el S3
   * «Falta la atención».
   */
  readonly encounterId: Signal<string | null>;
}

/**
 * El consentimiento dirigido de un bloque, en una línea. Se llama en contexto
 * de inyección (inicializador de campo).
 *
 * @param patientProfileId - La persona del bloque.
 * @param candidates - Los encuentros candidatos para el ítem abierto, en orden de preferencia.
 */
export function consentTargetState<T>(
  patientProfileId: () => string,
  candidates: (item: T | null) => readonly (string | null | undefined | readonly CitaDelPaciente[])[],
): ConsentTargetState<T> {
  const target = signal<T | null>(null);
  return {
    consents: patientConsents(patientProfileId),
    target,
    encounterId: computed(() => consentEncounter(...candidates(target()))),
  };
}
