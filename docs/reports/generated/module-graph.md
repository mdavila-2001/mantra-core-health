<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

453 archivos TypeScript bajo `src/` y 1955 importaciones internas.
Los alias `@shared`, `@core/*` y `@features/*` se resuelven contra `tsconfig.json`.

## Dependencias circulares

**Ninguna.**

## Archivos que nadie importa

Se excluyen los puntos de entrada del framework y las pruebas.

- `src/app/core/observability/browser/telemetry-browser.bootstrap.ts`
- `src/app/features/account/appointments/appointments.ts`
- `src/app/shared/index.ts`
- `src/environments/environment.development.ts`

## Mayor centralidad (fan-in)

Cuántos archivos de producción importan a cada uno. Un número alto no es un
problema: es una advertencia de que cambiarlo se paga en muchos lugares.

| Archivo | Lo importan |
|---|---:|
| `src/app/shared/components/atoms/button/button.ts` | 79 |
| `src/app/core/view-state/view-state.types.ts` | 77 |
| `src/app/core/view-state/view-state.ts` | 72 |
| `src/app/core/http/error-to-view-state.ts` | 66 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 66 |
| `src/app/shared/components/organisms/page-header/page-header.ts` | 66 |
| `src/app/shared/components/molecules/alert/alert.ts` | 63 |
| `src/app/core/navigation/navigation.service.ts` | 61 |
| `src/app/shared/components/atoms/input/input.ts` | 60 |
| `src/app/shared/a11y/announce-on-appear.ts` | 55 |
| `src/app/shared/components/organisms/form-actions/form-actions.ts` | 46 |
| `src/app/shared/components/organisms/form-section/form-section.ts` | 44 |
| `src/app/shared/forms/form-support.ts` | 39 |
| `src/app/shared/components/atoms/link/link.ts` | 23 |
| `src/app/shared/components/atoms/textarea/textarea.ts` | 23 |
| `src/app/shared/components/molecules/radio-group/radio-group.ts` | 23 |
| `src/app/core/auth/session.store.ts` | 22 |
| `src/app/shared/components/molecules/radio/radio.ts` | 22 |
| `src/app/shared/components/molecules/card/card.ts` | 20 |
| `src/app/shared/forms/form-control.context.ts` | 20 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 391 |
| `@angular/common` | 230 |
| `@angular/router` | 144 |
| `@angular/forms` | 65 |
| `rxjs` | 40 |
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
