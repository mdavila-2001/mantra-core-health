# M6 · Acer Aspire 3 — evidencia H2 (suite determinista, A MEDIAS) y H3 (lint, cerrado)

Rama `marcelo/test-m6-suite-lint` sobre `origin/test` @ `ec7037f7` (primer round, mergeado en
PR #720) y rama `marcelo/test-m6-h2-determinismo` sobre `origin/test` @ `b7fab847` (segundo
round, retomando el carril tras el merge — ver «Segundo round» más abajo).

## H2 — A MEDIAS (no se llegó a REGRESSION_VERIFIED)

**Medido al empezar:** dos corridas completas del mismo commit crasheaban (`Worker exited
unexpectedly`, pool por defecto sin límite de hilos) o daban 17/11 suites rojas con conjuntos
distintos.

### Tres causas raíz reales, encontradas y corregidas

1. **`vitest.config.ts`**: `pool: 'threads'` sin límite hacía que la máquina se quedara sin
   memoria a mitad de la suite. Fijado `maxThreads: 4`.
2. **`pharmacy-inbox.spec.ts` / `inbox-order.spec.ts`**: mockeaban `SessionStore` con
   `{ displayName: () => 'Ana Pérez' }`, sin `userId`. Como `AuthService.userId` se alía por
   asignación (`readonly userId = this.session.userId`, no un getter), queda `undefined`, y el
   `effect()` del constructor de `CartStore` —construido igual porque `PharmacyOrdersClient` lo
   inyecta, aunque esas pantallas de staff no muestran carrito— revienta con
   `TypeError: this.auth.userId is not a function` en un tick asíncrono POSTERIOR, cuando el
   scheduler de Angular lo flushea — casi siempre durante el archivo que corra después en el
   mismo worker, con su `TestBed` ya destruido. Fix: completar los dos dobles con
   `userId: () => null`.
3. **Generalización, en producción**: `CartStore` no es el único servicio `providedIn: 'root'`
   con este patrón. `TutorialProgressStore`, `HelpBlockDismissalStore` y
   `PatientContextService` tienen el mismo `effect(() => { const usuario = this.auth.userId(); ... })`
   sin guarda; `IdleLogout` y `SessionEndedRedirect` —que se inyectan en el
   `provideAppInitializer` de `app.config.ts`, así que CUALQUIER spec que arranque la app real
   los construye— leen `session.isAuthenticated()` de la misma forma. Docenas de specs
   (~45, contadas con `grep -rn "provide: AuthService" --include=*.spec.ts`) reemplazan
   `AuthService` entero con un `useValue` parcial porque su propio componente no necesita
   `userId`; si ese mismo test transitivamente construye cualquiera de estos servicios, el
   `effect()` revienta igual. Fix: `idDeUsuario()`/`haySesion()` privados en los 6 archivos,
   que toleran que el accesor no sea función (`typeof this.auth.userId === 'function' ? … : null`).
   Cero cambio de comportamiento en producción — ahí `userId` siempre es la señal real.

### Evidencia de la mejora (no de la resolución completa)

| Corrida | Config | Archivos rojos | Tests rojos |
|---|---|---|---|
| Antes de tocar nada | `maxThreads` sin límite | — | **crash** (`Worker exited unexpectedly`) |
| Con `maxThreads: 4` | pool por defecto arreglado | 16 | 65 |
| Con el fix #2 (2 specs) | — | 8 / 11 (varía) | 21 / 175 (varía) |
| Con el fix #3 (6 stores) | — | 11 / 13 | 23 / 26 |
| `singleThread: true` (probado y descartado) | — | 10 / 13 | 72 / 27 |

**No se llegó a determinismo real.** Con las tres causas corregidas, dos corridas seguidas
siguen dando conjuntos de archivos rojos DISTINTOS (verificado varias veces, incluida una
corrida completamente aislada sin nada más corriendo en la máquina — 298 tests rojos, peor que
con contención, así que la causa no es contención de CPU). Probar `pool.threads.singleThread`
tampoco lo resolvió: mejora la magnitud pero no la determinismo. Se revirtió a `maxThreads: 4`
(commiteado) porque no hay ganancia real en velocidad de feedback perdida sin el beneficio de
determinismo.

**Diagnóstico de lo que falta:** el mismo patrón (servicio `providedIn: 'root'` con `effect()`
sin guarda + spec en algún lugar de la suite con un doble incompleto de `AuthService`/
`SessionStore`) tiene, casi seguro, al menos una instancia más sin encontrar — la evidencia es
que archivos completamente ajenos entre sí (`medical-laboratory.spec.ts`,
`register-imaging-center.spec.ts`, `patient-chart.spec.ts`, `form-builder.spec.ts` en distintas
corridas) aparecen envenenados desde su primer test, con el mismo síntoma
(`Cannot read properties of undefined (reading 'verify'/'match')` = `http` nunca se asignó
porque el `beforeEach` reventó antes). Los tres archivos víctima verificados (`patient-chart`,
`agenda-create`, `medical-laboratory`) usan la `SessionStore`/`AuthService` REAL o completa en
su propio spec — son víctimas, no la causa.

**Recomendación para quien retome:** aislar con `poolOptions.threads.singleThread: true` +
un reporter que imprima "empieza archivo X" antes de cada test file (el reporter por defecto no
lo hace), para poder identificar el ARCHIVO exacto que antecede a cada víctima en una corrida
reproducible, en vez de inferirlo por eliminación.

### Rojo restante, explicado archivo por archivo (real, no de determinismo)

Estos SON estables entre corridas — son bugs de producto/contenido preexistentes, no cascadas:

| Archivo | Causa |
|---|---|
| `mock-backend.spec.ts` | El mock devuelve "Diagnóstico no encontrado" donde el test espera "Pendiente: carril C3" — deriva de contenido de otro carril (C3 diagnóstico), no de este. |
| `navigation.service.spec.ts` / `shell-layout.spec.ts` (varios) | Faltan `/my-account/questionnaires` en las rutas y "Notas médicas" en el nav — el carril de formularios (lane-27) no está completo en `test`. |
| `access-tree.spec.ts` | Falta el rótulo "Evoluciones" en la rejilla de accesos. |
| `patient-home.spec.ts` | Los 10 tests fallan con `Expected no open requests, found 1: GET /profiles/patients/me` — el componente hace una petición que ningún test del archivo flushea; bug real, no cascada (se repite igual con 1 archivo en el worker). |
| `mock-backend-latencia.spec.ts` | Mide tiempos reales (`dos corridas de la misma ruta tardan lo mismo`); sensible a contención incluso con `maxThreads: 4`. |
| `reconsulta-idempotente.spec.ts` | `Hook timed out in 10000ms` — no usa Angular TestBed (`await import('./agenda')` a secas); posible carga pesada del módulo bajo contención. |

### Segundo round (retomando el carril, 2026-09-26 más tarde)

Entre el merge del PR #720 y este round, `test` recibió commits de varios carriles en paralelo
(`glossary`, `form-builder`, `symptom-check`, `triage-ia`, `register-imaging-center`,
`register-laboratory`, `medical-laboratory`…). El diagnóstico se retomó con un método más
preciso: un hook temporal en `test-setup.ts` (no commiteado, revertido antes de cerrar) que
registra, por PID de worker, el archivo de cada test en un log — así se puede ver exactamente
qué archivo corrió justo antes de una víctima envenenada, en vez de inferirlo.

**Encontradas y corregidas dos causas más, de dos clases distintas:**

4. **`ChatSocketService`** (nuevo, llegado con otro carril): mismo patrón que los 6 servicios
   ya corregidos — `effect(() => { if (!this.session.isAuthenticated() && this.socket) {...} })`
   sin guarda. `my-services.spec.ts` mockea `AuthService` sin `isAuthenticated` (sólo
   `practitionerProfileId`/`activeTenantId`/`roles`), y si algo en su árbol construye
   `ChatSocketService`, revienta igual que los casos anteriores. Fix: `haySesion()` tolerante,
   mismo criterio.
5. **`paginated-form.spec.ts` — NG0912, una causa DISTINTA, no de auth.** El archivo declara
   `HostDeCasillas` y `HostDeSiNo`, dos componentes de prueba con el **mismo template exacto**
   (`<app-paginated-form [paginas]="paginas" [form]="form" label="Antecedentes" />`) y sin
   `selector` explícito. Angular deriva el ID interno del componente del hash del template
   compilado; sin selector y con el mismo template, los dos colisionan
   (`NG0912: Component ID generation collision detected`), visible en el `stderr` de esa
   corrida — y esa colisión deja el `TestBed` en un estado que también envenena al worker,
   aunque el mecanismo es otro (no es el `effect()` de auth). Fix: `selector` explícito y
   distinto en cada uno (`app-host-de-casillas` / `app-host-de-si-no`).

**Resultado, con las dos causas corregidas:** dos corridas dieron **22 tests / 9 archivos**
rojos (el «piso» de bugs reales de la tabla de arriba, sin ninguna cascada) — pero una tercera
corrida volvió a dar **211 tests / 10 archivos**, con `paginated-form.spec.ts` de nuevo entre
las víctimas (esta vez SIN `NG0912` en el log: es decir, esa causa puntual está cerrada, pero el
archivo sigue siendo vulnerable como víctima de OTRA fuente sin identificar). Confirma que
**queda al menos una instancia más** del patrón de doble de `AuthService`/`SessionStore`
incompleto, en algún punto de la suite.

**Por qué no se siguió cazando instancia por instancia:** cada ronda de búsqueda encontró una
causa nueva real (son 5 en total ahora, dos clases distintas), pero el ritmo al que otros
carriles agregan código nuevo a `test` —con el mismo patrón arquitectónico repetido, porque
nadie lo sabe evitar todavía— iguala o supera el ritmo al que se pueden encontrar y corregir una
por una. La búsqueda del archivo exacto que antecede a una víctima tampoco es concluyente: el
`effect()` filtrado puede quedar pendiente varios archivos antes de que el scheduler lo
flushee, no necesariamente en el archivo inmediatamente anterior.

**Recomendación para cerrar esto de verdad** (no ejecutada, por alcance y tiempo):

- **Opción sistémica A — una regla de lint propia**: prohibir `effect(() => { … this.algo.metodo() … })`
  dentro de un `constructor()` de una clase `providedIn: 'root'` cuando `algo` viene de
  `inject(AuthService)`/`inject(SessionStore)`, a menos que el acceso esté protegido por un
  `typeof … === 'function'` (o pase por un método `private` dedicado, como los seis ya
  corregidos). Encontraría las cinco instancias de este carril automáticamente, y cualquier
  instancia futura en el momento en que se escribe, no cuando alguien la pisa por casualidad en
  un worker.
- **Opción sistémica B — un doble canónico**: una función compartida (`dobleDeSesion(overrides)`)
  en `src/testing/` que devuelva un `SessionStore`/`AuthService` COMPLETO por defecto (con
  `isAuthenticated`, `userId`, `roles`, `activeTenantId`, `patientProfileId`,
  `practitionerProfileId`, `displayName` en `null`/vacío), y que las ~45 specs que hoy arman su
  propio `useValue` parcial la usen en vez de un objeto ad-hoc. Un lint que prohíba
  `{ provide: AuthService, useValue: { ... } }` directo (fuera de esa función) haría cumplir el
  uso.
- Cualquiera de las dos cierra la clase de bug entera de una vez, en vez de seguir encontrando
  una instancia nueva cada vez que otro carril agrega una pantalla.

## H3 — Cerrado, `REGRESSION_VERIFIED`

Ver el commit `fix(lint): yarn lint vuelve a exit 0 (H3)`.

```
$ yarn lint
(sin salida, exit 0)

$ yarn tsc -p tsconfig.app.json --noEmit
(sin salida, exit 0)

$ yarn build
...
Output location: …\wt-m6-front\dist\mantra-core-health
(exit 0)

$ npx ng test --watch=false --include "src/app/app.spec.ts" --include "src/app/features/alovida/shell/alovida-shell.spec.ts" --include "src/app/features/alovida/shell/alovida-public-shell.spec.ts"
 Test Files  3 passed (3)
      Tests  27 passed (27)
```

Capturas (dev server real + Playwright, `1280×900`), guardadas en el scratchpad de la sesión:
- `01-shell-publico-buscar.png` — `AlovidaPublicShell` en `/search`, sin sesión: header, buscador,
  pie con las cuatro declaraciones. Igual que antes de OnPush.
- `02-shell-autenticado-organizaciones.png` — `AlovidaShell` en `/directorio` (redirige a
  `organizaciones-listado`): nav lateral con los 10 módulos, header con organización/sesión/
  avisos, la vista `DirectorioOrganizacionesListado` (una de las 120 alovida) con su tabla y
  filtros. Igual que antes.

### Corrección al discovery del encargo (otra vez)

El encargo daba "244 · no-unused-vars 4 · no-empty-function 2 · array-type 2" = 252. La cifra
real medida al arrancar este hito era **144** sólo del rubro OnPush + **19** de las otras reglas
(incluye 11 `no-empty-pattern` que el encargo no menciona, en `playwright/carga-masiva.spec.ts`
— probablemente un archivo agregado después de que se escribió el encargo). De esos 144, **125
eran componentes de prueba declarados dentro de `.spec.ts`** (no las 244 vistas alovida, que ya
estaban en 0 apenas se corrigió el generador + el transform mecánico) — se resolvieron
excluyendo la regla de `**/*.spec.ts`/`playwright/**/*.ts` (mismo criterio que ya usan los
overrides de `atoms/`/`molecules/` en el propio `eslint.config.js` para otras reglas: un doble
de prueba desechable no es "un componente nuevo").

## No cubierto / ambigüedades

- **Q-01** (¿quién es dueño de los 120 archivos, el generador o el archivo?): resuelto de
  facto — se arregló el generador Y se aplicó el mismo transform mecánico a los archivos, sin
  poder ejercitar el generador acá (rutas de macOS hardcodeadas hacia el checkout de Pablo).
- H2 queda **A MEDIAS**, con la causa raíz de fondo (un patrón repetido en 6 servicios más
  decenas de specs con dobles incompletos) diagnosticada pero no cerrada del todo — ver arriba.
