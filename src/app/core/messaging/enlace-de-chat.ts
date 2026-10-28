/* ============================================================================
    El enlace que lleva a alguien al chat con el contexto puesto.

    ## Para qué

    Los botones «Chatear con la farmacia» y «Consultar por chat» del
    marketplace no abren el hilo ellos mismos: llevan a `/messaging` con a
    quién escribirle (`escribirA=<slug>`) y, además, **de qué** (`sobre`,
    `titulo`, `detalle`, `ruta`). La bandeja ya sabe resolver el slug, crear el
    hilo si no existía y pasar por el login si no hay sesión; esto sólo le
    agrega la tarjeta de contexto que se manda al abrir.

    ## Por qué en la URL

    Porque el guard de sesión de `/messaging` guarda la dirección y vuelve a
    ella después del login: lo que no viaja en la URL se pierde en el camino.
    Nada de lo que va acá es clínico —ver `contexto-de-chat.ts`—: es lo que ya
    muestra la ficha pública o el pedido.

    ## La URL es de cualquiera

    Quien abre `/messaging?sobre=…` puede haberla escrito a mano. Por eso
    {@link contextoDeLaQuery} es estricta: tipo conocido, título no vacío y ruta
    interna, o no hay tarjeta. Lo que sí no puede impedir es que alguien se
    mande a sí mismo un contexto falso — y no hace falta: es su propio mensaje,
    con su nombre, igual que si lo escribiera.
   ========================================================================== */

import { inject } from '@angular/core';
import { Router, type ParamMap, type Params } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { LOGIN_ROUTE } from '../http/auth.interceptor';
import { esRutaDeContexto, type ContextoDeChat, type TipoDeContexto } from './contexto-de-chat';

/** Los nombres de los parámetros, en un solo lugar. */
export const PARAMETRO = {
  escribirA: 'escribirA',
  pedido: 'pedido',
  sobre: 'sobre',
  titulo: 'titulo',
  detalle: 'detalle',
  ruta: 'ruta',
} as const;

const TIPOS: ReadonlySet<string> = new Set<TipoDeContexto>([
  'pedido',
  'producto',
  'servicio',
  'farmacia',
]);

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
 * Los `queryParams` de `/messaging` para abrir el chat con `destino` sobre
 * `contexto`.
 *
 * Sin contexto es el `?escribirA=` de siempre.
 */
export function enlaceDeChat(destino: DestinoDeChat, contexto?: ContextoDeChat): Params {
  const params: Record<string, string> =
    'pedido' in destino
      ? { [PARAMETRO.pedido]: destino.pedido }
      : { [PARAMETRO.escribirA]: destino.escribirA };
  if (contexto === undefined) {
    return params;
  }
  params[PARAMETRO.sobre] = contexto.tipo;
  params[PARAMETRO.titulo] = contexto.titulo;
  if (contexto.detalle !== undefined && contexto.detalle.trim() !== '') {
    params[PARAMETRO.detalle] = contexto.detalle;
  }
  params[PARAMETRO.ruta] = contexto.ruta;
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

/**
 * El contexto que trae la URL, o `null` si no trae uno válido.
 *
 * Un contexto a medias —sin título, con un tipo inventado, con una ruta a
 * otro sitio— no se arregla: se descarta entero y el hilo se abre igual, sin
 * tarjeta.
 */
export function contextoDeLaQuery(query: ParamMap): ContextoDeChat | null {
  const tipo = query.get(PARAMETRO.sobre);
  const titulo = query.get(PARAMETRO.titulo)?.trim() ?? '';
  const ruta = query.get(PARAMETRO.ruta) ?? '';
  const detalle = query.get(PARAMETRO.detalle)?.trim() ?? '';
  if (tipo === null || !TIPOS.has(tipo) || titulo === '' || !esRutaDeContexto(tipo as TipoDeContexto, ruta)) {
    return null;
  }
  const base = { tipo: tipo as TipoDeContexto, titulo, ruta };
  return detalle === '' ? base : { ...base, detalle };
}

/**
 * Lo que hace un botón «Chatear»: ir a la bandeja con a quién y de qué.
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
  return (destino, contexto) => {
    const queryParams = enlaceDeChat(destino, contexto);
    if (sesion.isAuthenticated()) {
      void router.navigate(['/messaging'], { queryParams });
      return;
    }
    const vuelta = router.serializeUrl(router.createUrlTree(['/messaging'], { queryParams }));
    void router.navigate([LOGIN_ROUTE], { queryParams: { returnUrl: vuelta } });
  };
}
