import { HttpClient, HttpParams } from '@angular/common/http';
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
  PasswordReset,
  PasswordResetRequested,
  VerificationResent,
  PasswordResetResult,
  PatientRegistration,
  PractitionerRegistration,
  RegisteredPatient,
  RegisteredPractitioner,
  Session,
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

  /** `POST /iam/auth/token/refresh`. Rota el par completo: el viejo deja de servir. */
  refresh(refreshToken: string): Observable<Session> {
    return this.http
      .post<TokenResponseBody>(this.url('/iam/auth/token/refresh'), { refreshToken })
      .pipe(map(toSession));
  }

  /** `POST /iam/auth/register-patient`. Auto-registro con documento de identidad. */
  registerPatient(registration: PatientRegistration): Observable<RegisteredPatient> {
    return this.http.post<RegisteredPatient>(this.url('/iam/auth/register-patient'), {
      nationalId: registration.nationalId,
      password: registration.password,
      displayName: registration.displayName,
      ...(registration.email === undefined ? {} : { email: registration.email }),
      ...(registration.birthDate === undefined ? {} : { birthDate: registration.birthDate }),
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
      displayName: registration.displayName,
      licenseNumber: registration.licenseNumber,
      credentialNumber: registration.credentialNumber,
      ...(registration.professionalTitle === undefined
        ? {}
        : { professionalTitle: registration.professionalTitle }),
      ...(registration.phone === undefined ? {} : { phone: registration.phone }),
    });
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
   * Una sola petición: el backend crea persona, perfil y cuenta **en la misma
   * transacción** (regla 11 del modelo, registro CTI atómico). Por eso acá no
   * hay orquestación ni reanudación que hacer — o quedó todo, o no quedó nada.
   */
  assistedRegistration(
    registration: AssistedPatientRegistration,
  ): Observable<AssistedRegistrationResult> {
    return this.http
      .post<AssistedRegistrationBody>(this.url('/iam/users/assisted-registration'), {
        displayName: registration.displayName,
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
