# FABLE — ataduras a este repositorio

El playbook (`FABLE_FRONTEND_REFACTOR_PLAYBOOK.md`) está escrito para un stack
React/Tailwind/npm genérico. **Este repositorio no es eso.** Esta página es la
traducción obligatoria: cuando el playbook y esta página discrepen, **manda esta
página**.

Verificado contra el repo el 2026-09-08.

## Diferencias de stack

| El playbook dice | Acá es | Consecuencia |
|---|---|---|
| React | **Angular 21.2** standalone + señales | `frameworks-react` y el `component-refactoring` de React **no aplican**. Dueño canónico de ingeniería de framework: skill `angular-architect`. |
| Tailwind + CVA | **CSS plano, 188 custom properties** | `tailwind-design-system` **no aplica**. Los tokens son `--c-*`, `--sp-*`, `--r-*`, `--fs-*`… (`docs/design-system/tokens.md`). |
| npm | **Yarn 4.18 PnP** | Nunca `npm install`, nunca `package-lock.json`. |
| `npm run lint/typecheck/build` | `yarn lint` · `yarn typecheck` · `yarn build` · `yarn test` | `typecheck` corre tres proyectos `tsc`. `test` es Vitest 4 (860 pruebas en 77 archivos). |
| Instalar Playwright | **Ya está**: `@playwright/test` + 18 specs en `playwright/` | Reusar el arnés (`yarn pw`, `yarn pw:baseline`, `yarn pw:rutas`, `yarn pw:accesos`). El MCP es para exploración interactiva, no para reemplazarlo. |
| Estados idle/loading/error | **Nueve estados M34 contractuales** (`ViewState<T>`) | Ver `docs/adr/ADR-0005-view-state-m34.md`. Son contrato, no sugerencia visual. |
| Push a `dev` | **Bloqueado** | `gh pr merge` y auto-merge están cerrados; el merge exige revisión humana. El flujo FABLE termina en **abrir el PR**. |
| CI valida | **CI caído** (runner propio) | Los `check-*.mjs` se corren a mano. |

## Fases 1-3 del playbook: ya hechas

El playbook pide construir inventario, design system, matriz de rutas y matriz
de componentes. **Ya existen y son mejores que sus plantillas.** Crearlos otra
vez bajo `docs/frontend/` sería el `ARCH-DUPLICATE` que el propio playbook
prohíbe (sección 16 Regla 1, sección 53).

| Artefacto que pide FABLE | Dónde está ya |
|---|---|
| `INVENTORY.md` | `docs/index.md` + `docs/reports/generated/` |
| `DESIGN_SYSTEM.md` | `docs/design-system/` (tokens, colors, spacing, typography, responsive-design, themes, motion, icons, principles) |
| `ROUTE_MATRIX.md` | `docs/routes/route-catalog.md` + `docs/reports/generated/route-inventory.md` |
| `COMPONENT_MATRIX.md` | `docs/components/catalog.md` + `docs/reports/generated/component-inventory.md` |
| Gate de accesibilidad | `docs/accessibility/` + `audit-report.md` |
| Estrategia de pruebas | `docs/testing/` (incluye `visual-regression.md`, `recorrido-visual.md`) |

Lo único que FABLE agrega de nuevo: **`REFACTOR_DAG.md`**, **`VISUAL_BASELINE.md`**
y **`evidence/`**.

## Dueño canónico por capacidad

Una sola autoridad por capacidad, para que dos skills no se contradigan:

```text
dirección visual      -> frontend-design (Anthropic, oficial)
ingeniería Angular    -> angular-architect (fullstack-dev-skills)
sistema de diseño     -> project-design-system (local; docs/design-system/)
evidencia navegador   -> @playwright/test del repo + Playwright MCP
gates de calidad      -> visual-quality-gate + frontend-production-gate (locales)
revisión de código    -> code-review (oficial)
seguridad             -> security-guidance (oficial)
```

## No instalado a propósito

El playbook lista Impeccable, frontend-skills y Taste. **No se instalaron.**
Su propia sección 86 exige revisar repo, README, LICENSE, SKILL.md, hooks,
scripts, `package.json`, MCP y permisos antes de instalar software de terceros,
y la 85 advierte contra acumular colecciones de skills visuales que se
contradicen.

Además:

- `npx impeccable install` ejecuta código de terceros no auditado sobre este
  repositorio, en un proyecto con datos clínicos.
- `frontend-skills` publica una skill llamada `frontend-design` que **colisiona**
  con la oficial de Anthropic, que acá es la autoridad primaria (sección 93).
- Taste solapa con Impeccable y con `frontend-design`.

Si se decide incorporarlos, hacerlo en una franja separada (`TOOLING-001`),
nunca durante una franja de refactor.

Los comandos `/impeccable`, `/critique`, `/polish`, `/adapt`, `/harden`,
`/audit`, `/layout`, `/typeset`, `/clarify` y `/optimize` **no existen** en esta
instalación. Los equivalentes disponibles hoy: `/code-review`, `/simplify`,
`/security-review`, `/frontend:design-review`.
