# Ejecución F2/F3 — brief común (31/10/2026, segunda ola)

Orden del usuario: **correr todo en paralelo ya**. Rige `EJECUCION-F0.md` (reglas de commits, evidencia honesta, sin PRs) con estos cambios:

- **`CLAUDE.md` del front se actualizó:** la rama `test` está dada de baja (30/10/2026). **Un solo PR por cambio terminado, hacia `dev`.** Ignorá lo que los documentos del plan dicen de «dos PRs (dev y test)». Igual: no abras PRs; los abre quien coordina.
- **Máquina compartida: 4 CPU y 15 GB.** El codear es en paralelo, pero todo lo pesado va **serializado con un candado**: `flock -w 1800 /tmp/heavy.lock <comando>` para `yarn build`, `ng build`, `ng test`/Vitest/Jest sobre más de una carpeta, `typecheck`, `ng serve` y Playwright (si usás `ng serve` + Playwright, mantené el candado durante la sesión y liberalo al terminar; matá `ng serve` al acabar). Heap: `NODE_OPTIONS=--max-old-space-size=4096` salvo que tu paso lo necesite mayor (build del API: 8192). Corré pruebas por carpeta tocada, no la suite entera. Si un comando tarda más de lo permitido, ponelo en background con `run_in_background` y esperá con Monitor; nunca lo repitas en paralelo.
- **Repos y ramas:** los tres en `claude/busy-dijkstra-5apd55` (sobre `origin/dev`). Varios agentes escriben en el mismo repo a la vez: `git add` SOLO tus rutas, `git pull --rebase --autostash origin claude/busy-dijkstra-5apd55` antes de cada push, y no toques archivos de otro carril (lista abajo). Si un push falla por carrera, repetí el pull y el push.
- **Entorno real:** Postgres 16 (5544), Redis (6390) y API (3010, desde `dist/`) con `bash /tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f0-env/start.sh` / `stop.sh`. La base `salud` ya tiene el módulo 70 aplicado. Cuentas con clave `12345678`: `admin@alovidasalud.com` (SUPERADMIN, 2 organizaciones), `plataforma@alovida.test` (PLATFORM_ADMIN), `medico2org@alovida.test`. Reiniciar la API la afecta a todos: solo quien recompila el `dist/` la reinicia, y avisa en su informe. Si necesitás probar algo sin reiniciar, usá otro puerto con `node dist/src/main.js` y `PORT` distinto.
- **Evidencia:** cada carril escribe su `evidencia-f0/<carril>.md` (en el repo del front, commit solo de ese archivo) con salidas reales; lo que no corrió, «no se ejecutó» y por qué. Nada contra el simulador cuenta.
- Dueños de archivos (nadie más los toca):

| Carril | Repo | Dueño de |
|---|---|---|
| F2-SISTEMA | api | `src/modules/observability/**`, `src/observability/**`, `src/common/filters/**`, `src/orm/observability/**`, `src/main.ts`, `src/app.module.ts` (solo su import), `scripts/observability/**` |
| F2-APP | api | `src/modules/telemetry/**` (excepto lo ya cerrado: solo agregar), `src/common/seed/telemetry-*`, `src/modules/read_models/**` (seed de `frontend_routes`) |
| F2-DATOS | api | `src/modules/data_catalog/**`, `src/modules/system_ops/**`, `src/modules/audit/**` (solo lecturas nuevas) |
| MODELO-2 | model | todo el repo del modelo |
| F3-SISTEMA-FRONT | front | `src/app/features/observability/**` (nuevo), `src/app/core/data-access/observability/**` (nuevo), `src/app/shared/components/organisms/chart-panel/**`, `src/app/core/navigation/navigation.platform.ts`, `src/app/core/navigation/navigation.subgroups.ts`, `src/styles.css` solo tokens de gráfico, rutas nuevas en archivo propio `observability.routes.ts` |
| FRONT-F0-ARREGLOS | front | `src/app/core/observability/**`, `src/app/features/ux-consent/**`, `src/app/features/shell-layout/tenant-menu/**`, `features/insights/insights-shell.*`, `features/auth/**` |
