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

/**
 * Una respuesta del formulario, ya en palabras.
 *
 * `masked` viaja como bandera y no como texto a propósito: el armador imprime
 * el marcador él mismo y **descarta** `texto` cuando la bandera está puesta,
 * para que un valor protegido no pueda colarse al papel por un descuido del
 * llamador.
 */
export interface RespuestaDeFormulario {
  /** El nombre del campo que se respondió. */
  readonly etiqueta: string;
  /** La respuesta, en palabras. Se ignora si `masked` es true. */
  readonly texto: string;
  /** El backend no expuso el valor por una regla de acceso. */
  readonly masked: boolean;
}

/**
 * Un **formulario clínico respondido** dentro de un encuentro (carril de
 * consulta de formularios).
 *
 * Sin paciente ni profesional todavía: el bloque que hoy lo descarga vive
 * dentro del expediente y no conoce esos datos resueltos; cuando el documento
 * se arme desde una pantalla que los tenga, se agregan acá y el armador les da
 * la misma cabecera que a la receta y la atención.
 */
export interface DocumentoDeFormulario {
  readonly id: string;
  /** El nombre de la plantilla, o un título genérico si no se pudo resolver. */
  readonly titulo: string;
  /** Cuándo se completó, si la instancia registró el cierre. */
  readonly completadoEl?: Date;
  readonly respuestas: readonly RespuestaDeFormulario[];
}

/* ============================================================================
    Carril J3 · los dos documentos que faltaban: la **orden** para llevar al
    laboratorio y la **historia completa** del paciente.

    La diferencia con los de arriba: aquéllos son de un hecho clínico —una
    receta, una atención—; la historia es longitudinal, y es lo que el registro
    del cliente llama «el paciente puede descargar su historia».
    ========================================================================== */

/**
 * Una orden de laboratorio o imagen, para llevar.
 *
 * Existe como PDF y no sólo como pantalla porque el laboratorio la pide en
 * papel: es el documento que se entrega en el mostrador. Por eso el instructivo
 * va **dentro** del documento y no como una nota aparte — quien lo lee está
 * decidiendo si viene en ayunas mañana.
 */
export interface DocumentoDeOrden {
  readonly id: string;
  readonly paciente: DocumentoPaciente;
  readonly profesional: DocumentoProfesional;
  readonly organizacion?: string;
  /** Qué se pidió, en palabras. */
  readonly estudio: string;
  /** Laboratorio o imagenología, en palabras. */
  readonly categoria: string;
  /** Estado de la orden, en palabras. */
  readonly estado: string;
  readonly pedidaEl: Date;
  /**
   * Ayunas, horarios, qué llevar.
   *
   * Ausente **no** se imprime como «sin preparación»: el documento dice que no
   * hay indicaciones publicadas, que es distinto de afirmar que no hacen falta.
   */
  readonly preparacion?: string;
}

/** Una atención dentro de la historia, con lo que se registró en ella. */
export interface HistoriaAtencion {
  readonly titulo: string;
  readonly bloques: readonly DocumentoBloque[];
}

/**
 * La historia clínica completa de una persona, en un solo documento.
 *
 * ## Por qué es un tipo y no la concatenación de los otros
 *
 * Porque el orden y las ausencias son parte del documento. Una historia sin
 * recetas tiene que **decir** que no hay recetas: si la sección desaparece,
 * quien lo lee no sabe si no hubo o si el sistema no la trajo, y eso en un
 * documento clínico no es lo mismo.
 *
 * Cada sección es opcional en el sentido de que puede venir vacía, pero
 * ninguna se omite al imprimir.
 */
export interface DocumentoDeHistoria {
  readonly paciente: DocumentoPaciente;
  /** Edad ya calculada, en palabras. La aritmética no se hace en el papel. */
  readonly edad?: string;
  /** Organización que emite la copia, si la sesión pertenece a una. */
  readonly organizacion?: string;
  readonly atenciones: readonly HistoriaAtencion[];
  readonly recetas: readonly DocumentoDeReceta[];
  readonly formularios: readonly DocumentoDeFormulario[];
  readonly ordenes: readonly DocumentoDeOrden[];
  /** Resultados liberados, ya en palabras. */
  readonly resultados: readonly DocumentoBloque[];
}
