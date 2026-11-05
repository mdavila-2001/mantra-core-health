# ADR-0018: AloVida Insights como portal propio con contrato híbrido y gráficos SVG propios

## Estado

**Propuesto** — 2026-10-30. Documenta decisiones tomadas por el solicitante y su
evidencia; se acepta cuando el contrato tenga implementación real en el API.

## Contexto

AloVida Insights nació como una sección de Administración con datos sintéticos
generados en el navegador (`docs/trabajo/2026-10-30-alovida-insights/`). El solicitante
definió que es **un portal de marketing, de alcance plataforma**, que debe parecerse al
prototipo entregado (`AloVida_Insights.html`) y que debe tener **endpoints dedicados**
en el API y en la base.

## Decisión

1. **Portal propio en `/insights`**, fuera de `ShellLayout`, con `authGuard` y
   `seccionRolesGuard` y los roles en la propia ruta (`SUPERADMIN`, `PLATFORM_ADMIN`,
   `DATA_PLATFORM_ADMIN`, `MARKETING_MANAGER`; nunca `BUSINESS_ADMIN`). Precedente: `/reports`.
2. **Contrato híbrido** bajo `/marketing/insights/*` (módulo 50 `marketing`, sin esquema nuevo):
   el API sirve **hechos** (diarios y por hora, publicaciones, catálogo) para Campañas, Embudo,
   Uso de la app y Redes, y el front sigue calculando KPI, benchmarks y estados con su dominio
   probado (`null ≠ 0`, `minSample`); y sirve **agregados resueltos** para Opinión, Observatorio
   y Alertas. Toda respuesta lleva `meta` (`dataset` demo/live, `asOf`, `cutoff`, `window`,
   `notice`, `notMeasured`) para que el dato demo se declare y el estado S7 tenga fecha.
3. **El dominio no inventa datos**: sin catálogo ni hechos instalados está vacío
   (`installCatalog`, `installFacts`). El marco carga con `InsightsData` y no pinta ninguna
   pantalla hasta que el estado es `ready` o `stale`.
4. **Gráficos SVG propios**: no se migra a ECharts. [ADR-0017](ADR-0017-echarts-chart-library.md)
   está en estado Propuesto y acota ECharts al portal de reportería; migrar Insights sería una
   reescritura masiva sin necesidad.
5. **Series de color = `--chart-1..6`**. Medido con `validate_palette.js` (dataviz, orden fijo):
   - `--chart-1..8` sobre `#FFFFFF` (claro) y sobre `--bg-surface` (oscuro): comprobaciones de
     banda de luminosidad, croma, separación en daltonismo y visión normal en **PASS**; aviso de
     contraste < 3:1 en `#1baf7a`, `#eda100`, `#e87ba4` (claro) y `#008300` (oscuro).
   - La paleta anterior (derivada de la marca con `color-mix`) **FALLABA** en claro y en oscuro:
     diferencia de color entre vecinas de 5,9 a 7,6 (mínimo exigido: 15).
   - Por el aviso de contraste, cada serie lleva rótulo directo y tabla equivalente.

## Consecuencias

- El mismo contrato sirve al simulador (`core/mock/handlers/insights.handlers.ts`) y al API.
  Los tipos de respuesta GET se escriben a mano en `core/data-access/insights/insights.types.ts`;
  el catálogo de contrato del simulador solo cubre cuerpos de petición, así que la deriva se
  vigila con las pruebas del simulador y con una suma de control del generador que el modelo debe
  reproducir.
- `MARKETING_MANAGER` está sembrado como rol con alcance de tenant: el API resuelve el acceso de
  plataforma sin `tenant_id` en las tablas `insights_*` y se verifica con pruebas de los guards
  (A-1 del plan).

## Evidencia

- Plan: `docs/trabajo/2026-10-30-alovida-insights-portal/PLAN.md`.
- Validación de paleta: salida del validador citada arriba (2026-10-30).
