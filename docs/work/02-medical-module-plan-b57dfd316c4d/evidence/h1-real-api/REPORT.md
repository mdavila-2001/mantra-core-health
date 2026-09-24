# Evidencia H1: alta médica, credenciales y especialidades contra API real

Fecha: 2026-09-24. Fuente funcional única: `02_METAPROMPT_MEDICO.md`, SHA-256 `b57dfd316c4d642eb5e1db49257397b8fd2864b511317282ae4b70ff1262a656`.

## Recorrido extendido más reciente

La prueba final corrió en Chromium contra el frontend `justin/medical-module-execution-20260924` (`df611861`) y la API de esa rama (`783d2697`). Angular usó `real-api` (`mockBackend=false`) en `127.0.0.1:4390`; la API Node corrió en `127.0.0.1:3000`. PostgreSQL 18 fue una instancia local desechable propia, puerto `55444`, base `mch_medical_plan`, datos en `/tmp/mch-medical-plan-b57dfd316c4d-pgdata` y archivos en `/tmp/mch-medical-plan-b57dfd316c4d-files`. La base arrancó con `ORM_SCHEMA_SYNC=safe`, 21/21 semillas y 39.799 filas de catálogo/datos base. El navegador usó el proxy de mismo origen; no se alteró CORS ni `proxy.conf.json`, y no se cargó `.env`.

Comando final:

```sh
E2E_BASE_URL=http://127.0.0.1:4390 DOTENV_CONFIG_PATH=/dev/null corepack yarn pw playwright/medical-real-api.temp.spec.ts --workers=1 --reporter=list
```

Resultado: **1 prueba aprobada**. Para una misma cuenta sintética, el formulario de navegador creó dos credenciales de cada tipo visible —universitario, diplomado, maestría y doctorado— con institución, número y PDF distintos: ocho llamadas de carga devolvieron 201 y el alta devolvió 201. La prueba inició sesión (200), leyó el resumen propio (200), encontró las ocho filas y descargó los ocho archivos como titular (200 cada uno, `application/pdf`, firma `%PDF-1.4`). Consultó además la ficha por `profileId` con sesión válida; el resumen de ficha no expuso ningún `fileId`.

El mismo actor seleccionó tres especialidades distintas. La prueba editó una credencial propia con PATCH (204), recargó la página y volvió a leer el resumen (200); después de la recarga verificó que seguían las ocho filas, los ocho `fileId` distintos y las tres especialidades, y que el número y la institución editados persistieron.

La consulta SQL posterior en PostgreSQL encontró dos filas y dos archivos únicos para cada tipo `CREDENTIAL_TYPE_DEGREE`, `CREDENTIAL_TYPE_DIPLOMA`, `CREDENTIAL_TYPE_MASTER` y `CREDENTIAL_TYPE_DOCTORATE`; ocho credenciales y ocho `file_id` únicos en total; tres especialidades activas; y el PATCH persistido (`DOC-2-…-EDIT`, `Institución de prueba editada`). Los PDFs y valores son sintéticos y no corresponden a un paciente o profesional real.

Las capturas móviles se tomaron a 390 × 844 en las pantallas de títulos y especialidades y se inspeccionaron visualmente: [ocho credenciales y adjuntos](extended-smoke/medical-credentials-mobile.png) y [tres especialidades](extended-smoke/medical-specialties-mobile.png). La especificación fue temporal y se retiró después; no forma parte de la suite permanente.

## Evidencia previa y límites

Una corrida anterior separada recorrió dos títulos universitarios en navegador→API real→PostgreSQL con alta, lectura, descarga propia, PATCH y recarga. La integración API/PostgreSQL `practitioner-credential-registration-files.int-spec.ts` también es separada: verifica diez credenciales (dos por cada uno de cinco tipos, incluido tipo de especialidad), ocultamiento de `fileId` en el resumen, descarga permitida al dueño, rechazo 403 a otro actor y rechazo 422 al reusar un PDF. Esos diez registros no pertenecen al actor del recorrido Chromium.

El recorrido nuevo cubre ocho documentos de los cuatro tipos que presenta ese formulario y tres especialidades seleccionadas, pero no prueba el editor del perfil desde la interfaz con la API real, no carga credenciales de tipo especialidad desde el navegador y no ejecuta H1 completo (identidad, contactos y demás requisitos) ni los escenarios H2–H8. Por eso MED-E01 y los criterios de credenciales permanecen **A MEDIAS**; la matriz del plan sigue en **0/98 HECHO**. No se cambió el estado de criterios por esta evidencia parcial.

En la continuación se evitó conectar, reiniciar o detener servicios encontrados en otros puertos (PostgreSQL 55439/55440, Angular 4300/4302/4387 y SSR). Sólo se usaron los procesos, la base y el almacenamiento aislados descritos arriba; se retiraron al terminar.
