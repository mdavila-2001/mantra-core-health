import type {
  LabCategory,
  LabImportRow,
  LabServiceDraft,
} from '../../../../core/data-access/lab-portal/lab-portal.types';
import {
  ArchivoInvalido,
  leerTablaCsv,
  normalizarEncabezado,
} from '../../../../shared/utils/csv-import/csv-import';

/* ============================================================================
    Carga masiva del catálogo del laboratorio: reglas puras, sin Angular.

    Registro de procesos 4.2: «La APP tiene que estar enlazada con el sistema
    del laboratorio donde tenga acceso a los precios de todos los servicios».
    Hasta que exista el enlace sistema a sistema, el laboratorio exporta su
    lista a CSV y la sube acá: `POST /diagnostics/lab/services/import` (P52).

    Se revisa en el navegador lo mismo que rechazaría la API (código y nombre
    obligatorios, código de hasta 40 caracteres y sin repetirse en el archivo,
    precio numérico, descuento de 0 a 100, horas enteras, categoría existente),
    para que el archivo llegue limpio. La API sigue siendo la autoridad: lo que
    rechace igual se muestra fila por fila en el resultado.

    Una columna que **no viene** en el archivo no se toca en los servicios que
    ya existen. Una que viene **vacía** en una fila deja ese dato vacío (sin
    categoría, sin descuento…), salvo los sí/no: vacío es «no se toca» en uno
    existente y el valor por omisión en uno nuevo.
    ========================================================================== */

/** El tope de la API (`Hasta 2000 filas por archivo`). */
export const LAB_IMPORT_MAX_ROWS = 2000;
/** 2000 filas de texto entran holgadas en 1 MB. */
export const LAB_IMPORT_MAX_BYTES = 1024 * 1024;
/** El tope de la API para el código. */
export const LAB_CODE_MAX_LENGTH = 40;
/** El mismo tope que la edición de precios: atrapa un cero de más. */
export const LAB_PRICE_MAX = 1_000_000;
export const LAB_IMPORT_TEMPLATE_NAME = 'plantilla-analisis-laboratorio.csv';

type LabImportField =
  | 'code'
  | 'name'
  | 'category'
  | 'sampleType'
  | 'preparation'
  | 'description'
  | 'price'
  | 'discount'
  | 'requiresMedicalOrder'
  | 'homeCollection'
  | 'turnaroundHours'
  | 'available';

/** Una columna de la plantilla: encabezado, alias aceptados y qué se espera. */
export interface LabImportColumn {
  readonly header: string;
  readonly field: LabImportField;
  readonly aliases: readonly string[];
  readonly required: boolean;
  readonly hint: string;
}

/** Las columnas, en el orden de la plantilla. */
export const LAB_IMPORT_COLUMNS: readonly LabImportColumn[] = [
  {
    header: 'codigo',
    field: 'code',
    aliases: ['code', 'cod', 'codigo_interno', 'codigo_del_analisis'],
    required: true,
    hint: `Su código interno, hasta ${LAB_CODE_MAX_LENGTH} caracteres. Si ya existe, se actualiza.`,
  },
  {
    header: 'nombre',
    field: 'name',
    aliases: ['name', 'analisis', 'servicio', 'estudio', 'nombre_del_analisis'],
    required: true,
    hint: 'Cómo lo ven los pacientes: «Hemograma completo».',
  },
  {
    header: 'categoria',
    field: 'category',
    aliases: ['category', 'area', 'seccion'],
    required: false,
    hint: 'Una de las categorías de su catálogo. Vacía: sin categoría.',
  },
  {
    header: 'tipo_muestra',
    field: 'sampleType',
    aliases: ['muestra', 'tipo_de_muestra', 'sample_type'],
    required: false,
    hint: '«Sangre venosa», «Orina», «Heces»…',
  },
  {
    header: 'preparacion',
    field: 'preparation',
    aliases: ['preparation', 'indicaciones'],
    required: false,
    hint: 'Lo que hace el paciente antes: «Ayuno de 8 horas».',
  },
  {
    header: 'descripcion',
    field: 'description',
    aliases: ['description', 'detalle'],
    required: false,
    hint: 'Una línea sobre qué mide el análisis. Opcional.',
  },
  {
    header: 'precio_bs',
    field: 'price',
    aliases: ['precio', 'price', 'precio_de_lista', 'precio_(bs)'],
    required: true,
    hint: 'Precio de lista en bolivianos, con punto o coma: 80 o 80,50.',
  },
  {
    header: 'descuento_alovida',
    field: 'discount',
    aliases: ['descuento', 'descuento_alovida_(%)', 'descuento_(%)', 'discount'],
    required: false,
    hint: 'Porcentaje de 0 a 100 para usuarios de AloVida. Vacío: sin descuento.',
  },
  {
    header: 'requiere_orden',
    field: 'requiresMedicalOrder',
    aliases: ['orden_medica', 'requiere_orden_medica'],
    required: false,
    hint: '«sí» o «no»: si el paciente necesita orden médica.',
  },
  {
    header: 'toma_a_domicilio',
    field: 'homeCollection',
    aliases: ['domicilio', 'a_domicilio', 'toma_domicilio'],
    required: false,
    hint: '«sí» o «no»: si van a tomar la muestra a la casa.',
  },
  {
    header: 'horas_resultado',
    field: 'turnaroundHours',
    aliases: ['horas', 'horas_de_entrega', 'tiempo_de_entrega', 'horas_hasta_el_resultado'],
    required: false,
    hint: 'Horas enteras hasta que el resultado está listo: 24.',
  },
  {
    header: 'disponible',
    field: 'available',
    aliases: ['available', 'se_hace_hoy'],
    required: false,
    hint: '«sí» o «no»: si hoy se puede hacer (reactivo, equipo).',
  },
];

/** Una fila de la plantilla, ya como texto de celda. */
export type LabImportSampleRow = Readonly<Record<LabImportField, string>>;

/** Dos análisis de ejemplo, con las categorías del catálogo sembrado. */
export const LAB_IMPORT_SAMPLE_ROWS: readonly LabImportSampleRow[] = [
  {
    code: 'LAB-FERRITINA',
    name: 'Ferritina sérica',
    category: 'Química sanguínea',
    sampleType: 'Sangre venosa',
    preparation: 'Ayuno de 8 horas',
    description: 'Mide las reservas de hierro.',
    price: '95.00',
    discount: '10',
    requiresMedicalOrder: 'no',
    homeCollection: 'sí',
    turnaroundHours: '24',
    available: 'sí',
  },
  {
    code: 'LAB-GRUPO-RH',
    name: 'Grupo sanguíneo y factor Rh',
    category: 'Hematología',
    sampleType: 'Sangre venosa',
    preparation: '',
    description: '',
    price: '40.00',
    discount: '',
    requiresMedicalOrder: 'no',
    homeCollection: 'no',
    turnaroundHours: '4',
    available: 'sí',
  },
];

/** Una fila revisada: lista para mandar, o con lo que hay que corregir. */
export type LabImportReviewRow =
  | {
      readonly line: number;
      readonly ok: true;
      readonly code: string;
      readonly name: string;
      /** Si el código ya está en el catálogo: se actualiza en vez de crearse. */
      readonly existing: boolean;
      readonly row: LabImportRow;
    }
  | {
      readonly line: number;
      readonly ok: false;
      readonly code: string;
      readonly name: string;
      readonly errors: readonly string[];
    };

/** Lo que salió de revisar el archivo entero. */
export interface LabImportReview {
  readonly rows: readonly LabImportReviewRow[];
  /** Encabezados que no son de ninguna columna: se avisan y se ignoran. */
  readonly ignoredColumns: readonly string[];
}

/** Lo que la revisión necesita saber del catálogo actual. */
export interface LabImportContext {
  /** Todos los códigos del catálogo, retirados incluidos (vuelven publicados). */
  readonly existingCodes: readonly string[];
  readonly categories: readonly Pick<LabCategory, 'id' | 'name'>[];
}

/** Las filas que se mandan, en el orden del archivo. */
export function validImportRows(review: LabImportReview): readonly LabImportRow[] {
  return review.rows.flatMap((row) => (row.ok ? [row.row] : []));
}

/**
 * Revisa un CSV de análisis **sin mandar nada**.
 *
 * Lanza {@link ArchivoInvalido} si el archivo entero no sirve (vacío, sin una
 * columna obligatoria, dos encabezados al mismo dato, más de
 * {@link LAB_IMPORT_MAX_ROWS} filas). Los problemas de una fila no lanzan:
 * quedan en su fila.
 */
export function reviewLabServicesCsv(content: string, context: LabImportContext): LabImportReview {
  const table = leerTablaCsv(content, LAB_IMPORT_MAX_ROWS);
  const targets = table.encabezados.map((header) => columnFor(header)?.field ?? null);

  for (const column of LAB_IMPORT_COLUMNS) {
    if (column.required && !targets.includes(column.field)) {
      throw new ArchivoInvalido(
        `Falta la columna «${column.header}». Descargue la plantilla para ver los encabezados.`,
      );
    }
  }
  const mapped = targets.filter((field) => field !== null);
  if (new Set(mapped).size !== mapped.length) {
    throw new ArchivoInvalido(
      'Dos encabezados apuntan al mismo dato (por ejemplo «precio» y «precio_bs»).',
    );
  }

  const existing = new Set(context.existingCodes.map((code) => code.trim().toLowerCase()));
  const categories = new Map(context.categories.map((c) => [textKey(c.name), c.id]));
  const categoryNames = context.categories.map((c) => c.name).join(', ');
  const seen = new Set<string>();

  const rows = table.renglones.map((renglon): LabImportReviewRow => {
    const has = (field: LabImportField): boolean => targets.includes(field);
    const cell = (field: LabImportField): string => {
      const index = targets.indexOf(field);
      return index === -1 ? '' : (renglon.celdas[index] ?? '').trim();
    };

    const errors: string[] = [];
    const code = cell('code');
    const name = cell('name').replace(/\s+/g, ' ');
    const service: { -readonly [K in keyof LabServiceDraft]: LabServiceDraft[K] } = {
      code,
      name,
      price: '',
    };

    if (code === '') {
      errors.push('Falta el código.');
    } else if (code.length > LAB_CODE_MAX_LENGTH) {
      errors.push(`El código pasa de ${LAB_CODE_MAX_LENGTH} caracteres.`);
    } else if (seen.has(code.toLowerCase())) {
      errors.push('El código se repite más arriba en el mismo archivo.');
    } else {
      seen.add(code.toLowerCase());
    }
    if (name === '') {
      errors.push('Falta el nombre.');
    }

    const price = parseAmount(cell('price'));
    if (price === 'invalid') {
      errors.push(
        `El precio va en bolivianos, de 0 a ${LAB_PRICE_MAX.toLocaleString('es-BO')}, con hasta dos decimales.`,
      );
    } else {
      service.price = price.toFixed(2);
    }

    if (has('discount')) {
      const discount = parseDiscount(cell('discount'));
      if (discount === 'invalid') {
        errors.push('El descuento es un número de 0 a 100, o vacío si no hay.');
      } else {
        service.alovidaDiscountPercent = discount;
      }
    }

    if (has('category')) {
      const text = cell('category');
      if (text === '') {
        service.categoryId = null;
      } else {
        const id = categories.get(textKey(text));
        if (id === undefined) {
          errors.push(
            categoryNames === ''
              ? `La categoría «${text}» no existe: todavía no tiene categorías.`
              : `La categoría «${text}» no existe. Use una de: ${categoryNames}.`,
          );
        } else {
          service.categoryId = id;
        }
      }
    }

    if (has('turnaroundHours')) {
      const text = cell('turnaroundHours');
      if (text === '') {
        service.turnaroundHours = null;
      } else if (/^\d{1,5}$/.test(text)) {
        service.turnaroundHours = Number(text);
      } else {
        errors.push('Las horas hasta el resultado van en un número entero: 24.');
      }
    }

    for (const field of ['sampleType', 'preparation', 'description'] as const) {
      if (has(field)) {
        service[field] = cell(field) === '' ? null : cell(field);
      }
    }

    const requiresMedicalOrder = parseYesNo(cell('requiresMedicalOrder'));
    const homeCollection = parseYesNo(cell('homeCollection'));
    const available = parseYesNo(cell('available'));
    if (requiresMedicalOrder === 'invalid') {
      errors.push('«requiere_orden» va con «sí» o «no».');
    } else if (requiresMedicalOrder !== null) {
      service.requiresMedicalOrder = requiresMedicalOrder;
    }
    if (homeCollection === 'invalid') {
      errors.push('«toma_a_domicilio» va con «sí» o «no».');
    } else if (homeCollection !== null) {
      service.homeCollection = homeCollection;
    }
    if (available === 'invalid') {
      errors.push('«disponible» va con «sí» o «no».');
    } else if (available !== null) {
      service.available = available;
    }

    if (errors.length > 0) {
      return { line: renglon.linea, ok: false, code, name, errors };
    }
    return {
      line: renglon.linea,
      ok: true,
      code,
      name,
      existing: existing.has(code.toLowerCase()),
      row: { line: renglon.linea, service },
    };
  });

  return {
    rows,
    ignoredColumns: table.encabezados.filter((_, index) => targets[index] === null),
  };
}

function columnFor(header: string): LabImportColumn | undefined {
  const normalized = normalizarEncabezado(header);
  return LAB_IMPORT_COLUMNS.find(
    (column) => column.header === normalized || column.aliases.includes(normalized),
  );
}

/** Mayúsculas, tildes y espacios de más no cambian una categoría. */
function textKey(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Un monto en bolivianos de 0 a {@link LAB_PRICE_MAX}, con punto o coma y hasta dos decimales. */
function parseAmount(text: string): number | 'invalid' {
  const clean = text.trim().replace(/^bs\.?\s*/i, '');
  if (!/^\d+([.,]\d{1,2})?$/.test(clean)) {
    return 'invalid';
  }
  const value = Number(clean.replace(',', '.'));
  return value <= LAB_PRICE_MAX ? value : 'invalid';
}

/** Un porcentaje de 0 a 100; vacío es «sin descuento» (`null`). */
function parseDiscount(text: string): number | null | 'invalid' {
  const clean = text.trim().replace(/%$/, '').trim();
  if (clean === '') {
    return null;
  }
  if (!/^\d+([.,]\d{1,2})?$/.test(clean)) {
    return 'invalid';
  }
  const value = Number(clean.replace(',', '.'));
  return value <= 100 ? value : 'invalid';
}

const YES = new Set(['si', 's', 'yes', 'y', 'true', 'verdadero', '1', 'x']);
const NO = new Set(['no', 'n', 'false', 'falso', '0']);

/** «sí»/«no» y sus variantes; vacío es `null` (no se toca). */
function parseYesNo(text: string): boolean | null | 'invalid' {
  const key = textKey(text);
  if (key === '') {
    return null;
  }
  if (YES.has(key)) {
    return true;
  }
  return NO.has(key) ? false : 'invalid';
}
