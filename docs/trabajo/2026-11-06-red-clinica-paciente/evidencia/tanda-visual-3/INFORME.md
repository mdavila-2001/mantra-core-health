# Red clínica del paciente — tanda visual 3

06/11/2026 · rama `claude/charming-cerf-q7sgmk`. Corrige los hallazgos de la revisión visual que dio FAIL
(61/100). Lo escribe quien implementó; **no es una aprobación** (`NO_SELF_APPROVAL`): la revisión la hace otro.

Todas las capturas y aserciones de esta carpeta se tomaron **después del último cambio de código**
(commit `cae587768`), sobre una compilación `ng build --configuration development,demo` servida estática en
`:4300` (el `ng serve` moría por memoria en este entorno compartido; ver «Lo que no se verificó»).
Playwright de `/opt/node-tools`, Chromium headless, `locale es-BO`, sin `networkidle` ni esperas fijas de
sincronización: se espera por `data-testid`.

- Guiones: [`captura-tanda-3.cjs`](captura-tanda-3.cjs) (médica, paciente, estados del panel) y
  [`a11y-tanda-3.cjs`](a11y-tanda-3.cjs) (axe + teclado).
- Aserciones: [`aserciones-todo.txt`](aserciones-todo.txt) — **173 ok, 0 fallas**;
  [`a11y-axe-y-teclado.txt`](a11y-axe-y-teclado.txt) — **14 ok, 0 fallas**.

## Hallazgos y qué se hizo

| # | Hallazgo | Estado | Dónde se ve |
|---|---|---|---|
| A1 | Nombres de episodio cortados a 768 y a 1440 con panel | Corregido. La cabecera *sticky* se medía contra `100vw`; ahora contra el lienzo visible (`container-type` + `cqi`). Los conteos ceden primero y terminan en «…»; en lienzo < 480 px (panel abierto a 1024) se ocultan estado y conteos y el nombre parte en dos líneas. Aserción «ningún nombre de episodio cortado» en las 10 combinaciones y con el panel abierto. | `medica-768-*-01-red`, `medica-1024-*-02-panel-tsh`, `medica-1440-*-02-panel-tsh` |
| A2 | Hipotiroidismo vacío en la vista inicial; eje repite «4 Nov 2026» | Corregido. Cada episodio plegado con marcas fuera de la vista dice «← N antes» / «N después →» (botón con `aria-label`, lleva a las marcas). La segunda columna del mismo día dice «Mismo día». | `medica-1440-claro-01-red`, `medica-1440-claro-01b-red-completa` |
| A3 | Toast de «Alergias» con «Sin registrar» | Corregido en la causa: el simulador usaba un uuid inventado para maní y polvo, que la terminología no resolvía; ahora usa `ALLERGEN_SUBSTANCE`. Dice «Amoxicilina 500 mg cápsulas (Alta) · Ácaros del polvo (Baja)». El toast **no** es persistente: dura 7 s (`TOAST_DEFAULT_DURATION_MS.warning`); las capturas lo cierran antes de fotografiar. | aserción «el aviso de alergias nombra cada sustancia» |
| A4 | Contraste en oscuro: insignia de alertas y filas «Alto» marrones | Corregido. Fila fuera de rango con filete de advertencia, sin fondo marrón. Los nodos fuera del camino iluminado ya no usan opacidad (axe medía 2,1:1): quedan planos con texto a contraste pleno. axe: 0 violaciones en oscuro. | `medica-1440-oscuro-02-panel-tsh`, `a11y-axe-y-teclado.txt` |
| A5 | Faltaban los estados del panel | Hecho, ver la tabla de estados. | `estados-*` |
| M1 | Leyenda con colores que no coinciden | Corregido. La leyenda sale de las aristas dibujadas con su familia real (tronco/enlace/inferido, que decide la geometría y no el motivo); si un motivo se dibuja de las dos formas, la de tronco dice «(en la misma atención)». | `medica-1440-*-01-red` |
| M2 | Rombo «Presuntivo» invisible | Corregido (la muestra no heredaba el borde de `.red__hito`). | leyenda en `medica-1440-claro-01-red` |
| M3 | Etiquetas de intervalo «tachadas» | Corregido: la etiqueta y la marca del eje van sobre la línea (z-index). | eje en `medica-*-01-red` |
| M4 | Aristas amontonadas en un haz | **No corregido.** Es el ruteo por carriles de `red-clinica.geometria.ts` (paso de 7 px); separarlo pide rediseñar el algoritmo (agrupar aristas por destino), no un ajuste visual. Queda para una franja propia. | `medica-1440-claro-02-panel-tsh` |
| M5 | Descarga en dos líneas | Corregido: una línea con «…», nombre completo en `aria-label` y `title`. Aserción ≤ 44 px de alto. | `*-02-panel-tsh` |
| M6 | Valores en monoespaciada | Corregido: fuente del cuerpo con cifras tabulares (aserción: «Inter Variable»). | `*-02-panel-tsh` |
| M7 | 390: «·» huérfano, bordes anidados, 34 segmentos | Corregido: separadores con `gap` en vertical; la superficie no dibuja un segundo recuadro dentro de la tarjeta del expediente y el resaltado va en el borde del episodio; bajo 650 px una sola barra de avance (`role=progressbar`, «Paso N de M») en lugar de 34 segmentos de pocos px. | `medica-390-*-01b-red-completa`, `estados-390-claro-aviso-de-paso` |
| M8 | Alertas pasan de 5 a 6 sin explicación | Corregido: las alertas «fuera de rango» sólo existen al abrir un informe y el resumen lo dice («1 de un informe abierto»). | `teclado-1440-claro-3-panel` |
| M9 | Nodo enfocado fuera de cuadro | Corregido con `scroll-margin` (cabecera fija y bordes). Aserción de teclado «el nodo con foco queda entero en la pantalla». | `teclado-1440-claro-2-foco-en-nodo` |
| M10 | Portal: estado dos veces, cabecera repetida, orden raro | Corregido: sin insignia (el encabezado ya dice el estado); la fila «Consulta» dice «Ver lo que se anotó en esta consulta» en vez de repetir el encabezado; el encabezado muestra el lapso («15 may 2025 – 2 sept 2025»), coherente con el orden por el registro más reciente. | `paciente-*-1-hilo` |
| B1 | Redacción | Corregido: «cefalea por cefalea en estudio» (el motivo se omite si el servicio ya lo nombra, con prueba unitaria); «atención (ambulatorio)» → «atención ambulatoria»; «En ayunas» → «Una vez al día, en ayunas…»; «consultó por reconsulta» → «volvió a consulta: …»; «consultó por interconsulta» → «tuvo una interconsulta…»; «el diagnóstico de X se dio por resuelto» → «se resolvió X»; meses en minúscula. Narración completa del paciente en `aserciones-todo.txt`. | `estados-*-aviso-de-paso`, `paciente-*-2-paso-a-paso` |
| B2 | Jerga médica dirigida al paciente | Parcial: se corrigieron las frases armadas por el front (arriba). Los nombres de estudios («TSH por quimioluminiscencia») vienen del catálogo y no se tocan desde la vista. | — |
| B3 | `aria-label` faltantes | axe no encuentra ninguno (0 violaciones en los 11 barridos). Los controles nuevos llevan nombre (`red-fuera`, `guiado-avance`, descarga). | `a11y-axe-y-teclado.txt` |
| B4 | Botón cerrar < 24 px | Corregido: talle `md`, 39×40 en escritorio y 44×44 en la hoja (aserción ≥ 24). | `*-02-panel-tsh` |
| B5 | Desalineado de 13 px | **No verificado**: la revisión no dice entre qué elementos, y no lo encontré midiendo bordes de las franjas. | — |

## Estados del panel (M34)

Provocados con `sessionStorage['mock:fallos']` (`src/app/core/mock/simulated-failures.ts`), a 1440 claro y
oscuro y a 390 claro (hoja modal). S1 con el reloj de la página en pausa (`clock.pauseAt`): el simulador
responde en 120 ms.

| Estado | 1440 claro | 1440 oscuro | 390 claro |
|---|---|---|---|
| S1 «Leyendo los valores del informe…» | [s1](estados-1440-claro-s1-leyendo.png) | [s1](estados-1440-oscuro-s1-leyendo.png) | [s1](estados-390-claro-s1-leyendo.png) |
| 403 | [403](estados-1440-claro-403.png) | [403](estados-1440-oscuro-403.png) | [403](estados-390-claro-403.png) |
| 404 | [404](estados-1440-claro-404.png) | [404](estados-1440-oscuro-404.png) | [404](estados-390-claro-404.png) |
| Sin conexión | [red](estados-1440-claro-sin-conexion.png) | [red](estados-1440-oscuro-sin-conexion.png) | [red](estados-390-claro-sin-conexion.png) |
| S9 con código de soporte | [s9](estados-1440-claro-s9-error-con-id.png) | [s9](estados-1440-oscuro-s9-error-con-id.png) | [s9](estados-390-claro-s9-error-con-id.png) |
| Validación de la lectura | [val](estados-1440-claro-validacion.png) | [val](estados-1440-oscuro-validacion.png) | [val](estados-390-claro-validacion.png) |
| Validación de la descarga («todavía no se puede abrir») | [desc](estados-1440-claro-descarga-validacion.png) | [desc](estados-1440-oscuro-descarga-validacion.png) | [desc](estados-390-claro-descarga-validacion.png) |
| «Liberado sin publicar al paciente.» (ecografía renal) | [lib](estados-1440-claro-liberado-sin-publicar.png) | [lib](estados-1440-oscuro-liberado-sin-publicar.png) | [lib](estados-390-claro-liberado-sin-publicar.png) |
| Aviso de paso («no queda a la vista con los filtros») | [paso](estados-1440-claro-aviso-de-paso.png) | [paso](estados-1440-oscuro-aviso-de-paso.png) | [paso](estados-390-claro-aviso-de-paso.png) |

Nota: el texto de la validación («Elija un medicamento del catálogo.») es el mensaje genérico que inyecta el
simulador de fallos para cualquier ruta; el panel lo muestra tal cual llega.

## Capturas por ancho y tema

Médica: `01-red` = la red en la vista (toasts cerrados); `02-panel-tsh` = panel del estudio TSH abierto;
`01b-red-completa` = la superficie entera (sólo 390 y 1440). Paciente: `1-hilo` = Hipotiroidismo desplegado;
`2-paso-a-paso` = paso 3 de la narración.

| Ancho | Médica claro | Médica oscuro | Paciente claro | Paciente oscuro |
|---|---|---|---|---|
| 390 | [red](medica-390-claro-01-red.png) · [completa](medica-390-claro-01b-red-completa.png) · [panel](medica-390-claro-02-panel-tsh.png) | [red](medica-390-oscuro-01-red.png) · [completa](medica-390-oscuro-01b-red-completa.png) · [panel](medica-390-oscuro-02-panel-tsh.png) | [hilo](paciente-390-claro-1-hilo.png) · [paso](paciente-390-claro-2-paso-a-paso.png) | [hilo](paciente-390-oscuro-1-hilo.png) · [paso](paciente-390-oscuro-2-paso-a-paso.png) |
| 768 | [red](medica-768-claro-01-red.png) · [panel](medica-768-claro-02-panel-tsh.png) | [red](medica-768-oscuro-01-red.png) · [panel](medica-768-oscuro-02-panel-tsh.png) | [hilo](paciente-768-claro-1-hilo.png) · [paso](paciente-768-claro-2-paso-a-paso.png) | [hilo](paciente-768-oscuro-1-hilo.png) · [paso](paciente-768-oscuro-2-paso-a-paso.png) |
| 1024 | [red](medica-1024-claro-01-red.png) · [panel](medica-1024-claro-02-panel-tsh.png) | [red](medica-1024-oscuro-01-red.png) · [panel](medica-1024-oscuro-02-panel-tsh.png) | [hilo](paciente-1024-claro-1-hilo.png) · [paso](paciente-1024-claro-2-paso-a-paso.png) | [hilo](paciente-1024-oscuro-1-hilo.png) · [paso](paciente-1024-oscuro-2-paso-a-paso.png) |
| 1440 | [red](medica-1440-claro-01-red.png) · [completa](medica-1440-claro-01b-red-completa.png) · [panel](medica-1440-claro-02-panel-tsh.png) | [red](medica-1440-oscuro-01-red.png) · [completa](medica-1440-oscuro-01b-red-completa.png) · [panel](medica-1440-oscuro-02-panel-tsh.png) | [hilo](paciente-1440-claro-1-hilo.png) · [paso](paciente-1440-claro-2-paso-a-paso.png) | [hilo](paciente-1440-oscuro-1-hilo.png) · [paso](paciente-1440-oscuro-2-paso-a-paso.png) |
| 1920 | [red](medica-1920-claro-01-red.png) · [panel](medica-1920-claro-02-panel-tsh.png) | [red](medica-1920-oscuro-01-red.png) · [panel](medica-1920-oscuro-02-panel-tsh.png) | [hilo](paciente-1920-claro-1-hilo.png) · [paso](paciente-1920-claro-2-paso-a-paso.png) | [hilo](paciente-1920-oscuro-1-hilo.png) · [paso](paciente-1920-oscuro-2-paso-a-paso.png) |

En cada una se afirma además: sin desplazamiento horizontal de la página y consola sin errores.

## Accesibilidad

- **axe-core 4.12** (`@axe-core/playwright` no está instalado: se inyecta `node_modules/axe-core/axe.min.js`),
  reglas WCAG 2.0/2.1/2.2 A y AA: **0 violaciones** en médica 1440 claro, 1440 oscuro y 390 oscuro (red
  plegada; Hipotiroidismo desplegado con alertas abiertas; panel TSH) y en el portal del paciente 1440 claro y
  oscuro. Detalle en [`a11y-axe-y-teclado.txt`](a11y-axe-y-teclado.txt).
- **Teclado** (1440 claro): el orden de `Tab` desde «Expandir todo» está en el mismo archivo; `Enter` despliega
  el episodio ([1](teclado-1440-claro-1-episodio.png)), el nodo con foco queda entero en pantalla
  ([2](teclado-1440-claro-2-foco-en-nodo.png)), `Enter` abre el panel con el foco en su título
  ([3](teclado-1440-claro-3-panel.png)) y `Escape` lo cierra con el foco de vuelta en el nodo.

## Prueba de extremo a extremo

[`playwright/red-clinica-recorrido.spec.ts`](../../../../../playwright/red-clinica-recorrido.spec.ts), 5 pruebas
contra el simulador: Tabla ↔ Recorrido; aviso «← N antes» y su salto; panel por clic y teclado con cierre y foco;
«inferido» en lienzo, leyenda y panel; S9 del informe con «Reintentar». Corrida contra la compilación demo en
`:4300`: **5 passed**. La puerta (`scripts/pre-push-gate.mjs run --pw …`) la corre otra vez contra `yarn start:demo`.

## Verificaciones

| Comando | Resultado |
|---|---|
| `corepack yarn typecheck` | 0 errores |
| `eslint` sobre los archivos tocados | 0 |
| `corepack yarn build` | sale 0; aviso de presupuesto inicial preexistente (warning, no error) |
| `node scripts/check-max-lines.mjs` | ningún archivo de la rama aparece (sólo los 33 de `dev`) |
| `ng test` de `features/clinical-record` y `features/account/medical-record` | **82 archivos, 1 478 pruebas, 0 fallas** |
| `patient-home.spec.ts` | no se pudo correr: el constructor de pruebas cae antes de ejecutar («The expression evaluated to a falsy value (compilation)», `compiler-plugin onStart`). No se encontró relación con esta rama; queda anotado. |

## Lo que NO se verificó

- **Haz de aristas (M4)**: no se corrigió (ver tabla).
- **Desalineado de 13 px (B5)**: no se localizó.
- El toast de alergias **no se rediseñó**: sigue siendo un aviso de 7 s que tapa el borde inferior mientras dura.
- Lector de pantalla real (NVDA/VoiceOver): no se probó; sólo axe y nombres accesibles.
- `ng serve` con HMR: las capturas son de la compilación demo servida estática (mismo código, sin HMR). La puerta sí
  levanta `yarn start:demo`.
- Suite completa de `ng test`: sólo las dos carpetas pedidas.
- Revisión independiente: pendiente (quien implementa no aprueba).
