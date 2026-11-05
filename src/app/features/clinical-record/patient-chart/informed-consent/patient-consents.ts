import { effect, inject, signal, untracked, type Signal } from '@angular/core';

import { InformedConsentsClient } from '../../../../core/data-access/informed-consents/informed-consents.client';
import {
  currentConsentFor,
  type InformedConsent,
  type InformedConsentTargetType,
} from '../../../../core/data-access/informed-consents/informed-consents.types';

/** Lo que un bloque necesita para pintar el estado del consentimiento de cada ítem. */
export interface PatientConsents {
  /**
   * El consentimiento vigente del ítem; `null` si no tiene; `undefined`
   * mientras la lista no volvió o si no se pudo leer.
   */
  of(targetType: InformedConsentTargetType, targetId: string): InformedConsent | null | undefined;
  /** Incorpora lo que el panel acaba de registrar o revocar, sin otra lectura. */
  upsert(consent: InformedConsent | null): void;
  /** Vuelve a leer la lista. */
  reload(): void;
  /** Si la lectura falló: los ítems no muestran estado y el bloque lo dice. */
  readonly failed: Signal<boolean>;
}

/**
 * Los consentimientos de una persona, leídos UNA vez por bloque y por
 * paciente (`GET /consent/treatment-informed-consents?patientProfileId=`).
 *
 * Una lectura por ítem serían veinte peticiones para una lista de veinte
 * recetas. Se llama en contexto de inyección (inicializador de campo).
 *
 * Un fallo de lectura no rompe el bloque: la receta se sigue pudiendo firmar y
 * emitir aunque el estado del consentimiento no se haya podido traer. Lo que
 * no hace es afirmar «Sin consentimiento» sin haberlo comprobado.
 */
export function patientConsents(patientProfileId: () => string): PatientConsents {
  const client = inject(InformedConsentsClient);
  const list = signal<readonly InformedConsent[] | null>(null);
  const failed = signal(false);
  const version = signal(0);

  effect((onCleanup) => {
    const patient = patientProfileId();
    version();
    if (patient === '') return;
    const sub = untracked(() =>
      client.list({ patientProfileId: patient }).subscribe({
        next: (consents) => {
          failed.set(false);
          list.set(consents);
        },
        error: () => {
          failed.set(true);
          list.set(null);
        },
      }),
    );
    onCleanup(() => sub.unsubscribe());
  });

  return {
    of: (targetType, targetId) => {
      const current = list();
      return current === null ? undefined : currentConsentFor(current, targetType, targetId);
    },
    upsert: (consent) => {
      if (consent === null) return;
      list.update((current) => [consent, ...(current ?? []).filter((c) => c.id !== consent.id)]);
    },
    reload: () => version.update((v) => v + 1),
    failed: failed.asReadonly(),
  };
}
