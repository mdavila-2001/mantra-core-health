# Evidencias

## Exploración de `/schedule` y menú móvil · 2026-10-05

Entorno: Windows, Chromium, `http://localhost:3012`, sesión médica simulada. Recorrido manual con Playwright CLI; no equivale a una suite automatizada ni cubre permisos/API reales.

| Vista/acción | Resultado observado |
|---|---|
| Agenda del día, claro, 390×844 y 1280×900 | Abre y se lee en ambos tamaños. |
| Agenda del día, oscuro, 390×844 | Abre y se lee. |
| Agenda de semana, oscuro, 390×844 y 320×720 | Se lee; presenta dos columnas en ambos anchos. |
| Grilla y preview del horario anterior, «Mis horarios», 320×720 | Se abre; la grilla del modal se desplaza horizontalmente dentro de su contenedor. |
| «Más accesos» móvil, 390 px | Snapshot accesible enumera Red social, Tutoriales, Chats (4 no leídos), facturas, solicitudes y ajustes. «Tutoriales» navega a `/tutorials` y cierra el menú; Escape lo cierra y devuelve el foco al botón. El menú abierto mide 252×269 px. |
| Ancho del documento con viewport de 390 y 320 px | `documentElement.scrollWidth` y `body.scrollWidth` coinciden con el viewport (390/390 y 320/320); sin overflow horizontal del documento. |

Capturas en `capturas/despues/`: `schedule-dia-claro-movil-390.png`, `schedule-dia-claro-escritorio-1280.png`, `schedule-dia-oscuro-movil-390.png`, `schedule-semana-oscuro-movil-390.png`, `schedule-semana-oscuro-movil-320.png`, `schedule-mis-horarios-preview-320.png` y `header-mas-accesos-oscuro-movil-390.png` (menú abierto).

En la vista mensual oscura a 320×720, la primera pasada reveló que los textos «X cupos disponibles» se superponían en varias celdas. Evidencia previa: `capturas/despues/schedule-mes-oscuro-movil-320-antes-ajuste.png`. Tras compactar los conteos (`N libres`/`Bloq.`) y conservar las causas completas en los nombres accesibles, la revisión posterior a 320×720 y 390×844 no mostró solapamientos ni overflow horizontal del documento (root/body 320/320 y 390/390). Capturas: `capturas/despues/schedule-mes-oscuro-movil-320.png` y `schedule-mes-oscuro-movil-390.png`.

También se recorrieron día, semana, mes e histórico del 3 de octubre con reservas/estados. La cobertura es manual, con rol médico simulado y Chromium; no incluye otros navegadores, roles ni backend real. La compilación de desarrollo inicialmente informó incompatibilidad entre `Event` y `KeyboardEvent`; se corrigió a `Event` y la reconstrucción posterior terminó sin errores. yarn typecheck y yarn build finalizaron con exit 0 en el cierre del 2026-10-05; el build conserva avisos existentes de presupuesto CSS y dependencias CommonJS. La prueba unitaria enfocada de la vista mensual finalizo con 29/29 pruebas aprobadas. El log del navegador registra dos errores CSP de scripts inline en `/auth` durante desarrollo, ajenos a `/schedule`.

## Piloto del panel principal · 2026-10-05

Entorno: Windows, rama `master`, `ng serve` en `http://localhost:4200`, datos simulados y Chromium. Alcance: `/dashboard` para personal, administración y paciente. Las evidencias anteriores de este archivo pertenecen a otra iteración.

| Comprobación | Resultado |
|---|---|
| `yarn pw playwright/panel-hoy.spec.ts --reporter=list` | 2/2; roles, navegación y anchos 390/768/1024/1440/1920 |
| `yarn pw playwright/panel-refactor-visual.spec.ts --reporter=list` | 2/2; paciente/personal, 320 px, foco y Escape, tema oscuro, movimiento reducido y contraste de matriz |
| `yarn typecheck` | exit 0 |
| `yarn eslint playwright/panel-refactor-visual.spec.ts` | exit 0 |
| `yarn build` | exit 0; mantiene avisos de presupuesto CSS y CommonJS de otras áreas |
| `yarn lint` | exit 0 tras corregir el manejador de Escape del menú |

La tabla de intensidad tenía una regla de oscuro dentro de una hoja CSS encapsulada que no alcanzaba a `:root`. Se sustituyó por tokens semánticos globales; la prueba mide el color computado de cada celda con datos y exige al menos 4,5:1 en ambos temas. El mínimo de los pares definidos es 4,97:1. En 320 px la tabla se desplaza dentro de su contenedor y la página conserva su ancho.

Capturas: `capturas/despues/panel-personal-320.png`, `panel-personal-movil-oscuro.png`, `panel-personal-escritorio-oscuro.png`, `panel-paciente-movil.png`, `panel-paciente-movil-oscuro.png`, `panel-paciente-escritorio-oscuro.png`. La prueba de jornada también actualizó `docs/frontend/evidence/panel-hoy/` en cinco anchos, oscuro y administración.

No se midió rendimiento de campo ni se probaron estados de error/vacío mediante fallos inyectados; sus ramas se inspeccionaron en los componentes y plantillas. Estas capturas usan el simulador y no demuestran comportamiento de la API real.

---

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

## Segunda tanda — candidato `e7261cb4`

| Comando | Resultado |
|---|---|
| `yarn lint` · `yarn typecheck` · `yarn build` | 0 · 0 · 0 (22 avisos = base) |
| `yarn test` | **6 346 ✅** · 10 ❌ preexistentes (las mismas H-13/H-17) |
| E2E del refactor (`--workers=1`) | **11/11** |
| SSR de producción (`serve:ssr`, :4311) | CSP con el hash del render; 0 errores de consola en `/posts`, `/auth`, `/directory` |

| Qué | Antes | Después |
|---|---|---|
| Panel médica: «Ver mi agenda de hoy» (top, 1440 / 390) | dentro de «Tus accesos», debajo de las cifras | 104 / 186 px; cifras a 973 px |
| Filtros de «Mis citas» a 1280 | «Hasta» sola en 2.ª fila | una fila |
| «Descargar Archivo 1» (nombre accesible) | idéntico en cada tarjeta | «… de Hemograma completo» |
| «Reservar hora» en «Mis órdenes» | deshabilitado · «Próximamente» | enlace a `?resource=lab`, foco en «Agendar una cita» |
| Transición del menú (marco) | 0,16 s `ease` | 0,12 s `--curva`; 0,01 ms reducido |

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
