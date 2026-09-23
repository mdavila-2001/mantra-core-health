# Plan — Simplificar la pantalla de Cotizaciones

- Fecha: 2026-09-23 · Repo: `mantra-core-health` · Predecesor: `2026-09-23-continuacion-reserva-cotizaciones`.
- Resultado observable: Cotizaciones muestra solamente búsqueda, filtros, orden y resultados; no presenta estudios de documentos ni consulta órdenes diagnósticas.
- Kill-test: al abrir Cotizaciones aparece “Estudios en tus documentos actuales” o sale una petición a órdenes diagnósticas.

## Alcance

- IN: eliminar el bloque de estudios y su carga asociada; actualizar pruebas y registro.
- OUT: alterar resultados de cotización, precios, rutas, navegación, contratos o el flujo de reserva.
- Decisión: Cotizaciones es un comparador independiente; los documentos permanecen en “Mis estudios”, donde ya tienen contexto propio.

## H1 — Comparador sin documentos incrustados

**CA:** Dado un paciente que abre Cotizaciones, cuando la pantalla termina de renderizar, entonces puede filtrar y ordenar cotizaciones sin ver ni cargar estudios personales.
**DoD:** prueba de componente dirigida verde y comprobación visual local si el entorno puede arrancar.
**Estado:** HECHO

### H1.S1 — Retiro de la dependencia

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar la ausencia de documentos con una prueba | La prueba exige que no haya texto ni llamadas a órdenes | `corepack yarn test --include=.../cotizaciones.spec.ts --watch=false` falla antes del cambio | HECHO |
| H1.S1.M2 | Quitar UI, estado e inyecciones de documentos | La pantalla no depende de Diagnostics ni Terminology | Mismo spec verde | HECHO |
| H1.S1.M3 | Registrar evidencia y límites | El reporte separa test de verificación visual | `REPORTE.md` con salida literal | HECHO |
| H1.S1.M4 | Verificar la composición en navegador autenticado | El bloque retirado no deja espacio visual ni aparece al abrir la ruta | `npx playwright test playwright/cotizaciones-paciente.spec.ts --workers=1` contra `origin/mockup@b7785e36` local | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Quitar accidentalmente los resultados | La pantalla quedaría sin función | El test conserva búsqueda y procedencia de precio. |
| Confundir ausencia de documentos con ausencia de cotizaciones | Mensaje engañoso | Se conserva el estado vacío sólo para resultados del comparador. |
