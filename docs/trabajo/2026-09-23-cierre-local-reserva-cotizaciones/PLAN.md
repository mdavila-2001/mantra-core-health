# Plan — Cierre local verificable de reserva y Cotizaciones

- Fecha: 2026-09-23 · Repo: `mantra-core-health` · Base: `origin/mockup@b7785e36`.
- Predecesores: `2026-09-23-reserva-y-cotizaciones`, `2026-09-23-continuacion-reserva-cotizaciones` y `2026-09-23-simplificar-cotizaciones`.

## Resultado

**Actor:** paciente sintético `paciente@alovida.mock`.
**Dónde:** Directorio y `/my-account/cotizaciones`, servidos localmente con la maqueta integrada.
**Estado inicial:** la funcionalidad y una verificación focal existen, pero faltan evidencia visual, teclado, inventario de controles y una adjudicación honesta contra el carril original de 51 microtareas.
**Acción:** ejecutar recorridos reproducibles, generar la evidencia local y separar lo demostrado, lo descartado por la decisión de producto y lo que requiere infraestructura/negocio.
**Observable:** cada resultado local tiene comando, salida y ruta de evidencia; ningún hallazgo se convierte en `HECHO` del plan fuente sin su ID y DoD.
**Fuera:** inventar precios, cambiar contratos externos, declarar un despliegue remoto, o atribuir los rojos globales a un carril sin evidencia.
**Kill-test:** una captura se usa para afirmar un deploy, un precio sin procedencia aparece, o se incrementa `20/51` sin la tabla de adjudicación.

## H1 — Evidencia visual y de interacción

**CA:** el paciente ve Cotizaciones en 390, 768 y 1440 px en ambos temas; los filtros, el orden y el teclado dejan resultados observables sin errores de navegador.
**DoD:** Playwright serial genera seis capturas y cubre teclado/orden/filtro con aserciones reales.
**Estado:** HECHO

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.S1.M1 | Capturar tres anchos por dos temas de Cotizaciones | seis PNG bajo `evidencia/capturas/` | HECHO |
| H1.S1.M2 | Verificar teclado, filtro y orden en las rutas del paciente | spec Playwright verde | HECHO |

## H2 — Medición y gates locales

**CA:** queda escrita una medición reproducible de la versión actual y los gates ejecutables se clasifican como verdes o rojos, sin confundirlos con el baseline histórico.
**DoD:** tabla de red/clics, barridos seriales y salidas literales de los gates.
**Estado:** HECHO

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H2.S1.M1 | Medir navegación actual de Directorio/Cotizaciones y cuatro activaciones | `evidencia/medicion-local.md` | HECHO |
| H2.S1.M2 | Inventariar iconos y botones propios de Cotizaciones | `evidencia/controles.md` | HECHO |
| H2.S1.M3 | Reunir gates ya ejecutables y clasificar rojos globales | `evidencia/gates.md` | HECHO |

## H3 — Adjudicación contra el carril original

**CA:** las microtareas del encargo de 51 quedan mapeadas a evidencia, `DESCARTADO` por decisión de producto o bloqueo externo, sin doble conteo.
**DoD:** tabla por ID, conteo recalculable y reporte con tres secciones.
**Estado:** HECHO

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H3.S1.M1 | Declarar H4 (documentos) como descartado por decisión del producto | tabla de adjudicación | HECHO |
| H3.S1.M2 | Mapear evidencia local a los IDs originales y recalcular sólo los HECHO demostrados | tabla de adjudicación | HECHO |
| H3.S1.M3 | Escribir reporte de cierre local | `REPORTE.md` | HECHO |

## H4 — Clic único de la portada de especialidades

**CA:** cuatro activaciones rápidas de una tarjeta de especialidad producen una
sola navegación, anuncian `Abriendo…` y los modificadores de enlace se
conservan.
**DoD:** prueba unitaria verde y recorrido de navegador cuando la cuota de
autenticación de la maqueta esté disponible.
**Estado:** HECHO

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H4.S1.M1 | Fijar y corregir la navegación única de especialidades | `practitioners-directory.spec.ts` verde | HECHO |
| H4.S1.M2 | Verificar cuatro toques en navegador autenticado | Playwright contra la maqueta | HECHO |
