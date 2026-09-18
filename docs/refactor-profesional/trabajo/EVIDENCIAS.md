# Evidencias

Entorno: macOS · Node 24.19 · Yarn 4 (corepack) · `ng serve` en `http://localhost:4310`, rama
`justin/refac-ux-profesional` (worktree `wt-refac-ux`) · backend simulado · Chromium.
Fecha: 2026-09-17/18.

## Comandos y resultados

| Comando | Resultado | Nota |
|---|---|---|
| `corepack yarn lint` | exit 0 | tras corregir H-18 |
| `corepack yarn typecheck` | exit 0 | app + cypress + e2e |
| `corepack yarn build` | exit 0 · inicial 332,81 kB transferido (base 332,73) · 22 avisos de presupuesto (base: los mismos 22 archivos) | |
| `corepack yarn test --watch=false` | 517/520 archivos verdes; **10 pruebas rojas preexistentes** | mismas 10/145 con `src/` de `1f8e8bfd` (H-13, H-17) |
| `ng test --include=…/appointments.spec.ts` | 68/68 | 63 previas + 5 nuevas |
| `ng test --include=…/upcoming-and-past.spec.ts` | 7/7 | nueva |
| `ng test --include=…/alovida-runtime.service.spec.ts` | 53/53 | 2 nuevas; **rojas antes del arreglo** |
| `ng test --include=…/data-table.spec.ts` | 25/25 | 3 nuevas |
| `ng test --include='src/app/shared/**/*.spec.ts'` | 106 archivos · 1 327 pruebas | tras normalizar movimiento |
| `E2E_BASE_URL=http://localhost:4310 yarn pw <spec del refactor> --workers=1` | **9/9** (18–19 s) | dos corridas |
| Kill-test H-01 (código base + mismo E2E) | **falla** con la base, **pasa** con el arreglo | |

## Mediciones en navegador

| Qué | Antes | Después |
|---|---|---|
| «Pedir una cita» (top, 1440 / 390) | no existía; la sección estaba al pie de una página de 2 920 / 3 676 px de alto | 104 / 186 px |
| Primera cita próxima (top, 1440 / 390) | debajo del historial | 407 / 495 px |
| Controles de filtro recortados (1440) | 3 (estado, desde, hasta; observado en captura) | 0 (medido) |
| Filtros a 768 | no medido en la base | 2 + 2 (medido); con 18rem durante el piloto eran 3 + 1 |
| Consultas: px ocultos (1440 / 1280) | 65 / — | 0 / 49 con sombra |
| Nombres accesibles con uuid en `/schedule` (390) | «Ver el detalle de 79a07372-…» | 0; «Ver el detalle de Diego Quiñónez Fonseca» |
| `NotFoundError` a 390 px (médica) | ≥ 20 | 0 |
| «Viernes 18 De Septiembre» | sí | «Viernes 18 de septiembre» |

## Capturas

- `capturas/antes/` — punto de partida (5).
- `capturas/despues/` — verificación manual (8).
- `capturas/e2e/` — generadas por la prueba E2E (6).

## Avisos de presupuesto (idénticos en base y candidato)

Los 22 archivos sobre 4 kB son los mismos en ambos builds. Cinco los toca este refactor y crecen
entre 0,02 y 0,32 kB por los `var(--dur-*)`: `schedule-grid`, `register-practitioner`,
`field-editor`, `date-picker`, `tree-select`. `appointments.css` llegó a 4,04 kB durante el
piloto y se recortó por debajo del umbral (`68d26516`).
