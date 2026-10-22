# Plan — Ocultar «Mis cuestionarios» del menú del paciente

- Fecha: 2026-09-25 · Repo: `mantra-core-health` · Rama: `pablo/ocultar-cuestionarios-2026-09-25`
- Corte: `origin/mockup` @ `3663ef40d0f5d163d49ae32b01f8bbbbf6bbbc00`
- Origen: pedido directo del propietario — sacar la sección de la vista del paciente sin borrar
  nada, porque todavía no está decidido qué hacer con ella.
- Resultado observable: al entrar como paciente, el menú lateral ya no muestra «Mis cuestionarios».
  La ruta, el guard y la pantalla siguen funcionando si se entra por enlace directo.
- Kill-test: `curl`/inspección del menú renderizado para un `PATIENT` no lista «Mis cuestionarios»;
  `grep` de `MIS_CUESTIONARIOS_ROUTE`/`questionnaires.routes.ts` sigue existiendo sin cambios.

## Alcance
- IN: la entrada `my-account/questionnaires` en `src/app/core/navigation/navigation.map.ts`; un
  `.md` nuevo documentando la decisión pendiente.
- OUT: el módulo `features/account/questionnaires/**` entero (no se toca ni una línea); la entrada
  `questionnaires` (sin `my-account/`, del lado del profesional — «Encuestas», otra pantalla
  distinta); `app.routes.ts`; `navigation.subgroups.ts` (es metadata de agrupación, no de
  visibilidad — no necesita cambio, confirmado leyendo `navigation.service.ts:79-92`).

## H1 — Ocultar sin borrar
**CA:** Dado un paciente con sesión, cuando abre el menú, entonces «Mis cuestionarios» no aparece
como renglón; la ruta sigue resolviendo si se entra por URL directa.
**DoD:** `ng test --include=.../navigation.service.spec.ts --watch=false` verde (no debería
necesitar un test nuevo: `fueraDelMenuPara` ya está cubierto por la suite existente del servicio) +
`yarn typecheck`.
**Estado:** HECHO

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| H1.M1 | Agregar `fueraDelMenuPara: [ANY_ROLE]` a la entrada `my-account/questionnaires` | HECHO | `yarn typecheck` exit 0 |
| H1.M2 | `.md` con la decisión pendiente (`docs/pendiente-decision-cuestionarios.md`) | HECHO | archivo creado, referenciado desde el comentario del código |
| H1.M3 | Confirmar que la ruta y el guard siguen intactos (no se tocó `app.routes.ts` ni el módulo) | HECHO | `git diff --stat` sólo muestra `navigation.map.ts` + el `.md` nuevo |
| H1.M4 | Regresión de navegación | HECHO | ver evidencia |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Que `fueraDelMenuPara` también la sacara de «Tus accesos» | El paciente perdería toda forma de llegar a encuestas ya asignadas | Descartado leyendo el JSDoc del campo (`navigation.types.ts:331-349`): sólo saca el renglón del menú, no de `visibleSections` ni de «Tus accesos» |
| Confundir esta entrada con «Encuestas» (`questionnaires`, sin `my-account/`, del profesional) | Tocar la pantalla equivocada | Confirmado con `grep` de las dos entradas antes de editar; sólo se tocó la del paciente |
