---
name: frontend-production-gate
description: Reglas estrictas de production-readiness para cambios en el frontend Angular/TypeScript de este repositorio.
allowed-tools: Read, Grep, Glob, Bash
---

# Frontend Production Gate

## Comandos reales de este repo

No inventes scripts. Los que existen:

```bash
yarn lint          # eslint .
yarn typecheck     # tsc app + cypress + playwright, --noEmit
yarn build         # ng build (pasa por env:generate)
yarn test          # ng test  (Vitest 4, 860 pruebas en 77 archivos)
```

`yarn test` completo es caro. Acótalo con rutas explícitas mientras iteras y
corre la suite entera antes del commit atómico.

Gestor de paquetes: **Yarn 4.18 en modo PnP**. No lo cambies, no generes
`package-lock.json`, no llames a `npm install`. Usar `npx` para un MCP externo
no es migrar el gestor.

## Prohibido sin justificación explícita

```text
any nuevo                     tests debilitados
@ts-ignore / @ts-nocheck      datos de producción hardcodeados
reglas de lint desactivadas   persistencia falsa
TODO/FIXME de esta tarea      componentes duplicados
reglas de negocio duplicadas  colores mágicos
espaciados mágicos            catch silenciosos
logs de depuración            errores ocultos
```

`strict` y `strictTemplates` están activos. Un `any` nuevo es una regresión de
tipos, no un atajo.

**`tsc` no revisa las plantillas.** Una plantilla rota compila limpio y se
manifiesta en ejecución como un 404 de ruta. Typecheck en verde no acredita que
la vista pinte.

## Tamaño de componente

Un componente por encima de 300 LOC requiere justificación. Preferir:
componentes de presentación · servicios con señales · capa de servicio ·
helpers de dominio · lógica de estado aislada.

No dividir sólo para bajar el conteo de líneas: `PageParte1` / `PageParte2` no
es una separación de responsabilidades. Dividir por responsabilidad real.

## Estados obligatorios

Las superficies asíncronas deben cubrir los estados M34 que apliquen (S1–S9,
ver `project-design-system`). Usar `app-view-state-host`; no reimplementarlos.

## Checks requeridos antes del commit

```text
yarn lint          →  exit 0
yarn typecheck     →  exit 0
yarn test <ruta>   →  exit 0   (pruebas afectadas)
yarn build         →  exit 0
navegador          →  visual-quality-gate PASS
regresión          →  consumidores del componente compartido
```

Orden barato-primero: la comprobación que invalida más rápido va antes.
