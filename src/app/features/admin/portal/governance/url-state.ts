import { computed, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ActivatedRoute, ParamMap, Router } from '@angular/router';

/* ============================================================================
    La URL como única fuente de los filtros, la pestaña y el detalle abierto de
    las pantallas de gobierno. Un enlace copiado, un «atrás» o una recarga
    reproducen la misma consulta, sin una copia local que se desincronice.
    ========================================================================== */

/** Los query params de la ruta como señal, con el valor de arranque ya puesto (SSR). */
export function queryParamsSignal(route: ActivatedRoute): Signal<ParamMap> {
  return toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });
}

/**
 * Los valores de `keys` leídos de la URL. Sólo emite un objeto nuevo cuando
 * cambia alguno de ellos: abrir un detalle o cambiar de pestaña no vuelve a
 * pedir el listado.
 */
export function urlValues<K extends string>(
  params: Signal<ParamMap>,
  keys: readonly K[],
): Signal<Readonly<Record<K, string>>> {
  return computed(
    () => Object.fromEntries(keys.map((k) => [k, params().get(k) ?? ''])) as Record<K, string>,
    { equal: (a, b) => keys.every((k) => a[k] === b[k]) },
  );
}

/**
 * Pone o quita parámetros sin tocar los demás. `null` o `''` los quita. Cada
 * cambio queda en el historial: «atrás» lo deshace.
 */
export function patchQuery(
  router: Router,
  route: ActivatedRoute,
  changes: Readonly<Record<string, string | null>>,
): Promise<boolean> {
  const queryParams = Object.fromEntries(
    Object.entries(changes).map(([k, v]) => [k, v === '' ? null : v]),
  );
  return router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge' });
}
