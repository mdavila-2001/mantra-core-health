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

- MRR de los datos de ejemplo, **corregido y medido** (30 d y 12 m, BOB y USD): la tarjeta MRR de Suscripciones, la del Resumen, el último punto de ambos gráficos, el «MRR final» de la cascada y el total de «Resumen por plan» dan la misma cifra. Dos defectos reales: (1) el total de «Resumen por plan» difería de la tarjeta por un centavo en 30 d (490.068,66 frente a 490.068,67) porque sumaba filas redondeadas, y la prueba lo toleraba con 0,05; ahora el residuo se asigna a la fila mayor y la prueba exige igualdad exacta y que las filas sumen el total. (2) El gráfico de MRR del Resumen dibujaba una trayectoria inventada distinta de la de su propia tarjeta (día 29: 487.714 frente a 490.294); ahora reutiliza la serie y las velas de Suscripciones (si esa pestaña no la trae o no cierra en el KPI, cae a la trayectoria propia, que ya estaba probada). Sin las correcciones las pruebas nuevas fallan (7 casos); con ellas pasan. Capturas de escritorio claro: ambos paneles idénticos. **Alcance de la verificación:** la prueba de la tabla recorre 12 contextos (los de 7 d, con las dos monedas y los dos alcances); 30 d y 12 m los medí con una sonda descartable (alcance plataforma, sin filtros). **No medido:** contextos con filtros activos, y 90 d / año a la fecha.
- Sigue abierto: la tabla «Alertas» solo lista filas «Normal».
- El «Ingreso» de suscripciones del Resumen (481.682,17 en 30 d) es ingreso reconocido (Σ MRR diario ÷ 30), no MRR: es otra cifra y se rotula distinto; no se tocó.
- `ChartThemeService` duplicado con la lectura de tema dentro de cada panel de gráficos; cada panel observa el `<html>`.
- `app.routes.ts` ya estaba sobre el techo de líneas (2273) y creció de 2398 a 2435 por las rutas `portal-selector` y `reports`.
- Un servidor de desarrollo con una reconstrucción fallida sigue sirviendo el bundle anterior sin avisar: parte de las capturas intermedias se tomaron así y se repitieron; la evidencia vigente se tomó tras comprobar en el log que la compilación terminó sin errores.
- Gates `check-*` que ya fallaban en la base siguen fallando; no empeoraron por este trabajo salvo `check-doc-coverage` (corregido) y `check-max-lines` (corregido).

## Decisiones y ambigüedades

- **A-2, A-3, A-4, A-6, A-7** del PLAN siguen abiertas; supuestos tomados: ver `PLAN.md` §7.
- `REPORTING_ADMIN` **no** ve el alcance «Plataforma» (supuesto; confirmar con negocio).
- Los administradores con los dos accesos aterrizan en el selector de portal en vez de `/dashboard`; hay que confirmarlo con producto.

## Ronda de cierre (30/10, tarde): revisión independiente y correcciones

Peldaño alcanzado: **`TESTED` + `VERIFIED_FUNCTIONAL_ONLY` sobre la maqueta** (datos de EJEMPLO, sin API real). No es `REGRESSION_VERIFIED`: la suite completa no terminó en dos intentos (ver más abajo).

**Cambios de esta ronda.** Resumen explicado para entender la monetización (secciones por pregunta, mapa «quién paga, por qué y cuánto aporta», economía unitaria, glosario); seis indicadores a la vista y el resto en «Más indicadores»; tablas de pocas filas en tarjetas en móvil; mapa de calor con todas sus etiquetas; cascada angosta con la leyenda arriba; «Resumen por plan» con cuentas y MRR del mismo corte y total igual a la tarjeta (sin filtro de plan).

**Revisión independiente (quien implementa no aprueba).**
| Ronda | Revisor | Veredicto | Qué se corrigió después |
|---|---|---|---|
| 1 | Visual | REJECT móvil (3 altos) | Tablas con cifras fuera de pantalla, mapa de calor sin etiquetas, cascada pisando la leyenda |
| 1 | Código | REJECT (1 alto) | «Resumen por plan» se contradecía con un filtro de plan; lectura rápida con comparación y «más cae» incorrectos; pruebas que no probaban lo que decían |
| 1 | Regresión | NOT_VERIFIED (sin regresión hallada) | Faltó navegador y suite completa (ver No cubierto) |
| 2 | Código | APPROVE_WITH_NOTES | Total del plan filtrado rotulado; roles de tabla y foco en el modo tarjeta; pruebas de `report-table`, de la lectura con una sola fuente y de las fórmulas del glosario |
| 2 | Visual | Móvil APPROVE_WITH_NOTES · escritorio REJECT (1 alto) | Alto corregido: las celdas de texto ya no se parten en tablas de 8 columnas o más (la clave no queda fuera de vista) y se avisa del desplazamiento; las tablas en tarjetas no se cortan en vertical; tarjetas solo si filas ≤ 12 y filas × columnas ≤ 60; rótulos de mapas de muchas columnas |

**Tras la última corrección no hubo una tercera revisión independiente.** Lo corregido se verificó con pruebas y con capturas que miré yo; eso no es aprobación de un tercero.

**Evidencia de esta ronda.** `tsc` (app y spec) sin salida; ESLint de reportería sin salida; 677 pruebas dirigidas en verde (32 archivos); `check-css-tokens` y `check-english-identifiers` (base 2a7afe19) en verde; recaptura completa de las 35 pruebas de `playwright/reporteria-capturas.spec.ts` contra la maqueta en modo demo (6 recorridos incluida tableta, 2 de interacciones, 20 de estados, teclado, asistente, autorización negativa). Build de producción del pre-push en cada push anterior.

**No cubierto (se suma a lo anterior).**
- Suite completa de `ng test`: en la auditoría de regresión terminó con el servicio de esbuild muerto (ENVIRONMENT) tras ~5 min, dos intentos; los fallos que mostró antes de morir son de otros features y no se reprodujeron en aislado. `pdf-theme.spec` falla y no toca este cambio.
- Gates rojos de otros módulos (`check-colores-sueltos`, `check-usted`, `check-max-lines`): preexistentes por inferencia (ningún archivo señalado está en el diff); no se corrieron contra la base.
- Tablas con muchas columnas (Campañas, Anuncios con peor costo, Catálogo de indicadores) siguen necesitando desplazamiento lateral; hay aviso, pero la columna clave no siempre se ve sin deslizar.
- Con un filtro de plan activo, la tarjeta «MRR» y la tabla «Resumen por plan» no coinciden (la tabla muestra solo ese plan; la fila se llama «Total del plan filtrado»). La causa está en el modelo de suscripciones, no en este cambio.
- Lectores de pantalla (VoiceOver, NVDA) y el comportamiento real de `display: block` sobre tablas en el modo tarjeta: no se probaron.
- Sin API real: nada de esto prueba persistencia ni autorización del servidor. Siguen abiertas las decisiones de negocio A-2 (publicidad), A-4 (comisiones), alcance de `REPORTING_ADMIN` y destino del administrador tras el login.
- Los 11 KPI del Resumen están en datos; la pantalla muestra 6 y el resto en «Más indicadores». Los sparklines de las tarjetas dentro del `<details>` cerrado no se verificaron al abrirlos.
