import { ATTR } from '../tracing/tracing.constants';

/**
 * Lo que se puede contar de un archivo.
 *
 * ## Lo que **no** viaja, y por qué es tan estricto acá
 *
 * El nombre del archivo. Ni recortado, ni con la extensión sola conservada
 * aparte, ni convertido a hash. En un sistema de salud un nombre de archivo es
 * de las peores filtraciones posibles: la gente sube cosas llamadas
 * `analisis-ana-perez-marzo.pdf` o `receta-diabetes.jpg`. Ese solo texto lleva
 * un nombre completo y un diagnóstico.
 *
 * Un hash tampoco sirve: es reversible por fuerza bruta contra una lista de
 * nombres probables, y aunque no lo fuera, permite reconocer que el mismo
 * archivo se subió dos veces, que ya es información.
 *
 * Tampoco viaja el contenido, ni la ruta local, ni los metadatos EXIF —que en
 * una foto de teléfono traen coordenadas—, ni la URL firmada de descarga.
 *
 * ## Lo que sí, y para qué sirve
 *
 * | Atributo | Para qué |
 * |---|---|
 * | `file.extension` | Un tipo que falla siempre al subir |
 * | `file.mime.type` | Lo mismo, desde el otro lado |
 * | `file.size.bucket` | Si lo que falla son los archivos grandes |
 *
 * El tamaño va en **cubetas** y no en bytes a propósito. Un tamaño exacto es
 * casi un identificador: cruzado con la hora, distingue una subida concreta
 * entre miles. La cubeta responde igual de bien la única pregunta que
 * interesa —«¿fallan los grandes?»— sin señalar a nadie.
 */

/** Las cubetas, de menor a mayor. El límite es exclusivo. */
const BUCKETS: readonly (readonly [number, string])[] = [
  [1_000_000, '0-1MB'],
  [5_000_000, '1-5MB'],
  [20_000_000, '5-20MB'],
  [100_000_000, '20-100MB'],
];

const LARGEST_BUCKET = '100MB+';

/** Atributos de un archivo, listos para un span. */
export function fileAttributes(file: File): Record<string, string> {
  return {
    [ATTR.fileExtension]: extensionOf(file.name),
    [ATTR.fileMimeType]: file.type === '' ? 'desconocido' : file.type,
    [ATTR.fileSizeBucket]: sizeBucket(file.size),
  };
}

/**
 * Extensiones que se pueden publicar tal cual.
 *
 * Es una **lista blanca**, y la primera versión de esto no la tenía: se tomaba
 * lo que hubiera después del último punto, acotado en longitud. Una prueba lo
 * tumbó con el caso que importa — un archivo llamado `informe.de.ana.perez`
 * daba `perez` como «extensión», es decir, un apellido publicado en un span—.
 *
 * Con lista blanca ese caso sale como `otra` y no hay forma de que un nombre de
 * persona se cuele por acá. El coste es que una extensión legítima que no esté
 * en la lista se agrupa bajo `otra`, y ese coste es aceptable: la pregunta que
 * esto responde es «¿qué tipo de archivo falla al subir?», y para eso `otra`
 * sigue sirviendo como categoría.
 *
 * `dcm` está porque es DICOM, el formato de imagen médica.
 */
const KNOWN_EXTENSIONS: ReadonlySet<string> = new Set([
  // Documentos
  'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'csv', 'xls', 'xlsx', 'ods',
  // Imágenes
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff', 'svg',
  // Imagen médica
  'dcm',
  // Contenedores
  'zip',
]);

/** Lo que se informa cuando la extensión no está en la lista blanca. */
const OTHER_EXTENSION = 'otra';

/** Lo que se informa cuando no hay extensión que leer. */
const NO_EXTENSION = 'desconocida';

/**
 * La extensión, en minúsculas y sin el punto — si está en la lista blanca.
 *
 * Cualquier otra cosa sale como `otra`. Ver {@link KNOWN_EXTENSIONS} para el
 * caso concreto que obliga a que sea así.
 */
export function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return NO_EXTENSION;
  }

  const extension = fileName.slice(lastDot + 1).toLowerCase();
  return KNOWN_EXTENSIONS.has(extension) ? extension : OTHER_EXTENSION;
}

/** La cubeta de tamaño. */
export function sizeBucket(bytes: number): string {
  for (const [limit, name] of BUCKETS) {
    if (bytes < limit) {
      return name;
    }
  }
  return LARGEST_BUCKET;
}
