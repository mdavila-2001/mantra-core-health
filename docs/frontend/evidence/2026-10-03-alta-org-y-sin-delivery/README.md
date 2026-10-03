# Alta de aseguradora y pedido de farmacia sin delivery — evidencia

Fecha: 2026-10-03 · Repos: `mantra-core-health` (este) y `mantra-core-health-api` (informe y evidencia de la API en `docs/trabajo/2026-10-03-catalogo-afiliacion/`).

## Qué se corrigió y con qué PR

| # | Defecto | PR (todos MERGED el 2026-10-03) |
|---|---|---|
| 1 | El alta de organización respondía **422 «El catálogo de documentos de afiliación no está disponible»** (la API no sembraba 4 catálogos). | API: `#537` → `test`, `#538` → `dev` (`mantra-core-health-api`) |
| 2 | «Ir a iniciar sesión» de la pantalla de éxito del alta de aseguradora **no hacía nada** (`RegisterOrganization` no importaba `AppButton`). | Front: `#869` → `test`, `#874` → `dev`, `#876` → `mockup` |
| 3 | El pedido de farmacia ofrecía o simulaba **envío a domicilio** (checkout, «Confirmá tu pedido», perfil de farmacia, textos). | Front: `#870` → `test`, `#875` → `dev`, `#877` → `mockup` |

Detalle de cada PR (rama, commit de merge, quién y cuándo): [`salidas/pr-estado.txt`](./salidas/pr-estado.txt).

## Pruebas, y dónde está la salida de cada una

| Afirmación | Prueba | Salida literal |
|---|---|---|
| El botón muerto es un defecto real y el test lo atrapa | Test «el botón de la confirmación lleva al login» **sin** el arreglo (falla) y **con** él (pasa) | [`regresion-boton-SIN-arreglo.txt`](./salidas/regresion-boton-SIN-arreglo.txt) · [`regresion-boton-CON-arreglo.txt`](./salidas/regresion-boton-CON-arreglo.txt) |
| El alta termina en 201 y los casos válido / límite / error responden lo esperado en un navegador contra la API real | 10 pruebas de navegador, Chromium, un worker | [`e2e-alta-api-real.txt`](./salidas/e2e-alta-api-real.txt) |
| El recorrido del pedido no muestra delivery ni selector de modalidad (móvil 390 y escritorio 1440) | 2 pruebas de navegador sobre la maqueta | [`e2e-sin-delivery-test.txt`](./salidas/e2e-sin-delivery-test.txt) · [`e2e-sin-delivery-mockup.txt`](./salidas/e2e-sin-delivery-mockup.txt) |
| Cada rama compila y pasa tipos, lint y tests dirigidos sobre **su** base | `typecheck`, `eslint`, `yarn test` dirigido y build, por rama | [`verificacion-por-rama.txt`](./salidas/verificacion-por-rama.txt) |
| La suite completa del front está sana | `yarn test --watch=false` en el árbol integrado de `test` | [`suite-completa-front-rama-test.txt`](./salidas/suite-completa-front-rama-test.txt) |
| Lo visual se ve como corresponde | 13 capturas con doble revisión | [`doble-revision.md`](./doble-revision.md) y [`capturas/`](./capturas) |

La evidencia del **lado API** (causa raíz, kill-test en rojo, `seed-cli` ×3, matriz de 32 casos, int-specs) está en `mantra-core-health-api`, carpeta `docs/trabajo/2026-10-03-catalogo-afiliacion/` (`REPORTE.md` y `evidencia/`).

## Estado real del CI (lo que NO se puede dar por verde)

- **Front, los 6 PR:** el CI quedó **`queued` y nunca arrancó** (corre en runners de una máquina del equipo). Los 6 se mezclaron sin que ese CI corriera: la única verificación que respalda esos PR es la local de este documento. [`salidas/ci-front-sin-correr.txt`](./salidas/ci-front-sin-correr.txt).
- **API `#538` (`dev`):** el workflow `docs` terminó en **fallo** en el paso «Pruebas unitarias con cobertura»: 1 test (`src/modules/insurance/controllers/insurance-controllers.spec.ts`, «la lectura de solicitudes exige BILLING_OPERATOR o SECURITY_ADMIN») y cobertura de ramas 68,65 % contra el umbral de 69 %. **Es previo y ajeno**: el mismo test y 68,63 % fallan en la corrida `37062543405` (PR `fichas-clinicas-v2`, 2026-10-02), y las otras corridas recientes de `docs` sobre `dev` también terminaron en `failure` (de esas sólo se comparó el resultado, no el motivo). El detalle está en el informe de la API (`evidencia/ci-538-fallo-preexistente.txt`).
- API `#537` (`test`): no hay CI configurado para esa base (el workflow dispara sólo sobre `master` y `dev`).

## Hallazgos ajenos a este trabajo (sin corregir)

1. **`mockup`: el encabezado desborda en móvil.** Medido por mí sobre `origin/mockup` **limpio** y sobre mi rama, con la misma salida (transcrita de la corrida; el spec de medición era temporal y no se versiona):
   ```
   MEDIDA dónde comprar:      scrollWidth=604 · div.app-header__derecha right=604 | a.app-header__ajustes right=404 | …
   MEDIDA confirmá tu pedido: scrollWidth=604 · div.app-header__derecha right=604 | …
   MEDIDA checkout paso 1:    scrollWidth=604 · div.app-header__derecha right=604 | …
   ```
   En `test` y `dev` el mismo recorrido no desborda. Por eso, en la rama de `mockup`, la aserción de desborde del spec mide el contenido del checkout y no el documento (commit aparte). Tarea de seguimiento creada.
2. **Maqueta: los botones flotantes «Datos de prueba» y «Ver componentes» se superponen a «Confirmar pedido»** en el resumen de escritorio (ver `capturas/pedido-escritorio-3-checkout-resumen.png`).

## Transcrito de la sesión (no existen como archivo original)

- **Fallo de la primera corrida sobre `mockup`:** el recorrido «sin delivery» falló sólo en móvil con `Expected: <= 390 / Received: 604` (el desborde del encabezado de arriba); en escritorio pasó.
- **Un test de la suite completa de `test` falló por ENTORNO:** `fichas-estandar.spec.ts › son tantas como los JSON que siembra el backend` → `expected 137 to be 43`. El test lee los JSON de la API hermana, que estaba en `dev` (43 fichas) mientras el front era de `test` (137). Con `CLINICAL_FORMS_DIR` apuntando a la API de `test`: 1 archivo, **10 tests pasan**.
- **Suite completa:** 764 de 765 archivos y 10 534 de 10 535 tests (el restante es el de ENTORNO anterior).

## No cubierto

- **Servidor de `test`/`dev` desplegado:** no se verificó que el alta ya no devuelva el 422 allá. Depende del redespliegue (`api-migrate` corre `seed-cli`). Hacerlo crea una organización de prueba en un entorno compartido y requiere el visto bueno del propietario.
- **Captura «antes» del botón muerto:** se vio durante la depuración, pero no se conservó el archivo; la prueba del defecto es el test que falla sin el arreglo.
- **Revisión visual por una segunda persona o agente independiente** (la regla pide que no sea quien implementó): no la hubo.
- **Cross-browser** (sólo Chromium), **laboratorio y farmacia en navegador** contra la API real (sólo aseguradora) y los 5 viewports completos del gate visual (se usaron 390 y 1440, más móvil/oscuro en el éxito del alta).
- Las capturas del pedido son de la maqueta de `mockup`, no de `test`.
