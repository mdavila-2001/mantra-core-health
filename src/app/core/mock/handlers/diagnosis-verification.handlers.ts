import {
  condiciones,
  notas,
  ordenes,
  type CondicionSimulada,
  type EvidenciaSimulada,
  type VerificacionSimulada,
} from '../fixtures/clinica';
import { CURSO_CLINICO, ESTADO_CONDICION, VERIFICACION_DX } from '../fixtures/conceptos';
import { MEDICA } from '../fixtures/personas';
import { conflict, notFound, validation, type MockRouter } from '../mock-router';
import { ahora, cuerpo } from '../mock-store';
import { informes } from './diagnostics.handlers';

/* ============================================================================
    La verificación del diagnóstico (C3): un presuntivo se confirma o se
    rechaza, con motivo y/o evidencia. Contrato §3.4 del plan maestro del
    encuentro clínico; pendiente de backend P41.

    Sólo `PROVISIONAL → CONFIRMED | REFUTED`, y las dos son terminales: un
    diagnóstico decidido no se vuelve a decidir (409). La evidencia tiene que
    ser **de esta persona** —una orden o un informe de su circuito, o una nota
    de su expediente—; una ajena o inexistente es 422, no un dato que se
    guarda y después nadie sabe explicar.
    ========================================================================== */

/** Hasta cuánto puede decir el motivo. Es el tope del contrato. */
export const MAX_MOTIVO = 500;

interface CuerpoDeVerificacion {
  readonly outcome?: unknown;
  readonly reasonText?: unknown;
  readonly basedOn?: unknown;
  readonly onsetAt?: unknown;
  readonly expectedResolutionAt?: unknown;
  readonly clinicalCourseConceptId?: unknown;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : undefined;
}

/**
 * La evidencia resuelta contra lo que la persona tiene, o por qué no vale.
 *
 * Un informe alcanza para nombrar su orden; una nota trae su consulta. Lo que
 * se guarda es lo resuelto, no lo que vino: así la lectura no tiene que
 * volver a cruzar nada.
 */
function resolverEvidencia(
  crudo: unknown,
  patientProfileId: string,
): { readonly evidencia: EvidenciaSimulada | null } | { readonly problema: string } {
  if (crudo === undefined || crudo === null) return { evidencia: null };
  if (typeof crudo !== 'object' || Array.isArray(crudo)) {
    return { problema: 'La evidencia no tiene la forma esperada.' };
  }
  const { kind, noteId, serviceRequestId, diagnosticReportId } = crudo as Record<string, unknown>;

  if (kind === 'NOTE') {
    const nota =
      typeof noteId === 'string' ? notas.todos().find((n) => n.noteId === noteId) : undefined;
    if (nota === undefined || nota.patientProfileId !== patientProfileId) {
      return { problema: 'La nota indicada no existe o no es de esta persona.' };
    }
    return {
      evidencia: {
        kind: 'NOTE',
        noteId: nota.noteId,
        ...(nota.encounterId === undefined ? {} : { encounterId: nota.encounterId }),
      },
    };
  }

  if (kind === 'ANALYSIS') {
    const informe =
      typeof diagnosticReportId === 'string' ? informes.get(diagnosticReportId) : undefined;
    if (
      diagnosticReportId !== undefined &&
      (informe === undefined || informe.patientProfileId !== patientProfileId)
    ) {
      return { problema: 'El informe indicado no existe o no es de esta persona.' };
    }
    const ordenId =
      typeof serviceRequestId === 'string' ? serviceRequestId : informe?.serviceRequestId;
    const orden = ordenId === undefined ? undefined : ordenes.get(ordenId);
    if (orden === undefined || orden.patientProfileId !== patientProfileId) {
      return { problema: 'La orden indicada no existe o no es de esta persona.' };
    }
    return {
      evidencia: {
        kind: 'ANALYSIS',
        serviceRequestId: orden.id,
        ...(informe === undefined ? {} : { diagnosticReportId: informe.id }),
      },
    };
  }

  return { problema: 'La evidencia tiene que ser una nota (NOTE) o un análisis (ANALYSIS).' };
}

export function registerDiagnosisVerification(router: MockRouter): void {
  router.post('/clinical/conditions/:id/verification', (request) => {
    const condicion = condiciones.get(request.params['id']!);
    if (condicion === undefined) return notFound('Diagnóstico no encontrado');
    if (condicion.verificationStatusConceptId !== VERIFICACION_DX['DXV-PROVISIONAL']) {
      return conflict(
        'Este diagnóstico ya no está en estudio: sólo un presuntivo se confirma o se rechaza.',
      );
    }

    const datos = cuerpo<CuerpoDeVerificacion>(request);
    const outcome = datos.outcome;
    if (outcome !== 'CONFIRMED' && outcome !== 'REFUTED') {
      return validation('Indicá si el diagnóstico se confirma o se rechaza.', [
        { field: 'outcome', message: 'outcome debe ser CONFIRMED o REFUTED.' },
      ]);
    }

    const motivo = typeof datos.reasonText === 'string' ? datos.reasonText.trim() : '';
    if (motivo.length > MAX_MOTIVO) {
      return validation(`El motivo no puede superar los ${MAX_MOTIVO} caracteres.`, [
        { field: 'reasonText', message: `Hasta ${MAX_MOTIVO} caracteres.` },
      ]);
    }

    const resuelta = resolverEvidencia(datos.basedOn, condicion.patientProfileId);
    if ('problema' in resuelta) {
      return validation(resuelta.problema, [{ field: 'basedOn', message: resuelta.problema }]);
    }
    if (motivo === '' && resuelta.evidencia === null) {
      return validation(
        'Para decidir hace falta un motivo o una evidencia: una orden, un informe o una nota.',
        [{ field: 'reasonText', message: 'Escribí el motivo o elegí una evidencia.' }],
      );
    }

    const decidedAt = ahora();
    const verification: VerificacionSimulada = {
      outcome,
      decidedAt,
      decidedByProfileId: request.user?.practitionerProfileId ?? MEDICA.id,
      reasonText: motivo === '' ? null : motivo,
      basedOn: resuelta.evidencia,
    };

    let cambios: Partial<CondicionSimulada>;
    if (outcome === 'REFUTED') {
      // Rechazado es terminal y cierra la condición: no hay enfermedad que seguir.
      cambios = {
        verificationStatusConceptId: VERIFICACION_DX['DXV-REFUTED']!,
        resolvedAt: decidedAt,
        verification,
      };
    } else {
      const curso = texto(datos.clinicalCourseConceptId);
      const cronica = curso === CURSO_CLINICO['COND_COURSE_CHRONIC'];
      const fin = texto(datos.expectedResolutionAt) ?? condicion.expectedResolutionAt;
      if (!cronica && fin === undefined) {
        return validation(
          'Para confirmar hay que indicar hasta cuándo se espera la condición, o marcarla como crónica.',
          [{ field: 'expectedResolutionAt', message: 'Fin esperado o curso crónico.' }],
        );
      }
      cambios = {
        verificationStatusConceptId: VERIFICACION_DX['DXV-CONFIRMED']!,
        clinicalStatusConceptId: ESTADO_CONDICION['COND-ACTIVE']!,
        onsetAt: texto(datos.onsetAt) ?? condicion.onsetAt,
        ...(curso === undefined ? {} : { clinicalCourseConceptId: curso }),
        // Una crónica no resuelve: el fin esperado se va aunque el alta lo trajera.
        ...(cronica ? { expectedResolutionAt: undefined } : { expectedResolutionAt: fin }),
        verification,
      };
    }

    const actualizada = condiciones.actualizar(condicion.id, cambios)!;
    // La misma forma que `GET /clinical/patients/:id/summary`: sin la clave interna.
    const { patientProfileId: _paciente, ...publica } = actualizada;
    return publica;
  });
}
