# Reporte — Diagnóstico de signature-assets

- Fecha: 2026-10-03 · Plan: [PLAN.md](PLAN.md).
- Frontend: 79a098d2; API consultada: dff74722. Rama frontend: marcelo/fix-perfil-medico-ux-credenciales-especialidades.
- Peldaño: DISCOVERED; revisión completada, fallo no corregido.
- Avance del diagnóstico: 4/4 (100 %). No equivale a implementación de la funcionalidad.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Backend local encendido | Invoke-WebRequest localhost:3000/health | 200 JSON |
| H1.S1.M2 | Firma/sello sin contrato real implementado | rg en API/modelo y GET test/signature-assets | Sin ruta; 404 JSON |
| H1.S2.M1 | Solicitudes devuelven HTML | Invoke-WebRequest test/insurance/my-claims | 200 text/html, título AloVida |
| H1.S2.M2 | Hallazgos y límites documentados | Test-Path REPORTE.md | True |

## A medias

Ninguna microtarea del diagnóstico. Firma/sello y solicitudes siguen sin integración real; no se implementaron en esta revisión.

## Pendiente

Ninguna microtarea de revisión pendiente.

## Hallazgos

1. **Firma/sello sólo existen contra el simulador.** FirmaYSelloClient lee y escribe `/profiles/practitioners/me/signature-assets`; su comentario declara la ausencia de backend. La búsqueda en API y modelo no encuentra esa ruta ni sealFileId; signatureFileId en tracking corresponde a pruebas de entrega, no al perfil médico. `docs/pendientes-backend-perfil-profesional.md`, sección «La firma y el sello médicos», documenta que falta decidir e implementar persistencia. El endpoint remoto devuelve 404 JSON.
2. **La consulta se inicia desde el shell.** ShellLayout inyecta PdfBrandingService. Su efecto consulta la firma cuando existe practitionerProfileId; por eso el error aparece aun en pantallas distintas del perfil. FirmaYSelloClient.obtener captura errores y emite `{firmaUrl:null,selloUrl:null}`; el navegador conserva el 404 en consola. Esa lectura no es la fuente de estado de MyRequests.
3. **Mis solicitudes tiene otro contrato ausente.** MyRequests.cargar usa InsuranceClient.listMyClaims, que espera `{view,items,truncated}` de `/insurance/my-claims`. En test esa URL responde HTML de AloVida, no JSON. HttpClient espera JSON: esa respuesta puede producir el estado de error de la captura. No se afirma haber reproducido la sesión del usuario.
4. **El proxy local no declara my-claims.** deploy/api-locations.conf contiene `/profiles` y prefijos específicos de insurance, pero no `/insurance/my-claims`. Su nginx envía el resto al frontend. Esto es compatible con el HTML observado; la configuración efectiva del despliegue no se inspeccionó. La API local tampoco declara my-claims en su módulo insurance: añadir únicamente el proxy trasladaría el fallo a un 404 de API, sin implementar solicitudes.
5. **Salud remota no acreditada mediante /health.** El 200 remoto de /health es HTML, por lo tanto no prueba salud de Nest. La ruta signature-assets sí devuelve JSON 404; no se observó un 502 de servicio apagado. Localmente /health responde JSON 200.

## Evidencia

[diagnostico.txt](evidencia/diagnostico.txt) conserva las salidas HTTP y búsquedas. La primera comprobación remota sin elevación no pudo conectar; repetida con acceso de red autorizado produjo las respuestas documentadas.

## No cubierto

- Sesión autenticada exacta del usuario, HAR/red del navegador y configuración interna del host test.
- Persistencia o modificación de imágenes y solicitudes: esta tarea fue revisión de sólo lectura.
- Tests, build y lint: no se modificó código de producto. No se generaron capturas Playwright.

## Desvíos del plan

Ninguno. Se revisó el contrato de solicitudes porque la captura lo muestra fallando junto al 404 de firma.

## Riesgos residuales

- El error sigue presente. Silenciar el 404 o devolver null fijo ocultaría la ausencia de persistencia y no repararía solicitudes.
- Implementar firma/sello exige almacenamiento real conforme al modelo y autorización del archivo del titular; no reutilizar la firma de delivery_proofs.

## Decisiones y ambigüedades

- Se interpreta «revisa» como diagnóstico, sin desplegar ni crear contratos nuevos.
- La tarjeta de error es compatible con JSON esperado/HTML recibido; confirmar el request autenticado permitiría atribuirlo exactamente a la sesión de la captura.
- Para corregir firma/sello: definir persistencia en modelo, implementar GET/PUT autenticados y verificar titularidad de archivos, quitar/guardar/recargar. Para solicitudes: implementar su contrato y declarar su ruta en el proxy. Son dos superficies independientes.
