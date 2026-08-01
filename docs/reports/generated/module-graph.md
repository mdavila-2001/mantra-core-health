<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

228 archivos TypeScript bajo `src/` y 636 importaciones internas.
Los alias `@shared`, `@core/*` y `@features/*` se resuelven contra `tsconfig.json`.

## Dependencias circulares

**Ninguna.**

## Archivos que nadie importa

Se excluyen los puntos de entrada del framework y las pruebas.

- `src/app/core/observability/telemetry.bootstrap.ts`
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
| `src/app/core/view-state/view-state.ts` | 13 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 12 |
| `src/app/shared/components/atoms/input/input.ts` | 11 |
| `src/app/shared/components/atoms/link/link.ts` | 11 |
| `src/app/core/auth/session.store.ts` | 10 |
| `src/app/shared/components/molecules/alert/alert.ts` | 10 |
| `src/app/shared/a11y/announce-on-appear.ts` | 9 |
| `src/app/shared/components/molecules/toast/toast.types.ts` | 9 |
| `src/app/shared/components/organisms/side-nav/side-nav.types.ts` | 9 |
| `src/app/shared/components/organisms/tenant-switcher/tenant-switcher.types.ts` | 9 |
| `src/app/shared/components/molecules/menu/menu-item/menu-item.ts` | 8 |
| `src/app/shared/components/molecules/menu/menu.ts` | 8 |
| `src/app/core/auth/auth.service.ts` | 7 |
| `src/app/core/data-access/iam/iam.client.ts` | 7 |
| `src/app/core/http/error-to-view-state.ts` | 7 |
| `src/app/core/tokens/design-tokens.types.ts` | 7 |
| `src/app/core/tokens/theme.service.ts` | 7 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 198 |
| `@angular/common` | 59 |
| `@angular/router` | 39 |
| `@angular/forms` | 14 |
| `node:fs` | 13 |
| `rxjs` | 10 |
| `.` | 8 |
| `@angular/platform-browser` | 4 |
| `@angular/ssr` | 3 |
| `node:path` | 2 |
| `..` | 1 |
| `express` | 1 |
| `node:crypto` | 1 |
