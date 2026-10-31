import { computed, effect, inject, signal, untracked, type Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { concat, defer, of, Subject, type Observable } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { ReferralsClient } from '../../../core/data-access/referrals/referrals.client';
import type { Referral } from '../../../core/data-access/referrals/referrals.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready, stale } from '../../../core/view-state/view-state';
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
 *
 * ## Una lectura a la vez
 *
 * Cada lectura cancela la anterior (`switchMap`): si la persona cambia con una
 * lectura en vuelo, la respuesta vieja no pisa a la nueva.
 *
 * ## Releer sin borrar
 *
 * Releer a la **misma** persona no vuelve a S2: la lista sigue a la vista
 * como S7 (`stale`, con la hora de la lectura anterior) hasta que llega la
 * nueva, para que el modal no salte. Otra persona sí arranca en S2: mostrar
 * las derivaciones de la anterior sería mostrar datos ajenos.
 *
 * ## Se relee sola al emitir
 *
 * Escucha `ReferralsClient.issued`: una derivación emitida para esta persona
 * la relee aunque el bloque que la emitió ya se haya desmontado (el médico
 * cerró el modal con el envío en vuelo).
 */
export class ConsultationReferrals {
  private readonly referrals = inject(ReferralsClient);

  readonly state = signal<ViewState<readonly Referral[]>>(loading());

  /** Cada pedido de lectura, con la persona que hay que leer. */
  private readonly reads = new Subject<string>();

  /** De quién son los datos que hay en `state`, y de cuándo. */
  private lastRead: { readonly profileId: string; readonly at: Date } | null = null;

  constructor(private readonly profileId: Signal<string>) {
    this.reads
      .pipe(
        switchMap((id) => this.read(id)),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));

    this.referrals.issued
      .pipe(
        filter((created) => created.patientProfileId === untracked(() => this.profileId())),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.reload());

    effect(() => {
      const id = this.profileId();
      untracked(() => this.reads.next(id));
    });
  }

  /**
   * Cuántas hay, o `null` sin lectura: un cero diría «no tiene ninguna»
   * cuando lo que pasa es que no se pudieron leer.
   */
  count(): number | null {
    return dataOf(this.state())?.length ?? null;
  }

  /**
   * Sin cifra, por qué: `loading` mientras se lee y `failed` si la lectura
   * falló; `null` con cifra (también al releer con datos, S7).
   */
  readonly missingCount = computed<'loading' | 'failed' | null>(() => {
    const state = this.state();
    if (dataOf(state) !== null) return null;
    return state.status === 'loading' ? 'loading' : 'failed';
  });

  /** Relee: tras responder o anular desde el detalle, y al reintentar. */
  reload(): void {
    this.reads.next(this.profileId());
  }

  private read(id: string): Observable<ViewState<readonly Referral[]>> {
    if (id === '') {
      this.lastRead = null;
      return of(loading());
    }
    return defer(() =>
      concat(
        of(this.whileReading(id)),
        this.referrals.listByPatient(id).pipe(
          map((rows) => {
            this.lastRead = { profileId: id, at: new Date() };
            return ready(rows) as ViewState<readonly Referral[]>;
          }),
          catchError((error: unknown) => of(errorToViewState<readonly Referral[]>(error))),
        ),
      ),
    );
  }

  /** Lo que se ve mientras viaja la lectura: lo anterior como S7, o S2. */
  private whileReading(id: string): ViewState<readonly Referral[]> {
    const previous = dataOf(untracked(() => this.state()));
    return previous !== null && this.lastRead?.profileId === id
      ? stale(previous, this.lastRead.at)
      : loading();
  }
}

/** Lo que acompaña a la cifra en la casilla: las derivaciones no son «de la historia». */
export function referralCountLabel(count: number | null): string {
  return count === 1 ? 'derivación' : 'derivaciones';
}
