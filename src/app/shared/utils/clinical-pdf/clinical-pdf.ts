import type { jsPDF } from 'jspdf';

import { firmaDeDocumentos, type PdfFirma } from '../pdf-export/pdf-firma';

import {
  buildBlocksPdf,
  campoDeBloque,
  fieldsBlock,
  listBlock,
  noteBlock,
  panelsBlock,
  type PdfBlock,
  type PdfExportOptions,
  type PdfField,
  type PdfPanel,
} from '../pdf-export/pdf-export';
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
    cabecera, las secciones, cómo se nombra un vacío. Cómo se ve —la portada,
    las tarjetas, las tablas, los avisos, la numeración de páginas— lo decide
    el maquetador de `pdf-export.ts`, que es uno solo para todo el repo. Esa
    separación es la que evita que la receta y el comprobante salgan con dos
    identidades distintas de la misma clínica.

    ## Cada dato en el bloque que le corresponde

    - **Las partes** —paciente y profesional— van en dos tarjetas lado a lado:
      quién recibe el papel y quién responde por él se leen de un vistazo.
    - **Los datos cortos** de la indicación o del estudio van en una rejilla;
      los largos —respuestas de un formulario, resultados— en una lista de
      etiqueta y valor, que sí se parte entre hojas.
    - **Medicamentos, diagnósticos y órdenes** son tablas con cabecera.
    - **Lo que hay que leer sí o sí** —una receta sin emitir, una alergia, la
      preparación de un estudio— va en un aviso con el tono de su gravedad.
    - **Las indicaciones al paciente** son una lista: se cumplen de a una.

    `text` sigue diciendo cada bloque completo —«Nombre: Ana Quispe»— para quien
    quiera leer el documento sin conocer los tipos.

    ## La fecha de emisión es la del dato

    La portada rotula «Fecha de emisión» sólo cuando el dato la tiene —la
    receta emitida, la orden pedida, la atención cerrada, el formulario
    completado—; si no, el motor imprime «Fecha de generación». Un papel
    clínico nunca presenta la fecha de descarga como si fuera la de emisión.

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
 * La marca de agua de un papel provisorio —la receta sin emitir, la atención en
 * curso—: se lee en cada hoja, aunque alguien imprima sólo la segunda.
 */
export const COPIA_DE_TRABAJO = 'Copia de trabajo';

/**
 * El pie que declara qué es este papel.
 *
 * Importa que esté: un documento clínico sin fecha de emisión ni origen es un
 * papel que nadie puede fechar después, y el que lo recibe no sabe si mira lo
 * último o algo de hace un año. Cuando la portada trae la fecha de emisión del
 * dato, esta línea es la otra mitad: cuándo se sacó **esta copia**.
 */
function pieDeDocumento(): string {
  return `Documento generado el ${FORMATO_FECHA.format(new Date())} desde el sistema.`;
}

/* ---- las opciones de cada documento ---------------------------------------
   Se exportan por lo mismo que los bloques: para probar sin jsPDF de por medio
   qué dice la portada —clase, fecha de emisión, estado, marca de agua, firma—,
   que es tan parte del documento como su cuerpo. */

/**
 * La portada y el pie de la receta.
 *
 * La fecha de emisión es la de la receta, no la de la descarga; sin emitir no
 * hay fecha que declarar, y el papel sale con la marca de agua de copia de
 * trabajo. La firma es la del profesional de la sesión (el valor por omisión
 * del motor): la receta es el papel que firma un médico. Sin emitir, el bloque
 * va sin las imágenes de la firma y el sello.
 */
export function prescriptionPdfOptions(receta: DocumentoDeReceta): PdfExportOptions {
  const emitida = receta.emitidaEl !== undefined;
  return {
    title: 'Receta médica',
    kind: 'Prescripción',
    ...bajadaDe(receta.paciente.nombre),
    meta: [{ label: 'Estado', value: emitida ? 'Emitida' : 'Sin emitir' }],
    ...(emitida
      ? { issuedAt: receta.emitidaEl }
      : { watermark: COPIA_DE_TRABAJO, firma: firmaSinImagenes() }),
    ...emisorDe(receta.organizacion),
  };
}

/**
 * La firma de la sesión **sin la imagen de la firma ni el sello**: una receta
 * sin emitir no está firmada, y estamparle la firma escaneada la haría pasar
 * por una. Queda la línea con el nombre y la matrícula, para firmar a mano si
 * hiciera falta. Sin profesional en la sesión, sin bloque.
 */
function firmaSinImagenes(): PdfFirma | null {
  const firma = firmaDeDocumentos();
  return firma === null ? null : { ...firma, firma: null, sello: null };
}

/**
 * La portada y el pie de la historia de una atención. Se emite al cerrarse:
 * en curso, es una copia de trabajo y lo dice en cada hoja.
 */
export function visitPdfOptions(atencion: DocumentoDeAtencion): PdfExportOptions {
  const cerrada = atencion.cierre !== undefined;
  return {
    title: 'Historia clínica de la atención',
    kind: 'Registro clínico',
    ...bajadaDe(atencion.paciente.nombre),
    meta: [{ label: 'Estado', value: cerrada ? 'Cerrada' : 'En curso' }],
    ...(cerrada ? { issuedAt: atencion.cierre } : { watermark: COPIA_DE_TRABAJO }),
    ...emisorDe(atencion.organizacion),
  };
}

/**
 * La portada y el pie de la orden de estudio. Se emite cuando se pide, y la
 * clase dice a qué mostrador va —laboratorio o imagenología—.
 */
export function orderPdfOptions(orden: DocumentoDeOrden): PdfExportOptions {
  return {
    title: 'Orden de estudio',
    kind: tiene(orden.categoria) && orden.categoria !== SIN_DATO ? orden.categoria : 'Documento clínico',
    ...bajadaDe(orden.paciente.nombre),
    meta: [{ label: 'Estado', value: textoDe(orden.estado) }],
    issuedAt: orden.pedidaEl,
    ...emisorDe(orden.organizacion),
  };
}

/**
 * La portada y el pie de la historia completa.
 *
 * Sin fecha de emisión a propósito: es una compilación del momento, no un acto
 * clínico con fecha, y la portada lo rotula como fecha de generación. Y sin
 * bloque de firma: ningún médico firma la historia entera —cada atención y
 * cada receta ya llevan la suya—.
 */
export function historyPdfOptions(historia: DocumentoDeHistoria): PdfExportOptions {
  const partes = [historia.paciente.nombre.trim(), (historia.edad ?? '').trim()].filter(
    (parte) => parte !== '',
  );
  return {
    title: 'Historia clínica',
    kind: 'Registro clínico',
    ...(partes.length === 0 ? {} : { subtitle: partes.join(' · ') }),
    ...emisorDe(historia.organizacion),
    firma: null,
  };
}

/** La portada y el pie de un formulario respondido. Se emite al completarse. */
export function formResponsePdfOptions(formulario: DocumentoDeFormulario): PdfExportOptions {
  const completado = formulario.completadoEl !== undefined;
  return {
    title: formulario.titulo,
    kind: 'Formulario clínico',
    meta: [{ label: 'Estado', value: completado ? 'Completado' : 'Sin fecha de completado' }],
    ...(completado ? { issuedAt: formulario.completadoEl } : {}),
  };
}

/* ---- armar y descargar ---------------------------------------------------- */

/** Arma el PDF de una receta. No la guarda: devuelve el documento. */
export function buildPrescriptionPdf(receta: DocumentoDeReceta): jsPDF {
  return buildBlocksPdf(bloquesDeReceta(receta), prescriptionPdfOptions(receta));
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
  return buildBlocksPdf(bloquesDeAtencion(atencion), visitPdfOptions(atencion));
}

/** Descarga la historia de la atención. */
export function downloadVisitPdf(atencion: DocumentoDeAtencion): void {
  buildVisitPdf(atencion).save(
    nombreDeArchivo('atencion', atencion.cierre ?? atencion.inicio ?? new Date(), atencion.id),
  );
}

/** Arma el PDF de una orden de laboratorio o imagen. */
export function buildOrderPdf(orden: DocumentoDeOrden): jsPDF {
  return buildBlocksPdf(bloquesDeOrden(orden), orderPdfOptions(orden));
}

/** Descarga la orden, para llevarla al laboratorio. */
export function downloadOrderPdf(orden: DocumentoDeOrden): void {
  buildOrderPdf(orden).save(nombreDeArchivo('orden', orden.pedidaEl, orden.id));
}

/** Arma el PDF de la historia completa del paciente. */
export function buildHistoryPdf(historia: DocumentoDeHistoria): jsPDF {
  return buildBlocksPdf(bloquesDeHistoria(historia), historyPdfOptions(historia));
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
  return buildBlocksPdf(bloquesDeFormulario(formulario), formResponsePdfOptions(formulario));
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
  // C5, pedido literal del propietario: la receta siempre dice para qué es —
  // un diagnóstico confirmado, o el motivo escrito — y nunca queda vacía. Va
  // en una tercera tarjeta junto a las partes, con cuándo se indicó y firmó:
  // la receta tiene que caber en una hoja, firma incluida. La fecha de emisión
  // no se repite acá: es la de la portada.
  const prescripcion: PdfField[] = [
    paraQueEs(receta),
    { label: 'Indicada el', value: fechaYHora(receta.creadaEl) },
  ];
  if (receta.firmadaEl !== undefined) {
    prescripcion.push({ label: 'Firmada el', value: fechaYHora(receta.firmadaEl) });
  }
  const bloques: PdfBlock[] = [
    tarjetasDeLasPartes(receta.paciente, receta.profesional, receta.organizacion, {
      title: 'Prescripción',
      fields: prescripcion,
    }),
  ];

  if (receta.emitidaEl === undefined) {
    // Se dice, no se disimula: una receta sin emitir no vale como receta, y eso
    // va en un aviso destacado —y en la marca de agua— y no en una línea más.
    bloques.push(
      noteBlock(
        'Esta receta está sin emitir: es una copia de trabajo y no es válida para dispensar.',
        'alert',
        'Receta sin emitir',
      ),
    );
  }
  bloques.push(...avisoDeAlergias(receta.alergias));

  // Sin títulos de sección —la cabecera de la tabla ya dice qué es— y sin la
  // línea final de «generado el»: la receta es el papel que tiene que caber en
  // una hoja con la firma, y la fecha que la identifica —la de emisión— ya está
  // en la portada y en el pie.
  if (receta.medicamentos.length === 0) {
    bloques.push(parrafo('Sin medicamentos indicados.'));
  } else {
    bloques.push(cabeceraDeTabla(['N.º', 'Medicamento', 'Dosis', 'Frecuencia', 'Vigencia']));
    for (const [indice, medicamento] of receta.medicamentos.entries()) {
      bloques.push(filaDeMedicamento(indice + 1, medicamento));
    }
  }

  const indicaciones = renglonesDe(receta.indicaciones);
  if (indicaciones.length > 0) {
    bloques.push(rotulo('Indicaciones al paciente'));
    bloques.push(listBlock(indicaciones));
  }
  return bloques;
}

/**
 * Para qué es la receta: el diagnóstico, el motivo escrito, o que no se
 * registró. No es «sin diagnóstico»: es que quien armó el documento no lo
 * resolvió, y se dice tal cual, sin fingir un dato que no se tiene.
 */
function paraQueEs(receta: DocumentoDeReceta): PdfField {
  if (receta.porQueEs === undefined) {
    return { label: 'Diagnóstico', value: 'Sin indicación registrada.' };
  }
  return {
    label: receta.porQueEs.tipo === 'diagnostico' ? 'Diagnóstico' : 'Motivo',
    value: textoDe(receta.porQueEs.texto),
  };
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
  return {
    kind: 'row',
    text: `${numero}. ${lineaDeMedicamento(medicamento)}`,
    cells: celdas([
      String(numero),
      medicamento.medicamento,
      medicamento.dosis,
      medicamento.frecuencia,
      medicamento.vigencia,
    ]),
  };
}

/** Un medicamento en una línea: nombre, dosis, frecuencia y vigencia. */
function lineaDeMedicamento(medicamento: DocumentoMedicamento): string {
  return unidas([medicamento.medicamento, medicamento.dosis, medicamento.frecuencia, medicamento.vigencia]);
}

/** Las líneas de la historia de una atención, en orden de lectura. */
export function bloquesDeAtencion(atencion: DocumentoDeAtencion): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [
    tarjetasDeLasPartes(atencion.paciente, atencion.profesional, atencion.organizacion),
  ];

  if (atencion.cierre === undefined) {
    bloques.push(
      noteBlock(
        'La atención está en curso: este documento es una copia de trabajo y puede cambiar hasta que se cierre.',
        'warning',
        'Atención sin cerrar',
      ),
    );
  }
  bloques.push(...avisoDeAlergias(atencion.alergias));

  // El cierre no se repite acá: es la fecha de emisión de la portada.
  bloques.push(seccion('La atención'));
  bloques.push(
    fieldsBlock(
      [
        {
          label: 'Inicio de la atención',
          value: atencion.inicio === undefined ? SIN_DATO : FORMATO_FECHA.format(atencion.inicio),
        },
        { label: 'Motivo de consulta', value: textoDe(atencion.motivo ?? '') },
      ],
      2,
    ),
  );

  for (const bloque of atencion.bloques) {
    bloques.push(seccion(bloque.titulo));
    if (bloque.datos.length === 0) {
      bloques.push(parrafo('Sin registros.'));
      continue;
    }
    bloques.push(...tablaDeBloque(bloque, columnasDe(bloque.titulo)));
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

/**
 * Las líneas de un formulario respondido, en orden de lectura.
 *
 * Cuándo se completó va en la portada —es su fecha de emisión—; sin esa fecha,
 * el papel lo advierte antes de las respuestas.
 */
export function bloquesDeFormulario(formulario: DocumentoDeFormulario): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [];
  if (formulario.completadoEl === undefined) {
    // Se dice, no se disimula: sin fecha de cierre es una copia de trabajo.
    bloques.push(
      noteBlock(
        'Formulario sin fecha de completado registrada: las respuestas pueden no ser las definitivas.',
        'warning',
        'Sin fecha de completado',
      ),
    );
  }

  bloques.push(seccion('Respuestas'));
  bloques.push(...lineasDeRespuestas(formulario.respuestas));

  bloques.push(pie());
  return bloques;
}

/** El título del aviso de preparación de una orden. */
const COMO_PREPARARSE = 'Cómo prepararse';

/** Las líneas de una orden de estudio, en orden de lectura. */
export function bloquesDeOrden(orden: DocumentoDeOrden): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [tarjetasDeLasPartes(orden.paciente, orden.profesional, orden.organizacion)];

  // Cuándo se pidió y en qué estado está van en la portada (fecha de emisión y
  // estado): el cuerpo dice qué se pidió.
  bloques.push(seccion('El estudio'));
  bloques.push(
    fieldsBlock(
      [
        { label: 'Estudio', value: textoDe(orden.estudio) },
        { label: 'Tipo', value: textoDe(orden.categoria) },
      ],
      2,
    ),
  );

  // La preparación es lo que la persona tiene que hacer ANTES de venir, así que
  // va en su propio aviso, titulado, y no en una línea más de la lista. El
  // aviso es la sección: un título encima repetiría el suyo y empujaría la
  // firma a una segunda hoja.
  if (orden.preparacion === undefined || orden.preparacion.trim() === '') {
    // No se afirma que no haga falta preparación: se dice que no hay
    // indicaciones publicadas. En un ayuno, la diferencia importa.
    bloques.push(
      noteBlock(
        'El centro no publicó indicaciones de preparación para este estudio. Consulte al laboratorio antes de asistir.',
        'info',
        COMO_PREPARARSE,
      ),
    );
  } else {
    bloques.push(noteBlock(orden.preparacion, 'warning', COMO_PREPARARSE));
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
  const bloques: PdfBlock[] = [seccion('Datos del paciente')];

  const persona: PdfField[] = [{ label: 'Paciente', value: textoDe(historia.paciente.nombre) }];
  if (tiene(historia.paciente.documento)) {
    persona.push({ label: 'Documento', value: historia.paciente.documento });
  }
  if (tiene(historia.edad)) {
    persona.push({ label: 'Edad', value: historia.edad });
  }
  if (tiene(historia.organizacion)) {
    persona.push({ label: 'Organización', value: historia.organizacion });
  }
  bloques.push(fieldsBlock(persona, Math.max(2, persona.length)));
  bloques.push(...avisoDeAlergias(historia.alergias));

  bloques.push(seccion('Atenciones'));
  if (historia.atenciones.length === 0) {
    bloques.push(parrafo('Sin atenciones registradas.'));
  }
  for (const atencion of historia.atenciones) {
    bloques.push(rotulo(atencion.titulo));
    // Una sola tabla por atención, con una banda por bloque: las columnas se
    // alinean entre diagnósticos, medicación y observaciones.
    for (const bloque of atencion.bloques) {
      bloques.push(...tablaDeBloque(bloque, [bloque.titulo, columnasDe(bloque.titulo)[1]]));
    }
  }

  bloques.push(seccion('Recetas'));
  if (historia.recetas.length === 0) {
    bloques.push(parrafo('Sin recetas registradas.'));
  } else {
    bloques.push(...tablaDeRecetas(historia.recetas));
  }

  bloques.push(seccion('Formularios'));
  if (historia.formularios.length === 0) {
    bloques.push(parrafo('Sin formularios respondidos.'));
  }
  for (const formulario of historia.formularios) {
    bloques.push(rotulo(formulario.titulo));
    // Las mismas líneas que el formulario suelto y la atención: una sola regla
    // decide el enmascarado en papel, no una por documento.
    bloques.push(campoDeBloque('Estado', lineaDeCompletado(formulario)));
    bloques.push(...lineasDeRespuestas(formulario.respuestas));
  }

  bloques.push(seccion('Órdenes de estudio'));
  if (historia.ordenes.length === 0) {
    bloques.push(parrafo('Sin órdenes registradas.'));
  } else {
    bloques.push(cabeceraDeTabla(['Estudio', 'Tipo', 'Pedida el', 'Estado']));
    for (const orden of historia.ordenes) {
      bloques.push({
        kind: 'row',
        text: `${textoDe(orden.estudio)} (${textoDe(orden.categoria)}) — pedida el ${FORMATO_FECHA.format(orden.pedidaEl)}. Estado: ${textoDe(orden.estado)}`,
        cells: [
          textoDe(orden.estudio),
          textoDe(orden.categoria),
          fechaCorta(orden.pedidaEl),
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

/**
 * Las recetas de la historia en **una** tabla, con la fecha delante: una
 * historia con veinte recetas no puede ser veinte tablas de un renglón. Las
 * indicaciones al paciente, que no caben en una celda, van debajo, cada una
 * con el medicamento y la fecha de su receta.
 */
function tablaDeRecetas(recetas: readonly DocumentoDeReceta[]): readonly PdfBlock[] {
  const bloques: PdfBlock[] = [
    cabeceraDeTabla(['Fecha', 'Medicamento', 'Dosis y frecuencia', 'Vigencia', 'Estado']),
  ];
  const indicaciones: PdfBlock[] = [];
  for (const receta of recetas) {
    const fecha = fechaCorta(receta.creadaEl);
    const estadoDeLaReceta = receta.emitidaEl === undefined ? 'Sin emitir' : 'Emitida';
    if (receta.medicamentos.length === 0) {
      bloques.push({
        kind: 'row',
        text: `Receta del ${FORMATO_FECHA.format(receta.creadaEl)}: sin medicamentos indicados.`,
        cells: [fecha, 'Sin medicamentos indicados.', '—', '—', estadoDeLaReceta],
      });
    }
    for (const medicamento of receta.medicamentos) {
      bloques.push({
        kind: 'row',
        text: `Receta del ${FORMATO_FECHA.format(receta.creadaEl)}: ${lineaDeMedicamento(medicamento)}`,
        cells: celdas([
          fecha,
          medicamento.medicamento,
          unidas([medicamento.dosis, medicamento.frecuencia]),
          medicamento.vigencia,
          medicamento.estado ?? estadoDeLaReceta,
        ]),
      });
    }
    if (tiene(receta.indicaciones)) {
      const que = receta.medicamentos.map((medicamento) => medicamento.medicamento).join(', ');
      indicaciones.push(
        campoDeBloque(que === '' ? `Receta del ${fecha}` : `${que} (${fecha})`, receta.indicaciones),
      );
    }
  }
  if (indicaciones.length > 0) {
    bloques.push(rotulo('Indicaciones al paciente'), ...indicaciones);
  }
  return bloques;
}

/**
 * Un bloque de datos como tabla de dos columnas, con su cabecera. Seguidas, las
 * tablas de varios bloques se maquetan como una sola con una banda por bloque.
 * Vacío, lo dice en una fila en vez de desaparecer.
 */
function tablaDeBloque(bloque: DocumentoBloque, cabecera: readonly [string, string]): readonly PdfBlock[] {
  const filas: PdfBlock[] = [cabeceraDeTabla(cabecera)];
  if (bloque.datos.length === 0) {
    filas.push({ kind: 'row', text: `${bloque.titulo}: Sin registros.`, cells: ['Sin registros.', '—'] });
    return filas;
  }
  for (const dato of bloque.datos) {
    const valor = dato.valor.trim();
    filas.push({
      kind: 'row',
      text: valor === '' ? dato.etiqueta : `${dato.etiqueta}: ${valor}`,
      cells: celdas([dato.etiqueta, valor]),
    });
  }
  return filas;
}

/**
 * Los nombres de las dos columnas de un bloque de la atención. Los bloques
 * conocidos dicen qué es cada columna; uno nuevo cae a «Registro / Detalle»,
 * que es verdad para cualquiera.
 */
function columnasDe(titulo: string): readonly [string, string] {
  switch (titulo) {
    case 'Diagnósticos':
      return ['Diagnóstico', 'Estado clínico'];
    case 'Medicación indicada':
      return ['Medicamento', 'Indicación'];
    case 'Observaciones':
      return ['Observación', 'Resultado'];
    default:
      return ['Registro', 'Detalle'];
  }
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

/**
 * Las dos partes del documento, en tarjetas lado a lado: quién lo recibe y
 * quién responde por él. Los datos opcionales que no se conocen no se
 * imprimen: un renglón «Matrícula» vacío afirma que no la tiene.
 */
function tarjetasDeLasPartes(
  paciente: DocumentoPaciente,
  profesional: DocumentoProfesional,
  organizacion: string | undefined,
  tercera?: PdfPanel,
): PdfBlock {
  const delPaciente: PdfField[] = [{ label: 'Nombre', value: textoDe(paciente.nombre) }];
  if (tiene(paciente.documento)) {
    delPaciente.push({ label: 'Documento', value: paciente.documento });
  }
  const delProfesional: PdfField[] = [{ label: 'Nombre', value: textoDe(profesional.nombre) }];
  if (tiene(profesional.matricula)) {
    delProfesional.push({ label: 'Matrícula', value: profesional.matricula });
  }
  if (tiene(organizacion)) {
    delProfesional.push({ label: 'Organización', value: organizacion });
  }
  const tarjetas: PdfPanel[] = [
    { title: 'Paciente', fields: delPaciente },
    { title: 'Profesional', fields: delProfesional },
    ...(tercera === undefined ? [] : [tercera]),
  ];
  return panelsBlock(tarjetas);
}

/**
 * Las alergias, en un aviso de alerta antes de lo indicado: es lo primero que
 * tiene que ver quien prescribe o dispensa. Sin el dato no se imprime nada —no
 * es lo mismo que «sin alergias conocidas»—.
 */
function avisoDeAlergias(alergias: readonly string[] | undefined): readonly PdfBlock[] {
  const registradas = (alergias ?? []).map((alergia) => alergia.trim()).filter((alergia) => alergia !== '');
  if (registradas.length === 0) {
    return [];
  }
  return [
    noteBlock(
      `${registradas.join('; ')}. Verifique antes de indicar, dispensar o administrar cualquier medicamento.`,
      'alert',
      'Alergias registradas',
    ),
  ];
}

/**
 * Las indicaciones al paciente, renglón por renglón: se parten en los saltos
 * de línea y entre oraciones. Una oración termina en punto tras una palabra
 * de tres letras o más —«comidas.»—, así «Dra.» o «c/8 h.» no cortan.
 */
function renglonesDe(texto: string | undefined): readonly string[] {
  if (texto === undefined) {
    return [];
  }
  // Sin lookbehind a propósito: se marca el corte y después se parte.
  return texto
    .replace(/(\p{Ll}{3}\.)\s+(?=[\p{Lu}¿¡])/gu, '$1\n')
    .split(/\r?\n/)
    .map((renglon) => renglon.replace(/^\s*[-•*]\s*/, '').trim())
    .filter((renglon) => renglon !== '');
}

/** El emisor del pie: la organización, si se sabe. Si no, el motor pone AloVida. */
function emisorDe(organizacion: string | undefined): Pick<PdfExportOptions, 'issuer'> {
  return tiene(organizacion) ? { issuer: { name: organizacion.trim() } } : {};
}

/** La bajada de la portada: de quién es el papel. */
function bajadaDe(nombre: string): Pick<PdfExportOptions, 'subtitle'> {
  return nombre.trim() === '' ? {} : { subtitle: nombre.trim() };
}

/** `14/08/2026, 10:05`: la fecha corta con la hora, para una tarjeta angosta. */
function fechaYHora(fecha: Date): string {
  const hora = [fecha.getHours(), fecha.getMinutes()].map((parte) => String(parte).padStart(2, '0')).join(':');
  return `${fechaCorta(fecha)}, ${hora}`;
}

/** `14/08/2026`: la fecha corta de las tablas, sin depender del ICU del entorno. */
function fechaCorta(fecha: Date): string {
  return [
    String(fecha.getDate()).padStart(2, '0'),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    fecha.getFullYear(),
  ].join('/');
}

/** Las celdas de una fila: un dato ausente ocupa su columna con una raya. */
function celdas(valores: readonly (string | undefined)[]): readonly string[] {
  return valores.map((valor) => (valor === undefined || valor.trim() === '' ? '—' : valor));
}

/** Las partes presentes, unidas con un punto medio. */
function unidas(partes: readonly (string | undefined)[]): string {
  return partes.filter((parte): parte is string => parte !== undefined && parte.trim() !== '').join(' · ');
}

/** Si el dato opcional vino y dice algo. */
function tiene(valor: string | undefined): valor is string {
  return valor !== undefined && valor.trim() !== '';
}

/** El texto, o la marca de ausencia: nunca una línea que termina en dos puntos. */
function textoDe(valor: string): string {
  return valor.trim() === '' ? SIN_DATO : valor;
}

function parrafo(text: string): PdfBlock {
  return { kind: 'paragraph', text };
}

/** Una sección del documento: barra de acento, título y filete. */
function seccion(text: string): PdfBlock {
  return { kind: 'heading', text, level: 2 };
}

/** Un subtítulo dentro de una sección —una atención, un formulario de la historia—. */
function rotulo(text: string): PdfBlock {
  return { kind: 'heading', text, level: 3 };
}

/** La fila de encabezado de una tabla. */
function cabeceraDeTabla(celdasDeCabecera: readonly string[]): PdfBlock {
  return { kind: 'row', text: celdasDeCabecera.join('\t'), cells: celdasDeCabecera, header: true };
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
