# H1.S2.M1 — Latencia ANTES de R-02

## Leída del interceptor (peldaño `DISCOVERED` — cita real, no medición)

`src/app/core/mock/mock-backend.interceptor.ts:251-259`, función `latencia(path)`:

| Prefijo | ms (código) | Motivo en el comentario |
|---|---|---|
| `/terminology` | 40 fijos | (sin comentario propio; primera rama del `if`) |
| `/iam/auth/upload-registration-document` | 600 fijos | «para que la barra de "subiendo" no pase de vacía a lista sin que nadie la vea» |
| resto (incluye `/scheduling/slots`, `/profiles`) | `120 + Math.floor(Math.random() * 180)` → entre 120 y 299, **al azar en cada petición** | «Un poco de espera, para que los estados de carga existan» |

`timer()` aplica ese valor a cada respuesta (`L69`, `L98`).

## Corrección tras usar el navegador: por qué la Red del navegador no sirve acá

Con la memoria recuperada (3.10 GB libres) se retomó el intento con Playwright real: login como
`paciente@alovida.mock`, `/directory`, un profesional, `/directory/:id`. El login y la navegación
funcionaron. Pero `browser_network_requests` (con y sin `static: true`, con y sin filtro) **nunca
mostró una sola petición hacia `/profiles`, `/scheduling` ni `/terminology`** — sólo los 302 recursos
propios del dev server (chunks de Vite, fuentes, componentes `@ng/component`).

La causa está en el código, no en la herramienta: `mock-backend.interceptor.ts:43-55`
(`mockBackendInterceptor`) es un `HttpInterceptorFn` que, cuando `environment.mockBackend` está
activo, **nunca llama a `next(request)`** para las rutas simuladas — devuelve directamente
`from(routerSimulado()).pipe(mergeMap((tabla) => atender(tabla, request, path)))`, un `Observable`
resuelto en memoria con `timer(latencia(path))`. La cadena de interceptores de Angular termina ahí:
no se emite ningún `XMLHttpRequest` ni `fetch` real, así que **no hay nada que el `Network` del
navegador (ni Chrome DevTools Protocol, que es lo que usa Playwright) pueda observar**. Medir «10
peticiones reales a `GET /scheduling/slots` con la Red abierta» tal como lo pide la ficha es, con este
diseño, **imposible por construcción** — no un bloqueo de entorno.

**Esto invalida el método pedido, no el objetivo.** El objetivo (saber cuánto tarda de verdad una
respuesta simulada) se puede medir igual, y mejor: cronometrando el propio `Observable` con
`performance.now()` alrededor de la suscripción, en un spec que ejercita el camino real
(`mockBackendInterceptor` → `routerSimulado()` → `atender()`), sin necesitar navegador. Ver
`agendas-cobertura.spec.ts` como precedente de spec de sólo lectura sobre el simulador; la medición
de latencia va en su propio spec (`latencia-observada.spec.ts`), con la salida pegada abajo.

## Observada — 10 respuestas reales del interceptor a `GET /scheduling/slots`, cronometradas

**Estado: `HECHO`.** Medido con `performance.now()` alrededor de la suscripción real a
`mockBackendInterceptor` (no al navegador — ver la corrección de arriba).

Comando: `npx ng test --include=src/app/core/mock/latencia-observada.spec.ts --watch=false` → **PASS**
(`docs/trabajo/.../evidencia/antes/latencia-observada-raw.txt`, salida real, no parafraseada):

```
[H1.S2.M1] GET /scheduling/slots × 10 — min=135.5ms max=4103.1ms avg=616.5ms —
valores=4103.1,245.9,319.9,261.2,204.5,181.6,135.5,264.7,250.6,198.5
```

Lectura honesta: el primer valor (4103.1 ms) es el costo único de `import('./handlers')` —
`routerSimulado()` carga el módulo de manejadores perezosamente en la primera llamada
(`mock-backend.interceptor.ts:35-39`, comentario propio: «se cargan en un trozo aparte... la primera
vez que hace falta»), no la latencia simulada. **Sin ese valor de arranque, los 9 restantes van de
135.5 a 319.9 ms**, consistente con `120 + Math.floor(Math.random() * 180)` (rango exacto: 120–299,
más algunos ms de overhead real de la suscripción y el test). **Esta variación de hasta 184 ms entre
peticiones idénticas es exactamente el azar que H2.S1 tiene que eliminar bajo E2E.**

- Qué se intentó: `yarn env:generate && npx ng serve --port 4201` (puerto propio, distinto del 4200/4000
  que ya ocupan otras sesiones de la máquina compartida — ver §"Riesgo" de la ficha: «cuatro personas no
  trabajan» si se rompe algo compartido). Dos corridas.
- Qué falló: la primera corrida completó el build (47 s, bundle de 2.41 MB inicial) y quedó escuchando en
  `:4201`, pero al lanzar en paralelo la corrida de `agendas-cobertura.spec.ts` (H1.S2.M2) el proceso de
  `vitest` murió con `FATAL ERROR: JavaScript heap out of memory` — dos builds/test-runners simultáneos en
  esta máquina la saturan (regla 70.1.4). Se paró el servidor (`TaskStop`) antes de reintentar el spec.
- Al reiniciar el servidor solo (sin nada más corriendo), un segundo intento murió con
  `Error: The service was stopped` (el proceso persistente de `esbuild` fue matado por el sistema).
  `Get-CimInstance Win32_OperatingSystem` mostró **3.41 GB libres de 15.73 GB totales** en ese momento.
- Puertos ya ocupados por procesos que **no son míos** y que la ficha pide no tocar sin necesidad
  (`netstat -ano`): `:4000` (PID 27172, ya estaba antes de este turno) y `:4200` (PID 32452, apareció
  durante este turno sin que yo lo iniciara). Consistente con la advertencia propia de la ficha: la máquina
  la comparten cinco personas esta noche.
- Clase (regla 80.4): `ENVIRONMENT` — la máquina de desarrollo compartida no tiene memoria libre para
  sostener un `ng serve` mío además de lo que ya corren las otras sesiones. No es un bug de mi código ni
  de mi configuración: el build de `:4201` sí completó una vez, y el interceptor no cambió.
- Qué lo destraba: memoria libre suficiente (liberar alguna de las otras sesiones, o repetir la medición
  en un momento de menor concurrencia), o correrla en una máquina/CI dedicada.
- **No inventado**: no se declara un rango observado sin haberlo medido (regla 00 §2.1, regla 30). El
  «antes» que queda documentado es el leído del código, citado arriba con archivo y línea.

## Lo que sí se puede afirmar hoy

- La tabla «leída del código» es real y citada (`DISCOVERED`); sirve de base para decidir H2.S1.M1 sin
  esperar la medición en vivo, que sigue pendiente.
- Justin declaró el mismo bloqueo para «elegir médico» (H1.S2.M3) el 2026-09-23 en
  `docs/trabajo/2026-09-23-reserva-y-cotizaciones/evidencia/antes/red-flujo-reserva.md` de este mismo
  repo: timeout de 30 s esperando `/iam/auth/login` con Playwright. Mismo síntoma (servidor local que no
  responde a tiempo bajo esta máquina compartida), evidencia independiente de que el problema es de
  entorno, no de un carril en particular.
