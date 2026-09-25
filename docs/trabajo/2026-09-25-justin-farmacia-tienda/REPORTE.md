> **AVANCE: 32 / 41 — 78,0 %.**

# Reporte — La tienda: buscador por precio y distancia, y la receta completa al carrito

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `justin/farmacia-tienda-y-receta-2026-09-25`
- Corte: `4ba17b1a` = `origin/mockup` @ `bf2c3545` (PR #660) + cherry-pick de `84a587d8`
  (Ola 0 de Pablo, PR #671 abierto contra `mockup`; desaparece del diff cuando ese PR mergee).
- **Peldaño de evidencia alcanzado: `TESTED`** (regla 30 §4). Los specs dirigidos del carril
  pasan y su salida está pegada. **No se alcanzó `VERIFIED`**: nadie abrió un navegador en esta
  sesión, así que ninguna pantalla se miró funcionando. La prueba visual de este carril está
  **explícitamente no cubierta**.

## Completado

| ID | Qué se logró (observable) | Comando de verificación | Resultado |
|---|---|---|---|
| H1.S1.M1 | Corte y rama fijados | `git rev-parse HEAD` → `4ba17b1a…` | PASS |
| H1.S1.M2 | Baseline de `lint` y `typecheck` con exit code | `corepack yarn lint` · `typecheck` | PASS · `evidencia/antes/` |
| H1.S1.M3 | Los 6 rojos previos clasificados, ninguno de mi alcance | tabla en `PLAN.md` | PASS |
| H2.S1.M1–M6 | `PharmacySearchService`: dos modos, dos órdenes, funciones puras, sin origen no reordena, menos de 2 letras no consulta | `--include=…/pharmacy-search.service.spec.ts` | PASS · **22/22** · `evidencia/h2/` |
| H3.S1.M1–M5 | La home: sin pestañas, los 4 controles con sus ids congelados, los seis estados, sin perfil no consulta | `--include=…/store-front.spec.ts` | PASS · **12/12** · `evidencia/h3/` |
| H3.S2.M1–M4 | Resultados por producto: 4 partes, «Agregar» + conflicto + cancelar, receta = insignia sin botón, «Ver tienda» | `--include=…/product-results.spec.ts` | PASS · **9/9** |
| H3.S3.M1–M3 | Resultados por farmacia: tarjeta, orden respetado, `productCount === 0` filtrado en el servicio | `--include=…/store-results.spec.ts` + spec del servicio | PASS · **5/5** |
| H3.S4.M1–M2 | Últimos pedidos: tope 3, estado en palabras, vacío accionable, sin perfil no consulta | `--include=…/recent-orders.spec.ts` | PASS · **5/5** |
| H3.S5.M1–M2 | `my-account/pharmacy` → `StoreFront`; `?tab=cotizaciones` y `?tab=comprar` redirigen | `corepack yarn typecheck` + spec (2 casos) | PASS |
| H4.S1.M1–M4 | Mis recetas: agrupadas por consulta, nombres por terminología, enlace con el id, 4 estados | `--include=…/prescriptions-page.spec.ts` | PASS · **9/9** · `evidencia/h4/` |
| H5.S1.M1–M4 | `cartLinesFromDraft` pura, botón `where-to-buy-add-to-cart`, aviso de lo omitido, los 36 casos previos intactos | `--include=…/where-to-buy.spec.ts` | PASS · **46/46** (36 previos + 10 nuevos) · `evidencia/h5/` |
| H5.S2.M1 | `createOrderRequest(...).medicationRequestId === requestId` | mismo spec | PASS |
| H6.S1.M2 | PR abierto contra `mockup` y consultado con `gh` | `gh pr view --json mergeable,mergeStateStatus` | `evidencia/despues/pr.txt` |
| H6.S1.M3 | `PLAN.md` y este reporte en disco; nada corriendo | `git status` | PASS |

## A medias

### H3.S5.M3 — Publicar la fila **PUBLICADO** en el daily de equipo
- **Qué anda:** la ruta `my-account/pharmacy` ya apunta a `StoreFront` y está en el PR, que es
  lo que Pablo necesita para borrar el hub (Ola 3).
- **Qué no anda:** la fila del daily no existe.
- **Qué falta exactamente:** agregar la fila en §4-bis de `Justin-Daily-Noche-2026-09-25.md`,
  en la carpeta de repartos del repo `AlovidaPromptManager`.
- **Dónde quedó:** el aviso está en el cuerpo del PR en lugar del daily. El daily vive en otro
  repositorio, fuera del worktree de trabajo de esta sesión.

### H4.S1.M5 — Entrada hija en `app.routes.ts` + capturas 375/1440
- **Qué anda:** la entrada hija `my-account/pharmacy/prescriptions` está declarada con
  `seccionRolesGuard` y `loadComponent`, y `corepack yarn typecheck` sale en 0.
- **Qué no anda:** las dos capturas no existen.
- **Qué falta exactamente:** levantar `yarn start`, entrar como `paciente@alovida.mock`, abrir
  `/my-account/pharmacy/prescriptions` en 375 y 1440, capturar y **mirar** las dos capturas, con
  la doble revisión de la regla 35.
- **Dónde quedó:** `src/app/app.routes.ts` y
  `src/app/features/account/pharmacy/prescriptions/`; compila y sus 9 specs pasan.

### H6.S1.M1 — Regresión completa
- **Qué anda:** `corepack yarn typecheck` en 0 y `corepack yarn lint` con **los mismos 6 errores
  del baseline y ninguno nuevo**. Los 6 specs dirigidos del carril, en verde.
- **Qué no anda:** la suite entera, `yarn build` y los e2e de Playwright no se corrieron.
- **Qué falta exactamente:** `corepack yarn test --watch=false`, `corepack yarn build`, y
  `npx playwright test playwright/carril-e3-donde-comprar-receta.spec.ts
  playwright/cotizaciones-paciente.spec.ts --workers=1`.
- **Dónde quedó:** todo el código compila. La sesión tenía prohibido correr la suite completa,
  el build y cualquier navegador por límite de recursos —había otros tres agentes en paralelo—,
  y esa regresión la corre quien centraliza el cierre.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H3.S1.M6 | BLOQUEADO | Capturas 375 · 768 · 1440 claro + 1440 oscuro de la tienda con resultados. Exige navegador, prohibido en esta sesión. |
| H5.S2.M2 | BLOQUEADO | Recorrido manual receta → carrito → continuar, con captura. Exige navegador. |

## Evidencia

Índice de `evidencia/`:

- `antes/typecheck.txt` · `antes/lint.txt` — baseline con exit code.
- `h2/spec-servicio.txt` — 22/22 del servicio de búsqueda.
- `h3/pharmacy-search.service.txt` · `h3/product-results.txt` · `h3/store-results.txt` ·
  `h3/store-front.txt` · `h3/recent-orders.txt`.
- `h4/prescriptions-page.txt` — 9/9.
- `h5/where-to-buy-baseline.txt` (36/36 **antes** de tocar nada) ·
  `h5/where-to-buy-ampliado.txt` (46/46 después).
- `despues/typecheck.txt` · `despues/lint.txt` · `despues/pr.txt`.

```text
$ corepack yarn lint      # baseline, antes de tocar nada
x 6 problems (6 errors, 0 warnings)
exit=1

$ corepack yarn lint      # al cierre: los mismos 6, ninguno nuevo
x 6 problems (6 errors, 0 warnings)
exit=1
```

```text
$ corepack yarn test --watch=false --include=.../pharmacy-search.service.spec.ts
      Tests  22 passed (22)
exit=0
```

```text
$ corepack yarn test --watch=false --include=.../where-to-buy/where-to-buy.spec.ts
      Tests  46 passed (46)      # 36 previos intactos + 10 nuevos
exit=0
```

## No cubierto

1. **Toda la prueba visual.** No se abrió ningún navegador: no se miró la tienda en 375, 768 ni
   1440, ni en tema oscuro, ni la pantalla de recetas. La doble revisión crítica de la regla 35
   **no se hizo** porque no hay capturas que revisar. Nada de este carril puede declararse
   `VERIFIED` ni `REGRESSION_VERIFIED`.
2. **El recorrido real contra el simulador.** Los specs son unitarios con `HttpTestingController`:
   prueban que la pantalla compone bien las dos lecturas, no que el mock de Marcelo devuelva lo
   que se espera. Nadie ejercitó `paciente@alovida.mock` de punta a punta.
3. **La suite completa, el build y los e2e** (ver H6.S1.M1).
4. **El carrito de Pablo visto desde la tienda.** Que «Agregar» suba el badge de la cabecera se
   afirma sobre el store (`unitCount` sube), no sobre la cabecera: ese componente es de Pablo y
   no se montó.
5. **`CartStore.toDraft`** no existe todavía en el corte: el caso de `medicationRequestId` se
   probó contra `createOrderRequest(borradorDePedido(...))`, que es el trecho donde el id podría
   perderse, pero **no** contra el camino que Pablo va a construir.

## Desvíos del plan

1. **H1.S1.M1 — la Ola 0 no está mergeada.** El plan pedía salir de un `origin/mockup` posterior
   a los merges de Pablo y Marcelo. Pablo tiene su PR #671 **abierto** y Marcelo **no publicó**
   nada. Se trabajó sobre `origin/mockup` + cherry-pick de `84a587d8`. No se esperó (regla 65).
2. **Marcelo: `getPharmacy()` y `getSitePrices()` no existen.** No hicieron falta: la
   composición se hace con `searchProducts` + `availability` + `nearbySites`, que ya existen y
   se leyeron antes de componer. No se declaró ningún método que no exista.
3. **Los DoD que decían `corepack yarn build` se verificaron con `corepack yarn typecheck`**
   (mismo `tsconfig.app.json`, sin levantar el bundler), por el límite de recursos de la sesión.
   Es un peldaño `RUNS` sobre la compilación de tipos, **no** un build real: una plantilla rota
   compila limpio bajo `tsc` (punto 3 del `CLAUDE.md` del repo). Mitigado en parte porque los
   specs sí compilan las plantillas y las montan.
4. **Defecto de plantilla corregido durante H3.** El aviso «Elegí desde dónde medir» quedaba
   tapado por «Escribí qué buscás»: pedir «Más cerca» sin término no mostraba nada. Se reordenó
   la plantilla para que el aviso vaya antes; el caso quedó fijado en `store-front.spec.ts`.
5. **`sortByPrice` no ordena las tarjetas de sede.** `StoreHit` lleva `fromAmount` y no
   `unitAmount` —son dos cosas distintas—, así que hay dos acomodadores que comparten el mismo
   comparador de importes en vez de un genérico forzado. Documentado en el código.

## Riesgos residuales y deuda

1. **`ProductHit.medicationConceptId` es siempre `null`.** Ni `PharmacyProduct` ni
   `AvailabilityProduct` publican el uuid del concepto: publican `medication` ya resuelto a
   `{ code, display }`. El campo existe porque `CartLine` lo declara. Derivarlo del `code` sería
   adivinar. Del lado de la receta sí viaja cuando `LineaDePedido.conceptId` viene.
2. **En modo Farmacias, el término filtra por nombre de farmacia o sede, no por producto** — es
   lo que hace `GET /pharmacy/sites`, y es lo que el plan pide (H2.S1.M3). Buscar «paracetamol»
   en ese modo no devuelve las farmacias que lo venden, sino las que se llaman así. El «desde X»
   sí sale del producto buscado. Conviene confirmarlo con el propietario.
3. **El hub (`pharmacy-hub`) sigue existiendo** y ya no tiene ruta: es código muerto hasta que
   Pablo lo borre en la Ola 3.
4. **`estimatedTotal` del carrito devuelve `null`** si alguna línea de la receta no tiene precio.
   Una receta volcada suele tener alguna sin precio publicado, así que el carrito va a mostrar su
   total vacío más seguido de lo esperado. Es correcto —no se inventa un total—, pero la pantalla
   de Pablo tiene que decirlo bien.

## Decisiones y ambigüedades

| ID | Supuesto tomado | A quién confirmar |
|---|---|---|
| Q-J1 | Sin término, Farmacias se ordena por distancia (con origen) o por lo que devuelve la API. El «desde» sólo existe con término. | Justin (propietario) |
| Q-J2 | Sedes con `productCount === 0` no se listan. Filtradas en el servicio, con spec. | Justin |
| Q-J3 | Al carrito va **sólo lo disponible**; lo faltante se avisa por su nombre. Meter una línea sin `productId` haría fallar `createOrderRequest`. | Justin + Pablo |
| Q-J4 | «Receta vigente» = lo que devuelve el resumen con tope 50, **sin filtrar por `validTo`** — igual que `medical-record.ts`. Decidir por cuenta propia que una receta venció es una regla clínica que el modelo no declara. Lo que sí se dice es si está emitida. | Justin |
| Q-J5 | `CartStore.toDraft` no existe en el corte. Se aisló su contrato (regla 65) y el caso se probó contra `createOrderRequest(borradorDePedido(...))`. Cuando llegue, el caso de Pablo se agrega al lado; éste sigue valiendo. | Pablo |
| — | La tienda es **una tarjeta a lo ancho sin pestañas**, aunque el `CLAUDE.md` del repo diga «una tarjeta con pestañas»: acá no hay dos contenidos que alternar, hay uno con dos maneras de mirarlo, y el prompt del carril lo pide explícito. | Justin |
| — | `pharmacyStoreRoute(pharmacyId)` se usa para la ruta y `site` viaja por `queryParams`, porque `routerLink` no acepta una cadena con query. El `href` que sale es idéntico al de la constante del contrato, y hay spec que lo fija. | Pablo / Itzan |

## Qué quedó corriendo

Nada. Ningún servidor, ningún navegador, ningún proceso en segundo plano.
