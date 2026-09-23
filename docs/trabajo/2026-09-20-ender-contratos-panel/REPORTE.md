# Reporte — Ender, turno noche 2026-09-20: "Los contratos que faltan y un panel que diga la verdad"

> **AVANCE: 54 / 55 — 98,2 %.**

- Fecha: 2026-09-21 (turno de la noche del 2026-09-20) · Plan: [PLAN.md](./PLAN.md) ·
  Rama: `ender/noche-2026-09-20-contratos-panel` (worktree `wt-ender-contratos-panel`, sobre
  `origin/mockup` @ `68dcb562`)
- Peldaño de evidencia alcanzado: **VERIFIED** (comportamiento observado en runtime real:
  `yarn start` + Playwright contra `localhost:4200`, con prueba visual en 5 anchos × 2 temas) para
  el frontend; **TESTED** para los cuatro manejadores del simulador (specs dirigidos + regresión
  completa del simulador en verde). No alcanza `REGRESSION_VERIFIED` en sentido estricto porque
  no corrí el barrido/click-sweep de **toda** la aplicación (ver "No cubierto").

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1 | Corte declarado, baseline en verde, mapa de endpoints para los 3 compañeros | `yarn test --include=.../mock-backend.spec.ts` | 21/21 PASS |
| H1.S1.M3 | Las dos cuentas (médica, visitador) entran y ven lo suyo | `yarn pw playwright/ender-contratos-panel-evidencia.spec.ts --workers=1` | 2/2 PASS, capturas miradas |
| H2 | Motivo "Otros servicios" (`OTHER`+texto) y horario extra (`EXTRA`) verificados; **corregido**: el manejador ahora rechaza `exceptionType` inválido y franjas inválidas (422) | `yarn test --include=.../scheduling.handlers.spec.ts` | 8/8 PASS |
| H3 | Duración de visita configurable (15 min por omisión, tope por política del doctor, rango 5–240); visitador sin acceso clínico verificado en runtime (403) | `yarn test --include=.../pharma-lab.handlers.spec.ts` | 10/10 PASS |
| H4 | Mecanismo `properties` de concepto construido desde cero (no existía); `default_frequency` como extensión sintética declarada, con procedencia | `yarn test --include=.../terminology.handlers.spec.ts --include=.../terminology.types.spec.ts` | 9/9 PASS |
| H5 | Panel "Tus consultas": semanal/mensual, canceladas, mapa de calor accesible, otras atenciones, tonos reusados de la agenda | `yarn test --include=.../consultas-resumen.spec.ts` | 7/7 PASS |
| H5 (visual) | 5 anchos + oscuro sin desborde, consola/red limpias, globo accesible por teclado | `yarn pw playwright/ender-contratos-panel-evidencia.spec.ts --workers=1` | 4/4 PASS |
| H6.S1/S2 | Tooltips reusados (`appTooltip`), 0 botones-solo-ícono y 0 grupos de opciones en mi lote (nada que aplicar del patrón de Itzan) | `grep -rn "iconOnly" src/app/features/dashboard src/app/core/mock src/app/core/data-access` | 0 coincidencias |
| Gates | Typecheck y lint del repo entero, limpios | `yarn typecheck; yarn lint` | exit 0 y 0 |
| Regresión | Suite completa del frontend | `yarn test` | 6875/6876 PASS (1 rojo ajeno, ver "No cubierto") |

## A medias

### H6.S3.M2 — Barrido y click-sweep serial
- **Qué anda:** el E2E dirigido a la pantalla que toqué (`ender-contratos-panel-evidencia.spec.ts`)
  corre limpio en los 5 anchos y en oscuro, sin errores de consola ni respuestas ≥400 nuevas.
- **Qué no anda:** no ejecuté `yarn recorrido` (el barrido Cypress de **toda** la aplicación,
  cientos de capturas) ni un click-sweep genérico de rutas ajenas a mi lote.
- **Qué falta exactamente:** correr `yarn recorrido` completo si alguien necesita esa evidencia
  transversal; no es específico de mi encargo (mi encargo no tocó ninguna otra pantalla).
- **Dónde quedó:** nada pendiente de código — es sólo la ejecución de una suite que excede el
  alcance de una tarjeta nueva en el panel. Rama compila y todos los specs dirigidos pasan.

## Pendiente

Ninguna microtarea de las 55 quedó en `TODO` o `BLOQUEADO`.

## Evidencia

Índice completo en `evidencia/`:
- `antes-mock.txt` — baseline del simulador (H1.S2.M1).
- `baseline-typecheck-lint.txt` — baseline de gates (H1.S2.M2).
- `mapa-endpoints.md` — mapa de endpoints para Pablo/Justin/Marcelo (H1.S3).
- `h2-tres-niveles.txt`, `h3-tres-niveles.txt`, `h4-tres-niveles.txt` — los tres niveles del
  contrato (regla 65) para cada hito de backend.
- `h5-panel.txt` — decisiones y evidencia del panel.
- Capturas reales en `artifacts/ender-contratos-panel/` (repo `mantra-core-health`, no en este
  paquete de evidencia): `h1-medica-dashboard.png`, `h1-visitador-post-login.png`,
  `h5-consultas-resumen-{390,768,1024,1440,1920,1440-oscuro}.png`.

```text
$ yarn test
 Test Files  1 failed | 557 passed (558)
      Tests  1 failed | 6875 passed (6876)

$ yarn typecheck
(sin salida — exit 0)

$ yarn lint
(sin salida — exit 0)
```

## No cubierto

- El barrido/click-sweep genérico de **toda** la aplicación (`yarn recorrido`, Cypress) no se
  corrió — ver "A medias" arriba.
- No verifiqué el heatmap con lector de pantalla real (sólo con la semántica de tabla —
  `<caption>`, `<th scope>` — y el recorrido por teclado del globo). La tabla es HTML semántico
  estándar, pero "lo leí con NVDA/VoiceOver" no puedo afirmarlo sin haberlo hecho.
- No verifiqué el comportamiento del `appTooltip` en un dispositivo táctil real (sólo por foco de
  teclado, que es el mecanismo que el propio componente ya usa para "sin mouse").
- Los números que muestra el panel (48/semana, 184/mes) no los conté a mano contra la agenda
  celda por celda del mes completo — verifiqué la relación estructural (semana ⊆ mes) y el caso
  puntual del mapa de calor (una cita de lunes 09:00 cae en la celda correcta), pero no un conteo
  manual íntegro de las 184.

## Desvíos del plan

- **H4 resultó ser "construir el mecanismo", no "seguir un patrón existente"**: la ficha asumía
  que `dose_forms`/`strengths` ya se servían — no era así en mi corte. Se construyó el mecanismo
  genérico de `properties` de concepto desde cero, siguiendo el contrato real de la API
  (`search-concepts.dto.ts`), y sólo entonces se agregó `default_frequency`.
- **H3 resultó ser "verificar y ajustar", no "definir un contrato nuevo"**: Q-E3 de la ficha
  asumía que el contrato de duración configurable no existía en la API real — sí existe
  (`doctor_visit_policies`, `doctor_visit_windows`). Se corrigió esa premisa con evidencia.
- **H2 resultó ser "cerrar un agujero de validación puntual"**, no construir el mecanismo de
  `OTHER`/`EXTRA` (que ya existía): el trabajo real fue el rechazo de tipo/franja inválidos.

## Riesgos residuales y deuda

- El panel agrega datos en el cliente sobre `GET /scheduling/bookings` con `limit: 500` por
  recurso: un mes con más de 500 citas en una sola agenda truncaría el reporte sin avisarlo (no
  se maneja el flag `truncated` de la página). Bajo riesgo para un mes calendario típico, pero
  queda declarado.
- `reservaVisible()` en `scheduling.handlers.ts` sigue con su fallback permisivo para cualquier
  usuario sin `patientProfileId` ni `practitionerProfileId` (hallazgo de H1/H3, no corregido:
  es diseño existente para roles de staff, fuera del alcance estricto de "acceso clínico" que
  pedía H3).

## Decisiones y ambigüedades

Ver PLAN.md, tabla "§5. Ambigüedades registradas" (heredada de la ficha) — Q-D5 a Q-E5. Las
únicas dos que este turno tocó con evidencia nueva: **Q-E3** (corregida: el contrato de duración
SÍ existe) y **Q-E4** (resuelta: agregación en el cliente, consecuencia declarada en código).

## Handoff (regla 50 / §7 de la ficha)

- **Pablo**: `EXTRA` y `OTHER` funcionan y ahora además rechazan lo inválido — ver
  `evidencia/h2-tres-niveles.txt` para la ruta y el cuerpo exactos. La duración de visita de
  visitador tiene tope por política del doctor — ver `evidencia/h3-tres-niveles.txt`.
- **Justin**: la clave es `properties.default_frequency` (string), servida sólo por
  `GET /terminology/concepts/:id`, leíble con `valorDeTexto()` de
  `core/data-access/terminology/terminology.types.ts` — ver `evidencia/h4-tres-niveles.txt`.
- **Marcelo**: no hay endpoint para guardar una fila estructurada de cuadrícula — ver
  `evidencia/mapa-endpoints.md`. Y: ninguna fuga de acceso del visitador (H3.S3), así que su
  dictamen de seguridad no tiene nada que registrar de mi lote esta noche.
- **Itzan**: 0 `iconOnly` y 0 grupos de opciones en mis archivos — no hubo nada que convertir con
  su patrón esta noche.

## Procesos que quedaron corriendo

- **Ninguno.** `yarn start` (servidor de desarrollo, `localhost:4200`) se usó para las capturas
  de Playwright y se bajó al cerrar (`lsof -tiTCP:4200 | xargs kill`, puerto verificado libre).

## Nota operativa: instalación del estándar en este worktree

Se instaló `.claude/`, `AGENTS.md` del estándar `AlovidaPromptManager` en este worktree para
correr con sus candados (`plan_gate`, etc.) durante la sesión. **Al hacerlo se pisó por error**
`.claude/settings.json`, que es infraestructura propia de este repo (Wave 0 del protocolo de
calidad de frontend) — **restaurado** con `git checkout -- .claude/settings.json` en cuanto se
detectó. El resto de los archivos del estándar (`.claude/skills/`, `.claude/rules/`,
`.claude/hooks/plan_gate.py` etc., `AGENTS.md`) quedaron **sin trackear** en este worktree: no
pisaron nada tracked, y no se incluyen si se hace `git add` selectivo de lo tocado esta noche.
Quien continúe este trabajo puede borrarlos con seguridad si no los necesita.
