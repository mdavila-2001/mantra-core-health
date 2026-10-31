import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

/* ============================================================================
    Rutas que sólo existen con el backend simulado — versión NEUTRA (O3-4).

    Es la que compila producción: no declara ninguna ruta, así que el
    `import()` del stock de componentes —que a su vez carga cada pieza de la
    aplicación, el cartel «Modo demo» incluido— no llega al paquete.

    `development` y `demo` la sustituyen por `simulator-routes.enabled.ts`
    (`fileReplacements` de `angular.json`), que declara las rutas de verdad.
    El `canMatch` de esas rutas sigue siendo la segunda barrera.
    ========================================================================== */

export function simulatorRoutes(chunkFailed: () => Type<unknown>): Routes {
  void chunkFailed;
  return [];
}
