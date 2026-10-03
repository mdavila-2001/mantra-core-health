# Plan — Firma/sello reales y Mis solicitudes

- Fecha: 2026-10-03 · Repos: mantra-core-health, mantra-core-health-api, mantra-core-health-model.
- Predecesor: diagnóstico signature-assets del 2026-10-03.
- Resultado observable: el profesional conserva firma/sello tras recarga y consulta sus solicitudes sin respuestas HTML ni datos ajenos.
- Kill-test: guardar firma, volver a GET en una sesión nueva; intentar adjuntar archivo de otra cuenta; pedir /insurance/my-claims y exigir JSON.

## Alcance
- IN: modelo canónico y derivados de activos del perfil; GET/PUT propios, autorización y validación de archivo; GET solicitudes con alcance por sesión; proxy; pruebas sintéticas; documentos y PR contra dev.
- OUT: firma criptográfica, generadores PDF de servidor, alta con bytes Base64, desplegar, merge, modificar datos reales o CI ajeno.
- Ambigüedad: se adopta firma/sello como dos archivos nullable del perfil (patrón photo_file_id existente). El endpoint de solicitudes conserva el contrato ya consumido por frontend y resuelve el lado desde sesión.

## H1 — Contratos reales sin filtración de datos
**CA:** Dado un titular autenticado, cuando guarda activos o consulta solicitudes, entonces recibe datos propios persistentes y rechaza archivos ajenos.
**DoD:** regeneración, pruebas dirigidas, typecheck/build, integración sintética y gates de PR; salida literal en evidencia.
**Estado:** EN CURSO

### H1.S1 — Modelo
**CA:** Dado el modelo, cuando se genera el esquema, entonces soporta ambos activos referenciados.
**DoD:** generadores y parche idempotente → exit 0.
**Estado:** EN CURSO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Modelar activos propios | Ambos archivos opcionales tienen FK a common.files | python salud-db/gen_ddl.py 05 → exit 0 y dos FK | EN CURSO |
| H1.S1.M2 | Regenerar entidad | ORM refleja el modelo | python salud-db/gen_entities.py 05 → exit 0 | TODO |
| H1.S1.M3 | Generar actualización | Dos aplicaciones conservan esquema/datos | generador de parche + aplicación local doble → exit 0 | TODO |

### H1.S2 — API
**CA:** Dada una sesión, cuando consulta o modifica activos/solicitudes, entonces recibe sólo lo autorizado.
**DoD:** pruebas API dirigidas y typecheck/build.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Contrato validado de activos | UUID/null/ausencia se distinguen | tests DTO → PASS | TODO |
| H1.S2.M2 | Persistencia de activos | GET/PUT del titular conserva, cambia y quita; archivo ajeno rechazado | tests servicio → PASS | TODO |
| H1.S2.M3 | Solicitudes propias | Cuenta sin registros recibe vacío real; otras cuentas no filtran datos | tests servicio my-claims → PASS | TODO |
| H1.S2.M4 | Rutas autenticadas | Las rutas delegan sin actor provisto por cliente | tests controller → PASS | TODO |

### H1.S3 — Frontend/proxy
**CA:** Dado el mismo origen, cuando consulta solicitudes, entonces alcanza API y no recibe HTML.
**DoD:** check-api-prefixes y pruebas de contrato dirigidas.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Enrutar my-claims | Proxy declara la ruta API | node scripts/check-api-prefixes.mjs → exit 0 | TODO |
| H1.S3.M2 | Probar consumidores | Firma y solicitudes mantienen contratos | yarn test --include suites afectadas --watch=false → PASS | TODO |

### H1.S4 — Verificación y entrega
**CA:** Dado el cambio, cuando se verifica y revisa, entonces existen pruebas reproducibles y PR con límites honestos.
**DoD:** comandos y salidas reales; PR no draft, mergeable y checks consultados después de push.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S4.M1 | Validación estática | Código y plantillas compilan | yarn typecheck; yarn build; lint archivos → exit 0 | TODO |
| H1.S4.M2 | Integración sintética | Recarga conserva activos y acceso ajeno falla | script HTTP real → PASS | TODO |
| H1.S4.M3 | Recorrido navegador | Mis solicitudes renderiza respuesta API | Chromium workers=1 retries=0 → PASS; revisión doble si hay capturas | TODO |
| H1.S4.M4 | Reportar evidencia | Resultado y no cubierto quedan documentados | Test-Path REPORTE.md → True | TODO |
| H1.S4.M5 | Publicar PR | Cada repo afectado tiene PR a dev con dependencias | gh pr create/view/checks → estado y salida literal | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Backend apagado | Falso diagnóstico 403 | Comprobar /health antes de depurar |
| CI offline | No certificar cierre | Gates locales y marcar A MEDIAS |
| Concurrentes | Mezclar cambios | Ramas desde origin/dev; preservar archivos ajenos; sin force-push |
| Esquema deriva | API nueva contra DB vieja | Modelo→generación→parche idempotente; orden de despliegue modelo/API/proxy |
