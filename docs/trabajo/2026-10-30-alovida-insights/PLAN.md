# Plan — AloVida Insights (plataforma de inteligencia de marketing)

- Fecha: 2026-10-30 · Repos afectados: `mantra-core-health` (frontend) · Predecesor: ninguno · Hermano: `docs/trabajo/2026-10-30-reporteria-comercial-alovida/PLAN.md` (rama `claude/focused-lamport-mufj3h`, sesión de reportería comercial)
- **Peldaño de evidencia (regla 30): `DISCOVERED`.** Se actualiza en `REPORTE.md` a medida que haya salida real.
- Resultado observable: un gerente de marketing entra a `/marketing/insights`, ve los 8 módulos de AloVida Insights en una carcasa SaaS con la línea gráfica ALOVIDA, filtra campaña / periodo / canal / métrica / horario, recibe la visualización recomendada con su razón, ve cada KPI con actual · benchmark · target · estado, abre la evidencia de cada insight y navega de una alerta al módulo donde se investiga.
- Kill-test: elegir un periodo sin datos → ningún KPI muestra `0`, muestra «Sin evidencia suficiente»; cambiar de tema claro/oscuro → ningún gráfico queda ilegible; la misma campaña muestra la MISMA cifra de conversiones en Campañas, Embudo y Alertas.

## Alcance
- IN: feature `src/app/features/insights/` (dominio, datos sintéticos, gráficos SVG, componentes, 8 módulos), una sección de navegación, una ruta, pruebas del dominio y de componentes, capturas.
- OUT: backend/API, esquema, conectores reales a Meta/TikTok/Google, IA real (la capa de interpretación se simula con reglas deterministas y se declara), cualquier edición de `src/styles/alovida.css` (generado) y del archivo de reportería de ventas.
- Datos: **100 % sintéticos y declarados como tales** en pantalla (regla de datos de la casa). Ninguna cifra se presenta como dato real de AloVida.

## Decisiones técnicas registradas
| ID | Decisión | Motivo / dónde vive el patrón |
|---|---|---|
| D-1 | Gráficos en **SVG propio**, sin librería nueva | `package.json` no trae librería de gráficos y regla 95.1.4 exige ADR para introducirla. Los gráficos se pintan solo con tokens (sin hex). La sesión de reportería de ventas propone ECharts por ADR-0017 en su rama; si se aprueba, Insights puede migrar sin tocar dominio ni módulos porque los gráficos reciben datos ya medidos. |
| D-2 | Color de series **derivado de tokens existentes** (`--brand-primary`, `--brand-secondary`, `--brand-accent`, `color-mix`) | Cambian solos en oscuro; no se toca `styles.css` ni `alovida.css`. Ámbar ≤ 10 % y un único punto de acción por pantalla (reglas de marca). |
| D-3 | Estados `ViewState<T>` (ADR-0005) en cada módulo | Contrato de la casa; S1≠S2, S5≠S6. |
| D-4 | `null` ≠ `0` en todo KPI; tasa con numerador y denominador; `minSample` | Mismo criterio que `AtlasDashboards` y la reportería comercial. |
| D-5 | Recomendador de visualización = función pura con razón escrita | Testeable; la recomendación es la opción por defecto y se puede cambiar. |
| D-6 | Capa «IA» = reglas deterministas que separan DATO / INTERPRETACIÓN / HIPÓTESIS / CONCLUSIÓN y declaran confianza | No hay modelo en el prototipo; se declara. |

## Ambigüedades registradas
| ID | Pregunta | Supuesto | A quién |
|---|---|---|---|
| A-1 | ¿Insights vive en el mismo portal de reportería que construye la otra sesión? | No: sección propia `marketing/insights`, para no pisar su navegación. Se unifican después. | Pablo |
| A-2 | Benchmarks sectoriales | No hay fuente verificada: se rotulan «referencia interna de prototipo», nunca «sectorial real» | Marketing |
| A-3 | Rol de acceso | `MARKETING_MANAGER`, `PLATFORM_ADMIN`, `DATA_PLATFORM_ADMIN` (los de `Analítica web`) | Pablo |

## H1 — Cimientos: dominio, datos y recomendador
**CA:** Dado el conjunto sintético, cuando se calcula cualquier KPI de una campaña, entonces el resultado coincide entre módulos y un periodo vacío devuelve `null` con motivo.
**DoD:** `yarn vitest run src/app/features/insights` en verde (pegar salida).

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.S1.M1 | Tipos y catálogo de métricas (qué decisión permite, qué significa si sube/baja) | spec del catálogo | TODO |
| H1.S1.M2 | Generador determinista de hechos diarios y por hora | spec de coherencia y determinismo | TODO |
| H1.S1.M3 | Cálculo de KPI con `null` y `minSample` | spec casos válido / límite / inválido | TODO |
| H1.S2.M1 | Sistema de benchmarks (5 fuentes) y estados (óptimo…sin evidencia) | spec de umbrales | TODO |
| H1.S2.M2 | Recomendador de visualización con razón | spec por métrica y contexto | TODO |
| H1.S3.M1 | Detector de anomalías y generador de alertas | spec | TODO |

## H2 — Gráficos SVG y componentes
**CA:** Cada gráfico responde una pregunta, se lee sin color (marcadores, etiquetas directas), ofrece alternativa tabular y respeta `prefers-reduced-motion`.
**DoD:** specs de componente + capturas claro/oscuro.

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H2.S1.M1 | Línea/área con benchmark, target, umbrales y tooltip | spec | TODO |
| H2.S1.M2 | Barras (horizontal/vertical/apiladas/100 %) | spec | TODO |
| H2.S1.M3 | Embudo, heatmap (día×hora, cohortes) | spec | TODO |
| H2.S1.M4 | Dispersión con tendencia, histograma, caja | spec | TODO |
| H2.S2.M1 | Tarjeta KPI (compact/standard/expanded), insight, alerta, evidencia | spec | TODO |

## H3 — Carcasa y módulo 01 Campañas
**CA:** Dado el filtro (campaña, periodo, canal, métrica, horario, visualización), cuando cambia la métrica, entonces se recomienda un gráfico con razón y el usuario puede cambiarlo; comparar campañas funciona sin reconstruir la pantalla.
**DoD:** typecheck + lint + vitest + capturas 390/768/1440 × claro/oscuro.

## H4 — Módulos 02 a 08
Embudo y Journey · Uso de la app · Redes · Opinión pública · Informes · Observatorio · Alertas.
**CA por módulo:** responde SU pregunta; cada insight trae confianza y trazabilidad; cada alerta enlaza al módulo.

## H5 — Verificación y cierre
`yarn typecheck`, `yarn lint`, `yarn test` (dirigido), `yarn build`, `node scripts/check-*.mjs` aplicables, capturas miradas, `REPORTE.md`.

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Conflicto de archivos con la rama de reportería (navegación, rutas) | merge manual | Cambios en un archivo de navegación propio + una línea de spread; avisar a la otra sesión |
| Gráficos propios sin la riqueza de ECharts | menos interactividad | Alcance acotado a lo que el brief exige; datos desacoplados del gráfico |
| Sobre-afirmar | reporte engañoso | Peldaño declarado por área, «No cubierto» explícito |
