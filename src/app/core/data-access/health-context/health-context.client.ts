import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, sinNulos } from '../wire';
import type {
  AgentCreated,
  CollectionRunStarted,
  ContextCreated,
  ContextQuery,
  ContextVersionDrafted,
  FinishRun,
  NewAgent,
  NewCollectionRun,
  NewContext,
  NewContextVersion,
  NewObservation,
  NewQualityReview,
  NewSchedule,
  NewSource,
  ObservationRecorded,
  QualityReviewRecorded,
  ResolvedContext,
  ResolvedFact,
  RunFinished,
  ScheduleCreated,
  SourceCreated,
  SupersedeVersion,
  VersionPublished,
  VersionSuperseded,
} from './health-context.types';

/**
 * Cliente de `health_context` (M44): el contexto sanitario de cada país,
 * recolectado con evidencia y publicado por versiones.
 *
 * **Doce operaciones y una sola lectura.** La única consulta es
 * `GET /health-context/contexts/resolve`, y no es un listado: exige país,
 * dominio y clave. No existe `GET` de colección de contextos, agentes, fuentes,
 * agendas, corridas ni observaciones, así que las pantallas del módulo operan
 * pegando identificadores.
 *
 * `POST /health-context/internal/schedules/run-due` **no se implementa acá**:
 * es `@Roles('SYSTEM')`, ninguna persona lo puede ejecutar, y un método que
 * siempre responde 403 sería código muerto con una fila de documentación
 * pidiendo mantenimiento.
 *
 * Los cuerpos viajan tal como los declaran los tipos: el backend valida con
 * `forbidNonWhitelisted`, así que una propiedad de más es un 400.
 */
@Injectable({
  providedIn: 'root',
})
export class HealthContextClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* -- La lectura ---------------------------------------------------------- */

  /**
   * `GET /health-context/contexts/resolve` — la versión vigente de un contexto.
   *
   * Los tres parámetros son obligatorios y los dos primeros pasan por
   * `ParseUUIDPipe`: un valor que no sea uuid es un 400, no un 404.
   *
   * Una versión caducada **no falla ni se oculta**: llega con `stale: true`.
   */
  resolveContext(query: ContextQuery): Observable<ResolvedContext> {
    const params = new HttpParams()
      .set('country', query.country)
      .set('domain', query.domain)
      .set('key', query.key);

    return this.http
      .get<ResolvedContextBody>(this.url('/health-context/contexts/resolve'), { params })
      .pipe(map(toResolvedContext));
  }

  /* -- Agentes y fuentes --------------------------------------------------- */

  /** `POST /health-context/agents` — alta de un agente recolector. */
  createAgent(agent: NewAgent): Observable<AgentCreated> {
    return this.http.post<AgentCreated>(this.url('/health-context/agents'), agent);
  }

  /** `POST /health-context/sources` — alta de una fuente con su licencia. */
  createSource(source: NewSource): Observable<SourceCreated> {
    return this.http.post<SourceCreated>(this.url('/health-context/sources'), source);
  }

  /** `POST /health-context/schedules` — cada cuánto se vuelve a mirar. */
  createSchedule(schedule: NewSchedule): Observable<ScheduleCreated> {
    return this.http
      .post<ScheduleCreatedBody>(this.url('/health-context/schedules'), schedule)
      .pipe(map(toScheduleCreated));
  }

  /* -- Contextos y versiones ----------------------------------------------- */

  /** `POST /health-context/contexts` — el contexto nace en borrador. */
  createContext(context: NewContext): Observable<ContextCreated> {
    return this.http.post<ContextCreated>(this.url('/health-context/contexts'), context);
  }

  /**
   * `POST /health-context/contexts/:contextId/versions` — redactar una versión.
   *
   * No toca `current_version_id`: publicar es una decisión aparte, y antes hay
   * que pasar por revisión de calidad.
   */
  draftVersion(contextId: string, version: NewContextVersion): Observable<ContextVersionDrafted> {
    return this.http.post<ContextVersionDrafted>(
      this.url(`/health-context/contexts/${encodeURIComponent(contextId)}/versions`),
      version,
    );
  }

  /** `POST /health-context/versions/:versionId/quality-reviews` — aprobar o rechazar. */
  recordQualityReview(
    versionId: string,
    review: NewQualityReview,
  ): Observable<QualityReviewRecorded> {
    return this.http.post<QualityReviewRecorded>(
      this.url(`/health-context/versions/${encodeURIComponent(versionId)}/quality-reviews`),
      review,
    );
  }

  /**
   * `POST /health-context/versions/:versionId/publish` — sin cuerpo.
   *
   * Deja superseded a la publicada anterior en la misma transacción: hay una
   * sola versión publicada por contexto.
   */
  publishVersion(versionId: string): Observable<VersionPublished> {
    return this.http.post<VersionPublished>(
      this.url(`/health-context/versions/${encodeURIComponent(versionId)}/publish`),
      {},
    );
  }

  /** `POST /health-context/versions/:versionId/supersede` — retirar una versión. */
  supersedeVersion(versionId: string, retiro: SupersedeVersion): Observable<VersionSuperseded> {
    return this.http.post<VersionSuperseded>(
      this.url(`/health-context/versions/${encodeURIComponent(versionId)}/supersede`),
      retiro,
    );
  }

  /* -- Recolección --------------------------------------------------------- */

  /**
   * `POST /health-context/collection-runs` — arrancar una corrida.
   *
   * Es idempotente por `idempotencyKey`: si la clave ya existía, la respuesta
   * llega con `duplicate: true` y no se creó nada.
   */
  startCollectionRun(run: NewCollectionRun): Observable<CollectionRunStarted> {
    return this.http.post<CollectionRunStarted>(this.url('/health-context/collection-runs'), run);
  }

  /** `POST /health-context/collection-runs/:collectionRunId/observations`. */
  recordObservation(
    collectionRunId: string,
    observation: NewObservation,
  ): Observable<ObservationRecorded> {
    return this.http.post<ObservationRecorded>(
      this.url(
        `/health-context/collection-runs/${encodeURIComponent(collectionRunId)}/observations`,
      ),
      observation,
    );
  }

  /** `POST /health-context/collection-runs/:collectionRunId/finish` — se cierra una vez. */
  finishCollectionRun(collectionRunId: string, cierre: FinishRun): Observable<RunFinished> {
    return this.http.post<RunFinished>(
      this.url(`/health-context/collection-runs/${encodeURIComponent(collectionRunId)}/finish`),
      cierre,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ---- formas de transporte ---------------------------------------------------
   Los opcionales llegan como `null`, no ausentes — ver `wire.ts`. Las dos
   marcas de tiempo son instantes de verdad (cuándo se observó, cuándo caduca),
   así que van por `maybeDate` y no por `maybeDateOnly`. */

type ScheduleCreatedBody = Omit<ScheduleCreated, 'nextRunAt'> & {
  readonly nextRunAt?: string | null;
};

function toScheduleCreated(body: ScheduleCreatedBody): ScheduleCreated {
  const { nextRunAt, ...resto } = body;
  const convertida = maybeDate(nextRunAt);
  return convertida === undefined ? resto : { ...resto, nextRunAt: convertida };
}

type ResolvedFactBody = {
  readonly [K in keyof ResolvedFact]: ResolvedFact[K] | null;
};

type ResolvedContextBody = Omit<ResolvedContext, 'observedAt' | 'expiresAt' | 'facts'> & {
  readonly observedAt?: string | null;
  readonly expiresAt?: string | null;
  readonly facts: readonly ResolvedFactBody[];
};

function toResolvedContext(body: ResolvedContextBody): ResolvedContext {
  const { observedAt, expiresAt, facts, ...resto } = body;
  const observado = maybeDate(observedAt);
  const caduca = maybeDate(expiresAt);

  return {
    ...resto,
    ...(observado === undefined ? {} : { observedAt: observado }),
    ...(caduca === undefined ? {} : { expiresAt: caduca }),
    facts: facts.map((fact) => sinNulos<ResolvedFact>(fact)),
  };
}
