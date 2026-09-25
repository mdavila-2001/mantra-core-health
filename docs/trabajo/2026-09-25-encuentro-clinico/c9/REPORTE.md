# Reporte — C9: «Mis órdenes» del paciente, por tipo, con buscador, filtros, tabla y paginación

> **AVANCE: 8 / 10 — 80,0 %.** (H1, H2.M1, H2.M2, H3.M1, H3.M2, H3.M3, H3.M4 parcial, H5 en curso; faltan H4 completo y el cierre de H5)

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/clinica-c9-mis-ordenes`
- Peldaño de evidencia alcanzado: **TESTED** por área de código (specs dirigidos en verde: 16/16, más el build). **No** `VERIFIED`: falta la prueba visual real (Playwright corrido + capturas + doble revisión), diferida al pase final de la noche que junta Farmacia y Carril C sobre el mismo stack local.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1 | Corte confirmado (`bf2c3545…`, igual a Farmacia); baseline del spec anterior en verde | `npx ng test --include='src/app/features/account/diagnostic-orders/*.spec.ts' --watch=false` (antes de tocar nada) | 15 passed (15) |
| H2.M1 | `PatientOrderRow` + `categoriaDeAnalisis()` (deriva de `categoryConceptId`, cae en Otros sin categoría) | spec "con categoría SRQ-LAB..." y "sin categoryConceptId..." | PASS |
| H2.M2 | Señales de filtro sincronizadas con la URL (`RouterTestingHarness`) | spec "cambiar un filtro actualiza la URL" y "entrar por una URL con filtros restaura la vista" | PASS |
| H3.M1 | Plantilla completa: `app-card` + `app-tabs` + `app-filter-bar` + `app-data-table` + `app-pagination` | `corepack yarn build` | exit 0 |
| H3.M2 | `app-row-actions` con 4 acciones con texto (ver resultado / preparación / liquidación / reservar), condicionadas correctamente | specs de acciones (4 casos) | PASS |
| H3.M3 | Estados S2 (loading)/S3 (empty con próxima acción)/S9 (error) | specs "sin órdenes..." y "no lee nada..." | PASS |
| H3.M4 (parcial) | Contraste sin regresión nueva | `node scripts/check-contrast.mjs` | 67 combinaciones medidas, mismas 3 excepciones preexistentes (R2/R3), ninguna nueva |
| — | Todo el spec (16 casos) | `npx ng test --include='src/app/features/account/diagnostic-orders/*.spec.ts' --watch=false` | **16 passed (16)** |
| — | Lint del código propio | `npx eslint src/app/features/account/diagnostic-orders` | sin hallazgos |
| — | Arquitectura | `node scripts/check-architecture.mjs` | sin mención de `diagnostic-orders` entre las violaciones (todas preexistentes, ajenas) |

## A medias

### H3.M4 — Accesibilidad
- Qué anda: contraste automático sin regresión; `caption` en la tabla; `aria-live="polite"` en el resumen; el diálogo de preparación cierra con `Escape` (probado por spec, no por teclado real en navegador).
- Qué no anda: no se ejecutó `accessibility-testing` con lector de pantalla real ni navegación completa por teclado en un navegador — exige el stack local corriendo, diferido al pase final.
- Qué falta exactamente: correr `playwright/clinica-c9-mis-ordenes.spec.ts`, la doble revisión de capturas (regla 35) y una pasada manual de teclado/lector.
- Dónde quedó: rama `claude/clinica-c9-mis-ordenes`, compila y los specs unitarios pasan.

### H4 — Playwright y revisión visual
- Qué anda: el spec `playwright/clinica-c9-mis-ordenes.spec.ts` está escrito, siguiendo el recorrido del prompt §6 (conteos, buscador, limpiar filtros, scroll lateral a 390/768, recarga, diálogo de preparación).
- Qué no anda: no se ejecutó — no hay stack local levantado (Postgres + API) en esta máquina en este momento.
- Qué falta exactamente: levantar el stack, correr `npx playwright test playwright/clinica-c9-mis-ordenes.spec.ts` (sin `pw-guard.mjs`: no existe en este repo, ver Decisiones), sacar capturas en 5 viewports × claro/oscuro, doble revisión crítica y puntuación de `ui-quality-review`.
- Dónde quedó: el spec compila (no se corrió contra un servidor real todavía).

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H4.M1 (correr el E2E) | BLOQUEADO | Stack local (Postgres + API de `mantra-core-health-api`) — se levanta una sola vez al final de la noche para Farmacia + C9/C5/C7 juntos |
| H4.M2 (capturas + doble revisión) | BLOQUEADO | Depende de H4.M1 |
| H5.M1 (push, PR, daily) | EN CURSO | Este mismo commit lo abre |

## Evidencia

```text
$ npx ng test --include='src/app/features/account/diagnostic-orders/*.spec.ts' --watch=false
Test Files  1 passed (1)
     Tests  16 passed (16)

$ corepack yarn build
Output location: .../dist/mantra-core-health   (sin errores)

$ node scripts/check-contrast.mjs
67 combinaciones medidas en 2 hojas · las excepciones E1–E3 (v1.0) y R1–R2 (bóveda) se esperan
```

## No cubierto
- Prueba visual real (capturas, doble revisión, `ui-quality-review`) — depende del stack local.
- Accesibilidad manual (teclado real, lector de pantalla).
- El E2E de Playwright no se ejecutó (sólo se escribió).
- El caso de paginación real con más de una página de datos (el mock trae pocas órdenes por paciente demo; no se generó ni sembró data adicional — eso es territorio de C2, fuera de mi alcance).

## Desvíos del plan
- `docs/trabajo/2026-09-25-encuentro-clinico/c9/` es la ruta que pidió el prompt (no `docs/trabajo/<fecha>-<slug>/` genérico de la regla 20) — es la excepción explícita de esa regla para carriles con estructura propia.
- Ver "Desvíos de diseño descubiertos al implementar" en `PLAN.md` (H3): `Tabs`/`Tab` sin forwarding de testid, `RowAction` sin campo de ruta, `pw-guard.mjs` inexistente, `StatusSeal` con vocabulario que no calza del todo.
- Se conservó la acción «Reservar hora en un laboratorio» de la versión anterior, no mencionada por el prompt de C9 (ambigüedad registrada en `PLAN.md`).

## Riesgos residuales
- Perder clic-medio/"abrir en pestaña nueva" en «Ver resultado» y «Reservar hora» (antes eran `<a routerLink>`, ahora son acciones de `app-row-actions` con `Router.navigate()` imperativo).
- La paginación en cliente no se probó con un volumen real de órdenes (depende de datos que trae C2).

## Decisiones y ambigüedades
- **«Reservar hora en un laboratorio»**: se conserva como cuarta acción. A confirmar con el propietario si debía sacarse (el prompt sólo enumera tres).
- **H6.S3-equivalente de Farmacia no aplica acá** (no hay un "carril 19" en C9).
- **`app-status-seal` para Estado**: mapeo parcial (`PENDING`→pending, `COMPLETED`→approved, resto→`unknown` neutro) — a confirmar con quien diseñó el componente si conviene ampliar sus variantes para el dominio de órdenes clínicas en vez de forzar el de trámites adjudicados.
