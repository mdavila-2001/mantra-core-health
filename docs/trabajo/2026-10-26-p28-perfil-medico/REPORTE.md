# Reporte — P28: el perfil del médico llega a los campos de su registro

> **AVANCE: 10 / 10 — 100 %.** (microtareas HECHO / total; la prueba visual en navegador NO se ejecutó, ver «No cubierto»)

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `wt/p28` → `claude/elegant-goodall-0wu6ci` (API y frontend)
- Peldaño: API **VERIFIED** contra Postgres real (`mantra_p28`) por integración; frontend **TESTED** (vitest dirigido +
  typecheck), sin prueba visual.
- Modelo: **sin cambios** — `common.identifiers.value` existe y no tiene índice único; no hacía falta columna.

## Qué había y qué faltaba (contra `origin/dev`)

| Campo del registro | Antes | Ahora |
|---|---|---|
| Sexo al nacer | Ya se leía y escribía en `PATCH /profiles/practitioners/me` | Igual; ejercitado en la integración |
| Departamento emisor | Ya se leía y escribía | Igual; ejercitado en la integración |
| Correo de trabajo | Ya se leía y escribía (contacto `EMAIL × WORK`, no la credencial) | Igual; ejercitado en la integración |
| **Número del documento** | Se leía; el `PATCH` lo rechazaba (400) | Se corrige mientras la identidad no está verificada ni en verificación |
| Consultorio propio | Resuelto en P32 | Sin cambios |
| Corrección por la plataforma | No existía | `PATCH /profiles/practitioners/:profileId` (titular o `SECURITY_ADMIN`/`SUPERADMIN`) |

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `nationalId` en el DTO con el formato del alta, no vacío, ≤ 40 | `yarn test src/modules/profiles` | PASS — `evidencia/unit.txt` |
| H1.S1.M2 | Corrección del número; 409 `NATIONAL_ID_LOCKED_BY_VERIFIED_IDENTITY` con aserción vigente | ídem | PASS |
| H1.S1.M3 | `identityVerified` en la lectura propia; ruta de plataforma `:profileId` | ídem | PASS |
| H1.S1.M4 | 409 también con caso de verificación no terminal (revisión de seguridad) | ídem + integración | PASS |
| H1.S1.M5 | Cierra la fila vigente y abre otra; la vieja conserva su número (revisión de seguridad) | ídem + integración | PASS |
| H1.S2.M1 | Integración real, 6 escenarios | `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1 DB_NAME=mantra_p28 … yarn test:integration test/integration/practitioner-profile-identity-fields.int-spec.ts --testTimeout=600000` | `Tests: 6 passed, 6 total` — `evidencia/integracion.txt` |
| H1.S3.M1 | OpenAPI y referencia de endpoints regenerados | `yarn docs:openapi:generate` · `node tools/docs/generate-endpoint-markdown.mjs` | `EXIT=0` |
| H2.S1.M1 | Tipos, cliente y simulador con el contrato (`nationalId`, `identityVerified`, 400, 409) | `yarn ng test --watch=false --include=…` (3 specs) | `Tests 304 passed (304)` — `evidencia/front-tests.txt` |
| H2.S1.M2 | Editor: campo editable sin verificar; renglón fijo + motivo con verificación; diff mínimo | ídem | PASS |
| H2.S1.M3 | Catálogo de claves del simulador regenerado | `node scripts/gen-mock-contract.mjs ../mantra-core-health-api/openapi/openapi.json` | 3 líneas de diff |

Gates: API `yarn typecheck` `EXIT=0`, eslint de lo tocado `EXIT=0`; front `yarn typecheck` `EXIT=0`, eslint de lo tocado `EXIT=0`.

## A medias

ninguna

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| Prueba visual del editor (3 viewports × 2 temas) | TODO | Navegador con `ng serve` y el `visual-quality-gate`; no se levantó en esta sesión (máquina compartida por 12 agentes) |

## Evidencia

```text
$ yarn test src/modules/profiles src/modules/identity_assurance/repositories
Test Suites: 30 passed, 30 total
Tests:       590 passed, 590 total

$ … yarn test:integration test/integration/practitioner-profile-identity-fields.int-spec.ts --testTimeout=600000
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
EXIT=0

$ yarn ng test --watch=false --include='**/practitioner-profile-edit.spec.ts' --include='**/profiles-propios.handlers.spec.ts' --include='**/profiles.client*.spec.ts'
 Test Files  3 passed (3)
      Tests  304 passed (304)
```

Escenarios de la integración (API y base reales):
1. El titular corrige sexo, número, departamento y correo de trabajo; la relectura los trae; en la base queda una sola
   fila vigente (la nueva) y la vieja cerrada **con su número original**; el login sigue siendo el correo.
2. `nationalId` con `'` o vacío → 400 y la fila no cambia.
3. Otro profesional sobre `PATCH /profiles/practitioners/:profileId` ajeno → **403**, la fila no cambia.
4. Sin token → 401.
5. La plataforma (`SECURITY_ADMIN`) corrige el documento de otro → 200; el titular lo ve al recargar.
6. Caso de verificación abierto por autoservicio (`POST /identity/me/practitioner/identity-verification`) → 409 y la
   fila vigente es la misma; caso asertado + aserción vigente → `identityVerified: true` y 409; el mismo número → 200;
   el departamento se sigue corrigiendo.

## Seguridad (regla 90.6)

| Amenaza | Control | Dónde | Test | Resultado |
|---|---|---|---|---|
| Un profesional edita el perfil de otro (BOLA) | `assertOwnsPractitionerProfile` antes de escribir | `profiles-practitioners.service.ts` `updatePractitionerProfile` | integración esc. 3 + unit | 403, sin escritura |
| Cambiar la CI ya verificada deja una aserción que certifica otro documento | 409 si hay aserción vigente | `fixNationalId` | integración esc. 6 + unit | 409 |
| **TOCTOU**: cambiar la CI con un caso en curso que luego se aserta sobre un número que nadie revisó | 409 si hay caso no terminal (`OPEN`, `IN_VERIFICATION`, `AT_RISK`, `MANUAL_REVIEW`, `VERIFIED`) — `findOpenIdentityCaseForPerson` | `identity-assertions.repository.ts`, `person-records.adapter.ts`, `fixNationalId` | integración esc. 6 (caso real) + unit | 409, fila intacta |
| **Mutación en sitio** de un identificador referenciado (`tenant_legal_representatives.ci_identifier_id`, `tenant_affiliation_documents.identifier_id`) | Cierra la fila vigente (`valid_to`) y abre otra, como el NIT | `fixNationalId` | integración esc. 1 (la cerrada conserva el número) + unit | PASS |
| Entrada maliciosa en el número | `@Matches(/^[A-Za-z0-9.-]+$/)`, `@MaxLength(40)`, `@IsNotEmpty`, whitelist global | DTO | DTO spec + integración esc. 2 | 400 |
| Datos personales en logs | El log sólo lleva `actorId`/`profileId` | servicio | lectura de código | — |

Riesgo residual: el chequeo «sin caso abierto» y la escritura no comparten lock con la apertura de un caso
(`identity_assurance`); una apertura concurrente en la misma ventana podría colarse. Aceptado para una corrección de
tipeo; anotado.

## No cubierto

- **Prueba visual en navegador** del editor: no se ejecutó. Front en `TESTED`.
- El paso «autoridad despacha y responde» se reemplazó en el test por un **fixture SQL** (caso → `ASSERTED` + fila en
  `identity_assertions` con las columnas que escribe `IdentityChecksService`): `POST /internal/identity/checks/:id/attempts`
  respondió 422 al administrador de pruebas para un caso de autoservicio. Esa 422 no se diagnosticó (fuera de P28).
- La ruta de plataforma no tiene pantalla en el frontend; sólo API.
- El departamento emisor, cuando el número no cambia, se sigue corrigiendo en el lugar (comportamiento previo de
  `dev`): la observación de «mutación en sitio» aplica también a ese metadato; queda anotado.
- Suites completas de API y front: no se corrieron; sólo las dirigidas.

## Desvíos del plan

- La decisión 2 (editar en el lugar) se revirtió por la revisión de seguridad: ahora cierra y abre.
- Se agregaron H1.S1.M4/M5 (seguridad) y H2.S1.M3 (catálogo del simulador; sin él la maqueta daba 400 a `nationalId`).

## Entorno (ENVIRONMENT, reproducido y acotado)

- `yarn test:integration` desde un worktree falla con `MetadataError: Metadata for entity CatalogConcepts not found`.
  Causa: `workerIdleMemoryLimit` hace que Jest corra la suite en un proceso hijo sin `.ts` en `argv`, así que
  `Utils.detectTypeScriptSupport()` de MikroORM da `false`, se usan los globs de `dist/` (inexistente) y no se descubre
  ninguna entidad. Se destrabó con `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1`, sin tocar código. Además `node_modules` del
  worktree se montó con `mount --bind` y su `.cache` sobre un directorio privado, para que la caché de metadata no
  apunte a otro checkout.
- `--testTimeout=600000` sólo en la línea de comandos: el `beforeAll` arranca la app y siembra; con la máquina en
  carga 8 sobre 4 CPU la primera corrida pasó los 180 s (log: insert de 4,4 s). Con caché caliente, 29,6 s.

## Riesgos residuales

- Ver «Seguridad» (ventana de concurrencia) y la mutación en sitio del departamento.

## Decisiones y ambigüedades

1. **El número se corrige sólo sin identidad verificada ni en verificación.** Descartado: siempre editable. Confirmar
   con producto si quiere un trámite de re-verificación.
2. **Cierra y abre la fila** en vez de editar en el lugar.
3. **Correo de trabajo editable como contacto** (ya lo era); no es la credencial de acceso.
4. **Sin unicidad del número**, como el alta del profesional (misma cédula en dos departamentos son dos documentos).
5. **Ruta de plataforma** con el mismo DTO, autorizada por `ProfileOwnershipService` (`SECURITY_ADMIN`, `SUPERADMIN`).
6. Simulador: ningún profesional simulado tiene identidad verificada (como un médico recién registrado).
