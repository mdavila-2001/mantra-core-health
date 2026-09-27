# H1.S2.M3 / H2.S1.M4 — Medición EN VIVO del flujo «elegir médico»

**Estado: `HECHO`.** Medido de verdad, en el navegador, contra la app real corriendo (`ng serve`,
sesión `paciente@alovida.mock`), no por código ni por la Red del navegador (que no sirve para esto — ver
`evidencia/antes/latencia.md`). Se instrumentó un contador temporal dentro de `atender()`
(`mock-backend.interceptor.ts`, `window.__mockRequestLog`), retirado apenas se tomó la medida.

## Recorrido real: paciente → directorio → Cardiología → Dra. Valeria Rojas Mendoza (2 sedes)

Comando ejecutado en el navegador (Playwright, sesión real):
`window.__mockRequestLog` tras cargar `/directory/be0f3a66-c03e-4eac-a416-c1068238d3d2`:

```
GET /profiles/practitioners/be0f3a66-c03e-4eac-a416-c1068238d3d2/summary
GET /terminology/concepts
GET /common/files/294a5a8f-9841-4ebd-a842-b60e45a8051c/content
GET /scheduling/resources
GET /scheduling/slots
GET /scheduling/slots
```

**6 peticiones**, exactamente lo que predecía la lectura de código (`evidencia/antes/red-flujo-reserva.md`):
1 perfil + 1 terminología + 1 foto (en paralelo, `practitioner-detail.ts`) + 1 recursos + 2 `listSlots`
(una por cada una de las 2 sedes de la médica — consultorio propio y Clínica Los Olivos), sin «próximo
hueco» porque las dos sedes tenían cupos en la semana visible.

Con la tabla de latencia decidida (H2.S1): `/profiles`→90ms, `/terminology`→120ms (prefijo por
omisión), foto→120ms (en paralelo con los dos anteriores, así que no suma), `/scheduling/resources`→
120ms, `/scheduling/slots`×2→40ms cada una. Secuencia real: perfil (con las 2 llamadas en paralelo
adentro) ≈90ms, después disponibilidad: resources (120ms) → 2×slots en paralelo (40ms) ≈ 160ms.
**Total estimado ≈ 250ms**, muy por debajo del objetivo Q-10 (< 1s) declarado en la ficha.

## Confirmación del caso de 1 sede (los 12 registrados por R-03)

Un registrado con cupos (p. ej. persona real proveniente de la planilla — REDACTADA) tiene **un solo recurso** — su «elegir médico»
es más corto: 1 perfil + 1 terminología + 1 recurso + 1 `listSlots` = **4 peticiones**, sin la foto (los
registrados no tienen `photoFileId`). Confirmado leyendo `agenda.ts` (un recurso por registrado, sin el
segundo «consultorio propio» que sólo tiene la médica) — no se repitió la medición en vivo para este
caso puntual porque el patrón (N = 3 + sedes×[1-2]) ya quedó demostrado con el caso de 2 sedes.

## Instrumentación retirada

El contador (`window.__mockRequestLog`, bloque `declare global` en `mock-backend.interceptor.ts`) era
temporal y sólo para esta medición. Se retiró del código de producto después de tomar la medida —
`git diff` de `mock-backend.interceptor.ts` no debe mostrar rastro de él en el cierre.
