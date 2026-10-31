# Estado del glosario publicado el 2026-10-16

La maqueta de Contabo usa la rama `mockup`. Los PR #1124 y #1125 cargaron 1.318 artículos de MedlinePlus y 2.819 fichas farmacológicas de CIMA/AEMPS y Wikidata, respectivamente: 4.137 términos con artículo de estos lotes sobre una semilla de 19.313 términos. El último despliegue terminado fue `wvbrotcnvoezu6fxjhwy0ii2` (commit `08e349e3f2019678b97e3168fdd876b0eac56c40`).

La descarga PDF y el formato justificado están incorporados en `mockup`; la descarga de una ficha del primer lote se comprobó en la URL pública. Las 342 imágenes del primer lote y 4.643 del segundo están desactivadas mientras no haya revisión individual de pertinencia y derechos.

## Trabajo pendiente

- Ninguna de las 4.137 fichas cargadas contiene 150.000 palabras. El lote farmacológico tiene mediana de unas 480 palabras y máximo de unas 10.099. La meta literal sobre los 19.313 términos supone cerca de 2.897 millones de palabras; exige investigación, redacción original y revisión clínica por término.
- Los 15.176 términos restantes aún no tienen artículo aprobado mediante estos lotes. Las salidas S2 de diagnósticos y S4 de anatomía disponibles tienen medianas de sólo 51 y 16 palabras en español; requieren ampliación y revisión antes de presentarse como fichas completas.
- No hay imágenes nuevas aprobadas. Se necesita seleccionar cada imagen médica con licencia verificable, comprobar que represente el término y registrar autor, fuente y atribución.
- La publicación actual es la maqueta de Contabo. No se ha cambiado la API ni una base clínica de producción.

Los detalles de selección, hashes, checkpoints y comprobación remota están en `REPORTE.md` y `PHARMA-REPORT.md`.
