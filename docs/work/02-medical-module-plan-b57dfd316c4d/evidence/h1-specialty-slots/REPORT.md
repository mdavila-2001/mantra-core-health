# Evidencia H1 — límite y catálogo de especialidades (L0174)

Fecha: 2026-09-24
Fuente funcional: `02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`
Rama FE/API: `justin/medical-module-execution-20260924`
Commits publicados: FE `444e915e`, API `5ff4bfe8`

La fuente dice: tres espacios de especialidad adicionales a la profesión y lista de especialidades que no se filtra por profesión. La implementación anterior imponía un máximo total de tres en la API y filtraba el catálogo del alta. La actualización deja cuatro como máximo total (principal más tres adicionales), aplica el mismo límite a registro, onboarding y editor del perfil, mantiene el catálogo completo al cambiar la profesión y conserva las opciones seleccionadas.

| Verificación | Resultado | Límite |
|---|---|---|
| API RED antes del límite | 3 suites; 4 pruebas fallaron y 184 pasaron: DTO registro, DTO onboarding, onboarding de servicio y cuarta especialidad en perfil rechazaban el total 4. | Dobles; no prueba PostgreSQL. |
| FE RED antes del catálogo sin filtro | 1 spec; 6 pruebas fallaron de 99 al esperar que el catálogo permaneciera completo y que no se borraran las selecciones al cambiar profesión. | Prueba de componente. |
| API GREEN | `corepack yarn test --runInBand --no-cache src/modules/iam/dto/register-practitioner.dto.spec.ts src/modules/profiles/dto/create-practitioner.dto.spec.ts src/modules/profiles/services/profiles-practitioners.service.spec.ts` — 3 suites, 189/189. | No integra base de datos. |
| FE GREEN | `corepack yarn test --watch=false --include=src/app/features/auth/register-practitioner/register-practitioner.spec.ts --include=src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts` — 2 archivos, 186/186. | Catálogos/HTTP simulados; no captura. |
| Typecheck y lint focal | `corepack yarn typecheck` y ESLint dirigido en ambos worktrees: exit 0. | No equivalen a regresión de repositorio. |
| OpenAPI | `corepack yarn docs:openapi:lint` válido; `corepack yarn docs:openapi:check-breaking --base /tmp/mch-medical-openapi-base-20260924.json --head openapi/openapi.json` sin cambios incompatibles no aprobados; `jq` verificó `maxItems: 4` en `AssistedPractitionerRegistrationDto`, `RegisterPractitionerDto` y `CreatePractitionerDto`. | `docs:openapi:generate` no arrancó: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` no están definidos. No se leyó `.env` ni se usaron los PostgreSQL ajenos observados. YAML y JSON se actualizaron al contrato DTO y ambos validan. |
| Regresión FE completa | `corepack yarn test --watch=false` — 579 archivos; 552 aprobados, 27 fallidos, 7.115 pruebas aprobadas y 3 fallidas. | 24 suites no arrancaron por `ENOSPC`. Tres assertions funcionales fallaron en `shell-layout` (2) y `pestanas-del-perfil-medico` (1, campos `gpsTrabajo`/`workAddressLines`); están fuera del diff y no se modificaron. |
| Lint global FE | `corepack yarn lint` — 246 errores `@angular-eslint/prefer-on-push-component-change-detection`. | Repo-wide y ajenos a los archivos tocados; el lint dirigido sí pasa. |

No se ejecutó Chromium→API→PostgreSQL→recarga para este incremento y no hay foto. L0174.AC01/AC02 siguen `A MEDIAS / TESTED`; MED-E01 y el total de plan siguen 10/98 `HECHO`. No se usó una base compartida, no se modificaron `.env`, `proxy.conf.json`, modelo ni DDL.
