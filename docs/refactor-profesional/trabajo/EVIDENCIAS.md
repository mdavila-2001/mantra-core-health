# Evidencias

## Portada del médico y «Mis verificaciones» · 2026-11-01

Rama `claude/dazzling-shannon-cl1uug`. Maqueta (`ng serve --configuration development,demo`), Chromium,
cuentas `medico.nuevo@alovida.mock` (alta a medias) y `medica@alovida.mock` (alta completa).
Capturas en `evidencias/portada-medico/` (oscuro y claro a 1440, oscuro a 390).

| Qué se midió | Resultado |
|---|---|
| Portada con alta a medias | Anillo «2/5», «Complete su perfil para recibir pacientes», botón «Completar mi perfil» → `/onboarding` |
| Portada con alta completa | Sello de AloVida en lugar del anillo; sin aviso |
| Atajos | 4 (`schedule`, `medical-records`, `my-primary-patients`, `messaging`), 2×2 desde 40rem, 1 columna a 390 |
| «Mis verificaciones» | Clic en la portada → `/my-account/verifications`; hoja de ruta con barra de avance e íconos en los botones |
| Desborde a 390 px | `scrollWidth` = 390 en las dos cuentas |
| Errores de página | Ninguno |

Pruebas: `ng test` sobre `dashboard/**`, `my-verifications/**` y `admission-status-card/**` → 15 archivos,
162 pruebas en verde (las dos `adt/*.spec.ts` que ya no compilan en `dev` se apartaron sólo para la corrida).
Contra la API real no se ejecutó. Revisión independiente: **pendiente** — quien implementa no aprueba.

## Modales fuera de la consulta: pie, fechas y campos sueltos · 2026-10-30

Entorno: Linux, `yarn start:demo` en `http://localhost:4300`, Chromium, base `dev` en `c5f2363f2`.
`playwright/modales-fuera-de-consulta.spec.ts` abre 31 modales con los seis usuarios del simulador, en
1440 y 390, y mide columnas de campos, hueco a la derecha del último campo y desborde lateral.

| Comprobación | Resultado |
|---|---|
| Medidas antes/después (31 modales × 2 anchos) | Cambian sólo los tres tocados a propósito: historial (1→2 columnas, hueco 16→0), nuevo lugar (hueco 16→0), confirmar diagnóstico (1→2 columnas). El resto, idéntico. |
| Página «Trayectoria» (aloja el modal del historial) | idéntica píxel a píxel a la de `dev` |
| Regresión propia encontrada y corregida | `.historial__periodo` chocaba con la clase de la lista; renombrada a `.historial__rango` (`a816bb592`) |
| `yarn test` completo, por tramos (el proceso entero muere con 129 en este entorno) | 15 586 pasan, 3 fallan; las 3 fallan igual con el código de `dev` (`standard-sheets`, `pdf-theme`, `follow-up-block`) |
| `yarn typecheck` · `yarn build` · `eslint` de las pruebas | 0 · 0 · 0 |
| `check-contrast` · `check-css-tokens` | 0 · 0; `check-colores-sueltos` falla en archivos no tocados |

**Los que no se habían podido abrir (30/10/2026, segunda vuelta).** Los botones habían cambiado
de lugar: transacciones y cuentas viven dentro de «Registros», las encuestas son una lista con su
«Abrir», el mostrador es `agenda-ingreso-mostrador` y la aprobación parcial se pide desde el
detalle. Abiertos los cinco en 1440 y 390: mostrador, nueva cuenta, nueva transacción y aprobar
parcialmente están bien y no se tocan. «Editar la pregunta» era el único con los botones dentro
del cuerpo y «Listo» a la izquierda: pasan al pie (`antes-despues-editar-pregunta.png`); en
teléfono «Cancelar» y «Listo» bajan juntos. Medidas de los tres usuarios antes/después: sólo
cambian los modales ya corregidos. `ng test` de encuestas: 144/144. Capturas: `capturas/antes/modales-2026-10-28/` y
`capturas/despues/modales-2026-10-28/antes-despues-*.png`.

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

## Formulario de receta: los diagnósticos confirmados — 2026-10-30

Defecto: el formulario de receta (`medication-block`) sólo ofrece diagnósticos confirmados, y ni el
expediente ni «Atención» le decían cuáles lo estaban (`diagnosticosParaReceta` no pasaba
`confirmadoEl`). El selector quedaba siempre en «Otro motivo». Además la lista de recetas no recibía
su vínculo (`vinculo`, `vinculoEsDiagnostico`): no mostraba para qué era cada una y ofrecía «Vincular»
aunque ya estuviera atada. Arreglo: `diagnosticoParaReceta` y `vinculoDeReceta`, en
`medication-block.ts`, usados por las dos pantallas.

Entorno: base `origin/dev` (`d6f3462e3`) · `ng serve --configuration development,demo` · Chromium ·
`medica@alovida.mock`, paciente `pid-paciente`.

| Comando / prueba | Resultado |
|---|---|
| `tsc -p tsconfig.app.json` · `eslint` de `patient-chart/` y `consultation/` | 0 · 0 |
| `ng test --include='…/clinical-record/**/*.spec.ts'` | 39 archivos; 1 prueba roja preexistente (`follow-up-block`, «el calendario pinta de verde…»: roja también sin este cambio). Nuevas: 9 en `indicacion-de-receta.spec.ts`, 1 en `medication-block.spec.ts`, 2 en `patient-chart.spec.ts` |
| `yarn test` completo | **no se ejecutó** |
| UI → alta → lista → salir y volver → tabla y Recorrido | el selector ofrece «Hipertensión arterial esencial · Confirmado»; Losartán prescrito para ese diagnóstico (con el aviso de interacción con Enalapril aceptado); la lista lo muestra con «Diagnóstico: Hipertensión arterial esencial»; tras salir y volver, la tabla de Medicación lo trae atado a Hipertensión y el Recorrido dibuja dos indicaciones; 0 errores de consola. El backend simulado vive dentro de Angular: la petición no pasa por la red |

Capturas: `capturas/receta-diagnostico/`. «Atención» usa el mismo ayudante; no se probó en navegador.

## WEB-F0 · Ficha de organización y vecinos — 2026-10-30

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

### WEB-F0 · integración de `origin/dev` (merge, 2026-10-30)

`git merge origin/dev` sobre `85c8cee5` (25 conflictos). Criterio: se conserva lo de `dev` y se
reaplica sólo lo propio de F0; donde `dev` ya lo resolvía igual, gana `dev` (pantalla
`my-organizations` borrada y trasladada a la pestaña «Mis vinculaciones», su redirección con
`?tab=memberships`, el buscador de personas `people-search` que ya no traga errores). Textos de F0
pasados al «usted» que `dev` adoptó.

| Comando | Resultado |
|---|---|
| `yarn lint` | exit 0 |
| `yarn typecheck` | exit 0 |
| `yarn build` | exit 0 · avisos de presupuesto, ninguno de los archivos tocados |
| Specs en conflicto o tocados por F0 (17 archivos) | verdes |
| Suite completa, por tramos (`ng test` entero muere con un *deadlock* de esbuild en este contenedor) | 1 096 archivos · 3 rojos, **los tres iguales en `origin/dev`** (`standard-sheets`, `pdf-theme`, `follow-up-block`) |

`schedule-change.spec.ts` (de `dev`) dependía del `|| true` que F0 quitó del simulador: pedía la
agenda de la clínica con la organización «Mi consultorio». Se le pone la organización dueña de esa
agenda y el simulador de prácticas; la aserción no cambia. Navegador: **no se re-ejecutó** el spec
de Playwright tras el merge.

## Infraestructura F1 (web) — 2026-10-30

Entorno: contenedor Linux · Node 22.22 · Yarn 4.18 (corepack) · `ng serve --port 4371` · backend simulado ·
Chromium 1243 del sistema (`PW_CHROMIUM_PATH`, sin red para `playwright install`) · cuenta
`superadmin@alovida.mock`, tenant «Hospital San Lucas». Rama `infra-f1-web`.

| Comando / prueba | Resultado |
|---|---|
| `yarn lint` | exit 1 · **256 errores, los mismos 256 de la base** (`8c695ed5`); 0 en archivos tocados |
| `yarn typecheck` | exit 0 |
| `yarn build` | exit 0 · ningún CSS nuevo pasa el presupuesto de 4 kB |
| `ng test` de lo tocado (infraestructura, consola, `app-tree`, maqueta, view-state-host) | 11 archivos · todos verdes |
| `yarn test` completo | 596/600 archivos · 7 630/7 634 pruebas · 4 rojas **ajenas**: `fichas-estandar`, `appointment-calendar` (fecha), `pestanas-del-perfil-medico` — rojas también en la base —, e `insurance-analytics.handlers` — verde aislada en la rama y en la base: depende del orden de la corrida |
| `check-client-prefixes` / `check-route-prefixes` | los 23 endpoints nuevos ruteados (proxy, docker, nginx); 1 rojo previo ajeno (`CommunityClient`) · 242 rutas sin colisión |
| `check-architecture` | rojo previo ajeno (3 ciclos en fixtures/agenda, 1 capa, 1 red); nada de F1 |
| `E2E_BASE_URL=… yarn pw infra-f1-infraestructura --workers=1` | **6/6** (2,7 min) · 1440 / 768 / 390 |

Mediciones del navegador (`evidencias/infra-f1/resultados.json`):

| Qué | 1440 | 768 | 390 |
|---|---|---|---|
| Desborde horizontal en árbol, ficha (5 pestañas) y Establecimiento | 0 | 0 | 0 |
| Regla 6, ficha: holgura izq./der. y ancho vs. `.app-main__inner` | 0 / 0 · 100 % | 0 / 0 · 100 % | 0 / 0 · 100 % |
| `aria-level` de «Cama 301-A» (6.º nivel) | 6 | 6 | 6 |
| Alta: POST `/sites/:id/care-spaces` → 201 → persistido en `mock.infra.espacios` → F5 → la ficha lo muestra | sí | sí | sí |
| Edición: PATCH `/care-spaces/:id` con `If-Match: 1` → 200 → F5 → nombre nuevo | sí | sí | sí |
| Errores de consola fuera del CSP de `/auth` (previo) | 0 | 0 | 0 |

La cadena se lee del registro de escrituras de la maqueta (`sessionStorage['mock:registrar']`, nuevo y apagado
por defecto): la maqueta responde dentro de Angular y Playwright no ve red. **Contra la API real no se ejecutó**
(otra franja).

Capturas (`evidencias/infra-f1/`, 66): árbol físico expandido y organizativo; ficha en sus 5 pestañas; alta (pasos
1 y 2, creada tras recarga), edición; alta masiva con vista previa y códigos repetidos; importación con errores de
forma, dry-run con errores por línea y confirmada; retiro bloqueado con la lista y su próxima acción;
Establecimiento con brechas y habilitación vencida; S3, S5, S6, S9 con `mock-fallo` y S9 de la consola una sola vez.

Hallazgo previo, no de F1: en las capturas de página completa a 1440/768 el riel de navegación se dibuja encima
del borde izquierdo del contenido; pasa igual en `capturas/recorrido-clinico/recorrido-1440.png` (anterior).

Revisión independiente (`visual-reviewer`, `frontend-reviewer`, `regression-auditor`): **pendiente**.

### Infraestructura F1 · integración de WEB-F0 + `origin/dev` (merge, 2026-10-30)

`git merge claude/trusting-hawking-q3p12v` (que ya trae `origin/dev`), 8 conflictos. Criterio: lo de
`dev` y F0 se conserva; de F1 sólo lo suyo.

- En paralelo, `origin/infra-f1-web` recibió otro merge de `dev` (`b7e9c3d0`, 26 commits más nuevo).
  Se integró con un segundo merge y, en los siete archivos donde las dos resoluciones chocaban
  (proxies, `view-state-host`, consola, ficha de espacio, simulador de infraestructura), **gana la
  de `b7e9c3d0`**: `ofrecerEscritura` sólo con roles, la propiedad del simulador por el primer tenant
  de la cuenta y `enlace(ruta, queryParams)`.
- Consola: pestañas por clave (`PESTANAS`) e Infraestructura/Establecimiento de F1, con el selector
  `app-select` y la pestaña `MembershipsTab` de `dev`; el estado M34 queda en `app-view-state-host`.
- Simulador: `GET /practices` filtra por tenant (F1) y suma siempre los centros de CM-07 (`dev`).

| Comando | Resultado |
|---|---|
| `yarn lint` | exit 0 |
| `yarn typecheck` | exit 0 |
| `yarn build` | exit 0 |
| Specs de F1 y de los archivos en conflicto (16 archivos) | verdes |
| Suite completa, por tramos (tras los dos merges) | 1 116 archivos · 3 rojos, **los tres iguales en `origin/dev`** (`standard-sheets`, `pdf-theme`, `follow-up-block`) |

Las cifras de arriba son del árbol `4a7ad084`. Después, `origin/infra-f1-web` recibió otro merge de `dev`
(`c8071f27`, con WEB-F0 ya en `dev` por #1717); el tercer merge sólo aporta esta nota, el comentario de
`GET /practices` y los dos textos del e2e, y sobre él se corrieron `yarn typecheck` y `yarn lint`.

Navegador: **no se re-ejecutó** `infra-f1-infraestructura.spec.ts` tras el merge (se actualizaron dos
textos al «usted» de `dev`). Los textos propios de F1 siguen en voseo: pendiente pasarlos.

## Infraestructura F4/F5 (web) — 2026-10-31

Entorno: contenedor Linux · Node 22 · Yarn 4.18 (corepack) · backend simulado (`ng build --configuration
development,demo` servido estático en `127.0.0.1:4373`, ver nota) · Chromium 1243 del sistema (`PW_CHROMIUM_PATH`) ·
cuentas `quirofano@alovida.mock` (jefatura de quirófano), `facturacion@alovida.mock` y `superadmin@alovida.mock`,
tenant «Hospital San Lucas». Rama `infra-f4f5-web` (desde `origin/dev` con F0 y F1).

| Comando / prueba | Resultado |
|---|---|
| `yarn lint` | exit 0 |
| `yarn typecheck` (app + cypress + playwright) | exit 0 |
| `yarn build` (bajo `flock`) | exit 0 · avisos de presupuesto previos; ningún CSS de esta rama pasa los 4 kB · `dist/` borrado |
| `ng test` de lo tocado: reglas y clientes de quirófano y facturación, maqueta F4, pantallas F4 (`interventions.f4.spec`), pantallas F5 (`bed-day-charges.spec`), `resource-timeline`, catálogo de servicios, ficha de espacio, `mock-backend`, acceso delegado | 24 archivos · **201/201** (+ 4 archivos · 51/51 de reglas, clientes y maqueta F4) |
| `check-client-prefixes` | los 13 endpoints nuevos ruteados en los tres proxies; quedan 14 rojos **previos ajenos** (`AdmissionsClient`, `InsightsClient`) |
| `check-route-prefixes`, `check-css-tokens`, `check-english-identifiers`, `check-tokens` | exit 0 |
| `check-architecture`, `check-usted`, `check-max-lines`, `check-colores-sueltos`, `check-mock-vs-client`, `check-api-prefixes` | exit 1 **previo**: ningún hallazgo en archivos de esta rama |
| `playwright test playwright/infra-f4f5.spec.ts --workers=1` | **12/12** (4,1 min) · 1440 / 768 / 390 + cadenas a 1440 |

Nota de entorno: `ng serve` fue matado por el OOM del cgroup compartido cuatro veces (dmesg: `Memory cgroup out of
memory: Killed process … (ng serve --conf)`) mientras otro agente tenía su propio `ng serve` y la API en memoria. Se
usó el mismo build de desarrollo con la maqueta (`development,demo`) servido como estático, bajo
`flock /tmp/claude-0/heavy.lock`. La spec no espera `networkidle` y vale igual contra `ng serve`.

Mediciones (`evidencias/infra-f4f5/resultados.json`):

| Qué | 1440 | 768 | 390 |
|---|---|---|---|
| Desborde horizontal: lista, agenda, bloques, utilización, ficha, programar, tarifas, equipo | 0 | 0 | 0 |
| Regla 6 (holgura izq./der. y ancho vs. `.app-main__inner`): agenda, bloques, ficha del caso, programar, ficha de equipo | 0 / 0 · 100 % | 0 / 0 · 100 % | 0 / 0 · 100 % |
| La lista muestra «QX-0n · Quirófano n», nunca un uuid | sí | sí | sí |
| Errores de consola | sólo los 10 provocados (S6 ×3, S9 ×3, S8 ×3, el 409 de la cadena) | | |

Cadenas UI → petición → respuesta → persistencia → recarga → UI (registro de escrituras de la maqueta, ahora con el
cuerpo de la respuesta):

| Mutación | Petición | Respuesta | Persistencia | Tras recarga |
|---|---|---|---|---|
| Programar caso (QX-02, sábado 08:00–10:00) | `POST /procedure-cases` | 201 · `reservedStartAt/EndAt` 07:40–10:30 | `mock.procedures.casos` | la ficha muestra «07:40–10:30» |
| Programar en la limpieza del anterior (10:30) | `POST /procedure-cases` | 409 `OPERATING_ROOM_SLOT_CONFLICT` · `correlationId req-periop-…` · `nextAvailableStartAt` 10:50 | — | S4 con «Usar la próxima ventana libre (10:50)» |
| Check-list OMS: crear + Entrada + Pausa + Salida | `POST …/safety-checklists`, 3 × `POST …/responses` | 201 cada una | `mock.periop.checklists` (`completedAt` de las 3 fases) | fases completas |
| Tiempos de sala en orden (5) con gates | 5 × `POST …/room-events` | 201; antes de la Pausa la incisión queda deshabilitada con su porqué | `mock.periop.roomEvents` | línea de tiempo con 5 eventos |
| Ubicar el ecógrafo en la sala de rayos X | `PATCH /diagnostic-equipment/:id {careSpaceId}` | 200 | `mock.infra.equipment` | la pestaña «Equipos» de IMG-RX lo lista |
| AE Title (17 caracteres → rechazo en la UI; `SLUS01`) | `PATCH /diagnostic-equipment/:id {aeTitle, stationName}` | 200 | `mock.infra.equipment` | MWL: `SLUS01` · `ECO-PB` · `IMG-RX` |
| Devengar día-cama (ingreso −4 d 15:00, traslado −3 d 10:00, egreso −1 d 09:00) | `POST /billing/encounters/:id/bed-day-charges/run` | 201 · 3 cargos (compartida, privada, privada) | `mock.billing.chargeCaptures` | 3 claves `BEDDAY:<enc>:<fecha>`; re-ejecutar: 0 nuevos, 3 omitidos |

Estados M34 capturados: S3 (bloques de una semana vacía → «Crear bloque»; ficha sin check-list; día sin cargos), S4
(conflicto de ventana; AE Title), S5 (facturación en Bloques; facturación en Programar, en Vitest), S6 (caso
inexistente u otro tenant), S7 (hora del dato visible en agenda y utilización; el paso a «atrasado» a los 5 min se
probó en código, no se capturó), S8 (agenda sin conexión), S9 (utilización con `mock-fallo`). S1/S2 son transitorios:
no se capturaron.

Capturas (`evidencias/infra-f4f5/`, 69): 01–13 F4 (lista, agenda, bloques y alta, utilización, ficha en Resumen /
Check-list / Eventos, programar, S6, S9, S8, S3) y 20–32 F5 (tarifas, día-cama, S5, espacio con Equipos y Stock,
ficha de equipo) en los tres anchos; 40–62 las cadenas a 1440.

Hallazgo previo, no de esta rama: en las capturas de página completa a 1440/768 el riel de navegación se dibuja encima
del borde izquierdo del contenido (igual que en `evidencias/infra-f1/`).

**Contra la API real no se ejecutó** (A-F4/A-F5 en otra ola). Revisión independiente: **pendiente**.

## Infraestructura F4/F5 — segunda pasada (web) — 2026-10-31

F5b (puntos de toma), F5d (agenda con consultorio), F5f (activos y centros de costo por espacio y unidad), cargo de
quirófano por tiempo y recambio `CLEANUP_*`. Mismo entorno que la primera pasada (build `development,demo` servido
estático en `127.0.0.1:4373` bajo `flock`, Chromium 1243 del sistema). Cuentas: `medica@alovida.mock`,
`quirofano@alovida.mock`, `facturacion@alovida.mock`, `superadmin@alovida.mock`; tenants «Hospital San Lucas» y
«Clínica Los Olivos» (aislamiento).

| Comando / prueba | Resultado |
|---|---|
| `yarn lint` | exit 0 |
| `yarn typecheck` (app + cypress + playwright) | exit 0 |
| `yarn build` (bajo `flock`, `NODE_OPTIONS=--max-old-space-size=6144`) | exit 0 (105,9 s) · sólo avisos previos (NG8113/NG8102 de pantallas ajenas) · `dist/` borrado |
| `ng test` de lo tocado, en 4 tandas (el lote único murió con `ERR_WORKER_OUT_OF_MEMORY` del cgroup compartido) | 19 archivos · **480/480** (maqueta y reglas 98 · clientes y reglas de data-access + `resource-timeline` 151 · diagnóstico, contabilidad de infraestructura, pedido de estudios, quirófanos, día-cama 65 · alta de horario y mi agenda 166). La primera corrida de la tanda de maqueta dio 1 rojo en la prueba de cierre del caso mientras se le agregaban las aserciones de 404/403/412; vuelta a correr con el archivo final: 98/98, y 4 archivos · 36/36 con el S3 nuevo de contabilidad |
| `check-client-prefixes` | `/sample-collection-points` (bajo `/sites`), `/accounting/*` y `/cleaning-orders` ruteados en los tres proxies; quedan 14 rojos **previos ajenos** (`AdmissionsClient`, `InsightsClient`) |
| `check-route-prefixes`, `check-css-tokens` | exit 0 |
| `check-english-identifiers` (contra `origin/test`) | exit 1: los hallazgos son de la primera pasada ya commiteada (`or-agenda` —«agenda» también es inglés—, el texto de prueba «Bloque quirúrgico») y los `data-testid` `agenda-create-room*` (prefijo del componente existente `agenda-create`). Esta pasada renombró `FechasDelCaso`, `conSala`, `el`, `puntoDeToma` y `estudios-punto-de-toma` (`CaseDateField`, `withRoom`, `host`, `collectionPoint`, `study-collection-point`) |
| `check-max-lines` | exit 1 **previo**: los siete archivos que ya pasaban su techo congelado siguen pasándolo (`scheduling.handlers` +10, `diagnostics.handlers` +12, `scheduling.types` +10, `agenda-create.ts` +6, `analysis-order-block.ts` +9, `app.routes` +4, `scheduling.client` +2 líneas); no se subió ningún techo y los archivos nuevos están por debajo de 600 |
| `check-architecture`, `check-usted`, `check-colores-sueltos` | exit 1 **previo**: ningún hallazgo en archivos de esta pasada |
| `playwright test playwright/infra-f5-integracion.spec.ts --workers=1` | **12/12** (2,5 min, corrida final tras renombrar `puntoDeToma`/`estudios-punto-de-toma` a inglés; la anterior, 12/12 en 2,9 min) · 1440 / 768 / 390 + 3 cadenas a 1440 |

Mediciones (`evidencias/infra-f5-integracion/resultados.json`):

| Qué | 1440 | 768 | 390 |
|---|---|---|---|
| Desborde horizontal: cola del laboratorio, activos/centros de costo, alta de horario | 0 | 0 | 0 |
| Regla 6 en `/administration/accounting/infrastructure` (holgura izq./der. · ancho) | 0 / 0 · 100 % | 0 / 0 · 100 % | 0 / 0 · 100 % |
| La cola muestra «LAB-TM1 · Toma de muestras 1» / «LAB-TM2 …», nunca un uuid | sí | sí | sí |
| Errores de consola | 6, todos provocados: S9 ×3 (`mock-fallo` en activos), el 409 de la cadena F5f y 2 × 403 de «Cargos» para la jefatura (sólo facturación los lee → S5) | | |

Cadenas UI → petición → respuesta → persistencia → recarga → UI (registro de escrituras de la maqueta):

| Mutación | Petición | Respuesta | Persistencia | Tras recarga |
|---|---|---|---|---|
| Pedir Glucosa con punto LAB-TM2 (consulta de la médica) | `POST /clinical/service-requests {…, suggestedCareSpaceId}` | 201 | `mock.clinica.ordenes` (`suggestedCareSpaceId`) | la fila del estudio dice «LAB-TM2» (`31-orden-punto-tras-recarga`) |
| Ubicar la lámpara cialítica AF-0103 en QX-02 con el árbol físico | `PATCH /accounting/infrastructure-items/:id {careSpaceId}` | 200 · `careSpace.path` «Edificio A › … › Quirófano 2» | `mock.accounting.infrastructureItems` | la tabla de activos muestra «Quirófano 2» (`40-…`) |
| Ligar CC-900 a Internación de medicina interna | `POST /accounting/cost-centers/:id/unit-link` | 409 `UNIT_ALREADY_HAS_COST_CENTER` · `correlationId` | — | S4 con el centro que ya tiene (`41-…`) |
| Ligar CC-120 al Bloque quirúrgico | `POST /accounting/cost-centers/:id/unit-link` | 200 · `clinicalUnit` | `mock.accounting.costCenters` | la pestaña «Centros de costo» lo muestra ligado (`42-…`) |
| Cerrar el caso (5 tiempos de sala con la Salida OMS hecha) | 5 × `POST /procedure-cases/:id/room-events` | 201 cada uno | `mock.periop.roomEvents`; el caso pasa a COMPLETADO, se abre la orden de limpieza (`mock.periop.turnovers`) y se devenga `ORTIME:<caso>` | «Eventos de sala» muestra el recambio pendiente (`50-…`) |
| Recambio: iniciar, terminar, sala lista | `POST /cleaning-orders/:id/{start,finish,inspect}` con `If-Match` «1», «2», «3» | 200 · `CLN_IN_PROGRESS` → `CLN_DONE` → `CLN_INSPECTED` (`rowVersion` 2/3/4) | `mock.periop.turnovers` + eventos `CLEANUP_START`, `CLEANUP_END`, `ROOM_READY` | tras recargar, recambio completo (`51-…`) |
| Cargo de quirófano (cuenta de facturación) | `GET /billing/encounters/:id/pending-charges` | 200 · `OR_TIME`, QX-02, fracciones 2 (mínimo), 600.00 BOB, `ORTIME:<caso>` | `mock.billing.chargeCaptures` | pestaña «Cargos» del caso (`52-cargo-quirofano`) |

F5d (consultorio de la plantilla): **la cadena con recarga no se ejecutó en el navegador**. Hay captura del campo en
los tres anchos (`20-agenda-consultorio-*`) y las reglas de la maqueta están en Vitest
(`infra-f5-integration.handlers.spec.ts`: 404 de otro tenant, 422 `TEMPLATE_CARE_SPACE_INVALID_FUNCTION`, 422
`TEMPLATE_RULE_OVERLAP_CARE_SPACE`, 409 `CARE_SPACE_DOUBLE_BOOKED` con dos médicos 15:45–16:15 y 16:00–16:30).

Nota sobre el cargo capturado: dice «Sin centro de costo (la unidad no tiene uno)» porque el ligue CC-120 de la cadena
F5f se hizo en otra pestaña con su propia `sessionStorage`; el camino con centro ligado está en Vitest (`costCenterOfUnit`).
El tiempo en sala del navegador es de 1 min (eventos registrados en segundos) → 2 fracciones por el mínimo; los 95 min →
4 fracciones del criterio de §F5e están en Vitest.

Estados M34 capturados en esta pasada: S4 (409 del centro de costo), S5 («Cargos» para la jefatura), S9 (activos con
`mock-fallo`, tres anchos). S3, S6 y S8 de las pantallas nuevas están en Vitest, no capturados; S1/S2 son transitorios
y S7 no se capturó.

Capturas (`evidencias/infra-f5-integracion/`, 29 + `resultados.json`): 01–02 cola y cola filtrada, 10–13 activos,
árbol, centros de costo y S9, 20 alta de horario con consultorio — en 1440/768/390; 30–31, 40–42 y 50–52 las cadenas a
1440.

**Contra la API real no se ejecutó.** Revisión independiente: **pendiente** — quien implementa no aprueba.

## Infraestructura F4/F5 — tercera pasada: las formas de la API (web) — 2026-10-31

La revisión `frontend-reviewer` de `infra-f4f5-web` dio **CAMBIOS REQUERIDOS**: la web y la maqueta tenían la forma
de la web, no la de la API. Decisión del orquestador: **la API manda las formas**. Se reescribieron tipos, clientes y
maqueta contra `origin/claude/trusting-hawking-q3p12v` (hasta `37c3c6648`, que incluye `3036730d2` F4 y `e46739aaa`
F5a), y se corrió Playwright **contra la API real** (`:3000`, copia `/home/user/api-run`).

| Hallazgo | Arreglo | Prueba |
|---|---|---|
| B1 ficha del caso | Cabecera `toSummary` + `CaseOrViewBuilder` (`operatingRoom`, `block {id,label}`, `caseType {code,display}`); `checklist`, `roomEvents`, `turnoverCleaning` del detalle; ausente ≠ vacío (`checklistReported`); el check-list se lee con el alta idempotente si no viene; la sala se resuelve por `operatingRoomId` | `procedures.client.f4.spec` (formas literales vieja y `3036730d2`), `interventions.f4.spec` «con la API de hoy» ×2, Playwright real |
| B2 utilización | Tipada contra `rooms[]`; `withTotals` usa los `totals`/`asOf` de la API y completa recambio y asignado/liberado | `operating-rooms.rules.spec`, `operating-rooms.client.contract.spec` (con y sin totals) |
| B3 tarifas | `tariffKind`, `currencyConceptId`; `tariffView` resuelto con catálogos; estado por vigencia | `space-billing.client.contract.spec` |
| B4 día-cama | `pending-charges` arreglo, `run → {created[], skipped}`; encuentro elegido de `GET /sites/:siteId/inpatients` o `?encounter=` | `bed-day-charges.spec` (3 pruebas), contrato |
| B5 ficha de equipo | `GET /diagnostic-equipment/:id`, `/resource`, `/mwl-station` (F5a); relee tras el `PATCH` plano; MWL con su estado (no se traga el error) | `bed-day-charges.spec` «ficha de equipo (B5)», contrato |
| H1 bloques | `specialtyConceptId`; rótulo de la API (`owner.label`) o armado con catálogos; `cases` como ids | `operating-rooms.handlers.spec`, `interventions.f4.spec`, contrato |
| H2 `/interventions` | Sala resuelta contra `rooms()` | `interventions.f4.spec` «H2» |
| H3 autorización simulada | Sin compuertas por rol (`canManageBlocks` y demás eliminadas): se pide y el 403 pinta S5 | `interventions.f4.spec` (facturación → S5 desde el 403 en bloques y programar) |
| H4 contexto de sede | `SiteContextStore` con clave `userId|tenant`, `switchMap`, `SESSION_CLEANERS`, 403 → S5, `/practice/infrastructure-access/me` con caída a consolas, selector de sede (`app-site-switch`), personal sólo con `ensureDirectory` | `site-context.store.spec` (5) |
| H5 carreras | `switchMap` por clave en agenda, bloques, utilización, programar, ficha, día-cama, contabilidad, equipo; día-cama compara el encuentro | `bed-day-charges.spec` «H5» |
| H6 claves que la API rechaza | `INFRA_INTEGRATION_FLAGS` apagada: no se manda `suggestedCareSpaceId`, `collectionCareSpaceId` ni `careSpaceId`; el punto de toma se ata a la sede del ejecutante; sin consola por médico | `collection-point-select.spec` (3), `infrastructure-accounting.spec` «H6», Playwright mock F5 (3) |
| M1 If-Match en bloques | Se manda; la API lo acepta desde `3036730d2` (412) | contrato |
| M2 ubicar activo | `If-Match` con `rowVersion` | contrato F5f |
| M3 respuesta del check-list | UUID de concepto → código (`infra-concepts.ts`, UUID v5 recalculados en la prueba) | `infra-concepts.spec` |
| M4 índice de pestañas | `fixedTabCount = PESTANAS_DE_LA_FICHA.length` | `space-detail.spec` |
| M5 stock | `create → {id}`, `relocate → {id, careSpaceId, previousCareSpaceId}`; relee; escritura atenuada a `SECURITY_ADMIN` | contrato |
| M6 F5g | La actualización no ofrece «Espacio» | `org-assignment-update.spec` «M6» |
| M7 pruebas tautológicas | Fixtures literales de las vistas de la API, una spec de contrato por cliente | `*.contract.spec.ts` (3 archivos) |
| M8 `effect` innecesario | Lecturas con `toObservable` + `switchMap` | — |
| LOW | `backend-api.md` con las 33 operaciones; `or-agenda` → `or-schedule`; grilla fuera de la `<ul>` | `check-api-contract-drift` sin hallazgos de esta rama, `resource-timeline.spec` |

| Gate | Resultado |
|---|---|
| `yarn lint` · `yarn typecheck` | exit 0 · exit 0 |
| `yarn build` (`flock`, `NODE_OPTIONS=--max-old-space-size=6144`) | exit 0 (96 s) · `dist/` borrado |
| `ng test` de lo tocado (4 tandas, `flock`) | 22 archivos · **346/346** (52 · 95 · 35 · 164) |
| Playwright maqueta `infra-f4f5.spec.ts` | **12/12** (4,1 min) |
| Playwright maqueta `infra-f5-integracion.spec.ts` | **12/12** (2,4 min) |
| Playwright **API real** `infra-f4f5-real-api.spec.ts` | **2/2** (41 s) |
| `check-route-prefixes`, `check-css-tokens` | exit 0 |
| `check-client-prefixes`, `check-usted`, `check-max-lines`, `check-architecture`, `check-colores-sueltos`, `check-api-contract-drift` | exit 1 **previos**: ningún hallazgo en archivos de esta pasada (los 14 de prefijos son `AdmissionsClient`/`InsightsClient`) |

### Contra la API real (`evidencias/infra-f4f5/real-api/`)

Semilla **sólo por la API**, con nombres F4W: organización `Hospital F4WBDA842` (`register-organization`), práctica,
sede, quirófano `QX-F4W` (prep 20, limpieza 30) y su recurso R0, paciente (`register-patient`), dos profesionales
(`register-practitioner`) con plantilla, membresía, asignaciones F5g y roles, y **relación asistencial aceptada por el
paciente** (es lo que deja programar a un paciente que no tiene huella propia en el tenant). Build
`development,real-api` servido estático con proxy a `:3000`, bajo `flock` y el lock de navegador compartido.

| Paso (UI) | Petición → respuesta | SELECT en Postgres | Tras recarga |
|---|---|---|---|
| Programar CQ-000007 (QX-F4W, 10:00–11:30) | `POST /procedure-cases` → 201 | `reserved 13:40–16:00 UTC`, prep 20, limpieza 30 | cabecera «QX-F4W · Quirófano F4W» (`02`) |
| Check-list: alta + Entrada + Pausa + Salida | `POST …/safety-checklists` → 201; 3 × `…/responses` → 201 | `sign_in/time_out/sign_out_completed_at` = `t t t` | fases completas (`03`) |
| Cinco tiempos de sala, en orden | 5 × `POST …/room-events` → 201; la salida trae `cleaningOrderId` | `OR_RESERVED` + los cinco `OR_EVENT_*`, en orden | línea de tiempo (`04`) |
| Recambio: iniciar, terminar (enfermería) | `POST /cleaning-orders/:id/start|finish` con `If-Match` «1», «2» → 200 | — | `05` |
| Inspeccionar quien limpió | `…/inspect` `If-Match` «3» → **422** `INSPECTION_BY_CLEANER_NOT_ALLOWED` | — | S4 en la ficha (`06`) |
| Inspeccionar otra cuenta (supervisión) | `…/inspect` → 200 `{order, nextOrderId}` | `row_version 4`, `CLN_INSPECTED` | «Lista para el próximo caso», `CLEANUP_START/END`, `ROOM_READY` (`07`) |
| Día-cama | `GET /sites/:siteId/inpatients` → `[]` | — | S3 «La sede no tiene personas internadas ahora» (`08`) |

**No ejecutado contra la API real**: el día-cama idempotente. `POST /clinical/admissions` exige la huella del paciente
en el tenant (membresía propia o una cita que reservó él) y no acepta la relación asistencial; sin SQL no hubo
internación que devengar. Tampoco el cargo de quirófano por tiempo (lo devenga el worker al cerrar el caso con el
informe firmado, que la web no tiene) ni tarifas (no hay ítem de catálogo sembrado por la API en esa práctica).

Hallazgo para A-F4: la sala tiene una orden de recambio abierta a la vez; si quedó la de un caso anterior, la salida de
sala del siguiente devuelve esa `cleaningOrderId` y su detalle trae `turnoverCleaning: null` (se vio en una corrida
previa; la spec opera la orden en la ficha del caso dueño). Consola: sólo los dos errores del 422 provocado.

Revisión independiente: **pendiente** — quien implementa no aprueba.

## Infraestructura F2 + F3 (web): camas, limpieza, internación/ADT, censo e indicadores — 2026-10-31

Entorno: contenedor Linux · Node 22 · Yarn 4.18 · `ng serve --configuration development,demo --port 4380
--watch=false` (maqueta) · Chromium 1243 del sistema (`PW_CHROMIUM_PATH`) · rama local `infra-f2f3-web`
desde `origin/dev` (`7159f4dd4`). Contrato: `SALUD/Arquitectura/infraestructura-hospitalaria/CONTRATO-F2-F5.md`
§F2.4/F2.5 y §F3.4/F3.5; desvíos anotados allí bajo «W-F2F3».

| Comando / prueba | Resultado |
|---|---|
| `yarn lint` | exit 0 |
| `yarn typecheck` | exit 0 |
| `ng test` de lo tocado, en 4 tramos (el `ng test` de un solo golpe muere con el *deadlock* de esbuild de este contenedor) | maqueta (82 + 28 archivos), navegación/rutas/armazón (16), F1 + expediente (46): **172 archivos · 2 635 pruebas verdes**. Antes, 4 rojos propios (secciones nuevas sin subgrupo ni lista de tipos, rutas hijas sin sección, pestaña nueva en la ficha) corregidos actualizando el registro, no la regla. No se corrió la suite completa |
| `yarn build` | exit 0 · avisos de presupuesto previos, ninguno de archivos de F2/F3 |
| `E2E_BASE_URL=… yarn pw infra-f2f3-camas-adt --workers=1` | **10/10** (5,4 min, sobre el código final) · cadena a 1440 + estados a 1440 / 768 / 390 |
| `check-client-prefixes` | los 4 prefijos nuevos ruteados en las tres declaraciones; los 14 rojos restantes son previos (`AdmissionsClient`, `InsightsClient`) |
| `check-api-prefixes` | rojo previo ajeno (`/practice/infrastructure-catalog` sin espacio en nginx), igual en `origin/dev` |
| `check-route-prefixes` · `check-english-identifiers` · `check-usted` (archivos tocados) | verdes |

**Cadena de mutaciones** (`evidencias/infra-f2f3/resultados.json`, corrida final): la maqueta anota cada escritura
(método, ruta, `If-Match`, `If-Match-Ops`, cuerpo, estado, `requestId`) y la prueba lee las filas persistidas
(`sessionStorage`, lo que en la API sería el `SELECT`) antes de recargar.

| Paso (cuenta) | Petición → respuesta | Persistencia leída | Tras recarga |
|---|---|---|---|
| Ingreso con cama (admisión) | `POST /clinical/admissions` → 201 `req-ops-…` | `encounter_locations` ACTIVE en 301-B + evento A20 `AXIS_OCCUPANCY → OCC_OCCUPIED` con el mismo `requestId` | ficha «Cama 301-B»; tablero 301-B = **O** con iniciales |
| Traslado 301-B → 303-A (enfermería) | `POST …/transfer` `If-Match: 1` → 200 | origen COMPLETED/`TRANSFER_OUT`, destino ACTIVE con `previous_encounter_location_id` | 301-B = **H**, 303-A = **O** |
| Limpieza (limpieza) | `start` `If-Match: 1` → 200 · `finish` `If-Match: 2` → 200 | orden `CLN_DONE` | cola «Terminada · falta inspección»; sin datos de paciente |
| Inspección (otra persona) | `inspect` `If-Match: 3` → 200 | orden INSPECTED, `inspected_by ≠ finished_by` | 301-B = **U** (asignable) |
| Egreso (enfermería) | `POST …/discharge` `If-Match: 2` → 200 | encuentro FINISHED, orden `CLN_TRG_DISCHARGE` | ficha «Egresada», movimientos A01/A02·A03; 303-A = **H** |
| Cierre del censo de ayer (supervisión) | `POST …/census/<ayer>/close` → 200 · ajuste → 201 | día CLOSED; ajuste aparte | «Cerrado», ajuste «0 → 2»; el número original se conserva |

Mediciones: regla 6 (tablero, ingreso, ficha de internación) holgura 0/0 y 100 % en los tres anchos; desborde
horizontal 0 en cada pantalla capturada. S1 y S2 se congelaron con el reloj de Playwright a 1440 (tablero y cola);
a 768/390 el menú es un cajón animado y no se congelaron (anotado en `resultados.json`).

Capturas (`evidencias/infra-f2f3/`, 114, nombres en inglés): cadena 10–52 (1440); tablero grilla/lista/panel y S1, S2, S3 («Crear
camas» en el anexo sin camas), S4 (bloqueo rechazado), S5 (médica sin rol operativo), S6, S7 (sondeo fallido con
datos previos), S8, S9 con código; cola y sus estados (S1, S2 a 1440; S3 «mías» vacía, S4, S5 mantenimiento, S6–S9);
ingreso con cama incompatible forzable y forzado con justificación, ficha en sus 4 pestañas, S6 de ficha, S5 del
ingreso para limpieza, censo abierto, indicadores con días faltantes (S7) y sin días cerrados (S3), y la pestaña
«Operación» de la ficha de espacio de F1. 1440/768/390.

No ejecutado / pendiente: **contra la API real** (otra franja); captura del `admission-block` en pantalla — el
bloque no está montado en ninguna ruta de `dev` (sólo en la vitrina), su integración se prueba en
`admission-block.spec.ts`. Revisión independiente (`visual-reviewer`, `frontend-reviewer`,
`regression-auditor`): **pendiente** — quien implementa no aprueba.
