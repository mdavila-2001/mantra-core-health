import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { sinNulos, type ConNulos } from '../wire';
import type {
  AccountActivation,
  ActivationResult,
  AssistedPatientRegistration,
  AssistedRegistrationResult,
  CreatedUser,
  LoginCredentials,
  NewUser,
  OrganizationRegistration,
  PasswordReset,
  PasswordResetRequested,
  VerificationResent,
  PasswordResetResult,
  PatientRegistration,
  PractitionerRegistration,
  RegisteredOrganization,
  RegisteredPatient,
  RegisteredPractitioner,
  Session,
  UploadedRegistrationDocument,
  UserListItem,
  UserPage,
  UserSearchQuery,
  VerifiedEmail,
} from './iam.types';

/** Respuestas de la API tal como viajan: las fechas son texto. */
interface TokenResponseBody {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
}

interface UserResponseBody {
  readonly id: string;
  readonly displayName: string;
  /** Concept id del estado, no su etiqueta. */
  readonly status: string;
  readonly createdAt: string;
}

interface AssistedRegistrationBody {
  readonly userId: string;
  readonly activationToken: string;
  readonly activationExpiresAt: string;
  readonly status: string;
}

/**
 * Cliente de `iam`: sesión y alta de cuentas.
 *
 * El backend valida con `forbidNonWhitelisted`, así que cada petición manda
 * **exactamente** los campos del contrato: un campo de más devuelve 400. Por eso
 * los cuerpos se arman explícitamente en vez de reenviar el objeto de la vista.
 */
@Injectable({
  providedIn: 'root',
})
export class IamClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /iam/auth/login`. Envía un solo identificador: la unión de
   * {@link LoginCredentials} garantiza que nunca puedan ir los dos.
   */
  login(credentials: LoginCredentials): Observable<Session> {
    const identifier =
      credentials.kind === 'email'
        ? { email: credentials.email }
        : { nationalId: credentials.nationalId };

    return this.http
      .post<TokenResponseBody>(this.url('/iam/auth/login'), {
        ...identifier,
        password: credentials.password,
        ...(credentials.mfaCode === undefined ? {} : { mfaCode: credentials.mfaCode }),
      })
      .pipe(map(toSession));
  }

  /**
   * `POST /iam/auth/token/refresh`. Rota el par completo: el viejo deja de servir.
   *
   * Con `null` el cuerpo va **vacío**: es el modo cookie (TX-10), donde el
   * refresh token lo manda el navegador en la cookie `httpOnly` y JavaScript
   * nunca lo ve.
   */
  refresh(refreshToken: string | null): Observable<Session> {
    return this.http
      .post<TokenResponseBody>(
        this.url('/iam/auth/token/refresh'),
        refreshToken === null ? {} : { refreshToken },
      )
      .pipe(map(toSession));
  }

  /** `POST /iam/auth/register-patient`. Auto-registro con documento de identidad. */
  registerPatient(registration: PatientRegistration): Observable<RegisteredPatient> {
    return this.http.post<RegisteredPatient>(this.url('/iam/auth/register-patient'), {
      nationalId: registration.nationalId,
      password: registration.password,
      // El nombre viaja en partes y el backend compone el que se muestra: si el
      // front lo compusiera, la base guardaría una versión y el contrato otra.
      name: registration.name,
      lastName: registration.lastName,
      ...(registration.middleName === undefined ? {} : { middleName: registration.middleName }),
      ...(registration.motherLastName === undefined
        ? {}
        : { motherLastName: registration.motherLastName }),
      ...(registration.email === undefined ? {} : { email: registration.email }),
      ...(registration.birthDate === undefined ? {} : { birthDate: registration.birthDate }),
      // El cuerpo se re-proyecta campo por campo y no con un `...registration`
      // a propósito: `forbidNonWhitelisted` del backend rechaza toda propiedad
      // que el DTO no declare, así que lo que viaja es exactamente lo acordado
      // y no lo que alguien haya dejado colgando del objeto de dominio. El
      // precio es éste: un campo nuevo en `PatientRegistration` no llega solo,
      // hay que listarlo acá.
      ...(registration.issuerAdministrativeAreaConceptId === undefined
        ? {}
        : {
            issuerAdministrativeAreaConceptId:
              registration.issuerAdministrativeAreaConceptId,
          }),
      // Sólo el municipio: el departamento de residencia lo deriva el backend
      // del código del INE, así que el par no puede llegar incoherente.
      ...(registration.residenceMunicipalityConceptId === undefined
        ? {}
        : {
            residenceMunicipalityConceptId:
              registration.residenceMunicipalityConceptId,
          }),
      ...(registration.phone === undefined ? {} : { phone: registration.phone }),
      ...(registration.gender === undefined ? {} : { gender: registration.gender }),
      ...(registration.sexAtBirth === undefined ? {} : { sexAtBirth: registration.sexAtBirth }),
      ...(registration.occupationConceptId === undefined
        ? {}
        : { occupationConceptId: registration.occupationConceptId }),
      ...(registration.occupationFreeText === undefined
        ? {}
        : { occupationFreeText: registration.occupationFreeText }),
      ...(registration.homeAddressLines === undefined
        ? {}
        : { homeAddressLines: registration.homeAddressLines }),
      ...(registration.homeLatitude === undefined
        ? {}
        : { homeLatitude: registration.homeLatitude }),
      ...(registration.homeLongitude === undefined
        ? {}
        : { homeLongitude: registration.homeLongitude }),
      ...(registration.workMunicipalityConceptId === undefined
        ? {}
        : { workMunicipalityConceptId: registration.workMunicipalityConceptId }),
      ...(registration.workAddressLines === undefined
        ? {}
        : { workAddressLines: registration.workAddressLines }),
      ...(registration.workLatitude === undefined
        ? {}
        : { workLatitude: registration.workLatitude }),
      ...(registration.workLongitude === undefined
        ? {}
        : { workLongitude: registration.workLongitude }),
      ...(registration.workEmployerConceptId === undefined
        ? {}
        : { workEmployerConceptId: registration.workEmployerConceptId }),
      ...(registration.workEmployerFreeText === undefined
        ? {}
        : { workEmployerFreeText: registration.workEmployerFreeText }),
      ...(registration.guardianName === undefined
        ? {}
        : { guardianName: registration.guardianName }),
      ...(registration.guardianPhone === undefined
        ? {}
        : { guardianPhone: registration.guardianPhone }),
      ...(registration.guardianRelationshipConceptId === undefined
        ? {}
        : {
            guardianRelationshipConceptId:
              registration.guardianRelationshipConceptId,
          }),
      ...(registration.privateInsurancePlanId === undefined
        ? {}
        : { privateInsurancePlanId: registration.privateInsurancePlanId }),
      ...(registration.publicInsurancePlanId === undefined
        ? {}
        : { publicInsurancePlanId: registration.publicInsurancePlanId }),
      ...(registration.billingTaxId === undefined
        ? {}
        : { billingTaxId: registration.billingTaxId }),
      // La razón social viaja con el NIT: es a nombre de quién se emite la
      // factura. Faltaba en esta lista —el contrato la declara y el alta la
      // completa—, así que se descartaba en silencio justo antes del POST, que
      // es el modo de fallo que advierte el comentario de `registerPractitioner`.
      ...(registration.billingLegalName === undefined
        ? {}
        : { billingLegalName: registration.billingLegalName }),
      ...(registration.timeZone === undefined ? {} : { timeZone: registration.timeZone }),
    });
  }

  /**
   * `POST /iam/auth/register-practitioner`. Auto-registro de profesional.
   *
   * Su identificador de acceso es el **correo**, no el documento: es la
   * diferencia con el alta de paciente.
   */
  registerPractitioner(registration: PractitionerRegistration): Observable<RegisteredPractitioner> {
    return this.http.post<RegisteredPractitioner>(this.url('/iam/auth/register-practitioner'), {
      email: registration.email,
      password: registration.password,
      // Ojo al agregar campos: este cuerpo se arma nombre por nombre, así que
      // lo que el contrato declare y esta lista no repita se descarta EN
      // SILENCIO — mismo patrón que dejó la modalidad sin escribir (PR #241).
      ...(registration.specialtyConceptIds === undefined ||
      registration.specialtyConceptIds.length === 0
        ? {}
        : { specialtyConceptIds: [...registration.specialtyConceptIds] }),
      // El nombre viaja en partes y el backend compone el que se muestra: si el
      // front lo compusiera, la base guardaría una versión y el contrato otra.
      name: registration.name,
      lastName: registration.lastName,
      ...(registration.middleName === undefined ? {} : { middleName: registration.middleName }),
      ...(registration.motherLastName === undefined
        ? {}
        : { motherLastName: registration.motherLastName }),
      ...(registration.birthDate === undefined ? {} : { birthDate: registration.birthDate }),
      ...(registration.nationalId === undefined ? {} : { nationalId: registration.nationalId }),
      ...(registration.issuerAdministrativeAreaConceptId === undefined
        ? {}
        : {
            issuerAdministrativeAreaConceptId: registration.issuerAdministrativeAreaConceptId,
          }),
      ...(registration.residenceMunicipalityConceptId === undefined
        ? {}
        : {
            residenceMunicipalityConceptId: registration.residenceMunicipalityConceptId,
          }),
      // La calle y el punto del domicilio. Van acá por lo que dice el aviso de
      // arriba: lo que el contrato declara y esta lista no repita se descarta
      // en silencio, y el alta del profesional acaba de ganar los tres.
      ...(registration.homeAddressLines === undefined
        ? {}
        : { homeAddressLines: registration.homeAddressLines }),
      // El par entero o nada: media coordenada no ubica nada.
      ...(registration.homeLatitude === undefined || registration.homeLongitude === undefined
        ? {}
        : { homeLatitude: registration.homeLatitude, homeLongitude: registration.homeLongitude }),
      // La dirección laboral se declara por separado del domicilio y del
      // consultorio propio. Las coordenadas viajan juntas o no viajan.
      ...(registration.workAddressLines === undefined
        ? {}
        : { workAddressLines: registration.workAddressLines }),
      ...(registration.workLatitude === undefined || registration.workLongitude === undefined
        ? {}
        : { workLatitude: registration.workLatitude, workLongitude: registration.workLongitude }),
      // El consultorio propio. Va acá por lo mismo que los tres de arriba: lo
      // que el contrato declara y esta lista no repita se descarta en silencio.
      ...(registration.ownSite === undefined ? {} : { ownSite: registration.ownSite }),
      licenseNumber: registration.licenseNumber,
      sedesLicenseNumber: registration.sedesLicenseNumber,
      ...(registration.regulatoryAuthority === undefined
        ? {}
        : { regulatoryAuthority: registration.regulatoryAuthority }),
      ...(registration.licenseIssueDate === undefined
        ? {}
        : { licenseIssueDate: registration.licenseIssueDate }),
      ...(registration.professionalTitle === undefined
        ? {}
        : { professionalTitle: registration.professionalTitle }),
      ...(registration.phone === undefined ? {} : { phone: registration.phone }),
      // El sexo al nacer, que el alta pregunta desde AC-05-7. El DTO del
      // backend lo aceptaba desde siempre; lo que no existía era ni la pregunta
      // ni este renglón — que es exactamente el descarte en silencio contra el
      // que avisa el comentario de arriba.
      ...(registration.sexAtBirth === undefined ? {} : { sexAtBirth: registration.sexAtBirth }),
      ...(registration.profilePhotoBase64 === undefined
        ? {}
        : { profilePhotoBase64: registration.profilePhotoBase64 }),
      ...(registration.occupationConceptId === undefined
        ? {}
        : { occupationConceptId: registration.occupationConceptId }),
      ...(registration.occupationFreeText === undefined
        ? {}
        : { occupationFreeText: registration.occupationFreeText }),
      // Los cuatro contactos que el registro pide separados del de acceso. Van
      // acá nombre por nombre por lo mismo que avisa el comentario de arriba:
      // sin este renglón el campo llega al contrato, se descarta en silencio y
      // el formulario pregunta un dato que nadie guarda.
      ...(registration.mobilePhone === undefined ? {} : { mobilePhone: registration.mobilePhone }),
      ...(registration.workMobilePhone === undefined
        ? {}
        : { workMobilePhone: registration.workMobilePhone }),
      ...(registration.workLandline === undefined
        ? {}
        : { workLandline: registration.workLandline }),
      ...(registration.personalEmail === undefined
        ? {}
        : { personalEmail: registration.personalEmail }),
      // El institucional. El de acceso es `email`, que desde el cambio de
      // identidad de acceso lleva el correo PERSONAL del profesional.
      ...(registration.workEmail === undefined ? {} : { workEmail: registration.workEmail }),
      // Los títulos declarados en el alta (subtarea 1.6). Van acá por lo mismo
      // que avisa el comentario de arriba: sin este renglón la pantalla
      // preguntaría títulos que nadie guarda. La lista vacía no viaja: un alta
      // sin títulos es el caso normal y el contrato la omite.
      ...(registration.credentials === undefined || registration.credentials.length === 0
        ? {}
        : { credentials: registration.credentials.map((credencial) => ({ ...credencial })) }),
    });
  }

  /**
   * `POST /iam/auth/register-organization`. Auto-registro de una organización
   * aseguradora: crea el tenant `PAYER` y su usuario owner en la misma
   * operación.
   *
   * El tipo del tenant viaja **fijo** en `'PAYER'`: esta pantalla sólo da de
   * alta aseguradoras, así que no hay nada que elegir — a diferencia del alta
   * administrativa (`DirectoryClient.createTenant`), que sirve a los diez
   * tipos y por eso sí lo pide.
   */
  registerOrganization(registration: OrganizationRegistration): Observable<RegisteredOrganization> {
    return this.http.post<RegisteredOrganization>(this.url('/iam/auth/register-organization'), {
      organization: {
        code: registration.code,
        legalName: registration.legalName,
        legalEntityType: registration.legalEntityType,
        ...(registration.tradeName === undefined ? {} : { tradeName: registration.tradeName }),
        tenantType: 'PAYER',
        ...(registration.timeZone === undefined ? {} : { timeZone: registration.timeZone }),
        payer: {
          carrierCode: registration.payer.carrierCode,
          regulatorIdentifier: registration.payer.regulatorIdentifier,
          sigla: registration.payer.sigla,
          address: registration.payer.address,
          // Casa matriz georreferenciada (subtarea 1.3): ambas o ninguna —
          // el backend rechaza con 400 una sola de las dos. Una clave no
          // copiada acá se perdería en silencio; una que el DTO no declare
          // se rechaza por `forbidNonWhitelisted`.
          ...(registration.payer.latitude === undefined ||
          registration.payer.longitude === undefined
            ? {}
            : {
                latitude: registration.payer.latitude,
                longitude: registration.payer.longitude,
              }),
        },
        // Documentos legales de afiliación (subtarea 1.2): van DENTRO de
        // `organization`, como los declara `RegisterOrganizationDetailsDto`
        // del backend — no al lado, o el servidor los ignora en silencio (el
        // DTO no reconocería una clave de más ahí y `forbidNonWhitelisted`
        // la rechazaría con 400).
        ...(registration.legalDocuments === undefined
          ? {}
          : { legalDocuments: registration.legalDocuments }),
        // Representante legal y gerencias de contacto (subtarea 1.4): mismo
        // criterio que `legalDocuments` — dentro de `organization`, nunca
        // dentro de `payer` (el registro de procesos repite el mismo bloque
        // para farmacia/laboratorio/imagenología; no es dato de aseguradora).
        ...(registration.legalRepresentative === undefined
          ? {}
          : { legalRepresentative: registration.legalRepresentative }),
        ...(registration.executives === undefined
          ? {}
          : { executives: registration.executives }),
      },
      owner: {
        email: registration.owner.email,
        password: registration.owner.password,
        // El nombre viaja en partes y el backend compone el que se muestra: si
        // el front lo compusiera, la base guardaría una versión y el contrato
        // otra.
        name: registration.owner.name,
        lastName: registration.owner.lastName,
        ...(registration.owner.middleName === undefined
          ? {}
          : { middleName: registration.owner.middleName }),
        ...(registration.owner.motherLastName === undefined
          ? {}
          : { motherLastName: registration.owner.motherLastName }),
      },
    });
  }

  /**
   * `POST /iam/auth/upload-registration-document`. Pre-carga pública de un
   * PDF para un alta que todavía no tiene sesión: el `fileId` devuelto se
   * reenvía en el alta de organización o en su fila de credencial profesional.
   *
   * Multipart sin fijar `Content-Type` a mano: el navegador pone el
   * `boundary`. `observe: 'events'` + `reportProgress: true` para que la
   * zona de arrastre pueda dibujar el avance de la subida.
   */
  uploadRegistrationDocument(file: File): Observable<HttpEvent<UploadedRegistrationDocument>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<UploadedRegistrationDocument>(
      this.url('/iam/auth/upload-registration-document'),
      form,
      { reportProgress: true, observe: 'events' },
    );
  }

  /** `POST /iam/auth/verify-email`. No desbloquea nada: deja constancia. */
  verifyEmail(token: string): Observable<VerifiedEmail> {
    return this.http.post<VerifiedEmail>(this.url('/iam/auth/verify-email'), { token });
  }

  /** `POST /iam/auth/activate`. El titular fija su contraseña definitiva. */
  activate(activation: AccountActivation): Observable<ActivationResult> {
    return this.http.post<ActivationResult>(this.url('/iam/auth/activate'), {
      activationToken: activation.activationToken,
      newPassword: activation.newPassword,
    });
  }

  /**
   * `POST /iam/auth/logout`. Cierra **esta** sesión del lado del servidor.
   *
   * No lleva cuerpo: el servidor identifica la sesión por el token. Distinto de
   * `logout-all`, que cierra las de todos los dispositivos.
   */
  logout(): Observable<unknown> {
    return this.http.post(this.url('/iam/auth/logout'), {});
  }

  /**
   * `POST /iam/auth/forgot-password`. El identificador es correo **o**
   * documento, igual que en el login.
   */
  /**
   * `POST /iam/auth/resend-verification` — vuelve a mandar el enlace de
   * verificación del correo.
   *
   * Se pide el **identificador con el que la persona inicia sesión** —correo o
   * documento— y no el correo de destino. La razón la escribe el propio DTO del
   * backend: dejar elegir a dónde se manda el enlace convertiría el formulario
   * en un modo de enviar tokens de una cuenta ajena a una bandeja propia.
   *
   * La respuesta es **siempre la misma**, exista o no la cuenta.
   */
  resendVerification(identifier: string): Observable<VerificationResent> {
    return this.http.post<VerificationResent>(this.url('/iam/auth/resend-verification'), {
      identifier,
    });
  }

  forgotPassword(identifier: string): Observable<PasswordResetRequested> {
    return this.http.post<PasswordResetRequested>(this.url('/iam/auth/forgot-password'), {
      identifier,
    });
  }

  /** `POST /iam/auth/reset-password`. Consume el token que llegó por correo. */
  resetPassword(reset: PasswordReset): Observable<PasswordResetResult> {
    return this.http.post<PasswordResetResult>(this.url('/iam/auth/reset-password'), {
      token: reset.token,
      newPassword: reset.newPassword,
    });
  }

  /**
   * `POST /iam/users` (UC-01-01). Alta hecha por un administrador.
   *
   * Es la única alta que fija una contraseña desde afuera; el resto de los
   * caminos —autorregistro y alta asistida— hacen que la elija el titular.
   */
  createUser(user: NewUser): Observable<CreatedUser> {
    return this.http
      .post<UserResponseBody>(this.url('/iam/users'), {
        displayName: user.displayName,
        email: user.email,
        password: user.password,
        ...(user.phone === undefined ? {} : { phone: user.phone }),
        ...(user.timeZone === undefined ? {} : { timeZone: user.timeZone }),
        ...(user.initialRole === undefined ? {} : { initialRole: user.initialRole }),
      })
      .pipe(map(toCreatedUser));
  }

  /**
   * `POST /iam/users/assisted-registration` (C-18 / CAN-IDENT).
   *
   * Una sola petición y una sola transacción del lado del backend: o quedó la
   * cuenta con su token de activación, o no quedó nada. Por eso acá no hay
   * orquestación ni reanudación que hacer.
   */
  assistedRegistration(
    registration: AssistedPatientRegistration,
  ): Observable<AssistedRegistrationResult> {
    return this.http
      .post<AssistedRegistrationBody>(this.url('/iam/users/assisted-registration'), {
        // El nombre viaja en partes y el backend compone el que se muestra: si
        // el front lo compusiera, la cuenta guardaría una versión y el contrato
        // otra.
        name: registration.name,
        lastName: registration.lastName,
        ...(registration.middleName === undefined ? {} : { middleName: registration.middleName }),
        ...(registration.motherLastName === undefined
          ? {}
          : { motherLastName: registration.motherLastName }),
        email: registration.email,
        reason: registration.reason,
        ...(registration.timeZone === undefined ? {} : { timeZone: registration.timeZone }),
        ...(registration.legalRepresentationId === undefined
          ? {}
          : { legalRepresentationId: registration.legalRepresentationId }),
        ...(registration.legalRepresentativeUserId === undefined
          ? {}
          : { legalRepresentativeUserId: registration.legalRepresentativeUserId }),
      })
      .pipe(map(toAssistedResult));
  }

  /**
   * `GET /iam/users` — una página del listado (UC-01-01, cara de lectura).
   *
   * Busca con `?q=` sobre el nombre visible o el correo de acceso; pagina por
   * cursor, sin total. Exige `SECURITY_ADMIN`.
   */
  searchUsers(query: UserSearchQuery = {}): Observable<UserPage> {
    // Parámetro a parámetro: el backend valida con `forbidNonWhitelisted` y un
    // opcional en `undefined` viaja como clave declarada, que vuelve 400.
    let params = new HttpParams();
    if (query.query !== undefined && query.query !== '') {
      params = params.set('q', query.query);
    }
    if (query.statusConceptId !== undefined) {
      params = params.set('status', query.statusConceptId);
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<RespuestaPaginaUsuarios>(this.url('/iam/users'), { params })
      .pipe(
        map((body) => ({
          ...body,
          items: body.items.map(toUserListItem),
        })),
      );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ---- transporte del listado de usuarios ---------------------------------- */

type WireUserListItem = Omit<UserListItem, 'lastLoginAt' | 'createdAt'> & {
  readonly lastLoginAt?: string;
  readonly createdAt: string;
};

type RespuestaPaginaUsuarios = Omit<UserPage, 'items'> & {
  readonly items: readonly ConNulos<WireUserListItem>[];
};

/**
 * Una fila del listado con sus fechas convertidas. La fila del transporte trae
 * además campos que la vista no usa (`mfaStatusConceptId`, `phoneVerified`);
 * se dejan pasar sin declarar: sumarlos al tipo sería prometer datos que
 * ninguna pantalla pide todavía.
 */
function toUserListItem(item: ConNulos<WireUserListItem>): UserListItem {
  const limpio = sinNulos<WireUserListItem>(item);
  return {
    id: limpio.id,
    displayName: limpio.displayName,
    statusConceptId: limpio.statusConceptId,
    emailVerified: limpio.emailVerified,
    ...(limpio.lastLoginAt === undefined ? {} : { lastLoginAt: new Date(limpio.lastLoginAt) }),
    createdAt: new Date(limpio.createdAt),
  };
}

function toSession(body: TokenResponseBody): Session {
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    expiresAt: new Date(body.expiresAt),
  };
}

function toCreatedUser(body: UserResponseBody): CreatedUser {
  return {
    id: body.id,
    displayName: body.displayName,
    // Se renombra acá para que ninguna pantalla lo confunda con una etiqueta:
    // el nombre dice que es un identificador de concepto.
    statusConceptId: body.status,
    createdAt: new Date(body.createdAt),
  };
}

function toAssistedResult(body: AssistedRegistrationBody): AssistedRegistrationResult {
  return {
    userId: body.userId,
    activationToken: body.activationToken,
    activationExpiresAt: new Date(body.activationExpiresAt),
    status: body.status,
  };
}
