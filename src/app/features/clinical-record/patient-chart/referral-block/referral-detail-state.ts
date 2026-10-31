import { inject, signal, type Signal } from '@angular/core';

import type { InformedConsent } from '../../../../core/data-access/informed-consents/informed-consents.types';
import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import { referralErrorDetail } from '../../../../core/data-access/referrals/referrals.errors';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { writeFailureMessage } from '../../write-message';
import type { PatientConsents } from '../informed-consent/patient-consents';

/** Lo que el bloque necesita para abrir y mantener al día el detalle de una derivación. */
export interface ReferralDetailState {
  /** La derivación abierta en el detalle, tal como la devolvió la API. */
  readonly opened: Signal<Referral | null>;
  /** Recién emitida: el detalle ofrece el consentimiento como próximo paso. */
  readonly justIssued: Signal<boolean>;
  readonly openingError: Signal<string | null>;
  /** Abre el detalle con la versión del servidor (`GET /referrals/:id`). */
  open(id: string, justIssued?: boolean): void;
  close(): void;
  /** El destino respondió, contrarrefirió o se anuló: se muestra lo del servidor. */
  changed(updated: Referral): void;
  /**
   * El panel registró o revocó un consentimiento de ESTA derivación. El
   * vínculo lo escribe la API (`informedConsentId`): se relee la derivación y
   * se muestra lo que el servidor dice, no lo que el panel supone.
   */
  consentChanged(referralId: string, consent: InformedConsent | null): void;
}

/**
 * El detalle de una derivación del bloque. Se llama en contexto de inyección
 * (inicializador de campo), igual que `patientConsents`.
 *
 * @param consents - Los consentimientos del bloque, para la insignia de la fila.
 * @param onChange - Lo que hace el bloque cuando algo cambió en el servidor (releer la lista).
 */
export function referralDetailState(consents: PatientConsents, onChange: () => void): ReferralDetailState {
  const client = inject(ReferralsClient);
  const opened = signal<Referral | null>(null);
  const justIssued = signal(false);
  const openingError = signal<string | null>(null);

  return {
    opened: opened.asReadonly(),
    justIssued: justIssued.asReadonly(),
    openingError: openingError.asReadonly(),
    open: (id, issued = false) => {
      openingError.set(null);
      client.get(id).subscribe({
        next: (referral) => {
          justIssued.set(issued);
          opened.set(referral);
        },
        error: (error: unknown) =>
          openingError.set(
            referralErrorDetail(error)?.message ??
              writeFailureMessage(errorToViewState<null>(error), { accion: 'abrir la derivación' }) ??
              'No pudimos abrir la derivación. Pruebe de nuevo.',
          ),
      });
    },
    close: () => {
      opened.set(null);
      justIssued.set(false);
    },
    changed: (updated) => {
      opened.set(updated);
      justIssued.set(false);
      onChange();
    },
    consentChanged: (referralId, consent) => {
      // Registrado el consentimiento, el «próximo paso» ya se dio.
      justIssued.set(false);
      consents.upsert(consent);
      client.get(referralId).subscribe({
        next: (reread) => {
          if (opened()?.id === reread.id) opened.set(reread);
        },
        error: () => undefined,
      });
      onChange();
    },
  };
}
