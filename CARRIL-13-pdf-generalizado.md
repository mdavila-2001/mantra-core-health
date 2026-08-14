# Carril 13 · Exportación a PDF de prácticamente todos los formularios

**Punto del reclamo:** 12b (mensaje del 2026-08-14: "todos deben poderse generar PDF de
prácticamente todos los formularios de prácticamente todo"). **Repos:** frontend únicamente —
no hace falta backend nuevo, ver más abajo. **Rama sugerida:** `carril-13/pdf-generalizado`.
**Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar cualquier archivo
compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar.

## Este carril depende de otro — leé esto antes de arrancar

El **Carril 1** (`CARRIL-1-catalogo-presupuestos-pdf.md`) construye
`src/app/shared/utils/pdf-export/pdf-export.ts`, la utilidad genérica sobre `jspdf`. Este
carril **la reusa**, no la duplica. Dos formas de no quedar bloqueado esperando:

1. **Si el Carril 1 ya mergeó** cuando arrancás: importá `pdf-export.ts` tal cual.
2. **Si todavía no mergeó:** no reescribas tu propia utilidad — coordiná en
   `COORDINACION-AGENTES.md` la forma exacta de la función (`exportElementToPdf(el, filename)` o
   la firma que el Carril 1 haya fijado) para que tu código ya llame a esa firma, y agregás la
   dependencia real (`import { exportElementToPdf } from '...'`) recién cuando el archivo exista
   en tu rama tras el rebase. Mientras tanto podés desarrollar y probar contra un stub local que
   después borrás.

**No toques `package.json`** — la dependencia `jspdf` la agrega el Carril 1, y es el único que
la toca.

## Por qué el alcance es "todos", y cómo no morir en el intento

"Prácticamente todos los formularios" es collections, no una pantalla — si tratás de tocar los
formularios de los otros nueve carriles en tu propia rama, vas a chocar con los nueve. La forma
de cerrar esto sin pisar a nadie:

- Construís un **componente reusable** (`pdf-export-button`) que cualquier pantalla puede
  colocar con una línea.
- Lo aplicás vos mismo, en este carril, a **las pantallas que hoy ya existen y que ningún otro
  carril está tocando en este plan**: `medication-block` (receta) y `diagnosis-block`
  (diagnóstico), dentro de `patient-chart/`.
- Para el resto (presupuestos del carril 1, formularios por especialidad del carril 2,
  procedimientos del carril 3, laboratorios del carril 4, adjuntos del carril 12...) dejás el
  componente listo y **documentado** para que cada carril lo adopte en su propia pantalla cuando
  le toque — es una línea de import y un botón, no una integración pesada. Anotalo como tarea de
  seguimiento en tu bloque de `COORDINACION-AGENTES.md` al cerrar, para que quede escrito qué
  falta adoptar y dónde.

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/shared/components/organisms/pdf-export-button/pdf-export-button.ts  + .html + .css + .spec.ts
```

Un botón que recibe una referencia al contenido a exportar (o un `TemplateRef`) y el nombre de
archivo sugerido, llama a `pdf-export.ts` del Carril 1, y muestra estado de carga/error con el
mismo patrón de `ViewState` que ya usa el resto del sistema de diseño (`view-state.ts`,
`view-state-host`).

**Archivos existentes que tocás — son tuyos, ningún otro carril los toca:**

| Archivo | Qué agregás |
|---|---|
| `src/app/features/clinical-record/patient-chart/medication-block/medication-block.ts` (+ `.html`) | botón "Exportar receta a PDF" |
| `src/app/features/clinical-record/patient-chart/diagnosis-block/diagnosis-block.ts` (+ `.html`) | botón "Exportar diagnóstico a PDF" |

Estos dos archivos hoy **nadie más los toca** en este plan de diez carriles — todos los demás
declaran explícitamente que no los editan, así que son tu superficie segura de integración real
sin coordinación adicional.

**Lo que NO tocás:** `patient-chart.ts` (no necesitás un bloque propio — te montás sobre los
bloques que ya existen), ni ninguna de las pantallas nuevas de los otros nueve carriles — esas
adoptan el botón en su propio momento, no en el tuyo.

## Definición de hecho

- Existe un botón de exportación a PDF reusable, documentado, con un ejemplo de uso claro.
- Al menos receta y diagnóstico se exportan a PDF de verdad desde la ficha del paciente.
- Quedó anotado en `COORDINACION-AGENTES.md` qué pantallas faltan adoptar el botón, para que no
  se pierda.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build`.
