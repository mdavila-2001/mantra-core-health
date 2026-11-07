# Plan — Horarios del centro con el motor de horarios del médico

- Fecha: 2026-11-07 · Repos: front (este) · API: mantra-core-health-api#1414 (franja con duración y descanso)
- Responsable: Pablo · Predecesor: `2026-11-07-horarios-equipos-centros-diagnostico` (D3 «el mismo motor del médico», H2.S1)
- Resultado observable: en «Horarios y equipos», cada horario (general, de servicio, de estudio, de equipo) se edita
  con la misma tabla que «Publicar mi agenda» del médico: un día por fila con Desde, Hasta, Dura, Descanso y cuántos
  horarios entran; «Repetir un horario en todos los días»; hora de almuerzo; «Así van a quedar sus horarios» y
  «Previsualizar horario» con la misma grilla semanal (`ScheduleGrid`).
- Kill-test: abrir «Horarios y equipos» y ver la lista de días con desplegables de hora en vez de la tabla del médico.

## Alcance
- IN: `ScheduleDayRow` (parametrizada: sin «Atiendo», «Telemedicina» ni «Horario flexible», que no aplican a un centro);
  `schedule-block-editor` reescrito sobre las piezas del médico; reglas espejo del centro (duración y descanso por
  franja); simulador; tipos.
- OUT: mover la pantalla a la ficha de cada sucursal (después de mantra-core-health-api#1411); fecha de fin y opciones
  avanzadas del médico (el contrato del centro no las tiene).
- Ambigüedad: «todos los puntos» — se toma como todas las piezas del editor de semana del médico; la vigencia y las
  opciones avanzadas quedan fuera porque el centro no las guarda. Confirmar con Pablo.

## H1 — El centro edita su semana con el editor del médico
CA: Dado un centro, cuando abre Horarios, entonces cada horario se edita en la tabla del médico y al publicar y recargar
ve lo mismo.
DoD: `yarn typecheck` · `yarn lint` · vitest dirigido · Playwright dirigido · capturas 3 viewports × 2 temas.

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.M1 | Tipos y reglas del centro: duración y descanso por franja | turnos y validación por franja | `yarn vitest center-schedule.rules` | HECHO |
| H1.M2 | `ScheduleDayRow` con `practitionerColumns` (por omisión true) | el médico no cambia | `yarn vitest schedule-day-row agenda-create` | HECHO |
| H1.M3 | `center-week.ts`: horario ⇄ filas del médico, almuerzo y cuenta | ida y vuelta sin pérdida | vitest nuevo | HECHO |
| H1.M4 | Editor del centro sobre la tabla del médico + repetir + almuerzo | se ve y edita igual | vitest del editor | HECHO |
| H1.M5 | «Así van a quedar» + «Previsualizar horario» con `ScheduleGrid` | misma grilla | vitest | HECHO |
| H1.M6 | Simulador con duración y descanso por franja | mock = API | vitest handlers | HECHO |
| H1.M7 | Prueba visual y Playwright dirigido | publicar → recargar → igual | `yarn pw` dirigido + capturas | HECHO |
