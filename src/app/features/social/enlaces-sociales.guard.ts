import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { catchError, map, type Observable, of, switchMap } from 'rxjs';

import { CommunityClient } from '../../core/data-access/community/community.client';
import type { PublicProfileKind } from '../../core/data-access/community/community.types';
import { PUBLIC_PROFILE_PREFIX } from '../../core/data-access/public-directory/public-directory.types';

/**
 * El prefijo de la ficha pública de cada vertical: el mismo mapa que arma las
 * rutas (`PUBLIC_PROFILE_PREFIX`). `PATIENT` no está en él: la ficha de un
 * paciente no se publica, y por eso nada puede llevar a ella.
 */
const PREFIJO_DE_FICHA: Readonly<Partial<Record<PublicProfileKind, string>>> = PUBLIC_PROFILE_PREFIX;

/**
 * A dónde lleva una publicación identificada por su id.
 *
 * La vista de una publicación suelta cuelga sólo de `/p/:slug/post/:id` —quien
 * publica es un profesional—, y para armarla hace falta el `slug` del autor,
 * que no viaja con el id: hay que leer la publicación y su perfil. Por eso esto
 * es un guard y no un `redirectTo`, que no puede esperar a la red.
 *
 * Si la publicación no se puede resolver —ya no existe, el autor no tiene ficha
 * pública, la red falló— devuelve `null` y quien llama decide a dónde caer: un
 * destino que abre es mejor que un error dentro de una redirección.
 */
function rutaDeLaPublicacion(
  community: CommunityClient,
  router: Router,
  postId: string,
): Observable<ReturnType<Router['createUrlTree']> | null> {
  return community.readPost(postId).pipe(
    switchMap((publicacion) => community.readProfile(publicacion.authorPublicProfileId)),
    map((autor) =>
      autor.kind === undefined || autor.kind === 'PRACTITIONER'
        ? router.createUrlTree(['/p', autor.slug, 'post', postId])
        : null,
    ),
    catchError(() => of(null)),
  );
}

/**
 * La ficha pública de quien hizo algo (te siguió, te comentó), o `null`.
 */
function rutaDeLaFicha(
  community: CommunityClient,
  router: Router,
  perfilId: string,
): Observable<ReturnType<Router['createUrlTree']> | null> {
  return community.readProfile(perfilId).pipe(
    map((perfil) => {
      const prefijo = PREFIJO_DE_FICHA[perfil.kind ?? 'PRACTITIONER'];
      return prefijo === undefined ? null : router.createUrlTree([`/${prefijo}`, perfil.slug]);
    }),
    catchError(() => of(null)),
  );
}

/**
 * La dirección vieja del muro: `/feed` y `/feed?post=<id>`.
 *
 * El «Muro profesional» se eliminó: la red social es una sola pantalla,
 * `/posts`, con el estilo de LinkedIn. Pero la dirección vieja sigue en
 * enlaces guardados, en avisos ya enviados y en el historial, así que no puede
 * dar 404: lleva al lugar equivalente.
 *
 * - `/feed` → `/posts`.
 * - `/feed?post=<id>` → la publicación suelta, que es lo que el parámetro
 *   quería decir; si no se resuelve, `/posts`.
 *
 * Siempre devuelve un `UrlTree`, nunca `true`: la ruta no tiene pantalla.
 */
export const feedHeredadoGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const community = inject(CommunityClient);

  const inicio = router.createUrlTree(['/posts']);
  const postId = route.queryParamMap.get('post');

  if (postId === null || postId === '') {
    return inicio;
  }

  return rutaDeLaPublicacion(community, router, postId).pipe(map((destino) => destino ?? inicio));
};

/**
 * `/posts/:postId` — una publicación por su id, que es lo único que traen los
 * avisos de la red social.
 *
 * El aviso viaja con `sourceRefId` y con quién actuó (`actorProfileId`), pero
 * **no** dice si ese id es de una publicación, de un comentario o de un
 * seguimiento: el tipo es un concept id y el contrato no lo traduce. Así que se
 * intenta lo más específico y se degrada, en este orden:
 *
 * 1. el id es una publicación → su vista suelta;
 * 2. no lo es y se sabe quién actuó (`?actor=`) → la ficha de esa persona, que
 *    es adonde uno iría al tocar «X empezó a seguirte»;
 * 3. nada de lo anterior → el inicio de la red.
 *
 * Que un aviso de comentario termine en la ficha de quien comentó y no en el
 * comentario es una limitación del contrato (falta el id de la publicación en
 * el aviso), registrada como brecha de la API; no se inventa el destino.
 */
export const publicacionPorIdGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const community = inject(CommunityClient);

  const inicio = router.createUrlTree(['/posts']);
  const postId = route.paramMap.get('postId');
  const actor = route.queryParamMap.get('actor');

  if (postId === null || postId === '') {
    return inicio;
  }

  return rutaDeLaPublicacion(community, router, postId).pipe(
    switchMap((destino) => {
      if (destino !== null) return of(destino);
      if (actor === null || actor === '') return of(inicio);
      return rutaDeLaFicha(community, router, actor).pipe(map((ficha) => ficha ?? inicio));
    }),
  );
};
