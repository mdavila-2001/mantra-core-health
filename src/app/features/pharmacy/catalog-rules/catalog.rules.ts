import type {
  PharmacyProductChanges,
  PharmacyProductDraft,
  PharmacyProductIdentifier,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import {
  ArchivoInvalido,
  normalizarEncabezado,
  partirEnRenglones,
  detectarSeparador,
  sinApostrofoDeFormula,
} from '../../../shared/utils/csv-import/csv-import';

export {
  ArchivoInvalido,
  decodificarCsv,
  leerTablaCsv,
  type CodificacionDelCsv,
  type Renglon,
  type TablaCsv,
  type TextoDelCsv,
} from '../../../shared/utils/csv-import/csv-import';

/* ============================================================================
    Reglas puras del catálogo de la farmacia: qué es un producto bien cargado,
    cómo se lee un CSV y cómo se revisa cada fila antes de mandarla.

    Sin Angular a propósito: el formulario de alta y la importación masiva
    validan con **las mismas** reglas, y un spec las prueba sin TestBed.

    Los topes son los del `PharmacyCreateProductDto` del backend (código 1-100,
    marca y genérico ≤ 300, concentración y presentación ≤ 200). Repetirlos acá
    no autoriza nada —la API vuelve a validar—: sirve para que quien sube 300
    filas se entere de todos los problemas antes de mandar la primera.
    ========================================================================== */

/** Tope del código de producto (SKU), igual que `productCode` en el DTO. */
export const CODE_LONG_MAX = 100;
/** Tope de marca y genérico. */
export const NAME_LONG_MAX = 300;
/** Tope de concentración y presentación. */
export const DETAIL_LONG_MAX = 200;

/** Cuántas filas admite una carga. Cada fila es un `POST`, en serie. */
export const MAX_ROWS_BY_LOAD = 500;
/** Tamaño máximo del archivo: 500 filas de catálogo no llegan ni a 100 kB. */
export const FILE_MAX_BYTES = 1024 * 1024;
/** Tope de la descripción para el paciente. */
export const DESCRIPTION_LONG_MAX = 2000;
/** Precio máximo aceptado, en bolivianos: atrapa un separador de miles de más. */
export const MAX_PRICE = 1_000_000;

/** Las categorías de la vitrina: las del mockup del cliente. */
export const CATEGORIES = [
  'Medicamentos',
  'Dermocosmética',
  'Cuidado personal',
  'Bebé y maternidad',
  'Dispositivos',
  'Bienestar',
] as const;

/**
 * Lo que se carga de un producto, como texto tal cual se escribió.
 *
 * Es la forma común del formulario y de una fila del CSV: las dos terminan en
 * {@link reviewProduct}, que decide si hay un alta válida.
 */
export interface ProductFields {
  readonly codigo: string;
  readonly marca: string;
  readonly generico: string;
  readonly concentracion: string;
  readonly presentacion: string;
  /** `''` = no se declara; si no, sí/no en cualquiera de sus grafías. */
  readonly receta: string;
  readonly cadenaDeFrio: string;
  /** El GTIN impreso bajo el código de barras. Opcional. */
  readonly codigoDeBarras: string;
  /** Precio de venta en bolivianos, con punto o coma decimal. */
  readonly precio: string;
  /**
   * Una de las categorías permitidas —por defecto {@link CATEGORIES}; la
   * importación pasa las de la farmacia—, sin importar mayúsculas ni tildes.
   */
  readonly categoria: string;
  readonly descripcion: string;
  /**
   * Si hoy lo tiene: sí/no, «agotado», o un número de unidades (0 = no).
   * Vacío = sí: se carga lo que se vende.
   */
  readonly disponible: string;
}

export const EMPTY_FIELDS: ProductFields = {
  codigo: '',
  marca: '',
  generico: '',
  concentracion: '',
  presentacion: '',
  receta: '',
  cadenaDeFrio: '',
  codigoDeBarras: '',
  precio: '',
  categoria: '',
  descripcion: '',
  disponible: '',
};

/**
 * El producto del catálogo universal al que se vincula el alta. Con él,
 * nombre, concentración, presentación y receta son del registro oficial: el
 * formulario no los pide y la revisión no los exige ni los manda.
 */
export interface LinkWithCatalog {
  readonly catalogProductId: string;
  /** Código de la presentación elegida (CN, CUM…), si el producto tiene varias. */
  readonly presentationCode?: string;
}

/** El resultado de revisar un producto: el alta lista, o por qué no. */
export type ProductReview =
  | { readonly valido: true; readonly borrador: PharmacyProductDraft }
  | { readonly valido: false; readonly errores: readonly string[] };

/** Letra o número, seguido de letras, números, punto, guion, guion bajo o barra. */
const CODE_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N}._\-/]*$/u;

const YES = new Set(['si', 'sí', 's', 'true', '1', 'x', 'yes']);
const NO = new Set(['no', 'n', 'false', '0']);

/**
 * Revisa un producto y, si está bien, arma el alta.
 *
 * Devuelve **todos** los problemas de una vez: cortar en el primero obliga a
 * corregir y reintentar tantas veces como errores haya.
 */
export function reviewProduct(
  campos: ProductFields,
  categoriasPermitidas: readonly string[] = CATEGORIES,
  vinculo?: LinkWithCatalog,
): ProductReview {
  const errores: string[] = [];
  const codigo = campos.codigo.trim();
  const marca = campos.marca.trim();
  const generico = campos.generico.trim();
  const concentracion = campos.concentracion.trim();
  const presentacion = campos.presentacion.trim();
  const codigoDeBarras = campos.codigoDeBarras.replace(/\s+/g, '');
  const descripcion = campos.descripcion.trim();

  if (codigo === '') {
    errores.push('Falta el código del producto.');
  } else if (codigo.length > CODE_LONG_MAX) {
    errores.push(`El código no puede pasar de ${CODE_LONG_MAX} caracteres.`);
  } else if (!CODE_SHAPE.test(codigo)) {
    errores.push(
      'El código empieza con letra o número y sólo lleva letras, números, punto, guion o barra.',
    );
  }

  // Con vínculo al catálogo esto lo trae el registro oficial: ni se pide ni se revisa.
  const receta = vinculo === undefined ? yesOrNo(campos.receta) : null;
  if (vinculo === undefined) {
    if (marca === '' && generico === '') {
      errores.push('Ponga la marca, el nombre genérico o los dos: sin nombre nadie lo encuentra.');
    }
    if (marca.length > NAME_LONG_MAX) {
      errores.push(`La marca no puede pasar de ${NAME_LONG_MAX} caracteres.`);
    }
    if (generico.length > NAME_LONG_MAX) {
      errores.push(`El nombre genérico no puede pasar de ${NAME_LONG_MAX} caracteres.`);
    }
    if (concentracion.length > DETAIL_LONG_MAX) {
      errores.push(`La concentración no puede pasar de ${DETAIL_LONG_MAX} caracteres.`);
    }
    if (presentacion.length > DETAIL_LONG_MAX) {
      errores.push(`La presentación no puede pasar de ${DETAIL_LONG_MAX} caracteres.`);
    }
    if (receta === 'invalido') {
      errores.push('«Receta» se responde con sí o no.');
    }
  }
  const cadenaDeFrio = yesOrNo(campos.cadenaDeFrio);
  if (cadenaDeFrio === 'invalido') {
    errores.push('«Cadena de frío» se responde con sí o no.');
  }

  if (codigoDeBarras !== '' && !isValidGtin(codigoDeBarras)) {
    errores.push(
      'El código de barras tiene que ser un GTIN de 8, 12, 13 o 14 dígitos con su dígito verificador.',
    );
  }

  const precio = parsePrice(campos.precio);
  if (precio === 'invalido') {
    errores.push(
      `El precio va en bolivianos, mayor que 0 y hasta ${MAX_PRICE.toLocaleString('es-BO')}, con punto o coma y hasta dos decimales (sin separador de miles).`,
    );
  }
  const categoria = categoryOf(campos.categoria, categoriasPermitidas);
  if (categoria === 'invalido') {
    errores.push(
      categoriasPermitidas.length === 0
        ? 'Su farmacia todavía no tiene categorías: deje la categoría vacía o créela antes de importar.'
        : `La categoría tiene que ser una de estas: ${categoriasPermitidas.join(', ')}.`,
    );
  }
  if (descripcion.length > DESCRIPTION_LONG_MAX) {
    errores.push(`La descripción no puede pasar de ${DESCRIPTION_LONG_MAX} caracteres.`);
  }
  const disponible = availabilityOf(campos.disponible);
  if (disponible === 'invalido') {
    errores.push('«Disponible» se responde con sí, no, «agotado» o la cantidad que tiene.');
  }

  if (errores.length > 0) {
    return { valido: false, errores };
  }

  const identificadores: PharmacyProductIdentifier[] =
    codigoDeBarras === '' ? [] : [{ identifierType: 'GTIN', identifierValue: codigoDeBarras }];

  const nombrado =
    vinculo !== undefined
      ? {
          catalogProductId: vinculo.catalogProductId,
          ...(vinculo.presentationCode === undefined
            ? {}
            : { catalogPresentationCode: vinculo.presentationCode }),
        }
      : {
          ...(marca === '' ? {} : { brandName: marca }),
          ...(generico === '' ? {} : { genericName: generico }),
          ...(concentracion === '' ? {} : { strengthText: concentracion }),
          ...(presentacion === '' ? {} : { packageSizeText: presentacion }),
          ...(receta === null || receta === 'invalido' ? {} : { requiresPrescription: receta }),
        };

  return {
    valido: true,
    borrador: {
      productCode: codigo,
      ...nombrado,
      ...(cadenaDeFrio === null || cadenaDeFrio === 'invalido'
        ? {}
        : { coldChainRequired: cadenaDeFrio }),
      ...(identificadores.length === 0 ? {} : { identifiers: identificadores }),
      ...(precio === null || precio === 'invalido' ? {} : { unitPrice: precio }),
      ...(categoria === null || categoria === 'invalido' ? {} : { category: categoria }),
      ...(descripcion === '' ? {} : { description: descripcion }),
      inStock: disponible !== false,
    },
  };
}

/**
 * Los cambios que un alta revisada le hace a un producto que ya existe.
 *
 * - `completo` (el formulario de edición): lo que está vacío se **borra**,
 *   porque la persona lo vació a propósito.
 * - Sin `completo` (una fila del CSV): lo vacío **se deja como está**. Una
 *   planilla con la columna de precio en blanco no tiene que borrarle el
 *   precio a 300 productos.
 */
export function draftChanges(
  borrador: PharmacyProductDraft,
  completo: boolean,
  delCatalogo = false,
): PharmacyProductChanges {
  const valor = <T>(dato: T | undefined): T | null | undefined =>
    dato !== undefined ? dato : completo ? null : undefined;
  // Un producto del catálogo no manda lo oficial: el servidor lo rechazaría, y
  // vaciarlo («completo») sería borrarle el nombre a un registro sanitario.
  const oficiales: Record<string, unknown> = delCatalogo
    ? {}
    : {
        brandName: valor(borrador.brandName),
        genericName: valor(borrador.genericName),
        strengthText: valor(borrador.strengthText),
        packageSizeText: valor(borrador.packageSizeText),
        requiresPrescription: valor(borrador.requiresPrescription),
      };
  const cambios: Record<string, unknown> = {
    ...oficiales,
    unitPrice: valor(borrador.unitPrice),
    category: valor(borrador.category),
    description: valor(borrador.description),
    inStock: borrador.inStock ?? true,
  };
  return Object.fromEntries(
    Object.entries(cambios).filter(([, dato]) => dato !== undefined),
  ) as PharmacyProductChanges;
}

/** El precio escrito, en bolivianos: `null` = no se puso precio. Lo comparte la pestaña «Precios». */
export function parsePrice(texto: string): number | null | 'invalido' {
  const limpio = texto.trim().replace(/^bs\.?\s*/i, '');
  if (limpio === '') {
    return null;
  }
  if (!/^\d+([.,]\d{1,2})?$/.test(limpio)) {
    return 'invalido';
  }
  const numero = Number(limpio.replace(',', '.'));
  return numero > 0 && numero <= MAX_PRICE ? numero : 'invalido';
}

/** La categoría con su grafía canónica, o `null` si no se puso. */
function categoryOf(
  texto: string,
  permitidas: readonly string[],
): string | null | 'invalido' {
  const limpio = withoutAccents(texto.trim());
  if (limpio === '') {
    return null;
  }
  return permitidas.find((categoria) => withoutAccents(categoria) === limpio) ?? 'invalido';
}

/** Si la farmacia lo tiene hoy. Vacío = sí. */
function availabilityOf(texto: string): boolean | 'invalido' {
  const limpio = withoutAccents(texto.trim());
  if (limpio === '' || limpio === 'disponible' || limpio === 'en stock' || limpio === 'con stock') {
    return true;
  }
  if (limpio === 'agotado' || limpio === 'sin stock' || limpio === 'no disponible') {
    return false;
  }
  if (/^\d+$/.test(limpio)) {
    return Number(limpio) > 0;
  }
  const respuesta = yesOrNo(limpio);
  return respuesta === null || respuesta === 'invalido' ? 'invalido' : respuesta;
}

export function withoutAccents(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** `null` = no se declaró; así el backend guarda «sin dato» y no un «no» inventado. */
function yesOrNo(texto: string): boolean | null | 'invalido' {
  const limpio = texto.trim().toLowerCase();
  if (limpio === '') {
    return null;
  }
  if (YES.has(limpio)) {
    return true;
  }
  return NO.has(limpio) ? false : 'invalido';
}

/**
 * Un GTIN-8, 12 (UPC), 13 (EAN) o 14 con su dígito verificador GS1.
 *
 * El dígito verificador atrapa el error más común al tipear un código de
 * barras: un número cambiado o dos transpuestos.
 */
export function isValidGtin(texto: string): boolean {
  if (!/^\d+$/.test(texto) || ![8, 12, 13, 14].includes(texto.length)) {
    return false;
  }
  const digitos = [...texto].map(Number);
  const verificador = digitos.pop()!;
  // Desde la derecha, sin contar el verificador: pesos 3, 1, 3, 1…
  const suma = digitos
    .reverse()
    .reduce((total, digito, i) => total + digito * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === verificador;
}

/* ─── El CSV ──────────────────────────────────────────────────────────────── */

/** Una columna del CSV: su encabezado canónico y a qué campo va. */
interface CsvColumn {
  readonly encabezado: string;
  readonly campo: keyof ProductFields;
  /** Otras formas de llamarla que se aceptan, ya normalizadas. */
  readonly alias: readonly string[];
  readonly descripcion: string;
}

/** Las columnas, en el orden de la plantilla. */
export const CSV_COLUMNS: readonly CsvColumn[] = [
  {
    encabezado: 'codigo',
    campo: 'codigo',
    alias: ['sku', 'codigo_interno', 'codigo_de_producto', 'product_code'],
    descripcion: 'Obligatorio. Único en su catálogo.',
  },
  {
    encabezado: 'marca',
    campo: 'marca',
    alias: ['nombre', 'nombre_comercial', 'brand'],
    descripcion: 'Marca o nombre comercial.',
  },
  {
    encabezado: 'generico',
    campo: 'generico',
    alias: ['principio_activo', 'nombre_generico', 'generic'],
    descripcion: 'Nombre genérico o principio activo.',
  },
  {
    encabezado: 'concentracion',
    campo: 'concentracion',
    alias: ['dosis', 'strength'],
    descripcion: 'Ej. 500 mg.',
  },
  {
    encabezado: 'presentacion',
    campo: 'presentacion',
    alias: ['empaque', 'package'],
    descripcion: 'Ej. Caja x 20 comprimidos.',
  },
  {
    encabezado: 'receta',
    campo: 'receta',
    alias: ['requiere_receta', 'venta_bajo_receta'],
    descripcion: 'sí / no.',
  },
  {
    encabezado: 'cadena_frio',
    campo: 'cadenaDeFrio',
    alias: ['cadena_de_frio', 'refrigerado'],
    descripcion: 'sí / no.',
  },
  {
    encabezado: 'codigo_barras',
    campo: 'codigoDeBarras',
    alias: ['codigo_de_barras', 'gtin', 'ean', 'barcode'],
    descripcion: 'GTIN/EAN de 8, 12, 13 o 14 dígitos.',
  },
  {
    encabezado: 'precio',
    campo: 'precio',
    alias: ['precio_venta', 'precio_de_venta', 'pvp', 'price'],
    descripcion: 'En Bs. Ej. 18,50.',
  },
  {
    encabezado: 'categoria',
    campo: 'categoria',
    alias: ['rubro', 'category'],
    descripcion: CATEGORIES.join(' · '),
  },
  {
    encabezado: 'descripcion',
    campo: 'descripcion',
    alias: ['detalle', 'description'],
    descripcion: 'Lo que lee el paciente.',
  },
  {
    encabezado: 'disponible',
    campo: 'disponible',
    alias: ['stock', 'en_stock', 'hay_stock', 'disponibilidad', 'existencias'],
    descripcion: 'sí / no / agotado, o la cantidad (0 = sin stock). Vacío = sí.',
  },
];

/** Una fila del archivo, ya llevada a los campos del producto. */
export interface CsvRow {
  /**
   * La línea del archivo donde empieza la fila, contando el encabezado como
   * la 1: es el número que la persona ve a la izquierda en su planilla.
   */
  readonly numero: number;
  readonly campos: ProductFields;
  /** La fila no tiene la forma del encabezado; se rechaza sola, no el archivo. */
  readonly errorDeForma?: string;
}

/**
 * A qué campo del producto fue a parar cada encabezado del archivo.
 *
 * Es el mapeo que {@link readCsv} ya calculaba por dentro (encabezado o alias);
 * se expone para que la pantalla de importación lo muestre en vez de esconderlo.
 */
export interface CsvColumnMapping {
  /** El encabezado tal como venía escrito en el archivo (sin espacios a los lados). */
  readonly header: string;
  /** El campo del producto al que se asignó, o `null` si la columna se ignora. */
  readonly field: keyof ProductFields | null;
  /** El encabezado de la plantilla de ese campo; `null` si se ignora. */
  readonly canonicalHeader: string | null;
  /** Si coincidió con el encabezado de la plantilla o con uno de sus alias. */
  readonly matchedBy: 'HEADER' | 'ALIAS' | null;
}

/** Lo que se sacó del archivo. */
export interface CsvReading {
  readonly filas: readonly CsvRow[];
  /** Encabezados que no corresponden a ninguna columna: se avisan y se ignoran. */
  readonly ignoradas: readonly string[];
  /** Una entrada por columna del archivo, en su orden, con el campo asignado. */
  readonly columns: readonly CsvColumnMapping[];
}

/**
 * Lee un CSV de productos.
 *
 * - El separador se detecta en el encabezado entre coma, punto y coma y
 *   tabulador: Excel en castellano exporta con `;`.
 * - Comillas dobles al estilo RFC 4180, con `""` como comilla escapada y saltos
 *   de línea dentro de una celda entrecomillada.
 * - El BOM inicial se descarta y las filas en blanco no cuentan.
 * - Los encabezados se comparan sin mayúsculas, tildes ni espacios, y aceptan
 *   alias (`sku`, `principio_activo`, `gtin`…).
 *
 * Lanza {@link ArchivoInvalido} con un mensaje para la persona si el archivo no
 * se puede usar en absoluto; los problemas de una fila puntual no lanzan: los
 * cuenta {@link reviewLoad}.
 */
export function readCsv(contenido: string): CsvReading {
  const texto = contenido.replace(/^\uFEFF/, '');
  if (texto.trim() === '') {
    throw new ArchivoInvalido('El archivo está vacío.');
  }

  const renglones = partirEnRenglones(texto, detectarSeparador(texto));
  const [primero, ...datos] = renglones;
  // Excel deja columnas vacías al final del encabezado cuando alguna vez se
  // escribió más a la derecha: no son columnas, son restos.
  const encabezado = [...primero!.celdas];
  while (encabezado.length > 1 && encabezado[encabezado.length - 1]!.trim() === '') {
    encabezado.pop();
  }
  const nombres = encabezado.map(normalizarEncabezado);

  if (nombres.some((nombre) => nombre === '')) {
    throw new ArchivoInvalido('Todas las columnas necesitan un encabezado.');
  }
  if (new Set(nombres).size !== nombres.length) {
    throw new ArchivoInvalido('Hay dos columnas con el mismo encabezado.');
  }

  const destino = nombres.map((nombre) => columnByName(nombre)?.campo ?? null);
  if (!destino.includes('codigo')) {
    throw new ArchivoInvalido(
      'Falta la columna «codigo». Descargue la plantilla para ver los encabezados.',
    );
  }
  if (new Set(destino.filter((campo) => campo !== null)).size !== destino.filter((c) => c !== null).length) {
    throw new ArchivoInvalido('Dos encabezados apuntan al mismo dato (por ejemplo «sku» y «codigo»).');
  }

  if (datos.length === 0) {
    throw new ArchivoInvalido('El archivo tiene encabezado pero ningún producto.');
  }
  if (datos.length > MAX_ROWS_BY_LOAD) {
    throw new ArchivoInvalido(
      `El archivo tiene ${datos.length} productos y el tope por carga es ${MAX_ROWS_BY_LOAD}. Divídalo en varios archivos.`,
    );
  }

  const filas = datos.map(({ linea, celdas: crudas }): CsvRow => {
    // Las celdas vacías de más al final son el mismo resto que en el encabezado.
    const celdas = [...crudas];
    while (celdas.length > nombres.length && celdas[celdas.length - 1]!.trim() === '') {
      celdas.pop();
    }
    const campos: Record<keyof ProductFields, string> = { ...EMPTY_FIELDS };
    destino.forEach((campo, j) => {
      if (campo !== null) {
        campos[campo] = sinApostrofoDeFormula(celdas[j] ?? '');
      }
    });
    // Una fila mal formada se rechaza sola: tirar el archivo entero por una
    // coma de más en la fila 300 obligaba a empezar de cero.
    return celdas.length === nombres.length
      ? { numero: linea, campos }
      : {
          numero: linea,
          campos,
          errorDeForma: `Tiene ${celdas.length} columnas y el encabezado ${nombres.length}: revise si hay un separador de más o una comilla sin cerrar.`,
        };
  });

  const columns = encabezado.map((crudo, j): CsvColumnMapping => {
    const columna = columnByName(nombres[j]!);
    return {
      header: crudo.trim(),
      field: columna?.campo ?? null,
      canonicalHeader: columna?.encabezado ?? null,
      matchedBy: columna === undefined ? null : columna.encabezado === nombres[j] ? 'HEADER' : 'ALIAS',
    };
  });

  return {
    filas,
    ignoradas: encabezado.filter((_, j) => destino[j] === null).map((nombre) => nombre.trim()),
    columns,
  };
}

function columnByName(nombre: string): CsvColumn | undefined {
  return CSV_COLUMNS.find(
    (columna) => columna.encabezado === nombre || columna.alias.includes(nombre),
  );
}

/* ─── La revisión de la carga ─────────────────────────────────────────────── */

/** Por qué una fila no se va a mandar. */
export type RejectionReason =
  | 'INVALIDA'
  | 'REPETIDA_EN_EL_ARCHIVO'
  | 'YA_EN_EL_CATALOGO'
  | 'NO_EN_EL_CATALOGO';

/**
 * Qué hace una carga con los códigos del archivo según estén o no en el
 * catálogo: crear los nuevos y actualizar los que ya están, sólo crear (los
 * existentes se rechazan) o sólo actualizar (los nuevos se rechazan).
 */
export type LoadMode = 'CREAR_Y_ACTUALIZAR' | 'SOLO_CREAR' | 'SOLO_ACTUALIZAR';

/** Una fila revisada: lista para mandar, o con sus motivos. */
export type ReviewedRow =
  | {
      readonly numero: number;
      readonly campos: ProductFields;
      readonly lista: true;
      readonly borrador: PharmacyProductDraft;
      /** Alta nueva, o cambios a un producto que ya existe. */
      readonly accion: 'CREAR' | 'ACTUALIZAR';
      /** El producto a actualizar; `null` en un alta. */
      readonly productId: string | null;
    }
  | {
      readonly numero: number;
      readonly campos: ProductFields;
      readonly lista: false;
      readonly motivo: RejectionReason;
      readonly errores: readonly string[];
    };

/**
 * Revisa cada fila contra las reglas del producto, contra las demás filas y
 * contra el catálogo que ya existe.
 *
 * - **Un código repetido dentro del archivo se rechaza en todas sus filas**:
 *   elegir una por el orden sería decidir en silencio cuál vale.
 * - **Un código que ya está en el catálogo se actualiza** con lo que traiga
 *   la fila (en `CREAR_Y_ACTUALIZAR` y `SOLO_ACTUALIZAR`), o se rechaza (en
 *   `SOLO_CREAR`).
 * - **Un código que no está en el catálogo se crea** (en `CREAR_Y_ACTUALIZAR` y
 *   `SOLO_CREAR`), o se rechaza (en `SOLO_ACTUALIZAR`).
 * - La categoría se valida contra `categoriasPermitidas` (las de la farmacia
 *   que importa; por defecto las de {@link CATEGORIES}).
 */
export function reviewLoad(
  filas: readonly CsvRow[],
  catalogo: ReadonlyMap<string, string>,
  modo: LoadMode = 'CREAR_Y_ACTUALIZAR',
  categoriasPermitidas: readonly string[] = CATEGORIES,
): ReviewedRow[] {
  const vecesPorCodigo = new Map<string, number>();
  for (const fila of filas) {
    const codigo = fila.campos.codigo.trim();
    if (codigo !== '') {
      vecesPorCodigo.set(codigo, (vecesPorCodigo.get(codigo) ?? 0) + 1);
    }
  }

  return filas.map((fila): ReviewedRow => {
    if (fila.errorDeForma !== undefined) {
      return {
        numero: fila.numero,
        campos: fila.campos,
        lista: false,
        motivo: 'INVALIDA',
        errores: [fila.errorDeForma],
      };
    }
    const revision = reviewProduct(fila.campos, categoriasPermitidas);
    if (!revision.valido) {
      return { ...fila, lista: false, motivo: 'INVALIDA', errores: revision.errores };
    }
    const codigo = revision.borrador.productCode;
    if ((vecesPorCodigo.get(codigo) ?? 0) > 1) {
      return {
        ...fila,
        lista: false,
        motivo: 'REPETIDA_EN_EL_ARCHIVO',
        errores: [`El código ${codigo} aparece más de una vez en el archivo.`],
      };
    }
    const existente = catalogo.get(codigo);
    if (existente !== undefined) {
      return modo === 'SOLO_CREAR'
        ? {
            ...fila,
            lista: false,
            motivo: 'YA_EN_EL_CATALOGO',
            errores: [`El código ${codigo} ya está en su catálogo (eligió «solo crear nuevos»).`],
          }
        : { ...fila, lista: true, borrador: revision.borrador, accion: 'ACTUALIZAR', productId: existente };
    }
    if (modo === 'SOLO_ACTUALIZAR') {
      return {
        ...fila,
        lista: false,
        motivo: 'NO_EN_EL_CATALOGO',
        errores: [`El código ${codigo} no está en su catálogo (eligió «sólo actualizar»).`],
      };
    }
    return { ...fila, lista: true, borrador: revision.borrador, accion: 'CREAR', productId: null };
  });
}

/** Cómo se le llama a cada campo del producto cuando se le habla a la persona. */
export const FIELD_LABELS: Readonly<Record<keyof ProductFields, string>> = {
  codigo: 'Código interno (SKU)',
  marca: 'Marca o nombre comercial',
  generico: 'Nombre genérico',
  concentracion: 'Concentración',
  presentacion: 'Presentación',
  receta: 'Venta bajo receta',
  cadenaDeFrio: 'Cadena de frío',
  codigoDeBarras: 'Código de barras (GTIN)',
  precio: 'Precio de venta (Bs)',
  categoria: 'Categoría',
  descripcion: 'Descripción',
  disponible: 'Disponibilidad',
};

/** Tres filas de ejemplo para la plantilla: una con cada caso típico. */
export const EXAMPLE_ROWS: readonly ProductFields[] = [
  {
    codigo: 'PAR-500-20',
    marca: 'Paracetamol Ejemplo',
    generico: 'Paracetamol',
    concentracion: '500 mg',
    presentacion: 'Caja x 20 comprimidos',
    receta: 'no',
    cadenaDeFrio: 'no',
    codigoDeBarras: '',
    precio: '18,50',
    categoria: 'Medicamentos',
    descripcion: 'Analgésico y antifebril de venta libre.',
    disponible: 'sí',
  },
  {
    codigo: 'AMX-500-21',
    marca: '',
    generico: 'Amoxicilina',
    concentracion: '500 mg',
    presentacion: 'Caja x 21 cápsulas',
    receta: 'sí',
    cadenaDeFrio: 'no',
    codigoDeBarras: '',
    precio: '42',
    categoria: 'Medicamentos',
    descripcion: '',
    disponible: 'agotado',
  },
  {
    codigo: 'INS-NPH-10',
    marca: 'Insulina Ejemplo NPH',
    generico: 'Insulina humana isofánica',
    concentracion: '100 UI/ml',
    presentacion: 'Frasco de 10 ml',
    receta: 'sí',
    cadenaDeFrio: 'sí',
    codigoDeBarras: '',
    precio: '185',
    categoria: 'Medicamentos',
    descripcion: 'Mantener refrigerado entre 2 y 8 °C.',
    disponible: '12',
  },
];
