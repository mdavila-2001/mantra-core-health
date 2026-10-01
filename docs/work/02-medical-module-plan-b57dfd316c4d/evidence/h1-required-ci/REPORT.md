# Evidencia parcial H1: CI obligatorio para el profesional

- Fecha: 2026-09-24.
- Fuente funcional única: `02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.
- Líneas fuente: L0169 (CI obligatorio), L0170 (departamento emisor).
- Rama API: `justin/medical-module-execution-20260924`, commit `09af2caf`.

## Cambio

El DTO de alta profesional exige `nationalId` y `issuerAdministrativeAreaConceptId`. El servicio vuelve a comprobar que el departamento pertenezca a `VS_BO_DEPARTMENT` antes de escribir y persiste el identificador en cada alta válida. El caso de integración sin CI espera HTTP 400; los demás fixtures de alta profesional usan identificadores y departamentos sintéticos. El formulario FE ya exige CI y departamento, así que no se cambió en este incremento.

## Verificación

- Test-first: el test de DTO falló antes del cambio porque una alta sin `nationalId` no producía error de validación.
- API: `corepack yarn test --runInBand --no-cache src/modules/iam/dto/register-practitioner.dto.spec.ts src/modules/iam/services/iam-practitioner-self-registration.service.spec.ts` — 2 suites, 104/104 pruebas aprobadas.
- API: `corepack yarn typecheck` — exit 0.
- ESLint dirigido: `git diff --name-only -z -- '*.ts' | xargs -0 corepack yarn eslint` — exit 0 sobre los 30 TypeScript modificados.
- `git diff --check` — exit 0.

## Límite y estado

No se ejecutaron pruebas de integración contra PostgreSQL: `bootstrapTestApp()` llama a `resetBusinessData()`, que trunca los esquemas de negocio, y no se confirmó que la conexión configurada apunte a una base desechable aislada. No se leyó `.env` ni se tocó ninguna base/servicio compartido. No se hizo smoke navegador/API/DB ni se guardó captura para este requisito. El test de servicio usa dobles y no demuestra persistencia tras recarga. Por eso L0169 conserva `A MEDIAS / TESTED`; MED-E01, H1 y el plan total siguen parciales, con 10/98 criterios `HECHO`.
