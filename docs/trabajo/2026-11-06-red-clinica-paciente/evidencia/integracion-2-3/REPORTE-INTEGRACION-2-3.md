# Red clínica del paciente — integración de las Franjas 2 y 3 en el expediente

06/11/2026 · rama `claude/charming-cerf-q7sgmk` · commit `4e1e9dfbc`. Lo reporta quien implementó;
**no es una aprobación**.

## Qué se hizo

- **Adaptador puro** `patient-chart/red-clinica/red-clinica-del-expediente.ts` (con spec):
  - `nodosDeLaRed` parte de los registros y vínculos que ya arma `construirRed` y de las lecturas que
    ya están en pantalla, y produce `NodoDeRed[]` con su `DetalleDeNodo` y `AristaDeRed[]`, con ids
    reales y sin recalcular episodios.
  - Cada vínculo de la red se traduce al tipo de la Franja 3; donde la red guarda la flecha al revés,
    se invierte. `replacedByRequestId` sale como `reemplaza-receta` (receta vieja → nueva). Los
    vínculos deducidos llevan `inferido: true`.
  - Detalle por tipo: diagnóstico (certeza, nota, inicio, decisión con evidencia navegable,
    reemplazo); estudio o informe (categoría, prioridad, si hay resultado liberado); cita o
    reconsulta (motivo); derivación (tipo, destino, respuesta, llegada con la atención de destino,
    contrarreferencia); el resto, el resumen y los pares del bloque.
  - `visiblesCombinados`: intersección de los dos filtros; distingue «ningún filtro» (`null`) de
    «nada pasa» (`[]`).
- **Recorrido:**
  - Una sola superficie a lo ancho: barra de filtros, alertas, red. Con un nodo abierto a ≥780 px,
    rejilla `mapa | panel`, con el panel pegado bajo la cabecera del shell; bajo 780 px el panel es
    una hoja. Sin nodo abierto no queda ninguna columna.
  - Clic o Enter en un nodo abre el panel; el nodo queda marcado y se lleva a la vista.
  - Un vínculo del panel o una alerta llevan al nodo con `irANodo`: despliega su episodio, abre el
    descartado o el «+N» que lo esconde y lo desplaza a la vista.
  - Cerrar devuelve el foco al nodo abierto en ese momento.
  - La barra de filtros se cruza con el filtro por tipo del expediente. Si juntos no dejan nada, se
    avisa y se ofrece «Limpiar los filtros» (pasar `[]` a la red significaría «todos»).
  - `alertasDeApoyo` corre sobre lo leído; el puntero resalta los nodos y el clic abre el panel.
    Mientras cargan las lecturas no se muestran (S1, no S2).
  - «Ver el registro completo» abre el modal de siempre desde el panel (sólo registros de bloques).
    La Tabla conserva su modal.
- **Correcciones a la Franja 3**, cada una con su prueba: tipos `procedimiento` y `plan`; vínculos
  `plan-para`, `atendida-en` y `durante-internacion`; `liberadoEn: Date | null` para no inventar la
  fecha; el panel no dice «No registrado» cuando no conoce al profesional; input `devolverFoco`;
  proyección `[panel-acciones]`; input `mostrarTipos` en la barra (en el expediente, `false`, para no
  duplicar los chips de tipo).

## Comandos

| Comando | Resultado |
|---|---|
| `ng test --include='src/app/features/clinical-record/patient-chart/**/*.spec.ts'` | 50 archivos, 953 pruebas, 0 fallas |
| `yarn lint` · `yarn typecheck` · `yarn build` | 0 · 0 · 0 |
| `check-css-tokens`, `check-colores-sueltos` | sin hallazgos nuevos |
| `check-max-lines` | `recorrido-clinico.ts` justo en el techo (600). `patient-chart.ts` (2861 → 3065) y `.html` (777 → 843) ya pasaban su techo y crecieron |

Aviso de presupuesto del build: `patient-chart.css` 4,31 kB contra 4 kB.

## Navegador

Simulador, sesión médica, `pid-paciente`, `deviceScaleFactor: 2`, 1440 y 390, claro y oscuro.
**42 de 42 PASS** (`aserciones.txt`):

- sin panel, el mapa ocupa todo el ancho (1070/1070 px);
- estudio TSH en panel lateral con «Resultado liberado», «Laboratorio» y el vínculo «Se pidió para
  estudiar»;
- anemia descartada: «Se descartó en favor de Hipotiroidismo»; ese vínculo abre Hipotiroidismo
  (Confirmado) en el panel y lo marca en la red;
- cerrar devuelve el foco al nodo;
- «solo el hilo de Hipotiroidismo»: de 7 episodios a 1, «15 de 114 registros · 1 filtro aplicado»;
- puntero o foco sobre una alerta resaltan nodos; el clic abre el panel;
- a 390 el panel es una hoja (`<dialog>`), sus vínculos navegan y no hay desplazamiento horizontal;
- consola sin errores en las 4 sesiones.

Capturas: `1440-{light,dark}-01..07`, `390-{light,dark}-01..04`,
`1440-light-08-panel-pegado-bajo-la-cabecera.png`, `1440-dark-05b-hilo-ventana.png`.

## Pendientes

- **Estudio con valores:** no se puede mostrar con datos reales. La lectura del profesional
  (`GET /diagnostics/patients/:id/orders`) no trae valores, fecha de liberación, conclusión ni
  archivos, y no hay otra lectura del informe para el profesional (`diagnostics/me/:reportId` es
  sólo del paciente). Hoy el panel dice «Resultado liberado» sin tabla de valores.
- **Profesional y especialidad:** ninguna lectura del expediente trae el nombre; esos filtros sólo
  ofrecen «Todas» / «Todos».
- **Capturas por elemento:** algunas `*-02..07` salen recortadas a la izquierda o con la cabecera
  del shell encima; las de ventana (`08`, `05b`) muestran el diseño real. El toast «Alergias», que
  ya existía, tapa una esquina.
- **Composición (regla 6), para quien revise:** la barra de filtros y las alertas traen su propio
  borde y quedan como dos recuadros apilados sobre la red; las 5 alertas empujan el mapa unos
  450 px hacia abajo.
- **Código posterior a las capturas:** se condensó `irANodo` (techo de líneas) y `abierto()` pasó a
  `seleccionado() === nodo.id`. Mismo comportamiento y pruebas en verde; capturas no repetidas.
- **No ejecutado:** `yarn test` completo, `yarn pw`, axe, visual gate, 768/1024/1920, la prueba de
  que Tab no sale de la hoja y la revisión independiente.
