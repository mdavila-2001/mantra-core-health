# Hito 2 — Matriz de procedencia, contratos y verificación

Fecha: 2026-09-30. Plan: [PLAN.md](./PLAN.md). Microtareas: H2.S1.M3/M4 y H2.S3.M7–M10.

Esta matriz registra inspección de fuentes y suites existentes. **No registra una ejecución de QA del árbol integrado.** Tener un controlador o un spec no demuestra el flujo en runtime. Las filas de navegador, persistencia, recarga, accesibilidad y bundle quedan pendientes hasta enlazar su salida literal y el SHA probado en el reporte.

## 1. Entradas congeladas y evidencia del prerrequisito

| Entrada del PLAN | SHA | Uso |
|---|---|---|
| Frontend `origin/dev` | `c8d229b3e6a8d870766aaa13aaebf2bd40f22a33` | Base obligatoria; proxy real, CSV y capacidades propias de dev. |
| Frontend `origin/mockup` | `d0d240ed876f1e01d22ffe5cbdcfe68798b8fb1f` | Funcionalidades hasta PR #795. |
| Frontend `origin/test` | `b0e864f5c0dac052ede570c5cccb0e1a7793a971` | A11y, estabilización de pruebas, adjudicación y configuración SSR real. |
| Backend H1 | `e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d` | Fuente de contraste contractual; rama `marcelo/fix-sincronizacion-backend-dev-test`. |

Las referencias remotas pueden avanzar. Durante la documentación se observaron PR #796 en dev y #797/#798 en mockup; **no son entradas de esta matriz ni sustituyen los SHA del PLAN**. Una actualización de alcance requiere registrar los nuevos SHA y reevaluar sus cambios.

Consulta de solo lectura de H1: [PR API #520](https://github.com/mdavila-2001/mantra-core-health-api/pull/520) estaba `OPEN`, `MERGEABLE`, `mergeStateStatus=BLOCKED`, con check `docs=FAILURE`; `dev=bb35e529`, `test=0676225d`. Es una observación de esa consulta, no una garantía del estado remoto posterior.

El [reporte de H1][api-h1-report] declara `TESTED`, 73 suites/801 pruebas dirigidas aprobadas y una suite unitaria previa en rojo; no observó arranque, aplicación real del DDL ni integración. Ese reporte antecede al commit de lint `e76f92dd`; su resultado no se hereda automáticamente para los ocho archivos modificados después. `openapi/` tampoco fue regenerado. Los parches v4.2.32/36/37 existen en API, pero no hay evidencia de aplicación real ni sincronización canónica completa con el modelo.

Convenciones de esta matriz:

- **API fuente:** endpoint/DTO localizado en H1; comportamiento, autorización y persistencia siguen sin ejecución en H2.
- **Demo:** consumidor y doble existen; su resultado no certifica la API real.
- **Parcial:** hay capacidades API y otras sólo simuladas o contratos incompatibles.
- **No ejecutado:** no hay evidencia nueva del árbol integrado para este documento. El estado de tareas sigue siendo el del PLAN; estas etiquetas describen disponibilidad/evidencia, no reemplazan los seis estados de trabajo.

## 2. Origen → funcionalidad → suites → contrato → evidencia

Los números de PR se obtuvieron del historial Git; los grupos señalan procedencia relevante y no afirman que cada PR del intervalo sea una funcionalidad distinta. Los enlaces locales apuntan al árbol integrado; los SHA anteriores fijan el origen histórico.

| Ámbito y procedencia | Capacidad que debe conservarse | Suites existentes para reutilizar | Contrato / disponibilidad H1 | Evidencia disponible y verificación pendiente |
|---|---|---|---|---|
| Laboratorio; mockup #790 (`dbb49352`), recepción #751 (`f447b2c9`) | Portal, catálogo, resumen, subida por partes, pausa/reanudación/cancelación y retiro de resultados. | [Cola de subida][lab-queue-test], [handler portal][lab-handler-test], [cliente diagnóstico][lab-client-test], [recepción][lab-reception-test]; handlers `lab-queue-and-catalogs` y `lab-inbox`. | **Parcial.** Existen módulos diagnósticos anteriores; el contrato nuevo P52 del portal no aparece en controladores H1. Ver C01. | Specs fuente prueban partes, fallo 500, cancelación, autorización y retiro. No se encontró Playwright dedicado al portal nuevo. Añadir recorrido demo; integración del portal real **BLOQUEADO** por contrato. No ejecutado. |
| Diagnóstico C3; mockup #709 (`5e52dab1`) sobre #708 (`c38a2918`) | Enfermedades activas, clasificación por estado, alta y decisión sobre diagnóstico presuntivo. | [PatientChart][patient-chart-test], [bloque diagnóstico][diagnosis-test], [diálogo verificación][diagnosis-dialog-test], [Playwright C3][c3-e2e]; `diagnosis-state.spec.ts`, `diagnosis-verification.handlers.spec.ts`. | **Parcial.** Alta/cambio de estado/adjuntos en API fuente; `/verification` de P41 ausente. Ver C02. | Playwright C3 utiliza fixtures demo y verifica tarjeta/colores; no verifica persistencia real de una confirmación. Conservar esta distinción. No ejecutado. |
| Nota y formulario clínico; mockup #723 (`d1c21f64`), #774 (`91b27947`); test #725 (`70a1d2a5`), dev #759 (`fb936394`) | Nota incorporada al formulario, campos adicionales, formulario libre deslizable, asociación a respuesta del formulario. | [PatientChart][patient-chart-test]; `consultation.spec.ts`, `additional-fields.spec.ts`, `form-response-picker.spec.ts`; Playwright `consulta-formulario-libre.spec.ts`, `consulta-formulario-medico.spec.ts`, `consulta-rejilla.spec.ts`. | **Parcial.** P39 requiere adaptación a `objectiveText`; P40/P41 pendientes; P42/P43 tienen DTO/parches en H1. Ver C03–C06. | No reconstruir `progress-notes`: el PLAN documenta su absorción en consulta. Añadir/ejecutar pruebas de alta y enmienda real con texto+filas, sin campos rechazados. No ejecutado. |
| Aseguradora; mockup #763 (`bbdfba1b`), #789 (`0a62337e`); test #761 (`b0e864f5`) y commit dev `88d0d865` | Conservar adjudicación de API y bandeja demo; dictamen, anulación con motivo y refacturación. | [Vista recibidas][received-test], [cliente seguros][insurance-client-test], [handler recibidas][received-handler-test]; Playwright [cláusulas][claims-e2e]. | **Parcial.** `/insurance-claims` y adjudicaciones existen; `/insurance/received-claims` y nuevas escrituras no. No son rutas intercambiables. Ver C07. | Unitarias de vista prueban confirmación, rechazo, parcial, anulación y acciones disponibles. Añadir E2E demo dictamen→anulación→refacturación. `dictamen-h6-*` son recorridos clínicos antiguos, no esta certificación. No ejecutado. |
| Campañas; dev/test #755 (`f846d72c`), #710 (`10f3ca16`); mockup #731 (`1adac4e1`) | Campañas integradas, widget del paciente y diferencia entre campañas reales/demostración. | `insurance-campaigns.spec.ts`, `patient-campaigns-widget.spec.ts`, `insurance-campaigns.handlers.spec.ts`; [Playwright campañas][campaigns-e2e]. | **API fuente** para rutas `insurance/campaigns` y `insurance-campaigns`; flag `campaignsDemo` debe apagarse en modos reales. | Contrato controller localizado; no se observó integración H2. Mantener cobertura API separada de datos demo. No ejecutado. |
| Notificaciones y dependientes; mockup #794 (`026fdc2f`) | Campana→acción contextual, aceptar/rechazar solicitud y buscar persona a cargo. | [Acciones notificación][notification-test], [campana][bell-test], [formulario dependiente][dependent-test]; `notifications.store.spec.ts`, `notification-routes.spec.ts`, handlers `dependent-candidates`/`dependent-requests`; [Playwright dependientes][dependents-e2e]. | **Parcial.** Lectura/marcado de notificaciones y alta/lista de dependientes en API; búsqueda/ciclo de solicitudes nuevos ausentes. Ver C08. | Añadir recorrido notificación→acción y búsqueda, sin publicar datos personales en evidencia. La búsqueda demo actual usa query `q`; no habilitarla con datos reales sin resolver contrato y regla PHI. No ejecutado. |
| Glosario; mockup #792 (`21c4f3f0`), #793 (`021d884a`) | Búsqueda, detalle, facetas y carga bajo demanda; evitar incorporar todo el corpus al bundle inicial. | [Glosario][glossary-test], [shards][shards-test], [cliente terminología][terminology-test]; `glossary-index.spec.ts`, `glossary-term.spec.ts`, `terminology.handlers.spec.ts`; [Playwright glosario][glossary-e2e]. | **API fuente** para conceptos, detalle, value sets y `$glossary-facets`. Procedencia/contenido CIMA y carga bajo demanda requieren comprobar modo por modo. Ver C09. | Controladores de H1 y specs localizados; ningún corpus cargado ni runtime medido por esta matriz. No ejecutado. |
| Contabilidad; mockup #772 (`1faba02d`), #786 (`8317c34d`) y capacidades propias de dev | Pestañas, resumen, cuentas/registros/transacciones simples; conservar operaciones contables API existentes. | [Resumen][accounting-test], [handler simple][accounting-handler-test]; `accounting.spec.ts`, `cockpit.spec.ts`, `registros.formato.spec.ts`; [Playwright simple][accounting-e2e] y [pestañas][accounting-tabs-e2e]. | **Parcial.** `/accounting/practitioner` existe; subárbol `/simple` de P49 no existe. Ver C10. | Pruebas demo no certifican asiento/persistencia API. No reemplazar operaciones reales por contratos P49 ausentes. No ejecutado. |
| Farmacia/CSV; dev `f08fdc06`, `5ff718b3`; mockup #771 (`77b0b146`), #779 (`5b91d1b8`), #780 (`e71e6dfa`) | Proxy `/pharmacies/`, alta/retiro/importación real, portal y gestión demo, separación de destinos por modo. | [Cliente farmacia][pharmacy-client-test], [importación][pharmacy-import-test], [inventario CSV][csv-test]; `catalogo.reglas.spec.ts`, `inventory-upload-dialog.spec.ts`, `pharmacy-products.spec.ts`; [Playwright portal][pharmacy-e2e]. | **Parcial.** Listado/alta/retiro reales; edición/inventario por lote/categorías/resumen P47 no. Ver C11. | CSV tiene casos de separador/comillas, columnas, valores vacíos, contradicciones y filas inválidas. Añadir prueba del destino por configuración (H2.S2.M8), conservar corte/carreras de importación y probar conectividad proxy real. No ejecutado. |
| A11y; test #726 (`8bf3a162`); mockup #730 (`0c0fd427`), #739 (`69a2d739`), #749 (`b5cc8166`) | Drawer móvil con foco/teclado/Escape/inert; menú; toast con regiones vivas persistentes; badges estáticos. | [Axe componentes][a11y-test], [shell][shell-test], [menú][menu-test], [badge][badge-test], [toast][toast-test]; `announce-on-appear.spec.ts`. | UI compartida, ambos modos. No depende de crear un endpoint. | Specs heredados fijan regiones vivas y roles. Falta recorrido Chromium 390/1440, foco de ida/vuelta e inspección visual independiente. No ejecutado. |
| Determinismo QA; test #754 (`03310f6a`) | Mantener selección estable, aislamiento y utilidades del runner. | Pruebas y soporte Playwright entrantes de test; suites anteriores dirigidas por comportamiento. | QA transversal; demo y API real se ejecutan por separado. | No aumentar retries/timeouts ni debilitar aserciones para lograr verde. Playwright serial con `--workers=1 --retries=0`. No ejecutado. |
| Entornos/SSR/budget; test `production-api` y decisiones de esta sesión | API real predeterminada; demo explícita; SSR real conservado; `initial maximumError=1.5MB` en production y production-api, demás límites conservados. | [Entornos][environment-test], [config gate][environment-gate], [bundle gate][bundle-gate], [mock handlers][mock-test], [prefijos][prefix-gate]. | `environment.mockBackend=false` debe dejar pasar respuesta/error HTTP. Flags que fabrican datos apagados en todos los modos reales. | El spec histórico exige mocks activos en producción/desarrollo: debe ajustarse a la decisión aceptada. Agregar prueba directa de passthrough. `mock-backend.spec.ts` sólo no demuestra aislamiento. Builds y presupuesto deben usar artefactos nuevos. No ejecutado. |

## 3. Matriz de contrato por consumidor

Las rutas representan plantillas, sin identificadores ni datos de personas. Una ausencia es el resultado de la inspección de controladores/DTO en H1, no una prueba de todos los entornos desplegados. El backlog histórico se contrasta con código: algunas entradas ya están desactualizadas.

| ID / pendiente | Consumidor frontend y contrato | Implementación real localizada en H1 | Tratamiento y evidencia que falta |
|---|---|---|---|
| C01 / P51–P52 | [LabPortalClient][lab-client]: `POST /diagnostics/lab/result-uploads`, `PUT …/:uploadId/parts/:index`, `POST …/complete`, `DELETE …/:uploadId`; `GET /diagnostics/lab/result-files`, `GET …/:id/content`, `POST …/:id/withdrawal`, `GET /diagnostics/lab/result-targets`, `GET /diagnostics/lab/summary`. | No se localizaron estos endpoints. [Controlador diagnósticos][api-lab] tiene work orders/analyzer runs/verificación de observaciones, que son otra capacidad. | **Demo; integración real BLOQUEADO.** P51 además documenta incompatibilidad del alta de laboratorio con `POST /iam/auth/register-organization`. No construir un backend alternativo en H2. |
| C02 / P41 | [ClinicalClient][clinical-client]: `POST /clinical/conditions`, `POST …/:id/change-status`, `POST …/:id/verification`. | [ClinicalRecordsController][api-clinical] expone alta/cambio de estado/adjuntos; no se encontró `/verification`. | **Parcial.** Conservar lectura/clasificación de C3. Decisión presuntivo confirmada/refutada sólo demo hasta endpoint real y verificación persistida. El texto antiguo P41 que dice que no hay pantalla ya no describe todo el frontend del corte. |
| C03 / P39 | [ChartNotesClient][notes-client]: `POST /charts/notes`, `PUT /charts/notes/:noteId/versions`, enmienda. Filas `entries` de la UI. | [ChartNotesController][api-notes] implementa notas/versiones/enmiendas; [DTO notas][api-notes-dto] contiene `objectiveText`, sin contrato `entries` localizado. | **Parcial.** H2.S2.M7: serializar texto+filas como `objectiveText` en real; demo conserva `entries`. Probar alta/enmienda sin enviar propiedades rechazadas. La adaptación no implementa persistencia estructurada P39. |
| C04 / P40 | Orden clínica `POST /clinical/service-requests`; propuesta `based_on_note_ids` y categoría textual ligada a notas. | Hay [DTO de orden][api-service-request]; no se certificó implementación completa de P40. | Mantener pendiente del contrato extendido; no dar por resuelto porque la orden básica exista. Revisar payload exacto antes del smoke real. |
| C05 / P42 | [SchedulingClient][scheduling-client]: `POST /scheduling/appointments/direct`, objeto `followUpOf`; lectura `followUpBookingId`. | [DTO reservas][api-bookings] y [DTO lectura][api-bookings-read] definen los campos; patch v4.2.37 presente en API. | **API fuente, runtime pendiente.** DDL no observado aplicado; probar reconsulta, vínculo y recarga sólo en backend aislado con esquema confirmado. |
| C06 / P43 | `formInstanceId` en altas de receta, orden, plan de cuidados y `followUpOf` de cita directa; [selector de respuesta][form-picker-test]. | Campo localizado en DTO [medicación][api-medication], [orden][api-service-request], [cuidados][api-care-plans], [reservas][api-bookings]. Patch v4.2.32 presente. | **API fuente.** El backlog que afirma que H1 no acepta el campo está desactualizado. Aún faltan esquema aplicado y casos válidos/ajenos/no cerrados observados. |
| C07 / dictamen | [InsuranceClient][insurance-client]: `GET /insurance/received-claims`; `POST …/:id/decision`, `POST …/:id/invoice/annulment`, `POST …/:id/invoice`. | No localizados. [ClaimsReadController][api-claims-read] expone `GET /insurance-claims` y detalle; [ClaimsController][api-claims] expone `POST /insurance-claims/:id/adjudications` y su ciclo propio. | **Demo para nuevas rutas; API para ciclo anterior.** Preservar ambos contratos y no remapear automáticamente decisión/factura a adjudicación. No afirmar que el ciclo nuevo está integrado. |
| C08 / acciones y dependientes | [NotificationsClient][notifications-client]: `/notifications/me`, `/notifications/in-app/:id/read`, `/notifications/in-app/read-all`. [ProfilesClient][profiles-client]: `/profiles/patients/me/dependents`, `/dependent-candidates`, `/dependent-requests` e incoming/accept/reject. | [MessagingController][api-messaging] tiene notificaciones; [ProfilesPatientsController][api-patients] tiene GET/POST dependents. No se localizaron dependent-candidates ni dependent-requests en controladores H1. | **Parcial.** Una notificación legible no demuestra su acción final. Search demo envía `q` por URL: registrar brecha contractual/PHI sin copiar datos a evidencia; no inventar ruta real alternativa en H2. |
| C09 / glosario | [TerminologyClient][terminology-client]: `/terminology/concepts`, `/terminology/concepts/:id`, `/terminology/value-sets`, `/terminology/value-sets/$glossary-facets`. | [Conceptos][api-concepts] y [value sets][api-value-sets] localizados; `$glossary-facets` explícito. | **API fuente.** Validar paginación, vacío/error, detalle y facetas con corpus disponible; carga demo por shards se verifica por separado. |
| C10 / P49 | [SimpleAccountingClient][simple-accounting-client]: `/accounting/practitioner/simple/summary`, cuentas, registros y transacciones. | Subárbol `/simple` ausente. [AccountingPractitionerController][api-accounting] tiene paid-consultations, consultation-income, entries, assets y liabilities. | **Parcial.** Mantener operación contable existente; simple es demo. No sustituir contrato ni presentar sessionStorage como persistencia API. |
| C11 / P47 | [PharmacyClient][pharmacy-client]: listado `/pharmacy/products`; alta/retiro `/pharmacies/:pharmacyId/products`; nuevas ediciones, inventario por lote, categorías y resumen. | [PharmacyController][api-pharmacy] tiene POST producto, DELETE producto, POST listas/precios. [Lecturas farmacia][api-pharmacy-read] tiene GET products. No PATCH producto, categorías ni lote de inventario localizados en ese contrato. | **Parcial.** Ruta catálogo real y portal demo separados por modo (H2.S2.M8). Preservar proxy `/pharmacies/` y CSV real; P47 nuevo debe mostrar fallo explícito si se intenta contra API sin contrato. |
| C12 / P44–P45–P48 | [PatientSpendingClient][spending-client]: `/patient-spending/me`; seguros del profesional `/practitioners/:practitionerProfileId/insurance-carriers`; mercado `/insurance-marketplace/insurers/:slug`. | No localizados en controladores H1. `/insurance-carriers/:id` existente es lectura del catálogo asegurador, no reemplazo del mercado del paciente. | **Demo / integración real BLOQUEADO.** Conservar estados de carga/vacío/error; no fabricar información de gastos o cobertura. |
| C13 / P46 y P53 | [BillingSimulatedClient][billing-demo-client]: `/billing/simulated/charges`, pagos por instancia, `/billing/simulated/my-invoices` y detalle. | Namespace simulado no localizado. API tiene facturación real en otro contrato; equivalencia funcional no certificada. | **Demo explícita.** `billingSiatDemo` y `paymentDemo` apagados en real. No declarar que factura simulada equivale a emisión fiscal real. |
| C14 / P50–P51 | [IamClient][iam-client] y alta farmacia/laboratorio: `POST /iam/auth/register-organization` con datos específicos por organización. | Ruta base existente; el backlog registra campos/validaciones incompatibles. No se hizo validación exhaustiva de cada DTO de alta en esta matriz. | **Parcial, no ejecutado.** Conservar pruebas de registro demo; aceptación real requiere cotejo dirigido y request/response observado antes de marcar el caso como disponible. |

## 4. Criterios para completar la evidencia

1. **Integridad:** comprobar como ancestros los tres SHA congelados; registrar resoluciones semánticas, no sólo ausencia de conflictos. PR #770 es el merge final de la base; los fixes de proxy/CSV se trazan a `f08fdc06` y `5ff718b3` para evitar atribuirlos erróneamente al título del PR.
2. **Modo real:** prueba directa de passthrough del interceptor, flags apagados, navegación de catálogo real, DTO de notas compatible. Un error 404/400 de contrato ausente debe permanecer un error visible; no activar simulador como fallback.
3. **Modo demo:** probar las capacidades nuevas contra dobles declarados, incluyendo éxito/límite/error. Identificar modo en cada evidencia. Los recorridos reales y demo no comparten un resultado de certificación.
4. **Artefacto final:** typecheck, lint, unitarias dirigidas, cobertura, gates, build production, production-api y production,demo; budget sobre salida fresca. Guardar comando, exit, salida y SHA. Repetir el área afectada después de un cambio.
5. **Navegador:** Chromium serial, capturas 390/1440 con datos sintéticos, consola/red y persistencia/recarga cuando el contrato real exista. Revisión visual independiente. No capturar PHI ni credenciales.
6. **Cierre honesto:** endpoints ausentes quedan como casos reales BLOQUEADO; una demo aprobada no los cierra. H2 no amplía alcance a backend/DDL. El PR/reporte deben declarar estos límites y el estado actual de H1.

### Calidad de la evidencia documental

`PENDIENTES-BACKEND.md` es un inventario histórico, no una prueba vigente de ausencia: P42/P43 ya tienen fuentes en H1, y P39/P41 cambiaron de alcance frontend después de su redacción. En el corte mockup se observó un marcador residual `||||||| e71e6dfa` en la línea 2340. No se modifica ese archivo desde esta tarea; su corrección sólo corresponde si la integración lo incorpora expresamente al plan. Las observaciones anteriores se sustentan en `git show`, `git log`, búsqueda de controladores/DTO y consultas GitHub de solo lectura; no se ejecutó runtime para producir esta matriz.

[api-h1-report]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/docs/trabajo/2026-09-30-sincronizacion-backend-dev-test/REPORTE.md
[lab-queue-test]: ../../../src/app/features/laboratory/results/result-upload-queue.spec.ts
[lab-handler-test]: ../../../src/app/core/mock/handlers/lab-portal.handlers.spec.ts
[lab-client-test]: ../../../src/app/core/data-access/diagnostics/diagnostics-lab.client.spec.ts
[lab-reception-test]: ../../../src/app/features/lab-reception/lab-reception.spec.ts
[patient-chart-test]: ../../../src/app/features/clinical-record/patient-chart/patient-chart.spec.ts
[diagnosis-test]: ../../../src/app/features/clinical-record/patient-chart/diagnosis-block/diagnosis-block.spec.ts
[diagnosis-dialog-test]: ../../../src/app/features/clinical-record/patient-chart/diagnosis-verify-dialog/diagnosis-verify-dialog.spec.ts
[c3-e2e]: ../../../playwright/clinica-c3-enfermedades-activas.spec.ts
[received-test]: ../../../src/app/features/insurance/received-claims/received-claims.spec.ts
[insurance-client-test]: ../../../src/app/core/data-access/insurance/insurance.client.spec.ts
[received-handler-test]: ../../../src/app/core/mock/handlers/insurer-received-claims.handlers.spec.ts
[claims-e2e]: ../../../playwright/carril-adjudicacion-clausulas.spec.ts
[campaigns-e2e]: ../../../playwright/carril-insurance-campaigns.spec.ts
[notification-test]: ../../../src/app/core/notifications/notification-actions.spec.ts
[bell-test]: ../../../src/app/shared/components/organisms/notification-bell/notification-bell.acciones.spec.ts
[dependent-test]: ../../../src/app/features/account/dependents/dependent-form-dialog.spec.ts
[dependents-e2e]: ../../../playwright/b1-dependientes.spec.ts
[glossary-test]: ../../../src/app/features/glossary/glossary.spec.ts
[shards-test]: ../../../src/app/core/mock/glossary-shards.spec.ts
[terminology-test]: ../../../src/app/core/data-access/terminology/terminology.client.spec.ts
[glossary-e2e]: ../../../playwright/lane-25-glossary.spec.ts
[accounting-test]: ../../../src/app/features/accounting/resumen/resumen.spec.ts
[accounting-handler-test]: ../../../src/app/core/mock/handlers/simple-accounting.handlers.spec.ts
[accounting-e2e]: ../../../playwright/contabilidad-simple.spec.ts
[accounting-tabs-e2e]: ../../../playwright/contabilidad-pestanas.spec.ts
[pharmacy-client-test]: ../../../src/app/core/data-access/pharmacy/pharmacy.client.spec.ts
[pharmacy-import-test]: ../../../src/app/features/pharmacy/import/pharmacy-import.spec.ts
[csv-test]: ../../../src/app/features/pharmacy/inventory/inventory-csv.spec.ts
[pharmacy-e2e]: ../../../playwright/portal-farmacia.spec.ts
[a11y-test]: ../../../src/app/shared/components/a11y.spec.ts
[shell-test]: ../../../src/app/features/shell-layout/shell-layout.spec.ts
[menu-test]: ../../../src/app/shared/components/molecules/menu/menu.spec.ts
[badge-test]: ../../../src/app/shared/components/atoms/badge/badge.spec.ts
[toast-test]: ../../../src/app/shared/components/molecules/toast/toast.spec.ts
[environment-test]: ../../../src/environments/environment.real-api.spec.ts
[environment-gate]: ../../../scripts/check-real-api-config.mjs
[bundle-gate]: ../../../scripts/check-bundle-budget.mjs
[mock-test]: ../../../src/app/core/mock/mock-backend.spec.ts
[prefix-gate]: ../../../scripts/check-route-prefixes.mjs
[form-picker-test]: ../../../src/app/features/clinical-record/patient-chart/form-response-picker/form-response-picker.spec.ts
[lab-client]: ../../../src/app/core/data-access/lab-portal/lab-portal.client.ts
[clinical-client]: ../../../src/app/core/data-access/clinical/clinical.client.ts
[notes-client]: ../../../src/app/core/data-access/chart-notes/chart-notes.client.ts
[scheduling-client]: ../../../src/app/core/data-access/scheduling/scheduling.client.ts
[insurance-client]: ../../../src/app/core/data-access/insurance/insurance.client.ts
[notifications-client]: ../../../src/app/core/data-access/notifications/notifications.client.ts
[profiles-client]: ../../../src/app/core/data-access/profiles/profiles.client.ts
[terminology-client]: ../../../src/app/core/data-access/terminology/terminology.client.ts
[simple-accounting-client]: ../../../src/app/core/data-access/simple-accounting/simple-accounting.client.ts
[pharmacy-client]: ../../../src/app/core/data-access/pharmacy/pharmacy.client.ts
[spending-client]: ../../../src/app/core/data-access/patient-spending/patient-spending.client.ts
[billing-demo-client]: ../../../src/app/core/data-access/billing-simulated/billing-simulated.client.ts
[iam-client]: ../../../src/app/core/data-access/iam/iam.client.ts
[api-lab]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/diagnostics/controllers/diagnostics-lab.controller.ts
[api-clinical]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/clinical/controllers/clinical-records.controller.ts
[api-notes]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/chart/controllers/chart-notes.controller.ts
[api-notes-dto]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/chart/dto/notes.dto.ts
[api-service-request]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/clinical/dto/service-request.dto.ts
[api-bookings]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/scheduling/dto/scheduling-bookings.dto.ts
[api-bookings-read]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/scheduling/dto/scheduling-read.dto.ts
[api-medication]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/clinical/dto/medication.dto.ts
[api-care-plans]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/chart/dto/care-plans.dto.ts
[api-claims-read]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/insurance/controllers/claims-read.controller.ts
[api-claims]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/insurance/controllers/claims.controller.ts
[api-messaging]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/messaging/controllers/messaging.controller.ts
[api-patients]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/profiles/controllers/profiles-patients.controller.ts
[api-concepts]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/terminology/controllers/terminology-concepts.controller.ts
[api-value-sets]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/terminology/controllers/terminology-value-sets.controller.ts
[api-accounting]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/accounting/controllers/accounting-practitioner.controller.ts
[api-pharmacy]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/pharmacy/controllers/pharmacy.controller.ts
[api-pharmacy-read]: https://github.com/mdavila-2001/mantra-core-health-api/blob/e76f92ddc8e7c86ff50fb6f8a4850e0d77dc504d/src/modules/pharmacy/controllers/pharmacy-read.controller.ts
