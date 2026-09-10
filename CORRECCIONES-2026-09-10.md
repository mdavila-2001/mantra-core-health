# Correcciones del 10/09/2026 — modales, archivos, vínculos clínicos, comunidades y directorios

Rama base: `mockup` en `3ce6f5d2`. Estado: implementado y verificado en el
entorno local con el backend simulado. Lo que **no** quedó cerrado está en la
sección «Lo que no se pudo completar», con su motivo y lo que hace falta.

---

## 1. Qué se hizo, frente por frente

| ID | Requisito | Estado | Dónde |
|---|---|---|---|
| MOD | Modales en los elementos afectados | Hecho en lo que existía | `content-dialog`, `attachment-dialog`, expediente |
| ARC | Carga múltiple y multiformato, sin Categoría ni Sensibilidad | Hecho | `attachment-uploader`, `upload-policy` |
| REL | Relaciones clínicas reales | **Parcial** — ver §4 | `clinical.types`, expediente |
| COM | Grupos y foros como comunidades | **Parcial** — falta Anuncios | `features/communities` |
| DIR | Quitar el acceso redundante | Hecho | `core/navigation/access-tree` |

---

## 2. Modales (MOD)

**El modal compartido es `app-content-dialog`**, que ya existía sobre el
`<dialog>` nativo —fondo, inertización, trampa de foco y `Escape` los da el
navegador—. Se le agregó lo que la corrección pedía y no tenía:

- **Pie de acciones proyectado** (`dialog-actions`), fuera del cuerpo con
  scroll: en un formulario largo el botón que guarda ya no se busca al final.
- **Cuatro anchos de referencia** (`size`): `sm` confirmación, `md` formulario
  clínico, `lg` cola de adjuntos, `xl` listados con navegación interna. En
  teléfono las cuatro colapsan al mismo modal casi completo.
- **`dismissible`**: con cambios pendientes, los **tres** gestos de cierre —el
  botón, `Escape` y el fondo— pasan por `dismissAttempt` y preguntan, en vez de
  perder lo escrito. Los tres van por el mismo camino a propósito: si el botón
  cerrara de una, la confirmación se esquivaría con el ratón.

**Lo que se sacó de la fila.** En el expediente, «Adjuntar archivo» alternaba un
formulario **dentro de la celda** del diagnóstico y la tabla se abría en dos.
Ahora abre `app-attachment-dialog`. Y se agregó el detalle de cada registro
—que antes no se podía consultar— en modal, con un botón «Ver» por fila.

**Un defecto que encontró el navegador y no las pruebas unitarias:** el
`<dialog>` se declara dentro de la plantilla del panel, así que su `keydown`
burbujeaba hasta el host y `Escape` cerraba el modal **y además** la zona de
accesos de atrás. Corregido en `dashboard/access-tree`: con un modal abierto,
`Escape` es del modal.

---

## 3. Archivos (ARC)

### Lo que desapareció del formulario

«Categoría» y «Sensibilidad», con sus radios y sus validaciones. No se
reemplazaron por otro selector con otro nombre:

- **La categoría se deduce del tipo real del archivo** (`categoryForFile`).
  No era una etiqueta de biblioteca: gobierna qué formatos acepta el
  almacenamiento (`UPLOAD_MIME_ALLOWLIST` del backend), así que preguntárselo a
  quien sube era pedirle que adivinara una regla del servidor. Lo desconocido
  cae en `DOCUMENT`, que es el superconjunto y nunca provoca un rechazo por
  categoría.
- **La sensibilidad la fija la política clínica en `PHI`**
  (`CLINICAL_UPLOAD_SENSITIVITY`). **No se rebajó ninguna protección**: `PHI` ya
  era el valor por omisión del formulario; lo que desapareció es la posibilidad
  de elegir `NORMAL` por descuido.

### Lo que ahora funciona

- Selección **múltiple**, de formatos distintos, acumulativa: volver a abrir el
  selector añade sin borrar lo pendiente, y cancelarlo no pierde la selección.
- Retirada individual, sin tocar el resto. La deduplicación es por
  nombre + tamaño + fecha, no por nombre: dos archivos distintos pueden
  llamarse igual.
- **Estado por archivo** en palabras —Pendiente, Subiendo, Adjuntado, Error—,
  no sólo en color, con el motivo del fallo debajo de su fila.
- Resumen de cantidad y peso; el botón dice «Adjuntar N archivos».
- **Envío del lote completo**, un archivo por petición: `POST
  /common/files/upload` declara `limits: { files: 1 }`, así que un lote son
  varias peticiones en serie y no un arreglo en el cuerpo.
- **Fallo parcial**: la lista conserva el resultado de cada uno, el aviso dice
  que hay que revisar los marcados, y el reintento toca **sólo** los que
  fallaron. Si el que falló ya se había subido, el reintento retoma en el
  vínculo y **no vuelve a subir**: el `fileId` queda guardado en la cola. Sin
  eso, reintentar dejaba dos copias del mismo estudio.
- El modal cierra **sólo** cuando el lote entero entró.

### Los límites que se muestran son los reales

Verificados en el repositorio de la API, no supuestos:

| Qué | Valor | Dónde se comprobó |
|---|---|---|
| Tamaño | 10 MB **por archivo** | `FILE_STORAGE_MAX_SIZE_BYTES`, `storage.env.ts` |
| Archivos por petición | 1 | `limits: { files: 1 }`, `common-files.controller.ts` |
| Cantidad por lote | sin máximo configurado | no existe tal límite; la pantalla no inventa uno |
| Formatos | PDF, JPEG, PNG, WEBP, GIF | `UPLOAD_MIME_ALLOWLIST`, `upload-content-type.ts` |

**Restricción real encontrada, y no disimulada:** el almacenamiento reconoce el
tipo **por firma binaria** y sólo esos cinco formatos. Texto, hojas de cálculo y
contenedores se rechazan con 422 en el servidor. La pantalla los rechaza antes,
con el motivo en palabras («este formato no se puede guardar; se aceptan PDF,
JPG, PNG, WEBP o GIF») en vez de un «formato no válido» sin explicación. Ampliar
esa lista es una decisión de seguridad del backend, no del frontend: está en
«Lo que no se pudo completar».

---

## 4. Vínculos clínicos (REL) — parcial, y por qué

Se inspeccionó **Medicación**, como pedía la especificación. El patrón real es:

- El **encuentro** es obligatorio de hecho: el bloque no ofrece el formulario
  sin un encuentro en curso, y lo hereda del contexto (no se elige a mano).
- El **diagnóstico** es `indicationConditionId`, **uno solo y opcional** en el
  contrato, con motivo clínico documentado: una receta sintomática o
  profiláctica no tiene diagnóstico detrás. Se conservó esa cardinalidad, como
  la especificación indica.

### El hallazgo que sí se pudo cerrar

`indicationConditionId` **se escribía y no se leía**: el alta lo manda desde
v4.1.6 y `GET /clinical/patients/:id/summary` lo devuelve —está en
`MedicationRequestSummaryDto` y en `clinical-read.service.ts`—, pero el tipo del
frontend no lo declaraba. El vínculo quedaba guardado en la base y desaparecía
de la pantalla al recargar: exactamente el síntoma de «relación sólo visual».
Se declaró el campo y ahora la receta muestra su diagnóstico, y sigue
mostrándolo después de recargar.

### Lo que cada bloque puede y no puede guardar

Comprobado contra los DTO del backend, no supuesto:

| Sección | Encuentro | Diagnóstico | Alta |
|---|---|---|---|
| Diagnósticos | sí, y se lee | no aplica | sí |
| Medicación | se escribe, **no se lee** | sí, y ahora se lee | sí |
| Observaciones | sí, y se lee | **no existe el campo** | sí |
| Notas | sí, y se lee | **no existe el campo** | sí |
| Alergias | **no existe el campo** | **no existe el campo** | sí |
| Planes de cuidado | no existe | no existe | **no hay alta** |
| Archivo clínico | heredado del registro padre | el padre **es** el diagnóstico | sí |

Donde el contrato guarda el vínculo, la pantalla lo muestra. Donde no lo
guarda, **lo dice en voz alta** en el detalle del registro («el registro de
alergias no guarda encuentro ni diagnóstico») en vez de mostrar una asociación
fabricada. Un registro antiguo sin encuentro dice «Sin encuentro registrado»:
no se le asigna el más reciente ni el primero de la lista.

Los adjuntos heredan sus vínculos del registro padre por el mecanismo
persistente que ya existe —`POST /clinical/conditions/:id/attachments`— y el
modal los muestra como contexto de lectura, con la aclaración de que se aplican
a todo el lote.

---

## 5. Comunidades (COM) — parcial

**La comunidad es un tema** (`community.topics`), que es la agrupación que el
dominio ya guarda: `groups.topic_id` existe, el alta de grupo lo manda y
`GET /community/groups` filtra por él. No se inventó una entidad nueva ni una
comunidad fija que envuelva todos los grupos. Los temas tienen `parentTopicId`,
así que una comunidad puede reunir varios; con el árbol plano de hoy, cada
comunidad es un tema con sus grupos.

Los grupos se piden **por tema** (`listGroups({ topicId })`) y no se reparten en
el navegador: `GroupListItem` no trae `topicId` —sólo `GroupDetail`—, así que
un reparto en memoria habría sido inventado.

La conversación de un grupo es **el mismo componente** de la pantalla del grupo
(`app-group-detail`, ahora embebible): su muro, sus hilos, sus altas pendientes
y su moderación, con sus permisos. No se reescribió el muro: dos
implementaciones del mismo muro divergen a la segunda corrección, y ahí es donde
se pierden hilos.

**Lo que falta: Anuncios.** El dominio tiene dos tipos de grupo —`GENERAL` y
`SUPPORT`— y ninguno es un canal de anuncios: no hay concepto, ni columna, ni
endpoint. La sección se dibuja, separada de las conversaciones, y **dice qué
falta** en vez de mostrar un canal decorativo o de disfrazar de anuncios el muro
del primer grupo. Mientras eso no exista, la organización por comunidades no se
declara terminada.

---

## 6. Directorios (DIR)

La tarjeta genérica de la zona «Directorios» es la **portada** (`directories`),
que llegaba a la zona por el cajón del grupo «General». Se la sacó **sólo del
panel**, agregándola a `SECCIONES_FUERA_DEL_ARBOL` —el mecanismo que ya existía
para eso—, no de `AccessArea.paths`: quitarla de ahí la habría dejado caer en la
misma zona por el cajón.

Lo que **no** cambió: la sección sigue existiendo con su ruta, su rol y su
renglón en el menú lateral. La aserción de ausencia es localizada al contenedor
de tarjetas de la zona; el rótulo de la zona y el renglón del menú siguen
diciendo «Directorios», y las pruebas lo comprueban.

Los tres accesos concretos abren su directorio en un modal de consulta que
reutiliza el componente de cada uno —con su ruta, su rol y sus datos—, sin
insertar nada debajo de las tarjetas. Qué acceso abre en modal se declara en
`ACCESO_EN_MODAL` (`core/navigation/access-tree.ts`): el panel sigue sin tener
una sola ruta escrita a mano en su plantilla.

---

## 7. Lo que no se pudo completar

| Qué | Por qué | Qué hace falta |
|---|---|---|
| Anuncios con contenido | El dominio no tiene canal de anuncios: `groupType` sólo admite `GENERAL` y `SUPPORT`. | Un concepto `GROUP_TYPE_ANNOUNCEMENT` en el backend (o una relación comunidad→canal), su DTO y su siembra. |
| Encuentro de la receta, visible | Se guarda en el alta y **no vuelve en la lectura**: el DTO de resumen de recetas no declara `encounterId`. | Una línea aditiva en `MedicationRequestSummaryDto` + `clinical-read.service.ts`. No rompe a nadie. |
| Diagnóstico en observaciones, notas, alergias y planes | **No existe el campo** en el contrato, ni en la escritura ni en la lectura. | Cambio de modelo y migración, que la propia especificación manda entregar por separado y con protección de los datos existentes. |
| Alta y edición de notas y planes de cuidado en modal | Planes de cuidado **no tiene alta**; las notas la tienen en su propio bloque. No se crearon operaciones nuevas para llenar la matriz. | Decisión de producto, si se quiere que existan. |
| Formatos fuera de PDF/JPG/PNG/WEBP/GIF | El almacenamiento reconoce por firma binaria y rechaza el resto. Es un control de seguridad del backend. | Decisión explícita de seguridad + firmas nuevas en `upload-content-type.ts`. |
| Persistencia contra la API real | Esta rama se sirve con el backend simulado, que es el entorno autorizado acá. | Correr el recorrido contra el entorno de pruebas del backend. |
| Adjuntar desde un teléfono | La columna de acciones de la tabla se pliega en pantallas estrechas — comportamiento de `app-data-table` anterior a esta corrección. | Subir la prioridad de esa columna, si se quiere. El modal sí entra bien en 360 px. |

---

## 8. Pruebas y evidencia

### Comandos ejecutados

```
yarn lint        → 0 errores
yarn typecheck   → 0 errores
yarn build       → compila (las plantillas también)
yarn test        → 5274 pruebas, 5272 pasan
npx playwright test playwright/correcciones-2026-09-10.spec.ts → 4/4
```

**+31 pruebas unitarias nuevas**, ninguna existente debilitada. Las que
cambiaron lo hicieron porque el comportamiento cambió, y dicen por qué:

- `attachment-uploader.spec.ts` — el lote completo, la categoría deducida, el
  fallo parcial, el reintento que no duplica, la retirada del archivo del medio
  y el contexto heredado.
- `patient-chart.spec.ts` — los vínculos de cada bloque (incluido lo que el
  contrato **no** guarda), el detalle en modal y el contexto del lote.
- `communities.spec.ts` — comunidad = tema, una lectura por tema, el vacío real
  y el fallo que no se disfraza de vacío.
- `content-dialog.spec.ts` — el pie proyectado, el ancho y el descarte.
- `access-tree.spec.ts` (registro y panel) — la ausencia **localizada** de la
  portada y el acceso que abre modal sin desplegar nada bajo la tarjeta.

### Los dos fallos que quedan son anteriores a este trabajo

Vienen con los commits que trajo la rama y no los toca esta corrección:

1. `identity-verification.spec.ts` · «encadena la apertura del caso…» — el
   modelo del caso ganó `type: 'PATIENT_IDENTITY'` en FT-32 (`49bdc478`) y la
   prueba no se actualizó.
2. `shell-layout.spec.ts` · «los nombres de ícono…» — el icono `edit` está en
   una de las dos listas y no en la otra.

Se comprobó que no dependen de nada que se haya tocado acá; se dejan como están
porque arreglarlos es otro alcance.

### Capturas

En `artifacts/correcciones-alovida/` (no se versiona), con su manifiesto en
`manifest-evidencias.json`. Son capturas reales del navegador, con las
animaciones desactivadas para que no salgan a medio aparecer.

**Lo que una captura no demuestra**, y por eso no se presenta como si lo
hiciera: que el servicio recibió los tres archivos. En esta rama el backend
simulado intercepta dentro de `HttpClient`, así que no sale nada por la red y
contar peticiones desde el navegador daría cero con la subida funcionando. Que
sean tres peticiones —una por archivo— lo fija la prueba unitaria con
`HttpTestingController`. El recorrido demuestra la interacción; la unitaria, el
contrato.
