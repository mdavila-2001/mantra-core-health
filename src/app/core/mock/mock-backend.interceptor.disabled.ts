import type { HttpInterceptorFn } from '@angular/common/http';

/* ============================================================================
    El «backend simulado» de los builds REALES: un interceptor que no hace nada.

    `angular.json` sustituye `mock-backend.interceptor.ts` por este archivo (`fileReplacements`) en las
    configuraciones `production`, `production-api`, `real-api` y `e2e-real`. La sustitución saca del paquete de producción:

      · el import dinámico `import('./handlers')` y, con él, el chunk de ~4,6 MB con todos los manejadores y fixtures;
      · las cuentas y códigos de prueba (`123456`, `12345678`, el secreto TOTP de ejemplo, `hospital_piloto`…);
      · la lógica de decisión de seguridad simulada, que no debe ser alcanzable en un despliegue real.

    Antes solo lo apagaba un flag en tiempo de ejecución (`environment.mockBackend`), y como es una propiedad de un objeto y no una
    constante, esbuild no podía eliminar la rama: el simulador viajaba inactivo en cada build. Los builds `demo` y
    `development,demo` (los que usan los e2e con el simulador) NO sustituyen nada y siguen con el interceptor completo.

    Debe exportar lo mismo que usa `app.config.ts`: `mockBackendInterceptor`. Lo fija `mock-backend.interceptor.disabled.spec.ts`.
   ========================================================================== */

/** Deja pasar toda petición a la red: en un build real no hay respuesta simulada que dar. */
export const mockBackendInterceptor: HttpInterceptorFn = (request, next) => next(request);
