# Evidencias

## Modales de la consulta: tarjeta doble, título repetido y tres columnas · 2026-10-27

Entorno: Linux, `yarn start:demo` en `http://localhost:4300`, sesión médica simulada, Chromium.
Reporte del cliente: el modal «Prescribir medicación» dibujaba la tarjeta del bloque dentro del
panel, repetía el título y repartía los campos a tres columnas de ~240 px con «Duración» sola.

| Comprobación | Resultado |
|---|---|
| `playwright/modales-composicion.spec.ts` (las 9 casillas, 1440×900 y 390×844) | 2/2: ninguna rejilla del modal pasa de 2 columnas, ningún bloque deja su marco dentro del panel, desborde lateral ≤ 1 px |
| Primera pasada | «Formulario médico» seguía enmarcado (dos bloques en el cuerpo) y desbordaba 49 px en 390; corregido |
| `ng test` de medication/analysis-order/specialty-form/content-dialog/consultation | 12 archivos, 271/271 |
| `yarn typecheck` · `eslint` de lo tocado | exit 0 · exit 0 |

No se ejecutó: la suite completa de `yarn test`, el resto de los 75 modales uno por uno (las
reglas viven en `alovida.css` bajo `.content-dialog__cuerpo` y alcanzan a todos), revisión
independiente (`NO_SELF_APPROVAL`: queda para la revisión del PR).

Rejilla «Qué va a registrar» (misma prueba): la última casilla llega al borde derecho (hueco ≤ 1 px)
con 8 casillas en 1440 y 390; la cifra «N en la historia» pasó a una pastilla bajo la descripción.
`ng test` de `consultation/`: 3 archivos, 22/22. `check-contrast` 0; `check-css-tokens`,
`check-colores-sueltos` y `check-max-lines` fallan igual en la base, en archivos no tocados.

Capturas en `capturas/despues/modales-2026-10-27/`.

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
| `yarn lint` | exit 1: 256 errores distribuidos en el repositorio, principalmente `prefer-on-push-component-change-detection`; el archivo nuevo pasa el lint aislado |

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

## Expediente: vista «Tabla» y «Recorrido» — 2026-10-28

Entorno: contenedor Linux · Node 22 · Yarn 4.18 (corepack) · base `origin/dev` (`d53965635`) ·
`ng serve --configuration development,demo` (backend simulado) · Chromium (Playwright) · cuenta
`medica@alovida.mock`, paciente `pid-paciente`.

| Comando / prueba | Resultado |
|---|---|
| `tsc -p tsconfig.app.json --noEmit` | 0 errores |
| `eslint src/app/features/clinical-record/patient-chart` | 0 errores (el `yarn lint` global trae errores preexistentes en specs ajenos) |
| `ng test --include='…/patient-chart/**/*.spec.ts'` | 33 archivos · **595 pruebas verdes** (las nuevas: `recorrido-clinico/` 56, `patient-chart.spec.ts` 8) |
| `yarn test` completo | **no se ejecutó** |
| Navegador 1440 / 768 / 390 | desborde horizontal de la página: 0 px; el recorrido desplaza dentro de su lienzo |
| «Secciones» sin cambios | 9 pestañas (Servicios incluida), «Nuevo diagnóstico» visible, menú de acciones Confirmar / Rechazar / Cambiar estado / Adjuntar |
| PDF desde las tres vistas | Secciones: la pestaña activa, como antes · Tabla: la tabla cronológica, 3 páginas · Recorrido: una línea que dice que el recorrido no se exporta (el lienzo lleva `data-pdf-ignore`). Texto extraído en `capturas/recorrido-clinico/pdf-desde-*.txt` |
| Chip «Atenciones» apagado | las columnas cuyos registros sí tienen atención dicen «Registros del día», no «Sin atención» |
| Teclado en un grupo | Enter expande y contrae sobre el **mismo** botón; el foco se queda y `aria-expanded` pasa de `false` a `true` |
| Clic en un nodo | abre el mismo modal de detalle que la tabla |
| Foco/puntero en «Enalapril» | ilumina Ambulatorio → Hipertensión arterial → Enalapril y atenúa el resto |
| Tema oscuro | colores sólo de tokens `--st-*` / `--bg-*`; legible |

### Revisión independiente

`frontend-reviewer`: **no aprobado** en la primera vuelta (0 bloqueantes, 6 importantes, 10 menores).
Corregidos en el commit siguiente: rótulo «Sin atención» falso (1), foco perdido al agrupar (2),
PDF deformado (3), pruebas de la derivación (4), derivación extraída a
`recorrido-clinico/historial-del-expediente.ts` (5), filtro arrastrado entre pacientes (6), curva hacia
atrás (7), nombres accesibles de grupos (8), intervalo por días de calendario (9), «reducir
movimiento» (10), puntero y foco (11), `stackedOnMobile` y `accion` (12), texto del vacío (13),
caption de la tabla (14) y JSDoc (15). Queda como está: (16) el token de la etiqueta del intervalo, y la vista
en la URL (parte de 6), que se registra como pendiente. `visual-reviewer`: pendiente.

`visual-reviewer`, primera vuelta: **FAIL** (59/100, 5 HIGH). Corregido después:

| Hallazgo | Arreglo | Comprobado |
|---|---|---|
| H1 notas sin nombre en la Tabla | `chiefComplaintText` vacío cae al tipo de nota y, si tampoco hay, «Nota clínica» | `tabla-1440.png` |
| H2 registros bajo una fecha que no es la suya | cada tarjeta muestra su fecha propia cuando difiere de la columna («Inicio 23 sept 2025», «Desde 8 oct 2026») | `recorrido-1440.png`, `recorrido-390.png` |
| H3 no abre por el final | apertura sin animación y pegado al final ante cambios de tamaño hasta que la persona se mueve; se quitó `scrollbar-gutter`, que reservaba 15 px vacíos | medido: `scrollLeft` 1724 de 1724 al abrir; al redimensionar sigue al final; tras moverse la persona, respeta su posición. Las capturas de página completa de Chromium vuelven el lienzo al inicio: por eso las del recorrido son de ventana |
| H4 teléfono ilegible | por debajo de 650 px el recorrido es vertical, lo más reciente arriba, con la indicación en texto («Para Hipertensión…») | `recorrido-390.png` |
| H5 detalle a medio fundido | captura tomada con el modal asentado | `recorrido-abre-detalle.png` |
| M1 líneas sobre los rótulos | rótulo con fondo y por encima de la capa de líneas | `recorrido-768.png` |
| M2 nombres cortados | tarjeta de 248 × 86 px, nombre en dos renglones | `recorrido-1440.png` |
| M3 grupo abierto atenuado | el control de grupo no ilumina camino | prueba de componente |
| M4 «Sin registrar» como dato | se omite | `recorrido-1440.png` |
| M5 filtro sólo dicho en la Tabla | el aviso también en Recorrido | — |
| M6 chips cortados sin señal | borde derecho desvanecido en angosto | — |

Sin cambio: M7 (no hay captura previa de «Secciones»: la regresión la cubren las pruebas y el recorrido
de pestañas, alta y menú de arriba), M8 (las «mg» de los signos vitales vienen del dato simulado, ya
existía), M9 (la columna «Ver» en el PDF ya pasaba en todas las tablas del expediente).

`visual-reviewer`, segunda vuelta: **FAIL por puntuación** (82/100, 0 HIGH; los 5 HIGH anteriores,
resueltos). Corregido después:

| Hallazgo | Arreglo | Comprobado |
|---|---|---|
| N1 fecha propia contra el borde | formato corto («Desde 8 Oct»; de otro año, «Inicio Sept 2025»), la posología cede primero, `overflow: hidden` en la tarjeta; la fecha entera en el título y en el nombre accesible | `recorrido-camino-resaltado.png` |
| N2 leyenda en vertical | la barra entera (leyenda y saltos) sólo en horizontal | `recorrido-390.png`, prueba de componente |
| N3 ancho → angosto → ancho | se fija al final cada vez que se crea un lienzo; el ajuste propio no se confunde con un desplazamiento de la persona | medido: al abrir 1724/1724, al volver a ancho 1724/1724 |
| N4 color del estado | el estado usa la regla de la tabla (`estadoTono ?? 'info'`) | `recorrido-1440.png`, prueba de componente |
| N5 estados y consola | `tabla-filtro-oculta-todo.png`; `consola-y-red.txt`: 0 errores de consola, 0 peticiones fallidas o ≥ 400 en el expediente (un aviso NG0505 de hidratación, propio de `ng serve` sin SSR) | — |
| N6, N7 capturas viejas o a medio animar | rehechas | `recorrido-sin-chip-atenciones.png`, `secciones-sin-cambios-1440.png` |
| M3, M5 sin evidencia | grupo abierto con teclado y el puntero fuera: 0 nodos atenuados; aviso «Filtrado: no se muestran atenciones.» en Recorrido | `recorrido-grupo-abierto.png`, `recorrido-sin-chip-atenciones.png` |

Encontrado al rehacer las capturas, y más grave que lo anterior: con «Atenciones» filtrado, la curva
Hipertensión → Enalapril pasaba por detrás de Atorvastatina y parecía salir de ella. Las indicaciones
entre columnas ahora van por un recorrido ortogonal por los huecos; una prueba comprueba que no cruza
ninguna tarjeta (`recorrido-sin-chip-atenciones.png`).

Sin cambio: N8 (mayúsculas de los meses: las cabeceras siguen la regla de las tablas de `dev`), N9
(dos momentos del mismo día cuando uno es atención y el otro no), N10 (la tabla apilada en teléfono es
el comportamiento de `app-data-table`). Los estados de carga y error los resuelve
`app-view-state-host`, compartido; no se capturaron.

`visual-reviewer`, tercera vuelta: **FAIL** (88/100, 1 HIGH). Corregido después:

| Hallazgo | Arreglo | Comprobado |
|---|---|---|
| H-1 dos indicaciones comparten trazo | cada indicación tiene su carril: bajada, cruce y curva propios | prueba «con dos indicaciones, cada una va por su propio carril» |
| M-1 cruce a 4 px de las tarjetas | separación entre filas de 20 px; el cruce queda a 6 px o más | prueba «el cruce deja al menos 6 px de aire» |
| M-2 el recorrido ortogonal no se ve entero | captura del plano entero con «Atenciones» filtrado (para tomarla, el script quita el recorte del lienzo; el menú lateral fijo tapa el borde izquierdo) | `recorrido-sin-atenciones-entero.png` |
| M-3 la red no estaba registrada | `consola-y-red.txt` lista las 356 peticiones del expediente con su estado: 0 fallidas, 0 ≥ 400. Las llamadas a la API las responde el backend simulado dentro de Angular y no pasan por la red | `consola-y-red.txt` |
| L-1 fecha de otro año sin día | en vertical, siempre la fecha entera; con menos de 90 días de diferencia, con día aunque cambie el año | — |

**No se pudo capturar en navegador el caso de dos indicaciones.** Para crear la segunda hace falta
prescribir desde el expediente indicando un diagnóstico, y el formulario sólo ofrece «Otro motivo»:
`medication-block` filtra los diagnósticos por `confirmadoEl`, y `patient-chart` no se lo pasa
(`diagnosticosParaReceta`). Es un defecto de `dev` ajeno a este cambio; se reporta aparte. El caso
queda cubierto por la prueba de geometría.

Sin cambio: L-2 (corchete en la misma columna y poligonal entre columnas: misma línea punteada y
misma flecha), L-3 (el chip apagado es de la primitiva `app-chip`; el aviso en texto lo compensa),
L-4 (carga y error, de `app-view-state-host`).

`visual-reviewer`, cuarta vuelta: **FAIL** (84/100, 1 HIGH). El arreglo de la tercera era un
desplazamiento por módulo (`carril % 3` para el cruce y `% 4` para la bajada): con cuatro indicaciones,
dos volvían a compartir 648 px de recta. Rehecho de raíz:

| Hallazgo | Arreglo | Comprobado |
|---|---|---|
| N-1 cuatro indicaciones comparten cruce | asignación real de carriles: cada indicación que cruza sobre una fila tiene su altura (8 px de aire con las tarjetas, 7 px entre carriles) y el hueco sobre la fila crece si hacen falta más; los tramos verticales se asignan por pasillo con coloreo de intervalos, y el pasillo se ensancha si no entran | prueba de propiedad sobre todas las aristas de cuatro escenarios (1, 4, 7 indicaciones, con corchetes y una hacia atrás): ningún par de distinto diagnóstico comparte un tramo a menos de 6 px y ningún tramo pasa a menos de 4 px de una tarjeta ajena. **Prueba de sabotaje:** con todas las indicaciones forzadas al mismo cruce, fallan las tres pruebas de varias indicaciones |
| N-2 cruces que parecen empalmes | halo del color del lienzo bajo cada indicación: en un cruce, la línea de abajo queda cortada y se lee como puente | `geometria-cuatro-indicaciones.png` |
| N-3 la prueba no alcanzaba | la prueba recorre las aristas que asigna `ubicarRecorrido`, no carriles puestos a mano | ver arriba |
| N-5 hacia atrás pisaba la rama de la atención | ahora sale por la derecha del diagnóstico, como las demás, y entra por la derecha de la receta | prueba «una receta anterior a su diagnóstico…» |

`geometria-*.png` **no son capturas de la pantalla**: dibujan en Chromium las tarjetas y los trazos
que devuelve `ubicarRecorrido` (el mismo módulo, empaquetado con esbuild) para 4 y 7 indicaciones,
que no se pueden crear desde la interfaz (ver arriba). Las demás capturas se rehicieron sobre la
app con este commit.

Sin cambio: N-4 (la captura entera se toma sin el recorte del lienzo; el menú lateral fijo tapa el
borde izquierdo).

`visual-reviewer`, quinta vuelta: **FAIL** (82/100, 1 HIGH; N-1, N-2 y N-5 resueltos según sus
fuzzers de miles de planos). Corregido después:

| Hallazgo | Arreglo | Comprobado |
|---|---|---|
| H-1 la punta de una flecha que entra por la derecha cae sobre la línea de otro diagnóstico | el pasillo empieza a 18 px de la tarjeta (la punta mide ~14) | prueba nueva de la caja de cada punta; **sabotaje** (pasillo a 8 px): fallan 2 pruebas. Con los fuzzers del revisor (`f4.cjs`, 3000 planos): 0 casos (antes 706 planos) |
| M-1 el halo opaco sobre carriles tintados | sin bandas tintadas: el halo es del color del lienzo en los dos temas | `recorrido-camino-resaltado.png`, `recorrido-oscuro-indicacion.png` |
| M-2 la última línea a 8 px del tronco | 12 px de aire con el tronco, y el pasillo se ensancha antes | prueba nueva (≥ 8 px de cualquier tronco); `f3.cjs`: 0 casos (antes 1155) |
| M-3 convergencia hacia un «+N» | se acepta y se declara: el nodo de grupo reúne varias recetas, y varias flechas hacia él dicen «algunas de éstas son para estos diagnósticos». La prueba la permite sólo hacia un grupo | prueba «hacia una celda agrupada convergen en su «+N» y en nada más»; en `fuzz.cjs`/`f2.cjs` sólo quedan convergencias de un mismo origen o hacia un grupo |
| L-1 la prueba no veía puntas ni troncos | `verificarTrazado` comprueba ambas | ver arriba |

Sin cambio: L-2 (las imágenes `geometria-*.png` siguen sin atenciones ni tema oscuro; el halo y el
oscuro se comprueban en las capturas de la app).

Capturas: `capturas/recorrido-clinico/`.

## WEB-F0 · Ficha de organización y vecinos — 2026-10-30

> Medido en la rama de F0 sobre `dev`. En la rama para `test`
> (`claude/trusting-hawking-q3p12v-test`, cherry-pick de los 10 commits) los gates se
> volvieron a correr y están en la descripción de su PR; las capturas de abajo son de la
> rama de F0 y no se rehicieron sobre `test`.

Entorno: contenedor Linux · Node 22.22 · Yarn 4.18 (corepack, `COREPACK_NPM_REGISTRY` a npm) ·
`ng serve --port 4310` · backend simulado · Chromium 1243 (`PW_CHROMIUM_PATH`) · cuenta
`superadmin@alovida.mock`.

| Comando | Resultado |
|---|---|
| `yarn lint` | exit 1 · 258 errores; base 256. Los 2 nuevos se corrigieron (`f1b27a86`); el `eslint` de los archivos tocados sólo marca `tutorial.engine.spec.ts:33`, preexistente |
| `yarn typecheck` | exit 0 |
| `yarn build` | exit 0 · inicial 1,29 MB / 363 kB transferido · avisos de presupuesto (inicial 667 kB > 620 kB y CSS > 4 kB), no se midió la base |
| `yarn test` (completo) | exit 1 · 7 563 ✅ · 5 ❌. Aislados: 3 deterministas **iguales en la base `8c695ed5`** (`fichas-estandar`, `pestanas-del-perfil-medico`, `appointment-calendar`); 2 (`diagnosis-block`, `documentos-legales`) pasan solos: dependían de la memoria saturada (Playwright + `ng serve` en paralelo). Los 9 de work-history/instituciones citados antes no aparecieron |
| Specs tocados (12 archivos) | verdes; **kill-test**: los mismos specs sobre la base `8c695ed5` → 131 rojos, entre ellos todas las pruebas nuevas |
| `E2E_BASE_URL=http://localhost:4310 yarn pw playwright/infra-f0-ficha-organizacion.spec.ts` | **8/8** (24,8 s) |

Medido en el navegador (spec nuevo): sin desborde horizontal en 1440/768/390 en los seis estados;
tarjeta centrada (holgura ≤ 2 px) y ≥ 85 % del área (§5); la plantilla no muestra uuid; «Asignar
sede» → relectura muestra la sede → **F5** → la sede sigue asignada; sin `pageerror`.

Capturas: `capturas/infra-f0/` — `listado-*`, `ficha-{ready,ready-plantilla,forbidden,not-found,error,vacio}-{1440,768,390}.png`,
`ficha-asignar-sede-1440.png`.
