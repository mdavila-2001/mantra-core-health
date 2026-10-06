import type { FilaDeGlosario, RelacionDeFila } from '../glossary-shards';
import { uuid } from '../mock-store';

/* ============================================================================
    Capa del glosario de la maqueta: modalidades, equipos de diagnóstico y el
    camino de sus datos (mockup, 2026-10-06).

    El glosario que sirve el simulador sale de shards pregenerados
    (`public/glossary-seed/`), armados con un repositorio de datos que no vive
    en este; por eso esta capa se suma en tiempo de ejecución
    (`AlmacenConCapasDeLaMaqueta`) en vez de regenerar los shards.

    Qué trae:

      - **Modalidades** (categoría `imaging`): ecografía, radiografía,
        resonancia, tomografía, mamografía, densitometría, electrocardiografía
        y toma de muestras. Cada una «Incluye» los estudios curados que ya
        existen en el glosario.
      - **Equipos** (categoría nueva `equipment`): cada tipo de equipo
        «Realiza» su modalidad y «Envía datos a» el primer eslabón de su
        cadena.
      - **Eslabones de datos** (misma categoría): imagen DICOM, archivo de
        imágenes (PACS/VNA), informe, resultado; y del lado del laboratorio
        muestra, mensaje del analizador y observación. Encadenados con «Envía
        datos a», arman el mapa que muestra la ficha de cada equipo.

    El camino de los datos es el que declara el modelo
    (`diagram_20_diagnostics.puml`: `imaging_studies` → `dicom_object_locations`
    en PACS/VNA → `dicom_structured_reports`; `analyzer_runs` →
    `analyzer_result_messages` → observación mapeada). **No** describe
    protocolos ni formatos de una marca de equipo: eso depende de cada
    integración y no se inventa acá.

    Todas las filas son `pending-medical-review`: texto de orientación escrito
    por desarrollo, igual que las capas de `data/glossary/`.
    ========================================================================== */

export const CATEGORIA_EQUIPOS = {
  key: 'equipment',
  internalCode: 'glossary-category-equipment',
  name: 'Equipos de diagnóstico',
  description: 'Los equipos que hacen los estudios y el camino que recorren sus datos hasta el resultado del paciente.',
} as const;

/** Tipos de relación que agrega esta capa. */
/** El `source` de cada fila de la capa: la marca con la que se la reconoce. */
export const FUENTE_DE_LA_CAPA = 'alovida-maqueta-2026-10-06';

export const RELACIONES_DE_EQUIPOS = ['INCLUDES', 'PERFORMS', 'SENDS_DATA_TO'] as const;

interface Termino {
  readonly slug: string;
  readonly categoryKey: 'imaging' | 'equipment';
  readonly esName: string;
  readonly synonyms?: readonly string[];
  readonly definition: string;
  readonly plainSummaryEs: string;
  readonly relations: readonly (readonly [type: (typeof RELACIONES_DE_EQUIPOS)[number], targetSlug: string])[];
}

const TERMINOS: readonly Termino[] = [
  /* ---- modalidades ------------------------------------------------------- */
  {
    slug: 'modalidad-ecografia',
    categoryKey: 'imaging',
    esName: 'Ecografía (modalidad)',
    synonyms: ['ultrasonido', 'ecografía'],
    definition: 'Modalidad de diagnóstico por imagen que obtiene imágenes del cuerpo con ultrasonido. Agrupa los estudios que se hacen con un ecógrafo.',
    plainSummaryEs: 'Todos los estudios que se hacen con un ecógrafo: abdominal, obstétrica, del corazón y otros.',
    relations: [
      ['INCLUDES', 'ecografia-abdominal'],
      ['INCLUDES', 'ecocardiograma'],
    ],
  },
  {
    slug: 'modalidad-radiografia',
    categoryKey: 'imaging',
    esName: 'Radiografía (modalidad)',
    synonyms: ['rayos X', 'radiología convencional'],
    definition: 'Modalidad de diagnóstico por imagen que usa rayos X para obtener una imagen plana del cuerpo.',
    plainSummaryEs: 'Los estudios que se hacen con un equipo de rayos X, como la placa de tórax.',
    relations: [['INCLUDES', 'radiografia-de-torax']],
  },
  {
    slug: 'modalidad-resonancia-magnetica',
    categoryKey: 'imaging',
    esName: 'Resonancia magnética (modalidad)',
    definition: 'Modalidad de diagnóstico por imagen que usa un campo magnético y ondas de radio para obtener imágenes detalladas.',
    plainSummaryEs: 'Los estudios que se hacen con un resonador.',
    relations: [['INCLUDES', 'resonancia-magnetica']],
  },
  {
    slug: 'modalidad-tomografia-computarizada',
    categoryKey: 'imaging',
    esName: 'Tomografía computarizada (modalidad)',
    synonyms: ['TAC', 'tomografía'],
    definition: 'Modalidad de diagnóstico por imagen que combina rayos X y procesamiento por computadora para obtener cortes del cuerpo.',
    plainSummaryEs: 'Los estudios que se hacen con un tomógrafo.',
    relations: [['INCLUDES', 'tomografia-computarizada']],
  },
  {
    slug: 'modalidad-mamografia',
    categoryKey: 'imaging',
    esName: 'Mamografía (modalidad)',
    definition: 'Modalidad de diagnóstico por imagen dedicada a la mama, con un equipo de rayos X específico.',
    plainSummaryEs: 'Los estudios de la mama que se hacen con un mamógrafo.',
    relations: [['INCLUDES', 'mamografia']],
  },
  {
    slug: 'modalidad-densitometria-osea',
    categoryKey: 'imaging',
    esName: 'Densitometría ósea (modalidad)',
    definition: 'Modalidad que mide la densidad mineral de los huesos con un densitómetro.',
    plainSummaryEs: 'Los estudios que miden la densidad de los huesos.',
    relations: [],
  },
  {
    slug: 'modalidad-electrocardiografia',
    categoryKey: 'imaging',
    esName: 'Electrocardiografía (modalidad)',
    definition: 'Modalidad que registra la actividad eléctrica del corazón con un electrocardiógrafo.',
    plainSummaryEs: 'Los estudios que registran la actividad eléctrica del corazón.',
    relations: [],
  },
  {
    slug: 'modalidad-toma-de-muestras',
    categoryKey: 'imaging',
    esName: 'Toma de muestras (modalidad)',
    synonyms: ['extracción', 'laboratorio'],
    definition: 'La atención en la que un laboratorio obtiene la muestra del paciente. Lo que limita los turnos son los puestos de extracción, no los analizadores.',
    plainSummaryEs: 'Cuando el laboratorio te saca sangre u otra muestra para analizarla después.',
    relations: [],
  },

  /* ---- equipos ------------------------------------------------------------ */
  {
    slug: 'equipo-ecografo',
    categoryKey: 'equipment',
    esName: 'Ecógrafo',
    definition: 'Equipo de diagnóstico por imagen por ultrasonido. Cada estudio genera imágenes DICOM que viajan al archivo de imágenes del centro.',
    plainSummaryEs: 'La máquina de las ecografías.',
    relations: [
      ['PERFORMS', 'modalidad-ecografia'],
      ['SENDS_DATA_TO', 'datos-imagen-dicom'],
    ],
  },
  {
    slug: 'equipo-rayos-x',
    categoryKey: 'equipment',
    esName: 'Equipo de rayos X',
    synonyms: ['radiografía digital'],
    definition: 'Equipo de radiografía. Cada estudio genera imágenes DICOM que viajan al archivo de imágenes del centro.',
    plainSummaryEs: 'La máquina de las placas.',
    relations: [
      ['PERFORMS', 'modalidad-radiografia'],
      ['SENDS_DATA_TO', 'datos-imagen-dicom'],
    ],
  },
  {
    slug: 'equipo-resonador-magnetico',
    categoryKey: 'equipment',
    esName: 'Resonador magnético',
    definition: 'Equipo de resonancia magnética. Cada estudio genera series de imágenes DICOM que viajan al archivo de imágenes del centro.',
    plainSummaryEs: 'La máquina de las resonancias.',
    relations: [
      ['PERFORMS', 'modalidad-resonancia-magnetica'],
      ['SENDS_DATA_TO', 'datos-imagen-dicom'],
    ],
  },
  {
    slug: 'equipo-tomografo',
    categoryKey: 'equipment',
    esName: 'Tomógrafo',
    definition: 'Equipo de tomografía computarizada. Cada estudio genera series de imágenes DICOM que viajan al archivo de imágenes del centro.',
    plainSummaryEs: 'La máquina de las tomografías.',
    relations: [
      ['PERFORMS', 'modalidad-tomografia-computarizada'],
      ['SENDS_DATA_TO', 'datos-imagen-dicom'],
    ],
  },
  {
    slug: 'equipo-mamografo',
    categoryKey: 'equipment',
    esName: 'Mamógrafo',
    definition: 'Equipo de mamografía. Cada estudio genera imágenes DICOM que viajan al archivo de imágenes del centro.',
    plainSummaryEs: 'La máquina de las mamografías.',
    relations: [
      ['PERFORMS', 'modalidad-mamografia'],
      ['SENDS_DATA_TO', 'datos-imagen-dicom'],
    ],
  },
  {
    slug: 'equipo-densitometro-oseo',
    categoryKey: 'equipment',
    esName: 'Densitómetro óseo',
    definition: 'Equipo que mide la densidad mineral ósea. Sus resultados se integran como imágenes e informes del estudio.',
    plainSummaryEs: 'La máquina que mide qué tan fuertes están los huesos.',
    relations: [
      ['PERFORMS', 'modalidad-densitometria-osea'],
      ['SENDS_DATA_TO', 'datos-imagen-dicom'],
    ],
  },
  {
    slug: 'equipo-puesto-de-extraccion',
    categoryKey: 'equipment',
    esName: 'Puesto de extracción',
    definition: 'El lugar donde el laboratorio toma la muestra del paciente. Cada muestra se rotula y queda trazada hasta el analizador.',
    plainSummaryEs: 'Donde te sacan la muestra en el laboratorio.',
    relations: [
      ['PERFORMS', 'modalidad-toma-de-muestras'],
      ['SENDS_DATA_TO', 'datos-muestra'],
    ],
  },
  {
    slug: 'equipo-analizador-de-laboratorio',
    categoryKey: 'equipment',
    esName: 'Analizador de laboratorio',
    synonyms: ['analizador hematológico', 'analizador bioquímico'],
    definition: 'Equipo que procesa las muestras en corridas y emite un mensaje de resultado por cada análisis pedido.',
    plainSummaryEs: 'La máquina que analiza las muestras.',
    relations: [['SENDS_DATA_TO', 'datos-mensaje-de-resultado']],
  },

  /* ---- eslabones de datos ------------------------------------------------ */
  {
    slug: 'datos-imagen-dicom',
    categoryKey: 'equipment',
    esName: 'Imagen DICOM',
    synonyms: ['DICOM'],
    definition: 'El formato estándar de las imágenes médicas. Cada estudio, serie e imagen se identifica con un código único (UID) que no cambia.',
    plainSummaryEs: 'Las imágenes del estudio, con un código que las identifica para siempre.',
    relations: [['SENDS_DATA_TO', 'datos-archivo-de-imagenes']],
  },
  {
    slug: 'datos-archivo-de-imagenes',
    categoryKey: 'equipment',
    esName: 'Archivo de imágenes (PACS/VNA)',
    synonyms: ['PACS', 'VNA'],
    definition: 'El sistema donde quedan guardadas las imágenes. La historia clínica guarda la referencia; las imágenes se consultan y descargan del archivo con DICOMweb.',
    plainSummaryEs: 'Donde quedan guardadas las imágenes de tus estudios.',
    relations: [['SENDS_DATA_TO', 'datos-informe-del-estudio']],
  },
  {
    slug: 'datos-muestra',
    categoryKey: 'equipment',
    esName: 'Muestra rotulada',
    definition: 'La muestra del paciente con su rótulo y su cadena de custodia, desde la extracción hasta el analizador.',
    plainSummaryEs: 'Tu muestra, con su etiqueta, camino al análisis.',
    relations: [['SENDS_DATA_TO', 'equipo-analizador-de-laboratorio']],
  },
  {
    slug: 'datos-mensaje-de-resultado',
    categoryKey: 'equipment',
    esName: 'Mensaje de resultado del analizador',
    definition: 'Lo que el analizador emite por cada análisis: se guarda tal cual llegó, con su huella de integridad, y se valida antes de usarse.',
    plainSummaryEs: 'El resultado que manda la máquina, antes de que alguien lo revise.',
    relations: [['SENDS_DATA_TO', 'datos-observacion']],
  },
  {
    slug: 'datos-observacion',
    categoryKey: 'equipment',
    esName: 'Observación de laboratorio',
    definition: 'El valor del análisis ya validado y asociado a la orden del paciente.',
    plainSummaryEs: 'El valor de tu análisis, ya revisado.',
    relations: [['SENDS_DATA_TO', 'datos-informe-del-estudio']],
  },
  {
    slug: 'datos-informe-del-estudio',
    categoryKey: 'equipment',
    esName: 'Informe del estudio',
    definition: 'El informe que firma el profesional. Se guarda en versiones que no se pisan: una corrección es una versión nueva.',
    plainSummaryEs: 'Lo que el profesional escribe sobre tu estudio.',
    relations: [['SENDS_DATA_TO', 'datos-resultado-del-paciente']],
  },
  {
    slug: 'datos-resultado-del-paciente',
    categoryKey: 'equipment',
    esName: 'Resultado del paciente',
    definition: 'El resultado liberado que el paciente ve en «Mis resultados» y puede compartir.',
    plainSummaryEs: 'Lo que ves en «Mis resultados».',
    relations: [],
  },
];

/** El id con el que se sirve un término de esta capa: el mismo esquema que los shards. */
export const idDeTermino = (slug: string): string => uuid(`concept-glossary-${slug}`);

/**
 * Las filas de la capa, con las relaciones resueltas. `externos` trae id y
 * nombre de los términos del glosario base a los que apunta (los estudios
 * curados); una relación a un término que no se encontró se descarta, igual
 * que hace el constructor de shards con los huérfanos.
 */
export function filasDeEquipos(externos: ReadonlyMap<string, { readonly id: string; readonly name: string }>): readonly FilaDeGlosario[] {
  const propios = new Map(TERMINOS.map((t) => [t.slug, { id: idDeTermino(t.slug), name: t.esName }]));
  return TERMINOS.map((t): FilaDeGlosario => ({
    id: idDeTermino(t.slug),
    slug: t.slug,
    code: `MAQUETA_${t.slug.toUpperCase().replace(/-/g, '_')}`,
    codeSystem: 'alovida-maqueta',
    categoryKey: t.categoryKey,
    tagKeys: [],
    lang: 'es',
    esName: t.esName,
    esSynonyms: t.synonyms ?? [],
    definition: t.definition,
    plainSummaryEs: t.plainSummaryEs,
    relations: t.relations.flatMap(([type, targetSlug]): RelacionDeFila[] => {
      const destino = propios.get(targetSlug) ?? externos.get(targetSlug);
      return destino === undefined ? [] : [{ type, targetSlug, targetId: destino.id, targetName: destino.name }];
    }),
    reviewStatus: 'pending-medical-review',
    source: FUENTE_DE_LA_CAPA,
  }));
}

/** Los slugs del glosario base a los que apunta esta capa. */
export const SLUGS_EXTERNOS: readonly string[] = [
  ...new Set(TERMINOS.flatMap((t) => t.relations.map(([, slug]) => slug)).filter((slug) => !TERMINOS.some((t) => t.slug === slug))),
];
