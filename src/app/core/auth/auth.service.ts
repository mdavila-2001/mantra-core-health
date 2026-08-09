import { inject, Injectable } from '@angular/core';
import { catchError, map, of, tap, type Observable } from 'rxjs';

import { IamClient } from '../data-access/iam/iam.client';
import type {
  LoginCredentials,
  PatientRegistration,
  RegisteredPatient,
  Session,
} from '../data-access/iam/iam.types';
import { authMethodOf, loginFailureCategory } from '../observability/business/auth-tracing';
import { TracingService } from '../observability/tracing/tracing.service';
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
  private readonly tracing = inject(TracingService);

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

  /**
   * Inicia sesión con correo o documento — nunca ambos, lo impide el tipo.
   *
   * El span `auth.login` cubre la operación entera, no solo la petición: la
   * llamada a la API **y** el guardado de la sesión. Es lo que la persona vive
   * como «entrar», y es donde hay que mirar cuando alguien dice que entrar
   * tarda.
   *
   * De las credenciales solo viaja el **método** (`email` o `national_id`), que
   * sale del discriminante del tipo. El correo, el documento, la contraseña y
   * el código de segundo factor no se tocan. Ver `observability/business/auth-tracing.ts`.
   */
  login(credentials: LoginCredentials): Observable<Session> {
    return this.tracing.traceObservable(
      'auth.login',
      { 'auth.method': authMethodOf(credentials), 'app.feature': 'auth' },
      (span) =>
        this.iam.login(credentials).pipe(
          tap({
            next: (session) => {
              this.open(session);
              span.setAttribute('auth.result', 'success');
            },
            error: (error: unknown) => {
              span.setAttribute('auth.result', 'failure');
              // Categoría cerrada, nunca el mensaje de la API: puede citar el
              // valor rechazado.
              span.setAttribute('auth.failure.category', loginFailureCategory(error));
            },
          }),
        ),
    );
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
   * ## El orden importa, y no es el intuitivo
   *
   * El aviso sale **primero** y la limpieza va **inmediatamente después**, sin
   * esperar la respuesta.
   *
   * · Primero el aviso, porque el interceptor toma el access token del store en
   *   el momento de suscribirse: limpiar antes lo dejaría sin credencial y el
   *   servidor no revocaría nada.
   *
   * · Y sin esperar, porque quien pulsó «cerrar sesión» ya salió. Limpiar
   *   dentro del callback dejaba una ventana de un viaje de red completo en la
   *   que el refresh token **seguía en `localStorage`**: bastaba con que la
   *   navegación al login ocurriera antes de la respuesta —que es lo normal,
   *   porque es local e instantánea— para que el borrado nunca corriera y la
   *   sesión volviera sola en la siguiente recarga. Lo destapó la prueba de
   *   extremo a extremo, entrando de nuevo a `/panel` después de salir.
   *
   * Usa `logout` y no `logout-all` a propósito: esa otra ruta cierra las
   * sesiones de **todos** sus dispositivos, que es otra intención.
   */
  logout(): void {
    // Un error acá no cambia nada de lo que sigue: el aviso es cortesía hacia
    // el servidor, no la condición para salir.
    this.iam.logout().subscribe({ error: () => undefined });
    this.clearLocal();
  }

  private clearLocal(): void {
    this.session.clear();
    this.storage.clear();
  }

  /**
   * Elige la organización activa cuando el token trae más de una.
   *
   * Se persiste para no volver a preguntarla en cada recarga. Antes no se
   * guardaba, y quien perteneciera a varias organizaciones pasaba por el
   * selector **cada vez que recargaba** — fricción repetida que no aportaba
   * nada: la elección no es un secreto, es la misma cadena que ya viaja en cada
   * petición como `X-Tenant-Id`.
   */
  selectTenant(tenantId: string): void {
    this.session.selectTenant(tenantId);

    // Solo se guarda si el store la aceptó: `selectTenant` ignora un
    // identificador que no esté en el token, y persistir uno rechazado dejaría
    // basura que la próxima sesión tendría que volver a descartar.
    if (this.session.activeTenantId() === tenantId) {
      this.storage.writeSelectedTenant(tenantId);
    }
  }

  /**
   * Da de baja la sesión local cuando **otra pestaña** la cerró.
   *
   * Sin esto, cerrar sesión en una pestaña dejaba la otra funcionando hasta que
   * su access token venciera y el refresco fallara. En un dispositivo
   * compartido eso es una sesión abierta que alguien creyó haber cerrado.
   *
   * No llama a la API: la otra pestaña ya lo hizo. Solo limpia lo local.
   */
  watchSessionClosedElsewhere(): () => void {
    return this.storage.onClearedInAnotherTab(() => this.session.clear());
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
      tap((session) => this.reopen(session)),
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

  /**
   * Abre la sesión recuperada y le devuelve su organización.
   *
   * Se separa de {@link open} a propósito: al **iniciar sesión** la elección
   * anterior no vale —puede ser de otra persona en el mismo dispositivo— y por
   * eso `SessionStore.start` la descarta. Al **recuperar** la sesión sí vale:
   * es la misma persona volviendo.
   *
   * `selectTenant` valida contra el token, así que una organización que ya no
   * le corresponda se descarta sola y se vuelve a preguntar.
   */
  private reopen(session: Session): void {
    this.open(session);

    const guardada = this.storage.readSelectedTenant();
    if (guardada !== null) {
      this.session.selectTenant(guardada);
    }
  }
}
