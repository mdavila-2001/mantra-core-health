# Matriz — Paciente en el circuito de Laboratorio

La matriz funcional completa y la trazabilidad exclusiva de fuente están en el plan bajo `MetaPrompts/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/`. Los escenarios H1–H6 no pasan a DONE por una captura de datos simulados.

## Línea base global actual de CORR-34

Se regeneraron 58 rutas desde `navigation.map.ts` y se midieron 232 celdas con `medica@alovida.mock` en una copia aislada del HEAD `44a7df250467f8d3675c5f15a234b4d422f4686a` (producto `a43ad2b`). 22 filas fallan únicamente por scroll horizontal a 375 px; los demás criterios pasan. Las fotos no están revisadas manualmente y faltan la pasada por actor `paciente` y altas públicas. Ver [informe y matriz](../../../../MetaPrompts/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/evidence-corr34-full-baseline-20260924/GLOBAL-BASELINE-REPORT.md).

El problema reproducido en `/laboratory-directory` proviene del encabezado común (`scrollWidth=380` a 375 px). PR #604 es dueño de cambios sobre el mismo `shell-layout`; no hacer un segundo cambio paralelo.

## Evidencia visual actual de la regresión global del aviso

| Ruta | Viewports | Resultado dirigido | Evidencia |
|---|---|---|---|
| `/laboratory-directory` | 320, 375, 390, 768, 1024, 1440, 1920 | Cero intersección con control de tema; rótulo corto/completo correcto | `evidence/visual/corr-34-responsive-current-mockup/test-viewports/` |
| `/my-account/appointments` | 7 viewports | PASS; H1 verificado | Spec Playwright; auditor oficial actual |
| `/my-account/diagnostic-orders` | 7 viewports | PASS; H1 verificado | Spec Playwright; auditor oficial actual |
| `/my-account/diagnostic-results` | 7 viewports | PASS; H1 verificado | Spec Playwright; auditor oficial actual |
| `/my-account/promotions` | 7 viewports | PASS; H1 verificado | Spec Playwright; auditor oficial actual |

La spec corre cinco rutas × siete viewports. El auditor oficial midió 375/768/1440 claro y 1440 oscuro: 20 celdas, cero rojos. Abrimos manualmente las 20 fotos; la [matriz](evidence/visual/corr-34-responsive-current-mockup/MATRIZ-visual.md) y el [log](evidence/visual/corr-34-responsive-current-mockup/RUN-LOG.md) son de `mockup` SHA `a43ad2b311e1a69ff708fba5cef1e5a2100bbbc2`.

Ocho capturas 1440 `fullPage` de rutas de cuenta muestran el menú fijo encima del contenido largo; quedan como diagnóstico del formato de captura. Las 7 capturas de viewport muestran el encabezado/aviso con su tamaño real. `/my-account/loyalty` no se cuenta: la base actual redirige a `/my-account` (N-03/Q-17). Su lugar en el conjunto actual lo ocupa `/my-account/promotions`.

El arreglo del banner llegó en el upstream por PR #598 (`9d3f4b54`). Esta rama no modifica `src/app/core/mock/mock-banner.ts`; sólo agrega la regresión y sus documentos/evidencia. El barrido global de 54 rutas/216 celdas es histórico de SHA `b7785e3` y no se afirma como medición de la base actual.
