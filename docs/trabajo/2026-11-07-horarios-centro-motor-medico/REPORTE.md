> **AVANCE: 7 / 7 — 100,0 %.**

# Reporte — Horarios del centro con el motor de horarios del médico

- Fecha: 2026-11-07 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/magical-keller-7igd5z` · Responsable: Pablo
- API: mantra-core-health-api#1414 (franja con duración y descanso propios).
- Peldaño de evidencia: `VERIFIED` contra el simulador (Playwright + capturas). Contra la API real: no ejercitado
  desde el navegador; la API tiene su propia prueba de integración en #1414.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | Duración y descanso por franja en tipos, turnos, validación y resumen del centro | `ng test --include center-schedule.rules.spec.ts` | PASS 16/16 |
| H1.M2 | `ScheduleDayRow` con `practitionerColumns` y `testPrefix`; el médico no cambia | `ng test --include agenda-create/**` | PASS ([vitest.txt](./evidencia/vitest.txt)) |
| H1.M3 | `center-week.ts`: horario ⇄ filas del médico, almuerzo, cuenta de citas, reglas para la grilla | `ng test --include week/center-week.spec.ts` | PASS |
| H1.M4 | Editor del centro sobre la tabla del médico, con «Repetir un horario en todos los días» y almuerzo | ver H1.M7 | PASS |
| H1.M5 | «Así van a quedar sus horarios» + «Previsualizar horario» con `ScheduleGrid` | ver H1.M7 | PASS |
| H1.M6 | Simulador con duración y descanso por franja (vía `turnosDelDia`) | vitest de handlers del centro | PASS |
| H1.M7 | Martes a 20 min + 10 de descanso → PUT con `slotMinutes`/`gapMinutes` → recarga → igual, y la grilla abre | `yarn playwright test playwright/centro-horario-motor-medico.spec.ts` | PASS ([playwright.txt](./evidencia/playwright.txt)) |

Regresión: 17 archivos de vitest, 231 pruebas (centro, agenda del médico, reglas, simulador) y `center-equipment-types.spec.ts` (2/2).

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Mover la edición a la ficha de cada sucursal y el resumen al perfil de la organización | TODO | mantra-core-health-api#1411 (vincular sucursal del directorio con la sede del centro) |

## Evidencia
- Capturas: [1440 claro](./evidencia/centro-1440.png) · [1440 oscuro con almuerzo](./evidencia/centro-1440-oscuro-almuerzo.png) ·
  [768](./evidencia/centro-768.png) · [390](./evidencia/centro-390.png) · [grilla](./evidencia/centro-grilla.png) ·
  [grilla oscuro](./evidencia/centro-grilla-oscuro.png) · médico [antes](./evidencia/medico-antes.png) / [después](./evidencia/medico-despues.png).
- Consola del navegador: 0 errores en las corridas de captura.
- `yarn typecheck` EXIT 0 · `eslint` de lo tocado EXIT 0.

## No cubierto
- Contra la API real desde el navegador (todo fue contra el simulador).
- Teclado y lector de pantalla del editor nuevo: se heredan de las piezas del médico, no se ejercitaron aparte.
- Los niveles de servicio, estudio y equipo usan el mismo componente; solo el horario general se ejercitó en Playwright.

## Desvíos del plan
- Los estilos de la semana se movieron de `agenda-create.css` a `schedule-day-row/schedule-week.css`, compartida por las dos
  pantallas, en vez de copiarlos.

## Riesgos residuales
- A 768 px las horas de «Desde»/«Hasta» se ven cortadas («08:00 AN»): es el reparto en renglones de la fila del médico
  (columnas de 8,5 rem), igual en las dos pantallas. Arreglarlo es tocar la fila del médico; se deja anotado.
- Un día con dos franjas que no coinciden con el almuerzo de los demás días se lee como una sola franja de inicio a fin.

## Decisiones y ambigüedades
- «Todos los puntos»: se tomó como todas las piezas del editor de semana del médico. La fecha de fin y las «Opciones
  avanzadas» no entran porque el horario del centro no las guarda. Confirmar con Pablo.
- Los `data-testid` de los días del centro pasaron del día ISO (1 = lunes) al índice de la fila del médico (0 = lunes).
