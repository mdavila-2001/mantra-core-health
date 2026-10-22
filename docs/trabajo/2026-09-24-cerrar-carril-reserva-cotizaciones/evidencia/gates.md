# Gates — cierre del carril «reserva y Cotizaciones» (2026-09-24)

Base: `origin/mockup` @ `4daf00aa`. Rama: `justin/cerrar-carril-reserva-cotizaciones-2026-09-24`.
Criterio (guía `CERRAR-EL-CARRIL-SIN-FRENOS.md`, regla 1): **ningún rojo nuevo contra el baseline**, no verde global.

## Lint

| Corte | Comando | Resultado |
|---|---|---|
| base `4daf00aa` | `corepack yarn lint` | `✖ 249 problems (249 errors, 0 warnings)` · exit 1 |
| final | `corepack yarn lint` | `✖ 249 problems (249 errors, 0 warnings)` · exit 1 |
| final, sólo el diff (13 `.ts`/`.html`) | `corepack yarn eslint $(git diff --name-only 4daf00aa HEAD -- '*.ts' '*.html')` | exit 0, 0 problemas |

Mismo conteo en los dos cortes y 0 en los archivos tocados: **ningún rojo nuevo**. Los 249 son
`@angular-eslint/prefer-on-push-component-change-detection` y similares en archivos ajenos.

## Typecheck

| Corte | Comando | Resultado |
|---|---|---|
| base `4daf00aa` | `corepack yarn typecheck` | exit 0 |
| final | `corepack yarn typecheck` | exit 0 |

## Tests unitarios (suite completa)

| Corte | Resultado | Rojos |
|---|---|---|
| base `4daf00aa` | `Tests 2 failed \| 7413 passed` · `Test Files 3 failed \| 583` | `mock-backend-latencia.spec.ts`, `register-practitioner.spec.ts`, `date-picker.spec.ts` |
| final, 1.ª corrida (con `ng serve` levantado) | `Tests 43 failed \| 7398 passed` | `my-services` (27), `pharmacy-inbox`, `insurance-analytics`, `register-practitioner` |
| final, los 4 archivos de la 1.ª aislados | `Test Files 4 passed (4)` · `Tests 150 passed (150)` | ninguno |
| final, 2.ª corrida (sin `ng serve`) | `Tests 1 failed \| 7440 passed` · `Test Files 1 failed \| 586` | `mock-backend-latencia.spec.ts` — **también rojo en la base** |

Clase de los rojos (regla 80.4): `ENVIRONMENT` — contención del pool de workers de Vitest con el
servidor de desarrollo en paralelo; ninguno toca un archivo del diff y todos pasan aislados.
`mock-backend-latencia.spec.ts` es previo (rojo en la base). **Ningún rojo nuevo.**

## Specs focales del diff

| Spec | Resultado |
|---|---|
| `practitioner-availability.spec.ts` | 17/17 |
| `cotizaciones.spec.ts` + `cotizaciones.fuentes.spec.ts` + `cotizaciones.logic.spec.ts` | 23/23 |
| `mock-backend.spec.ts` + `pharmacy*.spec.ts` + `where-to-buy` + `new-order` + `nearby-places/**` (consumidores del doble de farmacia) | 104/104 |

## Playwright (contra `ng serve`, `--workers=1`, doble del mockup)

| Spec | Resultado |
|---|---|
| `cierre-carril-reserva-cotizaciones.spec.ts` (evidencia H6) | 5/5 |
| `cotizaciones-paciente.spec.ts` | 1/1 |
| `cierre-local-reserva-cotizaciones.spec.ts` | 6/6 |
| `reserva-cotizaciones-recorrido.spec.ts` (sin errores de consola ni peticiones fallidas) | 1/1 |

## Guardrails `scripts/check-*.mjs`

| Script | Exit | Hallazgos en archivos del diff |
|---|---|---|
| `check-architecture` | 1 | 0 |
| `check-css-tokens` | 1 | 0 |
| `check-tokens` | 0 | 0 |
| `check-contrast` | 0 | 0 |
| `check-form-pages` | 1 | 0 |

Los rojos de los tres con exit 1 caen fuera del diff (p. ej. `core/messaging/adjunto-metadata.ts`).

## Precios literales (H3.S2.M5)

`git grep -n -E 'Bs\.? ?[0-9]' -- src/app/features/account/cotizaciones` → 0 líneas. Ningún
importe escrito en el código de la pantalla: todo número sale de la respuesta de la fuente.
