import { DOCUMENT } from '@angular/common';
import { ApplicationRef, EnvironmentInjector, Injectable, createComponent, inject, type ComponentRef } from '@angular/core';
import { Observable, catchError, defer, switchMap, throwError } from 'rxjs';

import {
  AccessChallengeCancelledError,
  classifyAccessChallenge,
  type AccessChallenge,
  type AccessChallengeOptions,
  type AccessChallengeResolver,
  type ChallengeAnswer,
} from '../../../core/access-challenge/access-challenge';
import type { AccessChallengeDialog } from './access-challenge-dialog';

/** Cuántos desafíos seguidos se resuelven en una misma acción: motivo, segundo paso y aprobación. */
export const MAX_RUN_ROUNDS = 3;

/**
 * Abre el **diálogo de desafío** y devuelve lo que la persona aportó. Es lo que las pantallas y los clientes de agenda,
 * bandeja y caja invocan cuando la API responde `REASON_REQUIRED`, `STEP_UP_REQUIRED` o `APPROVAL_REQUIRED`.
 *
 * Dos formas de uso:
 *
 * ```ts
 * // 1) Transparente, por el interceptor: la petición lleva la marca y el reintento lo hace `accessChallengeInterceptor`.
 * http.post(url, body, { context: withAccessChallenge({ approval: { atom: 'agenda.appointment.cancel', … } }) });
 *
 * // 2) Explícita: la pantalla decide qué reintentar.
 * this.challenges.run((answer) => this.client.cancelBooking(id, { ...body, ...(answer.reasonText ? { reasonText: answer.reasonText } : {}) }, answer.approvalId));
 * ```
 *
 * La autoridad es la API: si el reintento vuelve a fallar, el error sigue su camino. Cerrar el diálogo sin resolver el
 * desafío termina el flujo con `AccessChallengeCancelledError` (no es un error de la API: es una decisión de la persona).
 * El diálogo se carga bajo demanda y se monta fuera de la plantilla, como `DialogService`.
 */
@Injectable({ providedIn: 'root' })
export class AccessChallengeService implements AccessChallengeResolver {
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);

  /** Abre el diálogo para un desafío y emite una vez la respuesta (o falla con la cancelación). */
  resolve(challenge: AccessChallenge, options: AccessChallengeOptions = {}): Observable<ChallengeAnswer> {
    return new Observable<ChallengeAnswer>((subscriber) => {
      let ref: ComponentRef<AccessChallengeDialog> | null = null;
      let host: HTMLElement | null = null;
      let disposed = false;
      const previousFocus = this.document.activeElement as HTMLElement | null;
      const dispose = (): void => {
        if (disposed) return;
        disposed = true;
        if (ref !== null) {
          this.appRef.detachView(ref.hostView);
          ref.destroy();
        }
        host?.remove();
        previousFocus?.focus?.();
      };

      void import('./access-challenge-dialog').then(({ AccessChallengeDialog: Dialog }) => {
        if (disposed) return;
        host = this.document.createElement('div');
        this.document.body.appendChild(host);
        ref = createComponent(Dialog, { environmentInjector: this.injector, hostElement: host });
        ref.setInput('challenge', challenge);
        ref.setInput('options', options);
        ref.instance.answered.subscribe((answer) => {
          dispose();
          subscriber.next(answer);
          subscriber.complete();
        });
        ref.instance.cancelled.subscribe(() => {
          dispose();
          subscriber.error(new AccessChallengeCancelledError());
        });
        this.appRef.attachView(ref.hostView);
        ref.changeDetectorRef.detectChanges();
      });

      return dispose;
    });
  }

  /**
   * Ejecuta `attempt` y, si la API responde con un desafío, lo resuelve con la persona y vuelve a ejecutarlo con lo
   * acumulado (el motivo, la aprobación). Hasta {@link MAX_RUN_ROUNDS} rondas. Un desafío sin salida (`BLOCKED`) se
   * muestra en el diálogo y termina con la cancelación.
   */
  run<T>(attempt: (answer: ChallengeAnswer) => Observable<T>, options: AccessChallengeOptions = {}): Observable<T> {
    const step = (answer: ChallengeAnswer, round: number): Observable<T> =>
      attempt(answer).pipe(
        catchError((error: unknown) => {
          const challenge = round >= MAX_RUN_ROUNDS ? null : classifyAccessChallenge(error);
          if (challenge === null) return throwError(() => error);
          if (challenge.kind === 'BLOCKED') return this.resolve(challenge, options).pipe(switchMap(() => throwError(() => error)));
          return this.resolve(challenge, options).pipe(switchMap((next) => step({ ...answer, ...next }, round + 1)));
        }),
      );
    return defer(() => step({}, 0));
  }
}
