# Ejecución F0 — brief común para los agentes (31/10/2026)

Orden del usuario: **ejecutar el plan, todo sobre `dev`, con las respuestas recomendadas** (las de la columna «Supuesto» de `PLAN.md` §6: U-1…U-14 se dan por aceptadas). Leé `PLAN.md`, el documento de tu frente y `CONTEXTO-COMUN.md`.

## Reglas
- Ramas: en los tres repos (`/home/user/mantra-core-health`, `-api`, `-model`) ya estás en `claude/busy-dijkstra-5apd55`, **ya al día con `origin/dev`**. Trabajá ahí. No cambies de rama.
- **Archivos disjuntos**: tocá solo los de tu carril (abajo). Si necesitás otro, no lo edites: anotalo en tu informe.
- Commits: `git add` de **rutas concretas** (nunca `-A`), mensajes en español, y terminan con:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_01Ni1UViQ8vNwGrKZtV5TLNU`.
  Antes de empujar: `git pull --rebase origin claude/busy-dijkstra-5apd55`; luego `git push origin claude/busy-dijkstra-5apd55`. Otros agentes empujan al mismo repo: reintentá si falla por carrera.
- **No crear PRs** (el usuario no los pidió todavía). No tocar `main/master/dev/test`.
- Yarn 4 PnP: `corepack yarn …`; nada de npm. Identificadores de código en inglés, texto de usuario en español con «usted» (ver `CLAUDE.md` del front).
- `NO_TEST_WEAKENING`: no borrar ni relajar pruebas para que pasen. Cada cambio con su prueba (caso válido, límite, inválido y **autorización negativa** cuando toque auth).
- Evidencia honesta: escribí en tu informe qué corriste y la salida real; lo que no corriste, «no se ejecutó». Un solo navegador de pruebas a la vez en toda la sesión: **si necesitás Playwright, usá `flock /tmp/pw.lock <comando>`**.
- Entorno real: el agente INFRA publica `evidencia-f0/ENTORNO.md` (Postgres 16 local sin Timescale + API en marcha). Cuando exista, verificá contra él; si no existe aún, hacé pruebas unitarias y reintentá al final.
- Informe final ≤ 25 líneas: qué cambió (archivos), qué corrió y resultado, qué no, qué quedó para otro carril.

## Carriles (dueños de archivos)
| Carril | Repo | Dueño de |
|---|---|---|
| INFRA | api, model (solo scripts en `/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f0-env/` y `evidencia-f0/` del front) | levantar Postgres y la API |
| API-ALCANCE | api | `src/common/tenant/**`, `src/common/auth/**`, `src/modules/ops_console/**`, `src/modules/iam/**` solo si imprescindible |
| API-TELEMETRIA | api | `src/modules/telemetry/**`, `src/common/seed/telemetry-*`, `src/common/constants/concepts.ts` (solo ids nuevos), `.env.coolify.example`, `docker-compose.coolify.yml` |
| FRONT-ALCANCE | front | `src/app/core/auth/**`, `src/app/core/http/**`, `src/app/features/auth/**`, `src/app/features/portal-selector/**`, `src/app/features/reporting/**`, `src/app/core/data-access/reporting/**`, `src/app/app.routes*.ts`, `src/app/features/dashboard/**`, `src/environments/**`, `proxy.conf*`, `playwright/support/sesion.ts` y specs de entrada |
| FRONT-TELEMETRIA-PALETA | front | `src/app/core/observability/**`, `src/app/features/privacy*/` o donde viva el consentimiento, `src/styles.css`, `src/app/core/tokens/**`, `scripts/check-chart-palette.mjs`, `scripts/lib/validate_palette.js`, `scripts/gates*`, `docs/adr/ADR-0017*` |
