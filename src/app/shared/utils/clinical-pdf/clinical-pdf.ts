import type { jsPDF } from 'jspdf';

import { buildBlocksPdf, type PdfBlock } from '../pdf-export/pdf-export';
import type {
  DocumentoDeAtencion,
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

/* ---- el contenido, bloque por bloque ------------------------------------- */

function bloquesDeReceta(receta: DocumentoDeReceta): readonly PdfBlock[] {
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

function bloquesDeAtencion(atencion: DocumentoDeAtencion): readonly PdfBlock[] {
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
