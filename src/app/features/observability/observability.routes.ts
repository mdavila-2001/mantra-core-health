import type { Type } from '@angular/core';

/**
 * Observabilidad del sistema (`/superadmin/observability`). La pantalla es una sola tarjeta con pestañas, así que
 * el único «destino» es el componente de la página; el estado (rango, zona, pestaña, filtros) va en los
 * parámetros de la dirección, no en rutas hijas.
 *
 * Vive en un archivo propio para no engordar `app.routes.ts`: allí sólo se cuelga `cargarSistema`.
 */
export const cargarSistema = (): Promise<Type<unknown>> =>
  import('./sistema/sistema').then((m) => m.ObservabilitySistema);
