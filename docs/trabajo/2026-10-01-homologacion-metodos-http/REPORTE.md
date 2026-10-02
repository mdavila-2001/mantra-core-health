# Reporte — Hito 3 (frontend): homologación de métodos HTTP

> **AVANCE: 25 / 26 — 96,2 %.** Código, pruebas, auditoría y PR (#815) listos; el gate de entrega queda A MEDIAS porque dos checks del CI fallan igual que en `dev` (ver A medias).

- Fecha: 2026-10-01 · Plan: PLAN.md · Rama: `marcelo/fix-homologacion-metodos-http`, desde `origin/dev` (`2439b79f`) · PR gemelo en `mantra-core-health-api` (PR #527, mismo nombre de rama)
- Peldaño de evidencia alcanzado: **TESTED**. No hay VERIFIED: no se ejercitó la aplicación en un navegador, ni en modo demo ni contra la API real. El cambio no toca UI, así que la prueba visual no aplica.

## Resultado

Los 7 desajustes de método entre el frontend y los controladores de la API quedan resueltos. La auditoría de rutas (`compare_mock_api.py`) pasa de `Method Mismatch: 7` a `Method Mismatch: 0`:

| # | Recurso | Qué se hizo |
|---|---|---|
| 1 | Reacciones | el simulador sólo registra `PUT /community/reactions`, y responde 200 como la API (antes 201) |
| 2 | Versiones de nota | sólo `PUT /charts/notes/:id/versions` |
| 3 | Preferencias de avisos | sólo `PUT /notifications/preferences/me` (el bloque `PATCH` duplicaba al `PUT` línea por línea) |
| 4 | Estado de pago de la cita | sólo `PUT /scheduling/bookings/:id/payment-state` |
| 5 | Configuración de protocolo | sólo `POST …/identity-providers/:id/protocol-configs` |
| 6 | Sedes del profesional | se retira `GET /practitioners/me/sites` del simulador; el cliente ya pedía `/practitioners/:profileId/sites` |
| 7 | Edición de productos de farmacia | la API gana el `PATCH` (PR #527); el front documenta y prueba el contrato |

En los seis primeros casos el cliente real (`core/data-access`) ya usaba el verbo canónico: lo que sobraba eran alias en el simulador. Se comprobó que `origin/dev`, `origin/test` y `origin/mockup` usan sólo los verbos canónicos (`evidencia/15`), así que retirarlos no rompe a ninguna rama.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 a M4 | Rama, instalación, PLAN antes del código y baselines | `git rev-parse HEAD` · `yarn install --immutable` · `yarn typecheck` · auditoría | `2439b79f…` · exit 0 · exit 0 · `Method Mismatch: 7` (`evidencia/01` a `05`) |
| H1.S2.M1 a M7 | Seis verbos legados fuera del simulador y reacciones en 200 | `yarn test --watch=false --include=<spec>` | verde (`06`); con los legados restaurados, 2 casos fallan (`07`) |
| H1.S2.M8 | `clinical.handlers.spec.ts` describe el contrato nuevo, sin aflojar aserciones (sólo se quitó la variante `POST` y se corrigió el título) | spec | verde (`06`) |
| H1.S2.M9 | Guard durable en `mock-backend.spec.ts`: por cada ruta, el canónico una vez y el legado ausente; y el estado 200 | spec | verde; rojo sin los borrados (`07`) |
| H1.S2.M10 | Comentario del `PATCH` de farmacia dice qué persiste la API | spec | verde (`06`) |
| H3.S1.M1 | Dos casos de contrato en `pharmacy.client.spec.ts`: `PATCH` con cuerpo intacto y `DELETE` | `yarn test --include=…pharmacy.client.spec.ts` | 14 pruebas, verde (`11`) |
| H3.S1.M2 | JSDoc de `updateProduct` y de `PharmacyProductChanges` dicen qué claves persiste la API | `yarn typecheck` | exit 0 (`08`) |
| H3.S1.M3 | P47 §2 cerrado para los 5 campos en `PENDIENTES-BACKEND.md`; §1 y §3-6 siguen abiertos | `git diff --stat` | 8 inserciones, 6 borrados |
| H4.S1.M1 | Specs dirigidos, incluidos reacciones, notas, sedes y preferencias | `yarn test --watch=false` con 18 `--include` | 18 archivos, 417 pruebas, exit 0 (`06`) |
| H4.S1.M2 | Typecheck, lint y compilación de los specs tocados | `yarn typecheck` · `yarn lint` · `tsc` temporal | exit 0 los tres (`08`, `09`, `10`) |
| H4.S1.M3 | Suite completa | `yarn test --watch=false` | 709 archivos y 9 514 pruebas aprobados, 0 errores no manejados (`14`) |
| H4.S1.M4 | Checks que el CI del front correría | `check-architecture`, `check-api-prefixes`, `check-route-prefixes`, `check-mock-vs-client` y `check-english-identifiers` con `CHECK_ENGLISH_BASE=origin/dev` | exit 0 los cinco; sin identificadores nuevos en castellano (`13`, `13c`) |
| H4.S1.M5 | Auditoría externa con las dos ramas del hito en disco | `python compare_mock_api.py` | `Method Mismatch: 0` (`12`) |
| H4.S2.M1 | Este reporte | — | en disco |
| H4.S2.M2 | Commit `fd75a606` con rutas explícitas y push | `git push -u origin marcelo/fix-homologacion-metodos-http` | rama en `origin`; el gancho pre-push compiló producción y pasó el presupuesto de bundle (`evidencia/16`); `origin/dev` sin cambios antes y después |
| H4.S2.M3 | PR a `dev` con los dos revisores | `gh pr create --reviewer jsaldias39,PabloArauzCaballero` | PR #815, no es draft |

## A medias

### H4.S2.M4 — Gate mergeable
- **Qué anda:** PR #815 abierto hacia `dev`, no es draft, `mergeable: MERGEABLE` y sin conflictos (merge de prueba contra `origin/dev` limpio: `dev` avanzó un commit sin solape con mis archivos); `Jsaldias39` y `PabloArauzCaballero` figuran como revisores solicitados. `dependencias` pasa. El gancho pre-push compiló la aplicación de producción.
- **Qué no anda:** `mergeStateStatus: UNSTABLE`. `verificar` falla en «Tipos» porque el CI no genera `component-index.generated.ts` antes de `tsc` (error visto en las anotaciones del CI y reproducido en local, `evidencia/18`), y `e2e` falla en «Suite crítica» con exit 9, sin causa raíz investigada. Los dos fallos son idénticos en el push a `dev` (corrida 36880592217), que no contiene este cambio (`evidencia/19`).
- **Qué falta exactamente:** agregar `yarn stock:generate` antes del paso «Tipos» de `.github/workflows/ci.yml` e investigar la «Suite crítica». No se tocó el workflow: es infraestructura compartida y queda fuera del alcance de este hito.
- **Dónde quedó:** rama `marcelo/fix-homologacion-metodos-http` en `origin`, PR #815; el estado se vuelve a consultar tras cada push.

## Pendiente

Ninguna.

## Evidencia

```text
$ python compare_mock_api.py        (baseline, rama = origin/dev)
Total mock routes extracted: 649    Matched: 571    Method Mismatch: 7    Missing in Backend: 71

$ python compare_mock_api.py        (front y API en las ramas del hito)
Total mock routes extracted: 643    Matched: 572    Method Mismatch: 0    Missing in Backend: 71

$ yarn test --watch=false (18 specs dirigidos)
Test Files  18 passed (18)      Tests  417 passed (417)

$ yarn test --watch=false (suite completa)
Test Files  709 passed (709)    Tests  9514 passed (9514)

$ [kill-test: handlers legados restaurados] yarn test --include=mock-backend.spec.ts
AssertionError: POST /community/reactions (verbo legado): expected 1 to be +0
AssertionError: expected 201 to be 200
Tests  2 failed | 36 passed (38)
```

Índice de `evidencia/`: `01` rama · `02` instalación · `03` typecheck base · `04` checker de rutas base · `05` auditoría base · `06` specs dirigidos · `07` kill-test del guard · `08` typecheck · `09` lint · `10` compilación de los specs tocados · `11` spec del cliente de farmacia · `12` auditoría final · `13` y `13c` checks del CI a mano · `14` suite completa · `15` verbos por rama · `16` push y compilación · `17` estado del PR · `18` reproducción del fallo de «Tipos» · `19` clasificación de los checks.

## No cubierto

1. **Aplicación en ejecución.** No se abrió la app en un navegador, ni con el simulador ni contra la API real, y no se corrió Playwright. «Rendericen sin excepciones» se cubre con los specs de los componentes de reacciones, notas, sedes y preferencias en vitest con jsdom, no con una captura.
2. **Modo real contra la API.** Verificado por contrato (decisión del usuario): `openapi.json` de la API, los controladores y los clientes. Con el PR #527 sin desplegar, el `PATCH` de productos sigue sin existir en una API real.
3. **Edición de productos en modo real.** La pantalla con `PATCH` sólo se monta con `mockBackend` activo (`app.routes.ts:283-286`). En modo real, la única llamada alcanzable es la importación CSV con filas «actualizar», que manda `inStock` en cada fila y recibirá 400 hasta que P47 §3-5 se cierre (antes recibía 404).
4. **CI del front.** Corrió sobre el PR: `dependencias` pasa; `verificar` falla en «Tipos» y `e2e` en «Suite crítica», los dos igual que en el push a `dev` (`evidencia/19`). Los `check-*.mjs` se corrieron además a mano.
5. **Build de producción.** Lo corrió el gancho pre-push y pasó, con el presupuesto de bundle (`evidencia/16`); no se inspeccionó el resultado en un navegador.
6. **Herramienta de auditoría.** `compare_mock_api.py` vive fuera de los repos (`C:\Users\Usuario\.gemini\…\scratch\`). El guard versionado es el spec nuevo de `mock-backend.spec.ts`.

## Desvíos del plan

- **H3 reducido.** El plan aprobado proponía proyectar `updateProduct` en modo real y fallar con un error tipado. La evidencia lo desaconsejó: `publishProduct` ya manda el borrador entero con las claves del simulador y `pharmacy.types.ts` documenta que la API real las rechaza con 400; la pantalla con `PATCH` no se monta en modo real; y proyectar obligaba a reescribir 3 specs de pantalla. Quedó en contrato documentado y probado, sin cambio de comportamiento.
- **Estado 200 de reacciones.** No estaba en el plan; CA-1 pide «200 OK» y la API publica `@HttpCode(OK)`, mientras el simulador respondía 201.
- **Identificadores en inglés.** Los primeros nombres de variables de los specs nuevos estaban en castellano (regla 29); se renombraron y se repitió la verificación completa y el kill-test.
- **Evidencia 14.** La primera versión imprimía el código de salida de `grep` y no el de `yarn`; se reemplazó por una nota exacta.

## Riesgos residuales y deuda

- `GET /practitioners/me/sites` sigue respondiendo en el simulador por el comodín `:id` del router (devuelve las sedes de un perfil `me`). Nadie lo llama; el guard compara patrones registrados, no coincidencias. La API real responde 400 por `ParseUUIDPipe`.
- El simulador no valida UUID en las rutas con `:id`: esa divergencia con la API real es anterior y queda como está.
- `PENDIENTES-BACKEND.md` marca P47 §2 como cerrado, pero lo está en código y no en producción: hasta que se despliegue el PR #527 de la API, una API real sigue sin el `PATCH`.

## Decisiones y ambigüedades

| Decisión o ambigüedad | Supuesto tomado | A quién confirmarlo |
|---|---|---|
| CA-5 («0 mismatches») | se cumple sólo con los dos PR juntos; con sólo este, la auditoría da 1 | Pablo |
| #6: ruta `me/sites` | se borra del simulador en vez de agregar un alias `GET me/sites` en la API, porque nadie la llama | Pablo y Justin |
| Reacciones en 200 | se alinea el simulador a la API | Pablo |
| H3 sin proyección | ver Desvíos del plan | Pablo |
