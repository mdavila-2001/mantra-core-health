import type {
  PharmacyProductDraft,
  PharmacyProductIdentifier,
} from '../../../core/data-access/pharmacy/pharmacy.types';

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
export const LARGO_MAXIMO_DEL_CODIGO = 100;
/** Tope de marca y genérico. */
export const LARGO_MAXIMO_DEL_NOMBRE = 300;
/** Tope de concentración y presentación. */
export const LARGO_MAXIMO_DEL_DETALLE = 200;

/** Cuántas filas admite una carga. Cada fila es un `POST`, en serie. */
export const FILAS_MAXIMAS_POR_CARGA = 500;
/** Tamaño máximo del archivo: 500 filas de catálogo no llegan ni a 100 kB. */
export const BYTES_MAXIMOS_DEL_ARCHIVO = 1024 * 1024;

/**
 * Lo que se carga de un producto, como texto tal cual se escribió.
 *
 * Es la forma común del formulario y de una fila del CSV: las dos terminan en
 * {@link revisarProducto}, que decide si hay un alta válida.
 */
export interface CamposDelProducto {
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
}

export const CAMPOS_VACIOS: CamposDelProducto = {
  codigo: '',
  marca: '',
  generico: '',
  concentracion: '',
  presentacion: '',
  receta: '',
  cadenaDeFrio: '',
  codigoDeBarras: '',
};

/** El resultado de revisar un producto: el alta lista, o por qué no. */
export type RevisionDelProducto =
  | { readonly valido: true; readonly borrador: PharmacyProductDraft }
  | { readonly valido: false; readonly errores: readonly string[] };

/** Letra o número, seguido de letras, números, punto, guion, guion bajo o barra. */
const FORMA_DEL_CODIGO = /^[\p{L}\p{N}][\p{L}\p{N}._\-/]*$/u;

const SI = new Set(['si', 'sí', 's', 'true', '1', 'x', 'yes']);
const NO = new Set(['no', 'n', 'false', '0']);

/**
 * Revisa un producto y, si está bien, arma el alta.
 *
 * Devuelve **todos** los problemas de una vez: cortar en el primero obliga a
 * corregir y reintentar tantas veces como errores haya.
 */
export function revisarProducto(campos: CamposDelProducto): RevisionDelProducto {
  const errores: string[] = [];
  const codigo = campos.codigo.trim();
  const marca = campos.marca.trim();
  const generico = campos.generico.trim();
  const concentracion = campos.concentracion.trim();
  const presentacion = campos.presentacion.trim();
  const codigoDeBarras = campos.codigoDeBarras.replace(/\s+/g, '');

  if (codigo === '') {
    errores.push('Falta el código del producto.');
  } else if (codigo.length > LARGO_MAXIMO_DEL_CODIGO) {
    errores.push(`El código no puede pasar de ${LARGO_MAXIMO_DEL_CODIGO} caracteres.`);
  } else if (!FORMA_DEL_CODIGO.test(codigo)) {
    errores.push(
      'El código empieza con letra o número y sólo lleva letras, números, punto, guion o barra.',
    );
  }

  if (marca === '' && generico === '') {
    errores.push('Ponga la marca, el nombre genérico o los dos: sin nombre nadie lo encuentra.');
  }
  if (marca.length > LARGO_MAXIMO_DEL_NOMBRE) {
    errores.push(`La marca no puede pasar de ${LARGO_MAXIMO_DEL_NOMBRE} caracteres.`);
  }
  if (generico.length > LARGO_MAXIMO_DEL_NOMBRE) {
    errores.push(`El nombre genérico no puede pasar de ${LARGO_MAXIMO_DEL_NOMBRE} caracteres.`);
  }
  if (concentracion.length > LARGO_MAXIMO_DEL_DETALLE) {
    errores.push(`La concentración no puede pasar de ${LARGO_MAXIMO_DEL_DETALLE} caracteres.`);
  }
  if (presentacion.length > LARGO_MAXIMO_DEL_DETALLE) {
    errores.push(`La presentación no puede pasar de ${LARGO_MAXIMO_DEL_DETALLE} caracteres.`);
  }

  const receta = siONo(campos.receta);
  if (receta === 'invalido') {
    errores.push('«Receta» se responde con sí o no.');
  }
  const cadenaDeFrio = siONo(campos.cadenaDeFrio);
  if (cadenaDeFrio === 'invalido') {
    errores.push('«Cadena de frío» se responde con sí o no.');
  }

  if (codigoDeBarras !== '' && !esGtinValido(codigoDeBarras)) {
    errores.push(
      'El código de barras tiene que ser un GTIN de 8, 12, 13 o 14 dígitos con su dígito verificador.',
    );
  }

  if (errores.length > 0) {
    return { valido: false, errores };
  }

  const identificadores: PharmacyProductIdentifier[] =
    codigoDeBarras === '' ? [] : [{ identifierType: 'GTIN', identifierValue: codigoDeBarras }];

  return {
    valido: true,
    borrador: {
      productCode: codigo,
      ...(marca === '' ? {} : { brandName: marca }),
      ...(generico === '' ? {} : { genericName: generico }),
      ...(concentracion === '' ? {} : { strengthText: concentracion }),
      ...(presentacion === '' ? {} : { packageSizeText: presentacion }),
      ...(receta === null || receta === 'invalido' ? {} : { requiresPrescription: receta }),
      ...(cadenaDeFrio === null || cadenaDeFrio === 'invalido'
        ? {}
        : { coldChainRequired: cadenaDeFrio }),
      ...(identificadores.length === 0 ? {} : { identifiers: identificadores }),
    },
  };
}

/** `null` = no se declaró; así el backend guarda «sin dato» y no un «no» inventado. */
function siONo(texto: string): boolean | null | 'invalido' {
  const limpio = texto.trim().toLowerCase();
  if (limpio === '') {
    return null;
  }
  if (SI.has(limpio)) {
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
export function esGtinValido(texto: string): boolean {
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
interface ColumnaDelCsv {
  readonly encabezado: string;
  readonly campo: keyof CamposDelProducto;
  /** Otras formas de llamarla que se aceptan, ya normalizadas. */
  readonly alias: readonly string[];
  readonly descripcion: string;
}

/** Las columnas, en el orden de la plantilla. */
export const COLUMNAS_DEL_CSV: readonly ColumnaDelCsv[] = [
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
];

/** Cómo venía codificado el archivo. */
export type CodificacionDelCsv = 'utf-8' | 'windows-1252';

/** El texto del archivo y con qué codificación se leyó. */
export interface TextoDelCsv {
  readonly texto: string;
  readonly codificacion: CodificacionDelCsv;
}

/**
 * Decodifica los bytes del archivo: UTF-8 si lo es de verdad, y si no,
 * Windows-1252.
 *
 * Excel en castellano guarda «CSV (delimitado por comas)» en Windows-1252, no
 * en UTF-8. Leído como UTF-8, cada tilde y cada eñe se vuelven «�» y el
 * producto se publica así — sin arreglo posible, porque el backend no edita y
 * el código retirado no se puede volver a usar. UTF-8 se decodifica en modo
 * estricto: un byte que no le corresponde no se reemplaza, lanza, y entonces
 * se relee como Windows-1252, que acepta cualquier byte.
 */
export function decodificarCsv(bytes: ArrayBuffer | Uint8Array): TextoDelCsv {
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes), codificacion: 'utf-8' };
  } catch {
    return { texto: new TextDecoder('windows-1252').decode(bytes), codificacion: 'windows-1252' };
  }
}

/** Un fallo que invalida el archivo entero, antes de mirar fila por fila. */
export class ArchivoInvalido extends Error {
  override readonly name = 'ArchivoInvalido';
}

/** Una fila del archivo, ya llevada a los campos del producto. */
export interface FilaDelCsv {
  /**
   * La línea del archivo donde empieza la fila, contando el encabezado como
   * la 1: es el número que la persona ve a la izquierda en su planilla.
   */
  readonly numero: number;
  readonly campos: CamposDelProducto;
  /** La fila no tiene la forma del encabezado; se rechaza sola, no el archivo. */
  readonly errorDeForma?: string;
}

/** Lo que se sacó del archivo. */
export interface LecturaDelCsv {
  readonly filas: readonly FilaDelCsv[];
  /** Encabezados que no corresponden a ninguna columna: se avisan y se ignoran. */
  readonly ignoradas: readonly string[];
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
 * cuenta {@link revisarCarga}.
 */
export function leerCsv(contenido: string): LecturaDelCsv {
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

  const destino = nombres.map((nombre) => columnaPorNombre(nombre)?.campo ?? null);
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
  if (datos.length > FILAS_MAXIMAS_POR_CARGA) {
    throw new ArchivoInvalido(
      `El archivo tiene ${datos.length} productos y el tope por carga es ${FILAS_MAXIMAS_POR_CARGA}. Divídalo en varios archivos.`,
    );
  }

  const filas = datos.map(({ linea, celdas: crudas }): FilaDelCsv => {
    // Las celdas vacías de más al final son el mismo resto que en el encabezado.
    const celdas = [...crudas];
    while (celdas.length > nombres.length && celdas[celdas.length - 1]!.trim() === '') {
      celdas.pop();
    }
    const campos: Record<keyof CamposDelProducto, string> = { ...CAMPOS_VACIOS };
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

  return {
    filas,
    ignoradas: encabezado.filter((_, j) => destino[j] === null).map((nombre) => nombre.trim()),
  };
}

/** El separador del archivo: el que más aparece en el encabezado, fuera de comillas. */
function detectarSeparador(texto: string): string {
  const cuentas: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let entreComillas = false;
  for (const caracter of texto) {
    if (caracter === '"') {
      entreComillas = !entreComillas;
    } else if (!entreComillas && (caracter === '\n' || caracter === '\r')) {
      break;
    } else if (!entreComillas && caracter in cuentas) {
      cuentas[caracter]!++;
    }
  }
  return Object.keys(cuentas).sort((a, b) => cuentas[b]! - cuentas[a]!)[0]!;
}

/** Un renglón del archivo: sus celdas y la línea donde empieza. */
interface Renglon {
  readonly linea: number;
  readonly celdas: string[];
}

/**
 * Parte el texto en renglones de celdas, respetando las comillas, y anota en
 * qué línea del archivo empieza cada uno (un salto dentro de comillas cuenta
 * como línea, igual que en la planilla).
 */
function partirEnRenglones(texto: string, separador: string): Renglon[] {
  const renglones: Renglon[] = [];
  let renglon: string[] = [];
  let celda = '';
  let entreComillas = false;
  let recienCerrada = false;
  let linea = 1;
  let inicio = 1;

  const cerrarCelda = (): void => {
    renglon.push(celda);
    celda = '';
    recienCerrada = false;
  };
  const cerrarRenglon = (): void => {
    cerrarCelda();
    if (renglon.some((valor) => valor.trim() !== '')) {
      renglones.push({ linea: inicio, celdas: renglon });
    }
    renglon = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i]!;
    if (entreComillas) {
      if (caracter === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else {
          entreComillas = false;
          recienCerrada = true;
        }
      } else {
        if (caracter === '\n' || (caracter === '\r' && texto[i + 1] !== '\n')) {
          linea++;
        }
        celda += caracter;
      }
      continue;
    }
    if (caracter === '"') {
      if (celda.trim() !== '' || recienCerrada) {
        throw new ArchivoInvalido(
          `Hay una comilla en medio de un valor (línea ${linea}).`,
        );
      }
      celda = '';
      entreComillas = true;
    } else if (caracter === separador) {
      cerrarCelda();
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && texto[i + 1] === '\n') {
        i++;
      }
      cerrarRenglon();
      linea++;
      inicio = linea;
    } else if (recienCerrada) {
      if (caracter.trim() !== '') {
        throw new ArchivoInvalido(
          `Hay texto después de cerrar las comillas (línea ${linea}).`,
        );
      }
    } else {
      celda += caracter;
    }
  }
  if (entreComillas) {
    throw new ArchivoInvalido('Hay comillas sin cerrar en el archivo.');
  }
  if (celda !== '' || renglon.length > 0) {
    cerrarRenglon();
  }
  return renglones;
}

/** `Código de barras` → `codigo_de_barras`. */
function normalizarEncabezado(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_');
}

function columnaPorNombre(nombre: string): ColumnaDelCsv | undefined {
  return COLUMNAS_DEL_CSV.find(
    (columna) => columna.encabezado === nombre || columna.alias.includes(nombre),
  );
}

/**
 * Deshace el apóstrofo que `CsvExportService` antepone a lo que parece una
 * fórmula: así el informe de errores que se descarga de acá se puede corregir
 * y volver a subir tal cual.
 */
function sinApostrofoDeFormula(valor: string): string {
  return /^'[=+\-@\t\r]/.test(valor) ? valor.slice(1) : valor;
}

/* ─── La revisión de la carga ─────────────────────────────────────────────── */

/** Por qué una fila no se va a mandar. */
export type MotivoDeRechazo = 'INVALIDA' | 'REPETIDA_EN_EL_ARCHIVO' | 'YA_EN_EL_CATALOGO';

/** Una fila revisada: lista para mandar, o con sus motivos. */
export type FilaRevisada =
  | {
      readonly numero: number;
      readonly campos: CamposDelProducto;
      readonly lista: true;
      readonly borrador: PharmacyProductDraft;
    }
  | {
      readonly numero: number;
      readonly campos: CamposDelProducto;
      readonly lista: false;
      readonly motivo: MotivoDeRechazo;
      readonly errores: readonly string[];
    };

/**
 * Revisa cada fila contra las reglas del producto, contra las demás filas y
 * contra el catálogo que ya existe.
 *
 * - **Un código repetido dentro del archivo se rechaza en todas sus filas**:
 *   elegir una por el orden sería decidir en silencio cuál vale.
 * - **Un código que ya está en el catálogo se rechaza**: el backend no publica
 *   una edición de producto, y mandarlo terminaría en un 409 igual.
 */
export function revisarCarga(
  filas: readonly FilaDelCsv[],
  codigosDelCatalogo: ReadonlySet<string>,
): FilaRevisada[] {
  const vecesPorCodigo = new Map<string, number>();
  for (const fila of filas) {
    const codigo = fila.campos.codigo.trim();
    if (codigo !== '') {
      vecesPorCodigo.set(codigo, (vecesPorCodigo.get(codigo) ?? 0) + 1);
    }
  }

  return filas.map((fila): FilaRevisada => {
    if (fila.errorDeForma !== undefined) {
      return {
        numero: fila.numero,
        campos: fila.campos,
        lista: false,
        motivo: 'INVALIDA',
        errores: [fila.errorDeForma],
      };
    }
    const revision = revisarProducto(fila.campos);
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
    if (codigosDelCatalogo.has(codigo)) {
      return {
        ...fila,
        lista: false,
        motivo: 'YA_EN_EL_CATALOGO',
        errores: [`El código ${codigo} ya está en su catálogo.`],
      };
    }
    return { ...fila, lista: true, borrador: revision.borrador };
  });
}

/** Tres filas de ejemplo para la plantilla: una con cada caso típico. */
export const FILAS_DE_EJEMPLO: readonly CamposDelProducto[] = [
  {
    codigo: 'PAR-500-20',
    marca: 'Paracetamol Ejemplo',
    generico: 'Paracetamol',
    concentracion: '500 mg',
    presentacion: 'Caja x 20 comprimidos',
    receta: 'no',
    cadenaDeFrio: 'no',
    codigoDeBarras: '',
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
  },
];
