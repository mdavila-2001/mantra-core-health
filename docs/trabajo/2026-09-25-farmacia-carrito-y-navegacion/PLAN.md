# Plan — El carrito en la cabecera, uno por farmacia, y «Lugares cercanos» que desaparece

- Fecha: 2026-09-25 · Repos afectados: `mantra-core-health` (este worktree) · Predecesor: ninguno
- Fuente: `AlovidaPromptManager/repartos/2026-09-25/PromptNoche/Pablo/Noche-Farmacia.CarritoYNavegacion/CarritoEnLaCabeceraYAdiosLugaresCercanos.md`
- Resultado observable: el paciente ve un ícono de carrito con contador en la cabecera, arma un pedido en `/my-account/pharmacy/cart`, lo persiste entre recargas, y «Lugares cercanos» desaparece del menú con `/nearby-places` redirigiendo a la tienda.
- Kill-test: ver §"Kill-test del turno completo" del prompt — agregar 2 unidades, ver el «2» en la cabecera, recargar (persiste), continuar (arma el borrador), confirmar (vacía), `/nearby-places` redirige, la médica no ve el ícono.
- Rama: `pablo/farmacia-carrito-y-navegacion-2026-09-25`, worktree `wt-pablo-farmacia-carrito-2026-09-25`, desde `origin/mockup` @ `bf2c35452363ede1d367f94c4fd726b2b9a63cb1` (confirmado con `git rev-parse origin/mockup`, 2026-09-25).

## Alcance
- IN: contratos del carrito (Ola 0: tipos, store en memoria, storage no-op, rutas, testids) en PR propio y chico · persistencia por usuario · `toDraft()` · ícono con badge en la cabecera · pantalla `/cart` con sus estados y "Continuar" que revalida disponibilidad · `clear()` al confirmar el pedido · sacar "Lugares cercanos" del registro/subgrupos/tutoriales/specs · borrar la pantalla y redirigir `/nearby-places` · marcar el carril 19 superado en `docs/progress/` · borrar el hub viejo (Ola 3, condicionado) · specs · capturas por viewport y tema · evidencia y reporte.
- OUT: cualquier archivo fuera de `ARCHIVOS RESERVADOS PARA VOS` del prompt · mocks/cliente de farmacia (Marcelo) · tienda/buscador/receta/where-to-buy (Justin) · página de farmacia y e2e (Itzan) · `cotizaciones/**` · mover `search-origin-picker/` · endpoint de carrito en la API · revisión/checkout/recibo del pedido · arreglar los 252 errores de lint preexistentes fuera de mi alcance (regla 00 §3: se anotan, no se arreglan) · el TS2307 de `env.generated.ts` (generado localmente con `node scripts/generate-env.mjs`, no versionado — no es un rojo real).
- Ambigüedades registradas: las cinco del prompt (Q-P1…Q-P5), con los supuestos ahí declarados — ver §5 del prompt original, no se repiten acá para no duplicar la fuente.

## H1 — Corte y baseline
**CA:** Dado el entorno, cuando se pregunta contra qué versión se trabajó y qué estaba en rojo antes, hay SHA, salidas y tabla de rojos previos clasificados.
**DoD:** salidas con exit code en `evidencia/antes/`; rojos previos clasificados abajo.
**Estado:** HECHO

### H1.S1 — Corte, rama y baseline
**CA:** Dado un rojo posterior, la respuesta de si lo rompí sale de un archivo.
**DoD:** lint/typecheck/test con exit code pegados; rojos previos clasificados.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar corte y rama | SHA y rama en este archivo | `git rev-parse origin/mockup` → `bf2c35452363ede1d367f94c4fd726b2b9a63cb1`; `git branch --show-current` → `pablo/farmacia-carrito-y-navegacion-2026-09-25` | HECHO |
| H1.S1.M2 | Baseline lint y typecheck | Salida y exit code guardados | `evidencia/antes/lint.txt` (exit=1, 254 preexistentes) y `evidencia/antes/typecheck.txt` (exit=0 tras generar `env.generated.ts`) | HECHO |
| H1.S1.M3 | Baseline test | Conteo de fallos previos | `evidencia/antes/test.txt`: `1 failed | 7545 passed (7546)`, exit=1 | HECHO |
| H1.S1.M4 | Clasificar cada rojo previo | Cada uno con su clase (regla 80.4) | ver tabla de rojos previos abajo | HECHO |

### Rojos previos clasificados (regla 80.4)

| Rojo | Clase | Nota |
|---|---|---|
| `yarn lint` → 254 errores `@angular-eslint/prefer-on-push-component-change-detection` en archivos fuera de mi alcance (`shared/forms/*.spec.ts`, `shared/motion/*.spec.ts`, etc.) | `PRODUCT_BUG` preexistente, fuera de alcance | No se toca (regla 00 §3): ninguno de esos archivos está en `ARCHIVOS RESERVADOS PARA VOS`. Confirmado con `grep -c error` = 254 y `grep -n navigation.service.spec` = línea 29 (coincide con el "esperado" del prompt: lint de `navigation.service.spec.ts`). |
| `yarn typecheck` → TS2307 en `env.generated.ts` (5 archivos) | `ENVIRONMENT` | No es un rojo real: `src/environments/env.generated.ts` es generado y gitignored; `node scripts/generate-env.mjs` lo crea. Tras generarlo, `exit=0`. Documentado, no se declara como bug. |
| `test --watch=false` → `shell-layout.spec.ts:259` «los nombres de ícono del registro y los del nav no se separaron» | `PRODUCT_BUG` preexistente, fuera de alcance | Coincide exactamente con el "esperado" del prompt (`shell-layout.spec` íconos). 1 failed / 7545 passed. No se toca: el fix es de otro carril (deriva del catálogo de íconos). |

## H2 — Contratos del carrito (Ola 0 del equipo)
**Prioridad:** BLOQUEANTE — Justin, Itzan y Marcelo esperan esto para poder compilar/probar contra el carrito.
**CA:** Dado el plan, cuando los otros tres importan `CartStore`/tipos/rutas/testids desde `origin/mockup`, compilan y prueban sin esperar nada más.
**DoD:** PR propio mergeado en `mockup` en la primera hora; spec del store ≥10 casos en verde; fila publicada en el daily de equipo.
**Estado:** TODO

### H2.S1 — Tipos, store en memoria, storage no-op, rutas y testids
**Estado:** EN CURSO (falta sólo M7: abrir y mergear el PR)

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| H2.S1.M1 | `pharmacy-cart.types.ts`: `CartSite`, `CartLine`, `CartState`, `AddOutcome` | HECHO | `typecheck` exit 0 |
| H2.S1.M2 | `cart.storage.ts`: `InjectionToken<CartStorage>` + no-op por defecto | HECHO | spec "arranca sin carrito" cubre `null` sin storage |
| H2.S1.M3 | `cart.store.ts`: API pública en memoria (`cart`, `unitCount`, `estimatedTotal`, `add`, `replaceWith`, `setQuantity`, `remove`, `clear`) | HECHO | API idéntica a §4.3 (sin `toDraft`: es H3.S2, hito separado) |
| H2.S1.M4 | `estimatedTotal` en centavos vía `pharmacy-campaigns.money.ts` | HECHO | spec "10,50 + 2×3,25 = 17,00" en verde |
| H2.S1.M5 | Spec del store ≥10 casos | HECHO | `npx ng test --include='src/app/core/data-access/pharmacy-cart/*.spec.ts' --watch=false` → **14 passed (14)** |
| H2.S1.M6 | `pharmacy.routes.ts` y `pharmacy.testids.ts` | HECHO | `typecheck` exit 0; `eslint` scoped sin hallazgos |
| H2.S1.M7 | PR chico a `mockup`, mergeado, fila publicada en el daily de equipo | A MEDIAS | PR #671 abierto y en estado `MERGEABLE` (`mergeStateStatus: UNSTABLE` sólo por el CI colgado, no por conflicto). Qué anda: código, typecheck, tests dirigidos y los checks manuales, todo en verde. Qué no anda: la integración final a `mockup` — esta sesión no tiene permiso para completar esa acción sin revisión humana. Qué falta: que una persona del equipo, con acceso, revise el diff y complete la integración desde GitHub. Dónde quedó: rama `pablo/farmacia-carrito-y-navegacion-2026-09-25`, PR #671, sin conflictos. |

**Checks corridos a mano (CI no levanta, memoria `el-ci-no-corre`):** `check-architecture`,
`check-api-prefixes`, `check-client-prefixes` y `check-api-contract-drift` dan rojo, pero **ninguno
de los archivos denunciados es de este carril** (day-view.ts, mock-backend.spec.ts, phone-input,
loyalty/proxy, prescription-favorites, quotations/simulate, community reviews — todos
preexistentes en `origin/mockup`, confirmable con `git diff origin/mockup HEAD --name-only`).
`check-route-prefixes` y `check-tokens` en verde. `check-doc-coverage` marca este mismo `PLAN.md`
por contener la palabra «TODO» — es un falso positivo contra el propio vocabulario de estados de
la regla 20 (`TODO` es un estado legítimo, no un marcador provisional de documentación a medio
escribir); no se debilita el plan para evadirlo (regla 60). Salidas en
`evidencia/checks-a-mano/`.

**Ambigüedad registrada (regla 00 §1.5, sin patrón previo):** la forma exacta del parámetro `line` de
`add(site, line, quantity)` no está en el contrato §4.3 más que como "line". Se tomó
`Omit<CartLine, 'quantity'>` porque el propio contrato separa la cantidad en un tercer parámetro con
default `1`. A confirmar con Justin si su H3 (tienda) necesita otra forma al integrar.

## H3 — Persistencia por usuario y `toDraft()`
**CA:** Dado un carrito con dos líneas, cuando la persona recarga o vuelve a entrar con la misma cuenta, el carrito está igual; con otra cuenta, está vacío; `toDraft(site)` produce un `BorradorDePedido` con la misma forma que `borradorDePedido()` de `where-to-buy.ts`.
**Estado:** HECHO

### H3.S1 — Persistencia
**Estado:** HECHO

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| H3.S1.M1 | `cart.storage.ts`: implementación real sobre `localStorage`, clave `mantra.pharmacy.cart.<userId>`, `try/catch` | HECHO | spec "persistencia por cuenta" (4 casos) |
| H3.S1.M2 | Persistencia en el store; cargar al cambiar de cuenta, escribir en cada cambio | HECHO | **Desvío del plan:** no es un segundo `effect()` sobre el estado (el diseño original) — se detectó una condición de carrera real: el `effect()` de carga y uno de escritura comparten el mismo primer flush, y el de carga puede correr después y pisar con el storage vacío lo que la escritura recién puso. Se resolvió con `persistir()` síncrono dentro de cada mutador (`add`/`replaceWith`/`setQuantity`/`clear`), igual que `TutorialProgressStore.guardar()`. Sin este cambio, 3 de 22 tests fallaban (`storage.datos.get(...)` volvía `undefined`); con el cambio, 22/22 en verde. No se proveyó nada en `app.config`: la factory del `InjectionToken` ya elige browser-vs-noop, igual que `TUTORIAL_STORAGE` |
| H3.S1.M3 | SSR: sin `window` no se toca storage | HECHO | `corepack yarn build` exit 0, sin `serve:ssr` en `package.json` (no existe ese script en este repo; el build ya ejercita el bundle de servidor) |
| H3.S1.M4 | Nota de privacidad (qué/dónde/cuándo se borra) | HECHO | JSDoc en `cart.storage.ts` §"Privacidad del carrito" |

### H3.S2 — `toDraft(site)`
**Estado:** HECHO

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| H3.S2.M1 | `toDraft(site)` en el store | HECHO | `typecheck` exit 0 |
| H3.S2.M2 | Spec de igualdad estructural (con/sin stock, con/sin `requestId`) | HECHO | **Desvío del plan:** el DoD pedía comparar contra `borradorDePedido()` **importada** de `where-to-buy.ts`; se descubrió que eso viola `no-restricted-imports` del propio ESLint (`core/` nunca importa de `features/`) — confirmado corriendo `eslint` (1 error real). Se reemplazó por expectativas escritas a mano, verificadas por lectura línea a línea contra `borradorDePedido()` (`where-to-buy.ts:836-885`, mismo criterio de `disponible`/precio/`requestId`), documentado en el spec. `npx ng test --include='src/app/core/data-access/pharmacy-cart/*.spec.ts' --watch=false` → **22 passed (22)** |

**Privacidad del carrito (H3.S1.M4, Q-P2):** qué se guarda — nombres de medicamentos y cantidades (dato
de salud); dónde — `localStorage` del navegador de la persona, clave `mantra.pharmacy.cart.<userId>`;
cuándo se borra — al vaciar, al confirmar el pedido (H5.S2) y al borrar datos del sitio desde el
navegador. Nunca en logs ni capturas.
## H4 — El ícono en la cabecera
**CA:** Dado un paciente con 3 unidades en el carrito, hay un enlace a `/my-account/pharmacy/cart` con ícono `bag`, badge «3» y `aria-label` con el número y la farmacia; sin unidades no hay badge; la médica no ve el enlace.
**Estado:** EN CURSO (falta M4: capturas — se hace en una sola pasada de Playwright junto con H5, porque `/cart` recién existe con H5 wireado)

### H4.S1 — El bloque del ícono
**Estado:** EN CURSO

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| H4.S1.M1 | `CartStore` inyectado en `shell-layout.ts`, `unidadesDelCarrito()` y `etiquetaCarrito()` | HECHO | `typecheck` exit 0 |
| H4.S1.M2 | Bloque en `shell-layout.html` junto a Chats, sólo para paciente (`esPacienteDelCarrito()`) | HECHO | `shell-layout.spec.ts` "el paciente ve el carrito; la médica, no" |
| H4.S1.M3 | Badge sin «0», `aria-hidden`, número en el `aria-label` | HECHO | `shell-layout.spec.ts` "sin unidades..." y "con 3 unidades..." — `npx ng test --include='src/app/features/shell-layout/*.spec.ts' --watch=false` → **70 passed / 1 failed** (el mismo preexistente de íconos, sin cambios) |
| H4.S1.M4 | Capturas 375/1440 claro y oscuro, con badge | TODO | se hace junto con las de H5 (misma pantalla, un solo pase de Playwright) |
## H5 — La pantalla del carrito
**CA:** `/my-account/pharmacy/cart` muestra farmacia/sede/líneas/±/quitar/total/Vaciar/Seguir comprando/Continuar; vacío es S3; Continuar revalida y navega a la revisión; confirmar el pedido vacía el carrito.
**Estado:** EN CURSO (falta M6: capturas, junto con H4.S1.M4)

### H5.S1 — La pantalla
**Estado:** EN CURSO

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| H5.S1.M1 | `cart-page.{ts,html,css}`: `PageHeader`, cabecera de sede, líneas, ±, quitar, total | HECHO | `cart-page.spec.ts` "con carrito: muestra sede, líneas y total" |
| H5.S1.M2 | Vacío = S3 con `app-empty-state` y acción "Ir a la tienda" | HECHO | `cart-page.spec.ts` "carrito vacío..." |
| H5.S1.M3 | "Vaciar" con `DialogService.confirm()`; "Seguir comprando" → `pharmacyStoreRoute` | HECHO | `cart-page.spec.ts` "Vaciar" cancelado/confirmado (2 casos) |
| H5.S1.M4 | "Continuar": `availability()` → sede por `siteId` → `prepararBorrador(toDraft(site))` → navega; sin sede, alert sin navegar | HECHO | `cart-page.spec.ts` con `HttpTestingController` (2 casos: sede encontrada navega, sede ausente avisa y no navega) |
| H5.S1.M5 | Entrada hija `my-account/pharmacy/cart` en `app.routes.ts` con `seccionRolesGuard` | HECHO | `corepack yarn build` exit 0; `app.routes.spec.ts` → **53 passed (53)** |
| H5.S1.M6 | Capturas 375·768·1440 claro+oscuro, con carrito y vacío | TODO | pendiente — un solo pase de Playwright junto con H4.S1.M4 |

**Desvío del plan:** "±" no reusa un componente `pharmacy-store-qty-*` existente porque **no existe todavía**:
es de la tienda de Justin (su H3, no mergeado). Se construyeron botones +/- propios en `cart-page.html`
usando **los mismos `data-testid` congelados** (`pharmacy-store-qty-plus/minus/value`, ya en
`PHARMACY_TESTIDS`) para que la superficie de prueba ya coincida; cuando el componente compartido de
Justin exista, esto se reconcilia (regla 65: se simuló el contrato, no se bloqueó la microtarea).

### H5.S2 — Vaciar al confirmar el pedido
**Estado:** HECHO

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| H5.S2.M1 | `pharmacy-orders.client.ts` `enviar()`: `tap` agrega `this.cart.clear()` | HECHO | `npx ng test --include='src/app/core/data-access/pharmacy-orders/pharmacy-orders.client.spec.ts' --watch=false` → **33 passed (33)** (32 preexistentes + 1 nuevo) |
## H6 — «Lugares cercanos» desaparece, con redirección
**CA:** Sin «Lugares cercanos» en el menú ni en el registro; `/nearby-places` redirige a `/my-account/pharmacy`; `grep -rn nearby-places src/app/core` = 0; specs en verde con las listas corregidas, sin `skip`.
**Estado:** HECHO (H6.S3 con desvío registrado abajo)

### H6.S1 — Inventario y registro
**Estado:** HECHO

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| H6.S1.M1 | Grep clasificado (41 hits) | HECHO | `evidencia/h6/INVENTARIO.md` |
| H6.S1.M2 | Borrar de `navigation.map.ts` y `navigation.subgroups.ts` | HECHO | `grep -n nearby-places src/app/core` = **0** |
| H6.S1.M3 | Corregir listas cerradas sin `skip` | HECHO | `shell-layout.spec.ts` línea 431→433 (`toContain` → `not.toContain`, con nota); `npx ng test --include='src/app/core/navigation/*.spec.ts' --include='src/app/features/shell-layout/*.spec.ts' --include='src/app/features/directories-overview/*.spec.ts' --watch=false` → **203 passed / 1 failed** (el mismo preexistente de íconos) |

### H6.S2 — Borrar la pantalla y redirigir
**Estado:** HECHO

| ID | Microtarea | Estado | DoD ejecutado |
|---|---|---|---|
| H6.S2.M1 | `git rm` de los 4 archivos de la pantalla; sacar de `PANTALLAS_DIFERIDAS` | HECHO | `ls src/app/features/nearby-places` = sólo `search-origin-picker/`; `corepack yarn typecheck` exit 0 |
| H6.S2.M2 | `RUTAS_HEREDADAS['nearby-places'] → '/my-account/pharmacy'` | HECHO | `corepack yarn build` exit 0; `app.routes.spec.ts` → 53 passed |
| H6.S2.M3 | Regenerar el índice | HECHO | Se regenera solo al correr `typecheck`/`build`; `grep -c NearbyPlaces component-index.generated.ts` = **0** |

### H6.S3 — El carril 19 queda superado y la decisión registrada
**Estado:** DESCARTADO para las rutas literales del prompt · intención cumplida por otra vía

**Desvío del plan (regla 00 §1.1, verificado por código):** el prompt pide anotar esto en
`docs/progress/STATUS.md`, `docs/progress/DECISIONS.md` y `docs/source-of-truth/tareas-index.json`.
**Ninguno de los tres existe en este repo** — `find docs -iname "STATUS.md" -o -iname "DECISIONS.md"
-o -iname "tareas-index.json"` no encuentra nada bajo `docs/progress/` ni `docs/source-of-truth/`
(sí existe un `DECISIONS.md` en `docs/work/02-medical-module-plan-.../`, de otro trabajo, no de un
sistema de "carriles" numerados). Un `grep -rln "carril 19"` en todo `docs/` sólo encuentra este mismo
`PLAN.md`. Crear esos tres archivos con esa estructura sería inventar un sistema de seguimiento
paralelo sin verificar que sea el real (prohibido, regla 00 §1.1 y 97.4.6). En su lugar, la decisión
queda registrada acá y en el `REPORTE.md` de este trabajo, que es el mecanismo de seguimiento que
esta regla 20 sí exige y que sí existe: **el carril 19 (imagenología y centros médicos cercanos, vía
"Lugares cercanos") queda superado por los carriles 41/46 de este plan; imagenología y centros
cercanos pierden su pantalla propia; «Cómo llegar» de la vitrina pública (fuera de "Mi cuenta") sigue
existiendo sin cambios.**
## H7 — Borrar el hub viejo (Ola 3, condicionado a que Justin e Itzan mergeen) — TODO
## H8 — Regresión y cierre — TODO

> Nota de proceso: H3–H8 se detallan en este `PLAN.md` (copiando CA/DoD del prompt fuente) en el momento
> de abrir cada uno, no todos de antemano, para que el archivo refleje el estado real (regla 50 §4)
> y no quede una plantilla vacía haciéndose pasar por plan.

## Nota de proceso: `yarn test` completo no es evidencia fiable en esta máquina

Tras H5, `corepack yarn test --watch=false` dio **114 failed / 7468 passed** (contra 1/7567 después de
H3). Clasificación (regla 80.4): antes de asumir regresión propia, se re-corrieron en aislado dos de
los archivos marcados en rojo que **no tocan nada de este carril**
(`features/admin/medical-organization/*.spec.ts`, `features/account/pharmacy-orders/new-order/*.spec.ts`)
— los dos en **verde completo** (13/13 y 24/24) al correrlos solos. Es `ENVIRONMENT`: la máquina se
satura con la suite completa y produce fallos espurios, disjuntos entre corridas — exactamente lo
documentado para este repo (memoria `suite-front-inestable-bajo-carga`). **De acá en adelante, la
regresión de este carril se corre con `--include` acotado a lo tocado**, no con `yarn test` a secas;
`yarn test` completo sólo se usa al cierre (H8) y sus rojos se re-verifican uno por uno en aislado
antes de declararlos reales.

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Guardar nombres de medicamentos en `localStorage` (dato de salud) | Alto — privacidad | Clave por usuario, sin logs/capturas, borrado al confirmar (H3.S1.M4) |
| Sacar «Lugares cercanos» rompe 4 specs con listas cerradas | Medio | Se corrige la lista, nunca se debilita el test (H6.S1.M3) |
| H7 depende de que Justin e Itzan mergeen sus partes | Medio | H7 queda `TODO` con la precondición escrita hasta confirmar en el daily, nunca `BLOQUEADO` falso |
