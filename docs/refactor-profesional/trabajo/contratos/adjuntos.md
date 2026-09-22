# Contrato — Adjuntos: `attachment-dialog` y `attachment-uploader`

> Corte: `origin/mockup` @ `d40b5631`. Fuentes: `organisms/attachment-dialog/attachment-dialog.ts`
> (178 líneas), `organisms/attachment-uploader/attachment-uploader.ts` (390 líneas).

## Veredicto (§7.1-§7.2 del documento maestro): **COMPLEMENTARIAS**

El §9 del documento prohíbe expresamente fusionarlas «sólo por referirse a adjuntos». La evidencia de
abajo muestra que son dos capas distintas de la misma familia, no dos formas de la misma cosa: el
diálogo es una **cáscara modal con política de descarte** y el subidor es **la cola de subida y
vínculo**, y el repo ya los usa **por separado** en dos bloques del expediente. Fusionarlos rompería
esos dos consumidores sin ganar nada, porque tendrían que seguir usando la mitad del componente
fusionado (la subida) sin la otra mitad (el modal).

**Contraejemplo** (la prueba de que no son la misma pieza): `allergy-block.html:26` y
`medication-block.html:21` montan `<app-attachment-uploader>` **directo en la página**, sin ningún
modal alrededor — si `attachment-dialog` fuera "la" pieza de adjuntos, esos dos bloques no podrían
existir sin duplicar un modal a mano.

## §7.1 — Las cinco dimensiones, comparadas

| Dimensión | `attachment-dialog` (178 líneas) | `attachment-uploader` (390 líneas) |
|---|---|---|
| **Propósito** | Envolver un `attachment-uploader` en un `content-dialog` con encabezado propio y la política de descarte de §3 del contrato de `content-dialog`. No sube nada por sí mismo. | Elegir archivos, mostrarlos en cola, subirlos y vincularlos al dueño (`ownerType`/`ownerId`), con reintento por archivo. |
| **Anatomía** | `attachment-dialog.html:3-19`: `<app-content-dialog [dismissible]="sePuedeCerrarSolo()" (dismissAttempt)="alIntentarCerrar()">` envolviendo un `<app-attachment-uploader [showActions]="false" …>`; pie con dos botones (`Cancelar`/`Confirmar`) proyectados vía `dialog-actions`. **Sin slots propios** — proyecta hacia adentro de `content-dialog`, no recibe proyección de afuera. | `attachment-uploader.html` (138 líneas): un `<app-file-input>`, la lista de la cola (`cola` computed) con estado por archivo, y (si `showActions=true`) sus propios botones. **Sin slots** tampoco. |
| **Contrato** | Entradas: `ownerType`/`ownerId` (requeridos), `heading`, `description`, `contexto`, `linkVia`. Salidas: `attached`, `progressed`, `closed`. Internamente consulta `uploader()?.tieneCambiosPendientes()` para decidir `dismissible`. | Entradas: `ownerType`/`ownerId` (requeridos), `contexto`, `linkVia`, `showActions`. Salidas: `attached`, `progressed`. Expone `tieneCambiosPendientes` **público** — es el contrato que `attachment-dialog` consume. |
| **Comportamiento** | Cierre con confirmación si hay archivos elegidos sin subir (mismo patrón que documenta `content-dialog.md` §3). Al terminar de adjuntar, cierra el modal él solo (`alAdjuntar()` → `attached.emit()` + `dialog.close()`). | Hace el trabajo real: `FilesClient.upload()` (`POST /common/files/upload`) por archivo, después el vínculo (genérico o por `linkVia`), con reintento que **no vuelve a subir** un archivo ya subido si sólo falló el vínculo. |
| **Apariencia** | Ninguna propia — hereda el `size`/tokens de `content-dialog`. | Su propio `.css` (207 líneas): la cola, el estado por archivo (subiendo/vinculado/error), el resumen. |

## Quién hace el HTTP y qué es "el progreso"

- **El HTTP lo hace `attachment-uploader`**, nunca `attachment-dialog`: `attachment-uploader.ts` inyecta
  `FilesClient` y llama `.upload(...)` seguido del paso de vínculo. `attachment-dialog` tiene **0**
  llamadas HTTP — sólo orquesta el modal y reemite los eventos del subidor.
- **El progreso NO es un número (0-100%)**: no hay ninguna barra de progreso porcentual en el
  componente. Es un **evento por archivo vinculado con éxito** (`progressed.emit()` en
  `attachment-uploader.ts:371`), y el estado visible es por-archivo (`ResultadoDeArchivo`: eligiendo →
  subiendo → subido → vinculando → vinculado / error), no un agregado. Se declara así a propósito:
  inventar un progreso porcentual sería fabricar un dato que el backend real no da.
- **La validación real de tipo y tamaño es responsabilidad del servidor** (`POST /common/files/upload`
  documenta `limits: { fileSize, files: 1 }`). El cliente no decide qué es válido; refleja lo que el
  servidor acepta o rechaza.

## Consumidores (medidos)

- `<app-attachment-dialog>`: `clinical-record/patient-chart/diagnosis-block/diagnosis-block.html:22` ·
  `clinical-record/patient-chart/patient-chart.html:376` ·
  `clinical-record/patient-chart/procedures-block/procedures-block.html:291` — **3**.
- `<app-attachment-uploader>`: `clinical-record/patient-chart/allergy-block/allergy-block.html:26` ·
  `clinical-record/patient-chart/medication-block/medication-block.html:21` (uso directo, sin diálogo)
  + `shared/components/organisms/attachment-dialog/attachment-dialog.html:11` (uso interno) — **3**
  (2 de features + 1 interno).

## §10 — Contrato completo

### `attachment-uploader`

| Área | Contenido |
|---|---|
| Identidad | `organisms/attachment-uploader`, `AttachmentUploader`, `app-attachment-uploader`, organismo, compartido |
| Entradas | `ownerType: OwnerType` (requerido) · `ownerId: string` (requerido) · `contexto: readonly ContextoDelAdjunto[] = []` · `linkVia: ((fileId, ownerId) => Observable<unknown>) \| null = null` · `showActions: boolean = true` |
| Salidas | `attached: void` — cada vez que un archivo se vincula con éxito · `progressed: void` — igual, evento sin payload numérico |
| Composición | Sin slots ni proyección; `imports: [AppButton, Alert, FileInput, FormField]` |
| Estado | Dueño: el propio componente. `enviando` (signal), `cola` (computed sobre `resultados`) |
| Apariencia | CSS propio; no expone tokens de tamaño |
| Errores | Fallo de subida ≠ fallo de vínculo: si falla el vínculo, el archivo **ya está subido** y el reintento sólo repite el vínculo, nunca la subida |
| Compatibilidad | Sin versiones previas |
| Evidencia | `attachment-uploader.spec.ts` (12 casos: sube-y-vincula, `linkVia`, fallo parcial no se anuncia éxito, reintento no duplica subida, categoría del tipo real, sensibilidad PHI por defecto) |

### `attachment-dialog`

| Área | Contenido |
|---|---|
| Identidad | `organisms/attachment-dialog`, `AttachmentDialog`, `app-attachment-dialog`, organismo, compartido |
| Entradas | `ownerType`/`ownerId` (requeridos, reenviados al uploader) · `heading = 'Adjuntar archivos'` · `description = null` · `contexto`/`linkVia` (reenviados) |
| Salidas | `attached`, `progressed` (reenviados) · `closed` |
| Composición | `viewChild(AttachmentUploader)` (no `.required`) + `viewChild(ContentDialog)`; sin slots propios |
| Estado | `sePuedeCerrarSolo = computed(() => !(uploader()?.tieneCambiosPendientes() ?? false))` |
| Apariencia | Heredada de `content-dialog` |
| Errores | No agrega estados de error propios — delega en el uploader |
| Compatibilidad | Sin versiones previas |
| Evidencia | `attachment-dialog.spec.ts` (4 casos: monta el subidor adentro, título propio, cierre sin subir avisa una vez, adjuntar avisa y cierra) |

## Escenarios pedidos a Ender (banco de componentes, `features/component-stock/**`)

Dos escenarios nuevos (no existen hoy en `escenarios/`; sólo `content-dialog.escenarios.ts` cubre
adjuntos indirectamente):

1. **`attachment-uploader.escenarios.ts`**: variantes `vacio` / `con-cola-mixta` (uno subido, uno
   vinculando, uno con error de vínculo) / `sensibilidad-phi`. Props: `ownerType`, `ownerId` sintéticos;
   `linkVia` mockeado. Salida esperada: la cola muestra el estado correcto por archivo, `attached`
   se emite una vez por vínculo exitoso.
2. **`attachment-dialog.escenarios.ts`**: variantes `sin-seleccion` (cierra directo) / `con-seleccion`
   (pregunta al cerrar). Salida esperada: `dismissAttempt` sólo se emite en la segunda variante.

**Regla 65 (aislar y simular)**: como `component-stock/**` es de Ender, estos dos escenarios se
declaran acá con su contrato completo pero **no se implementan en este carril**; los tres niveles del
contrato de cada organismo (correcto, límite, inválido) ya están ejercitados por los specs propios
citados arriba, así que la verificación del comportamiento **no depende** del escenario del banco —
sólo la acreditación visual en la Vitrina queda pendiente de que Ender los monte.

## Qué falta / no cubierto

- Los dos escenarios de banco no se crearon (son de Ender, ver arriba).
- No se abrieron los 3+3 consumidores en el navegador; la tabla de consumidores es lectura estática.
