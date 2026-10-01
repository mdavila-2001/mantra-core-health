# Evidencia parcial H1: dirección laboral durante el alta profesional

- Fecha: 2026-09-24.
- Fuente funcional única: `02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.
- Líneas fuente: L0180–L0185 (domicilio, GPS del domicilio, dirección de trabajo y GPS de trabajo).
- Ramas publicadas: FE `justin/medical-module-execution-20260924`, commit `18b05cc3`; API con el mismo nombre, commit `aa609a86`.

## Cambio

El alta de profesional ahora pregunta por dirección laboral y ubicación GPS en un paso propio, separado de la casa y del consultorio propio. El cliente HTTP incluye los nuevos campos en su cuerpo explícito; la API valida la dirección y exige que ambas coordenadas viajen juntas. La transacción del alta escribe la dirección laboral como otra fila de `common.addresses` con uso `ADDR_USE_WORK`, mientras conserva la fila del domicilio con `ADDR_USE_HOME`. No se modificaron identidad, alta de Paciente, modelo ni DDL.

## Verificación

- Frontend: `corepack yarn test --watch=false --include=src/app/features/auth/register-practitioner/register-practitioner.spec.ts` — 1 archivo, 98/98 pruebas aprobadas. Cubre paso laboral, cuerpo HTTP, independencia de domicilio y consultorio propio, y coordenadas confirmadas como par.
- Frontend: `corepack yarn typecheck` — exit 0; ESLint dirigido a cliente, tipos y alta — exit 0.
- API: `corepack yarn test --runInBand src/modules/iam/dto/register-practitioner.dto.spec.ts src/modules/iam/services/iam-practitioner-self-registration.service.spec.ts` — 2 suites, 104/104 pruebas aprobadas. Comprueba validación de par/rango y que se escriban filas HOME y WORK separadas dentro del mismo alta.
- API: `corepack yarn typecheck` y ESLint dirigido a DTO/servicio/spec — exit 0.
- El test-first detectó el hueco: antes del cambio el DTO rechazaba los tres campos y el servicio sólo escribía la fila HOME. En la primera verificación FE el cliente explícito descartó los campos laborales; al incorporarlos, la suite dirigida quedó verde.

## Límite y estado

Esta evidencia es unitaria/de componente. No se corrió navegador contra una API real con PostgreSQL ni se guardó una captura de este cambio. Por ello no demuestra persistencia tras recarga, despliegue visible, permisos entre actores ni MED-E03 completo. No se elevó ningún criterio a `HECHO`; MED-03, MED-E03, H1 y el plan total permanecen parciales. La suite FE completa tampoco se volvió a ejecutar en esta continuación; la última corrida completa documentada terminó por `ENOSPC`.
