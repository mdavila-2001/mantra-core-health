---
name: alovida-test-listo-para-vender
description: La cadena de requisitos para que un flujo clínico (alta de médico o paciente, agenda, consulta, receta, farmacia) funcione de punta a punta en LOCAL, y cómo comprobar cada eslabón con el síntoma exacto que da cuando falta. Usar cuando "la pantalla sale vacía", un 500 en un alta, un 403 con rol correcto, un catálogo sin opciones, o antes de decirle a Pablo que el entorno está listo para probar un flujo.
---

# Entorno listo para un flujo clínico: eslabón por eslabón

Portada de `atlas-test-listo-para-vender` (allí: una compra con QR; aquí: un flujo clínico). La lección
es la misma: **un entorno limpio no arranca en estado de probar**. "La API responde 200 en `/health`" no
prueba ningún eslabón. Para cada uno: síntoma, cómo comprobar, quién lo pone. Sin captura/SQL no hay
"hecho" (`NO_EVIDENCE_NO_DONE`; mutaciones: UI → request → response → SQL → recarga).

## La cadena (en orden)

| # | Eslabón | Síntoma si falta | Comprobar | Cómo se pone |
|---|---|---|---|---|
| 1 | Dependencias **sin clamav** | `docker compose up -d` aborta entero (imagen sin arm64) | `docker ps` → `mantra-redesa-postgres-1` (host 5434), redis, minio, mongo, opensearch | `docker compose up -d postgres mongodb redis opensearch minio` en el repo de la API. Si minio/mongo/opensearch no bajan, los flujos con archivos/NoSQL/búsqueda son BLOQUEO DE ENTORNO: decirlo, no maquillar |
| 2 | **DDL al día** | `column "…" of relation "…" does not exist` en un INSERT/UPDATE (el `select p0.*` de lectura no lo delata; el 500 sale solo al escribir ese campo) | `docker exec mantra-redesa-postgres-1 psql -U mantra -d mantra_redesa_health -tAc "\d profiles.persons"`; `grep ORM_SCHEMA_SYNC .env` (local = `dry-run`: NO aplica nada) | Parche idempotente en `mantra-core-health-redesa-api/database/SQL/patches/AAAA-MM-DD_v42N_<tema>.sql` (solo `patches/` lo aplica el init; `99_migrations` es nombre viejo) y aplicarlo al stack vivo. `ORM_SCHEMA_SYNC=safe` solo en Coolify |
| 3 | **API arriba y sana** | Front con proxy 504/ECONNREFUSED | `curl localhost:3000/health` → `{"status":"ok"}`; log `/private/tmp/api.log` | `yarn start` en la API (si `ENOTEMPTY … rmdir dist/…`: borrar `dist/`). Si cambias código: reinicio con cuidado, esperar `/health` |
| 4 | **Catálogos sembrados** (cadena de 18 pasos) | `select` sin opciones; "value set" vacío; roles/permisos ausentes → 403 | `select count(*) from terminology.value_sets` (113 hoy), `select code from authz.roles` (CLINICIAN, BILLING…), `profiles.persons` etc. | `SEED_ON_BOOT`/`SEED_CONTENT_ON_BOOT` (por defecto activos) o `yarn seed:boot`. Código: `src/common/seed/seed-bootstrap.service.ts` |
| 5 | **Admin de bootstrap** | No hay con quién dar de alta al primer médico | login con `BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD` (en `.env`; `ALLOW_PRODUCTION=false`) | Lo crea `bootstrap-admin-seed.service.ts` al arrancar |
| 6 | **Front REAL, no mock** | Todo "funciona" pero sin tocar la API (mockBackend) | `environments`: `mockBackend:false`; Network muestra `/iam/…` hacia :3000 vía `proxy.conf.json` | `node scripts/generate-env.mjs && node scripts/generate-component-index.mjs`, luego `ng serve --port <propio> --proxy-config proxy.conf.json`. Puerto propio (4300+), nunca el de otra sesión |
| 7 | **Profesional creado por el camino real** | Login imposible tras un INSERT SQL (una fila en `iam.users` no es identidad); registro público en 500 | Login real con la cuenta; token con `hpid` | Alta asistida `POST /iam/users/assisted-practitioner-registration` (admin) + activación con token de un solo uso, como `tools/redesa/cuenta-doctor-demo.mjs` / `tools/e2e/seed-e2e.mjs`. Cuentas de prueba: `e2e.<rol>.<timestamp>@alovida.test` |
| 8 | **Rol clínico correcto** | 403 con rol "casi" correcto; SUPERADMIN pasa por comodín y **falsea el verde** | Probar con la cuenta del actor (`yarn redesa:personas` falla con 5xx o 4xx sin `code`) | Roles/permisos de `authz.seed.ts`; permisos de plataforma en `authz-platform-permissions-seed.service.ts` |
| 9 | **Especialidad/vitrina del profesional** | Directorio público vacío; `/p/<slug>` da 404 | `profiles.practitioner_specialties`, vitrina publicada | `yarn seed:vitrina`, `tools/redesa/seed-vitrina-publica.mjs`; publicar con la sesión de la titular |
| 10 | **Conceptos reales, no placeholders** | Filas en BD que **no se ven** (todo `*_concept_id` apunta a `DEFAULT_*`) | Cualquier consulta filtra por `community:PROFILE_VISIBILITY_PUBLIC`, `ACTIVE`, `profiles:PRACTICE_ACTIVE`… | Si se cargó el mock de `mantra-core-health-model/seedsGenerales` (`load_seeds.py`): correr `salud-db/demo/00…02` (idempotentes). El mock es válido contra el esquema, no contra el dominio |
| 11 | **Paciente con documento y contacto** | Alta de paciente en 500 por columna nueva (ver #2); cédula/NIT inválidos | `profiles.persons` con la fila; login del paciente | Registro del front (4 campos por página, `app-paginated-form`) o API |
| 12 | **Agenda/consulta/receta** | Sin slots; cita sin precondición; receta sin medicamento | `scheduling.*`, `clinical.encounters`; vademécum sembrado (`vademecum-seed.service.ts`) | Disponibilidad del profesional → cita del paciente → encuentro → receta; farmacia: `seed-farmacias-marketplace.mjs` |
| 13 | **Móvil → API local** | App móvil "sin conexión" con la API sana | `dart_defines/local-ios.json` (`API_BASE_URL=http://localhost:3000`); Network en el log de la app | `flutter run -d <UDID> --dart-define-from-file=dart_defines/local-ios.json` en el simulador (`xcrun simctl io <UDID> screenshot`) |

## Lo que NO se hace

- No dar el entorno por listo con solo `/health`: recorrer la cadena y decir QUÉ eslabones comprobaste.
- No sembrar usuarios con INSERT SQL ni aprobar/verificar profesionales saltándose el flujo (anula el control).
- No dar un verde obtenido con SUPERADMIN por prueba de permisos de un actor.
- No cargar el mock sobre una base ya sembrada por la cadena de la API (uuid5 distintos → conceptos duplicados, huérfanos).
- No tocar datos de otros: emails únicos de prueba; limpiar lo que crees.
- DDL fuera de git: la carpeta `SQL/` hermana no tiene git; en el repo de la API va `database/SQL/patches/`
  (+ `yarn db:vendor` / `db:vendor:check`). Avisar de todo cambio de esquema aparte del commit del código.

## Diagnóstico rápido por síntoma

| Síntoma | Primera sospecha |
|---|---|
| 500 solo al guardar un campo opcional | #2 columna ausente del DDL (`dry-run` local) |
| Lista vacía pero la BD tiene filas | #10 conceptos placeholder, no el código |
| 403 con el rol que "debería" | #8 permiso/rol no sembrado o se probó con otro actor |
| `select` sin opciones | #4 value set no sembrado o catálogo no expuesto por la API |
| Pantalla "bien" y sin requests | #6 mock activo |
| `ng serve` colgado / módulo viejo | `.angular/cache` compartido: puerto propio, o verificar con `ng test --include` |
| Login de la cuenta recién creada falla | #7 no pasó por activación del token |

Relacionado: `alovida-ui` (reglas de pantalla), `alovida-diseno`, `tools/redesa/README.md` (qué hace
cada seed), `docs/operations/coolify.md` (api-migrate en despliegue) y el `CLAUDE.md` raíz (multi-sesión).
