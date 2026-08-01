import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AccountActivation,
  ActivationResult,
  LoginCredentials,
  NewUser,
  PatientRegistration,
  RegisteredPatient,
  Session,
  VerifiedEmail,
} from './iam.types';

/** Respuestas de la API tal como viajan: las fechas son texto. */
interface TokenResponseBody {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
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

  /** `POST /iam/users`. Alta hecha por un administrador. */
  createUser(user: NewUser): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(this.url('/iam/users'), {
      displayName: user.displayName,
      email: user.email,
      password: user.password,
      ...(user.timeZone === undefined ? {} : { timeZone: user.timeZone }),
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function toSession(body: TokenResponseBody): Session {
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    expiresAt: new Date(body.expiresAt),
  };
}
