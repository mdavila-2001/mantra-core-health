# Historial de regresiones — 22/10/2026 a 05/11/2026

> Qué se rompió, cómo, cuánto duró y qué hay que cambiar para que no se repita.
> Foco: la semana del 01/11 al 05/11. Cubre `mantra-core-health` (front),
> `mantra-core-health-api` y `mantra-core-health-model`.

## Cómo se midió (y qué NO se midió)

Todo sale de `git log` sobre `origin/dev` de cada repo, ventana `--since=2026-10-22`,
consultado el 05/11/2026. Cada incidente cita el commit que lo documenta; los tiempos
salen de las fechas de commit (UTC) y son **cota inferior**: miden hasta que alguien lo
arregló, no hasta que alguien lo notó.

**No se midió:** cuántas de estas regresiones llegaron a usuarios (no hay despliegue ni
telemetría en esta fuente), ni regresiones que se arreglaron sin decirlo en el mensaje del
commit. Los conteos por mensaje (`restaura`, `pisó`, `regresión`…) subestiman el total.

## Los números

| | front | API | modelo |
|---|---:|---:|---:|
| Commits alcanzables desde `dev` | 2 300 | 1 986 | 234 |
| Merges | 740 | 644 | 93 |
| Merges con cambios propios de resolución¹ | 155 | — | — |
| Asuntos de commit repetidos² | 386 | 260 | — |

¹ `git diff-tree --cc` no vacío: archivos que el resultado del merge cambia respecto de
**ambos** padres, o sea resolución manual de conflicto. ² El mismo trabajo en 2 o más
ramas (cherry-picks entre `dev`, `test`, `mockup`, `master`): es una medida del
trasiego entre ramas largas, no todos son regresiones.

Ritmo en el front: 363 y 373 commits los días 30 y 31/10; 33 a 88 por día desde el 01/11.

## Incidentes de esta semana (01/11 a 05/11)

| # | Repo | Qué pasó | Duración | Arreglo | Causa |
|---|---|---|---|---|---|
| S1 | front | **Agenda pisada con una copia vieja.** El PR #1845 (`9886c928b`, 21 archivos, «accesibilidad, docs, refactor, skills de diseño») llegó a `dev` con versiones viejas de `agenda.ts` y `agenda.html` por el merge de `mockup` (#1854, 01/11 13:19 UTC). Se perdieron el calendario por defecto (C-07), «Mis horarios», `app-row-actions` (C-06), una consulta a la vez (C-11), el sello de reconsulta. | entre 2 d 13 h (desde #1854) y 2 d 23 h (desde #1845, 01/11 03:36 UTC) | `866f27594` (04/11): 3 archivos, +1 317 −652; `agenda.ts` quedó en 3 089 líneas contra un techo congelado de 2 294 | Merge entre ramas largas; PR de auditoría que arrastró archivos ajenos |
| S2 | front | **Maqueta desplegada sin simulador.** `a8c293736` (dev→mockup) se quedó con `mockBackend: false` de `dev` y con el cambio O3-4 que saca el simulador de `production`: el login iba a una API inexistente («No pudimos completar la operación (sin-id)»). | ≈ 13 h 40 min (05:09 → 18:49 UTC) | `3e958f5c5` y `5722c49f7` (01/11): dos causas, mismo síntoma | Merge dev→mockup en que `dev` ganó los entornos |
| S3 | front | **Textos y componentes pisados.** `9886c928b` también devolvió `loyalty.html` y `attachment-uploader.html` a una versión vieja (voseo en vez de «usted»; la cabecera de loyalty ya no se omitía al incrustarla). | hasta `565c4b463` (04/11); misma ventana que S1 | `565c4b463` | Mismo PR que S1 |
| S4 | front | **`ng test` no compilaba en `dev`**: specs huérfanos y un usuario de respaldo inventado. | no medida | `7cff66704`, `207a50790` (03/11) | Specs que sobrevivieron a un renombre |
| S5 | front | **Cinco regresiones de producto que solo se vieron al correr la suite completa**: `/my-account/access-requests` mostraba el placeholder; el glosario mostraba imágenes sin aprobación de pertinencia (el PDF sí la exigía); `practice-sites.client` convertía **cualquier** error en «sin vinculaciones»; `free-slot-notice` perdió la persistencia por sesión y la regla «un solo toast» en la fusión de renombres `50e15adb9`. | hasta 04/11 | `565c4b463`, `a660059a4` | Fusión de renombres (regla 29) y suite sin correr antes del merge |
| S6 | front | **PR de tres asuntos revertido por partes**: `16d6d40c3` saca «texto→zona» y «regla del responsable» de un PR de body-map (−363 líneas). | — | `16d6d40c3` (03/11) | Un PR por cambio no se respetó |
| S7 | API | **Un merge borró una política RLS** (y otros dos `.sql`, que no eran pérdida: ver el informe de la API). `5b6484cc` («integrate dev and regenerate canonical backend contracts», 03/11 13:38 UTC) borró `2026-11-02_v4284_rls_community_public_read.sql`, aprobado en el PR #1274. Sin ella un paciente no veía la ficha pública de un profesional de otra organización y abrir el chat respondía 412. | ≈ 33 h (03/11 13:38 → 04/11 22:36 UTC) | `76d0658cf` (04/11) | Merge con regeneración automática de contratos que no distingue «regenerar» de «borrar» |
| S8 | API | **Efectos de forzar RLS** en la misma jornada del 04/11: `a6bc30dda` (el `em.fork()` plano descartaba la transacción y leía 0 filas), `cd6800975` (el reclamo de archivos daba 422), `b244e517f` (leer sedes dentro de la transacción). | — | las tres de arriba | No es merge: son defectos que destapó activar RLS; se listan porque se arreglaron en cadena el mismo día |
| S9 | front | **`dev` no compila hoy.** `#1959` (figura del cuerpo en la reserva) se verificó (`typecheck OK`) sobre una base que aún tenía los módulos de IA; `0915125f9` («se quita toda la IA visible», 04/11 22:53 UTC) los borró; `#1959` se mergeó a las 00:22 UTC del 05/11 sin volver a probarse. `motivo-figura.ts` importa `triage-ia.client` y `symptom-check/ai-reading`, que ya no existen. | **abierto** | ninguno | **Conflicto semántico**: Git no ve conflicto porque cada cambio toca archivos distintos |
| S10 | front | **Cinco PRs conflictivos a la vez** (#1957, #1962, #1966, #1967, #1970). #1967 resultó idéntico a `dev`: todo su contenido ya estaba. Las ramas llevaban hasta 2 347 commits de atraso. | — | merges locales (ver estado en el PR) | Ramas reutilizadas después de mergeadas |

## Incidentes de la semana anterior (22/10 a 31/10)

| # | Repo | Qué pasó | Arreglo |
|---|---|---|---|
| A1 | API | **Pagos: se quitó un `FOR UPDATE`.** `dbe8eb73` («wip(ola-5): trabajo de agentes en curso, SIN VERIFICAR por el integrador») capturó la copia de trabajo en mitad de una mutación de prueba: `associate` usaba `findById` en vez de `findByIdForUpdate`. El commit está en la historia de `dev` y de 118 ramas remotas. Se restauró 24 s después. | `ea22ef3f6` (30/10). **No verifiqué si llegó a un despliegue.** Es camino de dinero: si llegó, es una carrera en el cobro |
| A2 | API | **`dev` no compilaba** tras fusionar `dev` en la rama F0+F1: identificadores duplicados y una llamada a un método renombrado. 14 errores de `tsc` en specs por el merge con `test`. | `1c20ab035`, `e5c7e1c46` (30/10). Quedaron 6 pruebas y `permission-drift-gate` (28 rutas sin `@Roles`) fuera del arreglo |
| A3 | front | `typecheck` roto por el cambio de barras horizontales de `chart-panel` | `516d60028` (30/10) |
| A4 | front | Ciclos de dependencias rotos y red confinada a `core/data-access` (O1-4, O3-4) | `a8ba44c34`, `a8a35cca7` (31/10) |
| A5 | API | `Revert` de «paciente y médico sin organización usan la plataforma» | `229ae3758` (01/11) |
| A6 | modelo | El merge de `dev` dejó un `model-manifest.yaml` que **perdía entradas** v4.2.68/v4.2.82 y el recuento de model#102 | `072f580` (01/11) |
| A7 | modelo | `apply_all.sql` dejó fuera `05_constraints.sql`: los 6 CHECK de `tenant_medical_facilities` no existían en una base creada solo desde ese runner | `24c3af5` (28/10) |
| A8 | front/API | Sincronías manuales entre ramas: `nivelar test y mockup`, `lleva dev a master — se descarta el chat de #1716`, `mockup absorbe dev (con traducción de renombres)` | decisiones tomadas a mano, sin evidencia de prueba |

## Hallazgos de la noche del 05/11 (resolviendo los PRs en conflicto)

| # | Qué se encontró | Evidencia |
|---|---|---|
| S11 | **El front de `dev` va por delante de la API de `dev`.** `8f29411a9` (04/11) ofrece «Cancelar» y «Rechazar» en órdenes de laboratorio e imagenología, pero la API de `dev` responde **422** a `CANCEL` («el ejecutor no tiene dónde registrar la anulación») y a `REJECT` en una orden sin muestra (`src/modules/diagnostics/README.md`). El PR #1977 (`canReject`, sin «Cancelar») coincide con la API; el front de `dev` no. El front que usa esas funciones depende del API #1336, que aún no está en `dev`. | README de diagnostics en `dev`; `git log -S askReason` |
| S11-res | **S11 resuelto en el PR #1977** por decisión de Pablo: se quita «Cancelar» y «Rechazar» solo aparece con `canReject === true`; el simulador responde 422 a `CANCEL` y a `REJECT` sin muestra como la API; las pruebas fijan que `cancel` no se ofrece nunca. Requiere que el API #1346 (`canReject`) entre a `dev` primero; sin él, «Rechazar» simplemente no aparece (degrada a lo seguro). | commit `1811cde04` |
| S9-res | **S9 resuelto en el PR #1986**: `motivo-figura.ts` lee solo con el motor local (sin el servicio de IA de triage que `0915125f9` retiró), con la misma regla de zonas que `symptom-check`. `tsc` pasa en 0 errores sin trucos y el build de producción que corre el hook `pre-push` completa de verdad, sin `SALTAR_BUILD`. Playwright `reserva-figura-cuerpo` pasa. | PR #1986, commit `a5f2d4acb` |
| S14 | **Nueve pruebas rojas en `symptom-check.spec.ts`** (silueta, pastillas «Ánimo y sueño», «sin IA no hay espera»…). Fallan **igual en `dev` puro** (diff de nombres vacío): no son de ningún PR abierto ni del #1986. Quedaron ocultas mientras `dev` no compilaba, porque la suite no corría. | `ng test` sobre `origin/dev` + módulos restaurados |
| S12 | **Tres pruebas rojas en `dev`**: `practitioner-profile-edit.spec.ts` › «edición aislada por pestaña» (cancela *Datos personales*, *Contacto*, *Facturación* sin restablecer otras pestañas). Fallan igual en un `dev` puro; no son de ningún PR abierto. | `ng test` sobre `origin/dev` limpio |
| S13 | **`add/add` en el mismo archivo por dos sesiones**: `laboratory-prices.rules.ts` lo crearon a la vez `dev` y #1975. Cuatro sesiones (#1974, #1975, #1977, #1972) y cuatro del API (#1342, #1343, #1345, #1346) tocan las mismas pantallas de laboratorio. | `git merge-tree`, solapamiento de archivos |

## Orden de merge propuesto (medido con el solapamiento real de archivos)

Cada paso evita rehacer la resolución de conflictos de los siguientes.

0. **Mergear primero el #1986** (arregla el build de `dev`, S9). Hasta que entre, ningún push que toque `src/` pasa el hook sin saltarlo.
1. **API, el contrato antes que el consumidor:** #1336 (base; comparte archivos con #1342, #1343, #1345 y #1346) → #1337 (revisar si sigue haciendo falta tras tomar el helper `withTenantRls` de `dev`) → #1343 → #1345 → #1342 → #1346 → #1340 (independiente). #1338 queda idéntico a `dev`: cerrarlo.
2. **Front, con su API ya en `dev`:** #1974 (⇄ API #1343) → #1975 (⇄ #1345) → #1977 (⇄ #1346) → #1972. #1975 y #1977 **se resuelven después** de que entren #1974 y #1975: comparten 7 y 2 archivos; resolverlos antes se rehace. #1971 → #1976 (comparten `register-imaging-center`).
3. **Independientes, en cualquier momento tras el paso 0:** #1957, #1962, #1966, #1970, #1978. #1967 queda idéntico a `dev`: cerrarlo.
4. **Al final, las puertas:** #1979 (front) y #1347 (API). Una vez mergeadas, todo push exige prueba real; mergearlas antes frenaría el resto.

## Estado de los merges (05/11, noche)

Mergeados a `dev` del front por Pablo (vía el asistente, con el SHA de cada PR verificado antes y
sin conflictos): **#1986** (arregla el build), **#1957, #1962, #1966, #1970, #1971, #1972, #1978**.
Tras los ocho: `tsc` en 0 errores y el build de producción completa.

| Pendiente | Por qué | Qué lo destraba |
|---|---|---|
| **Todos los PRs de la API** (#1336, #1337, #1340, #1342, #1343, #1345, #1346, #1347) | La protección de rama del API exige **1 aprobación de un revisor con permiso de escritura** (`405 At least 1 approving review is required`). No se aprueba el propio trabajo (`NO_SELF_APPROVAL`). | Una persona con permiso de escritura aprueba, en el orden de abajo |
| Front #1974, #1975, #1977 | Dependen de los PRs del API #1343, #1345 y #1346. Mergearlos antes enviaría pantallas que llaman a endpoints que no están en `dev`. | Que entre su PR del API |
| Front #1976 | Su último commit dice que «el NIT sin PDF lo resuelve el PR del API #1350». | Que entre el API #1350 |
| Front #1979 y API #1347 (la puerta) | Van al final a propósito: una vez mergeadas, todo push exige prueba real. | Que entre lo demás |
| #1967 y API #1338 | Su contenido ya está entero en `dev`: quedan sin diferencias. | Cerrarlos sin mergear |

### S15 — más pruebas rojas latentes en `dev` (no las causó ningún merge de esta noche)

Con el build arreglado la suite vuelve a correr y aparecen **15 fallos más**, además de los de S12 y S14:
`features/account/my-requests` (la mayoría), `diagnostic-orders` (2) y `doctor-profile-tabs` (1).
Se midieron **idénticos en el `dev` de justo antes de los siete merges de front y después**: ya estaban.
Estuvieron ocultos mientras `dev` no compilaba. Necesitan su propio PR.

## Qué tienen en común (causas raíz)

1. **Merges entre ramas largas** (`dev`, `test`, `mockup`, `master`). Cuatro ramas
   que se reconcilian a mano produjeron 155 merges con resolución propia solo en el
   front. S1, S2, S3, S5 (free-slot-notice), S7 y A6 son el mismo mecanismo: un lado del
   conflicto gana y el contenido del otro desaparece sin que ninguna prueba falle.
2. **La verificación se hace sobre la rama, no sobre el resultado del merge.** S9 es el
   caso limpio: el PR estaba verde contra su base y roto contra el `dev` real.
3. **Nada obliga a traer `dev` antes de mergear.** S9 y S10.
4. **El CI no está corriendo.** El PR #1966 tiene 0 check runs y `CLAUDE.md` dice «El CI
   propio está caído». El único freno es el hook `pre-push`, que corre local y solo
   construye la rama empujada.
5. **PRs que mezclan asuntos o arrastran archivos ajenos.** S1/S3 (un PR de auditoría
   tocó la agenda), S6.
6. **Ramas que se reutilizan después de mergeadas.** S10: «ya se había mergeado y después
   se le empujaron commits».
7. **Commits `wip` que llegan a `dev`** (A1) y regeneraciones automáticas que borran
   archivos (S7, A6).
8. **El techo de líneas se congela sobre la versión equivocada** (S1: el techo de
   `agenda.ts` quedó sobre la copia pisada y ahora el gate falla al restaurar).

## Qué hay que cambiar

**Ya construido en esta sesión (front y API):**
- Regla `LARGO_PLAZO_O_NADA` (orden de Pablo, 05/11): toda solución responde *¿sirve a largo
  plazo? ¿resuelve la causa o el síntoma?* antes de escribirse. Si no sirve, no se sube. Cada
  commit lleva `Largo plazo: <respuesta>`.
- Skill `pre-push-gate` + `scripts/pre-push-gate.mjs` + dos capas de control: el hook
  `PreToolUse` de Claude Code (bloquea `git push`, `gh pr create`/`gh api` y las escrituras
  remotas del MCP de GitHub; **falla cerrado** ante entrada ilegible) y `.githooks/pre-push`
  de Git (verifica el SHA realmente empujado; `SALTAR_BUILD=1` no lo apaga).
- La puerta exige, para el commit exacto y el `dev` actual: árbol limpio **sin archivos sin
  trackear** (con ellos S9 «pasaba» el build), `dev` contenido en HEAD, diff no vacío,
  `Responsable:` y `Largo plazo:` en los commits aún no subidos a `origin`, `generate-env`,
  `typecheck`, `eslint`, `build` y la prueba real (Playwright en el front; integración contra
  Postgres en la API). El spec de la prueba debe ser **nuevo o modificado en la rama**.

**Probado (scratch worktree, sin tocar ramas reales):** bloqueo por HEAD == `dev`, árbol
sucio, commits sin trailers o con relleno («sí»), `dev` ausente en HEAD, código sin `--pw`,
spec inexistente, spec con `networkidle`, prueba de otro commit; y la matriz del hook
(`bash -c "git push"`, ruta absoluta, alias, `gh api`, MCP, entrada vacía o corrupta). Sobre el
`dev` real **detecta exactamente los 5 errores de `motivo-figura.ts`** (S9) y nada más.
Con los módulos restaurados como archivos versionados, el camino completo pasa:
`generate-env`, `typecheck`, `lint`, `build` y Playwright con navegador real (5 pasos, servidor
levantado y apagado sin huérfanos). **No probado:** el camino verde de la API (`test:integration`
necesita Postgres, que no hay en este entorno), ni el `pre-push` de Git de la API.

**Límites que no se pueden cerrar desde una skill** (están también en `SKILL.md`):
`proof.json` es falsificable por quien corre el script; `--no-verify` apaga el hook de Git;
el hook de Claude Code mira el repo de la sesión (no `git -C otro`); un cambio solo de
documentación pasa sin prueba. La cerradura real es **CI obligatorio + «rama actualizada con
`dev`» en la protección de rama** (ver decisión 2).

**Decisiones que no son mías (necesitan dueño):**
1. **Arreglar S9** (`motivo-figura.ts`): quitar la IA de esa pantalla o restaurar los
   módulos. Mientras tanto ningún push a `dev` pasa el hook honestamente.
2. **Reactivar el CI** y exigir en GitHub «rama actualizada con `dev`» + check
   obligatorio. Es configuración de protección de rama.
3. **Reducir ramas largas**: `test` ya está dada de baja; decidir si `mockup` y
   `master` siguen o se vuelven despliegues de `dev`.
4. **Techo de `agenda.ts`** (S1): recalcular el baseline de `max-lines.json` sobre la
   versión restaurada o descomponer el archivo.
5. **Revisar A1 en producción**: confirmar que ningún build desplegado contuvo `dbe8eb73`.

**Reglas operativas propuestas (cada una evita un incidente de la tabla):**
- Después de mergear, la rama no se reutiliza (S10).
- Un PR, un asunto (S1/S3, S6).
- Merge de `dev` antes de abrir el PR y prueba **sobre ese resultado** (S9).
- Ningún `wip` a `dev` (A1).
- Un merge que **elimina** archivos exige revisar la lista de borrados (S7, A6).

## Qué falta verificar

- Si S1 y S2 llegaron a usuarios (la maqueta se despliega desde `docker-compose.yml`).
- Si A1 llegó a un despliegue.
- Si la agenda en `dev` estaba ya rota desde el merge de #1845 (01/11 03:36 UTC) y no
  desde #1854: el mensaje del arreglo atribuye la pérdida a #1854/#1845, no medí la
  fecha exacta de entrada del archivo viejo a `dev`.
- Regresiones sin mensaje explícito: este informe no las ve.
