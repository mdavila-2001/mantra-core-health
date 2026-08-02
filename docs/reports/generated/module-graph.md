<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

277 archivos TypeScript bajo `src/` y 774 importaciones internas.
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
| `src/app/shared/components/atoms/button/button.ts` | 27 |
| `src/app/shared/forms/form-control.context.ts` | 19 |
| `src/app/core/view-state/view-state.types.ts` | 15 |
| `src/app/core/observability/tracing/tracing.constants.ts` | 14 |
| `src/app/core/view-state/view-state.ts` | 14 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 14 |
| `src/app/core/observability/config/telemetry.types.ts` | 13 |
| `src/app/core/auth/session.store.ts` | 12 |
| `src/app/shared/components/atoms/input/input.ts` | 12 |
| `src/app/shared/components/atoms/link/link.ts` | 11 |
| `src/app/shared/components/molecules/alert/alert.ts` | 11 |
| `src/app/core/observability/config/telemetry.token.ts` | 9 |
| `src/app/core/observability/tracing/tracing.service.ts` | 9 |
| `src/app/shared/a11y/announce-on-appear.ts` | 9 |
| `src/app/shared/components/molecules/menu/menu-item/menu-item.ts` | 9 |
| `src/app/shared/components/molecules/menu/menu.ts` | 9 |
| `src/app/shared/components/molecules/toast/toast.types.ts` | 9 |
| `src/app/shared/components/organisms/side-nav/side-nav.types.ts` | 9 |
| `src/app/shared/components/organisms/tenant-switcher/tenant-switcher.types.ts` | 9 |
| `src/app/core/auth/auth.service.ts` | 8 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 222 |
| `@angular/common` | 72 |
| `@angular/router` | 49 |
| `@angular/forms` | 16 |
| `rxjs` | 16 |
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
