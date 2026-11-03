# Plan — Médico de cabecera: botón «Reservar cita»

- Fecha: 2026-11-03 · Repos afectados: mantra-core-health (front) · Predecesor: FT del médico de cabecera (28/10/2026)
- Resultado observable: en el inicio del paciente, con médico de cabecera elegido, la tarjeta ofrece «Reservar cita» que cae en «Sedes y horarios» de su ficha; sin médico, lleva a la guía.
- Kill-test: abrir el inicio con médico elegido y no ver «Reservar cita».

## Alcance
- IN: `primary-practitioner-card` (html, ts, css, spec) y su copy; `practitioner-detail` (bajar al ancla `#horarios`, hallado en la verificación de navegador).
- OUT: lado del médico («Mis pacientes de cabecera»); la pantalla de reserva; cambios en la API.
- Ambigüedades registradas: (1) reservar exige elegir un cupo (`/my-account/appointments/book/:slotId`), así que «directo a reservar» se resolvió como llegar a los horarios de su ficha (`#horarios`); confirmar con el propietario. (2) Un paciente tiene un solo médico de cabecera vigente, por eso «si es uno» = «si ya eligió a alguien»; sin elegir va a la guía (`/directory`).

## H1 — Reservar desde la tarjeta
**CA:** Dado un paciente con médico de cabecera, cuando ve el inicio, entonces hay un botón «Reservar cita» con destino `/directory/:id#horarios`; dado uno sin médico, entonces no hay «Reservar cita» y sí el botón a la guía.
**DoD:** `ng test` de `primary-practitioner-card.spec.ts` en verde.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.M1 | Botón «Reservar cita» a `#horarios` | href correcto | spec | HECHO |
| H1.M2 | Sin médico no hay «Reservar cita» | ausente | spec | HECHO |

## H2 — El ancla `#horarios` baja la pantalla
**CA:** Dado que se llega a `/directory/:id#horarios`, cuando la ficha termina de pintarse, entonces «Sedes y horarios» queda a la vista; sin ancla, la ficha no se mueve.
**DoD:** `ng test` de `practitioner-detail.spec.ts` en verde y medición en navegador.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.M1 | La ficha baja al ancla cuando ya está pintada | `scrollIntoView` sobre `#horarios` | spec + Playwright | HECHO |
