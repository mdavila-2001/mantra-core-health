# Plan — Hito 1: correcciones UX/UI del perfil médico

- Fecha: 2026-10-02 · Repo afectado: mantra-core-health · Predecesores: frontend ad5623a7, modelo dbfae6b.
- Rama: marcelo/fix-perfil-medico-ux-credenciales-especialidades · Base: dev.
- Resultado observable: el profesional consulta credenciales sin especialidades ni idiomas, cancela hacia /account/profile con protección del borrador y lee listas extensas sin overflow.
- Kill-test: editar, cancelar, rechazar descarte conserva el borrador; aceptar vuelve a /account/profile; recargar conserva el dato previamente persistido.

## Alcance
- IN: practitioner-detail (adaptador público y spec, necesario para H1.S4.M4); practitioner-profile (vista, credentials-panel, adaptadores, tipos y specs); practitioner-profile-edit; work-history; app.routes; navigation.map/service, shell specs y regla responsive de shell-layout.css; E2E específico y fixture de auxiliares aislados; esta documentación.
- OUT: backend, modelo, dependencias de producto, primitivas globales, entornos, archivos locales ajenos.
- Confirmado por Marcelo: nueva URL /account/profile sin redirect; PR a mdavila-2001/mantra-core-health contra dev; público conserva únicamente resumen de especialidades en portada.
- Idiomas propios se trasladan a Datos personales. StatusSeal usa approved (verified no existe).
- Plan mode impidió escribir documentos durante planificación: se escriben ahora, antes del código.
- El archivo .yarnrc.yml usa node-modules aunque CLAUDE.md dice PnP: se respeta configuración real sin cambiarla.

## H1 — Perfil coherente, cancelación segura y lectura densa
**CA:** Dado un profesional autenticado, cuando consulta o cancela la edición, entonces obtiene la ficha correcta, conserva decisiones sobre cambios pendientes y puede recorrer todos sus registros.
**DoD:** typecheck/build/lint, suites dirigidas, E2E real, doble revisión visual independiente, reporte y PR mergeable.
**Estado:** A MEDIAS

### H1.S1 — Preparación reproducible
**CA:** Dadas las bases, al iniciar el cambio se trabaja en rama propia preservando archivos ajenos.
**DoD:** comandos Git exit 0; plan en disco antes del código.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Actualizar reglas | Al consultar estándar se usa versión vigente | git pull --ff-only → Already up to date | HECHO |
| H1.S1.M2 | Preparar rama | Al iniciar cambio rama solicitada parte de dev | git rev-parse HEAD → ad5623a7; merge-base exit 0 | HECHO |
| H1.S1.M3 | Escribir plan | Antes del código existe este documento | Test-Path PLAN.md → True | HECHO |

### H1.S2 — Credenciales y especialidades
**CA:** Dada cualquier lectura, al abrir Credenciales solo hay habilitaciones y títulos.
**DoD:** specs de vista/panel y recorrido propio/público/preview.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Retirar especialidades de Credenciales | Al abrir panel no hay lista, resumen ni tab de especialidades; resumen sigue en portada pública | yarn test --include="**/practitioner-profile-view.spec.ts" --watch=false → PASS | HECHO |
| H1.S2.M2 | Trasladar idiomas propios | Al abrir Datos personales conserva nombre/nivel/interpretación | mismo spec → PASS | HECHO |

Retirar también especialidades del resumen verificado/declarado y simplificar tabset de una sola pestaña. No eliminar pruebas: adaptar aserciones al nuevo contrato.

### H1.S3 — Cancelar y regresar
**CA:** Dado el editor, cancelar limpio/aceptar descarte vuelve a /account/profile; rechazar conserva borrador.
**DoD:** specs editor/rutas/navegación/shell y E2E.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Incorporar ruta | Al abrir URL autenticado conserva URL y muestra ficha | yarn test --include="src/app/app.routes.spec.ts" --watch=false → PASS | HECHO |
| H1.S3.M2 | Asociar navegación | Al visitar alias hay una sola entrada activa y breadcrumbs correctos | specs navigation.service y shell → PASS | HECHO |
| H1.S3.M3 | Proteger cancelación | Al rechazar conserva todos los valores; aceptar navega una vez | spec practitioner-profile-edit → PASS | HECHO |

Alias carga MyAccount con metadata/política canónica, en shell autenticado, sin entrada duplicada. Cancelación async con DialogService.confirmarDescarte; snapshot editable tras carga/guardado, incluyendo campos inválidos, teléfono, GPS, logo/firma/sello; excluir correcciones automáticas del payload y operaciones ya persistidas. Bloquear guardado/subidas/doble cancelación. Modales conservan cierres locales.

### H1.S4 — Listados, sellos y respaldos
**CA:** Dados más de cinco registros, al recorrer listados todo es accesible sin overflow y con estados reales.
**DoD:** specs y medición de navegador.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S4.M1 | Credenciales densas | Con 6+ por grupo se recorre colección completa | spec credentials-panel 5/6/12 → PASS | HECHO |
| H1.S4.M2 | Trayectoria densa | Con 6+ totales conserva grupos actual/histórica | spec vista 5/6/12 → PASS | HECHO |
| H1.S4.M3 | Acciones laborales | Al mostrar tabla solo aparecen acciones permitidas | spec work-history por estado → PASS | HECHO |
| H1.S4.M4 | Sellos reales | Al consultar registro vigencia no implica aprobación | specs mapeo approved/pending/rejected/expired/unknown → PASS | HECHO |
| H1.S4.M5 | Respaldos propios | Titular descarga archivo disponible; ajeno/ausente no ofrece acción | specs propagación/descarga/error → PASS | HECHO |
| H1.S4.M6 | Cabecera tablet de la ficha pública | Dado un paciente a 768/1024 px, al abrir la ficha, todas las acciones de navegación caben sin overflow | E2E público, cinco viewports y dos temas, scrollWidth <= clientWidth+1; suite shell → PASS | HECHO |

DataTable/FilterBar/Pagination existentes, maxHeight 420px, columnas plegables, paginación local 10; umbral sobre total sin filtrar, reset al buscar; hasta 5 conserva presentación. Trayectoria conserva grupos y fuente de datos. WorkHistory respeta puedeCorregirse/puedeRetirarse y ViewState. Agregar fileId opcional a tipos visibles y evento al contenedor, FilesClient.contentDataUrl + FileDownloader.trigger, nombre accesible y error recuperable. Afiliaciones sin adjuntos: no inventar contrato.

### H1.S5 — Pruebas y evidencia
**CA:** Dados cambios, al verificarlos el comportamiento y regresión quedan demostrados.
**DoD:** salidas reales y capturas revisadas.
**Estado:** A MEDIAS

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S5.M1 | Validación estática | Al compilar/lint no hay errores nuevos | corepack.cmd yarn typecheck/build/lint → exit 0 | HECHO |
| H1.S5.M2 | Suites dirigidas | Al ejecutar cobertura afectada no falla ni omite | yarn test --include="src/app/features/account/my-profile/**/*.spec.ts" --watch=false + rutas/nav/shell → PASS | HECHO |
| H1.S5.M3 | Recorrido real | Al cancelar/recargar/descargar responde API real | yarn pw playwright/practitioner-profile-ux.spec.ts playwright/practitioner-profile-lists.spec.ts --project=chromium --workers=1 --max-failures=1 → PASS | A MEDIAS |
| H1.S5.M4 | Revisión visual | Al revisar capturas ninguna es RECHAZADA | evidencia/doble-revision.md con dos pasadas, segunda independiente | HECHO |
| H1.S5.M5 | Entornos intactos | Al comparar base no hay cambios de entorno | git diff b84f74aa -- src/environments/ → vacío | HECHO |

Casos: limpio/aceptar/rechazar/revertir/invalidos/imágenes/doble clic/guardado; alias directo/recarga/sin sesión/ruta previa; propio/público/preview; 0/1/5/6/12 registros/texto largo/búsqueda vacía; PDF/ausente/error/otro usuario; cero escrituras al cancelar.
E2E Chromium 1 worker, cero retries, datos sintéticos y API real de desarrollo. Dobles declarados para límites/errores no sustituyen integración. Viewports 390x844,768x1024,1024x768,1440x900,1920x1080; claro/oscuro; foco, teclado, red/consola y overflow; doble revisión, segunda adversarial independiente.

### H1.S6 — Reporte y entrega
**CA:** Dado el cambio verificado, el equipo recibe PR revisable con evidencia.
**DoD:** documentos versionados y salida de gh posterior al último push.
**Estado:** A MEDIAS

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S6.M1 | Reporte | Al retomar se conoce avance real y límites | REPORTE.md completo, avance calculado | HECHO |
| H1.S6.M2 | Commit/push | Al consultar remoto está el cambio acotado | git push -u origin rama → exit 0 | HECHO |
| H1.S6.M3 | PR | Al abrirlo apunta a dev con reviewers | gh pr view --json baseRefName,reviewRequests → dev + jsaldias39/PabloArauzCaballero | HECHO |
| H1.S6.M4 | Gate final | Al entregarlo no tiene conflictos ni checks fallidos | gh pr view --json isDraft,mergeable,mergeStateStatus; gh pr checks → MERGEABLE, no draft, checks PASS | A MEDIAS |

Commit: fix(perfil-medico): retirar especialidades de credenciales en vista y navegar al cancelar edicion.
No merge automático. Se declara aprobación humana pendiente. Stage explícito incluye docs/pruebas, excluye archivos ajenos.

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| gh ausente | Impide gate/publicación | Localizar o habilitar CLI oficial, usar autenticación existente sin exponer secretos |
| API local no disponible | No permite certificar integración | Arrancar entorno autorizado; pruebas aisladas correcto/límite/inválido; declarar integración no cubierta |
| CI externo | Entrega puede quedar A MEDIAS | Gates locales y salida literal checks; no ocultar fallos |
| Archivos ajenos | Mezclar trabajo | No alterar .vscode/settings.json ni docs/trabajo/2026-10-02-sincronizacion-dev-mockup |


## Límite observado durante integración
La API local 954e1167 devuelve 404 en GET /profiles/practitioners/me/signature-assets y GET /practitioners/:id/insurance-networks; ninguna ruta existe en sus controllers. El cliente FirmaYSelloClient y docs/pendientes-backend-perfil-profesional.md documentan la ausencia. El flujo real de cancelación alcanza la última aserción (valor persistido y cero escrituras), pero falla red/consola limpia. Se conserva la prueba sin rebajar aserciones. Para H1.S5.M4, E2E_PROFILE_ISOLATED=1 ofrece sólo dos GET auxiliares vacíos según los contratos existentes; el reporte distingue esa revisión visual de integración completa. H1.S5.M3 seguirá A MEDIAS si no aparece una API que implemente ambos contratos.

## Ampliación necesaria H1.S4.M6, antes del cambio CSS
El E2E midió 784 px de documento sobre 768 px al consultar la ficha pública como paciente. La captura muestra el avatar de cuenta fuera del viewport; las tablas y la tarjeta caben. ShellLayout sólo envuelve sus acciones a <=640 px. Se amplía esa misma regla al rango tablet (<=1024), manteniendo controles, medidas y primitivas existentes. Es una corrección del shell de navegación requerida por la matriz aprobada, no una modificación de primitivas compartidas. Se agrega H1.S4.M6 y su evidencia de navegador; total del plan: 23 microtareas.

## Actualización de la base antes de publicar
El fetch final encontró dev en e32dc33bfcfdfc7e06f6a33b82b56ade569a592e, con un nuevo campo insuranceBillingFrequency en Facturación. Se integró con merge --ff-only --autostash (sin conflictos; archivos ajenos preservados). H1.S3.M3 incluirá la frecuencia en su snapshot editable, con pruebas de aceptación/rechazo/reversión. Se repiten verificaciones estáticas y suites sobre esta base. Las capturas de Datos personales/Credenciales/Trayectoria no muestran Facturación; se conserva y declara su alcance temporal. Sin cambios propios al contrato/modelo/backend.

## Corrección de P2 antes de entrega
P2 rechazó las dos capturas públicas de 390 px: el sello de especialidad supera el borde de su insignia aunque cabe en el documento. Se conserva el diagnóstico y se amplía únicamente el host del grid en la portada al ancho disponible; no se modifican primitivas globales. Se elimina CSS de la especialidad principal que ya no tiene consumidor, para respetar el presupuesto vigente. Se añade medición de contención de los sellos al E2E público y se recapturan sus cinco viewports/dos temas con dos pasadas.

## Segunda actualización de dev
Durante la pausa dev avanzó a b84f74aaf3a359de93c53ab05941e2ec7ac5d0c1. Se integró sin conflictos con ff-only/autostash. El editor heredó idiomas pendientes con guardado independiente dentro de Credenciales. H1.S2.M2 los reubica en Datos personales y H1.S3.M3 protege filas incompletas/pendientes, bloquea cancelación mientras se guardan y excluye los idiomas ya persistidos, sin borrar otros borradores. La primera corrección de ancho público desbordó en columnas de escritorio: el grid de portada tendrá ancho limitado a una columna legible y se repetirá el control de contención en los cinco viewports.

## Corrección final del sello público, antes de cambiar padding
Medición Chromium a 390 px: insignia/grid 276 px, sello 275,625 px más 26 px de padding/borde. El grupo disponibilidad suma padding horizontal al ya provisto por Card. Se elimina ese padding local redundante, conservándolo en bio, para dar al sello el ancho real de la tarjeta. Se mantiene el límite de una columna en portada para evitar celdas desktop de 14rem. No se cambia SpecialtyBadge/StatusSeal ni presupuestos.

## Concurrencia y alcance de entrega
Un commit concurrente 06ef94f6 sobre la misma rama añadió configuración VS Code y documentación de sincronización/SSH ajenas, además de normalizar nuestros logs ya preparados. Se preservaron sus cinco archivos en disco y se retiraron únicamente del índice para restaurar el diff acotado del PR; no se reescribió historia ni se alteró código del perfil.
