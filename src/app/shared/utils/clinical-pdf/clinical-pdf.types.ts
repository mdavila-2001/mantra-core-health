/* ============================================================================
    Los dos documentos que el paciente y quien atiende se llevan en PDF
    (corrección #16): la **receta** y la **historia de la atención**.

    ## Son datos, no pantallas

    Cada tipo describe lo que el documento dice, no cómo se ve. Quien lo arma
    —el expediente del profesional (carril 08) o el archivo del paciente
    (carril 09)— rellena estas formas con lo que la API devolvió, y el generador
    las maqueta igual para los dos. Si el documento saliera de leer el DOM,
    cada pantalla produciría un PDF distinto del mismo hecho clínico.

    ## Todo es texto ya resuelto

    Ningún campo es un uuid de concepto: los identificadores se traducen
    **antes** de llegar acá. Un PDF con un uuid impreso es un PDF que no sirve
    para lo único que sirve un PDF —leerlo—, y el paciente que lo abra no tiene
    catálogo con qué resolverlo.
    ========================================================================== */

/** Quién firma la atención, tal como se imprime. */
export interface DocumentoProfesional {
  /** Nombre y apellido. Vacío si la sesión no pudo leerlo. */
  readonly nombre: string;
  /** Matrícula o registro profesional, si se conoce. */
  readonly matricula?: string;
}

/** A quién corresponde el documento. */
export interface DocumentoPaciente {
  readonly nombre: string;
  /** Documento de identidad, si la sesión puede leerlo. */
  readonly documento?: string;
}

/** Un medicamento indicado, en la receta. */
export interface DocumentoMedicamento {
  /** El medicamento, en palabras. */
  readonly medicamento: string;
  /** Dosis tal como la escribió quien prescribe. */
  readonly dosis?: string;
  /** Frecuencia. */
  readonly frecuencia?: string;
  /** Desde cuándo y hasta cuándo, ya formateado. */
  readonly vigencia?: string;
  /** Estado de la indicación (borrador, firmada, emitida…). */
  readonly estado?: string;
}

/**
 * La receta.
 *
 * `emitidaEl` es lo que la vuelve un documento y no un borrador: una receta sin
 * emitir se puede descargar igual —el profesional a veces quiere revisarla en
 * papel antes de firmar— pero el documento lo dice con todas las letras en vez
 * de aparentar validez.
 */
export interface DocumentoDeReceta {
  readonly id: string;
  readonly paciente: DocumentoPaciente;
  readonly profesional: DocumentoProfesional;
  readonly organizacion?: string;
  /** Cuándo se creó la indicación. */
  readonly creadaEl: Date;
  /** Cuándo se firmó, si se firmó. */
  readonly firmadaEl?: Date;
  /** Cuándo se emitió, si se emitió. */
  readonly emitidaEl?: Date;
  readonly medicamentos: readonly DocumentoMedicamento[];
  /** Indicaciones generales, si las hay. */
  readonly indicaciones?: string;
}

/** Una línea de un bloque de la historia: «Diagnóstico: Faringitis aguda». */
export interface DocumentoDato {
  readonly etiqueta: string;
  readonly valor: string;
}

/** Un bloque de la historia clínica de la atención. */
export interface DocumentoBloque {
  readonly titulo: string;
  readonly datos: readonly DocumentoDato[];
}

/**
 * La historia clínica de **una atención**.
 *
 * No es el expediente completo: es lo que pasó en esa consulta, que es lo que
 * la corrección #16 pide poder descargar al cerrarla. El expediente longitudinal
 * es otra cosa y vive en el archivo del paciente.
 */
export interface DocumentoDeAtencion {
  readonly id: string;
  readonly paciente: DocumentoPaciente;
  readonly profesional: DocumentoProfesional;
  readonly organizacion?: string;
  /** Motivo de consulta, en palabras. */
  readonly motivo?: string;
  readonly inicio?: Date;
  readonly cierre?: Date;
  /** Diagnósticos, indicaciones, mediciones… ya traducidos. */
  readonly bloques: readonly DocumentoBloque[];
}
