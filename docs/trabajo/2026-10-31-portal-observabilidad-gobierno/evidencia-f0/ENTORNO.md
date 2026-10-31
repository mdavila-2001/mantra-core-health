# Entorno real local F0 (31/10/2026)

Postgres 16 real (sin TimescaleDB) + Redis + API NestJS compilada, para que los carriles verifiquen
contra base de datos y no contra el simulador. Montado por el carril INFRA.

Scripts y logs: `/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f0-env/`
(en adelante `$F`). Todo se ejecuta como `root`.

## Arrancar / parar

```bash
F=/tmp/claude-0/-home-user/e193d5cf-24a3-5ae3-aa33-d49093c0d1e4/scratchpad/f0-env
$F/start.sh        # Postgres (5544) + Redis (6390) + API (3010); idempotente; ~15 s
$F/stop.sh         # para API, Redis y Postgres
$F/check-tokens.sh # login real de las 3 cuentas; imprime roles y tenants del JWT
```

- La API corre desde `dist/` (`node dist/src/main.js`), **compilada el 31/10 antes de que los demás carriles
  cambiaran `src/`**. Para ver cambios del API: `cd /home/user/mantra-core-health-api && corepack yarn build`
  (~3 min, necesita ~8 GB de heap; `with-heap.mjs` ya lo fija) y luego `$F/stop.sh && $F/start.sh`.
  `yarn start` (nest start) murió por memoria compilando; por eso se usa `dist/`.
- El `.env` de la API es `/home/user/mantra-core-health-api/.env` (ignorado por git; copia en `$F/api.env`,
  `start.sh` la vuelve a copiar). No se commitea.
- Logs: `$F/logs/api.log`, `$F/logs/pg.log` (enlace a `/var/lib/pgf0-f0/pg.log`), `$F/logs/redis.log`.

## Servicios

| Servicio | Dirección | Notas |
|---|---|---|
| PostgreSQL 16.15 | `127.0.0.1:5544`, DSN `postgresql://salud:mantra@127.0.0.1:5544/salud` | cluster en `/var/lib/pgf0-f0/data`, usuario del SO `pgf0` |
| Redis | `127.0.0.1:6390` | |
| API | `http://127.0.0.1:3010` | `GET /health` -> `{"status":"ok"}`; login en `POST /iam/auth/login` |

El cluster NO está en el scratchpad: el arnés vuelve a poner `/tmp/claude-0` en modo 700 entre llamadas y
`pgf0` (Postgres no arranca como root) perdía el acceso.

## Cuentas (clave de todas: `12345678`)

| Cuenta | Roles en el JWT | Tenants | Para |
|---|---|---|---|
| `admin@alovidasalud.com` | `SECURITY_ADMIN`, `SUPERADMIN` | 2 (Default Tenant `1befcfea-44c0-563a-81cd-337ec6acc840`, Org F0 Dos `8d964005-53b1-448c-8016-9a6f13a45ed8`) | kill-test con 2 membresías activas |
| `plataforma@alovida.test` | `USER`, `PLATFORM_ADMIN` | 0 | alcance de plataforma sin tenant |
| `medico2org@alovida.test` | `USER`, `PRACTITIONER` | 2 (mismas dos) | médico con 2 membresías, sin rol de plataforma |

IDs de usuario: admin `7bc62907-e69f-4938-bfb1-eb3a5fb2be55`, plataforma `6b62ee0b-c9bc-49e8-9ead-22edc5ff730c`,
médico `be314734-8e85-4591-978a-39096145e9fe`.

Cómo se crearon (todo por API real salvo una fila): `$F/seed-accounts.sh` -> `POST /iam/users` (x2),
`POST /admin/tenants` (Org F0 Dos, tipo PROVIDER, Bolivia), `POST /tenants/:id/memberships` (admin en Org 2,
médico en Default), `POST /iam/users/:id/global-roles` (PRACTITIONER). **PLATFORM_ADMIN no tiene endpoint**:
`global-roles` solo admite USER..SUPPORT_STAFF y no existe concepto global `PLATFORM_ADMIN`; se concedió con una
fila parametrizada en `authz.user_role_assignments` (`$F/grant-platform-admin.sql`, `-v uid=… -v admin=…`),
que es lo que lee `AuthzEffectiveRolesService` al emitir el JWT.

## Esquema

Orden aplicado (todos desde `/home/user/mantra-core-health-model`, modelo sin editar):
1. `SQL/apply_all.sql` (40 s) y `SQL/apply_deferred.sql`: sin errores.
2. `SQL/patches/*.sql` en orden de nombre (LC_ALL=C), cada uno en su transacción: 121 de 122 aplican, incluidos
   v4275, v4278, v4279. El README del modelo no fija otro orden. El único fallo:
   `2026-07-25_v407_nullable_embedding_model_versions.sql` (`schema "vector_rag" does not exist`; ese módulo
   es NoSQL/pgvector y no está en `SQL/`; irrelevante).
3. `NoSQL/58_time_series_timescaledb/time_series.timescaledb.sql`, **copia filtrada** en
   `$F/time_series.no-timescale.sql` sin `CREATE EXTENSION timescaledb`, `create_hypertable` ni `add_dimension`.
   Sin esto `time_series.service_sli_series` no existe y `/admin/ops/traffic` da 500 y el volcado SLI se descarta.
4. Seed del API: `ORM_SCHEMA_SYNC=off` (con `safe` el bootstrap intenta crear tablas de `vector_rag` y muere por
   `type "vector" does not exist`), luego `node dist/src/seed-cli.js` (`$F/seed.sh`, ~10 min la primera vez,
   idempotente). Resultado: `ok: 36, failed: 1`. Falla `profiles.admission_requirements` (tabla ausente en el
   modelo SQL). Avisos: roles `PHARMACY_OPERATOR`, `LAB_OPERATOR`, `RADIOLOGIST`, `INSURANCE_OPERATOR` no
   declarados en `authz.roles` (cuentas de socios sin rol).

## Limitaciones

- **Sin TimescaleDB**: `time_series.*` son tablas normales, sin hypertables, retención, compresión ni
  continuous aggregates (`continuous_sli_hourly/daily` no existen). La API lo tolera: `physical.catalog.ts`
  marca los pasos de hypertable con `requiresExtension: 'timescaledb'` y los omite. El SLI HTTP se escribe y se
  lee de la tabla plana; rendimiento y retención de producción no se prueban aquí.
- **Sin pgvector**: no existe el schema `vector_rag` con sus tablas; cualquier módulo que lo use fallará.
- `RLS_ENFORCE=false`: la API conecta como dueño `salud`, así que la RLS de tenant (patch `tenant_rls`, rol
  `mantra_app`) está creada pero **no se ejerce**. Pruebas de aislamiento por RLS no valen en este entorno.
- Sin MongoDB, MinIO, OpenSearch ni SMTP: lo que dependa de ellos no se ejercita.
- `.env`: `OBSERVABILITY_HTTP_SLI_ENABLED=true`, `OBSERVABILITY_HTTP_SLI_FLUSH_SECONDS=10`, `JWT_ACCESS_TTL=60m`,
  `BOOTSTRAP_ADMIN_*` y `SEED_DEMO_PASSWORD=12345678`, secretos de desarrollo.

## Comprobaciones (salidas reales, 31/10/2026)

```
GET  /health                              -> {"status":"ok"}
$F/check-tokens.sh                        -> tabla de cuentas de arriba (tras parar y volver a arrancar todo)
GET  /admin/ops/traffic (admin)           -> 200; measured.requests=9, client4xx=8, lastDataAt=2026-10-31T08:21:00Z
                                             (service_sli_series con 2 filas tras el flush de 10 s)
GET  /admin/ops/traffic (plataforma, sin X-Tenant-Id)              -> 200
GET  /admin/ops/traffic (plataforma, X-Tenant-Id=Default Tenant)   -> 403
GET  /admin/ops/traffic (admin, sin / con X-Tenant-Id)             -> 200 / 200
```

Los 403/200 de arriba son del código compilado en `dist/` en el momento del montaje, sin los cambios de los otros
carriles. Reconstruir para medir el estado actual de `src/`.
