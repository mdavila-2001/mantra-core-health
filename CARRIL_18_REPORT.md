# Carril 18 — Doctor: contabilidad, organizaciones y notificaciones (frontend)

**Estado: BLOQUEADO antes del merge.** El código está completo, commiteado, y probado (build + typecheck + lint + tests unitarios/de componente, todos limpios). Pero **no se pudo completar la verificación funcional en navegador (Playwright)** exigida por la regla operativa del usuario: el bloqueador está en el **backend** (no pudo levantar en una ventana de tiempo razonable por contención severa del entorno compartido — ver `CARRIL_18_REPORT.md` del repo `mantra-core-health-redesa-api` para el detalle), y sin backend vivo no hay flujo real que verificar en el navegador de este repo tampoco. Por lo tanto, **no se mergeó a `dev` local**.

## Rama y commits

- Rama: `fix/alovida-c18-doctor_accounting_notifications`
- Base `origin/dev` usada al crear la rama: `42599eb` (Merge pull request #104). **Rebaseada** contra `origin/dev` actualizado (`d2078f0`, "rediseño premium del login") durante el carril — sin conflictos. Se volvió a fetchear al final: `origin/dev` sigue en `d2078f0`, sin cambios nuevos.
- **Commit HEAD final: `e0cdf53`** — `fix(notifications): resuelve la colisión de la ruta con el prefijo de la API`
- Commits de la rama (orden cronológico, post-rebase):
  1. `d2078f0` — (upstream, incorporado por el rebase) `feat(auth): rediseño premium del login`
  2. `0a2d8c4` — `feat(data-access): clientes del auto-servicio del doctor (Carril 18)`
  3. `28f2728` — `feat(doctor): pestañas de contabilidad (escritura), organizaciones y notificaciones`
  4. `e0cdf53` — `fix(notifications): resuelve la colisión de la ruta con el prefijo de la API`
- `dev` local: **sin tocar**, sigue en `d2078f0` (no se mergeó).

## Riesgo operativo detectado durante el carril

Mismo entorno compartido que el backend (ver el otro reporte). En este repo, la rama activa del checkout cambió sola a `fix/alovida-c03-glossary_medical` en un momento en que este agente todavía no tenía cambios sin commitear aquí, así que no hubo pérdida de trabajo — solo se volvió a `checkout` la rama correcta tras el chequeo defensivo de rigor.

## Conflictos encontrados y resolución

- `origin/dev` avanzó un commit durante el carril: `d2078f0` (`feat(auth): rediseño premium del login — tarjeta elevada y acentos de marca`), solo CSS/HTML del login y de `auth-split`, sin tocar `data-testid` ni estructura funcional. `git rebase origin/dev` se aplicó **sin conflictos**.

## Bloqueador: verificación Playwright no realizada (depende del backend, ver reporte del otro repo)

Se preparó toda la infraestructura de verificación:
- Playwright 1.61.1 + Chromium instalados en un directorio de scratchpad aislado (no se agregó como dependencia de este repo).
- Script de verificación completo (`verify.js`) escrito y listo: registra un profesional real contra la API (`POST /iam/auth/register-practitioner`, el mismo endpoint que usa la suite Cypress `real/03-medico.cy.ts` de este repo), lo vincula a una práctica y le crea cuentas contables vía la cuenta admin sembrada (`admin@redesa.test`), y luego conduce un navegador real: login por la pantalla `/auth` real (mismos `data-testid` que usa la suite Cypress existente), y ejercita los tres flujos: registrar un gasto en Contabilidad, pedir una vinculación en Mis organizaciones, y alternar una preferencia en Notificaciones.
- **No se pudo ejecutar** porque el backend (`mantra-core-health-redesa-api`, puerto 3009, corriendo desde el código fuente de la rama de este mismo carril) no terminó de compilar/levantar en ninguna de las dos ventanas de espera acotadas que se le dieron (la segunda, tras reiniciar el proceso desde cero, con un timeout explícito de 3 minutos). Causa confirmada: contención de CPU/E/S del host compartido con al menos otro agente concurrente (`load average` sostenido 26-34 durante toda la ventana).
- Usar el contenedor Docker del frontend ya corriendo (`mantra-core-health-dev`, puerto 4200) tampoco habría sido una verificación honesta de este carril: ese contenedor sirve el bundle de una imagen construida antes de este trabajo, no el código de esta rama.

**No se fabricó evidencia.** No hay screenshots ni un "resultado Playwright" en este reporte porque el script nunca llegó a correr contra un backend con el código de este carril.

## Alcance implementado

### Contabilidad (`administration/accounting`, ya existía)
- Reutiliza el componente/cliente ya wireados (lectura de balance y diario) — no se duplicó nada.
- Banner de explicación + ejemplo (corrección P0 #6).
- Se cablea `chartOfAccounts()` (ya existía en el cliente, sin usar en pantalla) como selector de cuentas.
- `AccountingClient` gana `listPaidConsultations`/`registerConsultationIncome`/`registerSimpleEntry`, y dos formularios reales: **registrar ingreso de consulta pagada** (factura + cuentas; el importe lo calcula el servidor) y **registrar gasto** (cuentas + importe + descripción). Sin mocks: llaman a `POST /accounting/practitioner/...` de verdad.
- Se corrige `appAnnounceOnAppear` → `appAnuncio` (selector real de la directiva de accesibilidad; el error ya existía en esta pantalla antes de este carril).
- Tutorial de Contabilidad ampliado a `PRACTITIONER` (antes lo excluía) y a cubrir el registro, no solo la consulta.

### Mis organizaciones (`/my-organizations`, nueva)
- No existía ninguna pantalla doctor-facing para esto (`administration/organizations` es admin-only y de otro dominio).
- Extiende `PracticeSitesClient` (mismo controlador backend que `/practitioners/:id/sites`) en vez de crear un cliente nuevo.
- Lista vinculaciones propias (cualquier estado) y permite pedir una nueva, aclarando que queda pendiente y que no otorga acceso a pacientes.
- Ruta `/my-organizations`, no `/organizaciones`: el proxy de desarrollo desvía `/org*` a la API.

### Notificaciones (`/my-notifications`, nueva)
- No existía cliente ni pantalla para preferencias/bandeja propia de `messaging` (`CommunityClient.listNotifications` es un dominio distinto — feed social).
- Nuevo `NotificationsClient`. Bandeja in-app real + preferencias por categoría/canal. Marca explícitamente qué canales no tienen proveedor externo conectado en este entorno.
- **Colisión de ruta detectada y corregida en este mismo carril**: el cliente llama a `/notifications/*`; hacía falta sumar ese prefijo a `proxy.conf.json`, pero la pantalla vivía en esa misma ruta. Se renombró la pantalla a `/my-notifications` (mismo patrón que `/my-organizations`); el contrato del backend no se tocó.

### Nav y rutas
- `navigation.map.ts`: `my-organizations` (`roles: ['PRACTITIONER']`), `my-notifications` (sin roles).
- `app.routes.ts`: entradas de carga diferida para ambas.
- `node scripts/check-route-prefixes.mjs` → 132 rutas, 0 colisiones (28 prefijos). `node scripts/check-architecture.mjs` → sin ciclos, capas en una dirección. `node scripts/check-tokens.mjs` → 205 tokens, sin literales inventados (se verificaron los tokens CSS usados —`--e1..e10`, `--tinta-3`, `--filete`, `--filete-2`, `--r-card`— contra `src/styles/redsat.css` antes de usarlos).

## Deuda y bloqueadores documentados

- La UI de "Registrar gasto" solo expone `kind: 'EXPENSE'`; el backend también soporta `'OTHER_INCOME'` pero no se agregó un segundo formulario por acotar el alcance.
- El panel de preferencias usa constantes de UUID documentadas (`notification-concepts.ts`, `role-assignment-concepts.ts`) en vez de un `ConceptSelect` genérico, porque el backend no tiene un catálogo filtrado a esas categorías/estados concretos. Quedan explícitamente marcadas como "pueden desincronizarse si cambia la clave de origen en el backend — no hay verificación automática cruzando ambos repositorios."
- Los tutoriales nuevos de "Mis organizaciones" y "Notificaciones" son texto, no un recorrido guiado por elementos concretos (`appTutorialTarget`) — cumple la corrección P0 #6 parcialmente (explicación + ejemplo sí están en pantalla).
- **Verificación Playwright end-to-end: no realizada**, bloqueada por el backend (ver arriba). Es la deuda más importante de este carril: el código no se considera "funcionando de punta a punta" hasta que se corra `verify.js` (dejado listo en el scratchpad de esta sesión, no en el repo) contra un backend real levantado con éxito.

## Comandos de prueba ejecutados y resultado

| Comando | Resultado |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | ✅ limpio |
| `npx eslint <archivos tocados>` | ✅ limpio |
| `node scripts/check-route-prefixes.mjs` | ✅ 132 rutas, 0 colisiones |
| `node scripts/check-architecture.mjs` | ✅ sin ciclos |
| `node scripts/check-tokens.mjs` | ✅ 205 tokens consistentes |
| `npx ng build --configuration development` | ✅ build completo (solo advertencias preexistentes NG8113, corregidas) |
| `npx ng test --include=".../accounting.spec.ts" --include=".../notifications.spec.ts" --include=".../my-organizations.spec.ts"` | ✅ 3 archivos, 11/11 tests |
| `npx ng test --include=".../accounting.client.spec.ts" --include=".../practice-sites.client.spec.ts" --include=".../notifications.client.spec.ts"` | ✅ verdes (4+6+5 tests) |
| `yarn test` (suite Vitest completa del repo) | ⚠️ no ejecutada — mismo entorno bajo contención severa; se priorizaron las corridas acotadas por archivo, todas verdes |
| Playwright (navegador real) | ❌ **bloqueado** — depende del backend, ver arriba |

## Merge a `dev` local

**No realizado.** `dev` local permanece en `d2078f0`, sin el trabajo de este carril.

## Recordatorio: sin `git push`

No se hizo ni se hará push a ningún remoto.
