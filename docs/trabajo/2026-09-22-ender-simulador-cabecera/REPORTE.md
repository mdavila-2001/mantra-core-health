# Reporte — Simulador que responde a tiempo, agendas para todos, Chats y Tutoriales en la cabecera

> **AVANCE: 41 / 48 — 85,4 %.**

- Fecha: 2026-09-22/23 · Plan: [PLAN.md](./PLAN.md) · Rama: `ender/simulador-cabecera-2026-09-22`
  (repo `alovida/mantra-core-health`, corte `origin/mockup@05d83cb8`, reconsultado: el `b655e844…` de la
  ficha ya tenía 6 PR encima)
- Peldaño de evidencia: **TESTED** en el código de producto (typecheck y lint limpios; specs dirigidos en
  verde; regresión `core/` 1541/1541, `shared/` 1439/1439, raíz 48/48; `features/` con 2–3 timeouts de
  5 s por corrida en specs que no toqué — ver «A medias» H6.S1.M2). **VERIFIED** en navegador real:
  R-03, N-01, D-05, los dos escenarios de reserva, el desborde a 375 px, el barrido de pantallas de las
  5 cuentas. Doble revisión de capturas hecha: [`evidencia/doble-revision.md`](./evidencia/doble-revision.md).
- **Estado de git: nada commiteado ni pusheado.** No hay PR, así que la regla 35.2 (PR mergeable) no
  aplica todavía; queda pendiente de la decisión de commitear (ver «Decisiones»).

## Completado

| ID | Qué se logró | Comando / observación | Resultado |
|---|---|---|---|
| H1.S1.M1-M5 | Corte, baseline clasificado, `stock:generate` ×2 idéntico | `git rev-parse`; `yarn lint/typecheck/test`; `yarn stock:generate` ×2 + diff | PASS — `evidencia/antes/` |
| H1.S2.M1 | Latencia leída y observada (10 respuestas cronometradas) | `ng test --include=.../latencia-observada.spec.ts` | PASS — `evidencia/antes/latencia.md` |
| H1.S2.M2 | Agendas: 791 directorio / 14 con recurso y cupos / 13 registrados en 0 | `ng test --include=.../agendas-cobertura.spec.ts` | PASS — `evidencia/antes/agendas.txt` |
| H1.S2.M3 | «Elegir médico» medido EN VIVO: **6 peticiones** (médica, 2 sedes); registrado con 1 sede = 4 | contador temporal en el interceptor + navegador real, ya **retirado** (`git grep __mockRequestLog` → 0) | PASS — `evidencia/h2/elegir-medico-en-vivo.md` |
| H2.S1.M1-M3 | Tabla de latencia por prefijo, sin azar, spec de tres niveles | `git grep -c Math.random` → 0; `ng test --include=.../mock-backend-latencia.spec.ts` | 5/5 PASS |
| H2.S1.M4 | «Después»: con la tabla, el flujo medido de 6 peticiones suma ≈ 250 ms (objetivo Q-10 < 1 s) | mismo archivo que H1.S2.M3 | PASS (estimado sobre la tabla, ver nota) |
| H2.S1.M5 | Tabla publicada a Justin | `Daily-Noche-2026-09-22.md` §4-bis | HECHO |
| H2.S2.M1 | Decisión: no compartir `GET` en vuelo (Q-E2) | comentario en PLAN.md | HECHO |
| H3.S1.M1-M5 | 12 registrados con especialidad: recurso, plantilla, cupos ±21 días; casos límite; captura | `ng test --include=.../agenda-casos-limite.spec.ts --include=.../mock-backend.spec.ts` | 3/3 y 21/21 PASS; 14→26 con recurso; captura mirada |
| H3.S2.M1 | Escenario A completo: paciente reserva con la médica → la médica lo ve | navegador real, `evidencia/h3/capturas/escenario-a-0{3,4}-*.png` | estado real: `Solicitada` |
| H3.S2.M2 | Escenario B completo: paciente reserva con un registrado | `evidencia/h3/capturas/escenario-b-03-*.png` | estado real: `Pedido` (= solicitada) |
| H3.S2.M3 | README con los dos escenarios | `grep -c Escenario` | 3 |
| H3.S2.M4 · H6.S1.M4 | Barrido de pantallas, 5 cuentas | `E2E_BASE_URL=... npx playwright test playwright/mockup-barrido.spec.ts --workers=1` | **5 passed**; «Peticiones sin manejador» vacío — `evidencia/h6/mockup-barrido*` |
| H4.S1.M1-M4, M6 | Tutoriales y Chats con globo, `aria-label`, no leídos, fuera del menú; specs con motivo | `ng test --include=.../navigation.service.spec.ts --include=.../shell-layout.spec.ts` | 85/85 PASS |
| H4.S2.M1-M4 | Cotizaciones verificada (ya existía); Mis puntos retirado + redirect; declarado (regla 65) | `ng test --include=.../app.routes.spec.ts` | 48/48 PASS |
| H5.S1.M1-M3 | Veredicto de los `iconOnly`; globo del tema aplicado y visto | `evidencia/h5/iconos.md`; captura del tooltip «Tema» | 66/66 PASS |
| H6.S1.M1 · M3 | Lint y typecheck limpios; `stock:generate` idéntico; `ng serve` arranca (≈ 60 s) | `yarn lint`; `npx tsc --noEmit`; diff vacío | 0 errores |
| H6.S2.M2-M4 | Peldaño por área, este reporte, procesos cerrados | — | esta sección y «Procesos» |

**Hallazgo propio, corregido y re-verificado (fuera del plan, dentro de mi alcance `core/mock/**`):** el
cartel «Datos de prueba» (`mock-banner.ts`) tapaba el ícono de Tutoriales a 375 px por un offset fijo
anterior a N-01. Primera corrección → la doble revisión encontró que tapaba el saludo de la pantalla
(`MAYOR`) → segunda corrección (esquina derecha) → re-captura `ACEPTABLE CON RESERVAS` (`MENOR`: unos
píxeles del final de «…Pérez»). Detalle en `evidencia/h4/overlap-mock-banner-375px.md` y
`evidencia/doble-revision.md`.

## A medias

### H6.S1.M2 — Regresión completa sin rojos nuevos
- Qué anda: `core/` 131/131 archivos (1541 tests), `shared/` 113/113 (1439), raíz 48/48, todo en verde;
  `features/` 328 archivos con 4098–4099 de 4101 tests en verde por corrida.
- Qué no anda: en `features/` fallan 2–3 tests por corrida con `Test timed out in 5000ms`, siempre en
  `insurance-analytics.spec.ts` (chequeo de accesibilidad) y `chat-preferences.spec.ts` (persistencia).
  Esos dos archivos **no los toqué** (`git status` vacío en `features/insurance` y `features/settings`),
  pasan en aislamiento (18/18) y el conjunto que falla cambió entre corridas (3, luego 2). Clase
  `ENVIRONMENT`: la máquina compartida estuvo entre 0,9 y 4 GB libres de 15,7. No se subió ningún
  timeout (regla 00 §4.3).
- Qué falta exactamente: una corrida de `features/` en la máquina sin presión de memoria, o que el dueño
  de esos dos specs decida su tope; no depende de este carril.
- Dónde quedó: salidas en `/tmp/f-features*.txt` (no versionadas); resumen aquí.

### H6.S1.M5 — Barrido de clics
- Qué anda: `mockup-click-sweep.spec.ts` corrió 10,7 min; Paciente, Admin y Superadmin pasan.
- Qué no anda: falla **Médica** con botones que no responden en 4 s en `/notification-center`,
  `/my-account/identity`, `/administration/pharmacy-*`, `/my-account/access-requests`,
  `/my-account/edit`, `/my-account/profile/edit`, `/my-quotations/new`. Es exactamente **HALL-M6** del
  daily de equipo, documentado antes de mi cambio (`origin/mockup` ya estaba así); ninguna de esas rutas
  es de mi reserva. Clase `EXTERNAL` sin dueño asignado.
- Qué falta exactamente: que quien triage HALL-M6 lo cierre; entonces repetir este barrido.
- Dónde quedó: `evidencia/h6/click-sweep/salida.txt`.

### H1.S2.M4 — Capturas «antes»
- Qué anda: 3 de 4 (directorio del paciente en escritorio; ficha de registrado sin agenda en escritorio y
  móvil), todas miradas.
- Qué no anda: falta el «antes» de la médica; ya no es reproducible sin revertir la rama.
- Qué falta exactamente: nada recuperable; queda declarado.
- Dónde quedó: `evidencia/antes/capturas/`.

### H4.S1.M5 — Tabulación y desborde a 375 px
- Qué anda: desborde medido (`scrollWidth` 364 vs 360), superposición real encontrada y corregida.
- Qué no anda: no se ejercitó el orden de tabulación con `Tab` real.
- Qué falta exactamente: recorrer la cabecera con `Tab` y confirmar foco visible en cada enlace.
- Dónde quedó: `evidencia/h4/overlap-mock-banner-375px.md`.

### H4.S1.M7 — Matriz de 12 capturas (2 roles × 3 viewports × 2 temas)
- Qué anda: 12 capturas reales y miradas con doble revisión, pero no son la matriz pedida.
- Qué no anda: falta tablet en todo; falta médica en móvil; falta paciente en escritorio y en claro/oscuro
  completos.
- Qué falta exactamente: las combinaciones faltantes (≈ 8 celdas), con doble revisión cada una.
- Dónde quedó: `evidencia/h4/capturas/`, `evidencia/doble-revision.md` (sección «No cubierto»).

### H6.S2.M1 — Capturas finales por rol/viewport/tema
- Qué anda / no anda / falta: depende de H4.S1.M7; mismo hueco.
- Dónde quedó: idem.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H2.S2.M2 | `DESCARTADO` (decisión de H2.S2.M1: no se implementa el compartido en vuelo; no hay código que testear) | — |
| H4.S1.M5 (teclado), H4.S1.M7, H6.S2.M1 | `A MEDIAS` | una sesión de navegador más; nada externo |
| H6.S1.M5 | `A MEDIAS` (externo) | cierre de HALL-M6 por quien lo triage |
| H6.S1.M2 | `A MEDIAS` (ambiente) | máquina sin presión de memoria |
| Pestaña real de «Mis puntos» (N-03) | contrato simulado y cerrado de mi lado (regla 65); la pestaña es de Itzan | Itzan |

## Evidencia

```text
git grep -c Math.random -- mock-backend.interceptor.ts        → (sin salida) 0
git grep -c __mockRequestLog -- src                           → (sin salida) 0   (contador temporal retirado)
yarn lint                                                     → exit 0
npx tsc -p tsconfig.app.json --noEmit                         → exit 0
ng test --include=src/app/core                                → 131 files, 1541 tests passed
ng test --include=src/app/shared                              → 113 files, 1439 tests passed
ng test --include=src/app/app.routes.spec.ts,app.spec.ts     → 48 passed
ng test --include=src/app/features                            → 326 files / 4098-4099 of 4101 passed (2-3 timeouts de 5 s, ver A medias)
ng test --include=<insurance-analytics + chat-preferences>    → 18 passed (aislamiento)
playwright mockup-barrido.spec.ts --workers=1                 → 5 passed (25,4 s)
playwright mockup-click-sweep.spec.ts --workers=1             → 3 passed, 1 failed (Médica, HALL-M6 preexistente)
yarn stock:generate ×2 + diff                                 → diff vacío
```

Índice de `evidencia/`: `antes/`, `h2/elegir-medico-en-vivo.md`, `h3/` (agendas, capturas y escenarios),
`h4/` (capturas, hallazgo del cartel), `h5/iconos.md`, `h6/` (barrido, click-sweep), `doble-revision.md`.

## No cubierto

- Tab real por los enlaces nuevos de la cabecera.
- Tablet en cualquier pantalla; matriz completa de capturas.
- El «después» de H2.S1.M4 es la suma de la tabla de latencia sobre las 6 peticiones medidas, **no** un
  cronómetro de punta a punta sobre la pantalla real.
- Errores de consola CSP en `/auth` (`Executing inline script violates… Content Security Policy`):
  aparecen en cada sesión y son ajenos a este carril (no toqué CSP ni scripts en línea); sin investigar.
- Reserva del escenario B vista «del otro lado»: los 13 registrados no tienen cuenta, sólo existe la
  vista de la paciente.

## Desvíos del plan

- La medición «con la Red abierta» pedida por la ficha es imposible por diseño (el interceptor no emite
  peticiones reales); se cambió el método (cronometrar la suscripción; contador temporal en vivo).
- Cotizaciones (H4.S2.M1) no se implementó: ya existía (Justin).
- El redirect de «Mis puntos» se rehízo: una ruta duplicada rompía toda la suite de rutas por `NG04014`
  (`redirectTo` + `canActivate`); ahora es una tabla de secciones que redirigen, sin guard.
- Arreglo no planeado del cartel de modo demo, en dos iteraciones (la segunda por la doble revisión).

## Riesgos residuales y deuda

- `mock-banner.ts` lo usan las cinco personas: cambió su posición en pantallas angostas. Vale una mirada
  de alguien más.
- `features/` no dio una corrida 100 % verde en esta máquina; los dos specs afectados tienen un tope de
  5 s que no aguanta la carga (deuda de sus dueños, no se tocó).
- El estado «después» de los escenarios depende de `sessionStorage`: recargar la pestaña las borra.

## Decisiones y ambigüedades

| Ambigüedad | Supuesto tomado | A quién |
|---|---|---|
| Q-E1 latencia mínima | 40 ms | Pablo |
| Q-E2 compartir GET en vuelo | No | Pablo |
| Q-E3 sede de los registrados | una de las 3 existentes, por índice (`i % 3`) | Pablo |
| Q-E4 contador de no leídos | `ChatStore.sinLeer()` tal cual (0 hasta que se abrió Chats); sin sondeo global nuevo | Pablo |
| N-03 / Q-17 | redirect a `/my-account`, sin pestaña | Itzan |
| Git | `.git/info/exclude` local tapa `.claude/`, `AGENTS.md`, `evidencia/`, `PLAN.md`, `REPORTE.md`; Justin e Itzan sí commitearon los suyos. No commiteé ni pusheé nada: 19 archivos modificados + 4 specs nuevos + `docs/trabajo/…` quedan en el árbol de trabajo | Pablo |

## Procesos que quedaron corriendo

**Ninguno.** `ng serve :4203` detenido (`Stop-Process`), navegador Playwright cerrado, procesos `chrome`
del perfil MCP eliminados; los monitores y tareas en background terminaron con la sesión anterior.
