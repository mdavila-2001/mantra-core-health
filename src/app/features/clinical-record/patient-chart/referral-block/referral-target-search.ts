import { computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, Subject } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { ReferralsClient } from '../../../../core/data-access/referrals/referrals.client';
import { referralErrorDetail } from '../../../../core/data-access/referrals/referrals.errors';
import type { ReferralTarget, ReferralTargetKind } from '../../../../core/data-access/referrals/referrals.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { writeFailureMessage } from '../../write-message';
import type { ReferralDestinationKind } from './referral-block.model';

/** Una búsqueda de destinos, o `null`: olvidar la que esté en vuelo. */
type TargetQuery = { readonly q: string; readonly kind: ReferralTargetKind } | null;

/** Lo que vuelve de una búsqueda (vacío en el reinicio). */
interface TargetQueryResult {
  readonly items: readonly ReferralTarget[];
  readonly failure: string | null;
}

/**
 * La búsqueda de destinos del bloque «Derivar» (`GET /referrals/targets`).
 *
 * Aparte del bloque porque es un estado propio —resultados, «buscando», el
 * error— con una regla que no es del formulario: **una respuesta vieja nunca
 * repuebla las opciones**. `switchMap` cancela la búsqueda anterior; un
 * `reset()` la cancela sin empezar otra: al cambiar de clase de destino, al
 * olvidar el elegido, y cuando el combobox avisa `queryCleared` (lo escrito
 * bajó del mínimo, o se descartó al cerrar con Escape, Tab o al salir del
 * campo). Como toda vía que cambia la clase pasa por `reset()`, no hace
 * falta mirar la clase de la respuesta.
 *
 * Se crea en el contexto de inyección del bloque (un campo).
 */
export class ReferralTargetSearch {
  private readonly referrals = inject(ReferralsClient);
  private readonly auth = inject(AuthService);

  readonly searching = signal(false);
  readonly error = signal<string | null>(null);
  private readonly results = signal<readonly ReferralTarget[]>([]);
  private readonly queries = new Subject<TargetQuery>();

  readonly options = computed<readonly ReferenceOption[]>(() =>
    this.results().map((r) => ({
      value: r.id,
      label: r.displayName,
      ...(r.subtitle === null ? {} : { hint: r.subtitle }),
    })),
  );

  /** @param currentKind - La clase de destino elegida ahora en el bloque. */
  constructor(private readonly currentKind: () => ReferralDestinationKind) {
    this.queries
      .pipe(
        switchMap((query) =>
          query === null
            ? of<TargetQueryResult>({ items: [], failure: null })
            : this.referrals.searchTargets(query.q, query.kind).pipe(
                map((items): TargetQueryResult => ({ items, failure: null })),
                catchError((error: unknown) => of<TargetQueryResult>({ items: [], failure: failureOf(error) })),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ items, failure }) => {
        // Quien deriva no se ofrece a sí mismo, aunque la API lo devuelva.
        const self = this.auth.practitionerProfileId();
        this.searching.set(false);
        this.results.set(items.filter((r) => !(r.kind === 'PRACTITIONER' && r.id === self)));
        this.error.set(failure);
      });
  }

  /**
   * Busca por lo escrito. El combobox sólo emite desde
   * `REFERRAL_TARGET_MIN_QUERY` letras, y «Externo» no tiene buscador.
   */
  search(text: string): void {
    const kind = this.currentKind();
    if (kind === 'EXTERNAL') return;
    this.searching.set(true);
    this.queries.next({ q: text.trim(), kind });
  }

  /** El destino ofrecido con ese id, si sigue entre los resultados. */
  find(id: string): ReferralTarget | undefined {
    return this.results().find((r) => r.id === id);
  }

  /** Olvida resultados y error, y cancela la búsqueda en vuelo. */
  reset(): void {
    this.queries.next(null);
    this.searching.set(false);
    this.results.set([]);
    this.error.set(null);
  }
}

function failureOf(error: unknown): string {
  return (
    referralErrorDetail(error)?.message ??
    writeFailureMessage(errorToViewState<null>(error), { accion: 'buscar destinos' }) ??
    'No pudimos buscar. Pruebe de nuevo.'
  );
}
