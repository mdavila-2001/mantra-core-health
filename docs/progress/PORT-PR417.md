# Port de la rama `justin/fase6-adjuntos-multiples` sobre `mockup`

**Rama:** `justin/fase6-conflictos-resueltos` · **Fecha:** 2026-09-10
**Para:** revisión de Pablo. **La rama del PR #417 no se tocó.**

## Qué es esto

`origin/justin/fase6-adjuntos-multiples` (PR #417) y `origin/mockup` divergieron desde
`392fcdf` y las dos tocaron los mismos archivos del expediente. Esta rama es el merge
resuelto, verificado con la suite, para que el PR se pueda retargetear o rehacer sin
que la resolución de conflictos se haga a ciegas dentro de la caja de GitHub.

Base: `origin/justin/fase6-adjuntos-multiples` + merge de `origin/mockup`.

## Cómo se resolvió cada choque

Los nueve archivos en conflicto se llevaron al lado de `mockup` y **encima se volvió a
aplicar lo que la rama de fase 6 aportaba y `mockup` no tiene**. La resolución mecánica
—quedarse con un lado— habría borrado trabajo en las dos direcciones.

| Archivo | Resolución | Por qué |
|---|---|---|
| `attachment-uploader.*` | **`mockup`, sin re-aplicar nada** | Las dos ramas hicieron lo mismo —lote de varios archivos, en serie, categoría deducida del tipo, sensibilidad fija en `PHI`— y la de `mockup` además guarda el `fileId` por archivo, así que reintentar **vuelve a vincular en vez de volver a subir**. Es un superconjunto: no se perdió capacidad. |
| `patient-chart.ts` · `.html` · `.css` | `mockup` **+ port** | Ver abajo. |
| `patient-chart.spec.ts` | `mockup` **+ port** | Las pruebas de adjuntos se reescribieron contra la API resultante y se sumaron las dos de fase 6 (ruta por bloque, tipo de dueño). |
| `diagnosis-block.ts` | `mockup` **+ port completo** | La plantilla que quedó es la de fase 6 y exige la duración estimada y el curso crónico, además del selector de cita. |
| `clinical.types.ts` | fusión | Se quitó el `indicationConditionId` duplicado; quedó el comentario más completo, el de `mockup`. |

## Lo que se volvió a aplicar sobre `patient-chart`

1. **«Nuevo diagnóstico» y «Nueva alergia» desde el expediente**, en modal, con los
   mismos bloques de «Atención» y `exigeEncuentro=false`. `mockup` no tenía nada
   equivalente: era la aportación central del PR y se habría perdido entera.
2. **`citasParaElDiagnostico()` y `etiquetaDeCita()`** — el desplegable «¿en qué cita se
   detectó?», con todas las citas del paciente, de la más reciente a la más vieja.
3. **Adjuntar, generalizado a cuatro bloques** (diagnósticos, medicación, alergias,
   encuentros), con la ruta de `clinical` y el `OwnerType` que corresponden a cada uno.
   `mockup` sólo adjuntaba a diagnósticos.
4. **Las columnas «Diagnóstico» y «Receta de» de la medicación.**

## Tres cosas que el merge decidió y conviene mirar

1. **`MedicationRequest.encounterId` ya está declarado.** `mockup` decía en el detalle de
   la receta «el resumen clínico todavía no lo devuelve»; el tipo que trae fase 6 lo
   declara, así que el vínculo se resuelve de verdad en vez de repetir esa frase.
2. **Los diagnósticos adjuntan desde su menú de acciones, no desde una columna.** La
   columna «Archivos» va sólo en los otros tres bloques: dos botones que abren el mismo
   modal en la misma fila sobran.
3. **`limpiar()` del `diagnosis-block` ahora vacía también los chips de duración y la
   cita.** La rama de origen no lo hacía y el formulario siguiente arrancaba marcando
   «Crónico» con el curso ya en blanco: dos afirmaciones sobre lo mismo que se
   contradicen.

## Verificación

Todo corrido en el árbol de esta rama, el 2026-09-10.

| Paso | Resultado |
|---|---|
| `corepack yarn typecheck` | exit 0 |
| `corepack yarn lint` | exit 0 |
| `corepack yarn build` | exit 0 · bundle inicial 1,30 MB (aviso, no error) |
| `corepack yarn test --watch=false` | **448/448 archivos · 5 329/5 329 pruebas** · exit 0 |

Los `scripts/check-*.mjs` dan **exactamente la misma salida que `origin/mockup`**, salvo
uno:

- `check-api-contract-drift` pasa de **163 a 165** operaciones que el código llama y la
  documentación no declara. Las dos nuevas son
  `POST /clinical/medication-requests/:requestId/attachments` y
  `POST /clinical/allergy-intolerances/:allergyId/attachments`, que son de esta rama. El
  chequeo ya estaba en rojo en `mockup` por las otras 163.

`fichas-estandar.spec.ts` (prueba nueva de esta rama) lee
`../mantra-core-health-api/src/common/seed/data/clinical-forms` desde `process.cwd()`:
en un worktree fuera de `Mantra Core Health/` no encuentra el repo hermano y falla con
`ENOENT`. En un clon normal pasa. Comprobado en las dos situaciones.

## Lo que NO se hizo

No se corrió Playwright: el port no cambia ninguna ruta ni ningún flujo de navegación, y
la evidencia fotográfica de las pantallas del expediente ya está en la tanda del
10/09/2026. Si el PR se retargetea, corresponde sacarla de los dos modales nuevos.
