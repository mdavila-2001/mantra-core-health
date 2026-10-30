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
