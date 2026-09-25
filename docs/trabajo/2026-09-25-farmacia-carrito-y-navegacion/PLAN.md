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
| H2.S1.M7 | PR chico a `mockup`, mergeado, fila publicada en el daily de equipo | EN CURSO | pendiente de abrir el PR |

**Ambigüedad registrada (regla 00 §1.5, sin patrón previo):** la forma exacta del parámetro `line` de
`add(site, line, quantity)` no está en el contrato §4.3 más que como "line". Se tomó
`Omit<CartLine, 'quantity'>` porque el propio contrato separa la cantidad en un tercer parámetro con
default `1`. A confirmar con Justin si su H3 (tienda) necesita otra forma al integrar.

## H3 — Persistencia por usuario y `toDraft()` — TODO (detalle en el prompt fuente, se copia a este plan al abrir el hito)
## H4 — El ícono en la cabecera — TODO
## H5 — La pantalla del carrito — TODO
## H6 — «Lugares cercanos» desaparece, con redirección — TODO
## H7 — Borrar el hub viejo (Ola 3, condicionado a que Justin e Itzan mergeen) — TODO
## H8 — Regresión y cierre — TODO

> Nota de proceso: H3–H8 se detallan en este `PLAN.md` (copiando CA/DoD del prompt fuente) en el momento
> de abrir cada uno, no todos de antemano, para que el archivo refleje el estado real (regla 50 §4)
> y no quede una plantilla vacía haciéndose pasar por plan.

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Guardar nombres de medicamentos en `localStorage` (dato de salud) | Alto — privacidad | Clave por usuario, sin logs/capturas, borrado al confirmar (H3.S1.M4) |
| Sacar «Lugares cercanos» rompe 4 specs con listas cerradas | Medio | Se corrige la lista, nunca se debilita el test (H6.S1.M3) |
| H7 depende de que Justin e Itzan mergeen sus partes | Medio | H7 queda `TODO` con la precondición escrita hasta confirmar en el daily, nunca `BLOQUEADO` falso |
