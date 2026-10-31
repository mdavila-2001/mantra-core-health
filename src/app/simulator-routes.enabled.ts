import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { environment } from '../environments/environment';

/* ============================================================================
    Rutas que sólo existen con el backend simulado — versión CON simulador (O3-4).

    `angular.json` reemplaza `simulator-routes.ts` (la neutra, sin rutas) por
    este archivo en `development` y `demo`. Las configuraciones contra la API
    real no lo sustituyen, así que el stock de componentes no llega a su
    paquete.
    ========================================================================== */

export function simulatorRoutes(chunkFailed: () => Type<unknown>): Routes {
  return [
    {
      /* El stock de componentes: la lista de todo lo que existe, sacada del
         código, con cada pieza montada con datos de prueba.

         `canMatch` y no `canActivate`: con `canMatch` la ruta **no existe** allí
         donde no hay backend simulado —o sea, en cualquier rama que no sea
         `mockup`—, así que cae en el comodín y da 404 como cualquier dirección
         inventada. Con `canActivate` existiría y sólo estaría prohibida, que es
         otra cosa: anuncia que hay algo detrás.

         Va fuera del armazón, como la vitrina: no pide sesión, porque montar un
         componente suelto no la necesita y pedirla obligaría a entrar sólo para
         mirar un botón. */
      path: 'design-system/stock',
      canMatch: [() => environment.mockBackend],
      loadComponent: () =>
        import('./features/component-stock/component-stock')
          .then((m) => m.ComponentStock)
          .catch(() => chunkFailed()),
      title: 'AloVida - Stock de componentes',
    },
    {
      /* Comodín y no `:clave`: la clave de un componente es su ruta de archivo
         —`shared/components/atoms/badge/badge`— y lleva barras, que un parámetro
         de un solo segmento no captura. Con `**` la URL sigue siendo legible y
         se puede copiar y pegar. */
      path: 'design-system/stock/**',
      canMatch: [() => environment.mockBackend],
      loadComponent: () =>
        import('./features/component-stock/component-stock')
          .then((m) => m.ComponentStock)
          .catch(() => chunkFailed()),
      title: 'AloVida - Stock de componentes',
    },
  ];
}
