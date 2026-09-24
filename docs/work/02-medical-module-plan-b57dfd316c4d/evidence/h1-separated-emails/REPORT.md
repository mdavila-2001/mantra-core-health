# H1 · Correos personales y laborales separados

Fecha: 2026-09-24. Fuente funcional: `02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`, líneas L0179 y L0186. Escenario asociado: MED-E03.

## Cambio verificado

El frontend de alta ya enviaba `email` como correo de acceso/personal y `workEmail` como correo del trabajo. La validación estricta del API rechazaba el campo adicional y el servicio clasificaba `email` como `CONTACT_USE_WORK`. El API ahora admite y valida `workEmail`: cuando está presente, el servicio guarda `email` con uso HOME y `workEmail` con uso WORK. Para clientes anteriores que no mandan ese campo, `email` continúa como WORK y el `personalEmail` opcional sigue disponible. La respuesta privada ya expone los contactos por uso; el editor del perfil prioriza `workEmail` y mantiene `email` como compatibilidad con respuestas antiguas.

Cambios publicados en `justin/medical-module-execution-20260924`:

- Frontend `bd6e4690f62c4269dd9a65e8e5b955fe6e68a857` (`fix: show explicit practitioner work email`).
- API `70f1cfff66545c6ca77323fcd0eccb5cdd26eb44` (`fix: keep practitioner emails separate`).

## Pruebas ejecutadas

| Repositorio | Comando | Salida |
|---|---|---|
| FE | `corepack yarn test --watch=false --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts` | 1 archivo, 86/86 pruebas aprobadas. Incluye caso con correo de acceso personal y `workEmail` diferente; el perfil muestra el laboral. |
| API | `corepack yarn test --runInBand --no-cache src/modules/iam/dto/register-practitioner.dto.spec.ts src/modules/iam/services/iam-practitioner-self-registration.service.spec.ts` | 2 suites, 107/107 pruebas aprobadas. DTO admite/rechaza `workEmail` inválido; servicio espera usos HOME y WORK distintos. El comportamiento legacy sin `workEmail` sigue cubierto. |
| FE/API | `corepack yarn typecheck`; ESLint dirigido a los TS afectados; `git diff --check` | Salida 0 en ambos worktrees. |
| Lectura propia del API | `corepack yarn test --runInBand --no-cache src/modules/profiles/services/profiles-practitioners.service.spec.ts` | 1 suite, 138/138 pruebas aprobadas; `workEmail` y `personalEmail` regresan desde usos HOME/WORK distintos. Commit API `924e8f03a53afc7c3cdb2dc7dbbf8107ba114b8b`. |

El ciclo test-first reprodujo ambos defectos antes del cambio: el editor usaba `email` como correo de trabajo aunque existiera un `workEmail` diferente, y el API rechazaba `workEmail` con whitelist estricta mientras guardaba `email` como WORK.

## Límite de evidencia

No se ejecutó PostgreSQL ni el recorrido navegador→API→persistencia→lectura tras recarga; tampoco se capturó pantalla en esta continuación. El harness de integración del API invoca una rutina que trunca esquemas de negocio y no se confirmó aislamiento de una base existente. No se conectó a una base compartida. Este informe no demuestra persistencia real, todos los contactos/direcciones del MED-E03, ni cumplimiento del escenario: L0179, L0186 y MED-E03 permanecen `A MEDIAS / TESTED`; no cambia el conteo 10/98 HECHO.
