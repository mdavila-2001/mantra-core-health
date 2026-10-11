# Tokens

El catálogo completo, cómo se consume desde TypeScript y las tres duplicaciones
que el sistema necesita y vigila.

---

## Inventario

| Familia | Cantidad | Prefijo | Cambia con el tema |
|---|---:|---|---|
| Rampas de color | 11 × 10 = **110** | `--c-<familia>-<50…900>` | No |
| Superficies | 6 | `--bg-*` | **Sí** |
| Texto | 4 | `--text-*` | **Sí** |
| Marca | 6 | `--brand-*` | **Sí** |
| Bordes | 2 | `--border-*` | **Sí** |
| Estados | 4 × 3 = **12** | `--st-<estado>-<bg\|fg\|bd>` | **Sí** |
| Tonos de marca | 2 × 3 = **6** | `--st-<primary\|secondary>-*` | **Sí** |
| Escala de intensidad | 4 × 2 = **8** | `--heat-<1…4>-<bg\|fg>` | **Sí** |
| Efectos | 4 | `--shadow-*`, `--focus-ring` | **Sí** |
| Capas | 8 | `--z-*` | No |
| Duraciones | 3 | `--dur-*` | No |
| Curvas | 3 | `--ease-*` | No |
| Espaciado | 11 | `--sp-*` | No |
| Radios | 8 | `--r-*` | No |
| Puntos de quiebre | 3 | `--bp-*` | No |
| Familias tipográficas | 3 | `--font-*` | No |
| Tamaños de tipografía | 9 | `--fs-*` | No |
| Interlineados | 7 | `--lh-*` | No |
| Alias de compatibilidad | 7 | `--surface-*`, `--text-*`, `--border-*`, `--accent` | **Sí** |

**220 tokens.** `DESIGN_TOKENS` los enumera en tiempo de ejecución.

Los PDF del sistema toman de acá sus colores y sus dos familias tipográficas,
copiados en RGB y TTF porque `jsPDF` no lee CSS; cómo y con qué prueba de
deriva, en [paper.md](./paper.md).

## Cómo se consume desde TypeScript

```ts
import { BRAND, SURFACE, cssVar, rampToken, spacingToken } from '@core/tokens/design-tokens.types';

cssVar(BRAND.primary)        // 'var(--brand-primary)'
rampToken('petrol', 500)     // '--c-petrol-500'   ← tipado literal
spacingToken(4)              // '--sp-4'
statusToken('error', 'fg')   // '--st-error-fg'
```

Los tipos son **plantillas literales**, así que un error de tipeo no compila:

```ts
export type RampToken = `--c-${RampFamily}-${RampStep}`;
export type StatusToken = `--st-${StatusType}-${StatusSlot}`;
export type SpacingToken = `--sp-${SpacingStep}`;
```

`rampToken('petrol', 550)` no existe: `550` no está en `RAMP_STEPS`.

## Las tres duplicaciones necesarias

Tres valores viven en dos lugares. **Ninguna es descuido**, y las tres tienen una
prueba que compara las fuentes y falla si se separan.

### 1 · La escala de puntos de quiebre

```text
src/styles.css                      --bp-sm: 650px · --bp-md: 780px · --bp-lg: 1024px
src/app/core/tokens/breakpoints.ts  BREAKPOINTS = { sm: 650, md: 780, lg: 1024 }
```

**Por qué no se puede unificar:** CSS no admite custom properties dentro de la
condición de una consulta de medios. `@media (min-width: var(--bp-md))` **no
funciona en ningún navegador**. Las consultas llevan el número literal.

`styles.css` lo advierte con un ⚠️ en el propio bloque.

La escala está **extraída de lo que el código ya usaba, no inventada**: 780 px
era el corte de facto con 30 usos y 1024 px el secundario con 2.

### 2 · El umbral del cajón de navegación

```text
shell.css · side-nav.css            @media (min-width: 780px)
core/layout/breakpoints.ts          NAV_DRAWER_MAX_WIDTH = 780
```

**Por qué no se puede unificar:** son dos preguntas distintas sobre el mismo
número.

- El CSS decide **cómo se ve** el panel.
- El TypeScript decide **si el botón de hamburguesa existe en el árbol**, que es
  un elemento, no un estilo.

Una hoja de estilos no puede responder la segunda.

### 3 · La clave del tema en `localStorage`

```text
src/index.html                       'mantra-core-health.theme'  (script en línea)
core/tokens/theme.service.ts         THEME_STORAGE_KEY
```

**Por qué no se puede unificar:** el script del `<head>` corre **antes de que
exista Angular**. Es lo que evita el parpadeo bajo SSR.

Los dos archivos se declaran espejo mutuamente.

### Cómo se vigilan

Doce archivos de prueba importan `node:fs` para leer `src/styles.css` desde el
disco y comparar. Es lo que convierte una duplicación peligrosa en una
duplicación gobernada.

```bash
yarn test   # entre las 804, están las que comparan CSS ↔ TS
```

## Verificación en los dos sentidos

`design-tokens.types.spec.ts` compara el catálogo completo con `src/styles.css`:
ningún nombre del TypeScript puede faltar en CSS, y ningún custom property de
CSS puede quedar fuera del catálogo tipado. La escala de intensidad (`--heat-*`)
se incorporó para cerrar esa deriva.

## `DESIGN_TOKENS`

```ts
export const DESIGN_TOKENS: readonly DesignToken[] = Object.freeze([…]);
```

> *«Existe para que la deriva CSS ↔ TS sea detectable, **no para iterarlo en la
> UI**.»*

La advertencia importa: pintar 220 tokens en una pantalla no es documentación, es
un volcado. La vitrina exhibe los que tienen significado, no todos.

## Tokens que **no** existen

| Token esperable | Estado |
|---|---|
| Anchos de contenedor (`--container-*`) | No existen |
| Grosores de borde (`--bw-*`) | No existen |
| Tokens específicos de componente | No existen, y es correcto: se componen desde los semánticos |

Las tres primeras son las que más se notarían al crecer. Anotadas como `LOW`.
