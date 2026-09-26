import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, inject, Injectable } from '@angular/core';
import { catchError, map, of, retry, tap, throwError, timer, type Observable } from 'rxjs';

import { REFRESH_COOKIE_MODE } from '../data-access/api';
import { IamClient } from '../data-access/iam/iam.client';
import type {
  LoginCredentials,
  PatientRegistration,
  RegisteredPatient,
  Session,
} from '../data-access/iam/iam.types';
import { authMethodOf, loginFailureCategory } from '../observability/business/auth-tracing';
import { isTransientFailure } from '../http/transient-failure';
import { TracingService } from '../observability/tracing/tracing.service';
import { RefreshTokenStorage } from './refresh-token.storage';
import { SESSION_CLEANERS } from './session-cleanup';
import { SessionStore } from './session.store';

/** Cuántas veces se reintenta restaurar la sesión si no hay red, y cada cuánto. */
const RESTORE_RETRIES = 1;
const RESTORE_RETRY_MS = 800;

/** El servidor dijo que el token no sirve: ahí sí se descarta (400/401). */
function isDefinitiveRejection(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 400 || error.status === 401);
}

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
  private readonly cookieMode = inject(REFRESH_COOKIE_MODE);
  private readonly cleaners = inject(SESSION_CLEANERS, { optional: true }) ?? [];
  private readonly document = inject(DOCUMENT);

  /** Lo que la interfaz necesita saber de quién está adentro. */
  readonly isAuthenticated = this.session.isAuthenticated;
  readonly userId = this.session.userId;
  readonly roles = this.session.roles;
  readonly tenants = this.session.tenants;
  readonly activeTenantId = this.session.activeTenantId;
  /** El tipo (`TenantTypeCode`) de la organización activa; ver `SessionStore.activeTenantType`. */
  readonly activeTenantType = this.session.activeTenantType;
  readonly needsTenantSelection = this.session.needsTenantSelection;

  /** Nombre para mostrar y nombre de la organización, ambos del token. */
  readonly displayName = this.session.displayName;

  /**
   * Perfil de paciente del titular, si la cuenta es la de un paciente. Es lo
   * que habilita el autoservicio del portal —reservar un turno para uno mismo—
   * y `null` para el personal de salud o de administración.
   */
  readonly patientProfileId = this.session.patientProfileId;

  /**
   * Perfil profesional del titular, si la cuenta es la de quien atiende. Es lo
   * que identifica su agenda entre las de la organización, y `null` para
   * pacientes o administración.
   */
  readonly practitionerProfileId = this.session.practitionerProfileId;

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
   *   extremo a extremo, entrando de nuevo a `/dashboard` después de salir.
   *
   * Usa `logout` y no `logout-all` a propósito: esa otra ruta cierra las
   * sesiones de **todos** sus dispositivos, que es otra intención.
   */
  logout(): void {
    // Un error acá no cambia nada de lo que sigue: el aviso es cortesía hacia
    // el servidor, no la condición para salir.
    this.iam.logout().subscribe({ error: () => undefined });
    this.discardLocalSession();
  }

  /**
   * Descarta la sesión **local**: memoria, lo que se guardó de ella y todo lo
   * sensible que otras piezas dejaron en el navegador (TX-31). También la llama la
   * pantalla de Seguridad tras «cerrar sesión en todos lados», cuando el servidor
   * ya revocó todo (`AccountSecurityClient.logoutAll`).
   */
  discardLocalSession(): void {
    this.session.clear();
    this.storage.clear();
    // Un limpiador roto no puede impedir cerrar sesión ni frenar a los demás.
    this.cleaners.forEach((cleaner) => {
      try {
        cleaner();
      } catch {
        /* se ignora a propósito */
      }
    });
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
      this.storage.writeSelectedTenant(tenantId, this.session.userId());
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
   * guardado —o, en modo cookie, la cookie `httpOnly`— por un par nuevo.
   *
   * Devuelve `false` sin pedir nada cuando no hay con qué recuperarla —que es el
   * caso normal de quien entra por primera vez—.
   *
   * **Sólo se descarta lo guardado si el servidor lo rechazó (400/401)** (TX-30).
   * Un corte de red al arrancar, un 429 o un 5xx no dicen nada del token: se
   * reintenta una vez, se conserva la sesión guardada y, si volvió la red, se
   * restaura sola en cuanto el navegador avisa `online`. Antes cualquier error
   * borraba el token y una clínica con la red caída al abrir quedaba deslogueada.
   */
  restoreSession(): Observable<boolean> {
    const stored = this.cookieMode ? null : this.storage.read();
    const hayConQueRestaurar = this.cookieMode ? this.storage.hasSessionHint() : stored !== null;
    if (!hayConQueRestaurar) {
      return of(false);
    }

    return this.iam.refresh(stored).pipe(
      retry({
        count: RESTORE_RETRIES,
        delay: (error: unknown) =>
          isTransientFailure(error) ? timer(RESTORE_RETRY_MS) : throwError(() => error),
      }),
      tap((session) => this.open(session)),
      map(() => true),
      catchError((error: unknown) => {
        if (isDefinitiveRejection(error)) {
          // El token guardado ya no sirve: se descarta para no reintentar en
          // cada arranque contra el límite de la API.
          this.storage.clear();
        } else if (isTransientFailure(error)) {
          this.restoreWhenOnline();
        }
        return of(false);
      }),
    );
  }

  /**
   * Reintenta restaurar **una vez** cuando el navegador recupera la red.
   *
   * Sólo se llama tras un fallo transitorio en el arranque, con la sesión
   * guardada intacta. Si no hay ventana (servidor) no hace nada.
   */
  private restoreWhenOnline(): void {
    this.document.defaultView?.addEventListener('online', () => this.restoreSession().subscribe(), {
      once: true,
    });
  }

  private open(session: Session): void {
    this.session.start(session);
    if (this.cookieMode) {
      // El refresh token no llega al cuerpo ni se guarda: sólo la marca.
      this.storage.writeSessionHint();
    } else {
      this.storage.write(session.refreshToken);
    }
    this.applyRememberedTenant();
  }

  /**
   * Devuelve la última organización que eligió **esta** persona en este
   * dispositivo, si sigue entre las del token (TX-11). `selectTenant` valida
   * contra el token, así que una que ya no le corresponda se descarta sola.
   */
  private applyRememberedTenant(): void {
    const guardada = this.storage.readSelectedTenant(this.session.userId());
    if (guardada !== null) {
      this.session.selectTenant(guardada);
    }
  }
}
