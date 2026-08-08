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
      .get<WirePatientPage>(this.url('/profiles/patients'), { params })
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
      .get<WirePatientDetail>(this.url(`/profiles/patients/${encodeURIComponent(profileId)}`))
      .pipe(
        map((body) => ({
          ...body,
          birthDate: maybeDate(body.birthDate),
          deceasedAt: maybeDate(body.deceasedAt),
          relatedPersons: body.relatedPersons.map((person): RelatedPerson => ({ ...person })),
          createdAt: new Date(body.createdAt),
          updatedAt: new Date(body.updatedAt),
        })),
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
      .get<WireOwnSummary>(this.url('/profiles/patients/me/summary'))
      .pipe(map((body) => ({ ...body, birthDate: maybeDate(body.birthDate) })));
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

type WireMergeEvent = Omit<PatientMergeEvent, 'recordedAt'> & { readonly recordedAt: string };

/** El evento con su marca de tiempo ya convertida. */
function toMergeEvent(body: WireMergeEvent): PatientMergeEvent {
  return { ...body, recordedAt: new Date(body.recordedAt) };
}

/** Una fila del listado con su fecha ya convertida. */
function toPatientListItem(item: WirePatientListItem): PatientListItem {
  return { ...item, birthDate: maybeDate(item.birthDate) };
}

/**
 * Convierte una fecha que puede no venir. Devolver `undefined` en vez de una
 * `Invalid Date` es lo que deja al consumidor distinguir «no hay dato» de «hay
 * un dato roto».
 */
function maybeDate(value?: string): Date | undefined {
  return value === undefined ? undefined : new Date(value);
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
