# Reporte — Ajustes del paciente pedidos sobre capturas (27/10/2026)

> **AVANCE: 6 / 6 — 100 %.** Una salvedad visual: el vacío de «Mis citas» se verificó por prueba unitaria, no en navegador (ver «No cubierto»).

- Fecha: 2026-10-27 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/adoring-cerf-yvjux0` (sobre `origin/dev` e224e7440)
- Peldaño alcanzado: `VERIFIED` en lo visual (capturas 1440/768/390, claro y oscuro en lo nuevo) — no `REGRESSION_VERIFIED`: no se corrió la suite completa.

## Completado

| ID | Qué se logró | Verificación | Resultado |
|---|---|---|---|
| H1.M1 | «Mis citas»: el título «Sus citas» ya no se ve (queda para lector de pantalla y foco) y el selector Lista/Calendario se oculta sin citas | `appointments.spec.ts` (test nuevo + aserción en R-02) · `evidencia/*-citas.png` | PASS |
| H1.M2 | «Dependientes»: todos los textos del vacío cierran con punto final («Todavía no registró a nadie.»); se retiró la línea punteada de la primera interpretación | `dependents` specs 22/22 (`evidencia/tests-dependientes-punto-final.txt`) · `evidencia/*-dependientes-sin-datos.png` | PASS |
| H1.M3 | Síntomas: sin las pestañas «Especialistas médicos / Recomendar medicamentos», sin el botón «Recomendar medicamentos» y sin «Guardar observación» | `symptom-check.spec.ts` (test nuevo) · capturas | PASS |
| H1.M4 | Síntomas: «Conviene que vea a» usa la MISMA tarjeta del buscador de especialidades de `/directory` (`card-grid.css`: foto, ícono, nombre) + el porqué + «Empiece por acá» en la primera; la tarjeta entera lleva a quién atiende | `symptom-check.spec.ts` · `evidencia/*-sintomas-*.png` | PASS |
| H1.M5 | «Sus primeros pasos»: sin tachado en los pasos hechos | `evidencia/*-primeros-pasos-abierta.png` | PASS |
| H1.M6 | «Sus primeros pasos»: botón arriba a la derecha que pliega/despliega la lista (queda título y avance), con `aria-expanded` y recordado por cuenta | `first-steps-card.spec.ts` (test nuevo) · `evidencia/*-primeros-pasos-plegada.png` | PASS |

## A medias

Ninguna.

## Pendiente

Ninguna.

## Evidencia

```text
yarn typecheck → typecheck exit=0            (evidencia/typecheck.txt)
eslint <archivos tocados> → exit 0           (evidencia/lint.txt)
ng test --include symptom-check, first-steps, appointments, dependents
  Test Files  7 passed (7)
  Tests  201 passed (201)                    (evidencia/tests.txt)
```

Capturas: `evidencia/{1440,768,390}-*.png` (modo demo, `yarn start:demo`), más `1440-oscuro-*.png`.
Consola y red: el único error es `HTTP 500 /ai/v1/triage/analyze` — el servicio de IA no corre en modo
demo; es previo a este cambio y la pantalla cae al motor local (se ve en las capturas).

## No cubierto

- El vacío de «Mis citas» (sin título ni selector) no se vio en navegador: las dos cuentas de la
  maqueta tienen citas. Lo cubre la prueba unitaria nueva.
- Suite completa (`yarn test`, ~5000 pruebas) y Playwright no se corrieron.
- La vuelta «← Volver a los especialistas» desde medicamentos se probó en unitario, no en captura.

## Desvíos del plan

- Se agregó «← Volver a los especialistas» en la vista de medicamentos: al quitar las pestañas era la
  única forma de volver.
- Se quitó el método `guardarObservacion` (quedaba sin uso). Las observaciones ya guardadas se siguen
  listando para poder borrarlas.
- Dos pruebas viejas de síntomas buscaban las clases de la fila anterior (`.sintomas__especialidad`);
  se cambió sólo el selector, las aserciones son las mismas (`TEST_BUG`).

## Riesgos residuales

- La foto de cada especialidad es ilustrativa (la misma que en `/directory`), no del profesional.

## Decisiones y ambigüedades (confirmar con el cliente)

1. **«Ponele los puntos» (Dependientes)**: confirmado por el cliente — es el punto final de los textos.
2. **«Mejores recomendaciones médicas»**: se interpretó como la tarjeta del buscador con el porqué y la
   marca «Empiece por acá». No se muestran cantidades de médicos: el chequeo no tiene ese dato.
3. **Lista/Calendario**: se oculta sólo sin citas; con citas sigue (el calendario es una función).
