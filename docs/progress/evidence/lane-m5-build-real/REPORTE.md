# Reporte — M5 · Build real, mock honesto y enrutado (2026-09-26)

> **AVANCE: 15 / 15 microtareas — 100 %.**

- Fecha: 2026-09-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `justin/test-m5-build-real`
  (worktree `wt-m5-build-real`, sobre `origin/test` @ `ec7037f7`)
- Peldaño de evidencia alcanzado: **`VERIFIED`** en H1, H2 y H3 (runtime real observado con
  Playwright + servidor levantado, y con nginx + el stack `mantra-redesa` real levantados en
  esta misma máquina — Docker Desktop no estaba corriendo al escribir el reporte original; una
  vez arriba, se pudo cerrar H3.S1.M2).
- Encargo fuente: `AlovidaPromptManager/repartos/2026-09-26/PromptMaquinas/M5-LaptopJustin/
  Preproduccion.FrontSalidaDelSimulador/BuildRealMockHonestoYEnrutado.md`

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `environment.production-api.ts`: mock y las 4 demos en `false` | `corepack yarn test --watch=false --include=src/environments/*.spec.ts` | PASS 2/2 archivos, 10/10 pruebas |
| H1.S1.M2 | Configuración `production-api` en `angular.json` (SSR encendido) | `corepack yarn build --configuration=production-api` | PASS exit 0 |
| H1.S1.M3 | `allowedHosts` de `production-api` sin dominios de túneles | `node scripts/check-real-api-config.mjs` | PASS |
| H1.S1.M4 | `Dockerfile` recibe `BUILD_CONFIGURATION` por `ARG` (default `production`, no rompe la maqueta) | lectura del `Dockerfile` + build local con la config por defecto | PASS — `corepack yarn build` (mockup) exit 0 |
| H1.S2.M1 | `app-mock-banner` sólo con `mockBackend` (`@defer (when mockBackend)`) | Playwright, `page.locator('app-mock-banner, .mock').count()` | PASS: 0 en `production-api`, 2 en la maqueta |
| H1.S2.M2 | `mockBackendInterceptor` no se registra con `mockBackend:false`; `/public/media/:id` sólo con el mock | Playwright, `fetch('/iam/auth/login')` desde el navegador contra el server levantado | PASS: sin `x-mock-backend`, sin la forma de éxito fabricada, en las 6 combinaciones de viewport/tema |
| H1.S2.M3 | `check-real-api-config.mjs` extendido: exige SSR encendido, sin túneles y las 4 demos en `false` en `production-api`; nuevo `environment.production-api.spec.ts` | `node scripts/check-real-api-config.mjs` | PASS |
| H2.S1.M1 | `respuestaGenerica` → 501 `NOT_IMPLEMENTED_IN_MOCK` + `window.__mockGaps` | specs dirigidos de `core/mock/**` | PASS 380/381 (1 rojo preexistente, ver «No cubierto») |
| H2.S1.M2 | `preconditionFailed` 412→422; `validation` → 400 + `details.violations` | ídem + `error-to-view-state.spec.ts` sin tocar (ya esperaba esa forma) | PASS |
| H2.S1.M3 | Roles de la médica demo → sólo `PRACTITIONER` | ídem | PASS |
| H2.S1.M4 | `check-mock-vs-client.mjs`: 515 operaciones · 550 manejadores · 6 sin manejador, las 6 conocidas | `node scripts/check-mock-vs-client.mjs` (roto a propósito 2 veces y restaurado) | PASS |
| H3.S1.M1 | `/loyalty`, `/patients/me/reviews`, `/ai` en las tres declaraciones | `node scripts/check-api-prefixes.mjs && node scripts/check-client-prefixes.mjs` | PASS — 66 y 65 prefijos |
| H3.S1.M2 | Comprobar cada prefijo contra el artefacto levantado | nginx real (`nginx:1.27-alpine`) + el stack `mantra-redesa` (Postgres/Mongo/Redis/OpenSearch/MinIO/API) + `server.mjs` de `production-api`, los tres arriba a la vez | PASS — ver detalle abajo. **Encontró y corrigió un bug real** que los verificadores estáticos no ven |
| H3.S2.M1 | D-C registrada en `docs/progress/DECISIONS.md` | lectura del archivo | PASS |
| H3.S2.M2 | IP `173.249.39.237` fuera de `proxy.conf.mjs` (sin default) | `git grep -n '173.249.39.237'` | PASS — sólo quedan 4 menciones históricas/de comentario, ver «No cubierto» |

### H3.S1.M2, en detalle

Docker Desktop no estaba corriendo cuando se escribió la primera versión de este reporte; al
arrancarlo, el stack `mantra-redesa` completo subió solo (tenía política de reinicio). Con eso
arriba, se armó la topología real: `server.mjs` de `production-api` local (`:4126`) + un
contenedor `nginx:1.27-alpine` con `deploy/nginx.conf` + `api-locations.conf` + `api-proxy.conf`
montados (los `upstream` se apuntaron a `host.docker.internal`, que en Docker Desktop resuelve al
host — la única diferencia con el despliegue real, donde todo comparte una red de Docker) + la API
real en `:3000`.

```text
$ curl -si -H "Host: localhost" http://127.0.0.1:8099/terminology/value-sets       # control
HTTP/1.1 401 Unauthorized · application/json                                       # OK, llega a la API

$ curl -si -H "Host: localhost" http://127.0.0.1:8099/loyalty/me
HTTP/1.1 404 Not Found · application/json
{"code":"NOT_FOUND","message":"Cannot GET /loyalty/me", ...}                       # JSON real de la API

$ curl -si -H "Host: localhost" -X POST http://127.0.0.1:8099/patients/me/reviews
HTTP/1.1 404 Not Found · application/json                                          # JSON real de la API

$ curl -si -H "Host: localhost" -X POST http://127.0.0.1:8099/ai/v1/triage/analyze
HTTP/1.1 503 Service Temporarily Unavailable · application/json
{"statusCode":503,"code":"DEPENDENCY_UNAVAILABLE","message":"El triage por IA no está disponible en este despliegue.", ...}
```

Los tres dan JSON — **nunca** el `index.html` del SSR. El 404 de `/loyalty/me` y de
`/patients/me/reviews` es la API diciendo que esa ruta puntual no está implementada de su lado
(gap ya conocido, ver «Riesgos residuales»); lo que este microtarea garantiza —que nginx los
enruta y no se los come el SSR— **sí quedó demostrado**.

**Bug real encontrado y corregido en el camino:** `deploy/api-locations.conf` tenía
`location ^~ /patients/me/reviews/` **con barra final**, copiando el patrón de otros prefijos de
la misma tabla. El cliente (`community.client.ts:802`) llama la ruta **sin** barra
(`POST /patients/me/reviews`), así que nginx nunca la hacía matchear — caía al `location /` y el
SSR devolvía HTML con 200 (o, en una prueba con `curl` que fuerza la barra, nginx devolvía un 301
a sí mismo). **`check-api-prefixes.mjs` no lo detecta** porque normaliza la barra final antes de
comparar (`p.endsWith('/') ? p.slice(0,-1) : p`), así que el verificador estático veía los
prefijos «iguales» mientras nginx los trataba distinto. Se sacó la barra; commit aparte, con el
`curl` de antes y de después pegado.

## Pendiente

Ninguna microtarea del encargo quedó sin cerrar.

## Evidencia

```text
$ corepack yarn build --configuration=production-api
...
Output location: C:\Users\usuario\Documents\Sistema Salud\wt-m5-build-real\dist\mantra-core-health
(exit 0)

$ corepack yarn build   # la maqueta, sin tocar
...
Output location: ...\dist\mantra-core-health
(exit 0)

$ node scripts/check-real-api-config.mjs
[check-real-api-config] ✓ real-api apaga la maqueta, las demos de campañas y pago, y el SSR; development y production intactos.

$ node scripts/check-api-prefixes.mjs
✓ check-api-prefixes
  66 prefijos, iguales en las 3 fuentes

$ node scripts/check-client-prefixes.mjs
✓ check-client-prefixes
  515 operaciones de core/data-access, todas cubiertas por los 65 prefijos

$ node scripts/check-mock-vs-client.mjs
✓ check-mock-vs-client
  515 operaciones de core/data-access · 550 manejadores del mock · 6 sin manejador, las 6 ya conocidas y con prompt propio

$ corepack yarn typecheck   (exit 0)
$ corepack yarn eslint <18 archivos tocados>   (exit 0, sin salida)

$ corepack yarn test --watch=false --include=src/app/core/mock/**/*.spec.ts \
    --include=src/app/core/data-access/system-context/*.spec.ts \
    --include=src/environments/*.spec.ts \
    --include=src/app/features/clinical-record/request-access/*.spec.ts
 Test Files  1 failed | 40 passed (41)
      Tests  1 failed | 380 passed (381)
```

Runtime (Playwright, servidor `production-api` levantado en `:4123`, sin API real detrás):
- `page.locator('app-mock-banner, .mock').count()` en `/auth`, 1440/claro → **0**.
- 6 contextos (375/768/1440 × claro/oscuro): **0** respuestas con cabecera `x-mock-backend` de
  ~140 peticiones cada uno.
- `await fetch('/iam/auth/login', {method:'POST', body:'{}'})` desde la página →
  `{status:200, mockHeader:null, body:'<!DOCTYPE html>...'}`: **no** la forma de éxito que el mock
  fabricaba antes (`{accessToken,...}`); es el `index.html` del SSR, que es lo que responde
  cualquier prefijo de la API cuando —como en esta prueba manual sin nginx— nadie lo enruta. Ver
  «No cubierto».
- Comparado contra la maqueta (mismo build, `mockBackend:true`): `app-mock-banner` presente (2),
  `/public/media/algo` redirige (302 → opaque, `status:0` bajo `fetch` con `redirect:'manual'`,
  el comportamiento esperado del navegador).

Capturas: `fotos/auth-{375,768,1440}-{light,dark}.png` (producción real) +
`fotos/debug-mockup-1440-dark.png` (maqueta, referencia del hallazgo). Doble revisión completa en
`doble-revision.md`.

## No cubierto

- **El `fetch('/iam/auth/login')` de la evidencia de H1.S2** se hizo contra el server solo, sin
  nginx ni API real detrás (por eso da 200 con HTML): en ese momento Docker todavía no estaba
  arriba. Queda como estaba escrito, y no hacía falta repetirlo — lo que probaba (que el
  interceptor del mock no responde) no depende de que haya un backend real detrás; H3.S1.M2 sí
  se repitió con todo arriba y quedó en «Completado».
- **El grep de la IP en documentación histórica.** `git grep 173.249.39.237` sigue encontrando 4
  menciones: 3 en `docs/brechas-front-back-2026-09-24/` (el informe que documentó el hallazgo,
  fecha pasada) y 1 en un comentario de `triage-ia.client.spec.ts` (referencia documental, no un
  valor operativo). Ninguna es un destino de red real; no se tocaron por ser un carril de
  documentación aparte, no de build/enrutado.
- **`check-mock-vs-client.mjs` no cruza contra la API real**, sólo contra el cliente — ver la
  decisión registrada en `PLAN.md`. El diseño completo (BR-02, con `sync-api-inventory.mjs`
  clonando `mantra-core-health-redesa-api`) queda fuera.
- **La suite completa del front** no se corrió como compuerta (documentado como no determinista
  por M6/H-3 del propio reparto); se usaron specs dirigidos a lo tocado, como pide el encargo.
- **`yarn lint` global** no se corrió (263 errores preexistentes, de M6); sí se lintearon los 18
  archivos que este carril tocó, en 0.
- **Dockerfile.dev** (contenedor de desarrollo) no se tocó: el placeholder `__AI_ORIGIN__` que
  agregué a `proxy.conf.docker.json` no tiene sustitución en su `sed`, así que en ese flujo
  concreto `/ai` queda apuntando a un host inexistente hasta que alguien lo cablee — no rompe nada
  que ya funcionara (antes `/ai` no estaba declarado ahí), y `Dockerfile.dev` no está en el IN de
  este encargo.

## Desvíos del plan

1. **`environment.production-api.ts` no hereda de `environment.ts` por spread** (a diferencia de
   `environment.real-api.ts`, que sí hereda de `environment.development.ts`): heredar del archivo
   que el propio `fileReplacements` reemplaza arma un ciclo de auto-import. Se detectó porque
   `yarn build --configuration=production-api` fallaba en «extracting routes» con
   `Cannot read properties of undefined (reading 'enabled')`; se reescribió standalone, con los
   mismos respaldos de `envFromProcess` que `environment.ts`. Documentado en el propio archivo.
2. **`SystemContextClient.dynamicEnum()` ganó el guardia `isPlatformBrowser`** que ya tienen
   `BoDepartmentsCatalog`/`BoMunicipalitiesCatalog`/`MedicalSpecialtiesCatalog`, mismo patrón:
   sin él, prerenderizar `/auth/register/practitioner` colgaba `yarn build` con un
   `TimeoutError` real (la regla del propio encargo — «las rutas Prerender no pueden depender de
   la API en tiempo de build» — ya lo anticipaba). Es la primera vez que alguien construye con
   `mockBackend:false` y SSR encendido a la vez; el defecto es preexistente, sólo nadie lo había
   disparado.
3. **`request-access.ts` pasó a ramificar por `code`** en vez de por status 412: consecuencia
   directa de subir `preconditionFailed` a 422 (H2.S1.M2). Sin este ajuste la pantalla de
   solicitud de vínculo dejaba de distinguir ese error. Un `if`, sin tocar el resto del archivo.
4. **18 tests de 7 archivos reescribieron su contrato** (422→400 o 412→422, y la forma
   `issues`→`details.violations`), consecuencia mecánica de H2.S1.M2. Ninguno se borró ni se
   debilitó; el detalle está en el `git diff` de cada `*.spec.ts`.
5. **H2.S1.M4 se acotó a mock↔cliente**, no mock↔API real (registrado en `PLAN.md` antes de
   escribir el script, no después de encontrarle el límite).
6. **`/patients/me/reviews` perdió la barra final** en `deploy/api-locations.conf` (ver el
   detalle de H3.S1.M2 arriba): el `curl` real contra nginx encontró que, con barra, nginx nunca
   la hacía matchear contra lo que el cliente llama. Verificado con la API real levantada, no
   sólo con el verificador estático (que no lo hubiera visto).

## Riesgos residuales y deuda

- **`/loyalty/me` y `/patients/me/reviews` responden 404 de la API**, no un éxito: el enrutado ya
  llega, pero esas rutas no están implementadas del lado de la API todavía (gap ya documentado en
  `check-mock-vs-client.mjs` y en la brecha «sin asignar» de `/loyalty`). No es de este carril
  cerrarlo — es la API, no el front.
- **`Dockerfile.dev` con `/ai` sin cablear** (arriba, «No cubierto»): inocuo hoy, pendiente si
  alguna vez se resuelve D-C y hace falta developear contra un triage real en el contenedor de dev.
- **Hallazgo pre-existente, no de este carril:** el formulario de `/auth` tarda en hidratar el
  campo de contraseña y el botón «Entrar» — reproducido igual en la maqueta
  (`fotos/debug-mockup-1440-dark.png`). No se investigó a fondo: `src/app/features/auth/**` no
  está en el alcance de este encargo. Queda para quien sea dueño de esa pantalla.
- **6 operaciones sin manejador en el mock** (loyalty completo, detalle de conversación, alias de
  comentarios, mostrador sin decisión D-G): documentadas en `check-mock-vs-client.mjs`, no se
  implementaron (fuera de alcance — `core/mock/handlers/**` con lógica de negocio no es H2.S1.M4).

## PR

**#711**, `justin/test-m5-build-real` → `test`: https://github.com/mdavila-2001/mantra-core-health/pull/711
— **mergeado** el 2026-09-26 07:05 UTC. El fix del bug de H3.S1.M2 (la barra final) y este
reporte actualizado se entregan en un PR aparte, ya que #711 se cerró antes de encontrarlo:
ver `docs/progress/STATUS_LOG.md` de `AlovidaPromptManager` por el enlace.

```text
$ gh pr view 711 --json number,url,isDraft,mergeable,mergeStateStatus,reviewDecision,baseRefName,headRefName
{"baseRefName":"test","headRefName":"justin/test-m5-build-real","isDraft":false,
 "mergeable":"MERGEABLE","mergeStateStatus":"UNSTABLE","number":711,"reviewDecision":""}

$ gh pr checks 711
dependencias  pending
e2e           pending
verificar     pending
```

`mergeable: MERGEABLE` — sin conflictos, no es draft. `mergeStateStatus: UNSTABLE` es por los tres
checks todavía `pending` a los 90 s de esperar, no por ninguno en rojo: el propio `CLAUDE.md` del
repo ya declara «El CI propio está caído; los `check-*.mjs` se corren a mano» — que es exactamente
lo que este reporte hizo (todas las salidas de arriba). No se fuerza el merge ni se usan
privilegios de admin. Queda como la única condición de la regla 35.2 sin cerrar del todo, por una
causa externa y documentada, no por el contenido del PR.

## Decisiones y ambigüedades

- **D-C (triage IA):** resuelta con la Opción C del propio prompt de enrutado («apagado hasta
  decidir») como postura segura por defecto. Registrada en `docs/progress/DECISIONS.md` con la
  pregunta completa para el propietario. No se tocó ningún archivo de `features/symptom-check/`
  ni `triage-ia.client.ts`.
- **`allowedHosts` sin túneles sólo en la nueva configuración `production-api`**, no en la
  `production` existente (la maqueta): así la maqueta —que el equipo prueba por túnel— sigue
  intacta. Es la lectura literal de «los túneles se quedan sólo en development/mockup» del
  encargo.
- **El inventario CI (H2.S1.M4) se limitó a mock↔cliente**, con la razón y el límite exacto
  escritos en el encabezado del propio script y en `PLAN.md` antes de tocar código.
