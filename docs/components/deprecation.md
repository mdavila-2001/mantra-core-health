# Deprecación de componentes

## Estado actual

**Ningún componente está marcado como obsoleto.** Los 61 componentes del
inventario están activos; ninguno lleva `@deprecated` ni una nota de reemplazo.

Tampoco hay componentes «legados» o «experimentales»: el proyecto es reciente y
pasó por una reclasificación atómica documentada en
[`docs/auditoria/02-fases-ejecutadas.md`](../auditoria/02-fases-ejecutadas.md)
§«Fase 4 — Reclasificación atómica», que ya movió lo que estaba mal ubicado.

Esta página existe para cuando haga falta, no para describir algo que no pasa.

---

## Procedimiento

### 1 · Marcar, no borrar

```ts
/**
 * @deprecated desde 2026-09. Usá `app-nuevo-componente`.
 *
 * Motivo: <una frase>.
 * Migración: <qué cambia en el sitio de uso>.
 * Se elimina: cuando `check-doc-coverage` reporte 0 usos.
 */
```

Borrar de una es lo que rompe ramas ajenas que todavía no se fusionaron.

### 2 · Medir cuántos usos quedan

```bash
node scripts/generate-inventory.mjs        # regenera el inventario
grep -rn "app-viejo-componente" src/       # usos en plantillas
```

El fan-in del [grafo de módulos](../reports/generated/module-graph.md) da el
número de importadores. Si es 25 (como el botón), la deprecación es un proyecto;
si es 1, es un cambio.

### 3 · Migrar los usos

Uno por commit cuando sean pocos; por lote cuando sean muchos. Después de cada
lote, la batería completa:

```bash
yarn lint && yarn tsc -p tsconfig.app.json --noEmit && yarn build && yarn test:coverage
```

### 4 · Quitar de la vitrina

`features/design-system-sample/` no debe exhibir un componente obsoleto: la
vitrina es lo que la gente copia.

### 5 · Eliminar

Recién cuando no queden usos:

- El componente y sus archivos hermanos (`.html`, `.css`, `.types.ts`, `.spec.ts`).
- Su entrada en el barril del nivel (`atoms/index.ts`, etc.).
- Su mención en `docs/components/catalog.md`.

Y regenerar:

```bash
node scripts/generate-inventory.mjs
node scripts/check-doc-links.mjs      # cazar enlaces que apuntaban a él
```

---

## Qué cuenta como cambio que rompe

En orden de gravedad:

| Cambio | Rompe | Procedimiento |
|---|---|---|
| Quitar una entrada o una salida | Compilación (`strictTemplates`) | Deprecación completa |
| Quitar un valor de una unión de variantes | Compilación | Deprecación completa |
| Renombrar el selector | Compilación | Deprecación completa |
| Cambiar el tipo de una entrada | Compilación | Deprecación completa |
| Cambiar el valor por defecto de una entrada | **Nada. Silenciosamente.** | El más peligroso: ver abajo |
| Cambiar el comportamiento del teclado o del foco | Nada, hasta que alguien lo prueba | Requiere prueba de accesibilidad |
| Cambiar estilos | Nada | Requiere revisión visual |

### El más peligroso es el que no rompe la compilación

Cambiar `input<ButtonSize>('md')` por `input<ButtonSize>('lg')` compila en los 25
sitios que usan el botón y **cambia el aspecto de todos**. Sin regresión visual
automatizada —que este proyecto no tiene— nadie se entera hasta que alguien mira.

Por eso [el control de cambios](../governance/change-management.md) exige que un
cambio de valor por defecto en un componente compartido se declare
explícitamente en la descripción del pull request.

---

## Los cuatro componentes que exigen más cuidado

| Componente | Importadores | Si cambia… |
|---|---:|---|
| `AppButton` | 25 | Un tercio de la interfaz |
| `FORM_CONTROL_CONTEXT` | 19 | El nombre accesible de **todos** los campos |
| `Input` | 11 | Todos los formularios |
| `FormField` | 11 | Ídem |

Y dos que no son componentes pero mandan igual:

| Contrato | Importadores | Si cambia… |
|---|---:|---|
| `view-state.types.ts` | 14 | El vocabulario de estados de toda la aplicación |
| `view-state.ts` | 12 | Sus constructores |

---

## Qué NO se deprecia

`core/dev/toast-dev-panel/` **no es código obsoleto**: es una herramienta de
desarrollo desmontada a propósito (`app.html` explica por qué). Sigue disponible
para quien la quiera montar y no entra al paquete inicial.

`src/app/shared/index.ts` aparece sin importadores en el grafo, pero **tampoco es
obsoleto**: es un contrato declarativo infrautilizado. Su destino se discute en
[reglas de composición](composition-rules.md#el-barril-y-las-rutas-profundas), y
la opción de eliminarlo es una de tres, no la evidente.
