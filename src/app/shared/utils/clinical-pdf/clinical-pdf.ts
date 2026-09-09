import type { jsPDF } from 'jspdf';

import { buildBlocksPdf, campoDeBloque, type PdfBlock } from '../pdf-export/pdf-export';
import type {
  DocumentoBloque,
  DocumentoDeAtencion,
  DocumentoDeFormulario,
  DocumentoDeHistoria,
  DocumentoDeOrden,
  DocumentoDeReceta,
  DocumentoMedicamento,
  DocumentoPaciente,
  DocumentoProfesional,
  RespuestaDeFormulario,
} from './clinical-pdf.types';

/* ============================================================================
    Los documentos clínicos en papel: receta, historia de una atención, orden
    de estudio, formulario respondido e historia completa.

    ## Qué decide este archivo y qué no

    Acá se decide **qué dice** cada documento y en qué orden: los datos de
    cabecera, las secciones, cómo se nombra un vacío. Cómo se ve —el membrete
    con el logo, la filigrana, los filetes, la numeración de páginas— lo decide
    el maquetador de `pdf-export.ts`, que es uno solo para todo el repo. Esa
    separación es la que evita que la receta y el comprobante salgan con dos
    identidades distintas de la misma clínica.

    ## Los datos van como datos, no como frases

    Cada dato de cabecera es un bloque `field` con su etiqueta y su valor
    aparte, y los medicamentos son filas de una tabla. El maquetador los alinea
    en columnas, así que la vista baja por los valores sin tropezar con
    «Paciente:», «Documento:», «Profesional:» repetidos. `text` sigue diciendo
    la línea completa —«Paciente: Ana Quispe»— para quien quiera leer el
    documento sin conocer los tipos.

    ## Los dos los descargan las dos partes

    El mismo generador lo llama el expediente del profesional (carril 08) y el
    archivo del paciente (carril 09). No hay una versión «del médico» y otra
    «del paciente»: es el mismo hecho clínico, y dos versiones distintas del
    mismo documento es exactamente el problema que un sistema de salud no puede
    permitirse.
    ========================================================================== */

/** Cómo se imprime una fecha en los documentos. Local, no ISO: lo lee gente. */
const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/** La fecha sola, para las bajadas del membrete. */
const FORMATO_DIA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

/** Lo que se imprime cuando el dato no está. Nunca un hueco en blanco. */
const SIN_DATO = 'No registrado';

/**
 * El pie que declara qué es este papel.
 *
 * Importa que esté: un documento clínico sin fecha de emisión ni origen es un
 * papel que nadie puede fechar después, y el que lo recibe no sabe si mira lo
 * último o algo de hace un año.
 */
function pieDeDocumento(): string {
  return `Documento generado el ${FORMATO_FECHA.format(new Date())} desde el sistema.`;
}

/** Arma el PDF de una receta. No la guarda: devuelve el documento. */
export function buildPrescriptionPdf(receta: DocumentoDeReceta): jsPDF {
  return buildBlocksPdf(bloquesDeReceta(receta), {
    title: 'Receta médica',
    kind: 'Receta médica',
    subtitle: bajada(receta.paciente.nombre, receta.creadaEl),
  });
}

/**
 * Descarga la receta.
 *
 * El nombre del archivo lleva la fecha y el final del identificador: dos
 * recetas del mismo día no pueden pisarse en la carpeta de descargas.
 */
export function downloadPrescriptionPdf(receta: DocumentoDeReceta): void {
  buildPrescriptionPdf(receta).save(nombreDeArchivo('receta', receta.creadaEl, receta.id));
}

/** Arma el PDF de la historia de una atención. */
export function buildVisitPdf(atencion: DocumentoDeAtencion): jsPDF {
  return buildBlocksPdf(bloquesDeAtencion(atencion), {
    title: 'Historia clínica de la atención',
    kind: 'Atención',
    subtitle: bajada(atencion.paciente.nombre, atencion.cierre ?? atencion.inicio),
  });
}

/** Descarga la historia de la atención. */
export function downloadVisitPdf(atencion: DocumentoDeAtencion): void {
  buildVisitPdf(atencion).save(
    nombreDeArchivo('atencion', atencion.cierre ?? atencion.inicio ?? new Date(), atencion.id),
  );
}

/** Arma el PDF de una orden de laboratorio o imagen. */
export function buildOrderPdf(orden: DocumentoDeOrden): jsPDF {
  return buildBlocksPdf(bloquesDeOrden(orden), {
    title: 'Orden de estudio',
    kind: 'Orden de estudio',
    subtitle: bajada(orden.paciente.nombre, orden.pedidaEl),
  });
}

/** Descarga la orden, para llevarla al laboratorio. */
export function downloadOrderPdf(orden: DocumentoDeOrden): void {
  buildOrderPdf(orden).save(nombreDeArchivo('orden', orden.pedidaEl, orden.id));
}

/** Arma el PDF de la historia completa del paciente. */
export function buildHistoryPdf(historia: DocumentoDeHistoria): jsPDF {
  return buildBlocksPdf(bloquesDeHistoria(historia), {
    title: 'Historia clínica',
    kind: 'Historia clínica',
    subtitle: bajada(historia.paciente.nombre, new Date()),
  });
}

/**
 * Descarga la historia completa.
 *
 * El nombre lleva el apellido y la fecha —`historia-perez-2026-08-18.pdf`— y no
 * el identificador: este archivo lo abre la persona en su carpeta de descargas,
 * no un sistema, y un sufijo hexadecimal no le dice nada. Es lo que pide el
 * carril.
 */
export function downloadHistoryPdf(historia: DocumentoDeHistoria): void {
  buildHistoryPdf(historia).save(nombreLegible('historia', historia.paciente.nombre, new Date()));
}

/**
 * Lo que el papel dice donde el backend no expuso el valor por una regla de
 * acceso. La pantalla usa la misma frase: un marcador distinto en el PDF y en
 * el DOM se leería como dos hechos distintos.
 */
export const VALOR_ENMASCARADO = 'No disponible por reglas de acceso';

/** Arma el PDF de un formulario clínico respondido. */
export function buildFormResponsePdf(formulario: DocumentoDeFormulario): jsPDF {
  return buildBlocksPdf(bloquesDeFormulario(formulario), {
    title: formulario.titulo,
    kind: 'Formulario clínico',
    subtitle:
      formulario.completadoEl === undefined
        ? undefined
        : `Completado el ${FORMATO_DIA.format(formulario.completadoEl)}`,
  });
}

/** Descarga el formulario respondido. */
export function downloadFormResponsePdf(formulario: DocumentoDeFormulario): void {
  buildFormResponsePdf(formulario).save(
    nombreDeArchivo('formulario', formulario.completadoEl ?? new Date(), formulario.id),
  );
}

/* ---- el contenido, bloque por bloque -------------------------------------
   Los armadores se exportan para poder probarlos **sin jsPDF de por medio**:
   lo que este archivo decide es qué dice el documento, y el motor de render ya
   tiene sus propias pruebas en `pdf-export.spec.ts`. Además evita el
   acoplamiento entre specs — dos archivos que mockeen el mismo módulo se pisan
   según cómo el pool reparta los workers, y un test que depende del orden no
   prueba nada. */

/** Las líneas de una receta, en orden de lectura. */
export function bloquesDeReceta(receta: DocumentoDeReceta): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [seccion('Paciente y profesional')];

  bloques.push(...datosDeCabecera(receta.paciente, receta.profesional, receta.organizacion));

  bloques.push(seccion('Emisión'));
  bloques.push(campoDeBloque('Fecha de la indicación', FORMATO_FECHA.format(receta.creadaEl)));
  if (receta.emitidaEl === undefined) {
    // Se dice, no se disimula: una receta sin emitir no vale como receta, y eso
    // va en un aviso destacado y no en una línea más de la lista.
    bloques.push(aviso('Estado: sin emitir. Este documento es una copia de trabajo.'));
  } else {
    bloques.push(campoDeBloque('Emitida el', FORMATO_FECHA.format(receta.emitidaEl)));
  }
  if (receta.firmadaEl !== undefined) {
    bloques.push(campoDeBloque('Firmada el', FORMATO_FECHA.format(receta.firmadaEl)));
  }

  bloques.push(seccion('Medicamentos indicados'));
  if (receta.medicamentos.length === 0) {
    bloques.push(parrafo('Sin medicamentos indicados.'));
  } else {
    bloques.push(cabeceraDeTabla(['#', 'Medicamento', 'Dosis', 'Frecuencia', 'Vigencia']));
    for (const [indice, medicamento] of receta.medicamentos.entries()) {
      bloques.push(filaDeMedicamento(indice + 1, medicamento));
    }
  }

  if (receta.indicaciones !== undefined && receta.indicaciones.trim() !== '') {
    bloques.push(seccion('Indicaciones'));
    bloques.push(parrafo(receta.indicaciones));
  }

  bloques.push(pie());
  return bloques;
}

/**
 * Un medicamento como fila de la tabla.
 *
 * `text` mantiene la línea corrida de siempre —«1. Amoxicilina · 500 mg · cada
 * 8 horas»— con los campos vacíos salteados, porque es lo que se lee cuando el
 * documento se recorre como texto. Las celdas, en cambio, son posicionales: un
 * dato ausente ocupa su columna con una raya, o la tabla se desalinea.
 */
function filaDeMedicamento(numero: number, medicamento: DocumentoMedicamento): PdfBlock {
  const celdas = [
    String(numero),
    medicamento.medicamento,
    medicamento.dosis ?? '—',
    medicamento.frecuencia ?? '—',
    medicamento.vigencia ?? '—',
  ].map((celda) => (celda.trim() === '' ? '—' : celda));
  return {
    kind: 'row',
    text: `${numero}. ${lineaDeMedicamento(medicamento)}`,
    cells: celdas,
  };
}

/** Un medicamento en una línea: nombre, dosis, frecuencia y vigencia. */
function lineaDeMedicamento(medicamento: DocumentoMedicamento): string {
  const partes = [
    medicamento.medicamento,
    medicamento.dosis,
    medicamento.frecuencia,
    medicamento.vigencia,
  ].filter((parte): parte is string => parte !== undefined && parte.trim() !== '');
  return partes.join(' · ');
}

/** Las líneas de la historia de una atención, en orden de lectura. */
export function bloquesDeAtencion(atencion: DocumentoDeAtencion): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [seccion('Paciente y profesional')];

  bloques.push(...datosDeCabecera(atencion.paciente, atencion.profesional, atencion.organizacion));

  bloques.push(seccion('La atención'));
  bloques.push(
    campoDeBloque(
      'Atención del',
      atencion.inicio === undefined ? SIN_DATO : FORMATO_FECHA.format(atencion.inicio),
    ),
  );
  if (atencion.cierre === undefined) {
    bloques.push(aviso('Estado: en curso. Este documento es una copia de trabajo.'));
  } else {
    bloques.push(campoDeBloque('Cerrada el', FORMATO_FECHA.format(atencion.cierre)));
  }
  bloques.push(campoDeBloque('Motivo de consulta', atencion.motivo ?? SIN_DATO));

  for (const bloque of atencion.bloques) {
    bloques.push(seccion(bloque.titulo));
    if (bloque.datos.length === 0) {
      bloques.push(parrafo('Sin registros.'));
      continue;
    }
    for (const dato of bloque.datos) {
      bloques.push(campoDeBloque(dato.etiqueta, dato.valor));
    }
  }

  // Los formularios respondidos en la atención, una sección por formulario.
  // Mismas líneas que el documento del formulario suelto: es el mismo hecho
  // clínico, y el enmascarado lo aplica el armador acá también.
  for (const formulario of atencion.formularios ?? []) {
    bloques.push(seccion(`Formulario: ${formulario.titulo}`));
    bloques.push(campoDeBloque('Estado', lineaDeCompletado(formulario)));
    bloques.push(...lineasDeRespuestas(formulario.respuestas));
  }

  bloques.push(pie());
  return bloques;
}

/** Las líneas de un formulario respondido, en orden de lectura. */
export function bloquesDeFormulario(formulario: DocumentoDeFormulario): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [campoDeBloque('Estado', lineaDeCompletado(formulario))];

  bloques.push(seccion('Respuestas'));
  bloques.push(...lineasDeRespuestas(formulario.respuestas));

  bloques.push(pie());
  return bloques;
}

/** Las líneas de una orden de estudio, en orden de lectura. */
export function bloquesDeOrden(orden: DocumentoDeOrden): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [seccion('Paciente y profesional')];

  bloques.push(...datosDeCabecera(orden.paciente, orden.profesional, orden.organizacion));

  bloques.push(seccion('El estudio'));
  bloques.push(campoDeBloque('Estudio', textoDe(orden.estudio)));
  bloques.push(campoDeBloque('Tipo', textoDe(orden.categoria)));
  bloques.push(campoDeBloque('Estado', textoDe(orden.estado)));
  bloques.push(campoDeBloque('Pedida el', FORMATO_FECHA.format(orden.pedidaEl)));

  // La preparación es lo que la persona tiene que hacer ANTES de venir, así que
  // va en su propia sección y no en una línea más de la lista.
  bloques.push(seccion('Cómo prepararse'));
  if (orden.preparacion === undefined || orden.preparacion.trim() === '') {
    // No se afirma que no haga falta preparación: se dice que no hay
    // indicaciones publicadas. En un ayuno, la diferencia importa.
    bloques.push(
      aviso(
        'El centro no publicó indicaciones de preparación para este estudio. Consultá al laboratorio antes de asistir.',
      ),
    );
  } else {
    bloques.push(parrafo(orden.preparacion));
  }

  bloques.push(pie());
  return bloques;
}

/**
 * Las líneas de la historia completa, en orden de lectura.
 *
 * Las cinco secciones se imprimen **siempre**, incluso vacías: una sección
 * ausente deja a quien lee sin saber si no hubo nada o si el sistema no lo
 * trajo, y en un documento clínico eso no es lo mismo. Cuando está vacía, lo
 * dice con palabras.
 */
export function bloquesDeHistoria(historia: DocumentoDeHistoria): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [seccion('El paciente')];

  bloques.push(campoDeBloque('Paciente', textoDe(historia.paciente.nombre)));
  if (historia.paciente.documento !== undefined && historia.paciente.documento.trim() !== '') {
    bloques.push(campoDeBloque('Documento', historia.paciente.documento));
  }
  if (historia.edad !== undefined && historia.edad.trim() !== '') {
    bloques.push(campoDeBloque('Edad', historia.edad));
  }
  if (historia.organizacion !== undefined && historia.organizacion.trim() !== '') {
    bloques.push(campoDeBloque('Organización', historia.organizacion));
  }

  bloques.push(seccion('Atenciones'));
  if (historia.atenciones.length === 0) {
    bloques.push(parrafo('Sin atenciones registradas.'));
  }
  for (const atencion of historia.atenciones) {
    bloques.push(rotulo(atencion.titulo));
    bloques.push(...lineasDeBloques(atencion.bloques));
  }

  bloques.push(seccion('Recetas'));
  if (historia.recetas.length === 0) {
    bloques.push(parrafo('Sin recetas registradas.'));
  }
  for (const receta of historia.recetas) {
    bloques.push(rotulo(`Receta del ${FORMATO_FECHA.format(receta.creadaEl)}`));
    if (receta.medicamentos.length === 0) {
      bloques.push(parrafo('Sin medicamentos indicados.'));
    } else {
      bloques.push(cabeceraDeTabla(['Medicamento', 'Dosis', 'Frecuencia', 'Vigencia']));
      for (const medicamento of receta.medicamentos) {
        bloques.push({
          kind: 'row',
          text: lineaDeMedicamento(medicamento),
          cells: [
            medicamento.medicamento,
            medicamento.dosis ?? '—',
            medicamento.frecuencia ?? '—',
            medicamento.vigencia ?? '—',
          ].map((celda) => (celda.trim() === '' ? '—' : celda)),
        });
      }
    }
    if (receta.indicaciones !== undefined && receta.indicaciones.trim() !== '') {
      bloques.push(campoDeBloque('Indicaciones', receta.indicaciones));
    }
  }

  bloques.push(seccion('Formularios'));
  if (historia.formularios.length === 0) {
    bloques.push(parrafo('Sin formularios respondidos.'));
  }
  for (const formulario of historia.formularios) {
    bloques.push(rotulo(formulario.titulo));
    // Las mismas líneas que el formulario suelto y la atención: una sola regla
    // decide el enmascarado en papel, no una por documento.
    bloques.push(...lineasDeRespuestas(formulario.respuestas));
  }

  bloques.push(seccion('Órdenes de estudio'));
  if (historia.ordenes.length === 0) {
    bloques.push(parrafo('Sin órdenes registradas.'));
  }
  if (historia.ordenes.length > 0) {
    bloques.push(cabeceraDeTabla(['Estudio', 'Tipo', 'Pedida el', 'Estado']));
    for (const orden of historia.ordenes) {
      bloques.push({
        kind: 'row',
        text: `${textoDe(orden.estudio)} (${textoDe(orden.categoria)}) — pedida el ${FORMATO_FECHA.format(orden.pedidaEl)}. Estado: ${textoDe(orden.estado)}`,
        cells: [
          textoDe(orden.estudio),
          textoDe(orden.categoria),
          FORMATO_DIA.format(orden.pedidaEl),
          textoDe(orden.estado),
        ],
      });
    }
  }

  bloques.push(seccion('Resultados'));
  if (historia.resultados.length === 0) {
    bloques.push(parrafo('Sin resultados liberados.'));
  }
  bloques.push(...lineasDeBloques(historia.resultados));

  bloques.push(pie());
  return bloques;
}

/** Aplana bloques de datos a líneas, diciendo los vacíos en vez de saltearlos. */
function lineasDeBloques(bloques: readonly DocumentoBloque[]): readonly PdfBlock[] {
  const salida: PdfBlock[] = [];
  for (const bloque of bloques) {
    salida.push(rotulo(bloque.titulo));
    if (bloque.datos.length === 0) {
      salida.push(parrafo('Sin registros.'));
      continue;
    }
    for (const dato of bloque.datos) {
      salida.push(campoDeBloque(dato.etiqueta, dato.valor));
    }
  }
  return salida;
}

/** Cuándo se completó el formulario, o su ausencia con todas las letras. */
function lineaDeCompletado(formulario: DocumentoDeFormulario): string {
  return formulario.completadoEl === undefined
    ? // Se dice, no se disimula: sin fecha de cierre es una copia de trabajo.
      'sin fecha de completado registrada.'
    : `Completado el ${FORMATO_FECHA.format(formulario.completadoEl)}`;
}

/**
 * Las respuestas, una por dato. Lo comparten el documento del formulario
 * suelto y la historia de la atención: el mismo hecho clínico no puede salir
 * distinto según qué papel lo lleve.
 */
function lineasDeRespuestas(respuestas: readonly RespuestaDeFormulario[]): readonly PdfBlock[] {
  if (respuestas.length === 0) {
    return [parrafo('Sin respuestas registradas.')];
  }
  // `masked` decide acá, no en el llamador: aunque `texto` trajera algo, un
  // campo protegido imprime el marcador y nada más.
  return respuestas.map((respuesta) =>
    campoDeBloque(
      respuesta.etiqueta,
      respuesta.masked ? VALOR_ENMASCARADO : textoDe(respuesta.texto),
    ),
  );
}

/** Los datos que encabezan cualquiera de los documentos. */
function datosDeCabecera(
  paciente: DocumentoPaciente,
  profesional: DocumentoProfesional,
  organizacion: string | undefined,
): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [campoDeBloque('Paciente', textoDe(paciente.nombre))];
  if (paciente.documento !== undefined && paciente.documento.trim() !== '') {
    bloques.push(campoDeBloque('Documento', paciente.documento));
  }
  bloques.push(campoDeBloque('Profesional', textoDe(profesional.nombre)));
  if (profesional.matricula !== undefined && profesional.matricula.trim() !== '') {
    bloques.push(campoDeBloque('Matrícula', profesional.matricula));
  }
  if (organizacion !== undefined && organizacion.trim() !== '') {
    bloques.push(campoDeBloque('Organización', organizacion));
  }
  return bloques;
}

/** La bajada del membrete: de quién es el papel y de cuándo. */
function bajada(nombre: string, fecha: Date | undefined): string | undefined {
  const quien = nombre.trim();
  const cuando = fecha === undefined ? '' : FORMATO_DIA.format(fecha);
  if (quien === '' && cuando === '') {
    return undefined;
  }
  return [quien, cuando].filter((parte) => parte !== '').join(' · ');
}

/** El texto, o la marca de ausencia: nunca una línea que termina en dos puntos. */
function textoDe(valor: string): string {
  return valor.trim() === '' ? SIN_DATO : valor;
}

function parrafo(text: string): PdfBlock {
  return { kind: 'paragraph', text };
}

/** Una sección del documento: versalitas espaciadas sobre un filete. */
function seccion(text: string): PdfBlock {
  return { kind: 'heading', text, level: 2 };
}

/** Un subtítulo dentro de una sección —una atención, una receta de la historia—. */
function rotulo(text: string): PdfBlock {
  return { kind: 'heading', text, level: 3 };
}

/** Lo que hay que leer sí o sí: estados provisorios y advertencias. */
function aviso(text: string): PdfBlock {
  return { kind: 'note', text };
}

/** La fila de encabezado de una tabla. */
function cabeceraDeTabla(celdas: readonly string[]): PdfBlock {
  return { kind: 'row', text: celdas.join('\t'), cells: celdas, header: true };
}

/** La letra chica del final: cuándo y desde dónde salió el papel. */
function pie(): PdfBlock {
  return { kind: 'caption', text: pieDeDocumento() };
}

/**
 * `receta-2026-08-15-a1b2c3.pdf`.
 *
 * Con fecha para que ordenen solos en la carpeta, y con el final del
 * identificador porque dos recetas del mismo día no pueden compartir nombre.
 */
function nombreDeArchivo(prefijo: string, fecha: Date, id: string): string {
  const dia = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');
  return `${prefijo}-${dia}-${id.replace(/-/g, '').slice(-6)}.pdf`;
}

/**
 * `historia-perez-2026-08-18.pdf`.
 *
 * Con el apellido y sin sufijo hexadecimal: este archivo lo abre una persona en
 * su carpeta de descargas. Se queda con la última palabra del nombre —que en
 * castellano es el apellido— y la reduce a caracteres seguros para un nombre de
 * archivo en cualquier sistema.
 */
function nombreLegible(prefijo: string, nombre: string, fecha: Date): string {
  const dia = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const apellido = (palabras.at(-1) ?? 'paciente')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${prefijo}-${apellido === '' ? 'paciente' : apellido}-${dia}.pdf`;
}
