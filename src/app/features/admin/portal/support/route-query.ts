import { computed, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ActivatedRoute, ParamMap, Router } from '@angular/router';

/* ============================================================================
    La URL como única fuente de los filtros del portal.

    `app-filter-bar` escribe los filtros en los query params; las pantallas los
    leen de ahí. Así un enlace copiado, un «atrás» del navegador o una recarga
    reproducen exactamente la misma consulta, sin una copia local que se
    desincronice.
    ========================================================================== */

/** Los query params de la ruta como señal, con el valor de arranque ya puesto (SSR). */
export function queryParamsSignal(route: ActivatedRoute): Signal<ParamMap> {
  return toSignal(route.queryParamMap, { initialValue: route.snapshot.queryParamMap });
}

/** Los path params de la ruta como señal. */
export function pathParamsSignal(route: ActivatedRoute): Signal<ParamMap> {
  return toSignal(route.paramMap, { initialValue: route.snapshot.paramMap });
}

/** Lo que vale `key`, o `''` si no está. */
export function paramValue(params: Signal<ParamMap>, key: string): Signal<string> {
  return computed(() => params().get(key) ?? '');
}

/**
 * Los filtros de `keys` leídos de la URL. Sólo emite un objeto nuevo cuando
 * cambia alguno de ellos: abrir un cajón (`?hallazgo=`) o cambiar de pestaña
 * (`?vista=`) no vuelve a pedir el listado.
 */
export function queryFilters<K extends string>(
  params: Signal<ParamMap>,
  keys: readonly K[],
): Signal<Readonly<Record<K, string>>> {
  return computed(
    () => Object.fromEntries(keys.map((k) => [k, params().get(k) ?? ''])) as Record<K, string>,
    { equal: (a, b) => keys.every((k) => a[k] === b[k]) },
  );
}

/** Sólo los filtros con valor: la API valida con `forbidNonWhitelisted` y un vacío es ruido. */
export function nonEmpty<K extends string>(
  filters: Readonly<Record<K, string>>,
): Partial<Record<K, string>> {
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')) as Partial<
    Record<K, string>
  >;
}

/** ¿Hay algún filtro puesto? */
export function hasAny(filters: Readonly<Record<string, string>>): boolean {
  return Object.values(filters).some((v) => v !== '');
}

/**
 * Pone o quita parámetros sin tocar los demás. `null` o `''` los quita. Abrir y
 * cerrar un detalle queda en el historial: «atrás» lo cierra.
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
