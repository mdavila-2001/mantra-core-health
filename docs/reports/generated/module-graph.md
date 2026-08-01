<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Grafo de módulos

212 archivos TypeScript bajo `src/` y 590 importaciones internas.
Los alias `@shared`, `@core/*` y `@features/*` se resuelven contra `tsconfig.json`.

## Dependencias circulares

**Ninguna.**

## Archivos que nadie importa

Se excluyen los puntos de entrada del framework y las pruebas.

- `src/app/shared/index.ts`
- `src/environments/environment.development.ts`

## Mayor centralidad (fan-in)

Cuántos archivos de producción importan a cada uno. Un número alto no es un
problema: es una advertencia de que cambiarlo se paga en muchos lugares.

| Archivo | Lo importan |
|---|---:|
| `src/app/shared/components/atoms/button/button.ts` | 25 |
| `src/app/shared/forms/form-control.context.ts` | 19 |
| `src/app/core/view-state/view-state.types.ts` | 14 |
| `src/app/core/view-state/view-state.ts` | 12 |
| `src/app/shared/components/atoms/input/input.ts` | 11 |
| `src/app/shared/components/molecules/form-field/form-field.ts` | 11 |
| `src/app/shared/components/atoms/link/link.ts` | 9 |
| `src/app/shared/components/molecules/toast/toast.types.ts` | 9 |
| `src/app/shared/components/organisms/side-nav/side-nav.types.ts` | 9 |
| `src/app/shared/components/organisms/tenant-switcher/tenant-switcher.types.ts` | 9 |
| `src/app/core/auth/session.store.ts` | 8 |
| `src/app/shared/components/molecules/alert/alert.ts` | 8 |
| `src/app/shared/components/molecules/menu/menu-item/menu-item.ts` | 8 |
| `src/app/shared/components/molecules/menu/menu.ts` | 8 |
| `src/app/core/auth/auth.service.ts` | 7 |
| `src/app/core/data-access/iam/iam.client.ts` | 7 |
| `src/app/core/tokens/design-tokens.types.ts` | 7 |
| `src/app/core/tokens/theme.service.ts` | 7 |
| `src/app/shared/components/atoms/select/select.types.ts` | 7 |
| `src/app/shared/components/molecules/breadcrumb/breadcrumb.types.ts` | 7 |

## Paquetes externos

| Paquete | Importaciones |
|---|---:|
| `@angular/core` | 185 |
| `@angular/common` | 51 |
| `@angular/router` | 34 |
| `@angular/forms` | 14 |
| `node:fs` | 12 |
| `rxjs` | 10 |
| `@angular/platform-browser` | 4 |
| `@angular/ssr` | 3 |
| `express` | 1 |
| `node:path` | 1 |
