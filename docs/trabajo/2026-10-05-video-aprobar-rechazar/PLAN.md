# Plan — Mostrar en el video cómo se aprueba y se rechaza una solicitud

- **Fecha:** 2026-10-05
- **Repos afectados:** `mantra-core-health` (rama base `mockup`)
- **Predecesor:** [2026-10-05-video-aseguradora-alianza](../2026-10-05-video-aseguradora-alianza/PLAN.md), PR #966 (mergeado)
- **Rama:** `marcelo/video-aprobar-rechazar-mockup`
- **Resultado observable:** en «Solicitudes recibidas», el video muestra cómo se **aprueba** una solicitud abierta («Aprobar y facturar», con la factura emitida) y cómo se **rechaza** otra (con el motivo escrito), con el componente real y los datos de Alianza.
- **Kill-test:** el video no muestra el diálogo de confirmación de aprobación, o no muestra el motivo de rechazo escrito y confirmado.

## Alcance

- **IN:**
  - El paso 3 de `tools/video-aseguradora/grabar.mjs` y su README.
  - Sumar el commit del reporte del trabajo anterior que quedó fuera del merge de #966 (`a8970158`).
- **OUT:**
  - El componente `received-claims` y el handler: ya dictaminan, persisten y emiten factura.
  - Las ramas `dev` y `test`. Ya tienen el directorio y sus specs (#955/#956). Usan la API real (`mockBackend: false`), así que el handler simulado y el video no aplican ahí.
- **Ambigüedades registradas:**
  - **«Aprobar parcialmente».** El pedido nombra aprobar y rechazar. **Supuesto:** se muestran esas dos acciones; la aprobación parcial queda visible como opción, pero no se ejecuta. **Confirmar con:** el usuario.

## H1 — El video muestra aprobar y rechazar

**CA:** Dado el video, cuando llega a «Solicitudes recibidas», entonces:
- abre una solicitud abierta, pulsa «Aprobar», confirma «Aprobar y facturar» y se ve el dictamen aprobado con su factura;
- abre otra solicitud abierta, pulsa «Rechazar», escribe el motivo, confirma y se ve el dictamen rechazado.

**DoD:** `node tools/video-aseguradora/grabar.mjs` → salida 0 con sus controles limpios · `ffprobe` · capturas de los dos dictámenes · doble revisión.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Aprobar en el recorrido | Captura con el dictamen «Aprobada» y la factura vigente | captura `03b-aprobada.png` | HECHO |
| H1.S1.M2 | Rechazar con motivo en el recorrido | Captura con el dictamen «Rechazada» y su motivo | captura `03c-rechazada.png` | HECHO |
| H1.S1.M3 | Video regenerado | h264, 1920×1080, salida 0 | `ffprobe` + salida del script | HECHO |
| H1.S2.M1 | Doble revisión de las capturas nuevas | Ninguna pantalla RECHAZADA | `evidencia/doble-revision.md` | HECHO |
| H1.S3.M1 | PR a `mockup`, no draft | Mergeable, con los checks verdes | `gh pr view` + `gh pr checks` | A MEDIAS |
| H1.S3.M2 | REPORTE.md | Con las tres secciones | archivo en disco | HECHO |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Después de dictaminar, la fila sale de «Por dictaminar» y cambian los índices | Elegir siempre la primera fila **abierta**, no un índice fijo |
| El servidor de desarrollo recompila con el merge de #965 | El script lee el sello de `env.generated.ts` y falla si la siembra no aplica |
