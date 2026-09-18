# Contexto real — AloVida (portal web `mantra-core-health`)

> Fase 00 · 2026-09-17/18 · rama `justin/refac-ux-profesional` desde `origin/mockup` (`1f8e8bfd`).
> Leyenda: **[O]** observado en ejecución · **[D]** documentado en el repo · **[S]** supuesto · **[?]** desconocido.

## Producto

- **[D]** Plataforma de salud boliviana (AloVida, ex Vitara). Portal web Angular + SSR para
  pacientes, profesionales, organizaciones médicas y administración. Hay app móvil Flutter
  aparte (fuera de alcance).
- **[O]** Zonas: red social pública (`/posts`, directorios públicos), portal del paciente
  (`/dashboard`, `/my-account/*`), trabajo recurrente del profesional (`/schedule`,
  `/medical-records`, `/progress-notes`…), administración (`/administration/*`).
- **[D]** Carácter: **transaccional y de trabajo recurrente** en el área logueada;
  informativo en la parte pública. Datos sensibles: historia clínica, recetas, seguros (PHI).

## Personas y roles

| Rol | Cuenta mock | Tarea principal observada **[O]** |
|---|---|---|
| Paciente | `paciente@alovida.mock` | Ver su próxima cita y pedir una nueva (panel → «Tu próxima cita», «Mis citas») |
| Médica | `medica@alovida.mock` | Atender la agenda del día («Consultas médicas», «Ver mi agenda de hoy») |
| Administración | `admin@alovida.mock` | Organizaciones, personas, terminología |
| Superadmin, Visitador | ver `src/app/core/mock/README.md` | — |

**[?]** No hay datos de uso (frecuencia real, abandono). La priorización usa severidad y
alcance, no puntuaciones inventadas.

## Stack **[O]**

- Angular 21.2 standalone + signals, SSR; CSS plano con tokens REDSAT (`src/styles.css`), sin
  Tailwind. Átomos/moléculas/organismos en `src/app/shared/components/`.
- Yarn 4.18 (`packageManager`), `node_modules` linker en este worktree. **Nunca npm.**
- Pruebas: Vitest 4 vía `ng test`, e2e con `@playwright/test` (1 worker, `E2E_BASE_URL`),
  Cypress heredado.
- Rama `mockup`: interceptor `core/mock/mock-backend.interceptor.ts` contesta toda la API en
  memoria. **No se levanta API ni Docker** (instrucción del propietario).

## Comandos verificados

| Comando | Resultado **[O]** |
|---|---|
| `corepack yarn install --immutable` | OK (4 s) |
| `corepack yarn start --port 4310` | **Fallaba** («proxy.conf.mjs does not exist») → corregido en `8519df72`; ahora sirve en `http://localhost:4310` |
| `corepack yarn ng test --watch=false --include=<spec>` | OK, ver `EVIDENCIAS.md` |
| `yarn lint` · `yarn typecheck` · `yarn build` | se corren en fase 10 |

4200 lo ocupa otra sesión: este trabajo usa **:4310**.

## Restricciones del encargo

- Instrucciones del repo: `CLAUDE.md` (raíz y front), `.claude/rules/*`, `docs/frontend/FABLE_STACK.md`
  (manda sobre el playbook), regla de composición del cliente (§5 `composition-rules.md`).
- Los 9 estados M34 (`ViewState<T>`) son contrato.
- PR contra `mockup`; el merge lo hace una persona.
- Varias sesiones de Claude comparten la máquina: trabajo en worktree propio `wt-refac-ux`.
- Sin despliegue, sin datos de producción.

## Qué ya existía y NO se duplica

El kit pide `INVENTARIO.md`; el repo ya tiene inventarios mejores (ver `docs/frontend/FABLE_STACK.md`
§«Fases 1-3 ya hechas»): `docs/reports/generated/rutas.json` (232 rutas), índice de 458
componentes, `docs/design-system/`, `docs/accessibility/`. `INVENTARIO.md` apunta a ellos y
solo agrega lo observado en esta sesión.
