import { computed, inject, signal } from '@angular/core';

import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import type { ReferralTarget, ReferralTargetService } from '../../../../core/data-access/referrals/referrals.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { serviceOptions } from './referral-block.model';

/**
 * Los servicios del destino elegido (`GET /referrals/target-services`) y el
 * que se eligió de ellos, para el bloque «Derivar».
 *
 * La regla que vive acá: **una respuesta tardía de un destino ya descartado
 * no pisa al nuevo**. Vacía también es `ready`: el aviso «sin servicios» lo
 * dibuja la plantilla en línea, no como un S3 de página.
 *
 * Se crea en el contexto de inyección del bloque (un campo).
 */
export class ReferralTargetServices {
  private readonly referrals = inject(ReferralsClient);

  readonly state = signal<ViewState<readonly ReferralTargetService[]>>(loading());
  readonly selected = signal<string | null>(null);

  /** El destino no publica servicios. */
  readonly none = computed(() => {
    const state = this.state();
    return state.status === 'ready' && state.data.length === 0;
  });

  readonly options = computed(() => serviceOptions(dataOf(this.state()) ?? []));

  /** La descripción del servicio elegido, para no elegir a ciegas por el nombre. */
  readonly hint = computed(() => {
    const chosen = (dataOf(this.state()) ?? []).find((s) => s.id === this.selected());
    if (chosen === undefined) {
      return 'Opcional. Uno de los servicios que ofrece el destino, con su arancel.';
    }
    return chosen.description ?? 'El servicio que se le pide al destino.';
  });

  /** @param currentTarget - El destino elegido ahora en el bloque. */
  constructor(private readonly currentTarget: () => ReferralTarget | null) {}

  /** Lee los servicios del destino elegido; sin destino, nada. */
  load(): void {
    const target = this.currentTarget();
    if (target === null) return;
    this.selected.set(null);
    this.state.set(loading());
    this.referrals
      .listTargetServices(
        target.kind === 'PRACTITIONER' ? { targetProfileId: target.id } : { targetTenantId: target.id },
      )
      .subscribe({
        next: (items) => {
          if (this.currentTarget()?.id === target.id) this.state.set(ready(items));
        },
        error: (error: unknown) => {
          if (this.currentTarget()?.id === target.id) this.state.set(errorToViewState(error));
        },
      });
  }

  reset(): void {
    this.selected.set(null);
    this.state.set(loading());
  }
}
