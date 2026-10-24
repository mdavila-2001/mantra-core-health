> **AVANCE DEL PAQUETE: 23 / 31 microtareas — 74,2 %, sobre 3 de los 10 carriles.**
> Los otros siete carriles **no existen**: ni rama, ni PR, ni una línea en el árbol. Su alcance
> no está contado arriba, porque contar como denominador lo que nadie empezó convierte el
> porcentaje en una opinión.

# Cierre del paquete «Encuentro clínico» — noche del 2026-09-25

El paquete repartía **diez carriles** (C0 a C9) para construir el encuentro clínico de punta a
punta: contrato, nota médica, orden de análisis, diagnóstico presuntivo, reconsulta, receta
ligada al diagnóstico, historia del paciente, integración, homogeneización de nombres y «Mis
órdenes». **Se entregaron tres**, los tres del mismo turno de Justin.

## Qué llegó, con su avance real

| Carril | Quién | Qué entregó | Avance | PR |
|---|---|---|---|---|
| **C4 · Reconsulta** | Justin | La reconsulta como **cita real** agendada desde la consulta: `followUpOf` en el contrato y en el simulador con sus cinco caminos de rechazo, el bloque que la agenda, y su sello en las dos agendas y en «Mis citas» | **10 / 12 — 83,3 %** | [#672](https://github.com/mdavila-2001/mantra-core-health/pull/672) |
| **C6 · Historia del paciente** | Justin | «Mi historia»: diagnósticos en **en estudio / activas / históricos** resueltos por código de catálogo, el organismo `app-encounter-timeline`, y la garantía de que **ningún uuid** llega a la pantalla del paciente | **6 / 9 — 66,7 %** | [#674](https://github.com/mdavila-2001/mantra-core-health/pull/674) |
| **C8 · Integración** | Justin | Los tipos de C4 a su lugar congelado, `diagnosis-state` a `shared/clinical/`, **el cableado que ata C4 con C6**, «Lo registrado en este encuentro» del lado de quien escribe, y el recorrido de navegador | **7 / 10 — 70,0 %** | este PR |
| C0, C1, C2, C3, C5, C7, C9 | Marcelo · Itzan · Pablo | — | **0** | — |

## Lo que destrabó a quién

- **C4 → C6.** `followUpOf` en `GET /scheduling/bookings` es lo que la línea del encuentro
  necesitaba para poder nombrar una reconsulta. C6 dibujó el hecho antes de que hubiera quien lo
  llenara, que era lo correcto: dejó el hueco con su forma.
- **C6 → C8.** El organismo `app-encounter-timeline` nació presentacional puro, y por eso C8
  pudo montarlo del lado del profesional sin tocarlo.
- **C8 cerró el circuito.** Hasta esta integración, C4 producía el vínculo y C6 dibujaba el
  hecho, y **nadie los ataba**: en «Mi historia», al desplegar una atención, la línea ahora dice
  «Reconsulta el \<fecha\> a las \<hora\>». Verificado en navegador.
- **Nadie destrabó a los siete carriles ausentes**, y eso se nota en el recorrido: de los once
  tramos que el prompt de C8 describía, se pudieron escribir cuatro.

## Incidentes, en orden de importancia

1. **El sello «Reconsulta» de C4 no es alcanzable para un profesional con calendario.** Vive en
   la celda de motivo de la tabla de consultas, y esa tabla está en la solapa `consultations`,
   que `agenda.ts` sólo arma **cuando el profesional no tiene calendario**. Sus 125 pruebas de
   unidad lo fijan y en la aplicación nadie lo ve. **Dueño: C4 (Justin).** Lo que la médica sí
   alcanza es el motivo «Reconsulta: …» en la tarjeta del día y el «Qué es» del detalle.
2. **La semilla de la reconsulta dejaba el vínculo en `null`**, y con eso el cableado de C8 era
   inalcanzable por cualquier camino de la aplicación. Corregido en este carril: la reconsulta
   cuelga de un encuentro real de la paciente, buscado y no fijado por índice. **Sin esto, el
   resultado observable del paquete no existía en pantalla.**
3. **El recorrido de C8 se había escrito sin navegador** y cuatro de sus supuestos eran falsos
   (el enlace que no existe, el clic que abre un diálogo en vez de navegar, el `start` de la
   reserva que **no** abre el encuentro clínico, y la historia que es un acordeón). Todas
   corregidas hacia arriba: una de ellas **agregó** el paso que antes se salteaba.
4. **`scripts/pw-guard.mjs` no existe**: era de C0. Los barridos del mockup quedaron sin correr y
   el recorrido se levantó a mano.
5. **El `APT-RECONSULTA` sigue siendo una apuesta verificable**: el concepto lo definía C0. El id
   se deriva con la misma semilla, así que coincidirá cuando llegue; si C0 eligiera otro código,
   es una constante en un lugar.

## Pendientes de backend que nacen del paquete

`PENDIENTES-BACKEND.md`, secciones **P39 a P42**. De los cuatro, **sólo P42 tiene frontend
detrás** —la reconsulta, construida y andando contra el simulador—; P39, P40 y P41 quedan
escritos con su alcance y declarados sin carril entregado.

## Lo que falta para cerrar el paquete de verdad

- Los **siete carriles ausentes**, que son el encuentro clínico propiamente dicho: sin nota
  médica, orden, diagnóstico y receta, lo entregado es el andamio y los dos extremos.
- Los **6 `TODO C8`** que quedaron en el árbol marcan exactamente dónde entra cada uno.
- **`build` y la suite entera** sobre esta rama: regresión centralizada, del propietario.
