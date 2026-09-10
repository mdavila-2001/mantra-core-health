import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly, sinNulos, type ConNulos } from '../wire';
import type {
  AccountLink,
  NewJurisdictionAuthorization,
  NewOwnCredential,
  NewPatientProfile,
  NewPractitionerProfile,
  NewRelatedPerson,
  NewSpecialty,
  OwnPatientProfile,
  OwnPatientProfileChanges,
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
  PractitionerAffiliation,
  PractitionerAffiliationPage,
  NewPractitionerAffiliation,
  PractitionerCredential,
  PractitionerLicense,
  PractitionerProfile,
  PractitionerDirectoryPage,
  SpecialtyCounts,
  PractitionerListItem,
  PractitionerSpecialty,
  RelatedPerson,
  RelatedPersonCreated,
  PractitionerOnboarding,
  LinkableOrganizationPage,
} from './profiles.types';

/** Las mismas respuestas, con las fechas como viajan: texto. */
type Wire<T> = { readonly [K in keyof T]: T[K] extends Date ? string : T[K] };

/**
 * Las fechas opcionales necesitan su propia forma: `Date | undefined` no
 * extiende `Date`, así que {@link Wire} las dejaría tipadas como `Date` y el
 * texto que de verdad llega pasaría sin convertir.
 */
type WireDates<T, K extends keyof T> = Omit<T, K> & Partial<Readonly<Record<K, string>>>;

/** `Date` → ISO `YYYY-MM-DD`, con los componentes **locales**. */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

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
    if (query.nationalId !== undefined && query.nationalId !== '') {
      params = params.set('nationalId', query.nationalId);
    }
    if (query.issuerAdministrativeAreaConceptId !== undefined) {
      params = params.set(
        'issuerAdministrativeAreaConceptId',
        query.issuerAdministrativeAreaConceptId,
      );
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http.get<RespuestaPagina>(this.url('/profiles/patients'), { params }).pipe(
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
   * consultar por otro.
   *
   * **Ya no exige identidad verificada** (F-34): responde `200` a todo
   * paciente. Lo que la verificación gobierna es un solo campo —el código de
   * paciente, que viaja únicamente cuando `identityVerified` es verdadero—, y
   * esa decisión es del servidor: la vista muestra lo que llegó, no filtra.
   *
   * Una API anterior al cambio sigue respondiendo `403
   * IDENTITY_VERIFICATION_REQUIRED`, que la capa de errores convierte en un
   * estado con salida hacia la verificación en vez de un muro. Los dos
   * contratos conviven mientras dure el despliegue.
   */
  getOwnSummary(): Observable<OwnPatientSummary> {
    return this.http.get<RespuestaResumen>(this.url('/profiles/patients/me/summary')).pipe(
      map((body) => {
        const limpio = sinNulos<WireOwnSummary>(body);
        return {
          ...limpio,
          birthDate: maybeDateOnly(limpio.birthDate),
          // La API anterior a F-34 no emite la marca, y su `200` sólo existía
          // para quien ya estaba verificado: dejarla en `false` mostraría
          // «Pendiente de verificación» junto al código que esa misma
          // respuesta trae. La presencia del código es el dato que queda.
          identityVerified: limpio.identityVerified ?? limpio.patientCode !== undefined,
        };
      }),
    );
  }

  /**
   * `GET /profiles/patients/me` — los datos que la persona dio al registrarse.
   *
   * Autoservicio, como el resumen: el sujeto sale de la sesión y no hay
   * identificador que pasar.
   *
   * **No es el resumen con otro nombre.** Aquél compone el nombre y sirve para
   * mostrarlo; éste devuelve las **cuatro partes** por separado, que es lo
   * único con lo que se puede corregir un nombre sin adivinar dónde cortarlo.
   */
  getOwnPatientProfile(): Observable<OwnPatientProfile> {
    return this.http
      .get<ConNulos<WireOwnPatientProfile>>(this.url('/profiles/patients/me'))
      .pipe(map((body) => toOwnPatientProfile(body)));
  }

  /**
   * `PATCH /profiles/patients/me` — corrige los datos propios.
   *
   * Sólo viaja lo que se le pase: una clave ausente no se toca y una presente
   * con `''` **borra** el dato, que es lo que hace falta cuando alguien
   * descubre que no lleva segundo nombre ni apellido materno. Por eso las
   * claves sin valor se quitan (`stripUndefined`) en vez de mandarse en
   * `undefined`: el backend valida con `forbidNonWhitelisted` y una clave
   * declarada sin valor vuelve `400`.
   *
   * Un cuerpo vacío es válido y devuelve el perfil tal cual: la decisión de no
   * llamar cuando no hubo cambios es de la pantalla, no del contrato.
   *
   * @param cambios - El subconjunto editable, con la fecha como `Date`.
   * @returns El mismo perfil releído por el backend.
   */
  updateOwnPatientProfile(cambios: OwnPatientProfileChanges): Observable<OwnPatientProfile> {
    return this.http
      .patch<ConNulos<WireOwnPatientProfile>>(
        this.url('/profiles/patients/me'),
        stripUndefined({
          ...cambios,
          // La fecha se arma con los componentes **locales**: pasarla por
          // `toISOString()` la corre un día al oeste de Greenwich, que es el
          // mismo error que `maybeDateOnly` deshace al leerla.
          birthDate: cambios.birthDate === undefined ? undefined : fechaIso(cambios.birthDate),
        }),
      )
      .pipe(map((body) => toOwnPatientProfile(body)));
  }

  /**
   * `PUT /profiles/patients/me/photo` — fija la foto de perfil propia.
   *
   * Espejo de `setPractitionerPhoto`: recibe el **id** de un archivo ya
   * subido por `POST /common/files/upload`, no los bytes. Escribe
   * `profiles.persons.photo_file_id` — la foto de la persona, no la del
   * perfil profesional (otra columna, sin relación con ésta).
   *
   * @param fileId - El archivo que devolvió `FilesClient.upload()`.
   * @returns El perfil releído, ya con su foto.
   */
  setOwnPatientPhoto(fileId: string): Observable<OwnPatientProfile> {
    return this.http
      .put<ConNulos<WireOwnPatientProfile>>(this.url('/profiles/patients/me/photo'), { fileId })
      .pipe(map((body) => toOwnPatientProfile(body)));
  }

  /**
   * `DELETE /profiles/patients/me/photo` — quita la foto de perfil propia.
   *
   * Quita la referencia; el archivo no se toca. Idempotente.
   */
  removeOwnPatientPhoto(): Observable<OwnPatientProfile> {
    return this.http
      .delete<ConNulos<WireOwnPatientProfile>>(this.url('/profiles/patients/me/photo'))
      .pipe(map((body) => toOwnPatientProfile(body)));
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
   * `GET /profiles/practitioners/me/onboarding` — qué le falta al profesional.
   *
   * El servidor lo calcula mirando sus datos; acá no se guarda ni se deduce
   * nada. Responde **422** si la sesión no tiene perfil profesional, que es un
   * caso normal —una cuenta administrativa, un paciente— y no un fallo.
   */
  getOwnOnboarding(): Observable<PractitionerOnboarding> {
    return this.http.get<PractitionerOnboarding>(this.url('/profiles/practitioners/me/onboarding'));
  }

  /**
   * `GET /profiles/practitioners` — la guía de profesionales (carril R2-1).
   *
   * Cada fila trae lo que una guía necesita para agrupar y rotular: nombre,
   * título, foto, disponibilidad y las especialidades **vigentes**. El detalle
   * de cada uno sale de `getPractitionerProfile`.
   *
   * Pagina por cursor y **no devuelve total**, como el resto de los listados
   * del sistema: la pantalla junta las páginas hasta agotarlas para poder
   * agrupar por especialidad, que es lo que se pidió — una guía se hojea, no
   * se interroga.
   *
   * @param filtros - Especialidad vigente, cursor y tope de página.
   */
  listPractitioners(
    filtros: {
      readonly specialtyConceptId?: string;
      /** Sólo quienes no declaran ninguna especialidad vigente. */
      readonly withoutSpecialty?: boolean;
      readonly cursor?: string;
      readonly limit?: number;
    } = {},
  ): Observable<PractitionerDirectoryPage> {
    let params = new HttpParams();
    if (filtros.specialtyConceptId !== undefined) {
      params = params.set('specialtyConceptId', filtros.specialtyConceptId);
    }
    if (filtros.withoutSpecialty === true) {
      params = params.set('withoutSpecialty', 'true');
    }
    if (filtros.cursor !== undefined) {
      params = params.set('cursor', filtros.cursor);
    }
    if (filtros.limit !== undefined) {
      params = params.set('limit', String(filtros.limit));
    }
    return this.http
      .get<ConNulos<WirePractitionerDirectoryPage>>(this.url('/profiles/practitioners'), {
        params,
      })
      .pipe(
        map((body) => {
          const limpio = sinNulos<WirePractitionerDirectoryPage>(body);
          return {
            ...limpio,
            items: limpio.items.map((fila) => sinNulos<PractitionerListItem>(fila)),
            // `nextCursor` viaja `null` en la última página y `sinNulos` lo
            // borraría: acá la ausencia SÍ significa algo —«no hay más»— y la
            // pantalla la lee como fin del recorrido.
            nextCursor: body.nextCursor ?? null,
          };
        }),
      );
  }

  /**
   * `GET /profiles/practitioners/specialty-counts` — la portada de la guía.
   *
   * Es lo que permite dibujar «Cardiología · 88» sin traerse los 88. Antes esta
   * pantalla contaba paginando la guía entera hasta agotar el cursor, con un
   * techo que la dejaba recortada sin avisar.
   *
   * @returns Una fila por especialidad con gente, más el total sin repetir.
   */
  getSpecialtyCounts(): Observable<SpecialtyCounts> {
    return this.http
      .get<ConNulos<SpecialtyCounts>>(this.url('/profiles/practitioners/specialty-counts'))
      .pipe(map((body) => sinNulos<SpecialtyCounts>(body)));
  }

  /**
   * `GET /profiles/practitioners/:profileId/summary` — el perfil de un colega.
   *
   * Devuelve **el mismo contrato** que `getOwnPractitionerProfile`, así que la
   * ficha de la guía se pinta con la misma vista con la que un doctor ve su
   * propio perfil. Dos formas distintas serían dos perfiles de doctor en el
   * producto — que es justo lo que el punto 4 del reclamo señaló.
   *
   * @param profileId - El profesional consultado.
   */
  getPractitionerProfile(profileId: string): Observable<OwnPractitionerProfile> {
    return this.http
      .get<ConNulos<WireOwnPractitioner>>(
        this.url(`/profiles/practitioners/${encodeURIComponent(profileId)}/summary`),
      )
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
      /* Los personales. Una cadena vacía BORRA el dato opcional, así que se
         mandan tal cual llegan: filtrar los vacíos impediría quitar un segundo
         nombre. `displayName` no está — lo recompone el backend. */
      readonly name: string;
      readonly middleName: string;
      readonly lastName: string;
      readonly motherLastName: string;
      readonly birthDate: string;
      readonly phone: string;
      /* Los cuatro contactos que el alta declara por separado. El correo de
         trabajo NO está: es la identidad de acceso y se cambia por su propio
         trámite. */
      readonly mobilePhone: string;
      readonly workMobilePhone: string;
      readonly workLandline: string;
      readonly personalEmail: string;
      readonly residenceMunicipalityConceptId: string;
      /* El domicilio (ALV-009): mismo contrato que
         `OwnPatientProfileChanges.homeAddressLines`. Sólo el texto y, si se
         marcó un punto, las dos coordenadas juntas — el municipio ya viaja
         arriba y el backend conserva lo que no llega. */
      readonly homeAddressLines: string;
      /* `null` en los dos QUITA el punto; ausentes es «no lo toqué». La
         distinción hace falta desde que el perfil deja moverlo: sin ella no
         habría forma de borrar una ubicación mal puesta. */
      readonly homeLatitude: number | null;
      readonly homeLongitude: number | null;
    }>,
  ): Observable<OwnPractitionerProfile> {
    return this.http
      .patch<ConNulos<WireOwnPractitioner>>(this.url('/profiles/practitioners/me'), cambios)
      .pipe(map((body) => this.traducirPerfilPropio(body)));
  }

  /** Fija la foto del perfil profesional ya subida a `common/files`. */
  setPractitionerPhoto(profileId: string, fileId: string): Observable<OwnPractitionerProfile> {
    return this.http
      .put<ConNulos<WireOwnPractitioner>>(
        this.url(`/profiles/practitioners/${encodeURIComponent(profileId)}/photo`),
        { fileId },
      )
      .pipe(map((body) => this.traducirPerfilPropio(body)));
  }

  /** La respuesta de la lectura y de la edición tienen la misma forma. */
  private traducirPerfilPropio(body: ConNulos<WireOwnPractitioner>): OwnPractitionerProfile {
    const limpio = sinNulos<WireOwnPractitioner>(body);
    return {
      ...limpio,
      createdAt: new Date(limpio.createdAt),
      // Anclada a medianoche LOCAL: con `new Date()` retrocedería un día en
      // cualquier huso al oeste de Greenwich, y quien nació el 1 de marzo se
      // leería como del 28 de febrero.
      birthDate: maybeDateOnly(limpio.birthDate),
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
      // Mismo mapeo que `listAffiliations`/`addAffiliation`: una sola función,
      // reutilizada en vez de reimplementar la conversión de fechas acá.
      affiliations: limpio.affiliations.map(toAffiliation),
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
  addRelatedPerson(profileId: string, person: NewRelatedPerson): Observable<RelatedPersonCreated> {
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

  /* -- El historial laboral del profesional (UC-05-16) --------------------- */

  /**
   * `GET /profiles/practitioners/me/affiliations` — dónde trabajó.
   *
   * Autoservicio de verdad: el sujeto lo resuelve el backend desde la sesión,
   * así que no hay identificador que pasar ni forma de leer el currículum de
   * otro. Es el mismo trato que `getOwnSummary`.
   *
   * Una cuenta sin perfil profesional recibe `403`. No es un error de la
   * pantalla: es que la pregunta no aplica, y quien la consuma tiene que
   * contarlo como ausencia de sección, no como fallo.
   *
   * @returns Sus vínculos laborales, del más reciente al más antiguo.
   */
  listAffiliations(): Observable<PractitionerAffiliationPage> {
    return this.http
      .get<WireAffiliationPage>(this.url('/profiles/practitioners/me/affiliations'))
      .pipe(map((body) => ({ ...body, items: body.items.map(toAffiliation) })));
  }

  /**
   * `POST /profiles/practitioners/me/affiliations` — agrega un vínculo laboral.
   *
   * Dos respuestas que **no** son errores del sistema y conviene distinguir:
   * `409` es el mismo vínculo ya cargado —misma institución, mismo cargo y
   * mismo día de inicio—, y `422` es un período que termina antes de empezar.
   * Las dos se cuentan como algo que corregir en el formulario.
   *
   * @param afiliacion - Institución, cargo y período.
   * @returns El vínculo registrado, ya con su `current` derivado.
   */
  addAffiliation(afiliacion: NewPractitionerAffiliation): Observable<PractitionerAffiliation> {
    return this.http
      .post<WireAffiliation>(
        this.url('/profiles/practitioners/me/affiliations'),
        stripUndefined(afiliacion),
      )
      .pipe(map(toAffiliation));
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
  addSpecialty(profileId: string, especialidad: NewSpecialty): Observable<{ readonly id: string }> {
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
   * `POST /profiles/practitioners/me/credentials`. Un título propio, uno por
   * llamada: el registro de procesos pide poder cargar varios de cada clase.
   * Nace siempre PENDIENTE de verificación.
   */
  addOwnCredential(
    credencial: NewOwnCredential,
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url('/profiles/practitioners/me/credentials'),
      stripUndefined(credencial),
    );
  }

  /**
   * `DELETE /profiles/practitioners/me/credentials/:id`. Retira un título
   * propio cargado por error — sólo funciona mientras sigue PENDIENTE; uno ya
   * verificado o rechazado responde `422`.
   */
  removeOwnCredential(credentialId: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/profiles/practitioners/me/credentials/${encodeURIComponent(credentialId)}`),
    );
  }

  /**
   * `POST /profiles/persons/:personId/account-links`. Ata una cuenta de acceso
   * a una persona ya registrada.
   */
  linkAccount(
    personId: string,
    userId: string,
    linkTypeConceptId?: string,
  ): Observable<AccountLink> {
    return this.http
      .post<Wire<AccountLink>>(this.url(`/profiles/persons/${personId}/account-links`), {
        userId,
        ...(linkTypeConceptId === undefined ? {} : { linkTypeConceptId }),
      })
      .pipe(map((body) => ({ ...body, validFrom: new Date(body.validFrom) })));
  }

  /**
   * `GET /profiles/practitioners/me/linkable-organizations` — el padrón de
   * establecimientos, para elegir dónde se trabaja en vez de escribirlo.
   *
   * ## Por qué el buscador y no un desplegable
   *
   * Son 523 establecimientos. Un `<select>` con 523 opciones no es un selector,
   * es una lista para desplazar. Se escribe, se filtra, se elige.
   *
   * ## El padrón cubre sólo Santa Cruz
   *
   * Quien trabaja en otro departamento no va a encontrarse acá, y por eso el
   * alta sigue admitiendo el nombre escrito a mano. Es la salida para lo que el
   * padrón no cubre, no la forma normal de cargarlo.
   *
   * @param query - Texto del nombre; sin él devuelve el padrón acotado al tope.
   * @param municipality - Municipio exacto, para separar homónimos.
   * @returns Los establecimientos que coinciden.
   */
  searchLinkableOrganizations(
    query?: string,
    municipality?: string,
  ): Observable<LinkableOrganizationPage> {
    let params = new HttpParams();
    if (query !== undefined && query.trim() !== '') {
      params = params.set('q', query.trim());
    }
    if (municipality !== undefined && municipality.trim() !== '') {
      params = params.set('municipality', municipality.trim());
    }
    return this.http.get<LinkableOrganizationPage>(
      this.url('/profiles/practitioners/me/linkable-organizations'),
      { params },
    );
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

/**
 * El resumen como viaja. `identityVerified` es **opcional en el cable a
 * propósito**: la API anterior a F-34 no lo emite, y el tipo de vista lo
 * declara obligatorio porque el cliente lo completa en la frontera.
 */
type WireOwnSummary = WireDates<Omit<OwnPatientSummary, 'identityVerified'>, 'birthDate'> & {
  readonly identityVerified?: boolean;
};

/* El perfil profesional: `createdAt` siempre viene, y cada colección trae sus
   propias fechas opcionales. Las colecciones se declaran una por una y no con
   `WireDates` sobre el todo porque están anidadas, y ese ayudante sólo alcanza
   el primer nivel — dejarlas pasar tipadas como `Date` haría que el texto que
   de verdad llega no se convirtiera y terminara crudo en la pantalla. */
/**
 * La página de la guía como viaja: sin fechas, pero con opcionales en `null`
 * —el backend serializa así— que `sinNulos` limpia fila por fila.
 */
type WirePractitionerDirectoryPage = PractitionerDirectoryPage;

type WireOwnPractitioner = Omit<
  OwnPractitionerProfile,
  'createdAt' | 'birthDate' | 'specialties' | 'credentials' | 'licenses' | 'affiliations'
> & {
  readonly createdAt: string;
  /** `format: 'date'`, sin hora: pasa por `maybeDateOnly` como la del paciente. */
  readonly birthDate?: string;
  readonly specialties: readonly WireDates<PractitionerSpecialty, 'validFrom' | 'validTo'>[];
  readonly credentials: readonly WireDates<
    PractitionerCredential,
    'issueDate' | 'expiryDate' | 'verifiedAt'
  >[];
  readonly licenses: readonly WireDates<PractitionerLicense, 'validFrom' | 'validTo'>[];
  readonly affiliations: readonly WireAffiliation[];
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

/* Los datos propios del paciente: una sola fecha, y sin hora. Pasa por
   `maybeDateOnly` por lo mismo que el resumen — anclada a medianoche UTC, una
   fecha de nacimiento retrocede un día en cualquier huso al oeste de
   Greenwich, y la persona ve mal el dato que vino a corregir. */
type WireOwnPatientProfile = WireDates<OwnPatientProfile, 'birthDate'>;

/** Los datos propios con la fecha ya convertida y los `null` fuera. */
function toOwnPatientProfile(body: ConNulos<WireOwnPatientProfile>): OwnPatientProfile {
  const limpio = sinNulos<WireOwnPatientProfile>(body);
  return {
    ...limpio,
    birthDate: maybeDateOnly(limpio.birthDate),
    // Las listas son obligatorias en el contrato, pero se defienden igual: una
    // API anterior a este cambio las omite, y la pantalla las recorre sin
    // preguntar. Vacías dicen «no declaró ninguna», que es lo correcto ahí.
    coverages: limpio.coverages ?? [],
    guardians: limpio.guardians ?? [],
  };
}

/**
 * Una afiliación como viaja: dos fechas **sin hora** y una marca de tiempo.
 *
 * La distinción no es cosmética. `startDate`/`endDate` son `format: 'date'` y
 * pasan por `maybeDateOnly`, que las ancla a medianoche **local**: con
 * `new Date()` retrocederían un día en cualquier huso al oeste de Greenwich, y
 * un vínculo laboral que empieza el 1 de marzo se leería como del 28 de
 * febrero. `createdAt` sí es un instante y va por el camino directo.
 */
type WireAffiliation = Omit<PractitionerAffiliation, 'startDate' | 'endDate' | 'createdAt'> & {
  readonly startDate: string;
  readonly endDate: string | null;
  readonly createdAt: string;
};

interface WireAffiliationPage extends Omit<PractitionerAffiliationPage, 'items'> {
  readonly items: readonly WireAffiliation[];
}

/** La afiliación con sus fechas ya convertidas. */
function toAffiliation({
  startDate,
  endDate,
  createdAt,
  ...resto
}: WireAffiliation): PractitionerAffiliation {
  return {
    ...resto,
    // `startDate` es obligatoria en el contrato; el `?? new Date(NaN)` no puede
    // ocurrir, pero declararlo evita que un dato roto se cuele como `undefined`
    // en un campo que la vista pinta sin preguntar.
    startDate: maybeDateOnly(startDate) ?? new Date(NaN),
    endDate: maybeDateOnly(endDate) ?? null,
    createdAt: new Date(createdAt),
  };
}

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
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined));
}
