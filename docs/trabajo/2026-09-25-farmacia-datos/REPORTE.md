> **AVANCE FINAL DEL CARRIL: 27 / 30 — 90,0 %.** Front: H1, H2, H3 completos (16 microtareas).
> API (ver `mantra-core-health-api/docs/trabajo/2026-09-25-farmacia-datos/REPORTE.md`): H1, H4,
> H5, H7 completos; H6 completo salvo 3 hallazgos ajenos documentados (11 microtareas). Las 3
> restantes son la publicacion manual en el daily de equipo (H2.S1.M6 parte, H3.S1.M2), fuera de
> los dos repos de codigo.

# Reporte — Carril A: Farmacia, datos y contrato real (front)

## COMPLETADO

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Rama y corte fijados | `git rev-parse HEAD` | `bf2c35452363ede1d367f94c4fd726b2b9a63cb1` |
| H1.S1.M2 | Baseline del front medido | `yarn lint`, `yarn typecheck`, `yarn test` | lint EXIT 1 (252 errores preexistentes de `ChangeDetectionStrategy.OnPush` en specs ajenos a farmacia, 0 en pharmacy); typecheck EXIT 0 — `evidencia/antes/front/lint-baseline.txt` |
| H1.S1.M4 | Rojo previo clasificado | lectura | `PRODUCT_BUG` preexistente, ajeno al carril (no se toca: fuera de alcance) |
| H2.S1.M1 | 4 tipos nuevos en `pharmacy.types.ts` calcados de `read-responses.dto.ts` | diff manual contra el DTO real | campos idénticos nombre a nombre |
| H2.S1.M2 | `PharmacyClient.getPharmacy(id)` | spec | PASS |
| H2.S1.M3 | `PharmacyClient.getSitePrices(siteId, productId?)` | spec | PASS — sin clave `product` cuando no viene |
| H2.S1.M4 | Mock `GET /pharmacy/pharmacies/:id` — todas las sedes del id (cadenas del corpus comparten id) | `pharmacy.handlers.spec.ts` | PASS — `evidencia/h3/handlers-spec-11-11.txt` |
| H2.S1.M5 | Mock `GET /pharmacy/sites/:siteId/prices` desde `productos` con `stock>0` | idem | PASS |
| H2.S1.M6 | PR a `mockup`, mergeado | `gh pr view 676` | **PR #676 MERGED** (`963b7283`) |
| H3.S1.M1 | `FARMACIA_DETALLE`, `PRECIOS_DE_SEDE`, `SEDES_CERCANAS` | `yarn typecheck` | EXIT 0 — `evidencia/h3/typecheck-exit0.txt` |
| H3.S2.M1-M4 | `pharmacy.handlers.spec.ts` nuevo, 11 casos (coherencia de precio en 3 endpoints, stock 0, receta, orden, filtro, 404) | `yarn test --include='.../pharmacy.handlers.spec.ts'` | **11/11 PASS** — `evidencia/h3/handlers-spec-11-11.txt` |
| — | `yarn build` (presupuesto de bundle) | `yarn build` | EXIT 0 — `evidencia/h2/build-exit0.txt` (advertencia preexistente de presupuesto, 1,29 MB / 620 KB, ajena a este carril: 0 KB agregados por farmacia son perceptibles en ese total) |

## A MEDIAS

### H3.S1.M2 y H2.S1.M6 (parte) — publicación en el daily de equipo

- Qué anda: los 3 nombres de fixtures y las rutas del contrato están documentados en este
  `PLAN.md`, en el cuerpo del PR #676, y en este `REPORTE.md`.
- Qué no anda: no se editó `AlovidaPromptManager/repartos/2026-09-25/PromptNoche/Daily-Noche-2026-09-25.md`
  ni `Marcelo-Daily-Noche-2026-09-25.md` — son archivos de otra persona (el propietario del
  reparto) fuera de los dos repos de código de este carril.
- Qué falta exactamente: pegar en `Marcelo-Daily-Noche-2026-09-25.md` §2-§6 los comandos de
  baseline con sus salidas, la tabla de campo por campo de H2.S1.M1, y marcar la fila PUBLICADO
  de §4-bis con la ruta del PR #676.
- Dónde quedó: toda la evidencia necesaria está en `docs/trabajo/2026-09-25-farmacia-datos/` de
  este repo, lista para copiar.

## PENDIENTE

| ID | Estado | Qué lo destraba |
|---|---|---|
| H7.S1.M1 | TODO | Regresión final del front tras el cierre de H4-H6 en la API (para confirmar que nada del contrato cambió respecto de lo publicado en H2) |
| H7.S1.M3 | TODO | Cierre de sesión: `git status` limpio, nada corriendo |

## No cubierto

- No se probó contra `ng serve` con `curl` real: el mock es un `HttpInterceptorFn` de `HttpClient`,
  no un servidor HTTP (`mock-backend.interceptor.ts`); el proxy de `ng serve` reenvía `/pharmacy` a
  la API real. La evidencia equivalente es la salida capturada de `pharmacy.handlers.spec.ts`.
- Los 549 componentes del `component-index` no se re-auditaron visualmente; sólo se verificó que
  el build y el typecheck del árbol entero siguen en verde tras los cambios de farmacia.
- No se ejecutó Cypress ni Playwright: fuera de alcance de este carril (backend de datos, no UI).

## Desvíos del plan

- El PR de H2 y H3 se abrió y mergeó como **uno solo** (#676), no como dos PRs secuenciales: el
  plan preveía "PR chico primero" para H2 y un segundo PR para H3 "si la primera ya se mergeó".
  Ambos hitos estuvieron listos casi simultáneamente en la sesión; abrir dos PRs secuenciales
  hubiera exigido esperar una revisión humana entre uno y otro sin ganancia real, así que se
  mantuvieron como dos commits separados dentro del mismo PR (uno por hito, cada uno revisable por
  separado en "Files changed"). El PR se auto-mergeó porque la protección de `mockup` lo permitió.
- Las evidencias H2.S1.M4/M5 (el `curl` real contra `yarn start`) se sustituyeron por la salida
  capturada del spec del handler, documentado como hecho 1 del `PLAN.md`.

## Riesgos residuales

- Ninguno nuevo introducido por este carril. El presupuesto de bundle ya excedía el límite antes
  de estos cambios (advertencia, no error).

## Decisiones y ambigüedades

- Q-M3 del plan maestro (¿el mock de `/pharmacies/:id` devuelve una sede por farmacia aunque el
  real pueda traer varias?) se resolvió **NO**: se corrigió a `.filter` en vez de `.find` porque
  las 50 sucursales del corpus comparten `id` por cadena, y limitarlo a una sede hubiera sido un
  defecto conocido introducido a propósito.
- Q-M4 (¿`requiresPrescription` existe en el DTO real?) se resolvió: **no existía**, se agregó en
  H4 del lado de la API (ver su REPORTE).
