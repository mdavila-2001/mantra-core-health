import { effect, inject, signal, untracked, type Signal } from '@angular/core';

import { ReferralsClient } from '../../../core/data-access/referrals/referrals.client';
import type { Referral } from '../../../core/data-access/referrals/referrals.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

/**
 * Las derivaciones de la persona que se atiende, leídas **una vez** para dos
 * consumidores: la casilla «Derivar», que las cuenta, y el bloque, que las
 * lista. Dos lecturas de la misma lista pueden discrepar.
 *
 * Van por su lado y no dentro de la lectura del expediente: son de otro
 * módulo, y un fallo acá no puede vaciar la rejilla. Se crea en el contexto
 * de inyección de la consulta (un campo del componente) y lee sola cada vez
 * que cambia la persona.
 */
export class ConsultationReferrals {
  private readonly referrals = inject(ReferralsClient);

  readonly state = signal<ViewState<readonly Referral[]>>(loading());

  constructor(private readonly profileId: Signal<string>) {
    effect(() => {
      const id = this.profileId();
      untracked(() => (id === '' ? this.state.set(loading()) : this.reload()));
    });
  }

  /**
   * Cuántas hay, o `null` sin lectura: un cero diría «no tiene ninguna»
   * cuando lo que pasa es que no se pudieron leer.
   */
  count(): number | null {
    return dataOf(this.state())?.length ?? null;
  }

  /** Relee: tras emitir una derivación y al reintentar. */
  reload(): void {
    this.state.set(loading());
    this.referrals.listByPatient(this.profileId()).subscribe({
      next: (rows) => this.state.set(ready(rows)),
      error: (error: unknown) => this.state.set(errorToViewState<readonly Referral[]>(error)),
    });
  }
}
