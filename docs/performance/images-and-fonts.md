# Imágenes y tipografías

Cero imágenes de contenido y cinco familias tipográficas instaladas, de las que
se usan dos.

---

## Imágenes

**No hay ninguna imagen en el proyecto** salvo el favicon:

```text
public/
└── favicon.ico
```

Los íconos son **SVG en línea**, proyectados dentro de los componentes con
`stroke="currentColor"`. Ver [íconos](../design-system/icons.md).

| Aspecto | Estado |
|---|---|
| `NgOptimizedImage` | No se usa — no hay imágenes que optimizar |
| Formatos modernos (WebP, AVIF) | No aplica |
| `srcset` / imágenes adaptables | No aplica |
| Carga diferida de imágenes | No aplica |
| Marcadores de posición | No aplica |
| CDN de imágenes | No aplica |

### Cuando haya imágenes

`app-avatar` ya recibe `src` y `alt`, así que la primera imagen real del proyecto
será una foto de perfil. Reglas para entonces:

1. **`NgOptimizedImage`** para todo lo que no sea un ícono: aporta `srcset`,
   prioridad y dimensiones automáticas.
2. **`width` y `height` siempre**, o el CLS se dispara.
3. **`alt` significativo, o `alt=""` si es decorativa.** `app-avatar` ya lo
   pide.
4. **`priority` en el LCP**, y solo ahí.
5. **Nada de imágenes con PHI en caché de CDN.** Una radiografía no es un activo
   estático.

La quinta es la específica de este dominio y la que más fácil se pasa por alto.

## Tipografías

### Autoalojadas, sin CDN

```css
@import '@fontsource/poppins/500.css';
@import '@fontsource/poppins/600.css';
@import '@fontsource/poppins/700.css';
@import '@fontsource-variable/inter';
```

**Cero peticiones a Google Fonts.** Es una decisión de privacidad tanto como de
rendimiento: un CDN de tipografías ve la IP de cada visitante, y en una
aplicación de salud eso es información de tráfico que no hace falta ceder.

### Las dos que se usan

| Token | Familia | Archivos | Uso |
|---|---|---|---|
| `--font-display` | Poppins 500 / 600 / 700 | **3** (estática) | Encabezados y marca |
| `--font-body` | Inter Variable | **1** (100–900) | Interfaz y datos |

Inter es variable justamente por esto: un archivo cubre todo el rango de pesos,
y la interfaz es donde más pesos hacen falta.

Poppins es estática, así que cada peso es un archivo. **Tres archivos para los
encabezados** es el costo de esa familia; usar solo dos pesos ahorraría uno.

### Las tres instaladas y sin importar

```json
"@fontsource/lato", "@fontsource-variable/open-sans", "@fontsource-variable/roboto"
```

`styles.css` las llama «reserva». **No pesan en el paquete** —lo que no se
importa no se empaqueta— pero ocupan lugar en el lockfile y en la instalación.

O se usan, o se quitan. Brecha `LOW`.

### Optimización activa

```json
"optimization": { "fonts": true }
```

Angular optimiza las tipografías en producción: en línea lo que puede y reduce la
cascada.

### Pila de reserva

```css
--font-display: 'Poppins', system-ui, 'Segoe UI', sans-serif;
--font-body:    'Inter Variable', system-ui, 'Segoe UI', Roboto, sans-serif;
```

`system-ui` en primer lugar de la reserva es correcto: es la tipografía que el
sistema operativo ya tiene cargada, así que el texto se ve **al instante**
mientras la real llega.

### `font-display`

Lo fija el CSS de `@fontsource`, que usa `swap` por defecto: el texto se pinta
con la reserva y se sustituye al llegar la real.

**`swap` favorece el LCP y perjudica el CLS**: el texto aparece antes, pero
cambia de forma cuando llega la tipografía definitiva. Con `system-ui` como
reserva —métricas parecidas— el salto es menor que con una serif genérica, pero
existe.

No está medido, porque no hay medición de CLS. Ver
[Core Web Vitals](core-web-vitals.md).

## Recomendaciones

| # | Qué | Esfuerzo |
|---|---|---|
| 1 | Quitar o usar las tres tipografías de reserva | Bajo |
| 2 | Evaluar si Poppins necesita los tres pesos | Bajo |
| 3 | Medir el impacto de `swap` en el CLS cuando haya Lighthouse | Medio |
| 4 | Fijar las reglas de imágenes **antes** de la primera imagen real | Bajo |

La cuarta es la más barata y la que más ahorra: es mucho más fácil escribir la
regla ahora que corregir veinte usos después.
