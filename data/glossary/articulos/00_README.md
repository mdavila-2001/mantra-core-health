# Artículos de autoría propia del glosario

Un archivo `<slug>.md` por término. `node scripts/glossary-articulos-alovida.mjs` los compila al
formato `GlossaryArticle` y los mezcla en `public/glossary-seed/mock/articles/` sin pisar los
artículos de otras fuentes. `--check` sólo valida; `--min N` fija el piso de palabras (2000 por
omisión); `--only a,b` procesa sólo esos slugs.

## Estado y procedencia

Todo el texto es **original del equipo y está pendiente de revisión médica**. Cada sección lo declara
(`source: alovida-curated`, licencia «Texto original de AloVida, pendiente de revisión médica») y la
pantalla lo muestra en la cita. No se presenta como texto de una fuente externa. Las referencias son
lecturas recomendadas, no la procedencia literal de cada frase.

## Formato

```markdown
---
slug: hipertension-arterial
image: hipertension-arterial.svg | Pie de la imagen | Texto alternativo descriptivo (≥ 20 caracteres)
image: hipertension-arterial-clasificacion.svg | Otro pie | Otro texto alternativo
---

## [definition] Introducción

Párrafos separados por una línea en blanco.

## [causes] Causas

• Un párrafo cuyas líneas empiezan todas con «•» es una lista.

## [references]

- Título | https://url-verificada | Fuente
```

- `slug`: igual al nombre del archivo y al slug del término.
- `## [kind] Encabezado`: `kind` es uno de `GlossarySectionKind` (`glossary-article.types.ts`). Un
  mismo `kind` puede repetirse con encabezados distintos; el encabezado se muestra como subtítulo.
- Un párrafo con todas sus líneas con ` | ` es una tabla (una fila por línea, la primera es la cabecera).
- Las imágenes viven en `public/glossary-images/<archivo>.svg`: ilustraciones **originales**, con
  colores por variables y modo oscuro dentro del propio SVG, `<title>` y `<desc>`.
- `## [references]`: sólo URLs que se verificaron (respuesta 200). Una sin verificar no se incluye.

## Lo que no se escribe aquí

Dosis, contraindicaciones, interacciones y valores de referencia de laboratorio exigen fuente con
procedencia y revisión humana (regla 97.5.4): no se redactan sin ella. Tampoco se inventan definiciones
para los términos importados de CIE-10 / CIMA / MedlinePlus: su texto viene de su fuente.
