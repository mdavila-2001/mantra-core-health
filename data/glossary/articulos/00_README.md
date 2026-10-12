# Artículos de autoría propia del glosario

Un archivo `<slug>.json` por término. `node scripts/glossary-articulos-alovida.mjs` los compila al
formato `GlossaryArticle` y los mezcla en `public/glossary-seed/mock/articles/` sin pisar los
artículos de otras fuentes. `--check` sólo valida.

## Estado y procedencia

Todo el texto es **original del equipo y está pendiente de revisión médica**. Cada sección lo declara
(`source: alovida-curated`, licencia «Texto original de AloVida, pendiente de revisión médica») y la
pantalla lo muestra en la cita. No se presenta como texto de una fuente externa. Las `references` son
lecturas recomendadas, no la procedencia literal de cada frase.

## Esquema

```jsonc
{
  "slug": "hipertension-arterial", // igual al nombre del archivo y al slug del término
  "sections": [
    { "kind": "definition", "locator": "Introducción", "text": "Párrafos separados por línea en blanco…" },
  ],
  "references": [{ "title": "…", "url": "https://…", "source": "OMS" }],
  "image": { "file": "hipertension-arterial.svg", "caption": "…", "altText": "descripción de ≥ 20 caracteres" },
}
```

- `kind`: uno de `GlossarySectionKind` (`glossary-article.types.ts`).
- En `text`, un párrafo con todas sus líneas empezando por `•` es una lista; uno con todas sus líneas
  con ` | ` es una tabla (una fila por línea). Los `items` se derivan solos.
- La imagen vive en `public/glossary-images/<slug>.svg`: ilustración **original**, con colores por
  variables y modo oscuro dentro del propio SVG, `<title>` y `<desc>`.

## Lo que no se escribe aquí

Dosis, contraindicaciones, interacciones y valores de referencia de laboratorio exigen fuente con
procedencia y revisión humana (regla 97.5.4): no se redactan sin ella. Tampoco se inventan definiciones
para los términos importados de CIE-10 / CIMA / MedlinePlus: su texto viene de su fuente.
