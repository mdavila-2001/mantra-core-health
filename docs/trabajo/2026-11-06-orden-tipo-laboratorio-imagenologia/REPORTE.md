> **AVANCE: 8 / 12 — 66,7 %.** Laboratorio e imagenología funcionan de punta a punta contra el simulador y la API tiene tests; faltan el 3D reactivo a la región, elegir un laboratorio concreto, y la tercera revisión visual.

# Reporte — Orden de estudio: tipo Laboratorio / Imagenología

- Fecha: 2026-11-06 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/brave-bohr-vu0zuc` en `mantra-core-health` y `mantra-core-health-api`
- Peldaño de evidencia: **API `TESTED`** (tests dirigidos; no se ejecutó contra una base real). **Front `VERIFIED` contra el simulador** (flujo completo en navegador con persistencia tras recarga); **visual `VERIFIED_FUNCTIONAL_ONLY`** (la recaptura final no tuvo tercera pasada independiente). Contra la API real: `UNKNOWN`.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Enums `service-request-contrast` y `service-request-body-region` nuevos; `diagnostic-modality`, `condition-laterality` y `specimen-type` también atados a la orden; designaciones en castellano | `yarn test src/common/seed` | PASS 47 suites / 491 tests |
| H1.S1.M2 | DTO, entidad y repositorio con las 5 columnas que el modelo ya tenía (v4.2.82) | `yarn typecheck` | PASS (sin salida de error) |
| H1.S1.M3 | Reglas 422 (`SERVICE_REQUEST_DETAIL_*`): muestra sólo en LAB, imagen sólo en IMAGING, catálogo, lado⇒región, contraste⇒tipo | `yarn test service-request-detail` + `service-requests.service.spec` | PASS 11 + 46 tests, tres niveles |
| H1.S1.M4 | Alta y lectura de órdenes diagnósticas devuelven el detalle | `yarn test src/modules/diagnostics src/modules/clinical` | PASS 89 suites / 1020 tests |
| H2.S1.M2 | Lógica pura: árbol de laboratorio por tipo, ficha por modalidad, regiones | `ng test study-order-kind.spec.ts` | PASS 14 tests (correcto/límite/inválido) |
| H2.S2.M2 | Formulario: «Tipo de orden» + panel de laboratorio (tipo→árbol→muestra) + panel de imagen (tipo, estudio, 3D, lado, contraste, ficha) | `ng test analysis-order-block/**` + navegador | PASS 126+ tests; 33/33 chequeos de navegador, 0 errores de consola |
| H2.S2.M3 | Histórico muestra «Sangre venosa» / «Rayos X · Miembro superior · Izquierdo · Sin contraste» | navegador, tras recargar | PASS (`evidencia/recorrido.log`) |
| H2.S3.M3 | Simulador acepta, valida (mismas reglas que la API) y devuelve el detalle | `service-request-category.mock.spec.ts` | PASS |

## A medias
### H2.S1.M1 — Tipos y cliente
- Qué anda: `NewDiagnosticOrder`/`DiagnosticOrder` con los 5 campos; `toOrder` normaliza `null`; el navegador los manda y los lee.
- Qué no anda: no hay spec propio del cliente para los 5 campos.
- Qué falta: un spec de `toOrder` con y sin detalle.
- Dónde quedó: `diagnostics.types.ts`, `diagnostics.client.ts`; compila.

### H2.S2.M1 — `body-region-picker`
- Qué anda: reusa `app-anatomy-viewer`; la lista de 7 regiones y el toque en el modelo eligen lo mismo; 8 tests; verificado en navegador (el visor carga, sin errores).
- Qué no anda: **el 3D no se resalta por región** (sólo la pieza tocada) y alrededor de la mitad de las mallas del atlas no trae región (tocar un órgano suele dar «sin región asignada»). No se probó teclado sobre el visor.
- Qué falta: asignar región a todas las mallas (dato del atlas) para resaltar la región; prueba de teclado.
- Dónde quedó: `shared/components/organisms/body-region-picker/`.

### H2.S3.M1 — Estados M34 y errores por campo
- Qué anda: cargando/vacío/error del histórico (previo) y vacío orientador de «Genético»; un 422 del detalle se muestra y no pierde lo cargado.
- Qué no anda: el error 422 aparece como mensaje general, no asociado al campo (regla 95.3.2).
- Qué falta: mapear `details.field` del 422 al campo.
- Dónde quedó: `analysis-order-block.ts` (`errorDelPedido`).

### H2.S3.M2 — Prueba visual y doble revisión
- Qué anda: 42 capturas (3 viewports × 2 temas, un árbol por tipo); 1ª pasada propia (3 defectos corregidos); 2ª pasada independiente: sin BLOQUEANTE, 4 MAYOR (2 corregidos, 2 abiertos).
- Qué no anda: la recaptura posterior no pasó una tercera revisión.
- Qué falta: nueva pasada independiente; medir contraste del aviso de la ficha.
- Dónde quedó: [`evidencia/doble-revision.md`](./evidencia/doble-revision.md).

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| «Laboratorio» elegible (criterio 3) | DECISION_REQUIRED | Producto: hoy sólo existe la **recomendación de sede** (`Que elija el paciente / Lo hago yo / En este centro`) y con el catálogo actual quedan deshabilitadas. Elegir un laboratorio concreto exige decidir si el médico asigna (RN-11 dice que no concede acceso) |
| Texto clínico de la ficha de imagen | DECISION_REQUIRED | Dirección médica: revisar y dar fuente (regla 97.5.4); hoy dice «borrador interno» en pantalla |
| Clasificación estudio→tipo de laboratorio y estudios genéticos | DECISION_REQUIRED | Dirección médica / producto: validar la clasificación; «Genético» está vacío porque el catálogo no tiene estudios genéticos |
| PRs `dev` y `test` | No pedidos | Sólo se hizo commit y push; el repo exige dos PRs (uno a `dev`, otro a `test` por cherry-pick) cuando se pidan |

## Evidencia
```text
API  yarn typecheck → sin errores
API  yarn test src/modules/diagnostics src/modules/clinical → Tests: 1020 passed (89 suites)
API  yarn test src/common/seed → Tests: 491 passed
Front tsc -p tsconfig.app.json --noEmit / yarn typecheck → exit 0; eslint sobre lo tocado → sin salida
Front ng test analysis-order-block/** + body-region-picker → 8 files passed
Front ng test clinical-record/** + diagnostic-results → 50 files passed
navegador (simulador) → 33/33 PASS · 0 errores de consola (evidencia/recorrido.log)
```
Archivos: `evidencia/*.png`, `evidencia/recorrido.log`, `evidencia/doble-revision.md`, `playwright/orden-tipo-laboratorio-imagenologia.mjs`.

## No cubierto
- **Contra la API real y una base real**: nada (el simulador responde dentro del navegador, no hay tráfico HTTP que mostrar).
- Matriz de autorización negativa del endpoint (otro tenant, rol insuficiente, sin token): no se escribió; el cambio no toca autorización pero sí un endpoint de escritura.
- Deriva modelo↔BD↔ORM (regla 97.2): no se ejecutó; no hay cambio de esquema (las columnas son de v4.2.82) pero no se verificó que la BD viva las tenga.
- Prueba de idempotencia de la mutación (la existente no cambió; no se reejecutó contra la API).
- `yarn build` completo, Playwright de la suite del repo y suite completa del front (se corrió por partes: shared y core pasan salvo specs ajenos inestables, ver Riesgos).
- Teclado y lector de pantalla sobre el visor 3D; contraste medido.
- Flutter / móvil: sin cambios ni verificación.

## Desvíos del plan
Ver «Desvíos del plan» al final de `PLAN.md` (simulador agregado, estado extraído a `order-detail-state.ts`, «Otro estudio» como 3.ª opción, selector de ejecutor reusado, contrato OpenAPI parchado acotado).

## Riesgos residuales
- **Contrato OpenAPI** de la API parcheado a mano sólo en `CreateServiceRequestDto`; el resto del `openapi.json` commiteado está desfasado del código (regenerarlo arrastra +26 rutas y 62 esquemas ajenos). El front registró las 5 claves en `simulator-extensions.ts` («pendientes del contrato»); se borra al regenerar el contrato desde la API desplegada. **Orden de despliegue: API primero**, o la API real rechazará el alta con 400 (`forbidNonWhitelisted`).
- La suite `core/mock` es **inestable en la base limpia** (corrida repetida sin mis cambios: una pasó, la otra falló 2 archivos); los fallos varían entre corridas y los specs pasan aislados con mis cambios.
- El check `check-max-lines` marcaba `analysis-order-block.ts` por encima de su techo antes de este trabajo (683 vs 649); quedó en 721. Otros archivos de mock también superan su techo (ya lo hacían).
- Cada alta de laboratorio/imagen ahora dispara las lecturas del selector de ejecutor (value-sets, vinculaciones, búsqueda de centros).

## Decisiones y ambigüedades
- A1 (ficha de imagen = texto fijo informativo, no notas escritas por el médico), A2 (clasificación interna), A3 (Genético vacío), A4 (se guarda la región, no la pieza), A5 (laboratorio = selector de ejecutor existente), A6 («Otro estudio» como tercera opción): supuestos tomados sin confirmación; ver tabla en `PLAN.md`. Confirmar con el cliente (A1, A4, A5) y con dirección médica (A1, A2, A3).
- No se abrieron PRs porque no se pidieron.
