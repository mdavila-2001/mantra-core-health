# Estado verificable del glosario

Fecha: 2026-10-15. Estado: implementación local parcial; sin despliegue al VPS.

## Inventario público

Las URL públicas `/glossary-seed/manifest.json` de `mockup`, `dev` y `test` en `62.169.18.132.sslip.io` informan 19.313 términos por ambiente, con `generatedAt` 2026-10-01T22:09:55.243Z. Es la semilla del front; no prueba el contenido de la base de la API.

## Artículos locales

Conteo reproducible sobre `sections[].text`, separando palabras por espacios. Los archivos pueden compartir términos, así que la suma de filas no es un conteo de conceptos únicos.

| Conjunto | Artículos | Con imagen | Promedio de palabras | Máximo | ≥150.000 palabras |
| --- | ---: | ---: | ---: | ---: | ---: |
| S1 MedlinePlus | 1.318 | 422 | 569 | 2.888 | 0 |
| S2 CIE-10-ES, salida completa | 6.462 | 661 | 27 | 387 | 0 |
| S3 Fármacos | 2.833 | 1.950 | 964 | 10.099 | 0 |
| S4 Anatomía y otros | 2.841 | 1.637 | 47 | 1.071 | 0 |

El inventario local aún no equivale a lo publicado en el VPS. Ningún artículo de esos cuatro conjuntos cumple la longitud pedida.

La auditoría completa por slug está en `evidencia/auditoria-por-termino.json`, generada con `scripts/glossary-publication-audit.mjs` sobre la semilla y las cuatro salidas F9. En los 19.313 términos de la semilla:

| Medida | Resultado |
| --- | ---: |
| Definiciones con texto | 7.091 |
| Definiciones vacías | 12.222 |
| Definiciones de exactamente 150.000 palabras | 0 |
| Artículos locales asociados | 13.454 |
| Términos sin artículo local | 5.859 |
| Artículos de 150.000 palabras o más | 0 |
| Fichas con URL de imagen | 6.394 |
| Fichas con aprobación explícita de pertinencia de imagen | 0 |

El máximo de una definición es 2.659 palabras; el de un artículo F9, 10.099. El conteo separa por espacios y toma el artículo más largo si algún slug aparece en varias salidas. Ninguno se trata como revisión médica.

## Acceso al VPS

La llave `~/.ssh/alovida_contabo` está disponible. La conexión `root@62.169.18.132:22` agotó el tiempo de espera antes de la autenticación, también con red habilitada. HTTPS público funciona. Se requiere conocer un puerto o ruta de acceso alternativos para leer la base real y publicar por SSH.

## Cambios de esta rama

- Plan escrito y trabajo aislado desde `origin/mockup`, sin tocar los cambios ajenos del checkout principal.
- Párrafos de artículos y definiciones alineados a ambos márgenes, con separación silábica del navegador.
- Botón de descarga PDF en la ficha. El archivo incluye definición clínica, resumen, capítulos, datos, referencias, URL de procedencia y créditos; usa papel blanco y divide párrafos largos entre páginas.
- Las imágenes del término requieren `properties.image_review_status = approved` para aparecer en la lista, la ficha y el PDF. La foto de un hueso genérico que acompañaba «articulación incudoestapedial» queda oculta hasta revisión de pertinencia. Las imágenes de artículos mantienen sus filtros de origen/licencia existentes.
- Auditoría reproducible del estado de cada término antes de una ingesta. No altera datos ni inventa contenido.

## Verificación local

- `corepack yarn typecheck` y `corepack yarn build`: correctos.
- ESLint dirigido a los TypeScript modificados: correcto. El lint global arroja 267 errores preexistentes fuera de estos archivos.
- Pruebas dirigidas (glosario, `pdf-export` y mock del glosario): **17 archivos · 227/227**. La cifra anterior de 70/70 omitía `glossary-term.spec` y `glossary.spec`: con el filtro de aprobación de imágenes, 4 de sus pruebas fallaban porque sus datos no declaraban `image_review_status`. Se actualizaron los datos al requisito nuevo y se agregaron 2 pruebas negativas (imagen con licencia y crédito, sin aprobación → no se muestra, ni en la ficha ni en la tarjeta).
- Suite completa (`yarn test`): 75 fallos de 10.761 en 10 archivos, ninguno de glosario. Medido en `origin/mockup` limpio, sin estos cambios: 74 fallos en 9 archivos (medication-block 66, y uno en cada uno de pharmacies-directory, messaging, design-system-sample, design-tokens, navigation.subgroups, navigation.map, fichas-estandar, app.routes). El fallo 75, `pharmacy.pedido-entrante`, pasa 3/3 aislado en esta rama: depende del orden y de los temporizadores de la suite completa.
- Navegador local, un solo navegador contra `ng serve`: «amigdalitis» (artículo), «articulación incudoestapedial» (sin artículo) y «amigdalitis» en 390 px descargaron archivos `%PDF-`, texto con `text-align: justify` y cero errores de página. Se reprodujeron en esta revisión; la «angiografía» curada **no** se reprodujo (necesita un archivo generado que no se commitea) y queda con la evidencia previa de la sesión anterior.
- Observación sin resolver: en 390 px una insignia «Demo» global de la maqueta tapa el final del texto del botón «Descargar ficha en PDF». También aparece sobre otros controles (p. ej. el selector de Contabilidad); no proviene del marcado del glosario.
- Efecto del filtro de imágenes: ninguna fila tiene hoy `image_review_status`, así que **las 6.394 fichas con URL de imagen dejan de mostrarla** en la lista, la ficha y el PDF, no sólo la del hueso genérico. Es una decisión de producto que debe confirmar el propietario.
- El PDF de «angiografía» tiene 27 páginas y tres imágenes realmente incrustadas, una en cada una de las páginas 25 a 27. Las capturas `angiografia-image-page.png`, `angiografia-first-page.png`, `sin-articulo-desktop.png` y `amigdalitis-mobile-viewport.png` permiten revisar el resultado.

**No se versionan** en este PR los archivos `evidencia/angiografia*` (PDF y capturas de un texto clínico generado, sin revisión médica) ni `evidencia/auditoria-por-termino.json` (6,2 MB): quedan solo en la copia local de quien los generó. La auditoría se regenera con `node scripts/glossary-publication-audit.mjs`.

La ficha curada de «angiografía» tiene 12.389 palabras y está marcada como texto original pendiente de revisión médica. Se compiló temporalmente en la semilla local para la prueba; no se publica como artículo terminado. Su referencia bibliográfica no valida cada afirmación de ese texto.

## Pendiente para el objetivo completo

La API y base reales del VPS no están inventariadas. Hay 19.313 definiciones locales por debajo de la longitud exigida, 5.859 sin artículo F9 y ninguna imagen de ficha con aprobación clínica explícita. Se requiere un flujo de investigación, redacción original, permisos de imagen y revisión profesional por lote antes de ingerir; las fuentes indexadas no otorgan automáticamente derechos de reproducción. Nada de esta rama está desplegado en Contabo. Ninguna ficha se declara terminada conforme al pedido de 150.000 palabras.
