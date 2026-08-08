<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

396 archivos TypeScript bajo `src/` y 1535 importaciones internas.
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
| `src/app/shared/components/atoms/button/button.ts` | 58 |
| `src/app/core/view-state/view-state.types.ts` | 54 |
| `src/app/core/view-state/view-state.ts` | 50 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 45 |
| `src/app/shared/components/organisms/page-header/page-header.ts` | 45 |
| `src/app/core/http/error-to-view-state.ts` | 43 |
| `src/app/shared/components/atoms/input/input.ts` | 43 |
| `src/app/core/navigation/navigation.service.ts` | 42 |
| `src/app/shared/components/molecules/alert/alert.ts` | 41 |
| `src/app/shared/a11y/announce-on-appear.ts` | 35 |
| `src/app/shared/components/organisms/form-actions/form-actions.ts` | 28 |
| `src/app/shared/components/organisms/form-section/form-section.ts` | 28 |
| `src/app/shared/forms/form-support.ts` | 25 |
| `src/app/core/auth/session.store.ts` | 20 |
| `src/app/shared/components/molecules/radio-group/radio-group.ts` | 20 |
| `src/app/shared/forms/form-control.context.ts` | 20 |
| `src/app/shared/components/atoms/textarea/textarea.ts` | 19 |
| `src/app/shared/components/molecules/radio/radio.ts` | 19 |
| `src/app/shared/components/atoms/link/link.ts` | 18 |
| `src/app/shared/components/molecules/card/card.ts` | 18 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 340 |
| `@angular/common` | 176 |
| `@angular/router` | 110 |
| `@angular/forms` | 46 |
| `rxjs` | 35 |
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
