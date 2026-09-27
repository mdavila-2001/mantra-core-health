# Reporte — Carril B: Carga masiva, calidad E2E, doble revisión, gates y parseo XLSX

> **AVANCE: 82 / 98 — 83,7 %.**

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Ramas: `marcelo/feat-carga-masiva-calidad-2026-09-25`
  (front, PR [#684](https://github.com/mdavila-2001/mantra-core-health/pull/684)) ·
  `marcelo/feat-carga-masiva-xlsx-2026-09-25` (API, PR [#462](https://github.com/mdavila-2001/mantra-core-health-api/pull/462))
- Peldaño de evidencia alcanzado (regla 30): **`VERIFIED`** para el E2E contra el simulador (H2/H3/H4,
  ejercitado contra `yarn dev` real, con capturas y trace) y para H7 (`TESTED`, 59/59 pruebas dirigidas
  en verde). **`BLOCKED`**, no `VERIFIED`, para todo lo que dependía de la API real (H5.S2, H6.S1): el
  bloqueo es externo y está documentado con evidencia, no maquillado.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1 | Corte desde `origin/mockup@9fa933be` (ya incluye la pantalla de Justin), Q-9 publicada antes de la hora 1, fixtures E2E copiados y verificados | `git log`, `sha256sum` | PASS — [Q-9 en el daily](../../../AlovidaPromptManager/repartos/2026-09-25/PromptNoche/Marcelo/Marcelo-Daily-Noche-2026-09-25.md) |
| H7.S1 | Dependencia XLSX (SheetJS 0.20.3) decidida con audit y spec de humo ESM | `yarn npm audit`, spec de humo | PASS — `decision-dependencia.md` (repo API) |
| H7.S2 | 30 fixtures sintéticos deterministas (13 CSV + 15 XLSX + PDF) | `sha256sum` ×2 | PASS — idéntico en dos corridas (repo API) |
| H7.S3 | `xlsx-parser.ts` idéntico al `CsvParser` de Itzan sobre los 12 gemelos | `yarn test src/modules/terminology/import/xlsx-parser` | PASS — 18/18, luego 59/59 con el módulo completo (repo API) |
| H2 | `carga-masiva-baseline.spec.ts` y `carga-masiva.spec.ts` (11 tests) escritos y corridos contra `yarn dev` real | `yarn pw playwright/carga-masiva-baseline.spec.ts --workers=1` | PASS — `evidencia/h2/baseline.txt` |
| H3 | Corrida del contrato contra la pantalla ya integrada | `yarn pw playwright/carga-masiva.spec.ts --workers=1` | **10/11 PASS** — `evidencia/h3/simulado.txt` |
| H4 | Script de capturas + 24 PNG + doble revisión completa (regla 35.1) | `node scripts/capturas-carga-masiva.mjs` ×2 | PASS — 19/24 determinista byte a byte; `evidencia/doble-revision.md` |
| H5.S1 | Gate de seguridad y PHI, 8 amenazas con control/test/residual | lectura de código citada | PASS — `gate-seguridad-phi.md` |
| PRs | Dos PR abiertos, `MERGEABLE` los dos | `gh pr view` | PASS — #684 y #462, `evidencia/pr/` |

## A medias

### H3.S1.M5 y H4.S2.M4 — verificación visual y drag & drop reales, no automatizables

- **Qué anda:** el script de capturas produce las 24 imágenes de forma reproducible y las dos
  pasadas de revisión (verificación + adversarial) están completas sobre esas 24.
- **Qué no anda:** el arrastre real de un archivo desde el explorador del sistema operativo hasta
  la zona de carga (`app-file-input`) no se puede ejercitar por script — Playwright simula eventos
  `drag`/`drop` sintéticos que no recorren el mismo camino del navegador que un arrastre real.
- **Qué falta exactamente:** una sesión interactiva de una persona, con `yarn dev` arriba,
  arrastrando `ok-50.csv` en 1280 y 768 y observando si la zona reacciona (clase `is-dragging` o
  equivalente).
- **Dónde quedó:** documentado como pendiente explícito en `evidencia/doble-revision.md` §4.

### H6.S1 — corrida contra la API real y regresión con backend real

- **Qué anda:** el plan para correrla está completo y probado en seco (comandos, matriz de
  `curl`, cómo se aísla el checkout). El E2E, el gate de seguridad y la doble revisión están
  100 % ejercitados contra el simulador, que es el peldaño máximo alcanzable sin la API.
- **Qué no anda:** la API de Itzan (`d99ff9e7`, la única rama disponible del motor) **no arranca**:
  `UnknownDependenciesException` en `PractitionerSettlementBatchesService` dentro de
  `InsuranceModule`, un módulo ajeno a terminología. Es el mismo bloqueo que Itzan documentó en su
  propio daily (commit `b2e092f6`, "el gate no llega a compilar, y la corrección del arranque ya
  está en curso"). Por consecuencia: `yarn pw:rutas` y `yarn pw:accesos` (que exigen
  `apiViva()`) tampoco corrieron limpio contra esta rama — mismo bloqueo, no una regresión mía.
- **Qué falta exactamente:** que Itzan (o Pablo al integrar) resuelva la dependencia rota de
  `InsuranceModule` y la API arranque; entonces se corre `E2E_BACKEND=real yarn pw
  playwright/carga-masiva.spec.ts --workers=1` y los 5 `curl` de `gate-seguridad-phi.md` §2.
- **Dónde quedó:** rama `marcelo/feat-carga-masiva-xlsx-2026-09-25` intacta y funcional para
  cuando la API arranque; evidencia del intento en `evidencia/h5/api-no-arranca.txt` y
  `evidencia/h6/api-no-arranca.txt`.

### H6.S1.M4 — suite Vitest completa

- **Qué anda:** `yarn typecheck` en 0 antes y después del rebase; ninguno de los 112 fallos toca
  un archivo que este carril modificó.
- **Qué no anda:** 112/7827 pruebas unitarias fallan con `Cannot configure the test module when
  the test module has already been instantiated` — el patrón de "contagio de `TestBed`" ya
  documentado en sesiones anteriores de este repo (un hook deja el módulo de prueba instanciado y
  arrastra fallos en cascada a archivos no relacionados, en features como `user-registration`,
  `provider-form`, `communities`, ninguno tocado por este PR).
- **Qué falta exactamente:** localizar el hook o el orden de specs que deja el `TestBed`
  instanciado — es una deuda preexistente del repo, no de este carril, y su corrección excede el
  alcance declarado (regla 00 §3: no se arregla lo que aparece en el camino sin agregarlo al plan).
- **Dónde quedó:** `evidencia/h6/vitest.txt` con la salida completa.

### Test 11 del contrato (accesibilidad) — hallazgo real, no arreglado

- **Qué anda:** el test corre y mide de verdad con `axe-core` contra la pantalla real.
- **Qué no anda:** encontró un defecto real de Justin — contraste 4,27:1 en `.carga__nota`
  (`--text-muted`), WCAG 2 AA exige 4,5:1. Afecta 4 párrafos de la pantalla.
- **Qué falta exactamente:** que Justin corrija el token o la clase y se re-corra el test.
- **Dónde quedó:** reportado en `defectos.md` de este carril y en la sección 4 del daily de
  Justin — **no arreglado por mí**, como manda la regla del carril.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H5.S2 (matriz negativa por `curl`) | `DESCARTADO` con evidencia | Que la API de Itzan arranque (ver H6.S1 arriba) |
| H6.S1.M1-M2, M5 (API real, cross-browser) | `DESCARTADO` con evidencia | Ídem |
| H4.S2.M4 (drag & drop real) | `A MEDIAS` | Sesión interactiva humana |
| H4.S2.M6 (re-captura si Justin corrige) | `DESCARTADO`, no aplica todavía | Que Justin corrija el defecto de contraste primero |

## Evidencia

```text
$ yarn typecheck (front, tras rebase)
exit=0

$ yarn pw playwright/carga-masiva-baseline.spec.ts --workers=1
1 passed (5.6s)

$ yarn pw playwright/carga-masiva.spec.ts --workers=1
10 passed, 1 failed (test 11, axe: hallazgo real reportado)

$ yarn test src/modules/terminology/import/xlsx-parser (API)
Tests: 18 passed, 18 total

$ yarn test src/modules/terminology/import (API, con los 8 archivos de Itzan)
Test Suites: 5 passed, 5 total · Tests: 59 passed, 59 total

$ node scripts/capturas-carga-masiva.mjs (dos corridas)
24 capturas · 19/24 sha256 idénticas entre corridas (las 5 restantes son 'validando', variación de spinner esperable)
```

Índices completos en `evidencia/{antes,h2,h3,h4,h5,h6,h7s1,h7s2,h7s3,pr}/`.

## No cubierto

- La API real nunca respondió en este turno (bloqueo documentado arriba): todo lo que el contrato
  exige verificar `[API real]` queda sin ejercitar de punta a punta, aunque el spec ya está escrito
  y probado contra el doble.
- `yarn pw:rutas` y `yarn pw:accesos` (regresión general del front) no corrieron limpio por el
  mismo bloqueo — no se puede afirmar que el resto del front esté libre de regresiones nuevas
  fuera de lo que mis specs propios cubren.
- Contraste medido con `axe-core` sólo en la pantalla de carga masiva; no se auditó si
  `--text-muted` afecta otras pantallas del sistema (se anota como sospecha en `defectos.md`, no
  como hecho verificado).
- El arrastre real (drag & drop) queda sin ejercitar por persona.

## Desvíos del plan

1. **No hubo «rama de Justin» aparte ni worktree fusionado**: su PR #673 ya estaba mergeado en
   `origin/mockup` antes de empezar, así que H3/H4 corrieron directamente sobre mi propia rama.
2. **El «antes» de H2.S2.M13** se obtuvo con `git checkout --detach 963b7283` en vez de un
   worktree separado, porque los archivos nuevos sin trackear sobreviven al `checkout --detach`.
3. **Test 3 y test 6 del contrato tienen excepciones documentadas** para `[API real]` (XLSX no
   cableado en `PARSEADORES_DE_IMPORTACION`, `error-red` es sólo regla del doble) — declaradas
   desde el plan aprobado, no descubiertas sobre la marcha.
4. **`grande.csv` (11 MiB) se generó con Buffer.concat** en vez de concatenación de strings, tras
   un primer intento O(n²) que colgó 3 minutos — corregido antes de commitear.
5. **Tres `TEST_BUG` propios corregidos durante H2/H3**: dos locators ambiguos (texto duplicado
   entre alerta inline y toast) y una aserción que confundía la etiqueta «Error:» de `app-alert`
   con un stacktrace real. Documentados en el commit correspondiente, no ocultados.

## Riesgos residuales y deuda

- `InsuranceModule`/`PractitionerSettlementBatchesService` rotos en la única rama disponible del
  motor de carga masiva: bloquea no sólo este carril sino cualquier E2E real de terminología hasta
  que se resuelva. Es una deuda de otro módulo, señalada acá porque impidió cerrar H5.S2/H6.S1.
- Contagio de `TestBed` en la suite Vitest del front: deuda preexistente y transversal, no de este
  carril, pero sigue sin dueño declarado.
- `MAX_FILAS_XLSX` no protege contra un ZIP con `sharedStrings.xml` artificialmente inflado —
  riesgo real, documentado en `gate-seguridad-phi.md` §2, sin mitigación en este carril.

## Decisiones y ambigüedades

Todas registradas y confirmadas antes de ejecutar en el plan aprobado de la sesión (Q-M5 nombres
de rama, Q-M6 canal de la dependencia XLSX, Q-M7 escribir en Neon dev con prefijo `ZZ-E2E-`,
Q-M15 identificadores en castellano). Las que surgieron durante la ejecución:

- **Q-M16** (nueva): el contrato §7 dice que `no-es-nada.pdf` debe dar «422 legible»; la pantalla
  real lo frena antes, por `accept` del cliente, con su propio mensaje — nunca llega una petición.
  El test 4 se escribió contra el comportamiento real observado, y el 422 del detector se
  documentó como alcanzable sólo por `curl` directo.
- **Q-M17** (nueva): «11 verdes `[API real]`» del contrato no es alcanzable literal porque la
  rama de Itzan no registra `XlsxParser`; el test 3 usa `.csv` en modo real y el test 6 se
  excluye con `test.skip` y cita. Ninguna de las dos se resolvió unilateralmente: están escritas
  como excepciones explícitas y citadas en el propio spec.
