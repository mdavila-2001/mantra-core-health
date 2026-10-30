import { InjectionToken } from '@angular/core';
import type { jsPDF } from 'jspdf';

import type {
  CampoDeFormulario,
  PaginaDeFormulario,
} from '../../forms/paginated/paginated-form.types';
import {
  buildBlocksPdf,
  choicesBlock,
  noteBlock,
  type PdfBlock,
  type PdfExportOptions,
} from '../pdf-export/pdf-export';

/* ============================================================================
    El PDF de un formulario: el formulario **en blanco**, para imprimirlo.

    Mismo patrón que `quotation-pdf.ts`: se arman los
    bloques a mano y los maqueta `buildBlocksPdf`, que es el único maquetador
    del repo y el que pone el membrete con el logo. Así este papel sale con la
    misma identidad que la receta y la historia clínica, que es lo que se pidió:
    que el formulario propio se baje «en el formato en que se bajan nuestros
    PDF».

    ## Por qué en blanco, y no una captura del editor

    Lo que se descarga es el formulario **para completarlo**, no una foto de la
    pantalla donde se arma. Exportar el editor daría los botones «Duplicar» y
    «Borrar» de cada tarjeta, el presupuesto de campos propios y el aviso de
    licencia como si fueran parte del cuestionario. Acá cada pregunta sale con
    su renglón —o con sus casillas— y nada más.

    ## Las páginas son las de verdad

    El documento respeta las páginas que arma `paginarCampos`: las mismas que
    ve quien completa el formulario en pantalla, con el mismo tope de cuatro
    campos y los mismos rótulos —«(1 de 5)» incluido—. Un papel que agrupara
    las preguntas de otra forma dejaría de ser el mismo formulario.

    Y cada una **empieza en una hoja**, de la segunda en adelante: sin el corte,
    el rótulo de la página siguiente caía al pie de una carilla con sus
    preguntas en la de atrás. La primera comparte hoja con la identificación.

    ## Nada de casillas Unicode

    Las casillas de las opciones las dibuja el motor en vectores
    (`choicesBlock`): redondas si se marca una sola, cuadradas si varias. Las
    fuentes del documento no traen `☐` ni `◯`: un carácter así sale como un
    garabato o no sale, y el defecto aparece recién en el papel impreso. Dentro
    de una cuadrícula, donde la celda es texto, siguen siendo `( )` y `[ ]` en
    ASCII.
    ========================================================================== */

/** De dónde salió el formulario estándar, ya en palabras. */
export interface ProcedenciaParaPdf {
  /** Título del documento tal como lo publica el organismo. */
  readonly titulo: string;
  /** Organismo que lo publica. */
  readonly organizacion: string;
  /** Licencia bajo la que se puede usar. */
  readonly licencia: string;
}

/** Lo que hace falta para imprimir un formulario en blanco. */
export interface FormularioParaPdf {
  readonly nombre: string;
  readonly codigo: string;
  readonly version: number;
  /** La especialidad, si la pantalla pudo resolver su rótulo. */
  readonly especialidad: string | null;
  /**
   * Las páginas **tal como el motor las sirve**, ya paginadas.
   *
   * Se reciben armadas y no se vuelven a partir acá: la pantalla ya las tiene
   * calculadas con `paginarCampos`, y repetir el cálculo abriría la puerta a
   * que el papel y la pantalla discrepen en cuántas páginas tiene el
   * formulario.
   */
  readonly paginas: readonly PaginaDeFormulario[];
  /** Cuántos campos vienen del estándar internacional. */
  readonly camposEstandar: number;
  /** Cuántos agregó esta organización. */
  readonly camposPropios: number;
  /** De dónde salió el estándar, o `null` si la plantilla no lo declara. */
  readonly procedencia: ProcedenciaParaPdf | null;
  /** Quién lo bajó. Vacío si la sesión no expone un nombre. */
  readonly profesional: string;
}

/**
 * Cuántos renglones se dejan para escribir, según lo que se escribe encima.
 *
 * Una fecha, un teléfono o un número entran en un renglón; un texto libre
 * —un motivo de consulta, unos antecedentes— no, y apretarlo en uno deja la
 * respuesta escrita en el margen.
 */
const RENGLONES_POR_CONTROL: Readonly<Partial<Record<CampoDeFormulario['control'], number>>> = {
  text: 2,
  textarea: 4,
};

/** Los renglones de un dato corto —fecha, teléfono, correo, número—. */
const RENGLONES_POR_OMISION = 1;

/**
 * Cómo se escribe el dato, cuando el renglón solo no lo dice: en papel no hay
 * selector de fecha que imponga el formato.
 */
const FORMATO_A_MANO: Readonly<Partial<Record<CampoDeFormulario['control'], string>>> = {
  date: 'Formato: DD/MM/AAAA.',
  datetime: 'Formato: DD/MM/AAAA, HH:MM (24 horas).',
};

/** Lo que se lee antes de la primera pregunta. */
export const INSTRUCCIONES_DE_LLENADO =
  'Escriba en imprenta y marque con una X. Casilla redonda: una sola respuesta; casilla cuadrada: varias. Las preguntas con asterisco (*) son obligatorias al responder en el sistema.';

/**
 * Las líneas del documento, en orden de lectura.
 *
 * Exportada para que el spec fije **qué dice** el papel sin pasar por jsPDF,
 * que ya tiene sus propias pruebas en `pdf-export.spec.ts`.
 *
 * El nombre, el código, la versión, la especialidad, el conteo de preguntas y
 * quién lo descargó no se repiten acá: van en la portada (título, folio,
 * bajada y metadatos), que es donde se buscan.
 */
export function bloquesDeFormulario(datos: FormularioParaPdf): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [noteBlock(INSTRUCCIONES_DE_LLENADO, 'info', 'Cómo completar este formulario')];

  // La procedencia va en el papel y no solo en la pantalla: muchos de estos
  // formularios tienen derechos de autor, y una copia impresa que no diga de
  // quién es circula sin su licencia. Es la misma razón por la que el
  // generador la muestra junto al formulario. Va arriba y en letra chica,
  // como los créditos de un formulario impreso: al final quedaba sola en una
  // carilla propia, y como aviso empujaba las preguntas de la primera página a
  // una hoja más.
  if (datos.procedencia !== null) {
    const { titulo, organizacion, licencia } = datos.procedencia;
    bloques.push({ kind: 'caption', text: `Formulario estándar: ${titulo} · ${organizacion} · ${licencia}.` });
  }

  // La numeración es corrida y no por página: en el papel las preguntas se
  // citan por su número —«contestá la 7»—, y reiniciarla en cada rótulo daría
  // cinco preguntas número 1 en la misma hoja.
  // El número y el enunciado de cada pregunta, por clave: un «¿cuál?» en papel
  // tiene que decir de qué pregunta depende, y se la cita por su número.
  const citas = new Map<string, Cita>();
  let contador = 1;
  for (const pagina of datos.paginas) {
    for (const campo of pagina.campos) {
      citas.set(campo.key, { numero: contador, enunciado: campo.label });
      contador += 1;
    }
  }

  let numero = 1;
  datos.paginas.forEach((pagina, indice) => {
    // Una hoja por página del formulario, de la segunda en adelante: es lo que
    // evita que un rótulo —«(2 de 5)»— quede solo al pie de una carilla con
    // sus preguntas en la siguiente. La primera comparte hoja con la
    // identificación, que ocupa poco y no merece una carilla propia.
    if (indice > 0) {
      bloques.push({ kind: 'pagebreak', text: '' });
    }
    bloques.push(...bloquesDePagina(pagina, numero, citas));
    numero += pagina.campos.length;
  });

  if (datos.paginas.length === 0) {
    bloques.push(noteBlock('Este formulario todavía no tiene preguntas.', 'neutral'));
  }

  // Al final, quién lo completó y cuándo, a mano: es lo que un formulario en
  // papel pide para valer como constancia, y reemplaza al bloque de firma del
  // médico, que en un papel en blanco no corresponde (ver
  // `formTemplatePdfOptions`). Sin número: no es una pregunta del formulario.
  if (datos.paginas.length > 0) {
    bloques.push(...CONSTANCIA_DE_LLENADO);
  }

  return bloques;
}

/** Los renglones de la constancia de llenado, al final del formulario. */
export const CONSTANCIA_DE_LLENADO: readonly PdfBlock[] = [
  { kind: 'heading', level: 4, text: 'Nombre y firma de quien completa · Fecha (DD/MM/AAAA)' },
  { kind: 'blank', text: '', lines: 2 },
];

/** Cómo se cita una pregunta en el papel. */
interface Cita {
  readonly numero: number;
  readonly enunciado: string;
}

/** Una página del motor: su rótulo, su ayuda y sus preguntas. */
function bloquesDePagina(
  pagina: PaginaDeFormulario,
  desde: number,
  citas: ReadonlyMap<string, Cita>,
): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [
    { kind: 'heading', text: pagina.titulo === '' ? 'Preguntas' : pagina.titulo, level: 2 },
  ];

  if (pagina.hint !== undefined && pagina.hint !== '') {
    bloques.push({ kind: 'paragraph', text: pagina.hint });
  }

  pagina.campos.forEach((campo, indice) => {
    bloques.push(...bloquesDePregunta(campo, desde + indice, citas));
  });

  return bloques;
}

/**
 * Una pregunta: el enunciado numerado, su ayuda y el espacio para contestar.
 *
 * El enunciado va como encabezado de nivel 4 —negrita, cuerpo del texto— y no
 * como párrafo: en una hoja con doce preguntas seguidas, lo que deja
 * distinguir la pregunta de la respuesta escrita encima es el peso de la
 * letra.
 */
function bloquesDePregunta(
  campo: CampoDeFormulario,
  numero: number,
  citas: ReadonlyMap<string, Cita>,
): readonly PdfBlock[] {
  const marca = campo.required === true ? ' *' : '';
  const bloques: PdfBlock[] = [
    { kind: 'heading', text: `${numero}. ${campo.label}${marca}`, level: 4 },
  ];

  // En pantalla un «¿cuál?» aparece solo con el «sí»; en papel están todas las
  // preguntas a la vista, así que se dice cuándo se contesta.
  const padre = campo.showWhen === undefined ? undefined : citas.get(campo.showWhen.key);
  if (campo.showWhen !== undefined && padre !== undefined) {
    const { equals } = campo.showWhen;
    bloques.push({
      kind: 'caption',
      text:
        equals === undefined
          ? `Solo si en la ${padre.numero} («${padre.enunciado}») contestó algo.`
          : `Solo si en la ${padre.numero} («${padre.enunciado}») respondió ${enPalabrasLaCondicion(equals)}.`,
    });
  }

  const ayuda = campo.hint ?? campo.description;
  if (ayuda !== undefined && ayuda !== '') {
    bloques.push({ kind: 'caption', text: ayuda });
  }

  bloques.push(...espacioParaContestar(campo));
  return bloques;
}

/**
 * Con qué se contesta la pregunta en papel.
 *
 * Los de elección salen con sus opciones y una casilla por opción —cuadrada si
 * admite varias, redonda si es una sola—, incluso los que en pantalla son un
 * desplegable: en papel un desplegable no existe, y esconder las opciones
 * dejaría una pregunta sin respuestas posibles.
 */
function espacioParaContestar(campo: CampoDeFormulario): readonly PdfBlock[] {
  const opciones = campo.options ?? [];

  // La cuadrícula, primero: sus opciones son las **columnas**, y tratarlas como
  // una lista imprimiría la escala una sola vez y perdería las filas, que es lo
  // único que hay que contestar.
  const filas = campo.rows ?? [];
  if (filas.length > 0 && opciones.length > 0) {
    return cuadriculaEnPapel(campo, filas, opciones);
  }

  if (opciones.length > 0) {
    const varias = campo.control === 'checkboxes';
    const rotulos = opciones.map((opcion) => opcion.label);
    // «Otro» es una opción **y** un renglón: marcarla sin poder escribir al
    // lado la deja sin la respuesta que la lista no previó, que es lo único
    // para lo que existe.
    if (campo.otro === true) rotulos.push('Otro:');
    // Las casillas las dibuja el motor —redondas si es una sola, cuadradas si
    // son varias— y pone las opciones cortas en un renglón.
    const bloques: PdfBlock[] = [
      { kind: 'caption', text: varias ? 'Marque todas las que correspondan.' : 'Marque una sola opción.' },
      choicesBlock(rotulos, varias),
    ];
    if (campo.otro === true) {
      bloques.push({ kind: 'blank', text: '', lines: 1 });
    }
    return bloques;
  }

  if (
    campo.control === 'checkbox' ||
    campo.control === 'switch' ||
    campo.control === 'yes-no'
  ) {
    // Redondas: se contesta una sola de las dos, como dicen las instrucciones.
    return [choicesBlock(['Sí', 'No'], false)];
  }

  // Lo que no se escribe con una lapicera —el odontograma de la ficha
  // clínica— se dice, en vez de dejar un renglón que nadie puede llenar.
  if (campo.control === 'custom') {
    return [noteBlock('Este campo se completa en el sistema.', 'neutral')];
  }

  const formato = FORMATO_A_MANO[campo.control];
  return [
    ...(formato === undefined ? [] : [{ kind: 'caption' as const, text: formato }]),
    {
      kind: 'blank',
      text: '',
      lines: RENGLONES_POR_CONTROL[campo.control] ?? RENGLONES_POR_OMISION,
    },
  ];
}

/**
 * La cuadrícula en papel: una tabla con las columnas de cabecera y una casilla
 * por celda.
 *
 * Cuadrada o redonda según cuántas admita cada fila, igual que en la lista de
 * opciones. La restricción de «una respuesta por columna» se dice antes de la
 * tabla, junto con cómo marcar: en papel no hay nada que la impida, así que
 * hay que leerla antes de empezar a contestar.
 */
function cuadriculaEnPapel(
  campo: CampoDeFormulario,
  filas: readonly { readonly label: string }[],
  columnas: readonly { readonly label: string }[],
): readonly PdfBlock[] {
  const varias = campo.control === 'grid-checkboxes';
  const casilla = varias ? '[ ]' : '( )';
  const bloques: PdfBlock[] = [
    {
      kind: 'caption',
      text: [
        varias ? 'Marque en cada fila todas las columnas que correspondan.' : 'Marque una sola columna en cada fila.',
        // «Una por columna» dicho sin contradecir el «todas las que correspondan»
        // de la cuadrícula de casillas: lo que se limita es la columna.
        ...(campo.oneResponsePerColumn === true ? ['Cada columna se marca en una sola fila.'] : []),
      ].join(' '),
    },
    {
      kind: 'row',
      header: true,
      text: ['', ...columnas.map((columna) => columna.label)].join(' · '),
      cells: ['', ...columnas.map((columna) => columna.label)],
    },
    ...filas.map<PdfBlock>((fila) => ({
      kind: 'row',
      text: `${fila.label}: ${columnas.map(() => casilla).join(' ')}`,
      cells: [fila.label, ...columnas.map(() => casilla)],
    })),
  ];
  return bloques;
}

/**
 * Cuántas preguntas tiene y de dónde salen, corto para la columna de
 * metadatos de la portada: «14 · 11 del estándar y 3 propias». La frase larga
 * («14 preguntas · 11 del estándar y 3 de su organización») partía la columna
 * en tres renglones.
 */
function enPalabrasLosCamposCorto(datos: FormularioParaPdf): string {
  const total = datos.camposEstandar + datos.camposPropios;
  if (total === 0) return 'Ninguna';
  if (datos.camposPropios === 0) return `${total} · todas del estándar`;
  if (datos.camposEstandar === 0) return `${total} · todas propias`;
  const propias = datos.camposPropios === 1 ? '1 propia' : `${datos.camposPropios} propias`;
  return `${total} · ${datos.camposEstandar} del estándar y ${propias}`;
}

/**
 * Las opciones del documento: la portada y el pie.
 *
 * - **Sin `issuedAt`**: un formulario en blanco no se emite, se imprime. El
 *   motor rotula entonces «Fecha de generación», que es lo que la fecha es.
 * - **Sin firma** (`firma: null`): el papel sale en blanco, y la firma y el
 *   sello del médico de la sesión estampados sobre un formulario sin llenar
 *   avalarían respuestas que todavía no existen. Quien lo completa firma a mano
 *   en la constancia del final.
 * - **Papel claro** (`plainPaper`): es un papel que se imprime por tandas, casi
 *   siempre en una impresora de oficina en blanco y negro. La portada oscura
 *   salía como una banda de tóner gris que no dice nada y deja el título en
 *   gris sobre gris; en claro, el título y el folio quedan en negro sobre blanco.
 *
 * Exportada para que el spec fije la portada sin abrir el PDF.
 */
export function formTemplatePdfOptions(datos: FormularioParaPdf): PdfExportOptions {
  const especialidad = datos.especialidad?.trim() ?? '';
  return {
    title: datos.nombre,
    kind: 'Formulario en blanco',
    // La versión va en la bajada y no en los metadatos: un dato más en esa
    // columna alargaba la portada y empujaba la constancia a otra hoja.
    subtitle: [especialidad, `Versión ${datos.version}`, 'Para completar a mano'].filter((parte) => parte !== '').join(' · '),
    reference: datos.codigo,
    // Cuántas preguntas son del estándar y cuántas las agregó el consultorio: es
    // la diferencia entre un formulario comparable entre consultorios y uno
    // propio, y en el papel no se ve de ninguna otra forma.
    meta: [
      { label: 'Preguntas', value: enPalabrasLosCamposCorto(datos) },
      { label: 'Descargado por', value: datos.profesional },
    ],
    firma: null,
    plainPaper: true,
  };
}

/** Arma el PDF. No lo guarda: devuelve el documento. */
export function buildFormTemplatePdf(datos: FormularioParaPdf): jsPDF {
  return buildBlocksPdf(bloquesDeFormulario(datos), formTemplatePdfOptions(datos));
}

/**
 * Descarga el documento.
 *
 * El nombre lleva el código del formulario y la fecha: es lo que distingue una
 * copia de la de la semana pasada cuando el formulario ganó preguntas en el
 * medio, que con estos papeles pasa seguido.
 */
export function downloadFormTemplatePdf(datos: FormularioParaPdf): void {
  const hoy = new Date();
  const dia = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0'),
  ].join('-');
  buildFormTemplatePdf(datos).save(`${nombreDeArchivo(datos.codigo)}-${dia}.pdf`);
}

/** El código, en minúsculas y sin nada que un sistema de archivos discuta. */
function nombreDeArchivo(codigo: string): string {
  const limpio = codigo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return limpio === '' ? 'formulario' : limpio;
}

/**
 * La descarga como dependencia inyectable.
 *
 * Misma costura que `PROGRESS_NOTES_PDF_DOWNLOADER`: el sistema de pruebas de
 * Angular no admite `vi.mock` de un import relativo, y comprobar que la
 * pantalla exporta los datos correctos no debería abrir un PDF real ni
 * depender del orden de carga de `jspdf`.
 */
export const FORM_TEMPLATE_PDF_DOWNLOADER = new InjectionToken<
  (datos: FormularioParaPdf) => void
>('FORM_TEMPLATE_PDF_DOWNLOADER', {
  providedIn: 'root',
  factory: () => downloadFormTemplatePdf,
});

/** El valor de una condición, como se lee en papel: «Sí», «No», «A o B». */
function enPalabrasLaCondicion(
  equals: NonNullable<NonNullable<CampoDeFormulario['showWhen']>['equals']>,
): string {
  const valores: readonly (string | boolean)[] = Array.isArray(equals) ? equals : [equals];
  return valores
    .map((valor) => (valor === true ? '«Sí»' : valor === false ? '«No»' : `«${valor}»`))
    .join(' o ');
}
