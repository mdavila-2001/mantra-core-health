import { notas, NOTA_TIPO_EVOLUCION, type NotaSimulada } from '../fixtures/clinica';
import { ESTADO } from '../fixtures/conceptos';
import { MEDICA } from '../fixtures/personas';
import { notFound, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import { avisarFichaAlPaciente } from './clinical.handlers';

export function registerMedicalNotes(router: MockRouter): void {
  /* ---- notas clínicas ------------------------------------------------------ */

  router.post('/charts/notes', (request) => {
    const datos = cuerpo<{ patientProfileId: string; authorProfileId: string; encounterId?: string; noteTypeConceptId?: string; chiefComplaintText?: string; subjectiveText?: string; objectiveText?: string; assessmentText?: string; planText?: string }>(request);
    const noteId = nuevoId('note');
    const nueva: NotaSimulada & { id: string } = {
      noteId,
      id: noteId,
      patientProfileId: datos.patientProfileId ?? '',
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      noteTypeConceptId: datos.noteTypeConceptId ?? NOTA_TIPO_EVOLUCION,
      lifecycleStatusConceptId: ESTADO['ST-DRAFT']!,
      currentVersionId: nuevoId('note-version'),
      versionNumber: 1,
      authorProfileId: datos.authorProfileId ?? request.user?.practitionerProfileId ?? MEDICA.id,
      chiefComplaintText: datos.chiefComplaintText ?? '',
      subjectiveText: datos.subjectiveText ?? '',
      objectiveText: datos.objectiveText ?? '',
      assessmentText: datos.assessmentText ?? '',
      planText: datos.planText ?? '',
      signedAt: null,
      releasedToPatient: false,
      createdAt: ahora(),
    };
    notas.agregar(nueva);
    // La nota de evolución es la otra mitad de la ficha: si el médico empezó
    // por acá y no por el diagnóstico, el aviso sale igual. Y si ya salió por
    // el diagnóstico, no sale dos veces.
    avisarFichaAlPaciente({
      patientProfileId: nueva.patientProfileId,
      encounterId: nueva.encounterId,
      autorProfileId: nueva.authorProfileId,
    });
    return { status: 201, body: { noteId, versionId: nueva.currentVersionId, versionNumber: 1, lifecycleStatusConceptId: nueva.lifecycleStatusConceptId, versionStatusConceptId: ESTADO['ST-DRAFT']! } };
  });

  // `ChartNotesClient.appendVersion` hace `PUT` (UC-15-02); se acepta también
  // `POST` por si alguna pantalla vieja lo usa.
  const agregarVersion = (request: MockRequest) => {
    const n = notas.get(request.params['id']!);
    if (n === undefined) return notFound('Nota no encontrada');
    const datos = cuerpo<Partial<NotaSimulada>>(request);
    const versionId = nuevoId('note-version');
    notas.actualizar(n.noteId, {
      ...datos,
      currentVersionId: versionId,
      versionNumber: n.versionNumber + 1,
    });
    return { status: 201, body: { noteId: n.noteId, versionId, versionNumber: n.versionNumber + 1, lifecycleStatusConceptId: n.lifecycleStatusConceptId, versionStatusConceptId: ESTADO['ST-DRAFT']! } };
  };
  router.put('/charts/notes/:id/versions', agregarVersion);
  router.post('/charts/notes/:id/versions', agregarVersion);
}
