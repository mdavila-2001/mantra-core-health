# Plan — Carril 08: corrección sobre visuales generales (fondo reactivo)

- Fecha: 2026-10-25 · Repos afectados: `mantra-core-health` · Predecesor: TAREA-08 v4.3 (2026-09-02) y la decisión del propietario del 2026-09-10 («fondo blanco»)
- **Nota de proceso (desvío declarado):** este plan se escribió **después** del primer cambio de código, no antes (§2.1). La primera versión del trabajo se hizo y se subió (PR #1328 y #1331) sin plan en disco; este archivo regulariza el trabajo y cubre las correcciones posteriores a la revisión de un compañero.
- Ficha fuente: `tareas/TAREA-08-visuales-generales.md` **no existe** en ningún repo del equipo. Se trabajó contra `requirements.md` del carril. Eso es una ambigüedad abierta (ver Decisiones en el reporte).

## Alcance
Dentro: la regla de opacidad de las dos capas de celeste (`body::before`, `body::after`) en modo claro, en `src/styles/alovida.css`; la evidencia y los documentos del carril.
Fuera: el runtime (`alovida-runtime.service.ts`), el modo oscuro, la gota (`html::after`), el carril 34 («fondo blanco ancho completo»).

## H1 — En modo claro el fondo descansa blanco y el celeste aparece con el puntero

**CA (dado / cuando / entonces)**
- Dado el tema claro y el puntero en reposo, cuando se carga cualquier pantalla, entonces el fondo es blanco y las capas de celeste tienen opacidad 0.
- Dado el tema claro, cuando el puntero se mueve, entonces el celeste aparece y vuelve a 0 al quedar quieto.
- Dado `prefers-reduced-motion: reduce`, entonces el fondo queda fijo y blanco.
- Dado cualquier estado del fondo, entonces el texto sobre él cumple WCAG 2.2 AA (≥ 4,5:1) con margen.
- Dado el tema oscuro, entonces nada cambia.

### H1.S1 — La regla de opacidad
- **H1.S1.M1** Derivar la opacidad de `--fondo-presencia`. DoD: `getComputedStyle(body,'::before').opacity` = `0` en reposo y `0.3` con el puntero activo.
- **H1.S1.M2** Tope de opacidad con margen de contraste. DoD: peor caso teórico de `--tinta-3` ≥ 4,7:1 **y** medición sobre píxeles reales ≥ 4,5:1.

### H1.S2 — Requisitos del carril
- **H1.S2.M1** REQ-004 gota de agua visible. DoD: diferencia de píxeles con clic vs. sin clic (control) en instantes sucesivos, y captura.
- **H1.S2.M2** REQ-005 no bloquea. DoD: `pointer-events: none` y un `input` recibe foco y texto con el efecto activo.
- **H1.S2.M3** REQ-006 reduced-motion. DoD: opacidad 0 tras mover el puntero.
- **H1.S2.M4** REQ-007 rendimiento. DoD: intervalo entre cuadros (p95 ≤ 20 ms) en reposo y moviendo.

### H1.S3 — Cobertura de pantallas y temas
- **H1.S3.M1** Modo oscuro sin cambios y visto en pantalla con el botón real del tema.
- **H1.S3.M2** Móvil (390), tablet (768) y desktop (1440): sin scroll horizontal, scroll vertical, consola limpia; foco de teclado visible.

### H1.S4 — Pruebas y regresión
- **H1.S4.M1** Spec oficial `playwright/lane-08-reactive-background.spec.ts`. DoD: corre en verde. **Bloqueo previsto:** exige la API real (`apiViva`).
- **H1.S4.M2** Suite completa: comparar con la base limpia (sin el cambio), mismo commit base, índice de componentes regenerado.
- **H1.S4.M3** `yarn lint` y `yarn typecheck` en 0.

### H1.S5 — Gates de entrega
- **H1.S5.M1** Dos revisiones independientes (`visual-reviewer`, `frontend-reviewer`) sobre el diff final.
- **H1.S5.M2** Salida literal de `gh pr view … --json isDraft,mergeable,mergeStateStatus` y `gh pr checks` de cada PR.
- **H1.S5.M3** `REPORTE.md` en `docs/trabajo/` dentro del repo, con las secciones del §2.2.

## Riesgos y bloqueos previstos
- La API real no está levantada en local: H1.S4.M1 queda `BLOQUEADO-EXTERNAL` salvo que se levante.
- La suite completa tiene fallos previos y tests inestables: se compara contra la base, no contra «cero».
- El CI propio del repo está caído (`CLAUDE.md`): los checks de GitHub pueden no existir.
