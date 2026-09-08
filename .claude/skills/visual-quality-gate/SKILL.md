---
name: visual-quality-gate
description: Gate obligatorio de evidencia de navegador para cambios de frontend. Usar después de implementar y antes de declarar terminado cualquier trabajo de UI.
allowed-tools: Read, Grep, Glob, Bash
---

# Visual Quality Gate

`NO_EVIDENCE_NO_DONE`.

Una tarea de UI **no** pasa por inspección de código. `yarn build` en verde no
demuestra nada visual. Hace falta un navegador real.

## Viewports obligatorios

```text
390x844    móvil
768x1024   tablet vertical
1024x768   tablet horizontal
1440x900   escritorio
1920x1080  escritorio grande
```

Para páginas y layouts los cinco son obligatorios. Para un microcambio sin
impacto responsive puede bastar uno, **con justificación escrita**.

## Cómo se corre el navegador en este repo

Ya existe arnés Playwright — no montes uno nuevo:

```bash
yarn pw                 # toda la suite playwright/
yarn pw:baseline        # playwright/carril-01-baseline.spec.ts
yarn pw:rutas           # salud de rutas
yarn pw:accesos         # RBAC
yarn e2e:auditoria      # playwright/auditoria-prompts.spec.ts
```

Para exploración interactiva usar el MCP de Playwright (`.mcp.json`).

### Dos trampas conocidas de este proyecto

1. **Nunca esperes `networkidle` contra `ng serve`.** Con HMR el bundler mantiene
   conexiones abiertas: `networkidle` no llega nunca y produce verdes falsos.
   Espera un selector concreto o un estado del DOM.
2. **`testId` y `data-testid` no son lo mismo acá** y caen en elementos
   distintos. Verifica cuál usa el componente antes de escribir el selector.
3. Entrar por **URL directa** ejercita rutas que la navegación interna no
   ejercita: varias vistas sólo fallan así.

## Qué inspeccionar

Para cada superficie relevante:

- la ruta carga;
- sin overflow horizontal;
- sin controles recortados;
- sin solapamientos no intencionados;
- sin texto ilegible;
- sin iconos rotos;
- los nueve estados M34 que apliquen (S1–S9) se ven y son correctos;
- los diálogos quedan dentro del viewport;
- las tablas siguen siendo usables;
- los formularios siguen siendo usables;
- menús y popovers siguen alcanzables;
- el foco de teclado es visible;
- las interacciones esperadas funcionan.

## Evidencia a recolectar

```text
captura de pantalla · viewport · rol · ruta
errores de consola · page errors · requests fallidas · assertions
```

Una captura **no** reemplaza una assertion. Guardar bajo
`docs/frontend/evidence/<microtarea>/`.

## Prueba de mutación

Para cualquier acción que escriba datos:

```text
UI → request → response → persistencia → recarga → UI
```

Un toast de «Guardado» **no** demuestra persistencia. Hay que volver a
consultar después de recargar.

## Prueba de permisos

La autoridad es la API. Que un botón esté oculto no es seguridad. Cuando
aplique, demostrar los tres: UI autorizada · UI no autorizada · denegación
directa de la API.

## Puntuación

```text
Tipografía        /10      Accesibilidad     /10
Espaciado         /10      Interacción       /10
Jerarquía         /10      Estados           /10
Consistencia      /10      Densidad          /10
Responsive        /10      Acabado           /10
```

```text
PASS  >= 92
FAIL  <  92
```

Cualquier BLOCKER, CRITICAL o HIGH invalida el resultado numérico: aunque el
puntaje sea 99, es FAIL.

Si falta evidencia: `FAIL: INSUFFICIENT_EVIDENCE`.
