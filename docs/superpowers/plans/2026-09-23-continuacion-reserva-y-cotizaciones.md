# Continuación de reserva y cotizaciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar el flujo de Cotizaciones del paciente y eliminar bloqueos técnicos de verificación sin inventar datos clínicos ni monetarios.

**Architecture:** Se conserva el dominio puro ya fusionado y se le agrega una superficie standalone de cuenta que adapta fuentes existentes, con una procedencia explícita por precio. La ruta y menú se incorporan con el patrón de navegación existente para roles PATIENT. La generación del catálogo se ejecuta antes de cualquier gate TypeScript que consume el archivo generado.

**Tech Stack:** Angular 21 standalone, signals, RxJS, Vitest, Playwright, Yarn PnP.

**Spec:** `docs/superpowers/specs/2026-09-23-reserva-y-cotizaciones-design.md`

## Global Constraints

- No crear ni presentar precios reales; las cifras de mock siempre indican «Maqueta» y UMA no se convierte.
- Los documentos se leen con sus clientes existentes; no se crea una orden clínica nueva.
- TDD: cada cambio de producción parte de una prueba observada en rojo.
- Se ejecuta `yarn stock:generate` antes de typecheck/tests hasta que el script de verificación lo haga de forma reproducible.

## Review Focus

- Un usuario PATIENT puede ver Cotizaciones, pero no recibe rutas de proveedores.
- Una fuente sin precio no adquiere un valor por defecto ni se ordena antes de un precio conocido.
- Una falla de la fuente se representa como error accionable y no como lista vacía.
- Cambiar el documento no mezcla ítems clínicos con texto libre anterior.
- Las pruebas no dependen de un índice de componentes generado en un estado viejo.

### Task 1: Sincronizar la base y estabilizar la generación

**Files:**
- Modify: `package.json`
- Test: `scripts/lib/relaciones-de-uso.test.mjs`

- [ ] Escribir una aserción que falle si los comandos `test` y `typecheck` no generan el índice.
- [ ] Ejecutarla y observar el fallo.
- [ ] Anteponer `node scripts/generate-component-index.mjs &&` a ambos comandos.
- [ ] Ejecutar la aserción y `corepack yarn typecheck` después de generar.
- [ ] Commit: `chore: generate component index before verification`.

### Task 2: Pantalla de Cotizaciones

**Files:**
- Create: `src/app/features/account/cotizaciones/cotizaciones.ts`
- Create: `src/app/features/account/cotizaciones/cotizaciones.html`
- Create: `src/app/features/account/cotizaciones/cotizaciones.css`
- Create: `src/app/features/account/cotizaciones/cotizaciones.spec.ts`
- Modify: `src/app/features/account/cotizaciones/cotizaciones.logic.ts`
- Test: `src/app/features/account/cotizaciones/cotizaciones.spec.ts`

- [ ] Escribir specs en rojo para estados, filtro, orden y procedencia visible.
- [ ] Implementar el componente standalone con datos de maqueta explícitos y estados M34.
- [ ] Ejecutar su spec en verde y el spec de lógica.
- [ ] Commit: `feat: add patient quotation screen`.

### Task 3: Ruta, navegación y documentos

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/core/navigation/navigation.map.ts`
- Modify: `src/app/core/navigation/navigation.service.spec.ts`
- Modify: `src/app/core/navigation/navigation.subgroups.ts`
- Modify: `src/app/features/account/cotizaciones/cotizaciones.ts`
- Test: cotizaciones spec y navegación existente

- [ ] Escribir las pruebas que fallen para ruta de paciente y acceso PATIENT.
- [ ] Registrar ruta lazy en cuenta y la entrada de menú correspondiente.
- [ ] Adaptar recetas/órdenes diagnósticas sólo si los clientes existentes devuelven ítems utilizables; de lo contrario declarar la brecha sin fabricar datos.
- [ ] Ejecutar specs focalizados y recorrido Playwright de paciente.
- [ ] Commit: `feat: expose patient quotations in account navigation`.

### Task 4: Medición, gates y entrega

**Files:**
- Modify: `docs/trabajo/2026-09-23-continuacion-reserva-cotizaciones/PLAN.md`
- Create: `docs/trabajo/2026-09-23-continuacion-reserva-cotizaciones/REPORTE.md`
- Create: `docs/trabajo/2026-09-23-continuacion-reserva-cotizaciones/evidencia/`

- [ ] Medir el flujo autenticado de reserva, incluyendo cuatro clics, y guardar salida/capturas sin PHI.
- [ ] Ejecutar lint, typecheck, tests y Playwright; investigar cualquier rojo propio.
- [ ] Escribir reporte con cada bloqueo que permanezca y su siguiente paso.
- [ ] Commit: `docs: report reservation and quotation continuation`.
