# Contratos, organismos y propietarios

No se modificó ni creó ningún contrato, endpoint o cliente.

| Capacidad de la fuente | Consumidor observado | Dueño/dependencia | Resultado de esta ejecución |
|---|---|---|---|
| Orden y oferta por estudio | `diagnostic-orders`, `laboratory-directory`, `laboratory-detail` | Médico y catálogo de Laboratorio | Vistas visibles con datos mock; oferta comparada contra orden real no evaluada |
| Turno y preparación | `appointments`, ficha de laboratorio | Agenda y Laboratorio | Modo laboratorio muestra estado sin horarios; no se reservó ni se modificó capacidad |
| Cobertura | `diagnostic-orders` | Aseguradora | Liquidaciones de muestra visibles; sin API real |
| Resultado, archivos y factura externa | `diagnostic-results`, órdenes diagnósticas | Laboratorio, archivos/notificaciones y emisor externo | Lista y controles visuales visibles; persistencia, factura y permisos no probados |
| Puntos y beneficios | `loyalty`, `promotions` | Comercial y dueño de beneficios | Puntos informa que no hay programa activo; promociones se refieren a farmacias |

## Composición de las rutas fotografiadas

| Ruta | Componentes observados | Límite de la verificación |
|---|---|---|
| `laboratory-directory` | `app-directory-page` compone encabezado, filtros y `app-view-state-host`; mapa y tarjetas de resultado son componentes reutilizados. | El resultado visual se midió; no se comprobó disponibilidad contractual de los centros. |
| `laboratory-detail` | `app-page-header`, `app-view-state-host`, `app-card`, `app-section-heading`, `app-fact-list`, `app-badge`. | La sede fue un fixture sintético del simulador. |
| `appointments` | `app-page-header`, calendario, filtros/campos, `app-badge`, `app-alert`; las citas usan artículos de dominio con acciones. | Sin horarios de laboratorio reales. No usa `app-data-table` porque el calendario/listado es responsivo e interactivo. |
| `diagnostic-orders` | `app-page-header`, `app-badge`, liquidación de seguro y alertas; cada orden agrupa preparación, liquidación y acciones. | Tarjetas de dominio, no tabla. La rama de lista vacía usa `app-alert`; la captura de muestra no activa esa rama. |
| `diagnostic-results` | `app-page-header`, `app-badge`, controles de descarga/compartir y alertas; cada resultado agrupa metadatos y acciones. | La rama sin resultados usa `app-alert`; la captura de muestra no activa esa rama. |
| `loyalty` | `app-page-header`, `app-view-state-host` (emite `app-empty-state` cuando no hay membresía), `app-badge`. | Estado vacío visible y revisado; no hay programa activo. |
| `promotions` | `app-page-header`, `app-view-state-host`; la tarjeta de promoción usa `app-card` y `app-badge`. | Estado vacío visible; no hay promoción de laboratorio activa. |

`app-tabs` no corresponde a estas pantallas de consulta/reserva, y `app-file-input` no aparece en este recorrido. Las ramas vacías de órdenes y resultados requieren una captura con el estado correspondiente para verificar su presentación. Como ambas vistas y sus clientes se comparten con otros planes, cualquier sustitución de `app-alert` por `app-empty-state` queda pendiente de dueño único y no se hizo en esta rama.

## Auditoría de colisión

Se revisaron los worktrees pertinentes (`wt-citas-paciente`, `wt-patient-plan`, `wt-patient-run-2026-09-24`, `wt-tema-toggle`, `wt-imagenologia`). No se encontraron diffs de producto en los archivos objetivo. `wt-patient-run-2026-09-24` contiene documentación no versionada de cierre, no código de estas vistas; `wt-tema-toggle` estaba limpio. El registro `.claude/runtime/lane-34-claim.json` es histórico (actualizado el 2026-09-14 y referido a PR #457), no identifica al responsable actual de estos archivos. Un árbol limpio no demuestra que otro agente no tenga trabajo en curso, así que no se atribuye la propiedad de edición y no se tocaron las vistas compartidas.

El alcance del usuario y `AGENTS.md` también prohíben cambios a `mantra-core-health-api/` y `mantra-core-health-model/`.
