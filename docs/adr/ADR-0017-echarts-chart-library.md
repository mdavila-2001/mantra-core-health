# ADR-0017: Apache ECharts como librería oficial de gráficos del portal de reportería

## Estado

**Propuesto** — 2026-10-30. Pedido del solicitante: los gráficos usan una librería
oficial, no SVG hecho a mano. La regla 95.1.4 exige decisión registrada antes de
introducir una librería de UI.

## Contexto

Es una excepción consciente a [ADR-0004](ADR-0004-sistema-de-diseno-propio.md) (sistema de diseño propio, sin biblioteca de terceros): un motor de gráficos con leyenda, tooltip, velas y mapas de calor no es un componente de formulario que convenga reescribir. Lo demás sigue siendo propio.

El frontend no tenía ninguna librería de gráficos (`package.json`) ni componente de
gráfico en `shared/components`. El portal de reportería necesita: líneas, barras,
barras apiladas, combinados, embudo, mapa de calor (cohortes), medidor, cascada y
**velas** (candlestick); además de leyenda interactiva, tooltip, clic sobre un
elemento para filtrar, y descripción accesible.

## Decisión

- `echarts` **6.1.0** (Apache-2.0; publicada hace más de dos semanas) y
  `ngx-echarts` **21.0.0** (MIT; peer `@angular/core >=21`, el repo está en 21.2).
  `ngx-echarts` 22 exige Angular 22 y **no** se usa.
- Importación **por módulos** (`echarts/core` + `use([...])`), no el paquete completo,
  para que el bundle lleve sólo los gráficos usados. Renderizador **SVG**: texto
  nítido, elementos inspeccionables por las pruebas y por lectores de pantalla.
- Las rutas de reportería se renderizan **sólo en cliente** (`RenderMode.Client`):
  la librería necesita DOM.
- Los colores **no se escriben a mano**: el tema de los gráficos lee en ejecución los
  tokens del sistema (`--c-*` para series, tokens semánticos para texto, rejilla y
  fondo) con `getComputedStyle`, y se reconstruye al cambiar de tema (regla 95.1.5).

## Contrato de cada gráfico (lo hace cumplir `ChartPanel`)

1. **Título** (encabezado HTML, no dentro del lienzo).
2. **Gráfico** con la librería oficial.
3. **Leyenda** siempre visible (aun con una serie).
4. **Tooltip** con valor formateado, unidad/moneda y, si hay, el comparativo.
5. **Elemento clicable que filtra**, cuando el gráfico tiene una dimensión filtrable.
6. **Información de cómo se calcula** (definición, fórmula, numerador, denominador,
   fuente, frescura, salvedades), cuando corresponde.
7. **Versión en velas**, cuando la serie tiene apertura, máximo, mínimo y cierre
   con sentido (saldo, MRR, gasto, CPM diarios).

Los puntos 5 a 7 son opcionales **sólo si el gráfico lo declara por escrito**
(`filtro: null`, `info: null`, `velas: null`, cada uno con su motivo): un
`ChartPanel` que omite uno sin decir por qué no compila el contrato.

## Consecuencias

- Una dependencia de ~60 MB sin comprimir en `node_modules` (el bundle sólo lleva lo
  importado). Licencias compatibles.
- El color nunca viaja solo: patrones (`aria.decal`) y valores en el tooltip.
- Si el equipo prefiere otra librería (Chart.js, Highcharts), el contrato de
  `ChartPanel` la aísla: se cambia el adaptador, no las pestañas.

## Evidencia

- `corepack yarn npm info echarts` → 6.1.0, Apache-2.0; `npm view ngx-echarts@21
  peerDependencies` → `@angular/core >=21.0.0`.
- CSP del repo (`src/server/security-headers.ts`): `script-src 'self'` sin `eval`;
  `style-src 'unsafe-inline'` ya permitido. ECharts con SVG no necesita relajar nada
  (**a comprobar en navegador**: no se ha ejecutado todavía).

## Adenda 2026-10-31 — paleta validada contra la superficie del proyecto y leyenda

Frente 05 H1 del portal de observabilidad
(`docs/trabajo/2026-10-31-portal-observabilidad-gobierno/05-frontend-dataviz-y-evidencia.md`).

**Paleta, validada contra la superficie real del proyecto.** La paleta categórica
de esta ADR se copió de la referencia de la skill `dataviz` sin revalidarla contra
`--bg-surface`. Se corrió `validate_palette.js` con la superficie real (blanco en
claro, `--c-petrol-800` = `#0A2B3D` en oscuro; salidas íntegras en
[`evidencia-dataviz/`](../trabajo/2026-10-31-portal-observabilidad-gobierno/evidencia-dataviz/)):

- Pasa en los dos modos (banda de luminosidad, croma, separación CVD, piso normal),
  salvo **`--chart-6` en oscuro: `#008300` daba 2,98:1** (< 3:1). Se corrige a
  **`#0c960c`** (3,78:1; mismo matiz, solo luminosidad; no cambia ΔE adyacente).
- En claro, `--chart-3`, `-4` y `-5` quedan bajo 3:1 (2,82 · 2,17 · 2,69): es el
  «relevo» legal de la skill, **solo con rótulo directo o tabla**, que `ChartPanel`
  ya da. Está declarado en `RELEVO` de `scripts/check-chart-palette.mjs`.
- Los gráficos van **siempre sobre `--bg-surface`**, nunca sobre `-alt` (cae un
  slot más bajo 3:1). En dispersión y múltiplos pequeños (all-pairs) el tope es
  de **3 series**: solo los tres primeros slots pasan.
- Nuevos tokens: ordinal de 4 pasos `--chart-ord-1..4` (alias de `--chart-seq-2..5`,
  validados con `--ordinal`; en oscuro son 4 pasos, no 5) y divergente de cinco
  puntos `--chart-div-neg`, `-neg-soft`, `-mid` (`--bg-surface-alt`), `-pos-soft`,
  `-pos` (cada brazo validado como ordinal). `chart-theme.ts` los lee en
  `ordinal[]` y `divergente[]`.
- Guardia permanente: `node scripts/check-chart-palette.mjs` (dentro de
  `gates:diseno`) y los pares `--chart-*`/`--chart-ord-*`/`--chart-div-*` contra
  `--bg-surface` en `scripts/check-contrast.mjs`.

**Enmienda a «Leyenda siempre visible (aun con una serie)»** (contrato, punto 3):
una serie **no lleva caja de leyenda** (decisión X-8 del `PLAN.md` del frente).
Con una sola serie el título y el rótulo del eje ya dicen qué es, y la caja
repite un dato sin añadir información (skill `dataviz`). Con dos o más series la
leyenda sigue siendo obligatoria. El contrato de siete puntos se lee entonces:
«leyenda visible cuando hay más de una serie».

*Estado de la enmienda de leyenda:* queda **escrita aquí**; el cambio en
`chart-option.common.ts` (`leyenda()`) y en el contrato `reporting-contract.ts`
es parte de H2 del frente 05 y **no se ejecutó** en este cambio.
