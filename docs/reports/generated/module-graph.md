<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

421 archivos TypeScript bajo `src/` y 1711 importaciones internas.
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
| `src/app/shared/components/atoms/button/button.ts` | 68 |
| `src/app/core/view-state/view-state.types.ts` | 64 |
| `src/app/core/view-state/view-state.ts` | 60 |
| `src/app/shared/components/organisms/page-header/page-header.ts` | 56 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 54 |
| `src/app/core/http/error-to-view-state.ts` | 53 |
| `src/app/core/navigation/navigation.service.ts` | 53 |
| `src/app/shared/components/atoms/input/input.ts` | 52 |
| `src/app/shared/components/molecules/alert/alert.ts` | 52 |
| `src/app/shared/a11y/announce-on-appear.ts` | 45 |
| `src/app/shared/components/organisms/form-actions/form-actions.ts` | 37 |
| `src/app/shared/components/organisms/form-section/form-section.ts` | 37 |
| `src/app/shared/forms/form-support.ts` | 35 |
| `src/app/shared/components/molecules/radio-group/radio-group.ts` | 22 |
| `src/app/shared/components/molecules/radio/radio.ts` | 21 |
| `src/app/core/auth/session.store.ts` | 20 |
| `src/app/shared/components/atoms/textarea/textarea.ts` | 20 |
| `src/app/shared/components/molecules/card/card.ts` | 20 |
| `src/app/shared/forms/form-control.context.ts` | 20 |
| `src/app/shared/components/atoms/link/link.ts` | 19 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 364 |
| `@angular/common` | 201 |
| `@angular/router` | 122 |
| `@angular/forms` | 56 |
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
