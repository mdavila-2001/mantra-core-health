# Inventario de referencias — CORR-01

- Búsqueda: `rg -n "'consultation'|/consultation|Consulta médica" src --glob '*.ts' --glob '*.html' --no-heading --max-columns 240 --max-columns-preview`
- Resultado antes de cambios de producto: 40 líneas coincidentes.
- Clasificación: ninguna referencia de la pantalla antigua permanece en el código de la rama `mockup`; las coincidencias son del encuentro clínico, ingresos contables o el nombre descriptivo de una prestación.

| # | Ubicación (línea original) | Clasificación | Motivo |
|---:|---|---|---|
| 1 | `src/app/app.routes.ts:624` | Encuentro clínico — conservar | Ruta `/medical-records/:profileId/consultation`, distinta de `/consultation`. |
| 2 | `src/app/app.routes.ts:628` | Encuentro clínico — conservar | Carga el componente dentro de `clinical-record`. |
| 3 | `src/app/core/data-access/accounting/accounting.client.ts:166` | Contabilidad — conservar | Comentario del endpoint de ingresos por consulta. |
| 4 | `src/app/core/data-access/accounting/accounting.client.ts:175` | Contabilidad — conservar | URL `/accounting/practitioner/consultation-income`. |
| 5 | `src/app/core/data-access/accounting/accounting.client.spec.ts:111` | Contabilidad — conservar | Aserción del contrato de ingresos por consulta. |
| 6 | `src/app/core/mock/handlers/finance.handlers.coverage.spec.ts:278` | Contabilidad — conservar | Prueba del handler de ingresos sintéticos. |
| 7 | `src/app/core/mock/handlers/finance.handlers.ts:1066` | Contabilidad — conservar | Ruta simulada de ingresos por consulta. |
| 8 | `src/app/core/mock/handlers/insurance.handlers.ts:309` | Prestación — conservar | Nombre de categoría de cobertura. |
| 9 | `src/app/features/insurance/insurance-catalog/insurance-catalog.spec.ts:59` | Prestación — conservar | Etiqueta de beneficio de seguro. |
| 10 | `src/app/shared/components/atoms/service-icon/service-icon.spec.ts:25` | Prestación — conservar | Mapeo del icono para una prestación médica. |
| 11 | `src/app/features/agenda/agenda.spec.ts:2055` | Encuentro clínico — conservar | Comprueba navegación a la historia clínica. |
| 12 | `src/app/features/agenda/agenda.spec.ts:2175` | Encuentro clínico — conservar | Comprueba un destino de consulta clínica. |
| 13 | `src/app/features/agenda/agenda.spec.ts:2269` | Encuentro clínico — conservar | Comprueba que el destino de historia clínica esté presente. |
| 14 | `src/app/features/agenda/agenda.spec.ts:2282` | Encuentro clínico — conservar | Segunda comprobación del destino de historia clínica. |
| 15 | `src/app/features/agenda/agenda.spec.ts:2313` | Encuentro clínico — conservar | Comprueba navegación al encuentro clínico. |
| 16 | `src/app/features/clinical-record/clinical-record.routes.ts:33` | Encuentro clínico — conservar | Construye la ruta del encuentro clínico. |
| 17 | `src/app/core/mock/fixtures/conceptos.ts:540` | Prestación — conservar | Concepto simulado `ACT-CONSULTA`. |
| 18 | `src/app/core/mock/billing-sim/datos-simulados.ts:131` | Prestación — conservar | Descripción de consulta ambulatoria en facturación. |
| 19 | `src/app/core/mock/billing-sim/datos-simulados.ts:202` | Prestación — conservar | Descripción de prestación para facturación. |
| 20 | `src/app/features/clinical-record/patient-chart/patient-chart.spec.ts:953` | Encuentro clínico — conservar | Comentario sobre el spec del encuentro clínico. |
| 21 | `src/app/features/component-stock/component-index.generated.ts:18981` | Índice generado — conservar | Entrada del componente clínico. |
| 22 | `src/app/features/component-stock/component-index.generated.ts:18988` | Índice generado — conservar | Ruta al archivo clínico. |
| 23 | `src/app/features/component-stock/component-index.generated.ts:19067` | Índice generado — conservar | Cargador dinámico del componente clínico. |
| 24 | `src/app/features/component-stock/component-index.generated.ts:19071` | Índice generado — conservar | Entrada del panel de plan de pago clínico. |
| 25 | `src/app/features/component-stock/component-index.generated.ts:19078` | Índice generado — conservar | Ruta del panel de plan de pago. |
| 26 | `src/app/features/component-stock/component-index.generated.ts:19133` | Índice generado — conservar | Cargador dinámico del panel clínico. |
| 27 | `src/app/core/mock/contract/api-contract.generated.ts:6` | Contrato generado — conservar | La coincidencia es una ruta de contabilidad; el archivo generado contiene contratos de API. |
| 28 | `src/app/features/clinical-record/consultation/consultation.ts:274` | Encuentro clínico — conservar | Referencia de plantilla del componente de historia clínica. |
| 29 | `src/app/features/clinical-record/consultation/consultation.ts:275` | Encuentro clínico — conservar | Referencia de estilos del componente de historia clínica. |
| 30 | `src/app/features/clinical-record/consultation/consultation.spec.ts:10` | Encuentro clínico — conservar | Importa la prueba del componente clínico. |
| 31 | `src/app/features/clinical-record/consultation/consultation.spec.ts:111` | Encuentro clínico — conservar | Declara la ruta clínica en el entorno de prueba. |
| 32 | `src/app/features/clinical-record/consultation/consultation.spec.ts:118` | Encuentro clínico — conservar | Navega a un encuentro clínico de prueba. |
| 33 | `src/app/features/clinical-record/consultation/consultation.spec.ts:230` | Encuentro clínico — conservar | Caso de encuentro clínico con cita y reserva. |
| 34 | `src/app/features/clinical-record/consultation/consultation.spec.ts:233` | Encuentro clínico — conservar | Caso de encuentro clínico con cita. |
| 35 | `src/app/features/account/cotizaciones/cotizaciones.logic.spec.ts:27` | Prestación — conservar | Etiqueta de prestación en cotización. |
| 36 | `src/app/features/account/cotizaciones/cotizaciones.spec.ts:110` | Prestación — conservar | Etiqueta de prestación en cotización. |
| 37 | `src/app/features/account/cotizaciones/cotizaciones.fuentes.spec.ts:244` | Prestación — conservar | Etiqueta de prestación de una fuente. |
| 38 | `src/app/features/account/my-invoices/my-invoices.spec.ts:85` | Prestación — conservar | Descripción histórica de factura recibida. |
| 39 | `src/app/features/account/my-invoices/my-invoices.spec.ts:93` | Prestación — conservar | Descripción de factura emitida. |
| 40 | `src/app/features/account/my-invoices/my-invoices.spec.ts:107` | Prestación — conservar | Descripción de prestación facturada. |

La pantalla antigua no tiene carpeta `src/app/features/consultation/`, entrada `path: 'consultation'`, ni referencia en `access-tree.ts`. La búsqueda no dio coincidencias de `/consultation` fuera de los destinos `/medical-records/:profileId/consultation` y contabilidad.
