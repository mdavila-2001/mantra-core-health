import { inject, Injectable } from '@angular/core';
import { catchError, map, of, tap, type Observable } from 'rxjs';

import { IamClient } from '../data-access/iam/iam.client';
import type {
  LoginCredentials,
  PatientRegistration,
  RegisteredPatient,
  Session,
} from '../data-access/iam/iam.types';
import { RefreshTokenStorage } from './refresh-token.storage';
import { SessionStore } from './session.store';

/**
 * Caso de uso de la sesión: abrirla, cerrarla y recuperarla.
 *
 * Envuelve a {@link SessionStore} —que solo guarda estado— y le suma lo que
 * necesita la aplicación: hablar con la API y persistir lo justo para sobrevivir
 * a una recarga.
 *
 * **No duplica la lógica de refresco.** Renovar un token vencido en medio de una
 * petición es del interceptor (`TokenRefreshService`), que además garantiza que
 * haya una sola renovación en vuelo. Acá solo se usa el refresco para el caso
 * distinto de recuperar la sesión al abrir la aplicación.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly iam = inject(IamClient);
  private readonly session = inject(SessionStore);
  private readonly storage = inject(RefreshTokenStorage);

  /** Lo que la interfaz necesita saber de quién está adentro. */
  readonly isAuthenticated = this.session.isAuthenticated;
  readonly userId = this.session.userId;
  readonly roles = this.session.roles;
  readonly tenants = this.session.tenants;
  readonly activeTenantId = this.session.activeTenantId;
  readonly needsTenantSelection = this.session.needsTenantSelection;

  /** Nombre para mostrar y nombre de la organización, ambos del token. */
  readonly displayName = this.session.displayName;

  tenantName(tenantId: string): string {
    return this.session.tenantName(tenantId);
  }

  /** Inicia sesión con correo o documento — nunca ambos, lo impide el tipo. */
  login(credentials: LoginCredentials): Observable<Session> {
    return this.iam.login(credentials).pipe(tap((session) => this.open(session)));
  }

  /**
   * Auto-registro de paciente. **No abre sesión**: el backend devuelve los
   * identificadores del perfil, no tokens, así que después hay que iniciar
   * sesión como cualquiera.
   */
  registerPatient(registration: PatientRegistration): Observable<RegisteredPatient> {
    return this.iam.registerPatient(registration);
  }

  /**
   * Cierra la sesión.
   *
   * Avisa al servidor —para que el refresh token deje de servir— y limpia
   * localmente **pase lo que pase**: si la petición falla, la persona igual
   * quiso salir, y dejarla adentro por un error de red sería lo peor de los dos
   * mundos. El token local se descarta y el del servidor caduca solo.
   *
   * Usa `logout` y no `logout-all` a propósito: esa otra ruta cierra las
   * sesiones de **todos** sus dispositivos, que es otra intención.
   */
  logout(): void {
    this.iam.logout().subscribe({
      next: () => this.clearLocal(),
      error: () => this.clearLocal(),
    });
  }

  private clearLocal(): void {
    this.session.clear();
    this.storage.clear();
  }

  /** Elige la organización activa cuando el token trae más de una. */
  selectTenant(tenantId: string): void {
    this.session.selectTenant(tenantId);
  }

  /**
   * Recupera la sesión al abrir la aplicación, canjeando el refresh token
   * guardado por un par nuevo.
   *
   * Devuelve `false` sin pedir nada cuando no hay token guardado —que es el caso
   * normal de quien entra por primera vez— y también cuando el canje falla: un
   * refresh token vencido o revocado no es un error que mostrar, es simplemente
   * no haber iniciado sesión.
   */
  restoreSession(): Observable<boolean> {
    const stored = this.storage.read();
    if (stored === null) {
      return of(false);
    }

    return this.iam.refresh(stored).pipe(
      tap((session) => this.open(session)),
      map(() => true),
      catchError(() => {
        // El token guardado ya no sirve: se descarta para no reintentar en cada
        // arranque contra el límite de la API.
        this.storage.clear();
        return of(false);
      }),
    );
  }

  private open(session: Session): void {
    this.session.start(session);
    this.storage.write(session.refreshToken);
  }
}
