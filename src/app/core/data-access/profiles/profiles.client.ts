import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly, sinNulos, type ConNulos } from '../wire';
import type {
  AccountLink,
  NewJurisdictionAuthorization,
  NewPatientProfile,
  NewPractitionerProfile,
  NewRelatedPerson,
  NewSpecialty,
  OwnPatientSummary,
  OwnPractitionerProfile,
  PatientDetail,
  PatientMergeEvent,
  PatientMergeEventPage,
  PatientMergeEventQuery,
  PatientMergeRequest,
  PatientListItem,
  PatientPage,
  PatientProfile,
  PatientSearchQuery,
  PractitionerCredential,
  PractitionerLicense,
  PractitionerProfile,
  PractitionerSpecialty,
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
   * `GET /profiles/practitioners/me/summary` — el perfil profesional propio.
   *
   * Autoservicio, igual que el resumen del paciente: el sujeto lo resuelve el
   * backend desde la sesión y no hay forma de pedir el de otro profesional.
   *
   * A diferencia de aquél **no exige identidad verificada**: para un
   * profesional, verificar la identidad es verificar la matrícula, y eso se
   * gestiona desde este mismo perfil. Exigirla para leerlo dejaría a quien
   * todavía no la completó sin la pantalla que le dice qué le falta.
   *
   * Responde `404` cuando la sesión no tiene perfil profesional —una cuenta
   * administrativa, un paciente—, que es un caso normal y no un fallo.
   */
  getOwnPractitionerProfile(): Observable<OwnPractitionerProfile> {
    return this.http
      .get<ConNulos<WireOwnPractitioner>>(this.url('/profiles/practitioners/me/summary'))
      .pipe(map((body) => this.traducirPerfilPropio(body)));
  }

  /**
   * `PATCH /profiles/practitioners/me` — edita la presentación del perfil
   * propio: título, biografía, disponibilidad y telemedicina.
   *
   * Es lo que faltaba para que «configurar el perfil» significara algo: el alta
   * escribía estos campos una vez y no había forma de volver a tocarlos. Lo que
   * **no** se edita acá —estado de verificación, credenciales, matrículas— sale
   * del trámite que corresponde, no de un formulario de texto libre.
   *
   * Sólo se manda lo que cambió: un campo ausente en `cambios` no se toca, y
   * mandar `''` sí borra un texto — el backend hace esa misma distinción por
   * `undefined` contra presente, así que el cliente no rellena valores por
   * defecto acá.
   */
  updateOwnPractitionerProfile(
    cambios: Partial<{
      readonly professionalTitle: string;
      readonly professionalBio: string;
      readonly acceptsNewPatients: boolean;
      readonly telehealthAvailable: boolean;
    }>,
  ): Observable<OwnPractitionerProfile> {
    return this.http
      .patch<ConNulos<WireOwnPractitioner>>(this.url('/profiles/practitioners/me'), cambios)
      .pipe(map((body) => this.traducirPerfilPropio(body)));
  }

  /** La respuesta de la lectura y de la edición tienen la misma forma. */
  private traducirPerfilPropio(body: ConNulos<WireOwnPractitioner>): OwnPractitionerProfile {
    const limpio = sinNulos<WireOwnPractitioner>(body);
    return {
      ...limpio,
      createdAt: new Date(limpio.createdAt),
      // Cada colección trae sus propias fechas opcionales. Se convierten acá y
      // no en la plantilla para que ninguna llegue como texto a un `| date`,
      // que lo pinta crudo sin avisar.
      specialties: limpio.specialties.map((especialidad) => ({
        ...especialidad,
        validFrom: maybeDate(especialidad.validFrom),
        validTo: maybeDate(especialidad.validTo),
      })),
      credentials: limpio.credentials.map((credencial) => ({
        ...credencial,
        issueDate: maybeDate(credencial.issueDate),
        expiryDate: maybeDate(credencial.expiryDate),
        verifiedAt: maybeDate(credencial.verifiedAt),
      })),
      licenses: limpio.licenses.map((matricula) => ({
        ...matricula,
        validFrom: maybeDate(matricula.validFrom),
        validTo: maybeDate(matricula.validTo),
      })),
    };
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
   * `GET /profiles/patients/merge-events` — los eventos de fusión (UC-05-09·L).
   *
   * Es lo que hace que «revertir» signifique lo que parece. Antes el `eventId`
   * sólo existía en la respuesta de {@link mergePatients}, así que una fusión
   * dejaba de ser reversible desde la interfaz en cuanto esa respuesta se perdía
   * de vista: quien se daba cuenta del error al día siguiente no tenía camino.
   *
   * El filtro por paciente busca en **los dos lados** de la fusión, del lado del
   * backend: quien revisa un registro no sabe si el que mira sobrevivió o fue el
   * absorbido.
   *
   * @param query - Paciente involucrado y tope, ambos opcionales.
   * @returns Los eventos, del más reciente al más antiguo.
   */
  listMergeEvents(query: PatientMergeEventQuery = {}): Observable<PatientMergeEventPage> {
    // Parámetro a parámetro: el backend valida con `forbidNonWhitelisted` y un
    // opcional en `undefined` viajaría como clave declarada.
    let params = new HttpParams();
    if (query.patientProfileId !== undefined) {
      params = params.set('patientProfileId', query.patientProfileId);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<WireMergeEventPage>(this.url('/profiles/patients/merge-events'), { params })
      .pipe(map((body) => ({ ...body, items: body.items.map(toMergeEvent) })));
  }

  /**
   * `POST /profiles/patients/merge/:eventId/reverse` — revierte una fusión
   * (UC-05-09).
   *
   * `eventId` sale de {@link listMergeEvents} o de la respuesta de
   * {@link mergePatients}. Las dos vías sirven: la segunda es la del momento, la
   * primera es la que permite deshacer un error descubierto más tarde.
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
   * `POST /profiles/practitioners/:profileId/specialties` (UC-05-06) — agrega
   * una especialidad al perfil profesional propio.
   *
   * No hay «editar» una especialidad ya cargada: una especialidad verificada es
   * un hecho comprobado contra una credencial, y corregirlo sin volver a
   * verificarlo vaciaría de sentido la verificación. Lo que se puede hacer es
   * agregar una nueva — vigente y sin tocar las anteriores, que siguen contando
   * como trayectoria.
   */
  addSpecialty(
    profileId: string,
    especialidad: NewSpecialty,
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url(`/profiles/practitioners/${profileId}/specialties`),
      stripUndefined(especialidad),
    );
  }

  /**
   * `POST /profiles/practitioners/:profileId/jurisdiction-authorizations`
   * (UC-05-04) — agrega una matrícula al perfil profesional propio.
   *
   * Mismo criterio que la especialidad: se agrega, no se edita. Una matrícula es
   * una autorización de un tercero —el colegio o consejo que la emite— y
   * dejarla editable convertiría el registro en una declaración propia de estar
   * habilitado, que es exactamente lo que la matrícula existe para comprobar.
   */
  addJurisdictionAuthorization(
    profileId: string,
    matricula: NewJurisdictionAuthorization,
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url(`/profiles/practitioners/${profileId}/jurisdiction-authorizations`),
      stripUndefined(matricula),
    );
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

/* El perfil profesional: `createdAt` siempre viene, y cada colección trae sus
   propias fechas opcionales. Las colecciones se declaran una por una y no con
   `WireDates` sobre el todo porque están anidadas, y ese ayudante sólo alcanza
   el primer nivel — dejarlas pasar tipadas como `Date` haría que el texto que
   de verdad llega no se convirtiera y terminara crudo en la pantalla. */
type WireOwnPractitioner = Omit<
  OwnPractitionerProfile,
  'createdAt' | 'specialties' | 'credentials' | 'licenses'
> & {
  readonly createdAt: string;
  readonly specialties: readonly WireDates<PractitionerSpecialty, 'validFrom' | 'validTo'>[];
  readonly credentials: readonly WireDates<
    PractitionerCredential,
    'issueDate' | 'expiryDate' | 'verifiedAt'
  >[];
  readonly licenses: readonly WireDates<PractitionerLicense, 'validFrom' | 'validTo'>[];
};

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

interface WireMergeEventPage extends Omit<PatientMergeEventPage, 'items'> {
  readonly items: readonly WireMergeEvent[];
}

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
 * Quita las claves sin valor antes de enviar. El backend valida con
 * `forbidNonWhitelisted`, y un opcional presente en `undefined` viaja como
 * clave declarada: mejor no mandarla.
 */
function stripUndefined<T extends object>(source: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  );
}
