# Agentes — AloVida Insights como portal propio

Brief para agentes en paralelo. Plan completo: [PLAN.md](./PLAN.md).

## 0. Qué y por qué
Llevar AloVida Insights a un portal propio (`/insights`), con la semántica del prototipo y endpoints
dedicados en el módulo 50 `marketing`. Autorización de paralelismo: ver `CLAUDE.md`.

## 1. Ya existe (no se reescribe)
`src/app/features/insights/` (dominio probado, gráficos SVG, 8 módulos), `features/reporting/reporting-access.ts`
(acceso a portales), `core/mock/` (simulador por URL), `core/view-state/` (nueve estados).

## 2. Propiedad de archivos (disjunta)
| Carril | Dueño de |
|---|---|
| A · marco del front | `insights-shell.*`, `insights-context.ts`, `insights-portal.route.ts`, `components/` compartidos, `reporting-access.ts`, `portal-selector/` |
| B1…B5 · módulos | una carpeta de `features/insights/modules/<m>/` por agente |
| C · API | `src/modules/marketing/**` (repo `mantra-core-health-api`) |
| M · modelo | `diagram_50_marketing.puml`, `salud-db/**`, `seedsGenerales/**` (repo `mantra-core-health-model`) |

Nadie toca `app.routes.ts`, `styles.css`, `package.json` ni `navigation.map.ts` sin avisar al carril A.

## 3. Reglas de la casa
Usted en el texto visible; identificadores nuevos en inglés; archivos ≤ 600 líneas; sin colores literales;
`null ≠ 0` con motivo; datos declarados como de ejemplo; nueve estados `ViewState`; claro y oscuro;
390/768/1440 sin desborde.

## 4. Cómo se verifica
`corepack yarn ng test --include '<ruta>'` (con `NODE_OPTIONS=--max-old-space-size=6144`; antes,
`node scripts/generate-component-index.mjs && node scripts/generate-env.mjs`), `yarn typecheck`, `yarn lint`,
los `check-*` que correspondan. **Prohibido** abrir navegadores, `ng serve` o `ng build`: eso lo hace el revisor.
No se hace commit ni push.

## 5. Informe final
Unas 40 líneas: qué archivos, qué pruebas, qué peldaño (`WRITTEN`/`TESTED`, nunca «funciona»), qué falta.
