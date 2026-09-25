# Reporte — Calidad de la carga masiva: E2E, doble revisión, gates y XLSX (Carril Marcelo B)

> **AVANCE: 46 / 98 — 46,9 %.** (H1: 15/15 · H2: 19/19 · H3: 6/6 · H4/H5/H6: 0/36 · H7: 6/22 — el resto es la mitad API, ver su propio reporte)

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Ficha completa: [FICHA-ORIGINAL.md](./FICHA-ORIGINAL.md) · Rama: `marcelo/carga-masiva-calidad-2026-09-25` (worktree `wt-marcelo-cargamasiva-front`, sin push — bloqueado por el clasificador de auto-modo de la sesión)
- Peldaño de evidencia alcanzado: **VERIFIED** para H2/H3 (comportamiento real ejercitado contra `ng serve` + la rama real de Justin, no sólo compilado) — **no** `REGRESSION_VERIFIED`: falta la regresión conjunta (`pw:rutas`, `pw:accesos`, suite Vitest) y el PR mergeable de H6.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S2 (Q-9) | Designaciones: DTO/entidad/endpoint/repositorio existen; **sin índice único ni búsqueda por clave natural** — la idempotencia hay que construirla en el servicio nuevo | lectura de 5 archivos reales, con línea | `Q-9.md` |
| H1.S3 | 6 fixtures E2E (`ok-50`, `con-errores`, `vacio-solo-encabezado`, `no-es-nada.pdf`, `error-red`, `grande` de 11 MiB no commiteado) | — | `playwright/fixtures/carga-masiva/` |
| H2.S1 | `carga-masiva-baseline.spec.ts` contra la pantalla de hoy | `yarn pw playwright/carga-masiva-baseline.spec.ts --workers=1` | 1/1 PASS, `evidencia/h2/baseline.txt` |
| H2.S2 | `carga-masiva.spec.ts`, 11 tests contra el contrato §3/§7 | corrido contra la pantalla de hoy (antes) y contra `justin/carga-masiva-pantalla-2026-09-25` (real) | **antes**: falla en `carga-sistema` (testid no existe, evidencia en `contrato-antes.txt`). **contra la rama de Justin**: **10/10 PASS + 1 SKIP** (axe, `DESCARTADO` — no está `@axe-core/playwright` en `package.json`) |
| H3 | Corrida completa contra `justin/carga-masiva-pantalla-2026-09-25` en un worktree separado (`wt-justin-cargamasiva-lectura`, ya eliminado tras extraer la evidencia) | `E2E_BACKEND=simulado yarn pw playwright/carga-masiva.spec.ts --workers=1` | 10/11 PASS, 1 SKIP, `evidencia/h3/simulado.txt` (corrida inicial, 4 fallos de mi spec) y `evidencia/h3/simulado-2.txt` (corregido, verde) |
| H3.S1.M4 | 2 defectos de MI spec corregidos sin debilitar el requisito (locator de texto ambiguo; asunción incorrecta de que un PDF llega al servidor) | re-corrida | `defectos.md` — cero hallazgos reales en la pantalla de Justin |
| H7 (parcial, ver reporte API) | `xlsx-parser.ts` — decisión de NO agregar dependencia (root cause: `exceljs` incompatible con el contrato síncrono; `xlsx` de npm con 2 CVE `high` sin parche) | — | ver `decision-dependencia.md` del repo API |

## A medias
### H2.S2.M11 — Accesibilidad con axe
- Qué anda: el test está escrito y se auto-`DESCARTA` correctamente cuando la dependencia no está.
- Qué no anda: no hay verificación automática de accesibilidad de esta pantalla.
- Qué falta exactamente: decidir si se agrega `@axe-core/playwright` (decisión de Pablo, Q-M2 — la ficha prohíbe agregarla unilateralmente).
- Dónde quedó: `carga-masiva.spec.ts`, test 11, se saltea con el motivo explícito.

### H4 — Capturas y doble revisión adversarial
- Qué anda: nada implementado.
- Qué no anda: no hay `scripts/capturas-carga-masiva.mjs` ni `evidencia/doble-revision.md`.
- Qué falta exactamente: las 10 microtareas de H4.S1 (script de 24 capturas) y H4.S2 (dos pasadas).
- Dónde quedó: no se llegó por límite de turno; se priorizó H1→H2→H3→H7 según el orden de la propia ficha.

### H5 — Gate de seguridad y PHI
- Qué anda: nada implementado.
- Qué no anda: falta la tabla de amenazas/controles y la matriz negativa contra la API real.
- Qué falta exactamente: las 12 microtareas de H5.S1 y H5.S2.
- Dónde quedó: no se llegó.

### H6 — API real, regresión, PR y cierre
- Qué anda: nada implementado.
- Qué no anda: no se corrió contra la API real (Itzan), no hay regresión conjunta, no hay PR.
- Qué falta exactamente: las 14 microtareas de H6.S1 y H6.S2.
- Dónde quedó: no se llegó; además el PR (H6.S2.M3-M4) está bloqueado por la misma restricción de `push` que el resto del turno.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H2.S2.M11 (axe) | TODO/DESCARTADO condicional | Decisión de Pablo sobre agregar `@axe-core/playwright` |
| H4 completo | TODO | Nada externo — es la continuación natural de este turno |
| H5 completo | TODO | Nada externo, salvo la parte de H5.S2 (API real de Itzan arriba) |
| H6 completo | BLOQUEADO parcialmente | El PR necesita el `push`, bloqueado por el harness de esta sesión |
| Publicaciones en el daily (H1.S2.M7, H2.S2.M14, H4.S1.M4) | A MEDIAS | Mismo bloqueo de `push` — documentado en cada uno |

## Evidencia
```text
$ yarn pw playwright/carga-masiva-baseline.spec.ts --workers=1   (contra hoy)
1 passed (2.8s)

$ yarn pw playwright/carga-masiva.spec.ts --workers=1   (contra justin/carga-masiva-pantalla-2026-09-25, E2E_BACKEND=simulado)
10 passed, 1 skipped (26.0s)
```
Completo en `evidencia/h2/` y `evidencia/h3/`.

## No cubierto
- Cross-browser (firefox/webkit) de `carga-masiva.spec.ts`: no corrido.
- La regresión de `pw:rutas`/`pw:accesos`/`yarn test` (Vitest) tras estos cambios: no corrida en este turno.
- El E2E contra la API real (Itzan): no se levantó el stack Docker (instrucción explícita de la raíz: no levantarlo sin permiso).
- Los gemelos `.xlsx` de las fixtures (H1.S3): no generados, sin dependencia XLSX.

## Desvíos del plan
- El orden de la ficha (H1→H7.S1→H7.S2→H2→H7.S3→H3→H4→H5→H6) se siguió, salvo que H7.S3
  (parseador XLSX) no se ejecutó porque H7.S1 concluyó en "ninguna dependencia se agrega" — no hay
  nada que implementar hasta que se resuelva la pregunta para Pablo.
- H3 se corrió en un worktree de lectura separado (`wt-justin-cargamasiva-lectura`) que se **eliminó
  después de extraer la evidencia**, por presión de espacio en disco (ver más abajo) — no es una
  desviación de alcance, es una decisión de infraestructura.

## Riesgos residuales
- **Disco de la máquina al 97% en un punto de este turno** (quedaban 667 MB libres de 228 GB, con
  ~29 GB repartidos en `node_modules` de decenas de worktrees `wt-*` de sesiones previas). Se liberó
  espacio borrando `node_modules` de mis propios worktrees ya cerrados (Farmacia, Carril A) tras
  confirmarlo con el usuario. **No se tocó ningún worktree ajeno**: es un problema de higiene de la
  máquina que excede el alcance de este carril y vale la pena que alguien lo revise en general.
- Sin PR abierto: nadie fuera de este checkout puede ver el trabajo todavía (bloqueado por `push`).
- El bug preexistente de `InsuranceModule` (ver reporte de la mitad API) sigue bloqueando
  `docs:openapi:generate`/`postman:generate` para cualquier carril de la noche, no sólo este.

## Decisiones y ambigüedades
- **Q-M3 (si Justin no publica)** — no aplicó: Justin **sí publicó**
  (`justin/carga-masiva-pantalla-2026-09-25`, PR #673, verificado con `git ls-remote`), así que H3
  se corrió contra su rama real, no contra un doble.
- **Hallazgo de método (test 4)** — un PDF nunca llega al servidor: se rechaza en el cliente
  (`FileInput`/`matchesFileAccept`). No es un defecto; el spec original asumía que el 422 del
  servidor era el camino que ejercitaría un E2E de pantalla, y no lo es. Documentado en el propio
  spec y en `defectos.md`.
- **Ver también** las decisiones de la mitad API (`decision-dependencia.md`): ninguna dependencia
  XLSX se agrega esta noche.
