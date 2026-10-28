# Reporte — P34: farmacias abiertas 24 h y de turno

> **AVANCE: 16 / 16 — 100 %.** (microtareas del plan; la prueba visual quedó fuera del plan y figura en «Pendiente» y «No cubierto»)

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/elegant-goodall-0wu6ci` en
  mantra-core-health-model, mantra-core-health-api y mantra-core-health.
- Peldaño de evidencia: modelo **RUNS** (patch ×2 en `mantra_p34`); API **VERIFIED** (HTTP real contra PostgreSQL, con persistencia y recarga);
  frontend **TESTED** (ng test dirigido). Sin prueba visual de navegador: la UI no pasa de
  `VERIFIED_FUNCTIONAL_ONLY` (ver «No cubierto»).

## Decisiones de producto (las tres preguntas abiertas del P34)

Nadie podía contestar esta noche: se tomó la opción más conservadora y reversible.

| # | Pregunta | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|---|
| D1 | ¿Quién carga el rol? | La **propia farmacia** (personal `PHARMACY_STAFF`, acotado por `PharmacyTenantScopeGuard` + `requireManagedPharmacy`); la plataforma (`SECURITY_ADMIN`/`SUPERADMIN`) puede cargar en su nombre. Cada turno guarda `source_concept_id` (`PHARMACY`/`PLATFORM`) y la lectura pública lo devuelve; la UI dice «declarado por cada farmacia». | Es quien conoce su turno; queda trazable quién lo afirmó. | Importar el rol del colegio (no hay fuente ni contrato con procedencia: no se inventa); carga sólo de plataforma. Reversible: la procedencia admite sumar `COLLEGE`. |
| D2 | ¿Granularidad? | El turno es de la **sede** (local físico), no de una zona. La zona sale de la dirección de la sede: `city` filtra, `lat`/`lng` ordena por distancia. | Es lo único que el modelo puede afirmar sin un rol por zona. | Turno por municipio/departamento. |
| D3 | ¿Turno vencido? | **Nunca se publica**: la consulta pública filtra `starts_at <= now < ends_at` y estado activo. Máx. **72 h** (CHECK en base), no se acepta uno ya terminado ni a más de **62 días** (servidor), sin solapes en la misma sede (EXCLUDE en base). Cancelar lo deja `CANCELLED`, no lo borra. | Un turno viejo manda a alguien de noche a una puerta cerrada; un turno sin fin no caduca nunca. | Turnos recurrentes o sin fin. |
| D4 | 24 h | `open_24h` **nullable**; sólo `true` se muestra. | «No declarado» no es «cierra de noche» (lo pedía el P34). | `false` por defecto. |
| D5 | Huso | Horas ISO-8601 **con desplazamiento obligatorio** (sin él, 400); `timestamptz`; la respuesta trae UTC, la hora local y `timeZone` (de la sede o `America/La_Paz`). El front escribe en hora de Bolivia sin mirar el huso del navegador. | Bolivia es UTC−4 fijo; un instante sin desplazamiento se corre 4 h en un servidor UTC. | Interpretar en el huso del servidor. |

Ambigüedad abierta (confirmar con el dueño del producto): si el colegio publica algún día un rol
oficial, ¿pisa al declarado por la farmacia o conviven?

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `diagram_24`: `open_24h` y `pharmacy_on_call_shifts` (5 FKs, 8 índices) | `python3 salud-db/gen_ddl.py 24` | `[24/pharmacy] 10 tablas · 15 FK intra · 55 FK diferidas` |
| H1.S1.M2 | `diagram_33`: CHECK 72 h y EXCLUDE de solape; `05_constraints` y `apply_all` | `gen_integrity.py` + `gen_apply.py` | sólo cambia el módulo 24 |
| H1.S1.M3 | Patch `2026-10-26_v4260_pharmacy_open_24h_on_call_shifts.sql` idempotente | `psql -v ON_ERROR_STOP=1 -f …` ×2 | EXIT=0 ×2 · 5 FKs · 9 índices · CHECK + EXCLUDE (`evidencia/h1-patch-x2.txt`) |
| H1.S1.M4 | `database/SQL` vendorizado | `diff -rq` modelo ↔ API | los archivos de P34 coinciden |
| H2.S1.M1 | Entidades regeneradas | `gen_entities.py 24` | `PharmacyOnCallShifts`, `PharmacySites.open24h` |
| H2.S1.M2 | Conceptos `pharmacy:ON_CALL_*` (UUID activo = el del EXCLUDE) | `yarn test src/modules/pharmacy` | verde |
| H2.S2.M1 | `PUT /pharmacies/:id/sites/:siteId/open-24h` | ídem | verde |
| H2.S2.M2 | Alta / lista / cancelación de turnos, 422 y 409 (incluye `23P01` concurrente) | ídem | verde |
| H2.S3.M1 | `GET /public/pharmacies/open-now` con cursor keyset | ídem | verde |
| H2.S3.M2 | `GET /pharmacy/sites` con `open24h`, `onCallUntil` y `?openNow=true` | ídem | `42 suites, 469 pruebas` (`evidencia/h2-unit-pharmacy.txt`) |
| H2.S4.M2 | OpenAPI y endpoints regenerados | `generate-openapi.mjs` + `check-breaking.mjs` | `Sin cambios incompatibles…` (`evidencia/h2-openapi.txt`) |
| H3.S1.M1 | Cliente, `opening-hours.types.ts` y simulador con el mismo contrato | `ng test --include …` | verde |
| H3.S2.M1 | «Comprar»: insignias y filtro «Abiertas ahora» (`openNow=true` al servidor) | ídem | verde |
| H3.S2.M2 | Directorio de farmacias: sección «Abiertas ahora» paginada | ídem | verde |
| H3.S3.M1 | Portal: «Horario y turnos» (`administration/pharmacy-hours`), una tarjeta con pestañas por sucursal | ídem | `11 archivos, 183 pruebas`, antes y después del merge con P37 (`evidencia/h3-front-ng-test.txt`) |
| H2.S4.M1 | Integración HTTP real contra `mantra_p34`: 401/403/404 de autorización, 24 h persistida y retirada, turno publicado con hora de Bolivia, 409 de solape, EXCLUDE y CHECK en la base, turno vencido no publicado, 400 sin desplazamiento, cancelación, cursor, `/pharmacy/sites` | `yarn test:integration pharmacy-on-call-shifts` | `Tests: 13 passed, 13 total` (`evidencia/h2-integracion.txt`) |

## A medias

Ninguna.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| Prueba visual (3 viewports × 2 temas) | TODO | Un navegador contra `ng serve` (no se levantó para no competir por la máquina de 12 agentes) |
| Rol oficial del colegio | DESCARTADO (D1) | Una fuente con procedencia y confirmación del dueño del producto |

## Evidencia

- `evidencia/h1-patch-x2.txt` — patch aplicado dos veces y consultas de verificación.
- `evidencia/h2-unit-pharmacy.txt` — unitarios del módulo pharmacy.
- `evidencia/h2-openapi.txt` — regeneración de OpenAPI y chequeo de incompatibles.
- `evidencia/h2-integracion.txt` — integración HTTP real contra `mantra_p34`.
- `evidencia/h3-front-ng-test.txt` — `ng test` dirigido del frontend.

```text
$ yarn test src/modules/pharmacy
Test Suites: 42 passed, 42 total
Tests:       469 passed, 469 total

$ yarn ng test --watch=false --include <11 specs>
 Test Files  11 passed (11)
      Tests  183 passed (183)

$ python3 -m unittest discover -s salud-db/tests      # repo del modelo
Ran 21 tests in 0.010s
OK
```

## No cubierto

- **Prueba visual de navegador**: no hay capturas de «Horario y turnos», «Abiertas ahora» ni de
  las insignias de «Comprar»; sólo pruebas de componente (DOM de prueba).
- **`yarn build` de producción del frontend**: se cayó dos veces por un crash de esbuild con la
  máquina saturada; el presupuesto de bundle no quedó medido. Las pantallas nuevas son rutas
  perezosas (`import()`), así que no deberían mover el paquete inicial, pero no está medido. El
  push del front usó `SALTAR_BUILD=1` (vía prevista por el propio gancho).
- **`yarn orm:catalog`**: no se commiteó. En este entorno regenera el catálogo de los 70 módulos
  con otro orden y 5 módulos menos (diferencia de entorno). El catálogo de índices/FKs del ORM no
  incluye todavía `pharmacy_on_call_shifts`; correrlo con el workspace completo.
- **`gen_ddl.py all`**: con esta bóveda cambia FKs de ~30 módulos ajenos; se regeneró sólo el 24 y
  no se commiteó `_generation_report.md`.
- **`check-max-lines`**: `pharmacy.types.ts` quedó en 665 líneas (techo 661) y `navigation.map.ts`
  en 2087 (techo 2080); el baseline ya tenía 55 archivos por encima. El simulador nuevo se separó
  a `pharmacy-opening-hours.handlers.ts` para no engordar `pharmacy.handlers.ts`.
- La vigencia la decide el reloj de la API; no se probó deriva de reloj.

## Desvíos del plan

- Plan y reporte viven en el repo de la API; modelo y front se referencian desde acá.
- En este worktree, `node_modules` de la API pasó de symlink a carpeta de symlinks sin `.cache`
  (la caché de metadata de MikroORM era compartida con los otros worktrees). No se commitea.
- La integración necesitó `dist/` construido y `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1` (el mismo
  arreglo de entorno que usó P51).
- La regeneración de OpenAPI arrastró diferencias de documentación de `practice` y
  `terminology` que estaban pendientes en `dev` (derivado regenerado, no editado).

## Riesgos residuales

- Si el colegio publica un rol oficial, hay que decidir su relación con el declarado (D1).
- El EXCLUDE usa el UUID determinista de `pharmacy:ON_CALL_SHIFT_ACTIVE`; renombrar esa clave
  rompe la protección (comentado en `pharmacy.concepts.ts` y en `diagram_33`).
- Seguridad (90.6): amenaza = una farmacia carga turnos en la sede de otra o publica un turno
  indefinido. Controles = `PharmacyTenantScopeGuard` + `requireManagedPharmacy` + sede de la
  farmacia de la ruta (404 uniforme), CHECK 72 h, filtro de vigencia en la consulta. Riesgo
  residual: una farmacia puede declarar 24 h sin serlo (no hay verificación externa): se publica
  como «declarado por la farmacia».
