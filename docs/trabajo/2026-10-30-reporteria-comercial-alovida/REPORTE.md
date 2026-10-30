# Reporte — Portal de reportería de Alovida (maqueta del front)

> **AVANCE: sin porcentaje.** El plan de este trabajo no está descompuesto en microtareas con estado, así que no hay un `HECHO / total` que calcular y no se inventa uno. Lo que sigue es qué hay, con qué evidencia y qué no se verificó.

- Fecha: 2026-10-30 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/focused-lamport-mufj3h` (repo `mantra-core-health`)
- **Peldaño de evidencia (regla de la casa 30):**
  - Lógica, estado y presentación de lo tocado: `TESTED` (pruebas dirigidas).
  - Build de producción: `RUNS` (el pre-push compiló con salida 0 en cada push).
  - Comportamiento en navegador de lo capturado: `VERIFIED_FUNCTIONAL_ONLY` en lo que se observó; **no** `REGRESSION_VERIFIED`.
  - Revisión independiente, tres pasadas (visual, código, regresión). **Ninguna ha aprobado este estado:**
    - Visual: FAIL 67 → 74 → 82/100. La última tuvo un alto (cascadas móviles aplastadas) que resultó ser evidencia vieja (las capturas claras no se habían regenerado tras el ajuste); se corrigió y se vio en la recaptura, pero **no** se repitió la revisión independiente. Los tres medios que quedaban se revisaron después, **sin nueva revisión independiente** (la mirada es mía): (1) nombres truncados en barras horizontales móviles: **corregido** (con 7 categorías o menos el nombre se parte en dos líneas; con más se trunca con 130 px en vez de 110 y el tooltip lo dice entero); recaptura móvil claro de «CAC por canal», «Costo de cada promoción» y «Los 10 clientes»: los nombres se leen enteros salvo dos de los diez clientes, que siguen truncados; tableta sin cambios visibles. (2) etiquetas partidas en la cascada de referidos de escritorio: **no reproducido** en la recaptura (rótulos inclinados y legibles). (3) leyenda sobre el aro de un donut móvil: **no reproducido** en ocho donuts revisados en móvil claro y oscuro (no se revisaron todos).
    - Código: aprobable, sin bloqueantes; tres medios (cabecera tabulable bajo la hoja, Tab del menú, afirmación excesiva en este reporte) corregidos.
    - Regresión: no emite REGRESSION_VERIFIED. En el árbol de esa pasada: tipos, lint, 3108 pruebas y `ng build` pasaron; falló `check-english-identifiers` por una prueba mía (ya corregida) y `app.routes.ts` creció; `pw:rutas` y `pw:accesos` quedaron **bloqueados**: exigen la API real viva y aquí solo hay la maqueta.
- Alcance: **maqueta con datos de EJEMPLO declarados en pantalla**. No hay API de reportería real conectada.

## Completado (con evidencia)

| Qué | Comando / evidencia | Resultado |
|---|---|---|
| Pruebas dirigidas de reportería, panel de gráficos, mock, auth, sesión y estado de vista | Vitest directo sobre 34 archivos | 578 pruebas en verde (última corrida completa; después se añadieron pruebas de gráficos y pasaron las de ese archivo) |
| Typecheck de app, specs, playwright y cypress | `tsc --noEmit` de los cuatro proyectos | salida 0 |
| Lint de `src/` y del spec de capturas | `eslint` | sin errores |
| Regla 29 (identificadores en inglés) contra la base | `CHECK_ENGLISH_BASE=93d37a57 node scripts/check-english-identifiers.mjs` | OK |
| Recorrido en navegador: 3 viewports × claro/oscuro, estados (vacío, error, sin permiso, atrasado) en los 3 viewports y los 2 temas, interacciones de escritorio, teclado y asistente en móvil | `playwright test playwright/reporteria-capturas.spec.ts --workers=1` | 35/35 pasan; capturas en `evidencia/capturas/` |
| Consola y red del recorrido | `evidencia/consola-red.json` (con metadatos y pruebas ejecutadas) | solo los 24 errores **forzados** de los estados «error» y «sin permiso» |

**Lo que el navegador comprobó en teclado (y solo eso):** en escritorio, el foco llega al campo del asistente al abrirlo; `Enter` abre el menú «Más» y el foco entra en la primera opción; `Tab` lo cierra y deja el foco en «Más»; `Escape` en «Ver en grande» no cierra el asistente. En móvil, con el asistente abierto: `main` y `nav` quedan inertes y 8 `Shift+Tab` y 12 `Tab` seguidos no sacan el foco de la hoja (salvo hacia el aviso «Datos de prueba» de la maqueta, que se excluyó a propósito).

## A medias

### Capturas no revisadas una por una
- Qué anda: las capturas que revisé a ojo (selector, grid en tableta, suscripciones completa en tableta, medidores y etiquetas en escritorio claro, publicidad en móvil oscuro, comisiones en escritorio oscuro, embudo móvil, negativos, teclado) se ven correctas tras los arreglos.
- Qué no anda / no se verificó: el resto de las pestañas en escritorio oscuro y en móvil, y varios estados, no los miré uno por uno en la última recaptura.
- Qué falta: revisar esas capturas o repetir la revisión visual independiente sobre la recaptura final. La última revisión visual independiente dio FAIL y sus dos hallazgos altos (cascada de referidos con rótulos pisados en escritorio y «Sin dato» solapado en mapas de calor móviles) se corrigieron **después**: se vio a ojo la cascada móvil y el mapa de calor de escritorio, pero no se repitió la revisión independiente.
- Dónde quedó: capturas regeneradas en `evidencia/capturas/`; código compila y las pruebas pasan.

## Pendiente

| Qué | Estado | Qué lo destraba |
|---|---|---|
| Integración con la API real de reportería | `BLOQUEADO` | Que exista la API (H0 del plan) |
| Velas, filtros y cálculos contra datos reales | `BLOQUEADO` | Datos reales de suscripciones, publicidad y comisiones (A-7) |
| Definición del módulo de publicidad push/pauteo | `DECISION_REQUIRED` | Negocio (A-2) |
| Reglas de comisión por actor | `DECISION_REQUIRED` | Negocio y cumplimiento (A-4) |

## No cubierto

- Los scripts e2e `.mjs` y los de Cypress que adapté para aceptar `/portal-selector` solo se comprobaron con `node --check` y `tsc`; **no se ejecutaron**.
- Teclado completo de todo el portal y lector de pantalla: solo los casos del recorrido de teclado. Contraste: medido con cálculo para las celdas del mapa de calor (≥ 4,5:1); el resto, a ojo.
- Capturas de interacciones en tableta y móvil (salvo el asistente en móvil), y teclado fuera de escritorio claro.
- `yarn pw:rutas` y `yarn pw:accesos`: **BLOQUEADOS** (intentados contra la maqueta: ambos exigen la API real viva). Cypress no se ejecutó. `ng build` lo corrió el auditor (salida 0) y el pre-push en cada push.
- Gráficos con muchas categorías en móvil (p. ej. «Del cobro al neto a recibir»): etiquetas inclinadas ajustadas, no reverificadas una por una.
- Integración real: todo es mock.
- Texto de las fechas de cohorte («2026-05») sigue en ISO.

## Desvíos del plan

- Se agregó Apache ECharts como librería de gráficos (ADR-0017), porque no había ninguna en el front.
- El alcance «Plataforma» se ofrece solo a `SUPERADMIN` y `PLATFORM_ADMIN`; el PLAN lo pedía y la primera versión lo ofrecía a todos.

## Riesgos residuales y deuda

- Datos de ejemplo con inconsistencias entre tarjetas (el MRR del resumen y el total de «Resumen por plan» no coinciden; la tabla «Alertas» solo lista filas «Normal»).
- `ChartThemeService` duplicado con la lectura de tema dentro de cada panel de gráficos; cada panel observa el `<html>`.
- `app.routes.ts` ya estaba sobre el techo de líneas (2273) y creció de 2398 a 2435 por las rutas `portal-selector` y `reports`.
- Un servidor de desarrollo con una reconstrucción fallida sigue sirviendo el bundle anterior sin avisar: parte de las capturas intermedias se tomaron así y se repitieron; la evidencia vigente se tomó tras comprobar en el log que la compilación terminó sin errores.
- Gates `check-*` que ya fallaban en la base siguen fallando; no empeoraron por este trabajo salvo `check-doc-coverage` (corregido) y `check-max-lines` (corregido).

## Decisiones y ambigüedades

- **A-2, A-3, A-4, A-6, A-7** del PLAN siguen abiertas; supuestos tomados: ver `PLAN.md` §7.
- `REPORTING_ADMIN` **no** ve el alcance «Plataforma» (supuesto; confirmar con negocio).
- Los administradores con los dos accesos aterrizan en el selector de portal en vez de `/dashboard`; hay que confirmarlo con producto.
