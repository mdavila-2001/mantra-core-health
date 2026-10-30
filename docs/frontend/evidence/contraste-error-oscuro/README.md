# Contraste del error de validación en tema oscuro

Rutas: `/auth/register/medical-center`, `/auth/register/imaging-center` ·
viewport 1440×900 · tema por `localStorage['mantra-core-health.theme']` · el error
se dispara con «Siguiente» sin llenar nada · Playwright contra `ng serve`, sin
`networkidle` (se espera `.required-asterisk` y luego `.form-field-error`).

El contraste se mide dos veces: por estilo computado y por muestreo de píxeles
sobre una captura del propio elemento (el píxel más lejano del fondo efectivo).
Coinciden en todos los casos.

## Texto: mensaje de error y asterisco de obligatorio

| | Tema oscuro (`rgb(10,43,61)`) | Tema claro (blanco) |
|---|---|---|
| Antes (`--c-error-500`, rampa fija) | `rgb(181,83,60)` · **2,99:1** | 4,92:1 |
| Después (`--text-danger`) | `rgb(223,180,170)` · **7,89:1** | `rgb(111,56,44)` · 9,22:1 |

Archivos: `antes-*` y `despues-*` (`.png` + `.json`). Script: `medir-texto.js`.

## Borde de los controles en error (`input`, `select`, `textarea`…)

| | Tema oscuro | Tema claro |
|---|---|---|
| Antes (`--c-error-500`) | `rgb(181,83,60)` · **2,99:1** (< 3:1, WCAG 1.4.11) | 4,92:1 |
| Después (`--border-danger`) | `rgb(195,115,97)` · **4,17:1** | `rgb(181,83,60)` · 4,92:1 (sin cambio) |

Archivos: `bordes-antes-*` y `bordes-despues-*`. Script: `medir-bordes.js`
(`node medir-bordes.js <etiqueta> <puerto> <ruta> <dark|light>`).

## Cómo se obtuvo el «antes»

Con un worktree en `8ce61e80` (el padre de los cambios) sirviendo en otro
puerto. No se simuló: se midió el código original.
