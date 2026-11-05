# Revisión independiente del API F0 (31/10/2026)

Revisor: agente de código sin shell (solo lectura de fuentes, sin `git diff`, sin ejecutar pruebas). Veredicto: sin escalada ni fuga entre organizaciones en el alcance de plataforma; 9 hallazgos en telemetría y configuración. Disposición de cada uno:

| # | Sev. | Hallazgo | Disposición |
|---|---|---|---|
| 1 | Alta | La retención de 90 días del propósito agregado no se aplica (nada purga `user_activity_events`) | **Abierto.** Job de retención en F2 (carril App, 03 H2). Hasta entonces los eventos anónimos se acumulan: no activar `PUBLIC_UX_ANALYTICS_ENABLED` en producción |
| 2 | Alta | Sin índice único ni índice por clave de idempotencia; carrera entre dos lotes; los anónimos tienen `user_id` NULL | **Abierto, va al modelo (F1):** índice único parcial `(tenant_id, event_idempotency_key) WHERE user_id IS NULL` + manejo de la violación como duplicado |
| 3 | Alta | `TELEMETRY_IDEMPOTENCY_SECRET` no llegaba al contenedor | **Corregido:** variable agregada al servicio `api` de `docker-compose.coolify.yml` |
| 4 | Media | El secreto de desarrollo es público y valía en cualquier `NODE_ENV` no productivo | **Corregido:** solo vale en `development` y `test`; en cualquier otro entorno no se deduplica |
| 5 | Media | La ruta anónima valida una forma, no una lista de rutas reales (`/pacientes/maria-gonzalez` pasa) | **Abierto, aceptado temporalmente:** la lista real sale de `frontend_routes` sembrada por F2 (03 H2). Riesgo residual: texto casi libre en minúsculas de quien tenga sesión |
| 6 | Media | El evento anónimo guardaba `correlationId` elegido por el cliente | **Corregido** (se descarta) + prueba |
| 7 | Media | Cualquier propósito con `requires_consent=false` aceptaba eventos anónimos | **Corregido:** lista cerrada al id del propósito de uso agregado + prueba |
| 8 | Media | Un esquema `DEPRECATED` (412) o una ruta inválida (422) tumba todo el lote | **Parcial.** `DEPRECATED` ahora descarta el evento y sigue (cliente v1 desplegado); la ruta inválida mantiene el 422 por contrato explícito |
| 9 | Baja | Pruebas con `toThrow()` sin razón; sin prueba del camino `RLS_ENFORCE=true` | **Parcial:** las aserciones ahora exigen la razón (`TENANT_AMBIGUOUS` / `TENANT_MEMBERSHIP_REQUIRED`). El camino con RLS activa **no se probó** (este entorno corre con `RLS_ENFORCE=false`) |

Riesgo latente señalado: `@PlatformScopeOptional` va a nivel de clase; un método nuevo (sobre todo POST) heredaría el barrido de sistema. Mitigación a documentar en el README del módulo y en una prueba de arquitectura (pendiente).
