# Reporte — Portal de reportería de Alovida (maqueta del front)

> **AVANCE: sin porcentaje.** El plan de este trabajo no está descompuesto en microtareas con estado, así que no hay un `HECHO / total` que calcular y no se inventa uno. Lo que sigue es qué hay, con qué evidencia y qué no se verificó.

- Fecha: 2026-10-30 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/focused-lamport-mufj3h` (repo `mantra-core-health`)
- **Peldaño de evidencia (regla de la casa 30):**
  - Lógica, estado y presentación de lo tocado: `TESTED` (pruebas dirigidas).
  - Build de producción: `RUNS` (el pre-push compiló con salida 0 en `e763ed06` y en `10a474b7`).
  - Comportamiento en navegador de lo capturado: `VERIFIED_FUNCTIONAL_ONLY` en lo que se observó; **no** `REGRESSION_VERIFIED`.
- Alcance: **maqueta con datos de EJEMPLO declarados en pantalla**. No hay API de reportería real conectada.

## Completado (con evidencia)

| Qué | Comando / evidencia | Resultado |
|---|---|---|
| 34 archivos de prueba dirigidos de reportería, panel de gráficos, mock, auth, sesión y estado de vista | Vitest directo sobre esos archivos | 572 pruebas, todas en verde |
| Typecheck de app y de specs | `tsc -p tsconfig.app.json` y `tsconfig.spec.json` (`--noEmit`) | salida 0 |
| Lint de `src/` y del spec de capturas | `eslint src playwright/reporteria-capturas.spec.ts` | sin errores |
| Recorrido en navegador, 3 viewports × claro/oscuro, estados y teclado | `playwright test playwright/reporteria-capturas.spec.ts --workers=1` | 19/19 pasan; capturas en `evidencia/capturas/` |
| Consola y red del recorrido | `evidencia/consola-red.json` (con metadatos y lista de pruebas ejecutadas) | solo los 8 errores **forzados** de los estados «error» y «sin permiso» |
| Casos de teclado en navegador real | mismas pruebas | foco en el campo del asistente, `Escape` en un diálogo no cierra el asistente, fondo inerte con el asistente superpuesto en móvil, menú «Más» con foco visible |

## A medias

### Capturas no revisadas una por una
- Qué anda: las capturas que revisé a ojo (selector, grid en tableta, suscripciones completa en tableta, medidores y etiquetas en escritorio claro, publicidad en móvil oscuro, comisiones en escritorio oscuro, embudo móvil, negativos, teclado) se ven correctas tras los arreglos.
- Qué no anda / no se verificó: el resto de las pestañas en escritorio oscuro y en móvil, y varios estados, no los miré uno por uno en la última recaptura.
- Qué falta: revisar esas capturas o repetir la revisión visual independiente sobre la recaptura final.
- Dónde quedó: capturas regeneradas en `evidencia/capturas/`; código compila y las pruebas pasan.

## Pendiente

| Qué | Estado | Qué lo destraba |
|---|---|---|
| Integración con la API real de reportería | `BLOQUEADO` | Que exista la API (H0 del plan) |
| Velas, filtros y cálculos contra datos reales | `BLOQUEADO` | Datos reales de suscripciones, publicidad y comisiones (A-7) |
| Definición del módulo de publicidad push/pauteo | `DECISION_REQUIRED` | Negocio (A-2) |
| Reglas de comisión por actor | `DECISION_REQUIRED` | Negocio y cumplimiento (A-4) |

## No cubierto

- Los scripts e2e `.mjs` y los de Cypress que adapté para aceptar `/portal-selector` solo se comprobaron con `node --check` y `tsc`; **no se ejecutaron**.
- Teclado completo de todo el portal y lector de pantalla: solo los casos del recorrido de teclado. Contraste: medido con cálculo para las celdas del mapa de calor (≥ 4,5:1); el resto, a ojo.
- Capturas de interacciones en tableta y móvil (salvo el asistente en móvil).
- Integración real: todo es mock.
- Texto de las fechas de cohorte («2026-05») sigue en ISO.

## Desvíos del plan

- Se agregó Apache ECharts como librería de gráficos (ADR-0017), porque no había ninguna en el front.
- El alcance «Plataforma» se ofrece solo a `SUPERADMIN` y `PLATFORM_ADMIN`; el PLAN lo pedía y la primera versión lo ofrecía a todos.

## Riesgos residuales y deuda

- Datos de ejemplo con inconsistencias entre tarjetas (el MRR del resumen y el total de «Resumen por plan» no coinciden; la tabla «Alertas» solo lista filas «Normal»).
- `ChartThemeService` duplicado con la lectura de tema dentro de cada panel de gráficos; cada panel observa el `<html>`.
- `app.routes.ts` ya estaba sobre el techo de líneas y creció.
- Gates `check-*` que ya fallaban en la base siguen fallando; no empeoraron por este trabajo salvo `check-doc-coverage` (corregido) y `check-max-lines` (corregido).

## Decisiones y ambigüedades

- **A-2, A-3, A-4, A-6, A-7** del PLAN siguen abiertas; supuestos tomados: ver `PLAN.md` §7.
- `REPORTING_ADMIN` **no** ve el alcance «Plataforma» (supuesto; confirmar con negocio).
- Los administradores con los dos accesos aterrizan en el selector de portal en vez de `/dashboard`; hay que confirmarlo con producto.
