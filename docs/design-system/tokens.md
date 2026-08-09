# Tokens

El catálogo completo, cómo se consume desde TypeScript y las tres duplicaciones
que el sistema necesita y vigila.

---

## Inventario

| Familia | Cantidad | Prefijo | Cambia con el tema |
|---|---:|---|---|
| Rampas de color | 11 × 10 = **110** | `--c-<familia>-<50…900>` | No |
| Superficies | 4 | `--bg-*` | **Sí** |
| Texto | 4 | `--text-*` | **Sí** |
| Marca | 6 | `--brand-*` | **Sí** |
| Bordes | 2 | `--border-*` | **Sí** |
| Estados | 4 × 3 = **12** | `--st-<estado>-<bg\|fg\|bd>` | **Sí** |
| Tonos de marca | 2 × 3 = **6** | `--st-<primary\|secondary>-*` | **Sí** |
| Efectos | 4 | `--shadow-*`, `--focus-ring` | **Sí** |
| Espaciado | 11 | `--sp-*` | No |
| Radios | 8 | `--r-*` | No |
| Puntos de quiebre | 3 | `--bp-*` | No |
| Familias tipográficas | 2 | `--font-*` | No |
| Tamaños de tipografía | 9 | `--fs-*` | No |
| Interlineados | 7 | `--lh-*` | No |

**188 tokens.** `DESIGN_TOKENS` los enumera en tiempo de ejecución.

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

## El hueco de la comprobación

La verificación es **en un solo sentido**: cada token declarado en TypeScript se
comprueba contra CSS.

**Un token declarado solo en CSS y ausente en TypeScript pasaría sin aviso.** No
rompe nada —el CSS funciona igual— pero el catálogo tipado dejaría de ser
completo, y quien busque el token por autocompletado no lo encontraría.

Registrado como brecha `MEDIUM` (D4) en
[la auditoría de estructura](../reports/graphify-audit.md#d4--el-sistema-de-diseño-se-declara-en-dos-escalones-distintos).

## `DESIGN_TOKENS`

```ts
export const DESIGN_TOKENS: readonly DesignToken[] = Object.freeze([…]);
```

> *«Existe para que la deriva CSS ↔ TS sea detectable, **no para iterarlo en la
> UI**.»*

La advertencia importa: pintar 188 tokens en una pantalla no es documentación, es
un volcado. La vitrina exhibe los que tienen significado, no todos.

## Tokens que **no** existen

| Token esperable | Estado |
|---|---|
| Duraciones de transición (`--duration-*`) | No existen. Los tiempos están en los CSS de cada componente |
| Curvas de aceleración (`--ease-*`) | No existen |
| Índices de apilamiento (`--z-*`) | No existen. Cada capa fija el suyo |
| Anchos de contenedor (`--container-*`) | No existen |
| Grosores de borde (`--bw-*`) | No existen |
| Tokens específicos de componente | No existen, y es correcto: se componen desde los semánticos |

Las tres primeras son las que más se notarían al crecer. Anotadas como `LOW`.
