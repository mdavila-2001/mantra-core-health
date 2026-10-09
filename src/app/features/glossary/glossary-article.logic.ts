import type {
  GlossaryArticle,
  GlossaryArticleFact,
  GlossaryArticleImage,
  GlossaryArticleSection,
  GlossaryOmittedBlock,
  GlossarySectionKind,
} from '../../core/data-access/terminology/glossary-article.types';

/**
 * Título en castellano de cada `kind` de sección (TAREA-41 §12.3).
 *
 * Son rótulos neutros de la pantalla, no texto médico: el contenido de cada
 * sección es el de la fuente, y la línea de cita de cada una lo dice.
 */
export const TITULO_DE_SECCION: Readonly<Record<GlossarySectionKind, string>> = {
  definition: 'Qué es',
  overview: 'Resumen',
  symptoms: 'Síntomas',
  causes: 'Causas',
  risk_factors: 'Factores de riesgo',
  diagnosis: 'Diagnóstico',
  treatment_overview: 'Tratamiento',
  complications: 'Complicaciones',
  prevention: 'Prevención',
  prognosis: 'Pronóstico',
  when_to_seek_care: 'Cuándo consultar',
  epidemiology: 'Frecuencia',
  genetics: 'Genética',
  classification: 'Tipos y clasificación',
  associated_conditions: 'Enfermedades asociadas',
  red_flags: 'Signos de alarma',
  self_care: 'Cuidados en casa',
  location: 'Ubicación',
  structure: 'Estructura',
  function: 'Función',
  blood_supply: 'Irrigación',
  innervation: 'Inervación',
  clinical_relevance: 'Importancia clínica',
  related_structures: 'Estructuras relacionadas',
  indications: 'Para qué se indica',
  contraindications: 'Contraindicaciones',
  adverse_effects: 'Reacciones adversas',
  interactions: 'Interacciones',
  pregnancy_lactation: 'Embarazo y lactancia',
  special_populations: 'Poblaciones especiales',
  pharmacologic_class: 'Clase farmacológica',
  presentations: 'Presentaciones',
  purpose: 'Para qué sirve',
  preparation: 'Preparación',
  procedure_description: 'Cómo se realiza',
  risks: 'Riesgos',
  interpretation: 'Resultados',
  reference_values: 'Valores de referencia',
  recovery: 'Recuperación',
  alternatives: 'Alternativas',
  scope: 'Alcance',
  conditions_treated: 'Enfermedades que atiende',
  subspecialties: 'Subespecialidades',
  training: 'Formación',
  transmission: 'Cómo se transmite',
  side_effects: 'Efectos secundarios',
  effects: 'Efectos',
  benefits: 'Beneficios',
  how_it_works: 'Cómo funciona',
  safe_use: 'Uso seguro',
  what_to_expect: 'Qué esperar',
  importance: 'Por qué importa',
  considerations: 'Consideraciones',
  additional_information: 'Más información de la fuente',
};

/** Nombre legible de cada fuente por su identificador corto; uno desconocido se muestra tal cual. */
const NOMBRE_DE_FUENTE: Readonly<Record<string, string>> = {
  'nlm-medlineplus-es': 'MedlinePlus en español (NLM)',
  'nlm-medlineplus-es-pruebas': 'MedlinePlus, pruebas de laboratorio (NLM)',
};

export function nombreDeFuente(source: string): string {
  return NOMBRE_DE_FUENTE[source] ?? source;
}

/** Por qué un bloque de la fuente no se muestra. */
const MOTIVO_DE_OMISION: Readonly<Record<string, string>> = {
  'dose-or-posology': 'contiene dosis o posología, que este glosario no publica',
  'adam-encyclopedia-link': 'remite a una enciclopedia con licencia propia',
};

/** `2026-10-09` → `09/10/2026`. Una forma distinta se muestra tal cual. */
export function fechaLegible(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return partes === null ? iso : `${partes[3]}/${partes[2]}/${partes[1]}`;
}

/**
 * Las imágenes que se pueden mostrar.
 *
 * Una `label-match` (enlazada por el nombre del ítem de Wikidata, no por un
 * identificador) queda apagada hasta que una revisión humana por muestreo la
 * apruebe (DECISIONS.md, 2026-10-09, D3): se descarta por `match` y por
 * `enabled === false`. Una imagen cuya URL, miniatura o página de origen no es `https://` tampoco
 * se pinta. El enlace de licencia es opcional (las de dominio público no lo
 * traen, y Commons publica los de CC con `http://`): si existe, tiene que ser
 * `http(s)://`; nunca `javascript:` ni `data:`.
 */
export function imagenesVisibles(
  imagenes: readonly GlossaryArticleImage[],
): readonly GlossaryArticleImage[] {
  return imagenes.filter(
    (imagen) =>
      imagen.enabled !== false &&
      imagen.match !== 'label-match' &&
      [imagen.url, imagen.thumbUrl, imagen.sourcePage].every(
        (enlace) => enlaceSeguro(enlace) !== null,
      ) &&
      (imagen.licenseUrl === null || enlaceWeb(imagen.licenseUrl) !== null),
  );
}

/** «Extracto» y su motivo, dicho con las palabras de la pantalla; `null` si la sección es completa. */
export function motivoDeExtracto(seccion: GlossaryArticleSection): string | null {
  if (seccion.excerpt !== true) return null;
  const motivos = (seccion.omitted ?? []).map(frase);
  return motivos.length === 0
    ? 'La fuente trae más texto que el que se muestra.'
    : `${motivos.join(' ')} Puede leer la sección completa en la fuente.`;
}

function frase(bloque: GlossaryOmittedBlock): string {
  const motivo = MOTIVO_DE_OMISION[bloque.reason] ?? `motivo «${bloque.reason}»`;
  const cuantos =
    bloque.paragraphs === 1 ? 'Se omitió 1 párrafo' : `Se omitieron ${bloque.paragraphs} párrafos`;
  return `${cuantos} porque ${motivo}.`;
}

/** Un bloque de lectura de una sección: párrafo, lista con viñetas o tabla. */
export type BloqueDeTexto =
  | { readonly tipo: 'parrafo'; readonly texto: string }
  | { readonly tipo: 'lista'; readonly elementos: readonly string[] }
  | { readonly tipo: 'tabla'; readonly filas: readonly (readonly string[])[] };

const SEPARADOR_DE_CELDAS = ' | ';
const VINETA = /^[•·]\s+/;

/**
 * Parte el texto literal de una sección en bloques para pintarlo.
 *
 * El texto no se reescribe: se parte en los párrafos en blanco que ya trae. Un
 * párrafo de sólo viñetas es una lista; uno cuyas líneas llevan « | » es una
 * tabla (una fila por línea, `table: true`).
 */
export function bloquesDeTexto(texto: string): readonly BloqueDeTexto[] {
  return texto
    .split(/\n{2,}/)
    .map((parrafo) => parrafo.trim())
    .filter((parrafo) => parrafo !== '')
    .map((parrafo): BloqueDeTexto => {
      const lineas = parrafo.split('\n').map((linea) => linea.trim());
      if (lineas.every((linea) => VINETA.test(linea))) {
        return { tipo: 'lista', elementos: lineas.map((linea) => linea.replace(VINETA, '')) };
      }
      if (lineas.every((linea) => linea.includes(SEPARADOR_DE_CELDAS))) {
        return { tipo: 'tabla', filas: lineas.map((linea) => linea.split(SEPARADOR_DE_CELDAS)) };
      }
      return { tipo: 'parrafo', texto: lineas.join(' ') };
    });
}

/** Una sección lista para pintar. */
export interface SeccionPintable {
  readonly ancla: string;
  readonly titulo: string;
  /** El encabezado de la fuente, cuando dice algo que el título no. */
  readonly encabezadoDeLaFuente: string | null;
  readonly seccion: GlossaryArticleSection;
  readonly bloques: readonly BloqueDeTexto[];
  readonly extracto: string | null;
  readonly sinTraduccion: boolean;
  /** Nombre en el índice: el título, más el encabezado de la fuente si el título se repite. */
  readonly entradaDelIndice: string;
}

const sinAdorno = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[¿?¡!]/g, '')
    .trim()
    .toLowerCase();

export function seccionesPintables(articulo: GlossaryArticle): readonly SeccionPintable[] {
  const repetidos = new Map<string, number>();
  for (const seccion of articulo.sections) {
    repetidos.set(seccion.kind, (repetidos.get(seccion.kind) ?? 0) + 1);
  }
  return articulo.sections.map((seccion, indice) => {
    const titulo = TITULO_DE_SECCION[seccion.kind] ?? TITULO_DE_SECCION.additional_information;
    const locator = seccion.locator.trim();
    const dice =
      locator !== '' && sinAdorno(locator) !== sinAdorno(titulo) && sinAdorno(locator) !== 'introduccion';
    const encabezado = dice ? locator : null;
    const repetido = (repetidos.get(seccion.kind) ?? 0) > 1;
    return {
      ancla: `seccion-${indice + 1}`,
      titulo,
      encabezadoDeLaFuente: encabezado,
      seccion,
      bloques: bloquesDeTexto(seccion.text),
      extracto: motivoDeExtracto(seccion),
      sinTraduccion: seccion.lang === 'en',
      entradaDelIndice: repetido && encabezado !== null ? `${titulo} · ${encabezado}` : titulo,
    };
  });
}

/** Los nombres y enlaces distintos de las fuentes de los datos (`facts`). */
export function fuentesDeLosDatos(
  datos: readonly GlossaryArticleFact[],
): readonly { readonly nombre: string; readonly url: string }[] {
  const vistas = new Map<string, { nombre: string; url: string }>();
  for (const dato of datos) {
    if (!vistas.has(dato.sourceUrl)) {
      vistas.set(dato.sourceUrl, { nombre: nombreDeFuente(dato.source), url: dato.sourceUrl });
    }
  }
  return [...vistas.values()];
}

/** Sólo `https://`: la URL de una fuente nunca se pinta como `javascript:` ni `data:`. */
export function enlaceSeguro(url: string): string | null {
  return /^https:\/\//i.test(url) ? url : null;
}

/** Un enlace que no ejecuta código: `http://` o `https://` (los enlaces de licencia de Commons son `http://`). */
export function enlaceWeb(url: string | null | undefined): string | null {
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}
