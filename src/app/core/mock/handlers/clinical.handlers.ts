import {
  alergias,
  condiciones,
  documentosDe,
  encuentros,
  episodios,
  notas,
  observaciones,
  ordenes,
  planesDe,
  recetas,
  NOTA_TIPO_EVOLUCION,
  TIPO_ALERGIA,
  TIPO_EPISODIO,
  CATEGORIA_DX,
  type CondicionSimulada,
  type EncuentroSimulado,
  type NotaSimulada,
  type RecetaSimulada,
} from '../fixtures/clinica';
import { CLASE_ENCUENTRO, ESPECIALIDAD, ESTADO, ESTADO_CONDICION, ESTADO_ENCUENTRO, ESTADO_RECETA, SEVERIDAD, VERIFICACION_DX } from '../fixtures/conceptos';
import { MEDICA, PACIENTE, pacientePorId } from '../fixtures/personas';
import { forbidden, notFound, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Expediente clínico: resumen, gráfico (notas, planes, documentos), y las
    escrituras que la pantalla del médico usa.
    ========================================================================== */

function puedeLeer(request: MockRequest, patientProfileId: string): boolean {
  const user = request.user;
  if (user === null) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  if (user.patientProfileId === patientProfileId) return true;
  return user.practitionerProfileId !== undefined || user.roles.includes('SECURITY_ADMIN');
}

function sinPaciente<T extends { patientProfileId: string }>(fila: T): Omit<T, 'patientProfileId'> {
  const { patientProfileId: _p, ...resto } = fila;
  return resto;
}

/**
 * La fila sin su clave interna.
 *
 * Los aspectos médicos se guardan por `id` de paciente, pero ese identificador
 * no es parte del contrato: la lectura es del titular y no hay a quién más
 * pedirle. Devolverlo sería filtrar una clave que la pantalla no necesita.
 */
function sinId<T extends { id: string }>(fila: T): Omit<T, 'id'> {
  const { id: _i, ...resto } = fila;
  return resto;
}

/* ---- FT-22 · aspectos médicos declarados por el titular -------------------
   Un registro por paciente, en memoria como el resto del simulador: lo que se
   guarda sobrevive a la navegación y a un `F5` de la aplicación mientras dure
   la pestaña, que es lo que hace comprobable la persistencia del formulario.

   Es el contrato que la API todavía no publica. Se declara acá —y en
   `ClinicalClient`— porque la rama `mockup` **es** el backend de la maqueta:
   sin esto, «Aspectos médicos» sería un formulario que traga el dato, que es
   exactamente lo que el mandato prohíbe. */
interface AspectosSimulados {
  readonly id: string;
  bloodType?: string;
  allergiesText?: string;
  chronicConditionsText?: string;
  currentMedicationsText?: string;
  surgeriesText?: string;
  familyHistoryText?: string;
  habitsText?: string;
  updatedAt?: string;
}

/** Los campos que el titular puede escribir. `updatedAt` lo pone el servidor. */
const CAMPOS_DE_ASPECTOS = [
  'bloodType',
  'allergiesText',
  'chronicConditionsText',
  'currentMedicationsText',
  'surgeriesText',
  'familyHistoryText',
  'habitsText',
] as const;

const aspectos = new Coleccion<AspectosSimulados>(
  [
    {
      id: PACIENTE.id,
      bloodType: 'O+',
      allergiesText: 'Penicilina (erupción a los 12 años).',
      chronicConditionsText: 'Hipotiroidismo desde 2019.',
      currentMedicationsText: 'Levotiroxina 50 mcg por la mañana.',
      familyHistoryText: 'Madre con hipertensión. Abuelo materno, diabetes tipo 2.',
      habitsText: 'No fumo. Camino 30 minutos casi todos los días.',
      updatedAt: ahora(),
    },
  ],
  // Sobrevive a la recarga: es la única forma de comprobar de verdad que
  // «Guardar» guardó, que es lo que el formulario promete.
  'alovida.mock.medical-aspects',
);

export function registrarClinica(router: MockRouter): void {
  /* ---- FT-22 · aspectos médicos ------------------------------------------ */

  router.get('/clinical/me/medical-aspects', (request) => {
    const id = request.user?.patientProfileId;
    if (id === undefined) return forbidden('Esta lectura es del titular de una ficha de paciente');
    // Objeto vacío y no 404: «todavía no llenaste esto» es un estado corriente
    // del formulario, no un error que la pantalla tenga que manejar aparte.
    return aspectos.get(id) === undefined ? {} : sinId(aspectos.get(id)!);
  });

  router.put('/clinical/me/medical-aspects', (request) => {
    const id = request.user?.patientProfileId;
    if (id === undefined) return forbidden('Esta escritura es del titular de una ficha de paciente');
    const cambios = cuerpo<Record<string, unknown>>(request);
    const previo = aspectos.get(id) ?? { id };
    const actualizado: AspectosSimulados = { ...previo, updatedAt: ahora() };
    for (const campo of CAMPOS_DE_ASPECTOS) {
      // Ausente no se toca; `''` borra. Es lo que permite guardar una sección
      // sin pisar las demás.
      if (campo in cambios) {
        const valor = cambios[campo];
        if (typeof valor === 'string' && valor !== '') {
          actualizado[campo] = valor;
        } else {
          delete actualizado[campo];
        }
      }
    }
    if (aspectos.get(id) === undefined) {
      aspectos.agregar(actualizado);
    } else {
      aspectos.actualizar(id, actualizado);
    }
    return sinId(actualizado);
  });

  router.get('/clinical/patients/:id/summary', (request) => {
    const id = request.params['id']!;
    if (pacientePorId(id) === undefined) return notFound('Paciente no encontrado');
    if (!puedeLeer(request, id)) return forbidden('No tenés turno hoy ni vínculo vigente con esta persona');
    const limit = Number(request.query.get('limit') ?? 50) || 50;
    return {
      patientProfileId: id,
      conditions: condiciones.filtrar((c) => c.patientProfileId === id).map(sinPaciente),
      allergies: alergias.filtrar((a) => a.patientProfileId === id).map(sinPaciente),
      medicationRequests: recetas.filtrar((r) => r.patientProfileId === id).map(sinPaciente),
      observations: observaciones.filtrar((o) => o.patientProfileId === id).sort((a, b) => b.effectiveStartAt.localeCompare(a.effectiveStartAt)).map(sinPaciente),
      encounters: encuentros.filtrar((e) => e.patientProfileId === id).sort((a, b) => b.startAt.localeCompare(a.startAt)).map(sinPaciente),
      careEpisodes: episodios.filtrar((e) => e.patientProfileId === id).map(sinPaciente),
      limit,
      truncated: [],
    };
  });

  router.get('/charts/patients/:id/chart', (request) => {
    const id = request.params['id']!;
    const paciente = pacientePorId(id);
    if (paciente === undefined) return notFound('Paciente no encontrado');
    if (!puedeLeer(request, id)) return forbidden();
    return {
      patientProfileId: id,
      notes: notas
        .filtrar((n) => n.patientProfileId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ patientProfileId: _p, ...n }) => ({ ...n, id: undefined })),
      carePlans: planesDe(paciente),
      documents: documentosDe(paciente),
      limit: Number(request.query.get('limit') ?? 50) || 50,
      truncated: [],
    };
  });

  router.post('/clinical/care-episodes', (request) => {
    const datos = cuerpo<{ patientProfileId: string; tenantId: string; responsiblePractitionerId?: string; typeConceptId?: string; startAt?: string }>(request);
    const nuevo = episodios.agregar({
      id: nuevoId('episode'),
      patientProfileId: datos.patientProfileId ?? '',
      tenantId: datos.tenantId ?? '',
      typeConceptId: datos.typeConceptId ?? TIPO_EPISODIO,
      statusConceptId: ESTADO['ST-ACTIVE']!,
      responsiblePractitionerId: datos.responsiblePractitionerId ?? request.user?.practitionerProfileId ?? MEDICA.id,
      startAt: datos.startAt ?? ahora(),
      endAt: null,
      createdAt: ahora(),
    });
    return { status: 201, body: { id: nuevo.id, patientProfileId: nuevo.patientProfileId, tenantId: nuevo.tenantId, status: 'ACTIVE', startAt: nuevo.startAt, createdAt: nuevo.createdAt } };
  });

  router.post('/clinical/encounters/check-in', (request) => {
    const datos = cuerpo<{ patientProfileId: string; reasonText?: string; episodeId?: string; primaryPractitionerId?: string; classConceptId?: string }>(request);
    const nuevo: EncuentroSimulado = {
      id: nuevoId('encounter'),
      patientProfileId: datos.patientProfileId ?? '',
      ...(datos.episodeId === undefined ? {} : { episodeId: datos.episodeId }),
      statusConceptId: ESTADO_ENCUENTRO['ENCST-IN-PROGRESS']!,
      classConceptId: datos.classConceptId ?? CLASE_ENCUENTRO['ENC-AMB']!,
      primaryPractitionerId: datos.primaryPractitionerId ?? request.user?.practitionerProfileId ?? MEDICA.id,
      reasonText: datos.reasonText ?? 'Consulta',
      startAt: ahora(),
      endAt: null,
    };
    encuentros.agregar(nuevo);
    return { status: 201, body: { id: nuevo.id, patientProfileId: nuevo.patientProfileId, episodeId: nuevo.episodeId ?? null, status: 'IN_PROGRESS', participantIds: [nuevo.primaryPractitionerId], locationIds: [], startAt: nuevo.startAt, endAt: null, createdAt: nuevo.startAt } };
  });

  router.post('/clinical/encounters/:id/close', ({ params }) => {
    const e = encuentros.get(params['id']!);
    if (e === undefined) return notFound('Encuentro no encontrado');
    const endAt = ahora();
    encuentros.actualizar(e.id, { statusConceptId: ESTADO_ENCUENTRO['ENCST-FINISHED']!, endAt });
    return { id: e.id, patientProfileId: e.patientProfileId, episodeId: e.episodeId ?? null, status: 'FINISHED', participantIds: [e.primaryPractitionerId], locationIds: [], startAt: e.startAt, endAt, createdAt: e.startAt };
  });

  router.post('/clinical/medication-requests', (request) => {
    const datos = cuerpo<{ patientProfileId: string; medicationConceptId: string; doseText?: string; frequencyText?: string; validFrom?: string; validTo?: string; patientInstructionsText?: string; prescriberProfileId?: string }>(request);
    const nueva: RecetaSimulada = {
      id: nuevoId('rx'),
      patientProfileId: datos.patientProfileId ?? '',
      medicationConceptId: datos.medicationConceptId ?? '',
      statusConceptId: ESTADO_RECETA['RX-DRAFT']!,
      prescriberProfileId: datos.prescriberProfileId ?? request.user?.practitionerProfileId ?? MEDICA.id,
      doseText: datos.doseText ?? '',
      frequencyText: datos.frequencyText ?? '',
      validFrom: datos.validFrom ?? ahora(),
      validTo: datos.validTo ?? ahora(),
      patientInstructionsText: datos.patientInstructionsText ?? '',
      signedAt: null,
      issuedAt: null,
      createdAt: ahora(),
    };
    recetas.agregar(nueva);
    return { status: 201, body: registroReceta(nueva) };
  });

  router.post('/clinical/medication-requests/:id/sign', ({ params }) => {
    const r = recetas.get(params['id']!);
    if (r === undefined) return notFound();
    return registroReceta(recetas.actualizar(r.id, { signedAt: ahora(), statusConceptId: ESTADO_RECETA['RX-ACTIVE']! })!);
  });

  router.post('/clinical/medication-requests/:id/issue', ({ params }) => {
    const r = recetas.get(params['id']!);
    if (r === undefined) return notFound();
    return registroReceta(recetas.actualizar(r.id, { issuedAt: ahora(), statusConceptId: ESTADO_RECETA['RX-ACTIVE']! })!);
  });

  router.post('/clinical/conditions', (request) => {
    const datos = cuerpo<{ patientProfileId: string; codeConceptId: string; encounterId?: string; categoryConceptId?: string; severityConceptId?: string; onsetAt?: string; noteText?: string }>(request);
    const nueva: CondicionSimulada = {
      id: nuevoId('condition'),
      patientProfileId: datos.patientProfileId ?? '',
      codeConceptId: datos.codeConceptId ?? '',
      categoryConceptId: datos.categoryConceptId ?? CATEGORIA_DX,
      clinicalStatusConceptId: ESTADO_CONDICION['COND-ACTIVE']!,
      verificationStatusConceptId: VERIFICACION_DX['DXV-PROVISIONAL']!,
      severityConceptId: datos.severityConceptId ?? SEVERIDAD['SEV-MILD']!,
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      onsetAt: datos.onsetAt ?? ahora(),
      noteText: datos.noteText ?? '',
      createdAt: ahora(),
    };
    condiciones.agregar(nueva);
    return { status: 201, body: { id: nueva.id, patientProfileId: nueva.patientProfileId, clinicalStatus: 'ACTIVE', verificationStatus: 'PROVISIONAL', clinicalCourse: null, createdAt: nueva.createdAt } };
  });

  router.post('/clinical/conditions/:id/change-status', (request) => {
    const c = condiciones.get(request.params['id']!);
    if (c === undefined) return notFound();
    const datos = cuerpo<{ newClinicalStatusConceptId: string }>(request);
    const actualizada = condiciones.actualizar(c.id, {
      clinicalStatusConceptId: datos.newClinicalStatusConceptId ?? c.clinicalStatusConceptId,
      ...(datos.newClinicalStatusConceptId === ESTADO_CONDICION['COND-RESOLVED'] ? { resolvedAt: ahora() } : {}),
    })!;
    return sinPaciente(actualizada);
  });

  router.post('/clinical/conditions/:id/attachments', () => ({ status: 201, body: { ok: true } }));
  router.post('/clinical/procedures/:id/attachments', () => ({ status: 201, body: { ok: true } }));

  router.post('/clinical/allergy-intolerances', (request) => {
    const datos = cuerpo<{ patientProfileId: string; substanceConceptId: string; typeConceptId?: string; categoryConceptId?: string; criticalityConceptId?: string; reactions?: unknown[] }>(request);
    const nueva = alergias.agregar({
      id: nuevoId('allergy'),
      patientProfileId: datos.patientProfileId ?? '',
      substanceConceptId: datos.substanceConceptId ?? '',
      typeConceptId: datos.typeConceptId ?? TIPO_ALERGIA,
      categoryConceptId: datos.categoryConceptId ?? '',
      criticalityConceptId: datos.criticalityConceptId ?? '',
      clinicalStatusConceptId: ESTADO_CONDICION['COND-ACTIVE']!,
      createdAt: ahora(),
    });
    return { status: 201, body: { id: nueva.id, patientProfileId: nueva.patientProfileId, clinicalStatus: 'ACTIVE', reactionIds: (datos.reactions ?? []).map(() => nuevoId('reaction')), createdAt: nueva.createdAt } };
  });

  router.post('/clinical/observations', (request) => {
    const datos = cuerpo<{ patientProfileId: string; codeConceptId: string; valueDecimal?: number; quantityValue?: number; quantityUnitConceptId?: string; effectiveStartAt?: string; encounterId?: string; components?: unknown[] }>(request);
    const valor = String(datos.quantityValue ?? datos.valueDecimal ?? '');
    const nueva = observaciones.agregar({
      id: nuevoId('obs'),
      patientProfileId: datos.patientProfileId ?? '',
      codeConceptId: datos.codeConceptId ?? '',
      statusConceptId: ESTADO['ST-COMPLETED']!,
      valueDecimal: valor,
      quantityValue: valor,
      quantityUnitConceptId: datos.quantityUnitConceptId ?? '',
      effectiveStartAt: datos.effectiveStartAt ?? ahora(),
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
    });
    return { status: 201, body: { id: nueva.id, patientProfileId: nueva.patientProfileId, status: 'FINAL', componentIds: (datos.components ?? []).map(() => nuevoId('component')), rowVersion: 1, createdAt: ahora() } };
  });

  router.post('/clinical/diagnostic-reports', (request) => {
    const datos = cuerpo<{ patientProfileId: string; serviceRequestId?: string }>(request);
    return { status: 201, body: { id: nuevoId('report'), patientProfileId: datos.patientProfileId ?? '', lifecycleStatus: 'PRELIMINARY', resultReleaseStatus: null, serviceRequestId: datos.serviceRequestId ?? null, createdAt: ahora() } };
  });

  router.post('/clinical/diagnostic-reports/:id/release', ({ params }) => ({ id: params['id'], patientProfileId: '', lifecycleStatus: 'FINAL', resultReleaseStatus: 'RELEASED', serviceRequestId: null, createdAt: ahora() }));

  router.post('/clinical/service-requests', (request) => {
    const datos = cuerpo<{ patientProfileId: string; codeConceptId: string; categoryConceptId?: string; priorityConceptId?: string; reasonText?: string; encounterId?: string }>(request);
    const nueva = ordenes.agregar({
      id: nuevoId('order'),
      patientProfileId: datos.patientProfileId ?? '',
      codeConceptId: datos.codeConceptId ?? '',
      categoryConceptId: datos.categoryConceptId ?? '',
      priorityConceptId: datos.priorityConceptId ?? '',
      statusConceptId: ESTADO['ST-PENDING']!,
      requesterProfileId: request.user?.practitionerProfileId ?? MEDICA.id,
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      reasonText: datos.reasonText ?? '',
      createdAt: ahora(),
    });
    return { status: 201, body: { id: nueva.id, patientProfileId: nueva.patientProfileId, status: 'ACTIVE', createdAt: nueva.createdAt } };
  });

  router.post('/cds/check-interactions', (request) => {
    const datos = cuerpo<{ substanceConceptIds?: string[] }>(request);
    const sustancias = datos.substanceConceptIds ?? [];
    const alertas = sustancias.length >= 2
      ? [{ id: uuid(`alert-${sustancias.join('-')}`), alertTypeConceptId: uuid('concept-alert-interaction'), severityConceptId: SEVERIDAD['SEV-MODERATE']!, ruleId: 'DDI-0042' }]
      : [];
    return { alerts: alertas, count: alertas.length };
  });

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
    return { status: 201, body: { noteId, versionId: nueva.currentVersionId, versionNumber: 1, lifecycleStatusConceptId: nueva.lifecycleStatusConceptId, versionStatusConceptId: ESTADO['ST-DRAFT']! } };
  });

  router.post('/charts/notes/:id/versions', (request) => {
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
  });

  /* ---- plantillas de expediente ------------------------------------------- */

  router.get('/charts/templates', ({ query }) => {
    const esp = query.get('specialtyConceptId');
    return PLANTILLAS_DE_EXPEDIENTE.filter((t) => esp === null || esp === '' || t.specialtyConceptId === esp);
  });
  router.get('/charts/templates/:id', ({ params }) => PLANTILLAS_DE_EXPEDIENTE.find((t) => t.id === params['id']) ?? notFound('Plantilla no encontrada'));
  router.post('/charts/templates', (request) => {
    const datos = cuerpo<{ specialtyConceptId: string; code: string; name: string; fields: { code: string; name: string; dataType: string; required?: boolean }[] }>(request);
    const nueva = plantilla(datos.code ?? 'NUEVA', datos.name ?? 'Plantilla nueva', datos.specialtyConceptId ?? '', (datos.fields ?? []).map((f) => [f.code, f.name, f.dataType, f.required ?? false] as const));
    PLANTILLAS_DE_EXPEDIENTE.push(nueva);
    return { status: 201, body: nueva };
  });
  router.post('/charts/templates/:id/assignments', (request) => {
    const datos = cuerpo<{ isDefault?: boolean }>(request);
    return { status: 201, body: { id: nuevoId('assignment'), templateId: request.params['id'], isDefault: datos.isDefault ?? false, statusConceptId: ESTADO['ST-ACTIVE']! } };
  });
}

/* ---- plantillas de expediente, a nivel de módulo ------------------------

   Fuera de `registrarClinico` porque el motor de formularios —que vive en
   `surveys-forms.handlers.ts`— cuelga campos propios de estas mismas
   plantillas. Con el array dentro de la función, `POST /forms/assignments`
   devolvía un id y el campo no aparecía en ninguna parte.
   ---------------------------------------------------------------------- */
export const PLANTILLAS_DE_EXPEDIENTE = [
  plantilla('CARDIO-BASE', 'Evaluación cardiológica', ESPECIALIDAD['SP-CARDIO']!, [
    ['pa_sistolica', 'Presión sistólica', 'NUMBER', true],
    ['pa_diastolica', 'Presión diastólica', 'NUMBER', true],
    ['fc', 'Frecuencia cardíaca', 'NUMBER', true],
    ['soplo', 'Soplo cardíaco', 'BOOLEAN', false],
    ['nyha', 'Clase funcional NYHA', 'TEXT', false],
  ]),
  plantilla('PEDIA-CONTROL', 'Control de niño sano', ESPECIALIDAD['SP-PEDIA']!, [
    ['peso', 'Peso (kg)', 'NUMBER', true],
    ['talla', 'Talla (cm)', 'NUMBER', true],
    ['perimetro', 'Perímetro cefálico', 'NUMBER', false],
    ['vacunas_al_dia', 'Vacunas al día', 'BOOLEAN', true],
  ]),
  plantilla('GINE-PRENATAL', 'Control prenatal', ESPECIALIDAD['SP-GINE']!, [
    ['semanas', 'Semanas de gestación', 'NUMBER', true],
    ['altura_uterina', 'Altura uterina', 'NUMBER', false],
    ['fcf', 'Frecuencia cardíaca fetal', 'NUMBER', true],
  ]),
  plantilla('MEDINT-GENERAL', 'Consulta de medicina interna', ESPECIALIDAD['SP-MEDINT']!, [
    ['motivo', 'Motivo de consulta', 'TEXT', true],
    ['examen', 'Examen físico', 'TEXT', true],
  ]),
];;

function registroReceta(r: RecetaSimulada) {
  return { id: r.id, patientProfileId: r.patientProfileId, status: r.statusConceptId === ESTADO_RECETA['RX-DRAFT'] ? 'DRAFT' : 'ACTIVE', replacesRequestId: null, replacedByRequestId: null, renewedFromRequestId: null, signedAt: r.signedAt, createdAt: r.createdAt };
}

export function plantilla(code: string, name: string, specialtyConceptId: string, campos: readonly (readonly [string, string, string, boolean])[]) {
  return {
    id: uuid(`chart-template-${code}`),
    specialtyConceptId,
    code,
    name,
    version: 1,
    statusConceptId: ESTADO['ST-PUBLISHED']!,
    // Un target por formulario y no uno compartido: `POST /forms/assignments`
    // sólo recibe el `targetResourceConceptId`, así que con un target común no
    // había forma de saber a qué formulario colgarle el campo.
    fieldTargetConceptId: uuid(`concept-field-target-${code}`),
    fields: campos.map(([c, n, dataType, required], i) => ({
      assignmentId: uuid(`tpl-assign-${code}-${c}`),
      fieldId: uuid(`tpl-field-${code}-${c}`),
      code: c,
      name: n,
      dataType,
      required,
      ordinal: i + 1,
      // `false`: son los campos del formulario **estándar**, los que hacen
      // comparable una ficha entre consultorios. Marcarlos como propios ponía
      // los cinco bajo «Campos de tu organización» con el sello «Tuyo», dejaba
      // vacía la sección del estándar, y ofrecía editar lo que no se toca.
      own: false,
    })),
    provenance: { sourceTitle: 'Guía de práctica clínica', organization: 'Ministerio de Salud', url: 'https://www.minsalud.gob.bo', license: 'CC BY 4.0', retrievedAt: '2026-01-15' },
  };
}
