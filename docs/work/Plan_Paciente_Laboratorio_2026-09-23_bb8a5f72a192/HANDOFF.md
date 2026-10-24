# Handoff — Plan Paciente/Laboratorio

- ID: `Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192`.
- PR: [#607](https://github.com/mdavila-2001/mantra-core-health/pull/607), abierto contra `mockup`, sin merge.
- Rama: `justin/mockup-corr-34-fondo-blanco-ancho-completo`.
- `HEAD` / base: `a43ad2b311e1a69ff708fba5cef1e5a2100bbbc2` (`origin/mockup`). Upstream ya contiene el arreglo de aviso móvil (`9d3f4b54`, PR #598).
- Diff de producto: ninguno. El único archivo de código propio es `playwright/mock-banner-responsive.spec.ts`; verifica cinco rutas activas × siete viewports (35 combinaciones), título exacto, accesibilidad, rótulo y cero intersección con control de tema.
- Auditor oficial actual: copia física aislada, cinco rutas actuales × 4 celdas, 20/20 PASS. Las 20 fotos abiertas y guardadas en `evidence/visual/corr-34-responsive-current-mockup/`; siete capturas de viewport bajo `test-viewports/`.
- Nueva línea base global en copia física aislada: lista actual regenerada de 58 rutas × 4 celdas, actor `medica`, 232 PNG; 22 rojos sólo de scroll horizontal a 375 px. Evidencia duradera: `MetaPrompts/<ID>/evidence-corr34-full-baseline-20260924/`; falta abrir manualmente las 232 fotos, hacer matriz completa como `paciente` e inventariar altas públicas.
- Diagnóstico DOM en tres rutas: viewport 375, documento 380 px; `.app-header__derecha`/avatar termina en x=380. PR #604 está abierto con cambios a `shell-layout` que tocan el header responsive; no editar esos archivos mientras el escritor de ese PR siga activo. La prueba dirigida del directorio reproduce FAIL por scroll y quedó aislada.
- La ruta `/my-account/loyalty` fue retirada/redirect a `/my-account`; no usarla para verificar H5. La lista actual incluye `/my-account/promotions`, que sólo ofrece promociones de farmacias.
- Verificación: typecheck, build y ESLint dirigido PASS; Playwright dirigido PASS; los tres specs rojos históricos (`aviso-de-demora`, `identity-verification`, `shell-layout`) pasan dirigidos; suite completa con un fallo no relacionado de `insurance-analytics.handlers.spec.ts`; lint global falla con 246 errores; carril 19 falla antes de barrer porque falta `localhost:3005/health`.
- H1–H6 siguen parciales/bloqueados por el alcance visual, mock sin backend y dependencias funcionales de otros módulos.
- No se tocó `docs/progress/evidence/lane-34/REPORT.md` ni la matriz global compartida. El incidente de artefactos está en `MetaPrompts/<ID>/INCIDENT.md`.
- CI de PR #607: al 2026-09-24 04:28 UTC, `dependencias`, `e2e` y `verificar` siguen en cola desde 03:56 UTC; revisar su estado. No hacer merge.
- Hay un cambio externo a este plan en `docs/trabajo/2026-09-22-ender-simulador-cabecera/evidencia/antes/latencia-observada-raw.txt`; conservarlo y no incluirlo en el stage.

La evidencia dirigida está en `MetaPrompts/<ID>/evidence-current-mockup-20260924/`; la línea base global está en `MetaPrompts/<ID>/evidence-corr34-full-baseline-20260924/`. No usar capturas antiguas como estado actual. El siguiente trabajo independiente es cerrar actor/rutas públicas y revisar fotos; al desbloquearse `shell-layout`, validar el cambio propietario #604 contra los 22 rojos antes de añadir código a este PR. Dar seguimiento a CI #607 y no hacer merge.
