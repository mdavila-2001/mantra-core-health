# Decisiones — Editor de artículos médicos (30/09/2026)

Rama `justin/rich-article` (front, contra `mockup`) · `justin/article-body-20000` (API, contra `dev`, PR #522).

| # | Decisión | Por qué | Evidencia |
|---|---|---|---|
| D1 | El formato se guarda como **markdown acotado dentro de `bodyText`**, no como HTML | Sin tabla/columna nueva; los posts viejos (texto plano) siguen siendo válidos; guardar HTML que leen terceros es superficie XSS; búsqueda y vistas previas siguen leyendo texto | `shared/text/article-markup.ts` + spec (lo desconocido sale como texto, `javascript:` no es enlace) |
| D2 | Imágenes **intercaladas** vía `media[]` + referencia `imagen:N` | Decisión del propietario; la API ya aceptaba `media[]` con control de propiedad | `CreatePostDto.media`, `community-social.service.ts` (`assertMediaFileUsableBy`) |
| D3 | Al leer, **primera sección abierta, resto cerradas**; varias pueden quedar abiertas | Decisión del propietario | `ArticleBody` + spec |
| D4 | Se **reutiliza** `RichTextEditor`, `Accordion` y el selector de emojis del chat | Regla 50-frontend §2; todo lo nuevo del editor es **opt-in**, la nota clínica no cambia | specs del editor: las 8 originales intactas |
| D5 | `SelectorEmojis` **no se movió** a `shared/` | El chat se tocó en el PR #798 recién mergeado; mover sus archivos es riesgo de conflicto con otra sesión. Queda importado desde `features/messaging` | — |
| D6 | Sin subrayado en el artículo | El formato guardado no tiene cómo expresarlo; ofrecerlo sería perderlo al publicar | `HERRAMIENTAS_DE_ARTICULO` |
| D7 | Borrador en `localStorage`, **sin imágenes** | Es de la persona en ese navegador; los archivos no entran | spec del compositor |
| D8 | Publicar es **todo o nada**: si una imagen no sube, no se publica | Un artículo con un hueco donde iba la radiografía es peor que uno que no salió | spec de `medical-articles` |
| D9 | Tope de 20 000 en la API **sin correr el generador de OpenAPI** | El generador exige el stack Docker; se editaron los 3 artefactos sólo en ese número y el CI los compara | PR API #522 |

## Evidencia de verificación

- Front: typecheck 0; build 0; lint limpio en los archivos tocados; specs dirigidos **330+ en verde**.
  Suite completa: 4 archivos rojos — `pharmacy-inbox`, `access-tree`, `appointment-calendar`
  **fallan igual en `origin/mockup`** (preexistentes); `feed.spec.ts` pasa 13/13 solo y cae en la
  corrida conjunta por contaminación del `TestBed`.
- Runtime (build SSR + maqueta, `localhost:4317`, escritorio): atajos Markdown, 3 niveles de título,
  lista, cita, enlace con Ctrl/Cmd+K, emoji, imagen con descripción, vista previa, borrador tras F5,
  publicar, leer con índice y expandir/contraer, y la tarjeta en la Red social.
- **No verificado:** edición táctil en un teléfono real (el emulador móvil del panel se desalineó y
  los clics caían fuera de los botones); el layout a 375 px sí se observó.
