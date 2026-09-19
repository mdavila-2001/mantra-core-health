import { inject, Injectable } from '@angular/core';
import { defer, finalize, of, shareReplay, tap, throwError, type Observable } from 'rxjs';

import { IamClient } from '../data-access/iam/iam.client';
import type { Session } from '../data-access/iam/iam.types';
import { RefreshTokenStorage } from '../auth/refresh-token.storage';
import { SessionStore } from '../auth/session.store';
import { CrossTabLock } from './cross-tab-lock';
import { SessionBroadcast } from './session-broadcast';

/** Nombre del lock: uno solo, todas las pestañas de este origen lo comparten. */
const LOCK_NAME = 'mantra-refresh-token';

/**
 * Refresco de la sesión, **con una sola petición en vuelo por pestaña, y
 * serializado entre pestañas**.
 *
 * Si tres llamadas fallan con 401 a la vez —lo normal al volver de una pestaña
 * en segundo plano— y cada una pidiera su propio refresco, se gastarían tres de
 * los 20 intentos por minuto que admite la API y las tres rotarían el token
 * unas sobre otras: la última ganaría y las otras dos dejarían tokens muertos.
 * Por eso el estado vive en un servicio y no en el interceptor: las funciones
 * interceptoras se ejecutan por petición y no tienen dónde recordar nada.
 *
 * Eso resuelve **una** pestaña. Con dos pestañas abiertas, cada una tiene su
 * propia instancia de este servicio —y su propio `inFlight`— así que las dos
 * pueden refrescar a la vez igual. El refresh token es de uso único (rotación
 * atómica en el servidor, MCH-005): la segunda pestaña presentaría el que la
 * primera ya rotó, y el servidor lo trata como reuso y **revoca la sesión
 * entera** — quien tenía dos pestañas abiertas queda deslogueado de las dos.
 *
 * `CrossTabLock` serializa el tramo de red entre pestañas, y el tramo relee el
 * refresh token de `localStorage` **ya dentro del lock** —no antes de ponerse a
 * esperarlo, que era leer justo el valor que iba a quedar viejo—: si otra
 * pestaña rotó mientras tanto, ahí está su token nuevo, todavía sin usar.
 * Ninguna presenta jamás uno gastado, así que ninguna dispara la revocación por
 * reuso.
 *
 * `SessionBroadcast` cierra la otra mitad: la pestaña que gana el turno publica
 * la sesión que obtuvo, y la que venía detrás la adopta en vez de pedir la suya.
 * Dos pestañas que refrescan a la vez terminan ambas con sesión válida y con
 * **un solo** refresco contra el backend.
 */
@Injectable({
  providedIn: 'root',
})
export class TokenRefreshService {
  private readonly iam = inject(IamClient);
  private readonly session = inject(SessionStore);
  private readonly storage = inject(RefreshTokenStorage);
  private readonly lock = inject(CrossTabLock);
  private readonly broadcast = inject(SessionBroadcast);

  /** Refresco en curso, compartido por todos los que lleguen mientras dure. */
  private inFlight: Observable<Session> | null = null;

  /**
   * Rota el par de tokens. Quien llame mientras hay uno en curso recibe **ese
   * mismo**, no uno nuevo.
   */
  refresh(): Observable<Session> {
    const current = this.inFlight;
    if (current !== null) {
      return current;
    }

    const capturedToken = this.session.refreshToken();
    if (capturedToken === null) {
      return throwError(() => new Error('No hay refresh token: la sesión no se puede renovar'));
    }

    const request = this.lock.withLock(LOCK_NAME, this.exchange(capturedToken)).pipe(
      // Se libera pase lo que pase: si quedara ocupado tras un fallo, ningún
      // intento posterior podría volver a refrescar en toda la sesión.
      finalize(() => {
        this.inFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.inFlight = request;

    return request;
  }

  /**
   * Lo que pasa **una vez conseguido el turno**, que no es lo mismo que lo que
   * se sabía antes de pedirlo.
   *
   * Todo el cuerpo va dentro de `defer` a propósito. Sin él, mirar el storage y
   * el canal ocurriría al *construir* el observable, o sea antes de ponerse a
   * esperar el lock: para cuando llegara el turno, el token a presentar ya
   * estaría decidido, y si otra pestaña rotó en el medio sería uno gastado. El
   * servidor lo trata como reuso y revoca la sesión entera — exactamente lo que
   * el lock viene a evitar. Serializar sin releer dentro del lock no sirve de
   * nada.
   */
  private exchange(capturedToken: string): Observable<Session> {
    return defer(() => {
      const almacenado = this.storage.read();
      const publicada = this.broadcast.ultimaPublicada();

      // Otra pestaña ya rotó mientras ésta esperaba, y publicó el resultado. Si
      // lo publicado es lo que está vigente en `localStorage`, no hay nada que
      // pedir: se adopta y se ahorra el viaje de red. Ésa es la mitad del
      // criterio que el lock por sí solo no daba —un solo refresco contra el
      // backend—, y por eso se compara contra el almacenado en vez de confiar
      // en la publicación a secas: una publicación vieja, de una rotación
      // anterior, traería un token ya gastado y sería el mismo fallo de reuso,
      // sólo que más difícil de ver.
      if (
        publicada !== null &&
        almacenado !== null &&
        publicada.refreshToken === almacenado &&
        almacenado !== capturedToken
      ) {
        this.session.renew(publicada);
        return of(publicada);
      }

      // Si no hay nada que adoptar, se presenta el más nuevo que se conozca:
      // el persistido si lo hay, que es lo único que sobrevive fuera de la
      // memoria de cada pestaña.
      return this.iam.refresh(almacenado ?? capturedToken).pipe(
        tap((session) => {
          this.session.renew(session);
          // Sin esto, el refresh token vigente sólo vivía en memoria: una
          // recarga de página volvía a presentar el que ya estaba en
          // `localStorage` —el anterior a esta misma rotación—, y el servidor
          // lo rechazaba por reuso. Persistirlo acá es lo mismo que hace
          // `AuthService.open()` tras el login; acá faltaba.
          this.storage.write(session.refreshToken);
          // Y se avisa, para que la pestaña que venga detrás adopte en vez de
          // gastar su propio refresco.
          this.broadcast.publicar(session);
        }),
      );
    });
  }
}
