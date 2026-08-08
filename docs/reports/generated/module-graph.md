<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

415 archivos TypeScript bajo `src/` y 1658 importaciones internas.
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
| `src/app/shared/components/atoms/button/button.ts` | 65 |
| `src/app/core/view-state/view-state.types.ts` | 61 |
| `src/app/core/view-state/view-state.ts` | 57 |
| `src/app/shared/components/organisms/page-header/page-header.ts` | 53 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 51 |
| `src/app/core/http/error-to-view-state.ts` | 50 |
| `src/app/core/navigation/navigation.service.ts` | 50 |
| `src/app/shared/components/atoms/input/input.ts` | 49 |
| `src/app/shared/components/molecules/alert/alert.ts` | 49 |
| `src/app/shared/a11y/announce-on-appear.ts` | 42 |
| `src/app/shared/components/organisms/form-actions/form-actions.ts` | 34 |
| `src/app/shared/components/organisms/form-section/form-section.ts` | 34 |
| `src/app/shared/forms/form-support.ts` | 32 |
| `src/app/core/auth/session.store.ts` | 20 |
| `src/app/shared/components/atoms/textarea/textarea.ts` | 20 |
| `src/app/shared/components/molecules/card/card.ts` | 20 |
| `src/app/shared/components/molecules/radio-group/radio-group.ts` | 20 |
| `src/app/shared/forms/form-control.context.ts` | 20 |
| `src/app/shared/components/atoms/link/link.ts` | 19 |
| `src/app/shared/components/molecules/radio/radio.ts` | 19 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 358 |
| `@angular/common` | 195 |
| `@angular/router` | 119 |
| `@angular/forms` | 53 |
| `rxjs` | 36 |
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
