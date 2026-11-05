import type { HttpInterceptorFn } from '@angular/common/http';
import type { Type } from '@angular/core';

import type { EntradaAGenerar, EntradasGeneradas, MockUser } from './simulator.types';

/* ============================================================================
    El enchufe del simulador — versión NEUTRA, la que compila producción (O3-4).

    La aplicación no importa el backend simulado: importa este archivo. Acá no
    hay simulador ninguno —ni interceptor, ni cuentas de prueba, ni emisión de
    tokens, ni generador de datos—, así que una compilación contra la API real
    (`production`, `production-api`, `real-api`, `e2e-real`) no lleva ni una
    línea del simulador en el paquete.

    Las configuraciones que SÍ usan el simulador (`development` y `demo`, o sea
    `yarn start`, `yarn start:demo`, las pruebas unitarias y los e2e con
    maqueta) sustituyen este archivo por `core/mock/simulator.enabled.ts`
    (`fileReplacements` de `angular.json`), que exporta lo mismo con el
    simulador de verdad. Que las dos versiones exporten exactamente lo mismo lo
    fija `core/mock/simulator.enabled.spec.ts`.

    Antes era al revés: el archivo por omisión era el simulador completo y las
    configuraciones reales lo cambiaban por una versión apagada. El cartel de
    cuentas de prueba y el stock de componentes, que no pasaban por esa
    sustitución, viajaban en el paquete de producción como fragmentos que nadie
    pedía.

    Todo lo de acá es inofensivo por construcción: no hay ruta que llegue a
    usarlo con `environment.mockBackend: false`, y si alguien lo usara, no
    inventa una sesión ni datos.
    ========================================================================== */

/** Los interceptores del backend simulado. Sin simulador, ninguno. */
export const simulatorInterceptors: readonly HttpInterceptorFn[] = [];

/**
 * Carga el cartel «Modo demo» con las cuentas de prueba, o `null` si esta
 * compilación no trae el simulador.
 */
export const loadSimulatorBanner: (() => Promise<Type<unknown>>) | null = null;

/** Las cuentas de prueba. Sin simulador no hay ninguna. */
export const MOCK_USERS: readonly MockUser[] = [];

/** El access token que firmaría el simulador. Sin simulador no se emite nada. */
export function emitirAccessToken(user: MockUser): string {
  throw new Error(`Sin backend simulado no se emiten tokens de prueba (${user.key}).`);
}

/** El refresh token que firmaría el simulador. Sin simulador no se emite nada. */
export function emitirRefreshToken(user: MockUser): string {
  throw new Error(`Sin backend simulado no se emiten tokens de prueba (${user.key}).`);
}

/** Los valores de prueba de las entradas de un componente. Sin simulador, ninguno. */
export function generarEntradas(entradas: readonly EntradaAGenerar[], semilla: string): EntradasGeneradas {
  void semilla;
  return {
    valores: {},
    procedencias: Object.fromEntries(
      entradas.map((e) => [e.nombre, { procedencia: 'por-omision', motivo: 'Sin backend simulado.' }]),
    ),
    sinVerificar: [],
  };
}
