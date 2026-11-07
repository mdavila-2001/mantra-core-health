# Plan — Horarios por línea de producción y equipos por tipo de centro (laboratorio / imagenología)

- Fecha: 2026-11-07 · Repos afectados: `mantra-core-health` (front), `mantra-core-health-api`, `mantra-core-health-model` · Predecesor: `docs/trabajo/2026-10-31-ordenes-compactas-laboratorio-imagenologia/` (dejó «Horarios y equipos» fuera: «no existe en `dev`»)
- Resultado observable: la administradora de un centro `DIAGNOSTIC_CENTER` abre «Horarios y equipos», fija el horario general, elige un servicio (línea), le asigna equipos de **su** tipo de centro y le fija un horario propio con el mismo motor del médico; el paciente ve y reserva turnos de esa línea.
- Kill-test: `GET /diagnostic-units/me/schedule` hoy responde 404 (no existe); la ruta `/administration/center-schedule` no está en `navigation.laboratory.ts`.

## Decisiones tomadas por el usuario (2026-11-07)

| # | Pregunta | Decisión |
|---|---|---|
| D1 | Alcance | Construir todo: modelo + API + front |
| D2 | Qué es una línea | Un **servicio** (estudio de la oferta del centro) con sus equipos; el horario es de la línea |
| D3 | Motor | El mismo del médico (`/scheduling`: recurso, plantilla, slots) con turnos reales |
| D4 | General vs línea | El general es la base; la línea lo reemplaza si tiene horario propio |
| D5 | Equipos por tipo de centro | Por modalidad de la unidad: imagenología → equipos de imagen; laboratorio → analizadores/extracción |
| D6 | Servicio ↔ equipo | Un servicio, **varios equipos posibles** (N:M) |
| D7 | Catálogo de equipos | Tipos del catálogo existente; el centro registra sus unidades (marca/modelo/serie). Sin inventar marcas |
| D8 | Permisos/alcance | Administrador del centro · por sucursal · visible en directorio público · usado al agendar desde una orden |
| D9 | Qué se agenda | El equipo asignado al servicio |
| D10 | Franjas | Una por día, como el médico |
| D11 | Equipo no operativo / calibración vencida | Se dejan de ofrecer turnos |
| D12 | Asignación | Automática (primer equipo libre); servicio sin equipos → no se agenda contra equipo |
| D13 | Pestaña Equipos | Alta/edición, asignar servicios, ver calibración y estado, horario por equipo |
| D14 | Lista de servicios | Oferta de estudios del centro (`diagnostic_study_offerings`) |
| D15 | Entrega | Por fases; por repo dos PRs (dev y test); solo se abren, no se mergean |
| D16 | Verificación | API + BD reales + navegador (3 viewports, 2 temas) |

## Alcance
- IN: tabla N:M servicio↔equipo y vínculo línea↔recurso agendable (modelo `.puml` → DDL generado → entidad ORM); endpoints `/diagnostic-units/me/schedule` y de asignación; filtro de tipos de equipo por modalidad del centro; pantalla «Horarios y equipos» con pestañas Horarios/Equipos; reuso de `ScheduleDayRow`/`ScheduleGrid`/`agenda-slots`; mock del front alineado al contrato.
- OUT: varias franjas por día; elección de equipo por el paciente; farmacia; ampliar el catálogo de tipos de equipo (solo si el filtro lo exige, se registra como ambigüedad); reglas de negocio de pago/aseguradora.
- Ambigüedades registradas (supuesto → a quién confirmar):
  1. Un centro mixto (lab + imagen): se muestran ambas familias de equipos. → propietario.
  2. Catálogo actual de tipos de equipo: solo `ANALYZER`, `XRAY`, `ULTRASOUND`. Faltan tipos para TC/RM/MG/DXA. Supuesto: se usan los existentes y se **registra** la carencia; no se inventan. → propietario / fuente oficial.
  3. «Horario general» base: la línea sin horario propio hereda el general; qué pasa con la franja del general cuando todos los equipos de la línea están no operativos (supuesto: no hay turnos). → propietario.
  4. Sucursal: horarios y equipos son por sucursal; el «Horario general» de la captura es por sucursal activa. → propietario.

## H1 — Modelo y contrato (repo model + API)
**CA:** Dado un centro con equipos y estudios, cuando se asigna un equipo a un servicio y se publica el horario de la línea, entonces la asignación y el horario persisten y se leen de nuevo; un tipo de equipo ajeno a la modalidad del centro se rechaza con 422.
**DoD:** `.puml` actualizado → DDL regenerado → aplicado a una BD real → verificación de deriva en verde (regla 97.2) · `yarn lint && yarn test` del API en verde · prueba de autorización negativa (otra org, rol insuficiente, sin token) · segunda corrida de seeds idempotente si se tocan seeds.
**Estado:** TODO

### H1.S1 — Modelo
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Localizar en el `.puml` de `23_diagnostic_units` y `41_scheduling` las entidades `diagnostic_equipment`, `diagnostic_study_offerings`, `schedulable_resources` | Rutas y líneas citadas en el plan | `grep` con salida pegada | TODO |
| H1.S1.M2 | Añadir tabla `diagnostic_study_offering_equipment` (offering_id, equipment_id, único compuesto, índice con nombre explícito) | La tabla existe en el DDL generado | `python salud-db/gen_ddl.py` exit 0 + diff de `SQL/23_*` | TODO |
| H1.S1.M3 | Vincular línea→recurso agendable (`resource_ref_type='diagnostic_study_offerings'`) sin tabla nueva si el motor lo permite | Documentado el mapeo | Lectura del servicio de recursos citada | TODO |
| H1.S1.M4 | Aplicar DDL a BD real y verificar deriva | 0 divergencias | salida del verificador de deriva | TODO |

### H1.S2 — API
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Entidad MikroORM + repositorio de la N:M | Compila y mapea | `yarn type-check` exit 0 | TODO |
| H1.S2.M2 | `PUT/GET /diagnostic-units/me/schedule` (horario general por sucursal) reutilizando plantilla/reglas de `/scheduling` | Persiste y relee | test de integración con BD real | TODO |
| H1.S2.M3 | `PUT /diagnostic-study-offerings/:id/equipment` y horario de la línea | N:M persiste; horario propio reemplaza al general | test de integración | TODO |
| H1.S2.M4 | Filtro de tipos de equipo por modalidad del centro en alta de equipo | Tipo ajeno → 422 | test unitario + integración | TODO |
| H1.S2.M5 | Equipo no operativo / calibración vencida ⇒ sin slots | El generador omite el equipo | test dirigido | TODO |
| H1.S2.M6 | Matriz de autorización negativa de los endpoints nuevos | 401/403/404 según contrato | test | TODO |
| H1.S2.M7 | Documentar en OpenAPI | Contrato publicado | `yarn` del openapi en verde | TODO |

## H2 — Front: pantalla «Horarios y equipos»
**CA:** Dado un `DIAGNOSTIC_CENTER`, cuando abre «Horarios y equipos», entonces ve las pestañas Horarios y Equipos, elige un servicio, le asigna equipos de su tipo, fija su horario con el mismo motor del médico y, al recargar, lo ve guardado.
**DoD:** `yarn typecheck && yarn lint && yarn test` (dirigidos) · Playwright UI→request→response→persistencia→recarga→UI contra API real · capturas 3 viewports × 2 temas con doble revisión (reglas 35/95.7) · regla M34 de los nueve estados · una sola tarjeta con pestañas, centrada y a lo ancho (CLAUDE.md §6).
**Estado:** TODO

### H2.S1 — Reuso del motor del médico
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Extraer del editor del médico (`agenda-create`) el bloque de semana reutilizable sin cambiar su comportamiento | `agenda-create` pasa sus specs sin tocarlas | `yarn test agenda-create` | TODO |
| H2.S1.M2 | Cliente de datos `diagnostic-units` con `me/schedule` y asignación de equipos | Tipos espejo del DTO | `yarn typecheck` | TODO |
| H2.S1.M3 | Ruta `administration/center-schedule` + entrada de menú «Horarios y equipos» (solo `DIAGNOSTIC_CENTER`) | Aparece en el menú del centro y no en el del paciente | spec de navegación | TODO |
| H2.S1.M4 | Pestaña Horarios: general + selector de servicio con horario propio | Heredar/reemplazar según D4 | spec + Playwright | TODO |
| H2.S1.M5 | Pestaña Equipos: alta/edición, estado y calibración, asignar servicios, horario por equipo | CRUD persiste | spec + Playwright | TODO |
| H2.S1.M6 | Equipos filtrados por modalidad del centro (lab ↔ imagen) | Un lab no ve equipos de imagen | spec | TODO |
| H2.S1.M7 | Mock del front alineado al contrato (marcado como mock) | Simulador responde los endpoints nuevos | spec de handlers | TODO |

## H3 — Directorio público y agendamiento desde una orden
**CA:** Dado un servicio con horario y equipos operativos, cuando el paciente agenda un estudio de su orden, entonces se ofrecen turnos del primer equipo libre; con todos los equipos no operativos no se ofrece ninguno.
**Estado:** TODO (subtareas se detallan al cerrar H1 y H2; depende de ellos)

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| El entorno de la sesión puede no levantar PostgreSQL | No hay `VERIFIED` de punta a punta | Declarar `BLOQUEADO` con evidencia; no maquillar como PASS (regla 80.4) |
| Los repos del modelo/API exigen coordinación de despliegue | Orden de merge | Orden: model → API → front; PR por repo hacia `dev` y `test` |
| Tipos de equipo insuficientes para TC/RM/MG/DXA | Filtro por modalidad incompleto | Registrar y pedir fuente; no inventar |
| Alcance muy grande | Entrega parcial | Cerrar por hitos; el `REPORTE.md` declara honestamente lo `A MEDIAS` |
