# Plan — Diagnóstico de signature-assets

- Fecha: 2026-10-03 · Repos consultados: mantra-core-health, mantra-core-health-api, mantra-core-health-model.
- Predecesor: Hito 1 de perfil médico, PR #868.
- Resultado observable: el propietario conoce la causa del 404 de firma/sello y su relación con el error de «Mis solicitudes».
- Kill-test: contrastar Content-Type de /insurance/my-claims; un 200 HTML no acredita un endpoint JSON.

## Alcance

- IN: investigación de sólo lectura, salud del backend, contrato de firma/sello, consumidores, ruta de solicitudes y configuración de proxy; documentos de diagnóstico.
- OUT: implementar persistencia nueva, cambiar modelo/API, modificar despliegue, habilitar mocks, publicar otro PR.
- Ambigüedad: la captura no demuestra qué petición causa la tarjeta de error. Se contrasta con el flujo del componente y solicitudes anónimas; no se supone acceso a la sesión real del usuario.

## H1 — Causa documentada

**CA:** Dada la captura, cuando se revisan respuestas y contratos, entonces se distinguen el error de firma y el de solicitudes con evidencia reproducible.
**DoD:** solicitudes HTTP de lectura y búsqueda de rutas; salida en evidencia/diagnostico.txt y reporte sin atribuir corrección.
**Estado:** HECHO

### H1.S1 — Revisar el contrato

**CA:** Dado el backend, cuando se contrasta el cliente, entonces se identifica si signature-assets está implementado.
**DoD:** lectura de cliente/controller/entidad y comprobación HTTP documentadas.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Comprobar servicio | Dado el backend local, cuando se consulta salud, entonces responde JSON 200 | `Invoke-WebRequest http://localhost:3000/health` → 200 application/json | HECHO |
| H1.S1.M2 | Contrastar firma/sello | Dado el cliente, cuando se buscan las rutas reales, entonces se documenta implementación o ausencia | `rg -n 'signature-assets\|signatureFileId\|sealFileId'` en API/modelo y GET remoto → 404 JSON | HECHO |

### H1.S2 — Separar el fallo de solicitudes

**CA:** Dada «Mis solicitudes», cuando se sigue su carga, entonces se identifica su contrato independiente.
**DoD:** petición HTTP y referencias del componente/cliente/proxy en REPORTE.md.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Contrastar solicitudes | Dado el host test, cuando se pide my-claims, entonces se registra si devuelve JSON | `Invoke-WebRequest https://test.173.249.39.237.sslip.io/insurance/my-claims` → 200 text/html, título AloVida | HECHO |
| H1.S2.M2 | Registrar diagnóstico | Dada la evidencia, cuando se lee el reporte, entonces se distinguen hechos, inferencias y no cubierto | `Test-Path REPORTE.md` → True | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Confundir HTML 200 con API sana | Diagnóstico falso | Examinar Content-Type y marca HTML |
| Sin sesión del usuario | No reproducir exactamente su error | Solicitudes anónimas sin datos y análisis del flujo; declarar límite |
| Contrato sólo simulado | Ocultar ausencia de backend | No activar mocks ni presentar respuesta vacía como corrección |
