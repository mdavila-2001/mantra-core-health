# Plan — P36 · Horario flexible, sin turnos fijos

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-model, mantra-core-health-api,
  mantra-core-health (front) · Predecesor: `PENDIENTES-BACKEND.md` §P36 (rama `mockup` del front).
- Resultado observable: el médico publica en «Publicá tu agenda» un horario **flexible** (sin turnos
  fijos) con el tiempo que se reserva por paciente; el paciente, en «Mis turnos», ve las horas libres
  de esa franja, elige una y la reserva; dos pacientes no pueden quedarse con horas que se pisan.
- Kill-test: dos `POST /scheduling/resources/:id/flexible-holds` concurrentes con horas que se pisan
  dejan **dos** cupos en `scheduling.bookable_slots` (integración P36, «UNA retención»).

## Alcance
- IN: `.puml` del módulo 41 + DDL + patch; entidad `ScheduleTemplates`; DTO/caso de uso de alta,
  edición, lectura y generación de plantillas; servicio y controlador nuevos de horario flexible;
  ciclo de vida del cupo a demanda (vencer, cancelar, desplazar, reprogramar); cliente, simulador,
  «Publicá tu agenda», «Mis turnos» y la pantalla de reserva del front.
- OUT: cambiar de modo una plantilla viva (`PATCH` no recibe `flexibleHours`: se retira y se republica);
  reprogramar un turno flexible (se cancela y se pide otra hora); la agenda del mostrador (`agenda.ts`)
  no ofrece horas flexibles; P23 (cambiar horario con citas) lo hace otro agente.
- Decisión de producto (tomada esta noche, sin respuesta posible — brief):
  **el paciente pide una hora libre dentro de la franja; el turno ocupa el tiempo por paciente que
  declaró el médico** (`slotMinutes` de la plantilla, 30 por omisión). Las horas se ofrecen cada 15 min
  anclado al hueco libre; al retener se acepta cualquier minuto entero. El cupo nace al retener
  (capacidad 1, ya tomado), igual que el de un servicio (v4.2.40), bajo el candado del profesional.
  - Descartada «bloque con capacidad, por orden de llegada»: varias citas con el mismo rango violan
    `ex_appointments_practitioner_time` (v4.2.3) y el paciente no sabe a qué hora ir.
  - Descartada «pedido de hora que el médico confirma» como modo propio: ya existe —si la política
    de la plantilla exige aprobación, la retención se convierte en solicitud con `/request`—.
  - A quién confirmar: propietario del producto.

## H1 — Horario flexible de punta a punta
**CA:** Dado un médico que publica un horario flexible, cuando dos pacientes piden a la vez horas que
se pisan, entonces queda una sola retención, la otra recibe 409, y la reservada deja de ofrecerse.
**DoD:** integración `p36-horario-flexible.int-spec.ts` en verde contra `mantra_p36` · unitarios del
módulo `scheduling` · specs del front dirigidas · typecheck y lint.
**Estado:** ver `REPORTE.md`.

### H1.S1 — Modelo
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | `flexible_hours boolean NOT NULL DEFAULT false` en `schedule_templates` (`.puml`) | el `.puml` lo declara | `gen_ddl.py 41` → la columna en `02_tables.sql` | ver reporte |
| H1.S1.M2 | Patch `2026-10-26_v4252_schedule_templates_flexible_hours.sql` idempotente | 2 corridas sin error | `psql -f` ×2 | ver reporte |

### H1.S2 — API
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Entidad regenerada + `flexibleHours` en alta/lectura/edición | se guarda y vuelve | unit catálogo + integración | ver reporte |
| H1.S2.M2 | Generar cupos de una plantilla flexible no crea ninguno | `created: 0` | unit + integración | ver reporte |
| H1.S2.M3 | `GET …/flexible-availability` | horas cada 15 min menos lo ocupado | unit + integración | ver reporte |
| H1.S2.M4 | `POST …/flexible-holds` sin dobles reservas | carrera → 1 fila | integración «UNA retención» | ver reporte |
| H1.S2.M5 | El cupo flexible no se reofrece al vencer/cancelar; no se reprograma | queda BLOCKED; 422 | unit reservas | ver reporte |
| H1.S2.M6 | Autorización negativa | 401/403 sin filas | integración «autorización» | ver reporte |

### H1.S3 — Frontend
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Cliente: `flexibleHours` a la API real; `getFlexibleAvailability`, `placeFlexibleHold` | cuerpos exactos | `scheduling.client.spec` | ver reporte |
| H1.S3.M2 | Simulador con el mismo contrato | horas, 409, 422 | `flexible-hours.handlers.spec` | ver reporte |
| H1.S3.M3 | «Publicá tu agenda»: sin el bloqueo «sólo el simulador», tiempo por paciente | se publica contra la API | `agenda-create.spec` | ver reporte |
| H1.S3.M4 | «Mis turnos» + reserva: el paciente elige y retiene una hora flexible | retiene con el endpoint flexible | `appointments.spec`, `booking-new.spec` | ver reporte |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| P23 toca `update-template` y el ciclo de cupos | conflicto en el merge | cambios mínimos y comentados con «P36» |
| Caché de metadata MikroORM compartida entre worktrees | integración no arranca | correr con la caché desactivada (setup de jest fuera del repo) |
