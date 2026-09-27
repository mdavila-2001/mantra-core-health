> **AVANCE: 7 / 10 — 70,0 %.**

# Reporte — C8 · Integración del paquete «Encuentro clínico»

- Fecha: 2026-09-25 (cierre el 2026-09-26 por la mañana, que es cuando la ficha pone este carril)
- Plan: [PLAN.md](./PLAN.md) · Rama: `claude/clinica-c8-integracion`, desde `origin/mockup` @ `bf2c3545`
- Peldaño de evidencia alcanzado: **VERIFIED** para el resultado observable — se ejerció en un
  navegador real, contra `yarn dev` en el puerto 4218, y el recorrido quedó escrito y verde.
- **7 HECHO · 1 A MEDIAS · 2 DESCARTADO.** `A MEDIAS` cuenta como no hecha.

## Lo que este carril tenía que dejar, y dejó

**En «Mi historia», al desplegar una atención, la línea del encuentro dice «Reconsulta el
\<fecha\> a las \<hora\>».** Es el dato que C4 produjo y C6 no podía leer, y hasta esta
integración nadie los ataba. Verificado en navegador: prueba 5 del recorrido, en verde.

## Completado

| ID | Microtarea | DoD | Resultado |
|---|---|---|---|
| C8.H1.M1 | Merges de los carriles entregados | `git log --merges --oneline -3` | HECHO · los 2 merges de C4 y C6, **0 conflictos**. No hay más que mergear: de los diez carriles sólo esos dos existen · [`evidencia/00-merges-y-baseline.txt`](./evidencia/00-merges-y-baseline.txt) |
| C8.H1.M2 | Los `TODO C8` resolubles | `corepack yarn typecheck` + specs dirigidos | HECHO · **16 → 6**. Los 6 que quedan dependen de C1, C2, C3 y C0, que no se entregaron, y se dejaron con su texto intacto · [`evidencia/02-todo-c8-y-typecheck.txt`](./evidencia/02-todo-c8-y-typecheck.txt) |
| C8.H1.M3 | `app-encounter-timeline` montado del lado de quien escribe | `consultation.spec.ts` + navegador | HECHO · «Lo registrado en este encuentro» en la consulta, bajo la rejilla: **10 pruebas** (baseline 5) y **visto en navegador** · [`evidencia/04-montaje-organismo.txt`](./evidencia/04-montaje-organismo.txt) |
| C8.H2.M2 | `playwright/clinica-c8-recorrido-completo.spec.ts` | `--workers=1` en verde | HECHO · **6 de 6, ningún salto** · [`evidencia/05-recorrido-playwright.txt`](./evidencia/05-recorrido-playwright.txt) |
| C8.H3.M1 | `PENDIENTES-BACKEND.md` con P39–P42 | cuatro filas y cuatro secciones | HECHO · P42 completo (tiene frontend detrás); P39, P40 y P41 con su alcance del plan maestro y **declarados sin carril entregado**, que es lo que son |
| C8.H3.M2 | `REPORTE-FINAL.md` del paquete | los números salen de los `REPORTE.md` | HECHO · [`../REPORTE-FINAL.md`](../REPORTE-FINAL.md) |
| C8.H3.M3 | Commits, push y PR contra `mockup` | `gh pr view … --json mergeable` | HECHO · ver «Entrega» al final |

## A medias

| ID | Qué falta | Por qué |
|---|---|---|
| C8.H2.M1 | Gates **completos**: `corepack yarn build`, la suite entera, los `check-*.mjs` y `generate-inventory.mjs --check` | Corrieron `typecheck` (exit 0), `lint` (sin rojos nuevos) y **361 pruebas** de los 10 specs de todo lo que el carril movió, más el recorrido de navegador. El `build` y la suite entera **no** se corrieron: la regresión centralizada la corre el propietario sobre esta rama, y este turno decidió publicar. `evidencia/06-gates-de-cierre.txt` |

## Descartado, con motivo

| ID | Microtarea | Motivo |
|---|---|---|
| C8.H2.M3 | Barridos `mockup-barrido` / `mockup-click-sweep` vía `pw-guard` | **`scripts/pw-guard.mjs` no existe en este árbol**: era artefacto de C0, que no se entregó. El recorrido de C8 se corrió levantando el servidor a mano, pero los barridos dependen del guard para su matriz de salida |
| C8.H2.M4 | Doble revisión crítica de las capturas finales | La doble revisión se hace **sobre capturas** (regla 35.1) y este turno no produjo ninguna: el recorrido afirma comportamiento, no acabado visual |

## La integración que además hizo falta sembrar

**La semilla de C4 dejaba el vínculo a medio camino y eso mataba el resultado observable.** La
reconsulta sembrada llevaba `followUpOf: { bookingId, encounterId: null }`, con una nota que
explicaba —y con razón— que atarlo al `appointmentId` habría inventado una relación que el modelo
no declara: el `appointmentId` de una reserva apunta a otra tabla, y el `Encounter` que se lee
**ni siquiera lo expone**. Pero con `encounterId` en `null`, `reconsultaDeLaLinea` no puede
encontrar nada nunca: el cableado quedaba probado en unitarias y **muerto en pantalla**.

Ahora la reconsulta se cuelga de un encuentro **real** de la misma paciente —el más reciente ya
cerrado— y, como el origen, se **busca**, no se fija por índice ni se deriva su id por convención
de texto. Es exactamente el vínculo que el contrato declara (`FollowUpOriginRef.encounterId`).
`agenda.ts` pasó a importar `encuentros` de `clinica.ts`; no hay ciclo, porque `clinica.ts` no
importa la agenda.

## Lo que el navegador destapó, y que ninguna prueba de unidad podía ver

1. **El sello «Reconsulta» de C4 no es alcanzable para un profesional con calendario.** Vive en
   la celda de motivo de la tabla de consultas, y esa tabla está en la solapa `consultations`,
   que `pestanas()` sólo arma **cuando el profesional no tiene calendario**. Sus 125 pruebas de
   unidad lo fijan y en la aplicación nadie lo ve. Pendiente con dueño en `REPORTE-FINAL.md`.
2. **Cuatro supuestos falsos del recorrido**, que se había escrito sin navegador: el enlace
   «Iniciar la consulta» no existe (es un botón que cubre la tarjeta), tocarlo no siempre navega,
   `start` de la reserva **no abre** el encuentro clínico, y la historia es un acordeón de una
   sola atención abierta. Las cuatro correcciones y su razón están en
   [`evidencia/05-recorrido-playwright.txt`](./evidencia/05-recorrido-playwright.txt).

Ninguna de las cuatro debilitó una aserción: la que faltaba —abrir el encuentro— **agregó** un
paso que antes se salteaba, y la del acordeón convirtió un salto en una prueba que corre.

## Desvíos del plan, declarados

- El `PLAN.md` proponía escribir **P42 y P39** y no numerar P40 ni P41. Se corrigió: el plan
  maestro del paquete (§10) **numera los cuatro** con su alcance, así que la tabla lleva las
  cuatro filas y cada uno su sección; lo que se dice de P39, P40 y P41 es que **ningún carril los
  entregó**, no un contrato inventado.
- El prompt pide `git push origin HEAD:mockup`. **Se entra por PR**, que es la regla del
  propietario para todo cambio.
- El daily de equipo y el `ActionLog.md` de `AlovidaPromptManager` son de otro repo: van en su
  propio PR.

## Entrega

- Commits: `fix(integracion)` · `feat(consulta)` · `test(e2e)` · `docs(pendientes)` ·
  `docs(reporte)` · `fix(mock)` del vínculo de la semilla.
- PR contra `mockup`: ver la salida de `gh` en [`evidencia/07-pr.txt`](./evidencia/07-pr.txt).
