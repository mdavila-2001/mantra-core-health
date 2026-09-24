# Evidencia H2: dirección laboral y varias sedes propias

- Fecha: 2026-09-24.
- Fuente funcional: `/Users/josejeremias/Downloads/02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.
- Ramas de producto publicadas: FE `justin/medical-module-execution-20260924` en `5588753cc9b3c0a70ce2cf19e4eda6090e5635c4`; API con el mismo nombre en `982ed2b9a96a7a14afa4137b96847144c8f50726`.
- Criterios relacionados: `RP-MED-L0180`, `RP-MED-L0184`, `RP-MED-L0185` y `RP-MED-L0200`.

## Cambio ejecutado

El editor del perfil médico ofrece una dirección del lugar de trabajo y un mapa propio, aparte del domicilio personal. Al leer el perfil, mantiene los dos textos y pares GPS separados. Al editar, sólo envía el campo laboral cambiado; mueve sus coordenadas en par o envía dos `null` para quitarlas. La API expone `workAddress` únicamente en la lectura propia, valida rango y par, y reemplaza la dirección usando el concepto existente `ADDR_USE_WORK`. No se modificó modelo ni DDL.

En `work-history`, “Agregar mi consultorio propio” ya no desaparece luego de crear el primero. La prueba crea una segunda sede con `POST /practitioners/me/sites` y confirma que ambas continúan en la lista y el control de alta permanece.

## Verificación

- FE: `corepack yarn test --watch=false --include='src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.spec.ts' --include='src/app/features/account/my-profile/work-history/work-history.spec.ts'` — 2 archivos, 178/178 pruebas aprobadas. Incluye carga y distinción de direcciones, PATCH de texto laboral, lectura GPS separado, guardar/quitar el par de GPS y crear una segunda sede con sus coordenadas.
- FE: `corepack yarn typecheck` — exit 0; ESLint dirigido a los archivos TypeScript/spec modificados — exit 0.
- API: `corepack yarn test --runInBand src/modules/profiles/services/profiles-practitioners.service.spec.ts src/modules/profiles/dto/update-own-practitioner-profile.dto.spec.ts` — 2 suites, 140/140 pruebas aprobadas. Cubre lectura propia, escritura del repositorio con `ADDR_USE_WORK`, par obligatorio y borrado con `null, null`.
- API: `corepack yarn typecheck` y ESLint dirigido a DTO/servicio/spec — exit 0.
- El test-first dio rojo antes de producción: FE falló en siembra del campo, PATCH ausente, señal GPS inexistente y segundo selector ausente. API falló en retorno, validación de par y escritura laboral. Tras el cambio, los tests dirigidos pasaron.

## Límites de la evidencia

- No se conectó a servicios compartidos ni se levantó PostgreSQL nuevo: el disco de trabajo seguía prácticamente lleno y la inicialización anterior devolvió `ENOSPC`.
- La suite completa de FE (`corepack yarn test --watch=false`) no terminó. Reportó 107 archivos aprobados, 472 fallidos al cargar/ejecutar, 3.203 pruebas aprobadas y 30 fallidas; la salida muestra `ENOSPC` al crear archivos temporales y los dos fallos conocidos de `shell-layout`. No se suprimieron pruebas.
- No hay captura Playwright válida para este cambio. Un intento del smoke visual anterior no llegó a completar la escritura de sus artefactos por `ENOSPC`. La regresión de navegador/API real y la inspección de foto requerida siguen pendientes.
- Estos tests no prueban API→PostgreSQL→recarga, permisos del actor siguiente ni presentación visual en viewport. No cambian estados: los cuatro criterios permanecen `A MEDIAS / TESTED`; el plan global sigue 10/98 `HECHO`.
