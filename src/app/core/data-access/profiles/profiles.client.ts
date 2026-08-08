import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AccountLink,
  NewPatientProfile,
  NewPractitionerProfile,
  NewRelatedPerson,
  OwnPatientSummary,
  PatientDetail,
  PatientMergeEvent,
  PatientMergeRequest,
  PatientListItem,
  PatientPage,
  PatientProfile,
  PatientSearchQuery,
  PractitionerProfile,
  RelatedPerson,
  RelatedPersonCreated,
} from './profiles.types';

/** Las mismas respuestas, con las fechas como viajan: texto. */
type Wire<T> = { readonly [K in keyof T]: T[K] extends Date ? string : T[K] };

/**
 * Las fechas opcionales necesitan su propia forma: `Date | undefined` no
 * extiende `Date`, así que {@link Wire} las dejaría tipadas como `Date` y el
 * texto que de verdad llega pasaría sin convertir.
 */
type WireDates<T, K extends keyof T> = Omit<T, K> & Partial<Readonly<Record<K, string>>>;

/**
 * Cliente de `profiles`: personas, pacientes y profesionales.
 *
 * El alta es atómica del lado del servidor (regla CTI del modelo: `persons →
 * person_profiles → *_profiles` en una sola transacción), así que acá alcanza
 * con una petición: nunca hay que crear la persona por separado.
 */
@Injectable({
  providedIn: 'root',
})
export class ProfilesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /profiles/patients` — una página del listado (UC-05-13).
   *
   * Paginación **por cursor**: la respuesta no trae total, así que quien la
   * consuma no puede ofrecer «página 7 de 42». Es deliberado del backend.
   *
   * @param query - Texto libre, cursor de continuación y tope de página.
   * @returns La página con su cursor siguiente, o `null` si no hay más.
   */
  searchPatients(query: PatientSearchQuery = {}): Observable<PatientPage> {
    // Parámetro a parámetro, no con un objeto: el backend valida con
    // `forbidNonWhitelisted` y un opcional en `undefined` viaja como clave
    // declarada, que vuelve 400.
    let params = new HttpParams();
    if (query.query !== undefined && query.query !== '') {
      params = params.set('q', query.query);
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<RespuestaPagina>(this.url('/profiles/patients'), { params })
      .pipe(
        map((body) => ({
          ...body,
          items: body.items.map(toPatientListItem),
        })),
      );
  }

  /**
   * `GET /profiles/patients/:profileId` — ficha de filiación F-01 (UC-05-14).
   *
   * Sin datos clínicos: eso vive en `clinical` y en `chart`, y lo administra
   * otro rol.
   */
  getPatient(profileId: string): Observable<PatientDetail> {
    return this.http
      .get<RespuestaFicha>(this.url(`/profiles/patients/${encodeURIComponent(profileId)}`))
      .pipe(
        map(({ relatedPersons, ...resto }) => {
          const limpio = sinNulos<Omit<WirePatientDetail, 'relatedPersons'>>(resto);
          return {
            ...limpio,
            birthDate: maybeDateOnly(limpio.birthDate),
            deceasedAt: maybeDate(limpio.deceasedAt),
            relatedPersons: relatedPersons.map((persona) => sinNulos<RelatedPerson>(persona)),
            createdAt: new Date(limpio.createdAt),
            updatedAt: new Date(limpio.updatedAt),
          };
        }),
      );
  }

  /**
   * `GET /profiles/patients/me/summary` — el resumen propio (V05-03).
   *
   * Autoservicio: el backend resuelve el sujeto desde la sesión y no admite
   * consultar por otro. Exige identidad verificada vigente; sin ella responde
   * `403 IDENTITY_VERIFICATION_REQUIRED`, que la capa de errores convierte en
   * un estado con salida hacia la verificación en vez de un muro.
   */
  getOwnSummary(): Observable<OwnPatientSummary> {
    return this.http
      .get<RespuestaResumen>(this.url('/profiles/patients/me/summary'))
      .pipe(
        map((body) => {
          const limpio = sinNulos<WireOwnSummary>(body);
          return { ...limpio, birthDate: maybeDateOnly(limpio.birthDate) };
        }),
      );
  }

  /**
   * `POST /profiles/patients/merge` — fusiona dos pacientes duplicados
   * (UC-05-08).
   *
   * El orden de los dos perfiles **no es simétrico**: el que sobrevive conserva
   * su historia y el otro queda absorbido. Intercambiarlos no es lo mismo, y
   * por eso los dos viajan con nombre y no como un par.
   */
  mergePatients(request: PatientMergeRequest): Observable<PatientMergeEvent> {
    return this.http
      .post<WireMergeEvent>(this.url('/profiles/patients/merge'), stripUndefined(request))
      .pipe(map(toMergeEvent));
  }

  /**
   * `POST /profiles/patients/merge/:eventId/reverse` — revierte una fusión
   * (UC-05-09).
   *
   * `eventId` sale de la respuesta de {@link mergePatients} y **no hay ninguna
   * otra forma de obtenerlo**: el backend no expone listado de eventos de
   * fusión. Quien pierda ese identificador pierde el camino de vuelta desde la
   * interfaz.
   */
  reverseMerge(eventId: string, reasonConceptId?: string): Observable<PatientMergeEvent> {
    return this.http
      .post<WireMergeEvent>(
        this.url(`/profiles/patients/merge/${encodeURIComponent(eventId)}/reverse`),
        reasonConceptId === undefined ? {} : { reasonConceptId },
      )
      .pipe(map(toMergeEvent));
  }

  /**
   * `POST /profiles/patients/:profileId/related-persons` — registra un contacto
   * o representante (UC-05-10).
   *
   * Sin `personId` el backend **crea** la persona con los datos del cuerpo; con
   * él, reutiliza una ya registrada. La pantalla decide cuál de los dos casos
   * es; el cliente sólo se ocupa de no mandar lo que no tiene valor.
   *
   * Es el único endpoint de este módulo **sin `@Roles`**: lo puede ejercer
   * cualquier sesión autenticada.
   */
  addRelatedPerson(
    profileId: string,
    person: NewRelatedPerson,
  ): Observable<RelatedPersonCreated> {
    return this.http
      .post<Wire<RelatedPersonCreated>>(
        this.url(`/profiles/patients/${encodeURIComponent(profileId)}/related-persons`),
        stripUndefined(person),
      )
      .pipe(map((body) => ({ ...body, createdAt: new Date(body.createdAt) })));
  }

  /** `POST /profiles/patients`. */
  createPatient(profile: NewPatientProfile): Observable<PatientProfile> {
    return this.http
      .post<Wire<PatientProfile>>(this.url('/profiles/patients'), stripUndefined(profile))
      .pipe(map((body) => ({ ...body, createdAt: new Date(body.createdAt) })));
  }

  /** `POST /profiles/practitioners`. */
  createPractitioner(profile: NewPractitionerProfile): Observable<PractitionerProfile> {
    return this.http
      .post<Wire<PractitionerProfile>>(this.url('/profiles/practitioners'), stripUndefined(profile))
      .pipe(map((body) => ({ ...body, createdAt: new Date(body.createdAt) })));
  }

  /**
   * `POST /profiles/persons/:personId/account-links`. Ata una cuenta de acceso
   * a una persona ya registrada.
   */
  linkAccount(personId: string, userId: string, linkTypeConceptId?: string): Observable<AccountLink> {
    return this.http
      .post<Wire<AccountLink>>(this.url(`/profiles/persons/${personId}/account-links`), {
        userId,
        ...(linkTypeConceptId === undefined ? {} : { linkTypeConceptId }),
      })
      .pipe(map((body) => ({ ...body, validFrom: new Date(body.validFrom) })));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ---- formas de transporte de las lecturas --------------------------------
   Las fechas llegan como texto ISO. Se declaran acá, y no en `profiles.types`,
   porque son del protocolo: quien consuma el cliente ve `Date`. */

type WirePatientListItem = WireDates<PatientListItem, 'birthDate'>;

interface WirePatientPage extends Omit<PatientPage, 'items'> {
  readonly items: readonly WirePatientListItem[];
}

type WirePatientDetail = Omit<
  WireDates<PatientDetail, 'birthDate' | 'deceasedAt'>,
  'relatedPersons' | 'createdAt' | 'updatedAt'
> & {
  readonly relatedPersons: readonly RelatedPerson[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

type WireOwnSummary = WireDates<OwnPatientSummary, 'birthDate'>;

/* Lo que de verdad llega por el cable: la misma forma, con `null` donde el
   backend no omite la clave. Se declara aparte para que el tipo del `get<>`
   diga la verdad y la conversión no sea un acto de fe. */
type RespuestaPagina = Omit<WirePatientPage, 'items'> & {
  readonly items: readonly ConNulos<WirePatientListItem>[];
};
/* `relatedPersons` nunca llega nulo —el contrato la declara obligatoria y la
   API viva devuelve `[]`—, así que se saca de la normalización y se trata
   aparte: sus elementos sí traen opcionales en `null`. */
type RespuestaFicha = ConNulos<Omit<WirePatientDetail, 'relatedPersons'>> & {
  readonly relatedPersons: readonly ConNulos<RelatedPerson>[];
};
type RespuestaResumen = ConNulos<WireOwnSummary>;

type WireMergeEvent = Omit<PatientMergeEvent, 'recordedAt'> & { readonly recordedAt: string };

/** El evento con su marca de tiempo ya convertida. */
function toMergeEvent(body: WireMergeEvent): PatientMergeEvent {
  return { ...body, recordedAt: new Date(body.recordedAt) };
}

/** Una fila del listado con su fecha ya convertida. */
function toPatientListItem(item: ConNulos<WirePatientListItem>): PatientListItem {
  const limpio = sinNulos<WirePatientListItem>(item);
  return { ...limpio, birthDate: maybeDateOnly(limpio.birthDate) };
}

/**
 * Convierte una fecha que puede no venir.
 *
 * **`== null` y no `=== undefined`**, y la diferencia costó un defecto real: el
 * backend manda los opcionales vacíos como `null`, no los omite, y
 * `new Date(null)` **no** es una fecha inválida — es el 1 de enero de 1970.
 * Un paciente sin fecha de nacimiento se mostraba como nacido en 1969.
 *
 * Devolver `undefined` en vez de una `Invalid Date` es lo que deja al
 * consumidor distinguir «no hay dato» de «hay un dato roto».
 */
function maybeDate(value?: string | null): Date | undefined {
  return value == null ? undefined : new Date(value);
}

/**
 * Convierte una fecha **sin hora** (`birthDate`) a la medianoche **local**.
 *
 * El contrato la declara `format: 'date'`, pero el servidor la serializa como
 * instante: `"1985-03-14T00:00:00.000Z"`. Pasarla por `new Date()` la ancla a
 * medianoche UTC, y al pintarla en hora local **retrocede un día** en cualquier
 * huso al oeste de Greenwich.
 *
 * Verificado contra la API viva el 2026-08-08 desde `America/La_Paz` (UTC−4):
 * se guardó `1985-03-14`, el servidor devolvió `1985-03-14T00:00:00.000Z` y la
 * pantalla mostraba **13/03/1985**. Un día de diferencia en la fecha de
 * nacimiento de alguien.
 *
 * Es el **espejo** del cuidado que ya tenían los formularios al enviar: allá se
 * arma el `YYYY-MM-DD` con los componentes locales para no correrlo al pasar
 * por UTC. Acá se hace el camino de vuelta.
 *
 * Una fecha con hora de verdad —`deceasedAt`, `createdAt`— **no** pasa por acá:
 * ahí el instante es el dato y convertirlo sería romperlo.
 */
function maybeDateOnly(value?: string | null): Date | undefined {
  if (value == null) {
    return undefined;
  }
  const [anio, mes, dia] = value.slice(0, 10).split('-').map(Number);
  if (anio === undefined || mes === undefined || dia === undefined) {
    return undefined;
  }
  return new Date(anio, mes - 1, dia);
}

/* ============================================================================
    El transporte manda `null`; los tipos de la vista dicen `?:`

    Verificado contra la API viva el 2026-08-08: `GET /profiles/patients/:id`
    devuelve `"birthDate": null`, `"deceasedAt": null`,
    `"administrativeGenderConceptId": null`… — **no omite las claves**.

    Los tipos de la vista declaran esos campos como `?:`, que en TypeScript
    significa `undefined`. La diferencia no es cosmética:

    - `new Date(null)` da **1970-01-01**, no `Invalid Date`.
    - `deceasedAt !== undefined` es **`true`** cuando vale `null`, así que la
      ficha marcaba **fallecida a toda persona viva**.

    Las pruebas unitarias no lo veían porque fabricaban las respuestas con la
    clave **ausente**, que es como yo suponía que venía. Es el mismo patrón que
    el defecto de `details.messages` vs `details.violations`: una suposición
    sobre la forma del cuerpo que sólo se cae al hablar con el servidor.

    Se normaliza **en la frontera**, que es donde se promete la forma: quitar la
    clave nula la vuelve ausente, y ausente es exactamente lo que `?:` declara.
    ========================================================================== */

/** La misma forma, admitiendo el `null` que el transporte sí manda. */
type ConNulos<T> = { readonly [K in keyof T]: T[K] | null };

/**
 * Quita las claves que llegaron en `null`.
 *
 * No convierte a `undefined` explícito: **elimina la clave**. Es la única forma
 * de que `'x' in objeto` y `Object.keys()` digan lo mismo que el tipo.
 */
function sinNulos<T extends object>(body: ConNulos<T>): T {
  return Object.fromEntries(
    Object.entries(body).filter(([, valor]) => valor !== null),
  ) as T;
}

/**
 * Quita las claves sin valor antes de enviar. El backend valida con
 * `forbidNonWhitelisted`, y un opcional presente en `undefined` viaja como
 * clave declarada: mejor no mandarla.
 */
function stripUndefined<T extends object>(source: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  );
}
