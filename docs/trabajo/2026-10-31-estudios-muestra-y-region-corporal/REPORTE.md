> **AVANCE: 3 / 17 — 17,6 %.** Sólo H2 (front): 3 de sus 7 microtareas HECHO, contra el **doble (mock)**; H1 (modelo y API) y H3 son de otros repos/PRs. El hito H2 queda `A MEDIAS`.

# Reporte — Muestra de laboratorio y región corporal en la orden de estudios (front)

- Fecha: 2026-11-06 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/jolly-wozniak-l651q1` (desde `origin/dev` 68bb79660)
- Peldaño de evidencia alcanzado (front): **`TESTED`** (220 pruebas dirigidas en verde, `typecheck` y `build` con exit 0) y, contra la maqueta, **`VERIFIED_FUNCTIONAL_ONLY`** (Playwright 8/8 con recarga de página). No es `VERIFIED` ni `REGRESSION_VERIFIED`: la API real no se ejercitó y la suite completa no pudo correr (BLOCKED).
- Detalle de lo que se hizo, de lo que quedó a medias y de lo que no se cubrió: ver `evidencia/verificacion.md` y `evidencia/doble-revision.md`.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H2.S1.M1 | Tipos y cliente: la orden, la orden del paciente y la bandeja del laboratorio llevan el detalle; el cliente manda `specimenTypeConceptId` plano e imagen dentro de `imaging` y lo lee plano o anidado, sin `null` | `yarn typecheck`; `ng test` focalizado | exit 0; 17 archivos / 220 pruebas |
| H2.S1.M2 | Laboratorio exige la muestra (catálogo `specimen-type`), la manda y el histórico la muestra | `ng test analysis-order-block`; Playwright «laboratorio» | PASS; la muestra vuelve tras recargar la página |
| H2.S2.M2 | La orden ofrece muestra (LAB) o parte del cuerpo (IMAGING), excluyentes; el 3D propone región y lado | `ng test`; Playwright «imagen» | PASS contra la maqueta (8/8, 3,0 min) |

## A medias
### H2.S2.M1 — Selector `body-site-picker`
- Qué anda: visor 3D + buscador accesible; tocar la lista o el cuerpo da la misma selección (lógica pura probada); un hueso par elegido por nombre no decide el lado; bajo demanda y nada en servidor; teclado probado en navegador; el 3D dibujó en las 8 corridas.
- Qué no anda / no probado: SSR no ejercitado; el toque con puntero sobre el lienzo sin prueba de navegador. Es un organismo y no la molécula pedida (el lint prohíbe que una molécula importe organismos).
- Qué falta: renderizar en servidor y un clic de puntero en Playwright.
- Dónde quedó: `src/app/shared/components/organisms/body-site-picker/`; compila.

### H2.S2.M3 — Orden del paciente y recepción
- Qué anda: «Mis órdenes» muestra «Muestra: …» / «Región: …» (unitario); `LabInboxItem` lee el detalle y `specimenDraftFromInboxItem` precarga muestra/región.
- Qué no anda: `lab-reception` ya no existe en `dev` (D-4): no hay pantalla donde precargar; sin Playwright ni captura de «Mis órdenes».
- Qué falta: decidir dónde vive hoy la recepción y conectar la precarga.
- Dónde quedó: `diagnostic-orders.*`, `diagnostics-lab.types.ts`; compila.

### H2.S3.M1 — Estados y errores
- Qué anda: 422 por `details.reason`/`details.field` en su campo, datos conservados, botón bloqueado en vuelo, motivo del botón gris junto al campo, estados cargando/error del catálogo (unitarios).
- Qué falta: capturas de los estados de error.
- Dónde quedó: `study-detail-section/`; compila.

### H2.S3.M2 — Prueba visual y doble revisión
- Qué anda: 16 capturas (390/768/1440 × claro/oscuro), miradas una a una; ninguna `RECHAZADA`.
- Qué no: ninguna `APROBADA`; la segunda pasada la hizo quien implementó; la revisión independiente (`visual-reviewer`) está pendiente.
- Dónde quedó: `evidencia/`.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.* (modelo y API) | de otros agentes | PRs mantra-core-health-model #133 y mantra-core-health-api #1374 |
| Playwright contra la API real | BLOCKED | que esos PRs estén en `dev` y desplegados |
| H3 (entrega) | en curso | revisión humana (no se mergea) |

## Evidencia
`evidencia/verificacion.md`, `evidencia/doble-revision.md`, `evidencia/capturas/*.png` (16). Spec `playwright/estudios-muestra-y-region.spec.ts` (captura a `E2E_CAPTURAS_DIR`; por omisión a `artifacts/`).

## No cubierto
- Contra la API real: nada. Todo es el doble `study-detail.handlers.ts`, que replica los `details.reason` pero no es la API. Contrato verificado leyendo código y openapi locales.
- `yarn test` completo: BLOCKED (ENVIRONMENT): 5 intentos terminan con `exit 129` tras `RUN` (esbuild «deadlock» / memoria del sandbox).
- SSR, toque con puntero, estados de error en navegador, «Mis órdenes» en navegador, WebGL apagado, contraste medido, recepción del laboratorio.
- `yarn lint` global: 13 errores preexistentes en archivos no tocados; los fallos de `diagnostic-orders` («Reservar hora») son de `dev`.
- Se editaron `carril-insurance-antifraud-duplicates.spec.ts` e `infra-f5-integracion.spec.ts` (elegir muestra) sin correrlos; los `.mjs` viejos ya estaban desactualizados.

## Desvíos del plan
- La API ya tenía el contrato (F1–F3 desactualizados): muestra con el destino `clinical.service_requests.specimen_type_concept_id`, no `SPECIMEN_TYPE_TARGET`.
- Selector como organismo; la lógica pura del atlas subió de `features/glossary` a `core/data-access/anatomy-atlas/anatomy-atlas.logic.ts` (el glosario la re-exporta).
- La región del catálogo la propone el 3D (cruce de la API) y es obligatoria (D-2 corregida).
- En la maqueta los estudios llevan prefijo `LAB_`/`IMG_`/`CAR_` en el selector de la orden, como el catálogo real.
- Dos arreglos de CSS del bloque existente (columna de la rejilla en móvil) porque cortaban lo nuevo.

## Riesgos residuales
- Depende de dos PRs: sin ellos la API de `dev` rechaza con 400 las claves nuevas de `imaging`. Orden: modelo, API, front.
- Destino del tipo de hueso dado por el coordinador; hasta que el modelo lo siembre ese selector dirá «No se pudo cargar el catálogo».
- Componentes de un panel y contraste: lo que la API ya exigía y la pantalla no pide; un 422 así sale como error general.
- `body-regions.data.ts` es copia de datos de la API: regenerar con `node scripts/gen-body-regions.mjs`.
- Tipos de hueso del doble: sintéticos, sin procedencia.

## Decisiones y ambigüedades
- `Responsable:` del commit: la puerta lo exige y no se pudo preguntar; se declara «mdavila-2001 (titular del repo; sin confirmar en sesión)». Confirmar con él.
- Laboratorio exige muestra en la UI aunque la API la deje opcional (CA del plan). Confirmar con producto.
- Región obligatoria en imagen (la API la exige en estudios del catálogo).

## Historia
Traspaso original (2026-10-31): sólo descubrimiento y plan, 0 / 17, peldaño `DISCOVERED`.
