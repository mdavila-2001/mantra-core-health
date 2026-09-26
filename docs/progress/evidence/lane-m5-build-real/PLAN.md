# Plan — M5 · Build real, mock honesto y enrutado (2026-09-26)

- Fecha: 2026-09-26 · Repo: `mantra-core-health` · Rama: `justin/test-m5-build-real` (worktree `wt-m5-build-real`, desde `origin/test` @ `ec7037f7`)
- Fuente del plan (regla 20, excepción de carril): el encargo de la máquina M5 en
  `AlovidaPromptManager/repartos/2026-09-26/PromptMaquinas/M5-LaptopJustin/Preproduccion.FrontSalidaDelSimulador/BuildRealMockHonestoYEnrutado.md`,
  con las tres capas H/S/M, CA y DoD ya escritas ahí. Este archivo trackea el estado de ejecución
  y las decisiones tomadas; no duplica el texto del encargo.
- Resultado observable: existe un artefacto de producción (`--configuration=production-api`) que
  habla con la API real (SSR encendido, simulador y demos apagados, sin cartel de cuentas demo,
  sin dominios de túneles); el mock deja de inventar éxitos (501 ante ruta desconocida) y alinea
  su forma de error con la API; los 3 prefijos que faltaban (`/loyalty`, `/patients/me/reviews`,
  `/ai`) están en las tres declaraciones.
- Kill-test: build `production-api` levantado + pestaña de red mostrando que una petición la
  contesta la red (sin `x-mock-backend`) y no el interceptor.

## Alcance (igual al del encargo)
- IN: `src/environments/**`, `angular.json`, `app.html`, `app.ts`, `app.config.ts`, `src/server.ts`,
  `Dockerfile`, `deploy/`, `src/app/core/mock/**`, `proxy.conf*`, `scripts/check-*.mjs`.
- OUT: pantallas y contratos de dominio; lint/suite completa del front (M6); pasarela de pago y
  delivery (excluidos por pedido previo).

## Decisiones de alcance tomadas en este carril (registradas, no resueltas por conveniencia)
1. **H2.S1.M4 (inventario mock↔API en CI)** se acota a **mock↔cliente** (handlers del simulador
   contra las llamadas de `core/data-access/**/*.client.ts`, reusando `scanEndpoints()` de
   `scripts/lib/scan.mjs`, ya construido para `check-client-prefixes.mjs`). El diseño completo de
   BR-02 (`sync-api-inventory.mjs` clonando `mantra-core-health-redesa-api`, allowlist con
   trinquete, extracción por AST) excede el IN de este encargo (no incluye `scripts/api-inventory/**`
   ni tocar otro repo) y es var un prompt propio. Se declara acá, no se adivina.
2. **`request-access.ts:104`** (`http === 412`) se corrige a ramificar por `code` en vez de status,
   porque cambiar `preconditionFailed()` a 422 (H2.S1.M2) rompe esa pantalla si no se toca. Es
   consecuencia directa y mínima del cambio, no "aprovechar para mejorar" (regla 00 §3.3): un
   único `if`, sin tocar el resto del archivo.
3. **D-C (triage IA)** se resuelve con la **opción C del propio BR-03** («apagado hasta decidir»):
   sin destino en el repo, nginx devuelve 503 JSON. Es la opción explícitamente prevista para
   "sin servicio", no una decisión de negocio inventada; D-C sigue registrada como pregunta abierta
   para el propietario en `docs/progress/DECISIONS.md`.
4. **Prueba de runtime contra la API viva**: no se levanta el stack `mantra-redesa` completo (Docker
   pesado, 15 GB libres en disco). Se verifica en su lugar que, con la API apagada, el build
   `production-api` levantado **no** responde con el mock (sin `x-mock-backend`, error de red real
   en vez de 200 fabricado) — ver `evidencia/`. Declarado como `No cubierto` lo que falta contra una
   API real arriba.

## Hitos (estado vivo — ver también el encargo)

| ID | Hito | Estado |
|---|---|---|
| H1 | Artefacto de producción que habla con la API real | HECHO |
| H2 | El simulador deja de esconder las brechas | HECHO |
| H3 | El enrutado de producción no miente con 200 | A MEDIAS (H3.S1.M2 sin verificar contra nginx real) |

## H1 — cerrado

`yarn build --configuration=production-api` exit 0 (bloqueaba con `TypeError: Cannot read
properties of undefined (reading 'enabled')` por un ciclo de auto-import de
`environment.production-api.ts` vía `fileReplacements`, corregido escribiéndolo standalone; y
luego con un `TimeoutError` real prerenderizando `/auth/register/practitioner` porque
`SystemContextClient.dynamicEnum()` no tenía el guardia `isPlatformBrowser` que sí tienen
`BoDepartmentsCatalog`/`BoMunicipalitiesCatalog`/`MedicalSpecialtiesCatalog` — mismo patrón,
aplicado). `check-real-api-config.mjs` extendido y en verde. 10/10 specs de `environments/`.
Verificado con Playwright contra el servidor real levantado: sin `app-mock-banner` en el DOM,
0 respuestas con `x-mock-backend` en 6 combinaciones de viewport/tema, y un `fetch('/iam/auth/login')`
desde el navegador sin la forma de éxito fabricada del mock. Capturas en `fotos/auth-*.png`,
doble revisión en `doble-revision.md`.

## H2 — cerrado

`mock-router.ts`: `preconditionFailed` 412→422, `validation` 422+`issues`→400+`details.violations`
(ya leído así por `error-to-view-state.ts:issuesOf` — el mock estaba desalineado, no la app).
`respuestaGenerica`→501 `NOT_IMPLEMENTED_IN_MOCK` + `window.__mockGaps`. Roles de la médica demo
→ sólo `PRACTITIONER`. Forzó dos arreglos consecuentes (fuera del IN literal, pero necesarios para
no romper lo que ya andaba, registrados en la regla de alcance): `request-access.ts` pasó a
ramificar por `code` en vez de status 412; 18 tests de 7 specs reescribieron su contrato (422→400
o 412→422 y `issues`→`details.violations`), ninguno borrado ni debilitado.
`check-mock-vs-client.mjs` nuevo (acotado a mock↔cliente, ver §decisiones): 515 operaciones,
550 manejadores, 6 sin manejador — las 6 ya conocidas y con dueño. Probado rompiéndolo a propósito
dos veces (agregando y quitando entradas de `CONOCIDAS`): falla como corresponde en los dos casos.
380/381 specs verdes en el barrido dirigido (el 1 rojo es preexistente — `mock-backend.spec.ts`
"C3", falla igual en `origin/test` sin tocar nada, confirmado con `git stash`).

## H3 — a medias

H3.S1 cerrado: `/loyalty`, `/patients/me/reviews`, `/ai` en las tres declaraciones;
`check-api-prefixes` y `check-client-prefixes` en verde (66 y 65 prefijos respectivamente).
`/ai` resuelve en Opción C (503 JSON, D-C sin decidir — `docs/progress/DECISIONS.md`); la IP
`173.249.39.237` salió de `proxy.conf.mjs` (sin default; `git grep` limpio salvo docs históricos
y un comentario de spec, ver REPORTE). **H3.S1.M2 no se verificó contra un nginx real** — no se
levantó el compose completo (fuera de alcance de máquina/tiempo de este carril); sólo se validó
la sintaxis de los tres archivos y que los verificadores estáticos pasan.
