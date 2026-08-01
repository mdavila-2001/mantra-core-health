import { computed, inject, Injectable, isDevMode, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, firstValueFrom, of, tap, type Observable } from 'rxjs';

import { IamClient } from '../data-access/iam/iam.client';
import type { LoginCredentials, Session } from '../data-access/iam/iam.types';
import { SessionStore } from './session.store';
import { SessionStorage } from './session.storage';

/**
 * Lo que la interfaz necesita saber de quien está usando la aplicación.
 *
 * Sale entero del access token: la API **no expone `/me`** a propósito, y el token ya trae `sub`,
 * `roles[]` y `tenants[]`. Pedir un perfil sería una petición de ida y vuelta para llegar a lo que
 * ya estaba en la mano.
 */
export interface AuthenticatedUser {
  readonly userId: string;
  readonly roles: readonly string[];
  readonly tenants: readonly string[];
}

/**
 * Fachada de la sesión: iniciar, restaurar, elegir organización y cerrar.
 *
 * Envuelve a {@link SessionStore} **sin cambiarlo**, tal como su comentario anticipaba. El store
 * sigue siendo el estado en memoria y no sabe de persistencia ni de peticiones; acá viven las tres
 * cosas que sí las necesitan.
 *
 * ## Restaurar la sesión al recargar
 *
 * El access token no sobrevive a la recarga (a propósito, ver {@link SessionStorage}), así que al
 * arrancar solo hay un refresh token guardado y hace falta **una petición** para volver a tener
 * sesión. Eso es asíncrono, y de ahí sale la regla que gobierna todo lo demás:
 *
 * > Nadie puede preguntar «¿hay sesión?» antes de que la restauración termine.
 *
 * Un guard que leyera el store en el primer turno vería `null` y echaría al login a alguien que sí
 * tenía sesión — un logout espontáneo en cada F5. Por eso existe {@link ensureRestored}, y por eso
 * los guards lo esperan.
 *
 * La restauración se dispara **una sola vez**: {@link restore} memoriza su propia promesa, así que
 * tres guards resolviéndose a la vez comparten la misma petición.
 *
 * ## Bajo SSR no hay nada que restaurar
 *
 * El servidor no ve `localStorage` ni tiene cookie de sesión, así que la restauración se resuelve
 * de inmediato con «no hay sesión». Las pantallas protegidas no se prerenderizan justamente por
 * eso — ver `app.routes.server.ts`.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly iam = inject(IamClient);
  private readonly session = inject(SessionStore);
  private readonly storage = inject(SessionStorage);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Restauración en curso o ya terminada. `null` mientras nadie la haya pedido. */
  private restoring: Promise<void> | null = null;

  private readonly restored = signal(false);

  /** Si la restauración inicial ya terminó. Las pantallas la usan para mostrar S1. */
  readonly isRestored = this.restored.asReadonly();

  readonly isAuthenticated = this.session.isAuthenticated;
  readonly roles = this.session.roles;
  readonly tenants = this.session.tenants;
  readonly activeTenantId = this.session.activeTenantId;
  readonly needsTenantSelection = this.session.needsTenantSelection;

  readonly user = computed<AuthenticatedUser | null>(() => {
    const claims = this.session.claims();
    if (claims === null) {
      return null;
    }
    return {
      userId: claims.sub,
      roles: claims.roles,
      tenants: claims.tenants,
    };
  });

  /**
   * Nombre para mostrar en el encabezado.
   *
   * Sale del claim `name`, que la API agrega tanto en el login como en el refresco —si sólo lo
   * pusiera el login, el nombre desaparecería en la primera rotación de token—.
   *
   * El claim se omite cuando está vacío, así que el respaldo sigue siendo el identificador
   * acortado: es cierto y distingue una cuenta de otra, que es todo lo que se le pide a un nombre
   * en el encabezado.
   */
  readonly displayName = computed(() => {
    const claims = this.session.claims();
    if (claims === null) {
      return '';
    }
    return claims.name ?? `Usuario ${claims.sub.slice(0, 8)}`;
  });

  /**
   * Las organizaciones de la sesión con su nombre legible.
   *
   * El nombre sale del claim `tenantNames`. Cuando falta —un token viejo, o una organización sin
   * nombre cargado— se cae al identificador acortado en vez de dejar la entrada en blanco: una
   * lista con un elemento vacío es peor que una con un nombre feo.
   */
  readonly tenantOptions = computed<readonly { id: string; name: string }[]>(() => {
    const claims = this.session.claims();
    const names = claims?.tenantNames ?? {};

    return this.session.tenants().map((id) => ({
      id,
      name: names[id] ?? `Organización ${id.slice(0, 8)}`,
    }));
  });

  /** Si tiene **alguno** de los roles pedidos. Sin roles pedidos, alcanza con estar autenticado. */
  hasAnyRole(required: readonly string[]): boolean {
    if (required.length === 0) {
      return this.isAuthenticated();
    }
    const roles = this.roles();
    return required.some((role) => roles.includes(role));
  }

  /**
   * Inicia sesión y deja la organización resuelta cuando se puede.
   *
   * El error **no se traga**: sube tal cual para que la pantalla de login lo traduzca con
   * `viewStateFromHttpError` y muestre lo que la API dijo. Un login que falla en silencio es una
   * pantalla que no reacciona.
   */
  login(credentials: LoginCredentials): Observable<Session> {
    return this.iam.login(credentials).pipe(tap((session) => this.open(session)));
  }

  /**
   * Fija la organización activa y la recuerda.
   *
   * La validación es del store —solo acepta un tenant del token—, así que acá se persiste
   * **después** de pedirla y solo si quedó fijada. Guardar una que el store rechazó dejaría la
   * próxima recarga intentando entrar a una organización ajena.
   */
  selectTenant(tenantId: string): void {
    this.session.selectTenant(tenantId);
    if (this.session.activeTenantId() === tenantId) {
      this.storage.writeTenantId(tenantId);
    }
  }

  /**
   * Cierra la sesión: en el servidor **y** en el navegador.
   *
   * `POST /iam/auth/logout` revoca la sesión del `sid` del token y su refresh token. Sin esa
   * llamada, borrar el almacenamiento local sólo esconde la credencial: un refresh token robado
   * seguiría sirviendo durante los 30 días que dura, aunque la persona hubiera cerrado sesión.
   *
   * ## El estado local se limpia primero, y pase lo que pase
   *
   * La petición sale **antes** de limpiar —necesita el token para autenticarse— pero el estado se
   * borra sin esperar la respuesta, y también si la respuesta falla. Que la red se caiga no puede
   * dejar a alguien con la sesión abierta en una máquina que quiso abandonar; y como la ruta es
   * idempotente, revocar dos veces no es un error.
   */
  logout(): void {
    const hadSession = this.session.accessToken() !== null;

    if (hadSession) {
      // `subscribe` sin esperar: la interfaz ya navegó al login cuando esto vuelva. El error se
      // traga a propósito —no hay nada que la persona pueda hacer con él— pero se anota en
      // desarrollo, porque un logout que no revoca del lado del servidor es un dato de seguridad.
      this.iam.logout().subscribe({
        error: (error: unknown) => {
          if (isDevMode()) {
            console.warn('[AuthService] el cierre de sesión no llegó a la API', error);
          }
        },
      });
    }

    this.session.clear();
    this.storage.clear();
    // Ya no queda nada que restaurar, pero la restauración sí está resuelta: dejar la promesa vieja
    // haría que un login posterior en la misma pestaña esperara por algo que ya pasó.
    this.restoring = Promise.resolve();
    this.restored.set(true);
  }

  /**
   * Espera a que la restauración inicial termine, disparándola si nadie lo hizo.
   *
   * Es lo primero que hace todo guard. Idempotente y compartida: llamarla cinco veces produce una
   * sola petición.
   */
  ensureRestored(): Promise<void> {
    this.restoring ??= this.restore();
    return this.restoring;
  }

  /**
   * Cambia el refresh token guardado por una sesión viva.
   *
   * Cualquier fallo termina en «no hay sesión», nunca en una excepción: si el token guardado está
   * vencido, revocado o corrupto, lo correcto es arrancar sin sesión y que el guard mande al login.
   * Propagar el error dejaría la aplicación sin arrancar por una credencial vieja.
   */
  private async restore(): Promise<void> {
    const refreshToken = this.isBrowser ? this.storage.readRefreshToken() : null;

    if (refreshToken === null) {
      this.restored.set(true);
      return;
    }

    const session = await firstValueFrom(
      this.iam.refresh(refreshToken).pipe(catchError(() => of(null))),
    );

    if (session === null) {
      this.storage.clear();
    } else {
      this.open(session, this.storage.readTenantId());
    }

    this.restored.set(true);
  }

  /**
   * Abre la sesión en memoria y persiste lo que debe sobrevivir.
   *
   * El refresh token se guarda **siempre**, también al restaurar: `POST /iam/auth/token/refresh`
   * rota el par completo y el anterior deja de servir, así que no reescribirlo dejaría guardado un
   * token muerto y la próxima recarga terminaría en el login.
   *
   * `preferredTenantId` reinstala la elección guardada. Solo se aplica si sigue estando entre los
   * tenants del token nuevo: los permisos pueden haber cambiado entre una sesión y la siguiente.
   */
  private open(session: Session, preferredTenantId?: string | null): void {
    this.session.start({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    this.storage.writeRefreshToken(session.refreshToken);

    if (preferredTenantId !== undefined && preferredTenantId !== null) {
      this.selectTenant(preferredTenantId);
    }

    // Con una sola organización el store la resuelve solo. Se persiste igual para que la próxima
    // recarga no dependa de que siga habiendo una sola.
    const active = this.session.activeTenantId();
    if (active !== null) {
      this.storage.writeTenantId(active);
    }
  }
}
