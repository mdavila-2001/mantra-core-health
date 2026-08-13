<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

524 archivos TypeScript bajo `src/` y 2489 importaciones internas.
Los alias `@shared`, `@core/*` y `@features/*` se resuelven contra `tsconfig.json`.

## Dependencias circulares

**Ninguna.**

## Archivos que nadie importa

Se excluyen los puntos de entrada del framework y las pruebas.

- `src/app/core/observability/browser/telemetry-browser.bootstrap.ts`
- `src/app/features/admin/organizations/organization-detail/organization-detail.ts`
- `src/app/shared/index.ts`
- `src/environments/environment.development.ts`

## Mayor centralidad (fan-in)

Cuántos archivos de producción importan a cada uno. Un número alto no es un
problema: es una advertencia de que cambiarlo se paga en muchos lugares.

| Archivo | Lo importan |
|---|---:|
| `src/app/core/view-state/view-state.types.ts` | 113 |
| `src/app/shared/components/atoms/button/button.ts` | 99 |
| `src/app/core/view-state/view-state.ts` | 98 |
| `src/app/core/http/error-to-view-state.ts` | 92 |
| `src/app/shared/components/organisms/page-header/page-header.ts` | 92 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 90 |
| `src/app/shared/components/molecules/alert/alert.ts` | 88 |
| `src/app/core/navigation/navigation.service.ts` | 87 |
| `src/app/shared/components/atoms/input/input.ts` | 83 |
| `src/app/shared/a11y/announce-on-appear.ts` | 75 |
| `src/app/shared/components/organisms/form-actions/form-actions.ts` | 70 |
| `src/app/shared/components/organisms/form-section/form-section.ts` | 66 |
| `src/app/shared/forms/form-support.ts` | 61 |
| `src/app/shared/components/atoms/textarea/textarea.ts` | 31 |
| `src/app/shared/components/molecules/radio-group/radio-group.ts` | 31 |
| `src/app/shared/components/molecules/radio/radio.ts` | 30 |
| `src/app/shared/components/atoms/link/link.ts` | 28 |
| `src/app/shared/components/molecules/card/card.ts` | 28 |
| `src/app/core/auth/session.store.ts` | 27 |
| `src/app/shared/forms/form-control.context.ts` | 20 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 463 |
| `@angular/common` | 300 |
| `@angular/router` | 176 |
| `@angular/forms` | 87 |
| `rxjs` | 47 |
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
