# Publicación completa del glosario médico

Fecha: 2026-10-15. Pedido: 150.000 palabras por término, investigación en fuentes médicas oficiales y literatura académica, imágenes clínicas pertinentes, texto justificado y descarga PDF.

## Evidencia inicial

- `mockup`, `dev` y `test` sirven `glossary-seed/manifest.json` con 19.313 términos (`generatedAt` 2026-10-01). La cantidad de términos de la API y base reales aún no está verificada.
- Para esa semilla, 150.000 palabras por término equivalen a 2.896.950.000 palabras. No se declara cobertura completa por crear un generador o rellenar texto.
- El artículo actual tiene estructura de secciones, fuentes e imágenes. No ofrece PDF y sus párrafos no tienen alineación justificada.
- La llave `~/.ssh/alovida_contabo` existe; `root@62.169.18.132:22` da timeout antes de autenticar. La lectura pública HTTPS funciona.
- Hay cambios ajenos en los repos principales. Esta rama aislada parte de `origin/mockup` y no modifica esos cambios.

## Hitos y microtareas

### H1. Inventario y trazabilidad

1. Obtener una exportación de solo lectura del catálogo real del VPS. Criterio: conteo por categoría, identificadores, artículos, palabras, imágenes, licencias y fuentes; datos clínicos privados ausentes del informe.
2. Cruzar la exportación con la semilla pública y los artículos locales. Criterio: listado de faltantes, duplicados y diferencias por ambiente.
3. Guardar copia de seguridad y ruta de reversión antes de cualquier ingesta. Criterio: restauración documentada y comprobable.

### H2. Presentación y PDF

1. Justificar únicamente los párrafos del artículo y de la definición, con ancho legible y cortes de palabras apropiados. Criterio: vista de escritorio y teléfono legible.
2. Crear una descarga PDF de cada ficha mediante el motor de PDF existente, con título, secciones, citas, referencias y atribuciones. Criterio: archivo descargado con contenido completo de la ficha y enlaces de fuente.
3. Definir y verificar cómo se incluyen imágenes licenciadas en PDF; las imágenes remotas deben resolverse sin romper la descarga. Criterio: PDF y web muestran la misma selección de imágenes y créditos.
4. Verificar una ficha con y sin artículo; comprobar archivo y captura visual. Criterio: ninguna descarga vacía ni promesa de artículo ausente.

### H3. Investigación e ingesta reanudable

1. Usar el identificador clínico estable de cada término para buscar fuentes oficiales y literatura indexada en Google Scholar/PubMed. Criterio: cada afirmación editorial queda asociada a URL, fecha, versión, sección y licencia.
2. Redactar por capítulos con revisión de duplicados, contradicciones, vigencia y citas. Criterio: contenido original, exactitud clínica revisada y contador de palabras por término; nunca repetir texto para alcanzar cuota.
3. Evaluar cada imagen por pertinencia clínica, licencia y correspondencia con el término. Criterio: registro de aceptación/rechazo y crédito visible.
4. Preparar lotes con checkpoint, informe de cobertura y publicación idempotente. Criterio: reanudar una ingesta sin duplicar ni sobrescribir contenido aprobado.
5. Generar PDF por término al aprobar cada lote, y volúmenes por categoría para descarga masiva. Criterio: enlaces y sumas de verificación registrados.

### H4. Publicación

1. Revisar cada lote con un profesional clínico. Criterio: responsable y fecha registrados; afirmaciones sin soporte no se publican.
2. Publicar primero en ambiente de prueba, verificar web, PDF, fuentes e imágenes, y luego promover a producción. Criterio: evidencia de la ruta completa y reversión disponible.
3. Cerrar sólo cuando el inventario real entero satisfaga la longitud acordada y las verificaciones. Criterio: informe final con conteos por término y cero faltantes.

## Estado de este corte

H1 tiene una auditoría por término de la semilla y de las cuatro salidas locales F9; falta el inventario de la API real. H2 está implementado en esta rama y probado en navegador local para fichas con artículo, sin artículo y con tres imágenes propias. H3 y H4 siguen pendientes: ninguna definición local llega a 150.000 palabras y la revisión clínica de las imágenes y del texto no está documentada. El timeout de SSH impide leer la base de datos y publicar en el VPS por esa vía.

## Política de fuentes para la ingesta

- Google Scholar sirve para descubrir literatura, no para copiar automáticamente artículos ni para certificar revisión clínica. Registrar DOI/PMID, fecha, población y versión de cada estudio; contrastar el registro con PubMed y la publicación original.
- MedlinePlus distingue contenido federal de dominio público de materiales licenciados de terceros, como la enciclopedia A.D.A.M. y ciertas imágenes. Validar derechos por página y por imagen antes de reproducirla en web o PDF: https://medlineplus.gov/spanish/acercade/uso/usodecontenido/
- PubMed indexa trabajos de terceros; la presencia de un estudio no autoriza a redistribuir su texto o figuras. Usar la cita y redactar síntesis original; verificar la licencia de cada recurso: https://pmc.ncbi.nlm.nih.gov/about/copyright/
- Como ejemplo de búsqueda, la ficha oficial de angiografía de extremidades está en https://medlineplus.gov/spanish/ency/article/003772.htm y la revisión indexada sobre angiografía por sustracción en enfermedad cerebrovascular en https://pubmed.ncbi.nlm.nih.gov/34553337/. La primera pertenece a la enciclopedia A.D.A.M.; se enlaza como referencia y no se copia sin licencia.
