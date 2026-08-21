import type {
  ClinicalSummary,
  Encounter,
  MedicationRequest,
  Observation,
} from '../../../core/data-access/clinical/clinical.types';
import type {
  PatientDiagnosticResult,
  PatientOrder,
} from '../../../core/data-access/diagnostics/diagnostics.types';
import type {
  DocumentoBloque,
  DocumentoDeAtencion,
  DocumentoDeFormulario,
  DocumentoDeHistoria,
  DocumentoDeOrden,
  DocumentoDeReceta,
} from './clinical-pdf.types';

/* ============================================================================
    De lo que devuelve la API a los dos documentos de la corrección #16.

    ## Por qué son funciones puras y no métodos de una pantalla

    Porque **las dos pantallas arman el mismo papel**: el expediente del
    profesional (carril 08) y el archivo del paciente (carril 09). Si cada una
    lo mapeara por su lado, el mismo hecho clínico saldría distinto según quién
    lo descargue — y dos versiones del mismo documento es lo que un sistema de
    salud no puede permitirse.

    Puras además porque así se prueban: sin TestBed, sin DOM y sin disparar una
    descarga.
    ========================================================================== */

/** Resuelve un uuid de concepto a su etiqueta. Lo aporta quien ya la tiene. */
export type ResolverEtiqueta = (conceptId: string | undefined) => string;

/** Los datos de contexto que el resumen clínico no trae. */
export interface ContextoDelDocumento {
  /** Nombre del paciente; vacío si la sesión no puede leerlo. */
  readonly paciente: string;
  /** Documento de identidad del paciente, si se conoce. */
  readonly documentoDelPaciente?: string;
  /** Quién atiende, en palabras. Vacío si no se sabe. */
  readonly profesional: string;
  /** Matrícula profesional, si se conoce. */
  readonly matricula?: string;
  /** Organización bajo cuya custodia ocurre la atención. */
  readonly organizacion?: string;
}

/**
 * La receta de una indicación.
 *
 * Un documento por indicación y no uno con todas: el ciclo del modelo es por
 * `medication_request` —cada una se firma y se emite por separado— y juntarlas
 * en un papel haría que una emitida y un borrador compartieran validez.
 */
export function recetaDesdeResumen(
  indicacion: MedicationRequest,
  contexto: ContextoDelDocumento,
  etiqueta: ResolverEtiqueta,
): DocumentoDeReceta {
  return {
    id: indicacion.id,
    paciente: {
      nombre: contexto.paciente,
      ...(contexto.documentoDelPaciente === undefined
        ? {}
        : { documento: contexto.documentoDelPaciente }),
    },
    profesional: {
      nombre: contexto.profesional,
      ...(contexto.matricula === undefined ? {} : { matricula: contexto.matricula }),
    },
    ...(contexto.organizacion === undefined ? {} : { organizacion: contexto.organizacion }),
    creadaEl: indicacion.createdAt,
    ...(indicacion.signedAt === undefined ? {} : { firmadaEl: indicacion.signedAt }),
    ...(indicacion.issuedAt === undefined ? {} : { emitidaEl: indicacion.issuedAt }),
    medicamentos: [medicamentoDe(indicacion, etiqueta)],
    // Las indicaciones al paciente (v4.1.3) van en la sección «Indicaciones»
    // del papel, no dentro de la línea del medicamento: son lo que el paciente
    // lee, no lo que farmacia dispensa.
    ...(indicacion.patientInstructionsText === undefined
      ? {}
      : { indicaciones: indicacion.patientInstructionsText }),
  };
}

/** La línea del medicamento, con su vigencia calculada una sola vez. */
function medicamentoDe(indicacion: MedicationRequest, etiqueta: ResolverEtiqueta) {
  const vigencia = vigenciaDe(indicacion);
  return {
    medicamento: etiqueta(indicacion.medicationConceptId),
    ...(indicacion.doseText === undefined ? {} : { dosis: indicacion.doseText }),
    ...(indicacion.frequencyText === undefined ? {} : { frecuencia: indicacion.frequencyText }),
    ...(vigencia === undefined ? {} : { vigencia }),
    estado: etiqueta(indicacion.statusConceptId),
  };
}

/**
 * La historia clínica **de una atención**.
 *
 * Los registros se filtran por `encounterId`: los diagnósticos y las
 * observaciones que el contrato no ata a un encuentro **quedan fuera** en vez
 * de colarse en la atención equivocada. La medicación va entera y a propósito
 * —el contrato no la ata al encuentro— y el bloque lo dice con su título.
 *
 * Los formularios respondidos los aporta quien ya los leyó (el resumen clínico
 * no los trae); el parámetro es opcional para que las pantallas que no los
 * leen sigan produciendo el mismo papel que antes.
 */
export function atencionDesdeResumen(
  encuentro: Encounter,
  resumen: ClinicalSummary,
  contexto: ContextoDelDocumento,
  etiqueta: ResolverEtiqueta,
  formularios?: readonly DocumentoDeFormulario[],
): DocumentoDeAtencion {
  const diagnosticos = resumen.conditions.filter((fila) => fila.encounterId === encuentro.id);
  const observaciones = resumen.observations.filter((fila) => fila.encounterId === encuentro.id);

  return {
    id: encuentro.id,
    paciente: {
      nombre: contexto.paciente,
      ...(contexto.documentoDelPaciente === undefined
        ? {}
        : { documento: contexto.documentoDelPaciente }),
    },
    profesional: {
      nombre: contexto.profesional,
      ...(contexto.matricula === undefined ? {} : { matricula: contexto.matricula }),
    },
    ...(contexto.organizacion === undefined ? {} : { organizacion: contexto.organizacion }),
    ...(encuentro.reasonText === undefined ? {} : { motivo: encuentro.reasonText }),
    ...(encuentro.startAt === undefined ? {} : { inicio: encuentro.startAt }),
    ...(encuentro.endAt === undefined ? {} : { cierre: encuentro.endAt }),
    bloques: [
      {
        titulo: 'Diagnósticos',
        datos: diagnosticos.map((fila) => ({
          etiqueta: etiqueta(fila.codeConceptId),
          valor: etiqueta(fila.clinicalStatusConceptId),
        })),
      },
      {
        titulo: 'Medicación indicada',
        datos: resumen.medicationRequests.map((fila) => ({
          etiqueta: etiqueta(fila.medicationConceptId),
          // La vigencia entra a la línea igual que en la receta: una indicación
          // «cada 8 horas» sin su «hasta cuándo» obliga a adivinar.
          valor: [fila.doseText, fila.frequencyText, vigenciaDe(fila)]
            .filter(Boolean)
            .join(' · '),
        })),
      },
      {
        titulo: 'Observaciones',
        datos: observaciones.map((fila) => ({
          etiqueta: etiqueta(fila.codeConceptId),
          valor: valorDe(fila, etiqueta),
        })),
      },
    ],
    ...(formularios === undefined || formularios.length === 0 ? {} : { formularios }),
  };
}

/** «Desde el 1 de marzo» / «Hasta el 8 de marzo», si la indicación los declara. */
function vigenciaDe(indicacion: MedicationRequest): string | undefined {
  const formato = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' });
  if (indicacion.validFrom !== undefined && indicacion.validTo !== undefined) {
    return `del ${formato.format(indicacion.validFrom)} al ${formato.format(indicacion.validTo)}`;
  }
  if (indicacion.validFrom !== undefined) {
    return `desde el ${formato.format(indicacion.validFrom)}`;
  }
  if (indicacion.validTo !== undefined) {
    return `hasta el ${formato.format(indicacion.validTo)}`;
  }
  return undefined;
}

/**
 * El valor de una observación, por los cinco caminos excluyentes del contrato.
 *
 * Se elige el primero presente porque así lo modela el backend: no hay un campo
 * «valor» calculado, y suponer uno haría que una medición booleana o conceptual
 * saliera vacía en el papel.
 */
function valorDe(observacion: Observation, etiqueta: ResolverEtiqueta): string {
  if (observacion.quantityValue !== undefined) {
    const unidad = etiqueta(observacion.quantityUnitConceptId);
    return `${observacion.quantityValue} ${unidad}`.trim();
  }
  if (observacion.valueDecimal !== undefined) return observacion.valueDecimal;
  if (observacion.valueText !== undefined) return observacion.valueText;
  if (observacion.valueBoolean !== undefined) return observacion.valueBoolean ? 'Sí' : 'No';
  if (observacion.valueConceptId !== undefined) return etiqueta(observacion.valueConceptId);
  return '';
}

/* ============================================================================
    Carril J3 · de las cuatro fuentes al documento único.

    El resumen clínico no trae todo: los formularios los expone `forms`, las
    órdenes `diagnostics` y los resultados su portal. El carril es explícito en
    que **eso está bien** y que no hay que pedir un mega-endpoint — la
    composición se hace acá, y sigue siendo una función pura.
    ========================================================================== */

/** Una orden del portal, como documento para llevar al laboratorio. */
export function ordenDesdeElPortal(
  orden: PatientOrder,
  contexto: ContextoDelDocumento,
  etiqueta: ResolverEtiqueta,
): DocumentoDeOrden {
  return {
    id: orden.id,
    paciente: {
      nombre: contexto.paciente,
      ...(contexto.documentoDelPaciente === undefined
        ? {}
        : { documento: contexto.documentoDelPaciente }),
    },
    profesional: {
      nombre: contexto.profesional,
      ...(contexto.matricula === undefined ? {} : { matricula: contexto.matricula }),
    },
    ...(contexto.organizacion === undefined ? {} : { organizacion: contexto.organizacion }),
    estudio: etiqueta(orden.codeConceptId),
    categoria: etiqueta(orden.categoryConceptId),
    estado: etiqueta(orden.statusConceptId),
    pedidaEl: orden.createdAt,
    ...(orden.preparationInstructions === undefined
      ? {}
      : { preparacion: orden.preparationInstructions }),
  };
}

/**
 * La historia completa, compuesta de lo que devolvieron las cuatro lecturas.
 *
 * Las secciones se pasan aunque estén vacías: `bloquesDeHistoria` las imprime
 * igual y dice que no hay nada, que es distinto de omitirlas.
 *
 * `edad` llega ya calculada y no se deriva acá de la fecha de nacimiento: la
 * aritmética de edades tiene reglas (¿cumplió ya este año?) que no pertenecen a
 * un armador de documentos, y la pantalla que la muestra ya la resolvió.
 */
export function historiaDesdeFuentes(
  fuentes: {
    /** El resumen clínico del paciente. */
    readonly resumen: ClinicalSummary;
    /** Los formularios respondidos, ya en la forma del documento (los lee `forms/me`). */
    readonly formularios: readonly DocumentoDeFormulario[];
    /** Las órdenes del portal del paciente. */
    readonly ordenes: readonly PatientOrder[];
    /** Los resultados liberados. */
    readonly resultados: readonly PatientDiagnosticResult[];
  },
  contexto: ContextoDelDocumento,
  etiqueta: ResolverEtiqueta,
  edad?: string,
): DocumentoDeHistoria {
  const atenciones = fuentes.resumen.encounters.map((encuentro) => {
    const documento = atencionDesdeResumen(encuentro, fuentes.resumen, contexto, etiqueta);
    return {
      titulo:
        documento.inicio === undefined
          ? 'Atención sin fecha registrada'
          : `Atención del ${documento.inicio.toLocaleDateString('es')}`,
      bloques: documento.bloques,
    };
  });

  return {
    paciente: {
      nombre: contexto.paciente,
      ...(contexto.documentoDelPaciente === undefined
        ? {}
        : { documento: contexto.documentoDelPaciente }),
    },
    ...(edad === undefined ? {} : { edad }),
    ...(contexto.organizacion === undefined ? {} : { organizacion: contexto.organizacion }),
    atenciones,
    recetas: fuentes.resumen.medicationRequests.map((indicacion) =>
      recetaDesdeResumen(indicacion, contexto, etiqueta),
    ),
    // Cerrado el TODO(J3/E1): el archivo del paciente ya lee `forms/me` y los
    // aporta acá como fuente, igual que las órdenes y los resultados.
    formularios: fuentes.formularios,
    ordenes: fuentes.ordenes.map((orden) => ordenDesdeElPortal(orden, contexto, etiqueta)),
    resultados: fuentes.resultados.map((resultado) => bloqueDeResultado(resultado, etiqueta)),
  };
}

/** Un resultado liberado, como bloque de la historia. */
function bloqueDeResultado(
  resultado: PatientDiagnosticResult,
  etiqueta: ResolverEtiqueta,
): DocumentoBloque {
  const datos = [{ etiqueta: 'Liberado', valor: resultado.releasedAt.toLocaleDateString('es') }];
  if (resultado.conclusionText !== undefined && resultado.conclusionText.trim() !== '') {
    datos.push({ etiqueta: 'Conclusión', valor: resultado.conclusionText });
  }
  return { titulo: etiqueta(resultado.codeConceptId), datos };
}
