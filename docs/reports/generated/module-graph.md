<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

331 archivos TypeScript bajo `src/` y 1067 importaciones internas.
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
| `src/app/shared/components/atoms/button/button.ts` | 32 |
| `src/app/core/view-state/view-state.types.ts` | 30 |
| `src/app/core/view-state/view-state.ts` | 27 |
| `src/app/core/http/error-to-view-state.ts` | 20 |
| `src/app/shared/components/organisms/page-header/page-header.ts` | 20 |
| `src/app/shared/forms/form-control.context.ts` | 20 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 19 |
| `src/app/core/auth/session.store.ts` | 18 |
| `src/app/core/navigation/navigation.service.ts` | 17 |
| `src/app/shared/components/atoms/input/input.ts` | 17 |
| `src/app/shared/components/atoms/link/link.ts` | 16 |
| `src/app/shared/components/molecules/alert/alert.ts` | 16 |
| `src/app/core/observability/tracing/tracing.constants.ts` | 14 |
| `src/app/core/observability/config/telemetry.types.ts` | 13 |
| `src/app/shared/components/atoms/badge/badge.ts` | 13 |
| `src/app/shared/components/molecules/card/card.ts` | 13 |
| `src/app/core/auth/auth.service.ts` | 12 |
| `src/app/shared/a11y/announce-on-appear.ts` | 12 |
| `src/app/core/data-access/api.ts` | 11 |
| `src/app/shared/components/organisms/data-table/data-table.types.ts` | 11 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 278 |
| `@angular/common` | 119 |
| `@angular/router` | 83 |
| `rxjs` | 33 |
| `@angular/forms` | 19 |
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
