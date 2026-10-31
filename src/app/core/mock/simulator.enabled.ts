import type { HttpInterceptorFn } from '@angular/common/http';
import type { Type } from '@angular/core';

import { mockBackendInterceptor } from './mock-backend.interceptor';

/* ============================================================================
    El enchufe del simulador — versión CON simulador (O3-4).

    `angular.json` reemplaza `core/simulator/simulator.ts` (la versión neutra)
    por este archivo en las configuraciones que usan el backend simulado:
    `development` (con ella corren `yarn start` y las pruebas unitarias) y
    `demo` (`yarn start:demo`, la rama `mockup` y los e2e con maqueta). Las
    configuraciones contra la API real no lo sustituyen, así que nada de lo que
    se importa acá llega a su paquete.

    Debe exportar exactamente lo mismo que la versión neutra, con tipos
    compatibles: lo fija `simulator.enabled.spec.ts`.
    ========================================================================== */

export const simulatorInterceptors: readonly HttpInterceptorFn[] = [mockBackendInterceptor];

/** El cartel «Modo demo» va en su propio fragmento: se pide sólo con el simulador encendido. */
export const loadSimulatorBanner: (() => Promise<Type<unknown>>) | null = () =>
  import('./mock-banner').then((m) => m.MockBanner);

export { MOCK_USERS, emitirAccessToken, emitirRefreshToken } from './mock-session';
export { generarEntradas } from './faker';

/* ---- contrato con la versión neutra (lo comprueba `tsc`, no viaja en el paquete) --------------- */

type Neutro = typeof import('../simulator/simulator');
type Habilitado = typeof import('./simulator.enabled');
type Asignable<A extends B, B> = A;

/**
 * Si esta versión deja de exportar lo mismo que la neutra —una clave de más, una de menos o un tipo
 * incompatible—, `yarn typecheck` falla acá: la aplicación compila contra la neutra y en `development`
 * o `demo` recibiría otra cosa.
 */
export type ContratoDelEnchufe = [
  Asignable<Habilitado, Neutro>,
  Asignable<keyof Habilitado, keyof Neutro>,
  Asignable<keyof Neutro, keyof Habilitado>,
];
