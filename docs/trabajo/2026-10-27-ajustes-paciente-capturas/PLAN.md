# Plan — Ajustes del paciente pedidos sobre capturas (27/10/2026)

- Fecha: 2026-10-27 · Repos afectados: mantra-core-health · Base: `origin/dev` (e224e7440)
- Resultado observable: el paciente ve «Mis citas» vacía sin título ni selector Lista/Calendario,
  los textos de «Dependientes» con punto final, el chequeo de síntomas sin pestañas, sin
  «Recomendar medicamentos» ni «Guardar observación» y con las especialidades en la MISMA tarjeta
  del buscador de especialidades (`/directory`), y «Sus primeros pasos» sin tachado y plegable.
- Kill-test: abrir `/symptoms` con un síntoma y ver una lista de filas en vez de tarjetas con foto.

## Alcance
- IN: `appointments.html`, `dependents.css`, `symptom-check.{html,ts,css}`,
  `first-steps-card.{html,ts,css}`, `first-steps.store.ts` y sus specs.
- OUT: lógica del motor de síntomas, contratos de API, la vista de medicamentos (se conserva).
- Ambigüedades registradas:
  - «Ponele los puntos» (captura 2): el cliente confirmó que es el **punto final** de los textos
    (primero se había hecho una línea punteada entre pasos; se retiró).
  - «Mejores recomendaciones médicas»: se toma como mostrar cada especialidad recomendada en la
    tarjeta del buscador (foto, ícono, nombre, por qué) con la primera marcada como «Empiece por
    acá». No se agregan cantidades de médicos (el chequeo no tiene ese recuento: sería inventado).
  - «Sus citas» + Lista/Calendario: el título queda sólo para lector de pantalla (el encabezado
    «Mis citas» ya lo dice) y el selector se oculta cuando no hay ninguna cita.

## H1 — Ajustes visuales del paciente
**CA:** Dado un paciente, cuando abre cada pantalla, entonces ve los seis cambios pedidos.
**DoD:** `yarn lint` · `yarn typecheck` · specs dirigidos en verde · capturas 1440/768/390.

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.M1 | Mis citas: sin título visible ni selector con la lista vacía | spec appointments | HECHO |
| H1.M2 | Dependientes: punto final en los textos del vacío (el título no lo tenía) | captura | HECHO |
| H1.M3 | Síntomas: sin pestañas, sin «Recomendar medicamentos», sin «Guardar observación» | spec symptom-check | HECHO |
| H1.M4 | Síntomas: especialidades con la tarjeta de `/directory` (`card-grid.css`) | spec + captura | HECHO |
| H1.M5 | Primeros pasos: sin tachado | captura | HECHO |
| H1.M6 | Primeros pasos: botón para plegar/desplegar, recordado por cuenta | spec first-steps | HECHO |
