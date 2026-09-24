# Plan — guardar el PDF en cada credencial profesional

- Fecha: 2026-09-24 · Repo: `mantra-core-health` · Hito fuente: H1, MED-04, MED-E01 · Fuente única: `/Users/josejeremias/Downloads/02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.
- Resultado observable: cada fila académica puede llevar un PDF que queda vinculado a esa credencial durante el alta, y la pantalla no afirma que el adjunto se descartará.
- Base: `origin/dev` commit `473d5ef1fbb01c9eaf512ff46261f4c9e704f3d2`; rama aislada `justin/medical-module-execution-20260924`.
- Dependencia API: H1.S1.M3-API-05 en `wt-medical-execution-api`; el backend ya acepta un fileId de la pre-carga PDF existente y lo reclama al usuario en transacción.

## Alcance

- IN: usar `IamClient.uploadRegistrationDocument` para los PDFs de filas académicas; enviar el fileId con el tipo y número correctos; conservar la fila si hay fallo; actualizar el texto de alcance para decir sólo lo que sí persiste.
- OUT: guardar nombre de título, país o ciudad, porque no los exige la fuente Médico y no hay columna/contrato confirmado para esos valores; matrícula/colegio y sus catálogos; pantallas Paciente; pagos/delivery; `.env` y `proxy.conf.json`.
- Sin DDL ni cambio de modelo: `professional_credentials.file_id` ya existe.

## H1-FE.S1 — Alta con adjuntos vinculados

**CA:** Dado uno o más títulos declarados con PDF, cuando se envía el registro, entonces cada archivo sube una vez y el fileId viaja con su propia credencial. Si falla una subida, el alta no se envía y los datos quedan para reintento.
**DoD:** test de componente del cuerpo y asociación por fila; test de secuencia de subida y fallo; Playwright `--workers=1` con captura revisada; `corepack yarn test --watch=false --include=src/app/features/auth/register-practitioner/register-practitioner.spec.ts`; `corepack yarn typecheck`; ESLint dirigido y build con `corepack yarn`, ejecutados en worktree temporal sin leer `.env`.
**Estado:** HECHO — 97 pruebas del componente, 4 pruebas Playwright, typecheck, ESLint y build; captura revisada en `evidence/alta-titulos-movil.png`.

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1-FE.S1.M1 | Escribir specs RED para PDFs de dos filas, reintento de archivo ya subido y fallo que impide el alta. | Cada fila conserva su fileId; error no produce POST de alta. | RED: 4 pruebas fallidas / 93 aprobadas / 97 totales por fileId ausente, subida omitida y texto desactualizado. | HECHO |
| H1-FE.S1.M2 | Subir secuencialmente los PDFs a la ruta existente y agregar sus fileId a `credentials[]`. | El body asocia cada fileId con el número y tipo de su propia fila. | Spec dirigido: 97/97; Playwright: 4/4 con `--workers=1`. | HECHO |
| H1-FE.S1.M3 | Corregir la explicación visible de lo que se guarda y del error de subida con organismos existentes. | El texto no dice que el PDF se descarta; la falla queda visible y los campos sobreviven al reintento. | Texto accesible revisado en screenshot móvil; typecheck, ESLint y build exit 0. | HECHO |

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La pre-carga anónima se creó para documentos PDF de organizaciones. | Un archivo incorrecto o ya reclamado podría vincularse a la credencial. | Mitigado: la API exige PDF/`DOCUMENT`, reclama al usuario en transacción y rechaza la reutilización; integración verificada. |
| Una subida se completa y otra falla. | El PDF completado quedaría sin vínculo hasta el reintento; si la persona abandona el alta, queda una precarga anónima. | El `fileId` se conserva y se reusa al reintentar. El barrido de precargas abandonadas ya es deuda general del endpoint y queda fuera de la fuente Médico. |
| El DTO API aún no acepta fileId. | `ValidationPipe` rechaza el alta. | Resuelto: API-05 acepta y valida `credentials[].fileId`; OpenAPI refleja el campo. |
