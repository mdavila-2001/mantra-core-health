import { DOCUMENT, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import type { Session } from '../data-access/iam/iam.types';

/** Nombre del canal: uno solo, todas las pestañas de este origen lo comparten. */
const CANAL = 'mantra-session';

/**
 * La sesión recién rotada, tal como viaja entre pestañas.
 *
 * `expiresAt` va como texto ISO porque el clon estructurado de
 * `postMessage` conserva `Date`, pero depender de eso ataría el contrato a un
 * detalle del navegador; el texto se valida igual al entrar.
 */
interface MensajeDeSesion {
  readonly tipo: 'session-renewed';
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
}

/**
 * Reparte entre pestañas la sesión que una de ellas acaba de rotar.
 *
 * POR QUÉ HACE FALTA, TENIENDO YA EL LOCK. `CrossTabLock` serializa el refresco:
 * garantiza que dos pestañas no presenten el mismo refresh token de uso único y
 * que ninguna dispare la revocación por reuso. Pero serializar no evita el
 * trabajo: la segunda pestaña, al recibir el turno, seguía pidiendo su propio
 * refresco. Con veinte intentos por minuto y varias pestañas abiertas, eso se
 * gasta. El criterio pedía dos pestañas con sesión válida **y un solo refresco
 * contra el backend**; el lock daba lo primero y este canal da lo segundo.
 *
 * POR QUÉ UN CANAL Y NO `localStorage`. El token de acceso **no se persiste a
 * propósito** (ver `RefreshTokenStorage`): dura minutos y se obtiene con el
 * otro, así que guardarlo sería dejar una credencial de más en disco sin ganar
 * nada. Para que la pestaña que espera adopte la sesión entera hace falta
 * también el token de acceso, y un canal lo pasa **de memoria a memoria**, sin
 * escribirlo en ningún lado. `BroadcastChannel` es del mismo origen por
 * definición, y esas pestañas ya comparten el refresh token: no se abre ninguna
 * superficie nueva.
 *
 * Guardas dobles, como el canal de la demo de farmacia: bajo SSR no hay canal, y
 * en un navegador sin `BroadcastChannel` cada pestaña refresca por su cuenta —
 * que es el comportamiento anterior, correcto aunque más caro.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionBroadcast {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * El canal se abre en el constructor, no al primer uso.
   *
   * Tiene que estar escuchando **antes** de que esta pestaña se ponga a esperar
   * el lock: si se abriera recién al necesitarlo, la publicación de la pestaña
   * que ganó el turno podría haber pasado ya, y no hay reenvío.
   */
  private readonly canal: BroadcastChannel | null = this.abrirCanal();

  /** Última sesión que publicó otra pestaña. Sólo en memoria. */
  private ultima: Session | null = null;

  /** La última sesión publicada por otra pestaña, o `null` si no hubo ninguna. */
  ultimaPublicada(): Session | null {
    return this.ultima;
  }

  /**
   * Avisa a las demás pestañas de que esta acaba de rotar la sesión.
   *
   * @param session - Sesión nueva, ya persistida por quien la obtuvo.
   */
  publicar(session: Session): void {
    this.canal?.postMessage({
      tipo: 'session-renewed',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    } satisfies MensajeDeSesion);
  }

  /**
   * Registra una sesión llegada de otra pestaña.
   *
   * Público para que las pruebas simulen a la otra pestaña sin montar un canal
   * de verdad, que en jsdom no existe.
   *
   * @param session - Sesión publicada por otra pestaña.
   */
  recibir(session: Session): void {
    this.ultima = session;
  }

  /**
   * Abre el canal, con las dos guardas.
   *
   * @returns El canal, o `null` si no hay dónde abrirlo.
   */
  private abrirCanal(): BroadcastChannel | null {
    // Se pregunta por la ventana del `DOCUMENT` inyectado y no por el global,
    // igual que `RefreshTokenStorage` y `CrossTabLock`: bajo SSR no hay ninguna,
    // y en un navegador viejo puede no existir `BroadcastChannel`.
    const view = this.isBrowser ? this.document.defaultView : null;
    if (view === null || view === undefined || view.BroadcastChannel === undefined) {
      return null;
    }

    const canal = new view.BroadcastChannel(CANAL);
    canal.onmessage = (evento: MessageEvent<unknown>) => {
      // El canal es del origen entero: sólo entra lo que tiene la forma del
      // contrato. Una sesión a medias en el store dejaría a la persona con un
      // token roto hasta el próximo 401.
      const session = desdeMensaje(evento.data);
      if (session !== null) {
        this.recibir(session);
      }
    };
    return canal;
  }
}

/**
 * Valida un mensaje del canal y lo convierte en `Session`.
 *
 * @param data - Lo que llegó por el canal, sin tipar.
 * @returns La sesión, o `null` si el mensaje no cumple el contrato.
 */
function desdeMensaje(data: unknown): Session | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }

  const mensaje = data as Partial<MensajeDeSesion>;
  if (
    mensaje.tipo !== 'session-renewed' ||
    typeof mensaje.accessToken !== 'string' ||
    typeof mensaje.refreshToken !== 'string' ||
    typeof mensaje.expiresAt !== 'string'
  ) {
    return null;
  }

  const expiresAt = new Date(mensaje.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  return {
    accessToken: mensaje.accessToken,
    refreshToken: mensaje.refreshToken,
    expiresAt,
  };
}
