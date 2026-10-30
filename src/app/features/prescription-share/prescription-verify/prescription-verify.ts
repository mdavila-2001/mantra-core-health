import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { PrescriptionSharesClient } from '../../../core/data-access/prescription-shares/prescription-shares.client';
import type {
  PrescriptionVerification,
  PrescriptionVerificationStatus,
} from '../../../core/data-access/prescription-shares/prescription-shares.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import type { AlertTone } from '../../../shared/components/molecules/alert/alert.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { markPageAsNoIndex } from '../no-index';
import { PRESCRIPTION_SHARE_TESTIDS } from '../prescription-share.testids';

/**
 * Un uuid, que es lo que el QR del PDF lleva y lo único que la API acepta
 * (`ParseUUIDPipe`): otra cosa respondería 400, y para quien escaneó es lo
 * mismo que una receta que no existe.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Qué le dice cada estado a quien escaneó el QR.
 *
 * Ninguno afirma que el papel sea el original: la API **recalcula** el sello de
 * la receta guardada y lo devuelve, pero no lo compara con nada —el front no
 * conoce el sello impreso—. Esa comparación la hace la persona, y la pantalla
 * se lo pide junto al sello (`SEAL_INSTRUCTION`).
 */
const STATUS_COPY: Readonly<
  Record<PrescriptionVerificationStatus, { title: string; detail: string; tone: AlertTone }>
> = {
  ISSUED: {
    title: 'Receta emitida',
    detail: 'Fue emitida en AloVida y no fue anulada ni reemplazada.',
    tone: 'success',
  },
  COMPLETED: {
    title: 'Receta ya utilizada',
    detail: 'Fue emitida en AloVida, pero ya se completó: no sirve para una nueva compra.',
    tone: 'warning',
  },
  INVALIDATED: {
    title: 'Receta anulada',
    detail: 'Quien la emitió la anuló: no tiene validez.',
    tone: 'error',
  },
  REPLACED: {
    title: 'Receta reemplazada',
    detail: 'Quien la emitió la reemplazó por otra: esta ya no tiene validez.',
    tone: 'error',
  },
  DRAFT: {
    title: 'Receta sin emitir',
    detail: 'Es un borrador: todavía no tiene validez.',
    tone: 'warning',
  },
};

/** Lo que hay que hacer con el sello: es la única defensa contra un papel alterado. */
const SEAL_INSTRUCTION =
  'Compare este sello con el impreso al pie de la receta. Si no es exactamente igual, la receta fue alterada: no la acepte.';

/**
 * `/verify/rx/:id` — a donde apunta el QR impreso en el PDF de la receta
 * (FAR-01, REQ-FAR-01-015). Hasta ahora caía en «Página no encontrada».
 *
 * Usa `GET /public/prescriptions/:id/verify`, que ya existía y no expone PHI:
 * estado, fecha de emisión, sello y matrícula. Ni el paciente, ni los
 * fármacos, ni el nombre de quien recetó.
 *
 * Misma forma que `verify/portability/:manifestHash`, con los estados por
 * `app-view-state-host`: S2 al consultar, S6 con texto propio para un id que
 * no existe (o que no tiene forma de id), S4/S8/S9 por el mapeo común.
 */
@Component({
  selector: 'app-prescription-verify',
  imports: [Alert, AppButtonLink, DatePipe, RouterLink, ViewStateHost],
  templateUrl: './prescription-verify.html',
  styleUrl: './prescription-verify.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrescriptionVerify {
  private readonly route = inject(ActivatedRoute);
  private readonly shares = inject(PrescriptionSharesClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly prescriptionId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly testids = PRESCRIPTION_SHARE_TESTIDS;
  protected readonly sealInstruction = SEAL_INSTRUCTION;

  protected readonly state = signal<ViewState<PrescriptionVerification>>(loading());

  protected readonly result = computed(() => dataOf(this.state()));

  protected readonly copy = computed(() => {
    const result = this.result();
    return result === null ? null : STATUS_COPY[result.status];
  });

  constructor() {
    markPageAsNoIndex();

    if (!UUID_PATTERN.test(this.prescriptionId)) {
      this.state.set(notFound());
      return;
    }
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    this.shares
      .verifyPrescription(this.prescriptionId.toLowerCase())
      .pipe(
        map((result) => ready(result)),
        catchError((error: unknown) => of(errorToViewState<PrescriptionVerification>(error))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.state.set(state));
  }
}
