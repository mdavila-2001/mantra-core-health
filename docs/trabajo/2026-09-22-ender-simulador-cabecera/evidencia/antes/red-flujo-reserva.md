# H1.S2.M3 — Medición del flujo «elegir médico» (de Justin)

**Estado: `A MEDIAS`** — la forma del fan-out está verificada contra el código real; el conteo en vivo
sigue sin medirse.

Justin registró un bloqueo el 2026-09-23 en
`docs/trabajo/2026-09-23-reserva-y-cotizaciones/evidencia/antes/red-flujo-reserva.md` (este mismo repo,
copiado aquí sin editar):

> 1. Se inició un único `yarn start:dev` y `http://localhost:4200` respondió `200`.
> 2. Una visita anónima a `/directory` mostró el formulario de inicio de sesión, como corresponde al guard.
> 3. El arnés Playwright cargó `paciente@alovida.mock` y una contraseña no vacía, pulsó `login-submit` y
>    esperó la respuesta de `/iam/auth/login`.
> 4. La espera agotó los 30 s sin observar ninguna respuesta de esa ruta. Por tanto no hay una tabla
>    honesta de solicitudes de la ficha, ni medición de cuatro clics, ni capturas que puedan declararse
>    válidas.

Retomé el intento esta noche con Playwright real (login, `/directory`, ficha de un profesional — ver
`evidencia/antes/latencia.md`, sección «Corrección tras usar el navegador»): el login **sí funcionó** y
llegué hasta `/directory/:id`. Pero ahí apareció la causa de fondo, la misma que explica por qué la
medición de Justin (y cualquier medición por Red del navegador) no puede funcionar con este simulador:
`mock-backend.interceptor.ts:44-55` nunca llama a `next(request)` para una ruta simulada, así que **no
hay ningún `XMLHttpRequest`/`fetch` real que el Network de Chrome (ni Playwright, que usa el mismo
protocolo) pueda ver**. El bloqueo de Justin no fue sólo el timeout del login: aunque hubiera entrado,
la pestaña Red iba a seguir vacía para estas rutas.

**Forma real del fan-out, verificada contra el código (`DISCOVERED`, no medida en vivo todavía):**

| Origen | Petición | Archivo:línea |
|---|---|---|
| Ficha del profesional | `GET /profiles/practitioners/:id` | `practitioner-detail.ts:141` |
| Ficha del profesional | etiquetas de terminología (en paralelo) | `practitioner-detail.ts:145-147` |
| Ficha del profesional | foto (en paralelo, sólo si `photoFileId`) | `practitioner-detail.ts:154-159` |
| Disponibilidad | lista de recursos del profesional | `practitioner-availability.ts`, antes de `cuposDe` |
| Disponibilidad | `listSlots` por cada sede/recurso | `practitioner-availability.ts:236-242` |
| Disponibilidad | «próximo hueco» por cada sede **con la semana vacía** | `practitioner-availability.ts:248-256` |

El total no es un número fijo: escala con cuántas sedes tiene el médico elegido. La médica de prueba
tiene 2 recursos (`agenda.ts:99-134`); un registrado sin agenda (los 13 de R-03) tiene 0, así que ni
siquiera llega a pedir `listSlots` — su «elegir médico» es más corto, no más largo, hasta que R-03 les dé
agenda.

**Qué falta exactamente:** un conteo en vivo real — instrumentar un contador de peticiones en
`mockBackendInterceptor` durante un render de `PractitionerDetail` + `PractitionerAvailability` con un
profesional que sí tenga sedes (p. ej. la médica u otro de los 14 con recurso), o esperar el número que
mida Justin. **No bloquea nada de este carril**: H2.S1 (la tabla de latencia decidida) usa la tabla leída
del código, no esta medición.
