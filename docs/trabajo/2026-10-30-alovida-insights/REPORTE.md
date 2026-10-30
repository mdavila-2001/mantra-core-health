> **AVANCE: 9 / 24 — 37,5 %.** (microtareas `HECHO` / total; las 14 `A MEDIAS` y la 1 `BLOQUEADO` no suman). Los 8 módulos existen y se ven en el navegador; lo que no está cerrado es la prueba de interfaz (ver «A medias»).

# Reporte — AloVida Insights (plataforma de inteligencia de marketing)

- Fecha: 2026-10-30 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/laughing-cori-5afynm` (`mantra-core-health`)
- Peldaño de evidencia alcanzado, **por área** (regla 30):
  - Dominio (cálculo, datos sintéticos, benchmarks, alertas, informe): `TESTED` — 59 pruebas en verde.
  - Plantillas y tipos de toda la interfaz: `RUNS` — `ngc`, `eslint` y `ng build` de producción con código de salida 0.
  - Interfaz de los 8 módulos: `VERIFIED_FUNCTIONAL_ONLY` **parcial** — se miraron capturas y se ejercitaron 3 flujos, pero no están las tres anchuras × dos temas de cada módulo ni hay prueba de componente.
  - **El trabajo, por la regla del peldaño más bajo de sus áreas en alcance: `RUNS`.** No se usa «listo», «cerrado» ni «hecho» para este trabajo.

## Qué se construyó

`src/app/features/insights/`, accesible en `/administration/marketing-insights` (sección «Marketing» del menú de Administración; roles `MARKETING_MANAGER`, `PLATFORM_ADMIN`, `DATA_PLATFORM_ADMIN`).

| # | Módulo | Pregunta que responde |
|---|---|---|
| 01 | Resumen de campañas | ¿Cómo funcionó nuestra campaña? |
| 02 | Embudo y experiencia del paciente | ¿Convertimos y entregamos una buena experiencia? |
| 03 | Uso de la app (mapa de calor, funciones, pantallas, cohortes, eventos) | ¿Qué hacen realmente nuestros usuarios? |
| 04 | Redes sociales (solo datos objetivos) | ¿Qué pasa objetivamente en nuestras redes? |
| 05 | Opinión pública (sentimiento, temas, mapa de atributos, señales de búsqueda, departamentos con representatividad, cuota de voz, cola de respuesta, prensa) | ¿Qué dice la gente y cómo se siente? |
| 06 | Generador de informes (tipo → alcance → audiencia → contenido → vista previa; imprimir/PDF y CSV) | ¿Cómo convertimos datos en conocimiento comunicable? |
| 07 | Observatorio de salud (siete preguntas por elemento) | ¿Qué pasa en el ecosistema de salud? |
| 08 | Alertas (🔴 crítico · 🟠 riesgo · 🟡 anomalía · 🔵 oportunidad, con estado vista/resuelta y reglas de nivel visibles) | ¿Qué requiere nuestra atención ahora? |

Transversal: recomendador de visualización con razón escrita (línea para tendencias, barras para ranking, embudo, mapa de calor, dispersión, histograma/caja, cohortes, apiladas; sin tarta ni dona), cinco fuentes de benchmark y cinco estados de salud, capa de interpretación que separa DATO / INTERPRETACIÓN / HIPÓTESIS con confianza y trazabilidad, `null` ≠ 0 con motivo, tasas desde sumas, estado en la URL, vistas guardadas, exportación CSV.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Tipos y catálogo de 21 métricas (decisión, qué pasa si sube/baja, acción, responsable) | `vitest run --config …` | PASS · [vitest.txt](./evidencia/vitest.txt) |
| H1.S1.M2 | Hechos diarios y por hora deterministas; los eventos inyectados reconcilian | ídem | PASS |
| H1.S1.M3 | KPI con `null` y `minSample`; tasas desde sumas; alcance único estimado | ídem | PASS |
| H1.S2.M1 | Benchmarks (5 fuentes) y estados de salud | ídem | PASS |
| H1.S2.M2 | Recomendador de visualización con razón | ídem | PASS |
| H1.S3.M1 | Detección de cambios y alertas de campaña, opinión y oportunidad (`report.spec.ts` comprueba IDs únicos, causa como hipótesis y evidencia en toda alerta) | ídem | PASS |
| H5.S1.M1 | `ngc` exit 0, `eslint` exit 0, gates de diseño sin hallazgos propios | ver «Evidencia» | PASS |
| H5.S1.M2 | `ng build` de producción | `node_modules/.bin/ng build` | exit 0 · [build-produccion.txt](./evidencia/build-produccion.txt); sin avisos de presupuesto de archivos de Insights |
| H5.S1.M4 | Este reporte | — | archivo en disco |

## A medias

Las 14 comparten el mismo vacío: **no hay prueba de componente y la prueba visual está incompleta**. Cada una con sus cuatro respuestas:

### H2.S1.M1–M4, H2.S2.M1 — Gráficos SVG y componentes (5)
- Qué anda: línea/área (tooltip, zoom, referencias, teclado, tabla alternativa), barras, embudo, mapa de calor, dispersión, histograma/caja, apiladas; tarjeta KPI en 3 densidades, insight, alerta, estados. Se ven bien en 1440 px claro y oscuro. La matemática (`chart-math`) tiene 9 pruebas.
- Qué no anda: nada roto que yo haya visto; **ningún componente tiene prueba propia**, no hay prueba de teclado ni de lector de pantalla.
- Qué falta exactamente: specs de componente con el arnés de Angular (`ng test`), prueba de foco/teclado en el selector de gráfico y en el control de líneas, revisión con lector de pantalla.
- Dónde quedó: `src/app/features/insights/charts/` y `components/`; compila.

### H3.S1.M1 — Carcasa y registro (1)
- Qué anda: menú de 8 módulos, filtros en la URL, vistas guardadas, ruta y navegación registradas (`navigation.insights.ts`, 2 líneas en `navigation.map.ts`, 1 subgrupo, 3 líneas en `app.routes.ts`).
- Qué no anda: no se abrió ni se probó el cajón del menú en móvil con el dedo/teclado; en 390 px solo se vieron capturas.
- Qué falta: prueba del cajón móvil, 768 px mirado, navegación por teclado completa.
- Dónde quedó: `insights-shell.*`, `insights-context.ts`.

### H3.S1.M2 y H4.S1.M1–M3, H4.S2.M1–M4 — los 8 módulos (8)
- Qué anda: cada módulo carga sin errores de consola ni respuestas 4xx/5xx (16 cargas: 8 módulos × {390 px claro, 1440 px oscuro}), se ve en 1440 px claro, sin desborde horizontal de la página en 390 y 768 px. Flujos ejercitados en el navegador: resolver una alerta persiste al recargar (9 → 8 → 8), el filtro por severidad aplica, cambiar el contenido del informe cambia la vista previa (7 → 8 secciones) y atender una mención la saca de la cola.
- Qué no anda: nada conocido. Defectos que sí encontré y corregí al mirar: etiquetas del eje X pisadas, rótulo del eje Y sobre una marca, controles segmentados recortados en 390 px, etiqueta final de la línea cortada por la tarjeta, pocos hallazgos de opinión por muestra pequeña.
- Qué falta: capturas de 768 px **miradas** de todos los módulos, 390 px miradas de todos menos Observatorio, oscuro de todos menos 01 y 05, estados vacío/error/carga fotografiados (los `ViewState` existen; solo el vacío de la cola se vio), prueba de impresión a PDF real.
- Dónde quedó: `modules/*`, compila.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H5.S1.M3 `ng test` completo | BLOQUEADO (ENVIRONMENT) | `ng test` se queda sin memoria en este contenedor (4985 pruebas); destraba un entorno con más memoria. Los specs de Insights corrieron con un Vitest suelto, no con el arnés del repo |

## Evidencia

Todo en [evidencia/](./evidencia/):

```text
build-produccion.txt  ng build de producción → exit 0
vitest.txt            59 pruebas pasan (4 archivos: domain, opinion, report, chart-math)
ngc.txt               ngc -p tsconfig.app.json --noEmit → exit 0 (avisos ajenos a Insights)
eslint.txt            eslint src/app/features/insights + navigation.insights.ts → exit 0
gates-diseno.txt      check-css-tokens, check-tokens, check-contrast, check-colores-sueltos, check-max-lines, check-usted
flujos-navegador.txt  alertas 9→8→8 tras recargar; informe 7→8 secciones; sin errores de consola/red
desborde-390-768.txt  scrollWidth == viewport en 8 módulos × {390, 768}
capturas/             10 capturas (1440 claro ×8, 1440 oscuro ×2, 390 claro ×1)
```

Gates de diseño: `check-css-tokens` ✓ (529 tokens, sin huérfanos), `check-tokens` ✓, `check-contrast` ✓ (158 combinaciones), `check-usted` sin hallazgos en Insights. `check-colores-sueltos` y `check-max-lines` marcan archivos **ajenos** (`drawer-panel.css`, `summary.ts`, `thread.html`, `today-agenda.css`, `navigation.types.ts`) y `app.routes.ts`, que **ya estaba por encima de su techo** (2397 líneas en la base `30d0c041`, techo 2273); mi cambio añade 4 líneas a ese archivo. Ningún archivo de Insights supera 600 líneas.

## No cubierto

- Pruebas de componente y de integración con el arnés de Angular; teclado y lector de pantalla.
- 768 px, 390 px y tema oscuro de la mayoría de los módulos **mirados**; estados de error, carga y sin permiso fotografiados.
- Impresión real a PDF (la regla `@media print` está escrita; no se abrió el diálogo de impresión).
- Render en servidor (SSR) de la ruta: el build de producción pasa, pero no se pidió la página al servidor SSR (la ruta usa `localStorage` y `window` con guardas).
- Peticiones reales: **no hay backend**; todo el dato es sintético. Nada demuestra persistencia `UI → request → response → recarga` (regla del repo) porque no hay petición; lo único persistente es `localStorage` (vistas guardadas, estado de alertas), y solo se ejercitó el de alertas.
- Matriz de autorización negativa: la restricción por rol es del mapa de navegación; no se probó con un usuario sin rol.
- Dos PRs (a `dev` y a `test`): no se abrieron; la instrucción del repo los pide al terminar un cambio y este no está terminado.

## Desvíos del plan

- Gráficos en SVG propio (D-1) en vez de ECharts de ADR-0017: se mantiene; no se introdujo ninguna librería.
- La capa «IA» son reglas deterministas (D-6), declarada en pantalla.
- Se añadió lo que el plan no listaba: `stat-tile`, cola de respuesta con estado local, estado de alertas en `localStorage`.

## Riesgos residuales y deuda

- **Todo el dato es sintético.** Una persona que no lea el aviso (visible en cada pantalla) podría tomar una cifra por real. Los competidores son «Competidor A/B/C» a propósito; el Observatorio no cita fuentes porque inventarlas sería falsificar.
- Los umbrales de alerta (−20 / −45 puntos de sentimiento, ×2 de volumen, 40 menciones mínimas) son decisión mía, no de negocio.
- Las metas por métrica están marcadas «propuesta, pendiente de ratificar».
- `app.routes.ts` ya incumplía su techo de líneas; mi aporte es de 4 líneas.
- La sesión hermana de reportería comercial **nunca respondió** a mis mensajes: tomé sus decisiones de su `PLAN.md` y evité sus archivos. Es probable un solapamiento de navegación al fusionar las dos ramas.

## Decisiones y ambigüedades

| ID | Qué se decidió sin confirmación | A quién confirmárselo |
|---|---|---|
| A-1 | Insights vive en `/administration/marketing-insights`, sección propia, no en el portal de reportería de la otra sesión | Pablo |
| A-2 | Benchmark sectorial: no hay fuente verificada; se rotula «referencia interna de prototipo» | Marketing |
| A-3 | Roles de acceso = los de «Analítica web» | Pablo |
| A-4 | Cuota de voz con competidores genéricos y observatorio ilustrativo, hasta que haya una fuente de monitoreo y una fuente oficial | Marketing / Dirección |
| A-5 | Umbrales de las alertas de opinión (ver «Riesgos residuales») | Marketing |
