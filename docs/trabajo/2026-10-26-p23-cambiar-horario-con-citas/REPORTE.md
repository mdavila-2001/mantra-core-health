# Reporte — P23: cambiar un horario que tiene citas

> **AVANCE: 10 / 10 — 100 %.** Prueba visual en navegador: no ejecutada (ver «No cubierto»).

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `wt/p23` → `claude/elegant-goodall-0wu6ci`
  (mantra-core-health-api y mantra-core-health). Modelo: sin cambios (no hay esquema nuevo).
- Peldaño de evidencia: API `VERIFIED` contra la base real `mantra_p23` (int-spec con persistencia,
  negativo de autorización y concurrencia, más kill-test); frontend `TESTED` (specs del simulador,
  del cliente y de los componentes); sin prueba visual → frontend `VERIFIED_FUNCTIONAL_ONLY` no se
  alcanza: queda en `TESTED`.

## Decisión tomada (sin confirmación del propietario)

- **Opción 1 de la sección, en su forma ya elegida por M4:** las citas vivas **no** frenan el retiro
  (ni acotado por rango: no frenan). La API ya lo hacía desde el 26/09; faltaba que fuera seguro y que
  el simulador sirviera el mismo contrato. Descartadas la 2 (`release-free-slots`) y la 3
  (`generate-slots?replace=true`): duplicarían con otra ruta lo que el retiro ya hace, y la 3 tocaría
  `generate-slots`, que P36 está cambiando.
- **Un cupo conservado de un horario retirado queda cerrado (`SLOT_BLOCKED`) para siempre**, aunque su
  cita se cancele. Alternativa descartada: reabrirlo al cancelar — publicaría un turno con la hora y la
  duración del horario que el profesional retiró. Reversible (es estado, no esquema). Confirmar con el
  propietario.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | El retiro toma los cupos de la plantilla `FOR UPDATE` antes de mirar sus citas | `yarn test scheduling-catalog.repository.spec scheduling-catalog.service.spec` | PASS 143/143 — `evidencia/unit-lint.txt` |
| H1.S1.M2 | Los cupos conservados quedan `SLOT_BLOCKED`; los libres se sueltan | ídem | PASS — `evidencia/unit-lint.txt` |
| H1.S2.M1 | Int-spec contra `mantra_p23`: retiro con cita viva 200; cupos conservados cerrados y fuera de `GET /scheduling/slots?onlyAvailable`; la cita sigue confirmada en su cupo; el horario de 45 min omite el turno que pisa la cita (`omittedByCommitments: 1`, `created: 2`, todos de 45 min); cancelada la cita, su cupo no vuelve; retener un cupo retirado → 422; otro profesional → 403 sin efectos; retención concurrente con el retiro → retiro 200, sin `slot_holds` huérfanos | `yarn test:integration test/integration/p23-cambiar-horario-con-citas.int-spec.ts` | PASS 9/9 — `evidencia/int-p23.txt`; kill-test sin el cambio: 3 rojos — `evidencia/int-kill-test.txt` |
| H1.S2.M2 | Lint de lo tocado, inventario de scheduling regenerado, typecheck | `npx eslint …`, `node tools/inventario/flujos.mjs`, `yarn typecheck` | eslint EXIT=0; scheduling fuera de la lista de desactualizados — `evidencia/inventario.txt`; typecheck — `evidencia/api-typecheck.txt` |
| H2.S1.M1 | Simulador `DELETE templates/:id`: sin 409, conserva y cierra cupos con cita, `liveBookings`/`liveBookingIds`/`truncated`/`cancelledBookings`, `?affectedBookings=cancel` (422 con paciente recibido) | `yarn ng test --include …` | PASS — `evidencia/front.txt` |
| H2.S1.M2 | Simulador `GET templates/:id/live-bookings` con la forma de la API | ídem | PASS |
| H2.S1.M3 | Simulador `generate-slots` omite instantes que pisan una cita viva (`omittedByCommitments`) e ignora cupos de horarios retirados; retener un cupo cerrado → 422 | ídem | PASS |
| H2.S2.M1 | Errores del simulador con `code`: 500 simulado (`INTERNAL`) y tres de surveys (`PRECONDITION_FAILED`, `FORBIDDEN`) | ídem (`surveys-forms.handlers.spec`, `src/app/core/mock/*.spec`) | PASS |
| H2.S3.M1 | `RetiredTemplate` con `liveBookings`/`liveBookingIds`/`truncated`, `SlotsGenerated.omittedByCommitments`; comentarios que describían el 409 corregidos (cliente, `agenda-create`, `my-agenda`) | `yarn typecheck` (front) | EXIT=0 — `evidencia/front.txt` |
| H2.S3.M2 | Specs del cliente, `block-cancellations`, `agenda-create`, `my-agenda` y simulador | `yarn ng test --include …` (8 patrones) | 21 archivos, 341 pruebas PASS — `evidencia/front.txt` |

## A medias

ninguna

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| Prueba visual de «Cambiar mi horario» (3 viewports × 2 temas) | TODO | Un navegador con `ng serve` contra la API; no se levantó esta noche (máquina compartida por 12 agentes). |

## Evidencia

```text
$ yarn test:integration test/integration/p23-cambiar-horario-con-citas.int-spec.ts   (MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1, DB_NAME=mantra_p23)
Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total

$ (kill-test) mismo int-spec con repositorio y caso de uso SIN el cambio
  ● … los dos cupos conservados quedan cerrados y ninguno del horario viejo se ofrece
  ● … cancelada la cita viva, su cupo del horario retirado no vuelve a ofrecerse
  ● … retener un cupo del horario retirado se rechaza: 422
Tests:       3 failed, 6 passed, 9 total

$ yarn test:integration … fx4-retirar-horario-publicado (suite existente del retiro)
Tests:       9 failed, 9 passed, 18 total   ← los 9 rojos son p23 por timeout del arranque en frío; fx4 9/9 en verde

$ yarn test scheduling-catalog.repository.spec scheduling-catalog.service.spec
Tests:       143 passed, 143 total

$ (front) yarn ng test --watch=false --include … (8 patrones)
 Test Files  21 passed (21)
      Tests  341 passed (341)
$ (front) yarn typecheck → EXIT=0 · npx eslint <tocados> → EXIT=0
```

Después de unir la rama compartida (trae P36, mismo módulo), re-corrido sobre el código unido:
`yarn test src/modules/scheduling` 34 suites / 719 pruebas PASS; int-spec p23 + fx4 18/18 PASS;
inventario de scheduling al día — `evidencia/post-merge.txt`.

Archivos: `evidencia/post-merge.txt`, `evidencia/int-p23.txt`, `evidencia/int-kill-test.txt`, `evidencia/int-corridas-previas.txt`,
`evidencia/unit-lint.txt`, `evidencia/inventario.txt`, `evidencia/front.txt`, `evidencia/api-typecheck.txt`.

## No cubierto

- **Prueba visual** de la pantalla (`agenda-create` en modo cambio y «Mi agenda»): no se abrió un navegador.
  Lo visual no cambió (sólo comentarios y contrato), pero la regla exige captura y no la hay.
- **La pantalla contra la API real de punta a punta** en navegador: el flujo que hace la pantalla
  (live-bookings → DELETE → POST templates → generate-slots) está ejercitado por HTTP real en el int-spec
  y por el spec de `agenda-create` contra dobles; no juntos en un navegador.
- **El camino `affectedBookings=cancel` contra la base** no se re-ejercitó en este trabajo (lo cubre la
  etapa C del 24/10); el bloqueo de cupos sí corre también en ese camino porque está en el repositorio.
- **La carrera**: el int-spec dispara retención y retiro en paralelo y exige retiro 200 sin huérfanos, pero
  no fuerza el orden; cuál de los dos ganó en la corrida no se registró.
- Recursos que no son de un profesional (salas, equipos): `generate-slots` sólo omite compromisos de
  profesionales; un horario nuevo de una sala puede generar un turno encima de una cita conservada.
- Solicitudes pendientes en un cupo conservado: no comprometen (por diseño, #186) y no se omiten.
- Typecheck global y suite completa del frontend: no se corrió la suite completa (regla del brief).

## Desvíos del plan

- Las pruebas de integración no arrancaban (`MetadataError: Metadata for entity CatalogConcepts not
  found`, también en `fx4` sin cambios): MikroORM descubre entidades por `entitiesTs` sólo si detecta
  soporte de TypeScript, y con `@swc/jest` no lo detecta; sin `dist/` no descubre nada. Se corrieron con
  `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1` (variable documentada de MikroORM), sin tocar código. Además
  `node_modules` del espacio se reemplazó por una carpeta de enlaces al compartido con su propio `.cache`,
  para que la caché de metadata de MikroORM (`node_modules/.cache/mikro-orm`) no mezcle rutas de otros
  checkouts. Clase: `ENVIRONMENT`.
- El primer arranque en frío de la app superó los 180 s del `beforeAll`; no se subió ningún timeout: la
  segunda corrida (caché caliente) arrancó en ~30 s.
- Un `it` del int-spec comparaba `Date` y el driver devuelve texto (`TEST_BUG`): se compara como instante,
  sin aflojar la aserción.
- El gancho `pre-push` del frontend (construcción de producción) murió por el entorno
  (`fatal error: all goroutines are asleep - deadlock!`, código 129, máquina compartida). Se construyó
  aparte con `yarn ng build` → EXIT=0 (`evidencia/front-build.txt`) y se publicó con `SALTAR_BUILD=1`,
  la vía de escape del propio gancho.
- No se tocó `generate-slots` de la API (P36 lo cambia): ya omite los instantes que pisan citas
  confirmadas del profesional; el int-spec lo demuestra.

## Riesgos residuales

- Reactivar un horario retirado no reabre sus cupos conservados (quedan `SLOT_BLOCKED`); como
  `generate-slots` saltea instantes existentes de la misma plantilla, esos instantes quedan sin ofrecer
  tras reactivar. Conservador (no ofrece de más), pero puede sorprender.
- `GET /scheduling/resources/:id/slots` sin `onlyAvailable` devuelve `available: remainingCapacity > 0`
  sin mirar el estado: un cupo conservado con capacidad libre sale `available: true` aunque esté cerrado.
  Defecto previo (igual que con los bloqueos por excepción), fuera de alcance.
- La generación del simulador no completa el último turno pasada la hora de fin («redondeo hacia
  adelante» de la API): divergencia previa, anotada.

## Decisiones y ambigüedades

- Ver «Decisión tomada» arriba (opción 1; cupo conservado cerrado para siempre). A confirmar con el
  propietario del producto.
- El simulador sigue el contrato de la API **sin filtro de fecha** en `live-bookings` y en el retiro
  (igual que `BlockedBookingsCanceller.describe`).
