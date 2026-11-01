# Evidencia de errores visibles W1–W3 (#1026)

**Fecha:** 2026-10-11 · **Base:** `mockup` · **Viewport de esta tanda:** 768 × 1024 · **Backend:** simulador en memoria, sin API ni Docker.

Los errores se activaron por `sessionStorage['mock:fallos']`; el interceptor mock de Angular devuelve los errores dentro de la aplicación. Playwright comprueba los estados que ve la persona y guarda capturas, no inspecciona respuestas de red del navegador porque estas peticiones no salen a la red.

## Evidencia nueva de la tarea 2.7

| Recorrido | Ruta afectada | Resultado observado | Captura |
|---|---|---|---|
| Receta del médico: el chequeo de interacciones falla | `POST /cds/check-interactions` | Se informa que no se revisaron las interacciones, se explica que la persona debe comprobarlas antes de firmar y se muestra `mock-fallo`. La falla no bloquea el guardado. | [receta-interacciones-768.png](receta-interacciones-768.png) |
| Receta del médico: validación estructurada | `POST /clinical/medication-requests` | El 422 señala «Elija un medicamento del catálogo» debajo de Medicamento y el control queda `aria-invalid=true`. | [receta-validacion-422-768.png](receta-validacion-422-768.png) |
| Mi salud: «Su última receta» | `GET /clinical/patients/:profileId/summary` | La tarjeta muestra «No se pudo consultar» en vez de la fecha o «Todavía no le recetaron nada». La ruta comprobada es la lectura del resumen clínico, no `/clinical/medication-requests`. | [mi-salud-ultima-receta-768.png](mi-salud-ultima-receta-768.png) |
| Dinero: cockpit contable | `GET /accounting/fiscal-years` | El estado de error muestra «Algo salió mal», «Simulado: fallo del servidor», código de soporte `mock-fallo` y «Reintentar». | [dinero-cockpit-error-768.png](dinero-cockpit-error-768.png) |
| Social: muro público | `/posts` → `GET /public/posts` | Aparece «No pudimos cargar las publicaciones», el motivo y «Reintentar». | [social-publicaciones-error-768.png](social-publicaciones-error-768.png) |

Las cinco imágenes se abrieron y revisaron. Sus anchos son 768 px; las de receta y contabilidad miden 768 × 1024 px y las capturas de página completa de Mi salud y Social miden 768 × 2030 px y 768 × 1549 px.

## Evidencia anterior conservada

| Pantalla | Resultado previo documentado |
|---|---|
| Mi agenda, médica, `/schedule` | `GET /scheduling/bookings` presenta el aviso «Parte de su agenda no se pudo cargar»; al quitar el fallo y reintentar vuelven las citas. |
| Panel de la médica, `/dashboard` | No muestra un día vacío como si fuera disponibilidad normal: ofrece el estado de error y reintento. |
| Mis vinculaciones, `/administration/medical-organization` | El fallo de roles/membresías muestra el error en vez de presentar una lista vacía. |
| Mi salud: próxima cita | El fallo de agenda indica que no se pudo traer la cita y conserva el acceso a «Mis citas». |

La observación previa de W1 encontró además un defecto pendiente: con las citas caídas, la tarjeta del día de Mi agenda dice «No atiende este día» aunque haya horarios de atención. También se registraron pestañas sin nombre accesible en `/schedule` y `/administration/medical-organization`, y enlaces de registro sin nombre accesible en `/auth`. Estos hallazgos no se modificaron en esta verificación.

## Comprobaciones

- `corepack yarn pw playwright/task-27-error-flow-evidence.spec.ts --workers=1` — **4/4 pasaron**; el escenario Social se repitió luego de fijar su viewport y pasó (1/1).
- Specs unitarios dirigidos para `fallos-simulados`, `medication-block` y `patient-home` — **90/90 pasaron**.
- `corepack yarn typecheck` — pasó.
- ESLint dirigido sobre los archivos cambiados — pasó.
- `corepack yarn lint` global — falla con **270 errores preexistentes** en el repositorio; el ESLint dirigido de los archivos de este cambio está limpio.
- No se corrió la suite unitaria completa ni `playwright/carril-19-route-health.spec.ts` en esta tarea.
- No se usó simulador, Docker ni una API externa.

## Alcance y cambios

Se agregó el modo de fallo `validation` a `fallos-simulados`, con cuerpo 422 `VALIDATION_FAILED` y un error de campo para `medicationConceptId`. `MedicationBlock` ahora conserva y muestra errores estructurados de la API en el campo Medicamento; los limpia al cambiar la selección o al iniciar una nueva escritura. El spec unitario cubre el mensaje y `aria-invalid`.

El test de navegador está en `playwright/task-27-error-flow-evidence.spec.ts`. No se debilitó ninguna prueba ni se usó `skip`.
