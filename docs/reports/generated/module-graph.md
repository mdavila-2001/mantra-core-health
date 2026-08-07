<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

301 archivos TypeScript bajo `src/` y 868 importaciones internas.
Los alias `@shared`, `@core/*` y `@features/*` se resuelven contra `tsconfig.json`.

## Dependencias circulares

**Ninguna.**

## Archivos que nadie importa

Se excluyen los puntos de entrada del framework y las pruebas.

- `src/app/core/observability/browser/telemetry-browser.bootstrap.ts`
- `src/app/shared/index.ts`
- `src/environments/environment.development.ts`

## Mayor centralidad (fan-in)

Cuántos archivos de producción importan a cada uno. Un número alto no es un
problema: es una advertencia de que cambiarlo se paga en muchos lugares.

| Archivo | Lo importan |
|---|---:|
| `src/app/shared/components/atoms/button/button.ts` | 30 |
| `src/app/shared/forms/form-control.context.ts` | 20 |
| `src/app/core/view-state/view-state.types.ts` | 18 |
| `src/app/core/view-state/view-state.ts` | 17 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 16 |
| `src/app/shared/components/atoms/input/input.ts` | 15 |
| `src/app/core/observability/tracing/tracing.constants.ts` | 14 |
| `src/app/core/auth/session.store.ts` | 13 |
| `src/app/core/observability/config/telemetry.types.ts` | 13 |
| `src/app/shared/components/molecules/alert/alert.ts` | 13 |
| `src/app/shared/a11y/announce-on-appear.ts` | 11 |
| `src/app/shared/components/atoms/link/link.ts` | 11 |
| `src/app/core/http/error-to-view-state.ts` | 10 |
| `src/app/shared/components/organisms/page-header/page-header.ts` | 10 |
| `src/app/shared/components/organisms/side-nav/side-nav.types.ts` | 10 |
| `src/app/core/auth/auth.service.ts` | 9 |
| `src/app/core/data-access/iam/iam.client.ts` | 9 |
| `src/app/core/observability/config/telemetry.token.ts` | 9 |
| `src/app/core/observability/tracing/tracing.service.ts` | 9 |
| `src/app/shared/components/atoms/button/button.types.ts` | 9 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 244 |
| `@angular/common` | 81 |
| `@angular/router` | 56 |
| `@angular/forms` | 18 |
| `rxjs` | 18 |
| `node:fs` | 13 |
| `@opentelemetry/api` | 12 |
| `@opentelemetry/sdk-trace-web` | 9 |
| `@opentelemetry/semantic-conventions` | 7 |
| `@angular/platform-browser` | 4 |
| `@angular/ssr` | 3 |
| `@opentelemetry/core` | 3 |
| `express` | 3 |
| `@opentelemetry/exporter-trace-otlp-http` | 2 |
| `@opentelemetry/resources` | 2 |
| `node:path` | 2 |
| `@opentelemetry/sdk-trace-node` | 1 |
| `axe-core` | 1 |
| `node:crypto` | 1 |
| `node:http` | 1 |
| `node:https` | 1 |
