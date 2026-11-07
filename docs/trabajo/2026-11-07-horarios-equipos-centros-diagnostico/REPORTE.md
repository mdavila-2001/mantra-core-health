> **AVANCE: 0 / 18 — 0,0 %.** (H3 aún sin descomponer en microtareas.)

# Reporte — Horarios por línea y equipos por tipo de centro (corte de sesión 2026-11-07)

- Fecha: 2026-11-07 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/great-bardeen-tvd1js` (front)
- Peldaño de evidencia alcanzado: `DISCOVERED` (solo descubrimiento y plan; no hay código escrito)

## Completado
Ninguna.

## A medias
Ninguna.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H1 (modelo + API) | TODO | Aprobación del plan; PostgreSQL disponible en el entorno para verificar |
| H2 (front) | TODO | H1 (contrato real) |
| H3 (directorio y agendamiento por orden) | TODO | H1 y H2; descomposición en microtareas |

## Evidencia
Hechos descubiertos (rutas reales):
- La pantalla «Horarios y equipos» no existe en `dev`: `docs/trabajo/2026-10-31-ordenes-compactas-laboratorio-imagenologia/REPORTE.md:80` y `docs/frontend/evidence/port-visual-mockup-2026-10-26/README.md:33` (necesita `GET/PUT/PATCH /diagnostic-units/me/schedule`, que la API no tiene).
- Menú del centro sin esa entrada: `src/app/core/navigation/navigation.laboratory.ts`.
- Motor de horarios del médico: `src/app/features/agenda/agenda-create/` (`schedule-day-row/schedule-day.ts`, `agenda-slots.ts`) y `src/app/features/agenda/my-agenda/schedule-grid/`.
- `ResourceType = 'PRACTITIONER' | 'ROOM' | 'EQUIPMENT'`: `src/app/core/data-access/scheduling/scheduling.types.ts:553`.
- Modalidades del centro y su equipo: `src/app/core/data-access/diagnostic-units/modalities.ts`.
- API: `mantra-core-health-api/src/modules/diagnostic_units/` (entidad `diagnostic_equipment`, `diagnostic_study_offerings`; sin relación servicio↔equipo) y `src/modules/scheduling/` (`schedulable_resources`, `schedule_templates`, `schedule_rules`).
- Tipos de equipo del catálogo hoy: `ANALYZER`, `XRAY`, `ULTRASOUND` (`diagnostic_units.concepts.ts:165-173`).
- Fuente de verdad del esquema: `.puml` → `salud-db/gen_ddl.py` → `SQL/` (repo model).

## No cubierto
Todo lo implementable: no se escribió ni ejecutó código.

## Desvíos del plan
Ninguno.

## Riesgos residuales
Ver tabla de riesgos del plan.

## Decisiones y ambigüedades
Decisiones D1–D16 y las 4 ambigüedades abiertas están en el PLAN.md. Confirmar con el propietario: centros mixtos, tipos de equipo faltantes (TC/RM/MG/DXA), regla de herencia del horario general, y alcance por sucursal.
