# F0 — verificación del API contra Postgres real (31/10/2026)

Peldaño: `VERIFIED_FUNCTIONAL_ONLY` para estos casos (HTTP real contra la API compilada desde `ea2f70bb3` con Postgres 16 local, ver `ENTORNO.md`). **No** `REGRESSION_VERIFIED`. Limitaciones del entorno: sin TimescaleDB, `RLS_ENFORCE=false` y API conectada como dueño de la base, es decir, el aislamiento por fila de Postgres NO se ejerció; sólo la lógica de la API.

## Alcance de plataforma, `GET /admin/ops/*`
| Caso | HTTP | Motivo |
|---|---|---|
| `admin@alovidasalud.com` (SUPERADMIN, 2 organizaciones), sin `X-Tenant-Id` | 200 | |
| `plataforma@alovida.test` (PLATFORM_ADMIN global), sin `X-Tenant-Id` | 200 | |
| ídem, `/admin/ops/slos` | 200 | |
| plataforma con `X-Tenant-Id` de organización donde no es miembro | 403 | `TENANT_MEMBERSHIP_REQUIRED` |
| plataforma con `X-Tenant-Id` inventado | 403 | `TENANT_MEMBERSHIP_REQUIRED` |
| `medico2org@alovida.test` (2 organizaciones, sin rol de plataforma), sin cabecera | 403 | `TENANT_AMBIGUOUS` (sí elige organización) |
| ídem, con organización propia | 403 | `ROLE_INSUFFICIENT` (la ruta no es para su rol) |
| sin token | 401 | `UNAUTHENTICATED` |
| plataforma, `/admin/analytics/overview` sin cabecera | 403 | `TENANT_REQUIRED` (esperado: es la franja de telemetría F2) |

## Ingesta anónima, `POST /telemetry/activity-events` (esquema `df630ae0-…`)
| Caso | Resultado |
|---|---|
| ruta `/inicio`, clave K1, admin | 201 `inserted 1` |
| reenvío idéntico | 201 `inserted 0, skipped 1` (deduplica) |
| misma clave K1, otra persona | 201 `inserted 1` (no colisiona) |
| ruta con UUID | 422 `TELEMETRY_ANONYMOUS_ROUTE_INVALID` |
| parámetro `:a1234567890` | 422 `TELEMETRY_ANONYMOUS_ROUTE_INVALID` |
| filas guardadas | `user_id` y `session_id` nulos; clave de 64 caracteres (HMAC), nunca `K1` en claro |

## Pendiente
Navegador contra esta API (kill-test de entrada del front), `PLATFORM_ADMIN` sin endpoint de asignación (se concedió por SQL), TimescaleDB y RLS.
