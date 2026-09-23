# Plan — Continuación de reserva y cotizaciones del paciente

- Fecha: 2026-09-23 · Repo: `mantra-core-health` · Predecesor: `2026-09-23-reserva-y-cotizaciones`.
- Resultado observable: el paciente llega desde «Mi cuenta» a Cotizaciones, consulta y ordena resultados con procedencia visible; el flujo de reserva conserva un clic único y cuenta con medición reproducible.
- Kill-test: una ruta de paciente no carga, un precio de maqueta se presenta como publicado, o dos clics generan dos navegaciones.

## Alcance

- IN: actualizar la rama al corte `origin/mockup`; regenerar el índice antes de las verificaciones; pantalla, ruta y navegación de Cotizaciones; documentos ya disponibles; medición del flujo de reserva; pruebas, evidencia y reporte.
- OUT: conversión UMA→BOB, precios reales sin fuente, contratos o endpoints nuevos, y cambios en datos clínicos.
- Decisión: los precios sintéticos se rotulan como «Maqueta» y los ausentes como «No publicado»; nunca se infiere un importe.

## H1 — Base actual verificable

**CA:** Dado el corte integrado, cuando se ejecutan test o typecheck, entonces el índice de componentes se genera antes de compilar.
**DoD:** `yarn stock:generate && yarn typecheck` con salida registrada.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Partir de `origin/mockup` en rama nueva | El PR anterior queda como base | `git merge-base --is-ancestor origin/mockup HEAD` al finalizar | TODO |
| H1.S1.M2 | Asegurar generación previa a verificación | El índice no queda obsoleto al usar scripts documentados | test de script + `yarn typecheck` | TODO |

## H2 — Cotizaciones utilizables por paciente

**CA:** Dado un paciente autenticado, cuando abre Cotizaciones, entonces puede buscar, filtrar y ordenar resultados conocidos sin que un precio simulado parezca real.
**DoD:** pruebas unitarias y de componente verdes; recorrido Playwright contra mockup.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Crear superficie de Cotizaciones y sus estados | La pantalla muestra carga, vacío, error, sin origen y resultados | spec focalizado | TODO |
| H2.S1.M2 | Componer fuentes existentes y documentos permitidos | Recetas y órdenes diagnósticas precargan términos; faltantes se declaran | spec focalizado | TODO |
| H2.S1.M3 | Registrar ruta y menú de paciente | «Cotizaciones» abre la pantalla con rol PATIENT | prueba de navegación + navegador | TODO |

## H3 — Medición y cierre honesto

**CA:** Dado el flujo de reserva, cuando se recorre autenticado, entonces se documentan solicitudes, tiempos y cuatro clics sin inventar números.
**DoD:** evidencia antes/después y reporte con pendientes concretos.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Medir reserva con sesión reproducible | Tabla con solicitudes, ms y cuatro clics | Playwright + evidencia | TODO |
| H3.S1.M2 | Ejecutar gates y reporte | Rojos propios corregidos; ajenos declarados | lint, typecheck, test, Playwright | TODO |

