# Defectos reportados (nunca arreglados por Marcelo)

| A quién | Qué | Severidad | Captura / pasos | Clase (regla 80.4) | Estado |
|---|---|---|---|---|---|
| Justin | Contraste insuficiente en `.carga__nota` (`src/app/features/admin/terminology/version-import/version-import.css:134-138`): `color: var(--text-muted)` sobre fondo blanco da **4,27:1**, WCAG 2 AA exige **4,5:1** para texto normal de 12px. Afecta 4 párrafos de la pantalla: la nota de la plantilla, `importar-tope`, la nota de habilitación de «Importar» y `carga-sin-resultado`. Hallado por `axe-core` (`color-contrast`, `serious`) corriendo contra la pantalla real con la cuenta `admin@alovida.mock`. | MAYOR | `evidencia/h3/simulado.txt` test 11 · `artifacts/playwright/salida/carga-masiva-Carga-masiva--7a459--critical-backend-simulado--chromium/axe-violaciones.json` | `PRODUCT_BUG` (reproducido con `axe.run`, no es de mi cambio: `--text-muted` es un token del sistema, probablemente afecta otras pantallas que lo usan para texto de 12px) | Reportado 2026-09-25, sin corregir |

## Notas

- El resto de la pantalla (17 `data-testid` del contrato, anti doble envío, descarga de plantilla y de errores, rechazo de PDF por `accept`, mensaje de 503 del simulador) se ejercitó sin hallazgos: 10/11 tests del contrato pasan limpio (`evidencia/h3/simulado.txt`).
- La regla del carril es reportar, no corregir: este archivo es la entrega a Justin. El test 11 (`carga-masiva.spec.ts`) queda intencionalmente en rojo hasta que se corrija el token o la excepción se acepte con justificación — silenciarlo debilitaría la aserción (regla 00 §4.2).
