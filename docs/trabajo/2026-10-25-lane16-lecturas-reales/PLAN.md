# Plan — Que la cotización, el desglose y la objeción se vean contra la API real (carril 16)

- Fecha: 2026-10-25 · Repos afectados: mantra-core-health-api (productor), mantra-core-health (consumidor) · Predecesor: [port a dev/test](../2026-10-25-lane16-front-port-dev-test/PLAN.md) (PR #1377 y #1378)
- Resultado observable: con la API real de dev/test, (1) quien cobra (BILLING/FINANCE) ve los seguros de la persona y cotiza en «Pagos»; (2) el paciente ve en «Mis solicitudes» el desglose de cada cobro; (3) ve su objeción registrada y no puede repetirla.
- Kill-test: `GET /patient-coverages/by-patient/:id` responde 404 en la API de dev hoy; `GET /insurance/my-claims` no trae `breakdown` ni `patientObjection`.

## Alcance
- IN (API): lectura de los seguros de una persona para quien cobra; `breakdown` y `patientObjection` en `GET /insurance/my-claims`; sus pruebas, el contrato OpenAPI y los documentos derivados.
- IN (front): quitar «solo simulador» de la lectura de coberturas y de los dos campos; regenerar el contrato del front; ajustar maqueta y specs.
- OUT: cobertura del médico sin rol BILLING (ambigüedad #1 del carril); notificación al paciente; cualquier otra ruta de seguros.
- Ambigüedades registradas:
  - ¿Quién lee los seguros de una persona? Decidido por el usuario (2026-10-25): el mismo rol que cotiza (BILLING/FINANCE/SUPERADMIN) con registro de acceso, **sin** exigir relación clínica. A confirmar con el propietario del carril.
  - La lectura devuelve solo lo que la pantalla usa (id, aseguradora, plan, vigencia, moneda): **no** el número de póliza ni de afiliado (minimización de datos de salud).
  - El desglose se arma en el servidor con la misma regla de cotización (`ClaimCoveragePolicy.quoteLine`) y el vínculo factura ↔ reclamo; el front no recalcula.

## H1 — API: lectura de los seguros de una persona
**Hecho en la API (PR #1024 a dev, #1025 a test, ambos mergeados 2026-10-27).** Con la puerta de relación asistencial que dev agregó a cotizar; plan y reporte de la API en la descripción de esos PR.
**CA:** Dado un usuario BILLING de la organización activa, cuando pide los seguros de una persona, entonces recibe sus coberturas con aseguradora, plan, vigencia y moneda; un usuario sin ese rol recibe 403; cada lectura queda en la bitácora de accesos.
**DoD:** `yarn test` dirigido, `yarn build`, lint, contrato regenerado, gates de docs/inventario.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.M1 | Lectura en el repositorio | devuelve solo campos mínimos y la vigencia calculada | spec del repositorio/servicio | HECHO |
| H1.M2 | Servicio con la puerta de roles | 403 sin rol | spec del servicio | HECHO |
| H1.M3 | Endpoint `GET /patient-coverages/by-patient/:patientProfileId` | 200 con items; `@AccessLogged` | spec del controlador | HECHO |
| H1.M4 | Contrato y documentos | los gates de la API en verde | `yarn docs:openapi:generate` + gates | HECHO |

## H2 — API: desglose y objeción en `GET /insurance/my-claims`
**Hecho en la API (mismos PR).**
**CA:** Dado un paciente con un cobro con seguro, cuando lista sus solicitudes, entonces cada una trae su desglose por línea (precio, cobertura, copago, parte propia y de la aseguradora, estado de la aprobación previa) y su objeción abierta si la presentó; en las demás vistas ambos campos son `null`.
**DoD:** `yarn test` dirigido + integración si hay Postgres de prueba, build, lint, contrato.
**Estado:** A MEDIAS (sin prueba contra Postgres real)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.M1 | DTO: `breakdown` y `patientObjection` nullables | el contrato los declara | `yarn docs:openapi:generate` | HECHO |
| H2.M2 | Armar el desglose por línea con la regla del servidor | suma de partes = precio | spec | HECHO |
| H2.M3 | Leer la objeción abierta del paciente | `reason`, `submittedAt`, `status` | spec | HECHO |
| H2.M4 | Solo en la vista del paciente | otras vistas devuelven `null` | spec | HECHO |

## H3 — API: PRs a dev y a test
**CA:** Dos PRs mergeables (`[dev]`, `[test]`) con el mismo cambio. **Estado:** HECHO (#1024 y #1025, mergeados)

## H4 — Front: usar las lecturas reales
**CA:** Contra la API real, la sección de cotizar lista los seguros de la persona y cotiza; «Mis solicitudes» muestra el desglose y la objeción.
**DoD:** contrato del front regenerado, typecheck, specs dirigidos, suite completa comparada con la base, Playwright contra la maqueta, doble revisión de capturas, y prueba contra la API real si se puede levantar con datos sintéticos.
**Estado:** A MEDIAS (falta verlo contra la API real)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H4.M1 | Regenerar el contrato del front desde la API | declara la ruta y los campos | script del repo | DESCARTADO: ese catálogo solo guarda cuerpos de escritura; no declara lecturas. Regenerarlo solo suma 3 operaciones ajenas atrasadas en dev (no incluidas) |
| H4.M2 | `listCoveragesOfPatient` sin `simulatorOnly`; campos de la respuesta sin extensión | la petición sale a la API real | specs | HECHO |
| H4.M3 | Maqueta alineada a la forma real | los specs del carril en verde | `yarn test` dirigido | HECHO |
| H4.M4 | PR a dev y PR a test | PR mergeable | `gh pr view` + `gh pr checks` | EN CURSO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Orden de merge: el front depende de la API | 404 en el front hasta que la API esté en la rama | La API se mergea primero (productor antes que consumidor) |
| El desglose recalcula con el beneficio de hoy, no el de la fecha del cobro | Un cobro viejo mostraría otro porcentaje | `quoteLine` recibe `at: claim.submittedAt`, como al facturar |
| La rama local de la API tiene trabajo ajeno | Mezclar cambios | Rama nueva desde `origin/dev`; árbol limpio |
| `.env` de la API apunta a Neon compartido | Escribir datos de prueba en datos reales | No sembrar ni correr integración ahí; solo pruebas unitarias |
