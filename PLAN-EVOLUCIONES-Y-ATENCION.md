# Plan · Evoluciones, expediente y el botón «Atender»

Fecha: 2026-09-09. Rama de referencia: `origin/mockup` (la que mira el usuario).

## Estado

**Las cinco fases están hechas.** Última actualización: 2026-09-10.

| Fase | Estado | Commits |
|---|---|---|
| 1 · «Atender» nace sólo de Mis citas | Hecha | `ced1531f`, `3e164060`, `b3f0fa58`, `fad06994` |
| 2 · Evoluciones deja de ser un espejo | Hecha | `b9a0175a` |
| 3 · Expediente: la card y las ediciones a modales | Hecha | `3e164060` (3.1), `18736b37` (3.3), `76616d05` (3.2), `261050d4` (3.4) |
| 4 · Verificación | Hecha | `4b67435d` (recorrido 15/15), `ff3a708c` (evidencia 18/18) |
| 5 · Documentación | Hecha |

### Lo que quedó fuera, a propósito

- **La fusión de «Consulta médica» dentro de «Mis citas»** (filtro «Hoy»). El
  propio plan la dejaba como seguimiento.
- **El handler mock de `GET /charts/notes`** (fase 2, punto 6, marcado
  «opcional»): la pantalla ya trae las notas reales del expediente bajo
  demanda, así que un mock del endpoint que no existe sólo enseñaría una
  versión final que el backend todavía no puede sostener.
Todo lo demás está corrido contra `ng serve`: `playwright/evoluciones-y-atencion.mjs`
da 15/15 y `playwright/verificacion-pedidos.mjs` 18/18, además de `lint`,
`typecheck`, `build` y las unitarias.

### Deuda que este trabajo deja anotada

Las notas de una atención se reconocen **por su día calendario**: el contrato
no ata una nota a una reserva. Dos atenciones de la misma persona el mismo día
muestran las mismas notas. Está en `PENDIENTES-BACKEND.md` P18 junto con lo que
haría falta para dejar de estimar.

## 1. Diagnóstico

### 1.1 ¿Datos del mock o código? → Es código. Pasa igual contra la API real.

| Síntoma | Dónde está | Mock | API real |
|---|---|---|---|
| Evoluciones parece Archivo clínico | `progress-notes.ts:229` enlaza a `patientChartRoute`, la misma ruta que «Ver expediente» de `clinical-record.ts:221`. | Sí | Sí |
| Evoluciones no muestra evoluciones | Lee `GET /scheduling/bookings` de la agenda propia y agrupa por paciente (`agruparPorPaciente`). No hay `GET /charts/notes` (PENDIENTES-BACKEND.md:82-92). | Sí | Sí |
| Botón «Atender» en el expediente | `patient-chart.html:5-13` (`rutaDeLaAtencion`). **Sólo existe en `mockup`**; `dev` no lo tiene. | Sí | Cuando mockup se mergee a dev, sí |
| Card «Qué se está mirando» | `patient-chart.html` (bloque `expediente__nota`). Existe en dev y mockup. | Sí | Sí |
| Cambios inline que deforman la tabla | `patient-chart.html` `#celdaAcciones`, `procedures-block.html:195-199`, `diagnosis-block.html:36`. | Sí | Sí |

Los datos del mock (`fixtures/agenda.ts:252-254`) traen `checkedInAt`, `patientName` y `reasonText` con la misma forma que la API real (`scheduling-read.dto.ts:304`, `scheduling-bookings.controller.ts:82-103`). La única diferencia real: contra la API, sin agenda publicada o sin reservas, Evoluciones queda vacía; y el nombre del paciente sólo llega si la sesión es el profesional de esa agenda. Nada de eso explica los síntomas.

### 1.2 Mapa de redundancias (rama mockup)

**Entradas a «atender» (ruta `/medical-records/:id/encounter`, pantalla `encounter-workspace`):**

| Origen | Archivo | Veredicto |
|---|---|---|
| Mis citas → «Iniciar consulta» | `agenda.html:522`, `agenda.ts:1463` | **Debería ser el único origen y hoy NO lleva a la atención**: sólo hace `startBooking` y recarga la tabla. |
| Expediente → «Atender» (cabecera) | `patient-chart.html:12` | Sobra. El expediente es lectura. |
| Consulta médica → «Abrir consulta» por cita | `consultation.html:45`, `consultation.ts:260` | Sobra. Duplica Mis citas con otro botón. |
| Consulta médica → «Atender a alguien sin turno» (pegar UUID) | `consultation.html:66-87`, `consultation.ts:173` | Sobra y es peligroso: atiende sin cita ni trazabilidad. El camino correcto es dar de alta el turno de mostrador (`POST /scheduling/appointments/direct`, pantalla `booking-new`) y entonces «Iniciar consulta». |

**Entradas al expediente (lectura, `/medical-records/:id`):**

| Origen | Archivo | Veredicto |
|---|---|---|
| Archivo clínico → «Ver expediente» | `clinical-record.html` | Correcto: es el dueño. |
| Evoluciones → «Abrir su evolución» | `progress-notes.html:48` | Mismo destino con otro rótulo → confusión. Debe abrir la **evolución de esa atención**, no el expediente. |
| Mis citas → «Abrir expediente» (celda Paciente) | `agenda.html:368`, `agenda.ts:1750-1756` | Correcto como lectura, pero viaja con `motivo` y `cita`, parámetros que el expediente ya no usa desde que la escritura se mudó a Atención. Parámetros muertos. |
| Mi agenda → diálogo «Abrir expediente» | `my-agenda.ts:848-853` | Correcto como lectura. |

**Pantallas que se pisan:** «Consulta médica» y «Mis citas» listan las mismas citas de hoy con botones distintos.

### 1.3 La card «Qué se está mirando»

Explica arquitectura interna («dos lecturas del backend», «registro estructurado vs narrativo») a quien atiende. Es texto para desarrolladores en la pantalla del médico y ocupa una card entera al pie. Se elimina; si algo de eso hace falta, va al JSDoc del componente.

### 1.4 Ediciones inline que invaden la tabla

- `patient-chart.html` `#celdaAcciones`: un `app-concept-select` «Cambiar a…» + botón «Aplicar» **dentro de la celda** de cada diagnóstico, y un `app-attachment-uploader` que se despliega **dentro de la fila** (`adjuntandoArchivoA`).
- `procedures-block.html:195-199`: mismo uploader inline por tratamiento.
- `diagnosis-block.html:36`: uploader inline.
- `medication-block` y `admission-block` ya usan `DialogService`; sus acciones «Firmar», «Emitir» y «Cerrar» no piden datos y no despliegan nada. Quedan.

Ya existen los modales del sistema: `molecules/dialog` (`DialogService.confirm`, `confirmWithReason`) y `organisms/content-dialog` (`<app-content-dialog>` con contenido proyectado). No hay que inventar uno.

## 2. Plan por fases

### Fase 0 · Base
- Partir de `origin/mockup` en el commit «merge: claude/perfil-organizaciones en mockup» (dev ya mergeado el 2026-09-09; no entró el commit de accesos de carril-c 8563bba8 por conflictos). Worktree propio, rama `claude/evoluciones-y-atencion`.

### Fase 1 · «Atender» nace sólo de Mis citas
1. `agenda.ts iniciarAtencion`: tras `startBooking` OK, navegar a `encounterWorkspaceRoute(paciente)` con `motivo` y `cita` (reusar `paramsDelExpediente`, renombrado a `paramsDeLaAtencion`). Si la cita ya está `BK-IN-PROGRESS`, el botón dice «Continuar consulta» y navega sin volver a llamar `start`.
2. `agenda.html:368` «Abrir expediente»: quitar los query params; queda lectura pura.
3. `patient-chart`: eliminar el botón «Atender» y `rutaDeLaAtencion`. En su lugar, **sólo si hay un encuentro en curso** con esa persona, un `app-alert` informativo «Tenés una consulta en curso con esta persona» con enlace «Volver a la consulta». Es continuación, no un origen nuevo.
4. `consultation`: quitar «Abrir consulta» por cita y toda la card «Atender a alguien sin turno». Las tarjetas de hoy quedan como lectura con enlace «Ir a Mis citas». La card del sin turno se reemplaza por un enlace «Registrar turno de mostrador» a la reserva directa. Decisión tomada: la fusión total de Consulta médica dentro de Mis citas (filtro «Hoy») queda como seguimiento, no en esta tanda.
5. `encounter-workspace`: sin cambios de ruta; su botón «Ver expediente» se conserva (es lectura).

### Fase 2 · Evoluciones deja de ser un espejo del Archivo clínico
1. **Una fila por atención**, no por paciente: fecha y hora, paciente, motivo, estado (completada / en curso / llegó y no se cerró), tipo de cita, canal. Fuente sigue siendo `GET /scheduling/bookings` (única lectura disponible), pero el destino cambia.
2. Acción por fila «Ver evolución»: abre un `<app-content-dialog>` con el resumen de **esa atención**: encuentro, diagnósticos, notas y receta de ese encuentro, leyendo `GET /charts/patients/:id/chart` **bajo demanda** (una petición por clic, no N al cargar) y filtrando por el encuentro cuya fecha coincide con la cita. Dentro del modal: «Descargar PDF de la atención» (ya existe `descargarAtencion` en el chart, se extrae a un util compartido) y «Abrir expediente completo» como enlace secundario.
3. **Buscador y filtros** con `organisms/filter-bar` (ya usado en 10 listados de accesos): búsqueda por nombre o motivo (`q` en la URL, la barra ya lo maneja); chips de período 7 / 30 / 90 días (el cambio de período vuelve a consultar, tope de ventana 92 días); selectores de estado, tipo de cita y canal desde sus value sets. Filtrado en cliente sobre la página cargada (`limit: 200`).
4. Rótulos: título «Evoluciones», subtítulo «Las atenciones que registraste y lo que escribiste en cada una». Se quita el alert azul «Por ahora lista a quién atendiste…»; en su lugar una línea de resumen «N atenciones en los últimos X días».
5. Exportar a PDF se mantiene y pasa a respetar los filtros activos.
6. Backend sigue pendiente: `GET /charts/notes?practitionerId&from&to` (ya anotado). Cuando exista, la fila se alimenta de ahí y el modal deja de filtrar por fecha. Opcional en esta tanda: handler mock de ese endpoint para que la maqueta enseñe la versión final.

### Fase 3 · Expediente: sacar la card y mover las ediciones a modales
1. Eliminar la card «Qué se está mirando» (`patient-chart.html`, estilos `expediente__nota*`, y su aserción en `patient-chart.spec.ts`).
2. `#celdaAcciones` de diagnósticos: un solo botón «Acciones» (`appMenuTrigger` + `app-menu`, como el menú de pago en agenda) con dos ítems:
   - «Cambiar estado clínico…» → `app-content-dialog` con el `app-concept-select` y botón «Aplicar»; el backend sigue validando la transición.
   - «Adjuntar archivo…» → `app-content-dialog` con `app-attachment-uploader`.
   La celda deja de crecer; la tabla conserva su alto.
3. Nuevo organismo pequeño `attachment-dialog` (envuelve content-dialog + attachment-uploader, inputs `ownerType`, `ownerId`, `linkVia`, output `attached`) y usarlo en `patient-chart`, `procedures-block` y `diagnosis-block` para no repetir tres veces.
4. Regla a dejar escrita en `docs/design-system`: **cualquier cambio sobre un registro existente que pida datos va en modal; la fila sólo tiene acciones directas o un menú.**

### Fase 4 · Verificación
- Unitarias: `progress-notes.spec` (fila por atención, filtros, búsqueda), `agenda.spec` (Iniciar consulta navega con params), `patient-chart.spec` (sin «Atender», sin card, menú abre dialog), `consultation.spec`, `attachment-dialog.spec`.
- Playwright en mockup con `medica@alovida.mock` (sin `networkidle`, con `data-testid`):
  1. Mis citas → «Iniciar consulta» → URL `/medical-records/:id/encounter` con `?cita=`.
  2. Expediente sin `expediente-abrir-atencion` ni «Qué se está mirando».
  3. Evoluciones: teclear un nombre reduce las filas; chip de período cambia el resumen; «Ver evolución» abre `role=dialog`.
  4. Diagnóstico → «Acciones» → «Cambiar estado clínico…» abre dialog y el alto de la tabla no cambia.
- Actualizar `playwright/expediente-pestanas-navegador.spec.ts` (hoy afirma que existe el botón «Atender») y `pdf-premium-evoluciones.spec.ts`.
- `check-*.mjs` a mano (el CI no corre). Commit por archivo, push, PR a `mockup` y luego a `dev`.

### Fase 5 · Documentación
- `ESTADO-FRONTEND.md`, `PENDIENTES-BACKEND.md` (la entrada de `GET /charts/notes` cambia de «no puede listar» a «lista por atención; falta la lectura de notas»), JSDoc de `progress-notes.ts` y `clinical-record.routes.ts`.

## 3. Orden y tamaño

| Fase | Días | Depende de |
|---|---|---|
| 1 Atender | 1 | merge dev→mockup |
| 3 Expediente y modales | 1.5 | 1 (comparten patient-chart) |
| 2 Evoluciones | 2 | ninguna |
| 4 Verificación | 1 | 1-3 |
| 5 Docs | 0.5 | 4 |

Fase 2 puede ir en paralelo con 1 y 3 en otra sesión: no tocan los mismos archivos.
