# Code review — responsive demo notice regression

**Scope del diff:** `playwright/mock-banner-responsive.spec.ts` únicamente.

- El componente global `app-mock-banner` no tiene diff propio en esta rama. La UI actual proviene de `origin/mockup` SHA `a43ad2b311e1a69ff708fba5cef1e5a2100bbbc2` (PR #598 / commit `9d3f4b54`).
- La prueba recorre cinco rutas y verifica el H1 esperado antes de medir, evitando presentar una redirección como evidencia de otra pantalla. `/my-account/loyalty` se excluye porque ya no tiene ruta visual activa en esta base.
- Los 7 viewports × 5 rutas verifican nombre accesible «Datos de prueba», rótulo visible esperado por breakpoint, apertura/cierre y cero intersección geométrica con el control de tema. No toca contratos, datos, estado de negocio ni API.
- No se aceptó un chequeo de intersección con el H1: el rectángulo CSS de su línea incluía espacio tipográfico vacío y daba un falso positivo aunque el texto renderizado no se superponía. Se mantuvo la comprobación del título y la medición contra el control real.
- `corepack yarn eslint playwright/mock-banner-responsive.spec.ts`: PASS; Playwright dirigido: PASS (35 combinaciones); typecheck/build: PASS. La suite completa tiene un fallo de base en `insurance-analytics.handlers.spec.ts`; lint global tiene 246 errores fuera de este diff.
- No existe `.claude/agents/corr-revisor-codigo.md` en este worktree. Se aplicaron manualmente los criterios de `.claude/agents/frontend-reviewer.md`; no se encontró defecto bloqueante en la spec.
