import { InjectionToken } from '@angular/core';
import type { jsPDF } from 'jspdf';

import type {
  CampoDeFormulario,
  PaginaDeFormulario,
} from '../../forms/paginated/paginated-form.types';
import { buildBlocksPdf, campoDeBloque, type PdfBlock } from '../pdf-export/pdf-export';

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

    Las casillas se dibujan `[ ]` y `( )`, en ASCII. Las fuentes que trae jsPDF
    codifican en Latin-1: un `☐` sale como un garabato o directamente no sale,
    y el defecto aparece recién en el papel impreso. Ver también el mismo
    cuidado en `pdf-theme.ts` sobre lo que sobrevive una fotocopia.
    ========================================================================== */

/** Cómo se imprime una fecha. Local y en palabras: lo lee gente. */
const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

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

/** Cuántos renglones se dejan para escribir, según lo que se pregunta. */
const RENGLONES_POR_CONTROL: Readonly<Partial<Record<CampoDeFormulario['control'], number>>> = {
  textarea: 3,
};

/** Los renglones de cualquier campo de escribir que no pida otra cosa. */
const RENGLONES_POR_OMISION = 1;

/**
 * Las líneas del documento, en orden de lectura.
 *
 * Exportada para que el spec fije **qué dice** el papel sin pasar por jsPDF,
 * que ya tiene sus propias pruebas en `pdf-export.spec.ts`.
 */
export function bloquesDeFormulario(datos: FormularioParaPdf): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [
    {
      kind: 'note',
      text: 'Formulario en blanco, para completar a mano. Las preguntas marcadas con asterisco son obligatorias cuando se responde en el sistema.',
    },
    { kind: 'heading', text: 'El formulario', level: 2 },
    campoDeBloque('Código', datos.codigo),
    campoDeBloque('Versión', String(datos.version)),
  ];

  if (datos.especialidad !== null && datos.especialidad.trim() !== '') {
    bloques.push(campoDeBloque('Especialidad', datos.especialidad));
  }

  // Cuántas preguntas son del estándar y cuántas las agregó el consultorio: es
  // la diferencia entre un formulario comparable entre consultorios y uno
  // propio, y en el papel no se ve de ninguna otra forma.
  bloques.push(campoDeBloque('Preguntas', enPalabrasLosCampos(datos)));

  if (datos.profesional.trim() !== '') {
    bloques.push(campoDeBloque('Descargado por', datos.profesional));
  }

  // La numeración es corrida y no por página: en el papel las preguntas se
  // citan por su número —«contestá la 7»—, y reiniciarla en cada rótulo daría
  // cinco preguntas número 1 en la misma hoja.
  let numero = 1;
  datos.paginas.forEach((pagina, indice) => {
    // Una hoja por página del formulario, de la segunda en adelante: es lo que
    // evita que un rótulo —«(2 de 5)»— quede solo al pie de una carilla con
    // sus preguntas en la siguiente. La primera comparte hoja con la
    // identificación, que ocupa poco y no merece una carilla propia.
    if (indice > 0) {
      bloques.push({ kind: 'pagebreak', text: '' });
    }
    bloques.push(...bloquesDePagina(pagina, numero));
    numero += pagina.campos.length;
  });

  if (datos.paginas.length === 0) {
    bloques.push({
      kind: 'paragraph',
      text: 'Este formulario todavía no tiene preguntas.',
    });
  }

  // La procedencia va en el papel y no sólo en la pantalla: muchos de estos
  // formularios tienen derechos de autor, y una copia impresa que no diga de
  // quién es circula sin su licencia. Es la misma razón por la que el
  // generador la muestra junto al formulario.
  if (datos.procedencia !== null) {
    const { titulo, organizacion, licencia } = datos.procedencia;
    bloques.push({
      kind: 'note',
      text: `Formulario estándar: ${titulo} · ${organizacion} · ${licencia}.`,
    });
  }

  bloques.push({
    kind: 'caption',
    text: `Documento generado el ${FORMATO_FECHA.format(new Date())} desde AloVida.`,
  });

  return bloques;
}

/** Una página del motor: su rótulo, su ayuda y sus preguntas. */
function bloquesDePagina(pagina: PaginaDeFormulario, desde: number): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [
    { kind: 'heading', text: pagina.titulo === '' ? 'Preguntas' : pagina.titulo, level: 2 },
  ];

  if (pagina.hint !== undefined && pagina.hint !== '') {
    bloques.push({ kind: 'paragraph', text: pagina.hint });
  }

  pagina.campos.forEach((campo, indice) => {
    bloques.push(...bloquesDePregunta(campo, desde + indice));
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
function bloquesDePregunta(campo: CampoDeFormulario, numero: number): readonly PdfBlock[] {
  const marca = campo.required === true ? ' *' : '';
  const bloques: PdfBlock[] = [
    { kind: 'heading', text: `${numero}. ${campo.label}${marca}`, level: 4 },
  ];

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
    const casilla = campo.control === 'checkboxes' ? '[ ]' : '( )';
    const bloques: PdfBlock[] = opciones.map((opcion) => ({
      kind: 'paragraph' as const,
      text: `${casilla} ${opcion.label}`,
    }));
    // «Otro» es una opción **y** un renglón: marcarla sin poder escribir al
    // lado la deja sin la respuesta que la lista no previó, que es lo único
    // para lo que existe.
    if (campo.otro === true) {
      bloques.push({ kind: 'paragraph', text: `${casilla} Otro:` });
      bloques.push({ kind: 'blank', text: '' });
    }
    return bloques;
  }

  if (
    campo.control === 'checkbox' ||
    campo.control === 'switch' ||
    campo.control === 'yes-no'
  ) {
    return [{ kind: 'paragraph', text: '[ ] Sí    [ ] No' }];
  }

  // Lo que no se escribe con una lapicera —el odontograma de la ficha
  // clínica— se dice, en vez de dejar un renglón que nadie puede llenar.
  if (campo.control === 'custom') {
    return [{ kind: 'caption', text: 'Este campo se completa en el sistema.' }];
  }

  return [
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
 * opciones. La restricción de «una respuesta por columna» se dice debajo: en
 * papel no hay nada que la impida, así que hay que leerla.
 */
function cuadriculaEnPapel(
  campo: CampoDeFormulario,
  filas: readonly { readonly label: string }[],
  columnas: readonly { readonly label: string }[],
): readonly PdfBlock[] {
  const casilla = campo.control === 'grid-checkboxes' ? '[ ]' : '( )';
  const bloques: PdfBlock[] = [
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

  if (campo.oneResponsePerColumn === true) {
    bloques.push({ kind: 'caption', text: 'Sólo una respuesta por columna.' });
  }
  return bloques;
}

/** «14 preguntas · 11 del estándar y 3 de tu organización». */
function enPalabrasLosCampos(datos: FormularioParaPdf): string {
  const total = datos.camposEstandar + datos.camposPropios;
  const preguntas = `${total} ${total === 1 ? 'pregunta' : 'preguntas'}`;
  if (datos.camposPropios === 0) {
    return `${preguntas}, todas del estándar`;
  }
  if (datos.camposEstandar === 0) {
    return `${preguntas}, todas de tu organización`;
  }
  return `${preguntas} · ${datos.camposEstandar} del estándar y ${datos.camposPropios} de tu organización`;
}

/** Arma el PDF. No lo guarda: devuelve el documento. */
export function buildFormTemplatePdf(datos: FormularioParaPdf): jsPDF {
  return buildBlocksPdf(bloquesDeFormulario(datos), {
    title: datos.nombre,
    kind: 'Formulario',
    reference: datos.codigo,
    subtitle: `Versión ${datos.version} · ${FORMATO_FECHA.format(new Date())}`,
  });
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
