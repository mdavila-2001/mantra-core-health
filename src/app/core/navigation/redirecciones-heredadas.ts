import { inject } from '@angular/core';
import { Router, type RedirectFunction, type Routes } from '@angular/router';

/* ============================================================================
    Las direcciones viejas que llevan un `:parámetro`.

    Viven acá y no en `app.routes.ts` porque ese archivo está congelado por
    `scripts/check-max-lines.mjs` (un ratchet: no puede crecer). La tabla de
    texto de `app.routes.ts` (`RUTAS_HEREDADAS`) no sirve para estas: un
    `redirectTo` de texto no conserva el query ni, por tanto, la pestaña.
    ========================================================================== */

/**
 * Direcciones viejas **con parámetro** → su dirección nueva, conservando el
 * parámetro, el query y el fragmento.
 *
 * Van aparte de `RUTAS_HEREDADAS` (`app.routes.ts`) porque un `redirectTo` de texto no
 * conserva el query: medido en esta versión del router, `/ajustes?x=1` termina
 * en `/settings` a secas. Para una ficha del catálogo con `?pestana=2` eso es
 * perder la pestaña en silencio, así que estas dos redirigen con una función
 * (ver {@link redireccionConParametros}).
 */
export const RUTAS_HEREDADAS_CON_PARAMETRO: Readonly<Record<string, string>> = {
  // El portal de plataforma pasó a «Superadministración» (17/10/2026).
  'administration/data-catalog/:objectId': '/superadmin/data-catalog/:objectId',
  'administration/qa-lab/plans/:planId': '/superadmin/qa-lab/plans/:planId',
};

/**
 * Redirección que **sustituye los `:parámetros`** de la plantilla destino con
 * los de la dirección vieja y conserva el query y el fragmento.
 *
 * Un parámetro que la dirección vieja no trae se omite: no hay forma de que
 * `redirectTo` se dispare sin él, porque la ruta declara el mismo `:nombre`.
 */
export function redireccionConParametros(plantilla: string): RedirectFunction {
  return ({ params, queryParams, fragment }) => {
    const [primero = '', ...resto] = plantilla.split('/').filter((segmento) => segmento !== '');
    const sustituir = (segmento: string): string =>
      segmento.startsWith(':') ? (params[segmento.slice(1)] ?? '') : segmento;

    return inject(Router).createUrlTree([`/${sustituir(primero)}`, ...resto.map(sustituir)], {
      queryParams,
      ...(fragment === null || fragment === undefined ? {} : { fragment }),
    });
  };
}

/** Las direcciones viejas con parámetro: misma forma que `rutasHeredadas` (`app.routes.ts`), redirección por función. */
export function rutasHeredadasConParametro(mapa: Readonly<Record<string, string>>): Routes {
  return Object.entries(mapa).map(([vieja, nueva]) => ({
    path: vieja,
    pathMatch: 'full' as const,
    redirectTo: redireccionConParametros(nueva),
  }));
}

