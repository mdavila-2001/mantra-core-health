/* ============================================================================
    El enlace que lleva a alguien al chat con el contexto puesto.

    ## Para qué

    Los botones «Chatear con la farmacia» y «Consultar por chat» del
    marketplace no abren el hilo ellos mismos: llevan a `/messaging` con a
    quién escribirle (`escribirA=<slug>` o `pedido=<id>`) y, si hay, **de
    qué**. La bandeja ya sabe resolver el slug, crear el hilo si no existía y
    pasar por el login si no hay sesión; esto sólo le agrega la tarjeta de
    contexto que se manda al abrir.

    ## Por qué el contexto NO viaja en la URL

    Antes viajaba (`?sobre=&titulo=&detalle=&ruta=`) y la bandeja lo mandaba
    al abrir, sin preguntar. Eso convertía cualquier enlace —un mail, otra
    web, un mensaje— en «mandá esta tarjeta, con este título, a esta vitrina»
    en nombre de quien lo tocara con la sesión abierta.

    Ahora el botón deja el contexto en `sessionStorage` bajo una clave de un
    solo uso (`ctx=<nonce>`, un `crypto.randomUUID()`), y la URL lleva sólo el
    nonce. La bandeja manda tarjeta **sólo** si encuentra ese nonce en el
    almacenamiento de su pestaña: un enlace de afuera no puede fabricar uno que
    exista ahí, y con un nonce ausente o desconocido el hilo se abre igual,
    sin tarjeta.

    El login no lo rompe: el guard guarda la dirección (con el nonce) y vuelve
    a ella en **la misma pestaña**, donde `sessionStorage` sigue intacto.

    ## Lo que nunca va acá

    Nada clínico —ver `chat-context.ts`—: es lo que ya muestra la ficha
    pública o el pedido.
   ========================================================================== */

import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, type ParamMap, type Params } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { LOGIN_ROUTE } from '../http/auth.interceptor';
import { normalizarContexto, type ContextoDeChat } from './chat-context';

/** Los nombres de los parámetros, en un solo lugar. */
export const PARAMETRO = {
  escribirA: 'escribirA',
  pedido: 'pedido',
  /** El nonce del contexto guardado en la pestaña. Nunca el contexto. */
  ctx: 'ctx',
} as const;

/** Prefijo de la clave de `sessionStorage` de cada contexto en espera. */
export const PREFIJO_DE_CONTEXTO = 'alovida.chat.contexto.';

/**
 * Cuánto vive un contexto sin usar. Lo que tarda un login con margen: pasado
 * eso, el botón que lo dejó ya no es lo que la persona tiene en la cabeza.
 */
export const VIGENCIA_DE_CONTEXTO_MS = 30 * 60_000;

/**
 * Lo que se guarda bajo cada nonce: el contexto **y a quién se iba a
 * escribir**. El nonce viaja en la URL junto al destino, y sin el destino
 * guardado bastaba cambiar `escribirA` en esa URL para que la tarjeta que el
 * botón armó para una farmacia saliera hacia otra.
 */
interface ContextoGuardado {
  readonly contexto: ContextoDeChat;
  readonly destino: DestinoDeChat;
  readonly guardadoEn: number;
}

/**
 * El `sessionStorage` de esta pestaña, o `null` fuera del navegador o si está
 * bloqueado. Se llama en contexto de inyección.
 *
 * Con `isPlatformBrowser` y no con `typeof sessionStorage`: desde Node 25
 * `sessionStorage` es un global también en el servidor, **uno por proceso**,
 * así que en el SSR lo compartirían todas las peticiones —el contexto que dejó
 * una persona lo encontraría la petición de otra—.
 */
export function almacenDeLaPestana(): Storage | null {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return null;
  }
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    // Acceder puede tirar con el almacenamiento bloqueado.
    return null;
  }
}

/** `true` si los dos destinos son el mismo. */
function mismoDestino(a: DestinoDeChat, b: unknown): boolean {
  if (typeof b !== 'object' || b === null) {
    return false;
  }
  const otro = b as Partial<Record<'escribirA' | 'pedido', unknown>>;
  return 'pedido' in a
    ? otro.pedido === a.pedido && otro.escribirA === undefined
    : otro.escribirA === a.escribirA && otro.pedido === undefined;
}

/**
 * Borra los contextos de la pestaña que ya vencieron o no se pueden leer.
 *
 * Un botón tocado sin llegar a abrir el chat (se cerró el login, se volvió
 * atrás) dejaba su entrada para siempre: se barren al guardar una nueva.
 */
function barrerVencidos(almacen: Storage, ahora: number): void {
  const vencidas: string[] = [];
  for (let i = 0; i < almacen.length; i++) {
    const clave = almacen.key(i);
    if (clave === null || !clave.startsWith(PREFIJO_DE_CONTEXTO)) {
      continue;
    }
    try {
      const leido = JSON.parse(almacen.getItem(clave) ?? 'null') as Partial<ContextoGuardado> | null;
      const guardadoEn = leido?.guardadoEn;
      if (typeof guardadoEn !== 'number' || ahora - guardadoEn > VIGENCIA_DE_CONTEXTO_MS) {
        vencidas.push(clave);
      }
    } catch {
      vencidas.push(clave);
    }
  }
  vencidas.forEach((clave) => almacen.removeItem(clave));
}

/** Un nonce aceptable: la forma de un `randomUUID`. Otra cosa ni se busca. */
const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

/**
 * Con quién se abre el chat.
 *
 * - `escribirA`: el slug de una vitrina pública (ficha de farmacia, producto,
 *   servicio). La bandeja lo resuelve y crea el hilo.
 * - `pedido`: el id de un pedido de farmacia. El hilo lo abre la API
 *   (`POST /pharmacy/orders/:id/conversation`), que es la que sabe quién es la
 *   farmacia y quién el paciente, y si quien pide puede abrirlo.
 */
export type DestinoDeChat = { readonly escribirA: string } | { readonly pedido: string };

/** Un id de pedido aceptable en la URL: sin barras ni nada que rearme la ruta. */
const ID_DE_PEDIDO = /^[\w-]{1,64}$/u;

/**
 * Los `queryParams` de `/messaging` para abrir el chat con `destino` y, si
 * hay, el nonce del contexto que se dejó en la pestaña.
 */
export function enlaceDeChat(destino: DestinoDeChat, nonce?: string | null): Params {
  const params: Record<string, string> =
    'pedido' in destino
      ? { [PARAMETRO.pedido]: destino.pedido }
      : { [PARAMETRO.escribirA]: destino.escribirA };
  if (nonce !== undefined && nonce !== null) {
    params[PARAMETRO.ctx] = nonce;
  }
  return params;
}

/** El destino que trae la URL, o `null`. `pedido` gana si vinieran los dos. */
export function destinoDeLaQuery(query: ParamMap): DestinoDeChat | null {
  const pedido = query.get(PARAMETRO.pedido);
  if (pedido !== null && ID_DE_PEDIDO.test(pedido)) {
    return { pedido };
  }
  const slug = query.get(PARAMETRO.escribirA);
  return slug !== null && slug !== '' ? { escribirA: slug } : null;
}

/** El nonce que trae la URL, si tiene la forma de uno. */
export function nonceDeLaQuery(query: ParamMap): string | null {
  const nonce = query.get(PARAMETRO.ctx);
  return nonce !== null && NONCE.test(nonce) ? nonce : null;
}

/**
 * Deja el contexto en la pestaña, atado al destino al que se va, y devuelve
 * su nonce, o `null` si no se pudo (sin almacenamiento —SSR, bloqueado—,
 * contexto inválido): entonces el chat se abre sin tarjeta, que es el modo
 * seguro. De paso barre los contextos vencidos.
 *
 * @param almacen - El de {@link almacenDeLaPestana}; `null` fuera del navegador.
 */
export function guardarContexto(
  destino: DestinoDeChat,
  contexto: ContextoDeChat,
  almacen: Storage | null,
  ahora: number = Date.now(),
): string | null {
  const valido = normalizarContexto(contexto);
  if (valido === null || almacen === null || typeof globalThis.crypto?.randomUUID !== 'function') {
    return null;
  }
  try {
    barrerVencidos(almacen, ahora);
    const nonce = globalThis.crypto.randomUUID();
    const guardado: ContextoGuardado = { contexto: valido, destino, guardadoEn: ahora };
    almacen.setItem(PREFIJO_DE_CONTEXTO + nonce, JSON.stringify(guardado));
    return nonce;
  } catch {
    return null;
  }
}

/**
 * El contexto guardado bajo ese nonce, **consumiéndolo**: después de leerlo se
 * borra, así que un refresco, el botón «atrás» o un segundo `queryParamMap`
 * no lo vuelven a encontrar. Se valida otra vez al salir —el almacenamiento es
 * de la pestaña, pero no es de confianza—.
 *
 * `null` si el nonce no existe, venció, lo guardado no es un contexto válido
 * o **se guardó para otro destino** que el que trae la URL.
 *
 * @param destino - El de la URL (`destinoDeLaQuery`): tiene que ser el mismo
 *   que guardó el botón.
 * @param almacen - El de {@link almacenDeLaPestana}; `null` fuera del navegador.
 */
export function tomarContexto(
  nonce: string | null,
  destino: DestinoDeChat,
  almacen: Storage | null,
  ahora: number = Date.now(),
): ContextoDeChat | null {
  if (nonce === null || !NONCE.test(nonce) || almacen === null) {
    return null;
  }
  try {
    const clave = PREFIJO_DE_CONTEXTO + nonce;
    const crudo = almacen.getItem(clave);
    if (crudo === null) {
      return null;
    }
    almacen.removeItem(clave);
    const leido = JSON.parse(crudo) as Partial<ContextoGuardado> | null;
    const contexto = leido?.contexto;
    if (
      typeof leido?.guardadoEn !== 'number' ||
      ahora - leido.guardadoEn > VIGENCIA_DE_CONTEXTO_MS ||
      !mismoDestino(destino, leido.destino) ||
      typeof contexto !== 'object' ||
      contexto === null ||
      typeof contexto.tipo !== 'string' ||
      typeof contexto.titulo !== 'string' ||
      typeof contexto.ruta !== 'string' ||
      (contexto.detalle !== undefined && typeof contexto.detalle !== 'string')
    ) {
      return null;
    }
    return normalizarContexto(contexto as ContextoDeChat);
  } catch {
    return null;
  }
}

/**
 * Lo que hace un botón «Chatear»: dejar el contexto en la pestaña e ir a la
 * bandeja con a quién y el nonce.
 *
 * Se llama en contexto de inyección (un campo del componente) y devuelve la
 * acción. Sin sesión pasa por el login con `returnUrl`: el `authGuard` de
 * `/messaging` manda al login **sin** recordar a dónde se iba, y quien tocó
 * «Chatear con la farmacia» terminaría en el inicio, con el pedido olvidado.
 * Con sesión, el guard deja pasar y la bandeja hace el resto. Ninguna de las
 * dos cosas autoriza nada: quién puede escribirle a quién lo decide la API al
 * crear la conversación.
 */
export function usarIrAlChat(): (destino: DestinoDeChat, contexto?: ContextoDeChat) => void {
  const router = inject(Router);
  const sesion = inject(SessionStore);
  const almacen = almacenDeLaPestana();
  return (destino, contexto) => {
    const nonce = contexto === undefined ? null : guardarContexto(destino, contexto, almacen);
    const queryParams = enlaceDeChat(destino, nonce);
    if (sesion.isAuthenticated()) {
      void router.navigate(['/messaging'], { queryParams });
      return;
    }
    const vuelta = router.serializeUrl(router.createUrlTree(['/messaging'], { queryParams }));
    void router.navigate([LOGIN_ROUTE], { queryParams: { returnUrl: vuelta } });
  };
}
