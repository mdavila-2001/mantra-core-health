import { catchError, concatMap, from, map, mergeMap, of, toArray, type Observable } from 'rxjs';

import type { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportEngagement } from '../../../core/data-access/support-access/support-access.types';

/** Lo que pasó con una persona dentro de una operación en lote. */
export interface BatchOutcome {
  readonly engagementId: string;
  readonly personName: string;
  readonly ok: boolean;
  /** Cuántos permisos se retiraron (solo en «quitar permisos»). */
  readonly revoked?: number;
}

/** Cuántas personas se atienden a la vez: lo justo para que un lote grande no sature a la API. */
const CONCURRENCY = 3;

function runBatch(people: readonly SupportEngagement[], task: (e: SupportEngagement) => Observable<number | undefined>): Observable<readonly BatchOutcome[]> {
  return from(people).pipe(
    mergeMap(
      (e) =>
        task(e).pipe(
          map((revoked): BatchOutcome => ({ engagementId: e.id, personName: e.personName, ok: true, ...(revoked === undefined ? {} : { revoked }) })),
          // Una persona que falla no frena a las demás: el lote sigue y el resumen dice cuáles no.
          catchError(() => of<BatchOutcome>({ engagementId: e.id, personName: e.personName, ok: false })),
        ),
      CONCURRENCY,
    ),
    toArray(),
  );
}

/** Confirma los vínculos de todas esas personas. Sin `months`, cada uno conserva su período. */
export function confirmBatch(client: Pick<SupportAccessClient, 'recertify'>, people: readonly SupportEngagement[], months?: 6 | 12): Observable<readonly BatchOutcome[]> {
  return runBatch(people, (e) => client.recertify(e.id, months).pipe(map(() => undefined)));
}

/** Retira todos los permisos de esas personas. El vínculo sigue, sin permisos. */
export function revokeBatch(client: Pick<SupportAccessClient, 'changeGrant'>, people: readonly SupportEngagement[]): Observable<readonly BatchOutcome[]> {
  return runBatch(people, (e) =>
    from(e.grants).pipe(
      concatMap((g) => client.changeGrant(e.id, { grantId: g.id, revoke: true })),
      toArray(),
      map((hechos) => hechos.length),
    ),
  );
}

/** El resumen para quien lo hizo: cuántos salieron bien y a quiénes no se les pudo. */
export function describeBatch(outcomes: readonly BatchOutcome[], doing: 'confirm' | 'revoke'): { readonly tone: 'success' | 'warning' | 'error'; readonly text: string } {
  const bien = outcomes.filter((o) => o.ok);
  const mal = outcomes.filter((o) => !o.ok);
  const personas = (n: number): string => (n === 1 ? '1 persona' : `${n} personas`);
  const accion = doing === 'confirm' ? 'Se confirmó el vínculo de' : 'Se quitaron los permisos de';
  if (mal.length === 0) return { tone: 'success', text: `${accion} ${personas(bien.length)}.` };
  const fallaron = `No se pudo con ${mal.map((o) => o.personName).join(', ')}: vuelva a intentarlo con ellas.`;
  if (bien.length === 0) return { tone: 'error', text: fallaron };
  return { tone: 'warning', text: `${accion} ${personas(bien.length)}. ${fallaron}` };
}
