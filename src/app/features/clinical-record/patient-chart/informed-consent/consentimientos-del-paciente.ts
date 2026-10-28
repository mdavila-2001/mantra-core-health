import { effect, inject, signal, untracked, type Signal } from '@angular/core';

import { InformedConsentsClient } from '../../../../core/data-access/informed-consents/informed-consents.client';
import {
  vigenteDe,
  type InformedConsent,
  type InformedConsentTargetType,
} from '../../../../core/data-access/informed-consents/informed-consents.types';

/** Lo que un bloque necesita para pintar el estado del consentimiento de cada ítem. */
export interface ConsentimientosDelPaciente {
  /**
   * El consentimiento vigente del ítem; `null` si no tiene; `undefined`
   * mientras la lista no volvió o si no se pudo leer.
   */
  de(targetType: InformedConsentTargetType, targetId: string): InformedConsent | null | undefined;
  /** Incorpora lo que el panel acaba de registrar o revocar, sin otra lectura. */
  incorporar(consent: InformedConsent | null): void;
  /** Vuelve a leer la lista. */
  recargar(): void;
  /** Si la lectura falló: los ítems no muestran estado y el bloque lo dice. */
  readonly fallo: Signal<boolean>;
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
export function consentimientosDelPaciente(
  patientProfileId: () => string,
): ConsentimientosDelPaciente {
  const client = inject(InformedConsentsClient);
  const lista = signal<readonly InformedConsent[] | null>(null);
  const fallo = signal(false);
  const version = signal(0);

  effect((onCleanup) => {
    const paciente = patientProfileId();
    version();
    if (paciente === '') return;
    const sub = untracked(() =>
      client.list({ patientProfileId: paciente }).subscribe({
        next: (consentimientos) => {
          fallo.set(false);
          lista.set(consentimientos);
        },
        error: () => {
          fallo.set(true);
          lista.set(null);
        },
      }),
    );
    onCleanup(() => sub.unsubscribe());
  });

  return {
    de: (targetType, targetId) => {
      const actuales = lista();
      return actuales === null ? undefined : vigenteDe(actuales, targetType, targetId);
    },
    incorporar: (consent) => {
      if (consent === null) return;
      lista.update((actuales) => [consent, ...(actuales ?? []).filter((c) => c.id !== consent.id)]);
    },
    recargar: () => version.update((v) => v + 1),
    fallo: fallo.asReadonly(),
  };
}
