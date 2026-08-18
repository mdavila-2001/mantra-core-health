import type { jsPDF } from 'jspdf';

import { buildBlocksPdf, type PdfBlock } from '../pdf-export/pdf-export';
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
} from './clinical-pdf.types';

/* ============================================================================
    Los dos PDF de la corrección #16.

    ## El formato es simple A PROPÓSITO

    Sin membrete, sin logo, sin maquetación: documento mínimo de texto
    estructurado. Así lo pide la corrección con todas las letras, y el criterio
    de éxito de esta iteración es que **se genere desde datos persistidos, no
    esté vacío y se lean los campos mínimos**. La versión con identidad visual
    llega otro día; invertir hoy en maquetarla sería trabajo que hay que
    rehacer.

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
  return buildBlocksPdf(bloquesDeReceta(receta), { title: 'Receta médica' });
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
  return buildBlocksPdf(bloquesDeAtencion(atencion), { title: 'Historia clínica de la atención' });
}

/** Descarga la historia de la atención. */
export function downloadVisitPdf(atencion: DocumentoDeAtencion): void {
  buildVisitPdf(atencion).save(
    nombreDeArchivo('atencion', atencion.cierre ?? atencion.inicio ?? new Date(), atencion.id),
  );
}

/** Arma el PDF de una orden de laboratorio o imagen. */
export function buildOrderPdf(orden: DocumentoDeOrden): jsPDF {
  return buildBlocksPdf(bloquesDeOrden(orden), { title: 'Orden de estudio' });
}

/** Descarga la orden, para llevarla al laboratorio. */
export function downloadOrderPdf(orden: DocumentoDeOrden): void {
  buildOrderPdf(orden).save(nombreDeArchivo('orden', orden.pedidaEl, orden.id));
}

/** Arma el PDF de la historia completa del paciente. */
export function buildHistoryPdf(historia: DocumentoDeHistoria): jsPDF {
  return buildBlocksPdf(bloquesDeHistoria(historia), { title: 'Historia clínica' });
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
  return buildBlocksPdf(bloquesDeFormulario(formulario), { title: formulario.titulo });
}

/** Descarga el formulario respondido. */
export function downloadFormResponsePdf(formulario: DocumentoDeFormulario): void {
  buildFormResponsePdf(formulario).save(
    nombreDeArchivo('formulario', formulario.completadoEl ?? new Date(), formulario.id),
  );
}

/* ---- el contenido, bloque por bloque -------------------------------------
   Los dos armadores se exportan para poder probarlos **sin jsPDF de por
   medio**: lo que este archivo decide es qué dice el documento, y el motor de
   render ya tiene sus propias pruebas en `pdf-export.spec.ts`. Además evita el
   acoplamiento entre specs — dos archivos que mockeen el mismo módulo se pisan
   según cómo el pool reparta los workers, y un test que depende del orden no
   prueba nada. */

/** Las líneas de una receta, en orden de lectura. */
export function bloquesDeReceta(receta: DocumentoDeReceta): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [];

  bloques.push(...datosDeCabecera(receta.paciente, receta.profesional, receta.organizacion));

  bloques.push(parrafo(`Fecha de la indicación: ${FORMATO_FECHA.format(receta.creadaEl)}`));
  bloques.push(
    parrafo(
      receta.emitidaEl === undefined
        ? // Se dice, no se disimula: una receta sin emitir no vale como receta.
          'Estado: sin emitir. Este documento es una copia de trabajo.'
        : `Emitida el ${FORMATO_FECHA.format(receta.emitidaEl)}`,
    ),
  );
  if (receta.firmadaEl !== undefined) {
    bloques.push(parrafo(`Firmada el ${FORMATO_FECHA.format(receta.firmadaEl)}`));
  }

  bloques.push(encabezado('Medicamentos indicados', 2));
  if (receta.medicamentos.length === 0) {
    bloques.push(parrafo('Sin medicamentos indicados.'));
  }
  for (const [indice, medicamento] of receta.medicamentos.entries()) {
    bloques.push(parrafo(`${indice + 1}. ${lineaDeMedicamento(medicamento)}`));
  }

  if (receta.indicaciones !== undefined && receta.indicaciones.trim() !== '') {
    bloques.push(encabezado('Indicaciones', 2));
    bloques.push(parrafo(receta.indicaciones));
  }

  bloques.push(parrafo(pieDeDocumento()));
  return bloques;
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
  const bloques: PdfBlock[] = [];

  bloques.push(...datosDeCabecera(atencion.paciente, atencion.profesional, atencion.organizacion));

  bloques.push(
    parrafo(
      `Atención del ${atencion.inicio === undefined ? SIN_DATO : FORMATO_FECHA.format(atencion.inicio)}`,
    ),
  );
  bloques.push(
    parrafo(
      atencion.cierre === undefined
        ? 'Estado: en curso. Este documento es una copia de trabajo.'
        : `Cerrada el ${FORMATO_FECHA.format(atencion.cierre)}`,
    ),
  );
  bloques.push(parrafo(`Motivo de consulta: ${atencion.motivo ?? SIN_DATO}`));

  for (const bloque of atencion.bloques) {
    bloques.push(encabezado(bloque.titulo, 2));
    if (bloque.datos.length === 0) {
      bloques.push(parrafo('Sin registros.'));
      continue;
    }
    for (const dato of bloque.datos) {
      bloques.push(parrafo(`${dato.etiqueta}: ${dato.valor}`));
    }
  }

  bloques.push(parrafo(pieDeDocumento()));
  return bloques;
}

/** Las líneas de un formulario respondido, en orden de lectura. */
export function bloquesDeFormulario(formulario: DocumentoDeFormulario): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [];

  bloques.push(
    parrafo(
      formulario.completadoEl === undefined
        ? // Se dice, no se disimula: sin fecha de cierre es una copia de trabajo.
          'Estado: sin fecha de completado registrada.'
        : `Completado el ${FORMATO_FECHA.format(formulario.completadoEl)}`,
    ),
  );

  bloques.push(encabezado('Respuestas', 2));
  if (formulario.respuestas.length === 0) {
    bloques.push(parrafo('Sin respuestas registradas.'));
  }
  for (const respuesta of formulario.respuestas) {
    // `masked` decide acá, no en el llamador: aunque `texto` trajera algo, un
    // campo protegido imprime el marcador y nada más.
    bloques.push(
      parrafo(
        `${respuesta.etiqueta}: ${respuesta.masked ? VALOR_ENMASCARADO : textoDe(respuesta.texto)}`,
      ),
    );
  }

  bloques.push(parrafo(pieDeDocumento()));
  return bloques;
}

/** Las líneas de una orden de estudio, en orden de lectura. */
export function bloquesDeOrden(orden: DocumentoDeOrden): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [encabezado('Orden de estudio', 1)];

  bloques.push(...datosDeCabecera(orden.paciente, orden.profesional, orden.organizacion));

  bloques.push(parrafo(`Estudio: ${textoDe(orden.estudio)}`));
  bloques.push(parrafo(`Tipo: ${textoDe(orden.categoria)}`));
  bloques.push(parrafo(`Estado: ${textoDe(orden.estado)}`));
  bloques.push(parrafo(`Pedida el ${FORMATO_FECHA.format(orden.pedidaEl)}`));

  // La preparación es lo que la persona tiene que hacer ANTES de venir, así que
  // va en su propia sección y no en una línea más de la lista.
  bloques.push(encabezado('Cómo prepararse', 2));
  bloques.push(
    parrafo(
      orden.preparacion === undefined || orden.preparacion.trim() === ''
        ? // No se afirma que no haga falta preparación: se dice que no hay
          // indicaciones publicadas. En un ayuno, la diferencia importa.
          'El centro no publicó indicaciones de preparación para este estudio. Consultá al laboratorio antes de asistir.'
        : orden.preparacion,
    ),
  );

  bloques.push(parrafo(pieDeDocumento()));
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
  const bloques: PdfBlock[] = [encabezado('Historia clínica', 1)];

  bloques.push(parrafo(`Paciente: ${textoDe(historia.paciente.nombre)}`));
  if (historia.paciente.documento !== undefined && historia.paciente.documento.trim() !== '') {
    bloques.push(parrafo(`Documento: ${historia.paciente.documento}`));
  }
  if (historia.edad !== undefined && historia.edad.trim() !== '') {
    bloques.push(parrafo(`Edad: ${historia.edad}`));
  }
  if (historia.organizacion !== undefined && historia.organizacion.trim() !== '') {
    bloques.push(parrafo(`Organización: ${historia.organizacion}`));
  }

  bloques.push(encabezado('Atenciones', 2));
  if (historia.atenciones.length === 0) {
    bloques.push(parrafo('Sin atenciones registradas.'));
  }
  for (const atencion of historia.atenciones) {
    bloques.push(encabezado(atencion.titulo, 3));
    bloques.push(...lineasDeBloques(atencion.bloques));
  }

  bloques.push(encabezado('Recetas', 2));
  if (historia.recetas.length === 0) {
    bloques.push(parrafo('Sin recetas registradas.'));
  }
  for (const receta of historia.recetas) {
    bloques.push(encabezado(`Receta del ${FORMATO_FECHA.format(receta.creadaEl)}`, 3));
    if (receta.medicamentos.length === 0) {
      bloques.push(parrafo('Sin medicamentos indicados.'));
    }
    for (const medicamento of receta.medicamentos) {
      bloques.push(parrafo(lineaDeMedicamento(medicamento)));
    }
    if (receta.indicaciones !== undefined && receta.indicaciones.trim() !== '') {
      bloques.push(parrafo(`Indicaciones: ${receta.indicaciones}`));
    }
  }

  bloques.push(encabezado('Formularios', 2));
  if (historia.formularios.length === 0) {
    bloques.push(parrafo('Sin formularios respondidos.'));
  }
  for (const formulario of historia.formularios) {
    bloques.push(encabezado(formulario.titulo, 3));
    for (const respuesta of formulario.respuestas) {
      bloques.push(
        parrafo(
          `${respuesta.etiqueta}: ${respuesta.masked ? VALOR_ENMASCARADO : textoDe(respuesta.texto)}`,
        ),
      );
    }
  }

  bloques.push(encabezado('Órdenes de estudio', 2));
  if (historia.ordenes.length === 0) {
    bloques.push(parrafo('Sin órdenes registradas.'));
  }
  for (const orden of historia.ordenes) {
    bloques.push(
      parrafo(
        `${textoDe(orden.estudio)} (${textoDe(orden.categoria)}) — pedida el ${FORMATO_FECHA.format(orden.pedidaEl)}. Estado: ${textoDe(orden.estado)}`,
      ),
    );
  }

  bloques.push(encabezado('Resultados', 2));
  if (historia.resultados.length === 0) {
    bloques.push(parrafo('Sin resultados liberados.'));
  }
  bloques.push(...lineasDeBloques(historia.resultados));

  bloques.push(parrafo(pieDeDocumento()));
  return bloques;
}

/** Aplana bloques de datos a líneas, diciendo los vacíos en vez de saltearlos. */
function lineasDeBloques(bloques: readonly DocumentoBloque[]): readonly PdfBlock[] {
  const salida: PdfBlock[] = [];
  for (const bloque of bloques) {
    salida.push(encabezado(bloque.titulo, 4));
    if (bloque.datos.length === 0) {
      salida.push(parrafo('Sin registros.'));
      continue;
    }
    for (const dato of bloque.datos) {
      salida.push(parrafo(`${dato.etiqueta}: ${dato.valor}`));
    }
  }
  return salida;
}

/** Los tres datos que encabezan cualquiera de los dos documentos. */
function datosDeCabecera(
  paciente: DocumentoPaciente,
  profesional: DocumentoProfesional,
  organizacion: string | undefined,
): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [parrafo(`Paciente: ${textoDe(paciente.nombre)}`)];
  if (paciente.documento !== undefined && paciente.documento.trim() !== '') {
    bloques.push(parrafo(`Documento: ${paciente.documento}`));
  }
  bloques.push(parrafo(`Profesional: ${textoDe(profesional.nombre)}`));
  if (profesional.matricula !== undefined && profesional.matricula.trim() !== '') {
    bloques.push(parrafo(`Matrícula: ${profesional.matricula}`));
  }
  if (organizacion !== undefined && organizacion.trim() !== '') {
    bloques.push(parrafo(`Organización: ${organizacion}`));
  }
  return bloques;
}

/** El texto, o la marca de ausencia: nunca una línea que termina en dos puntos. */
function textoDe(valor: string): string {
  return valor.trim() === '' ? SIN_DATO : valor;
}

function parrafo(text: string): PdfBlock {
  return { kind: 'paragraph', text };
}

function encabezado(text: string, level: number): PdfBlock {
  return { kind: 'heading', text, level };
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
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${prefijo}-${apellido === '' ? 'paciente' : apellido}-${dia}.pdf`;
}
