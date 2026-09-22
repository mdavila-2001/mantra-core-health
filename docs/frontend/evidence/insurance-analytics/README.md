# Evidencia · Tablero de siniestralidad y KPIs actuariales

Capturas de `/administration/insurance-analytics` contra la **maqueta**
(`mockBackend: true`, que es lo que sirve `yarn start`), generadas por
`playwright/carril-insurance-analytics.spec.ts` con `--workers=1`.

| Archivo | Rol | Viewport | Qué se ve | Veredicto |
|---|---|---|---|---|
| `tablero-movil.png` | Aseguradora (maqueta) | 390×844 | Las seis tarjetas KPI **una por fila**, gráfico mensual, tres tablas e inmunización; sin overflow horizontal | PASS |
| `tablero-tablet.png` | Aseguradora (maqueta) | 768×1024 | Igual, tablet vertical | PASS |
| `tablero-tablet-horizontal.png` | Aseguradora (maqueta) | 1024×768 | Igual, tablet horizontal | PASS |
| `tablero-escritorio.png` | Aseguradora (maqueta) | 1440×900 | Rejilla de KPIs, tendencia mensual y tablas en ancho de escritorio | PASS |
| `tablero-escritorio-grande.png` | Aseguradora (maqueta) | 1920×1080 | Igual, escritorio grande | PASS |
| `barra-con-foco.png` | Aseguradora (maqueta) | 1280×720 | La primera barra del gráfico **con el foco puesto**: anillo `outline` + `stroke` de 2 px, distinguible de las vecinas | PASS |

## Qué afirma cada prueba, además de la captura

Una captura no reemplaza una aserción; las del carril son:

- **seis tarjetas KPI** por `data-testid`, incluida `kpi-earned-premium` (la
  prima devengada, que es el denominador del loss ratio de la primera tarjeta);
- **sin desborde** (`scrollWidth > clientWidth` en `false`) en los cinco anchos;
- **una tarjeta por fila en 390 px** — todas comparten `left`;
- **cada barra recibe el foco** y su `aria-label` nombra el mes y el importe;
- el `<svg>` es **`role="group"`**, no `role="img"`: una imagen es un nodo hoja
  del árbol de accesibilidad y callaría las etiquetas de las barras;
- **cero excepciones sin capturar** (`pageerror`) en los cinco anchos.

## Errores de consola

Se afirma sobre `pageerror` (excepción que se escapó), no sobre
`console.error`: la CSP del servidor de desarrollo bloquea sus propios scripts
en línea y ensucia la consola en **todas** las pantallas — medido en el carril
16 y ajeno a esta tarea.

## Lo que esta evidencia NO cubre

- **La pierna contra la API real** (`la analítica sobre datos reales · Neon`)
  queda **BLOCKED**: sus 5 pruebas fallan con `ECONNREFUSED :3005` porque la
  API no estaba levantada. Ninguna toca los cambios de este carril.
- **El desglose por categoría de prestación** (ambulatorio · hospitalario ·
  farmacia · diagnóstico) **no está**: no existe el campo en
  `insurance-analytics.types.ts`, y derivarlo en el navegador sería inventar
  cifras actuariales. Necesita contrato nuevo en la API.
- axe **no evalúa contraste ni área táctil** en jsdom (ver `src/testing/a11y.ts`);
  cero violaciones significa «sin los errores mecánicos que una máquina puede
  ver sin renderizar», no «accesible».
