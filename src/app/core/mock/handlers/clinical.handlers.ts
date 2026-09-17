import {
  alergias,
  condiciones,
  documentos,
  documentosDe,
  encuentros,
  episodios,
  notas,
  observaciones,
  ordenes,
  planes,
  planesDe,
  recetas,
  CATEGORIA_DOCUMENTO,
  NOTA_TIPO_EVOLUCION,
  TIPO_ALERGIA,
  TIPO_EPISODIO,
  CATEGORIA_DX,
  type CondicionSimulada,
  type EncuentroSimulado,
  type NotaSimulada,
  type RecetaSimulada,
} from '../fixtures/clinica';
import { CLASE_ENCUENTRO, ESPECIALIDAD, ESTADO, ESTADO_CONDICION, ESTADO_ENCUENTRO, ESTADO_RECETA, INTENCION_DEL_PLAN, SEVERIDAD, VERIFICACION_DX } from '../fixtures/conceptos';
import { MEDICA, PACIENTE, pacientePorId, profesionalPorId } from '../fixtures/personas';
import { forbidden, notFound, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, isoDia, nuevoId, uuid } from '../mock-store';
import { emitirNotificacion } from './notifications.handlers';
import { enlazarArchivo, pdfMinimo } from './files.handlers';
import { FICHAS_ESTANDAR } from '../fixtures/fichas-estandar.generated';
import { representaA } from './profiles.handlers';

/* ============================================================================
    Expediente clínico: resumen, gráfico (notas, planes, documentos), y las
    escrituras que la pantalla del médico usa.
    ========================================================================== */

function puedeLeer(request: MockRequest, patientProfileId: string): boolean {
  const user = request.user;
  if (user === null) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  if (user.patientProfileId === patientProfileId) return true;
  // Y quien lo representa (B.1): la historia de un menor la lee su tutor.
  if (representaA(user.patientProfileId, patientProfileId)) return true;
  return user.practitionerProfileId !== undefined || user.roles.includes('SECURITY_ADMIN');
}

/* ---- el aviso de la ficha (proceso 2.6) ---------------------------------- */

/**
 * Los encuentros cuyo paciente ya recibió el aviso de su ficha.
 *
 * **Un aviso por consulta, no uno por campo.** El proceso promete «el aviso de
 * la recepción de su ficha medica», en singular, y una ficha se escribe de a
 * pedazos: el diagnóstico, la nota de evolución, un segundo diagnóstico. Sin
 * esta memoria, media hora de consulta le llegaría al paciente como cuatro
 * pitidos que dicen lo mismo — que es exactamente lo que un TOUS no debe ser.
 *
 * Vive en memoria y muere con la pestaña, como todo el simulador.
 */
const fichasAvisadas = new Set<string>();

/**
 * Deja en la campana del paciente el aviso de que su ficha ya está escrita.
 *
 * Es el punto **2.6.1.1** del registro de procesos: «El medico realiza su
 * Diagnóstico y crea su ficha medica del paciente en la APP quedando guardada y
 * el paciente recibirá un TOUS donde recibirá el aviso de la recepción de su
 * ficha medica creada por el médico». El TOUS del glosario es «el push
 * silencioso que informa sin invadir la pantalla», y eso en la aplicación es la
 * campana: aparece sin robar el foco y espera a que la persona la mire.
 *
 * **Nace al GUARDAR, no al cerrar la consulta.** Es la diferencia que el
 * informe marcó como incompleta: la ficha y el diagnóstico ya existían, pero al
 * paciente no le llegaba nada hasta que el médico cerraba el encuentro —que
 * puede ser horas después, o al día siguiente, o nunca si la consulta queda
 * abierta esperando estudios (2.6.1.3)—.
 *
 * **Sin encuentro no hay aviso.** Un diagnóstico cargado fuera de una consulta
 * es una corrección del expediente, no «la ficha de tu consulta»: avisarlo con
 * ese texto sería contar algo que no pasó.
 */
function avisarFichaAlPaciente(datos: {
  readonly patientProfileId: string;
  readonly encounterId: string | undefined;
  readonly autorProfileId: string;
}): void {
  const encuentro = datos.encounterId ?? '';
  if (encuentro === '' || fichasAvisadas.has(encuentro)) return;

  const paciente = pacientePorId(datos.patientProfileId);
  if (paciente === undefined) return;

  fichasAvisadas.add(encuentro);

  // Sin «Dr.» ni «Dra.»: los fixtures no declaran el tratamiento de nadie, y
  // deducirlo del nombre es equivocarse con la mitad de la gente.
  const autor = profesionalPorId(datos.autorProfileId)?.displayName ?? 'Tu profesional';

  emitirNotificacion({
    userId: paciente.userId,
    category: 'CLINICAL',
    // El asunto dice qué pasó; el cuerpo, quién y dónde leerlo. Ninguno de los
    // dos adelanta el diagnóstico: un renglón de la campana es lo que se ve
    // desde la pantalla bloqueada del teléfono, y ahí no va un dato clínico.
    subject: 'Tu ficha de la consulta ya está lista',
    bodyText: `${autor} guardó la ficha de tu consulta con su diagnóstico. Ya podés leerla en tu historia clínica.`,
    destination: { type: 'ENCOUNTER', id: encuentro },
    payloadJson: { encounterId: encuentro },
  });
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
    const datos = cuerpo<{ patientProfileId: string; medicationConceptId: string; encounterId?: string; indicationConditionId?: string; indicationText?: string; doseText?: string; frequencyText?: string; validFrom?: string; validTo?: string; patientInstructionsText?: string; prescriberProfileId?: string }>(request);
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
      // El «para qué es» de la receta. El concepto gana sobre el texto libre,
      // igual que la ocupación del alta de paciente: el texto sólo tenía
      // sentido para quien no encontró un diagnóstico registrado.
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      ...(datos.indicationConditionId === undefined
        ? {}
        : { indicationConditionId: datos.indicationConditionId }),
      ...(datos.indicationConditionId !== undefined || datos.indicationText === undefined
        ? {}
        : { indicationText: datos.indicationText }),
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

  /**
   * `GET /clinical/prescriptions/:id/pdf` — el PDF oficial de la receta (B.3).
   *
   * Reusa `pdfMinimo` (mismo generador que ya sirve `/download-url`): alcanza
   * para que el botón del portal descargue un archivo `%PDF` de verdad y
   * ejercite el camino completo (blob autenticado → `data:` URL → guardado),
   * que es lo que el barrido de Playwright del mock puede comprobar.
   */
  router.get('/clinical/prescriptions/:id/pdf', (request) => {
    const r = recetas.get(request.params['id']!);
    if (r === undefined) return notFound('Receta no encontrada');
    if (!puedeLeer(request, r.patientProfileId)) return forbidden();

    const esOficial = r.issuedAt !== null;
    const texto = esOficial
      ? `Receta oficial ${r.id}`
      : `Copia de trabajo ${r.id} - sin validez farmaceutica`;
    return {
      status: 200,
      body: new Blob([pdfMinimo(texto)], { type: 'application/pdf' }),
      headers: {
        'Content-Disposition': `attachment; filename*=UTF-8''receta-${r.id}.pdf`,
        'Cache-Control': 'private, no-store',
      },
    };
  });

  /**
   * `GET /public/prescriptions/:id/verify` — verificación pública, sin PHI
   * (B.3). La maqueta no modela matrícula/jurisdicción, así que
   * `prescriberLicense` viaja `null`; el contrato real se ejercita contra la
   * API viva en `clinical-prescriptions-pdf.int-spec.ts` del backend.
   */
  router.get('/public/prescriptions/:id/verify', ({ params }) => {
    const r = recetas.get(params['id']!);
    if (r === undefined) return notFound('Receta no encontrada');
    return {
      status: 200,
      body: {
        id: r.id,
        status: r.issuedAt !== null ? 'ISSUED' : 'DRAFT',
        issuedAt: r.issuedAt,
        contentHash: r.issuedAt !== null ? uuid(`sello-${r.id}`).replace(/-/g, '') : null,
        prescriberLicense: null,
      },
      headers: { 'Cache-Control': 'no-store' },
    };
  });

  router.post('/clinical/conditions', (request) => {
    const datos = cuerpo<{ patientProfileId: string; codeConceptId: string; encounterId?: string; categoryConceptId?: string; severityConceptId?: string; lateralityConceptId?: string; clinicalCourseConceptId?: string; onsetAt?: string; expectedResolutionAt?: string; noteText?: string }>(request);
    const nueva: CondicionSimulada = {
      id: nuevoId('condition'),
      patientProfileId: datos.patientProfileId ?? '',
      codeConceptId: datos.codeConceptId ?? '',
      categoryConceptId: datos.categoryConceptId ?? CATEGORIA_DX,
      clinicalStatusConceptId: ESTADO_CONDICION['COND-ACTIVE']!,
      verificationStatusConceptId: VERIFICACION_DX['DXV-PROVISIONAL']!,
      severityConceptId: datos.severityConceptId ?? SEVERIDAD['SEV-MILD']!,
      // El curso y la fecha esperada **se guardan**: el contrato los declara
      // desde el patch v4.0.8 y el simulador los descartaba, así que registrar
      // un diagnóstico crónico daba una condición sin curso y la pantalla no
      // podía decir que lo era.
      ...(datos.lateralityConceptId === undefined ? {} : { lateralityConceptId: datos.lateralityConceptId }),
      ...(datos.clinicalCourseConceptId === undefined ? {} : { clinicalCourseConceptId: datos.clinicalCourseConceptId }),
      ...(datos.expectedResolutionAt === undefined ? {} : { expectedResolutionAt: datos.expectedResolutionAt }),
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      onsetAt: datos.onsetAt ?? ahora(),
      noteText: datos.noteText ?? '',
      createdAt: ahora(),
    };
    condiciones.agregar(nueva);
    avisarFichaAlPaciente({
      patientProfileId: nueva.patientProfileId,
      encounterId: nueva.encounterId,
      autorProfileId: request.user?.practitionerProfileId ?? MEDICA.id,
    });
    return { status: 201, body: { id: nueva.id, patientProfileId: nueva.patientProfileId, clinicalStatus: 'ACTIVE', verificationStatus: 'PROVISIONAL', clinicalCourse: nueva.clinicalCourseConceptId ?? null, createdAt: nueva.createdAt } };
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

  /* ---- adjuntos ------------------------------------------------------------
     Las cuatro rutas **guardan el vínculo** en vez de devolver `{ ok: true }`
     y perderlo: sin eso, `GET /common/files/links` no devolvía nunca lo recién
     adjuntado y la lista de archivos de una fila salía siempre vacía. */

  const adjuntar = (ownerType: string, ownerId: string, request: MockRequest) => {
    const { fileId } = cuerpo<{ fileId: string }>(request);
    return {
      status: 201,
      body: enlazarArchivo({ ownerType, ownerId, fileId: fileId ?? '' }),
    };
  };

  router.post('/clinical/conditions/:id/attachments', (request) =>
    adjuntar('CONDITION', request.params['id']!, request),
  );
  router.post('/clinical/procedures/:id/attachments', (request) =>
    adjuntar('PROCEDURE', request.params['id']!, request),
  );
  router.post('/clinical/medication-requests/:id/attachments', (request) =>
    adjuntar('MEDICATION_REQUEST', request.params['id']!, request),
  );
  router.post('/clinical/allergy-intolerances/:id/attachments', (request) =>
    adjuntar('ALLERGY_INTOLERANCE', request.params['id']!, request),
  );

  router.post('/clinical/allergy-intolerances', (request) => {
    const datos = cuerpo<{
      patientProfileId: string;
      substanceConceptId: string;
      typeConceptId?: string;
      categoryConceptId?: string;
      criticalityConceptId?: string;
      encounterId?: string;
      reactions?: readonly { manifestationConceptId: string; severityConceptId?: string; description?: string }[];
    }>(request);
    // Las reacciones **se guardan**: son el dato que dice qué le pasó a la
    // persona, y el simulador sólo devolvía sus identificadores y las tiraba.
    const reacciones = (datos.reactions ?? []).map((r) => ({
      id: nuevoId('reaction'),
      manifestationConceptId: r.manifestationConceptId,
      ...(r.severityConceptId === undefined ? {} : { severityConceptId: r.severityConceptId }),
      ...(r.description === undefined || r.description === '' ? {} : { description: r.description }),
    }));
    const nueva = alergias.agregar({
      id: nuevoId('allergy'),
      patientProfileId: datos.patientProfileId ?? '',
      substanceConceptId: datos.substanceConceptId ?? '',
      typeConceptId: datos.typeConceptId ?? TIPO_ALERGIA,
      categoryConceptId: datos.categoryConceptId ?? '',
      criticalityConceptId: datos.criticalityConceptId ?? '',
      clinicalStatusConceptId: ESTADO_CONDICION['COND-ACTIVE']!,
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      ...(reacciones.length === 0 ? {} : { reactions: reacciones }),
      createdAt: ahora(),
    });
    return { status: 201, body: { id: nueva.id, patientProfileId: nueva.patientProfileId, clinicalStatus: 'ACTIVE', reactionIds: reacciones.map((r) => r.id), createdAt: nueva.createdAt } };
  });

  router.post('/clinical/observations', (request) => {
    const datos = cuerpo<{ patientProfileId: string; codeConceptId: string; valueDecimal?: number; quantityValue?: number; valueText?: string; quantityUnitConceptId?: string; interpretationConceptId?: string; categoryConceptId?: string; effectiveStartAt?: string; encounterId?: string; components?: unknown[] }>(request);
    // El texto libre cuenta como valor: una observación cualitativa —«ruidos
    // cardíacos rítmicos»— no tiene número y guardarla vacía la dejaba sin
    // nada que mostrar en la tabla del expediente.
    const valor = String(datos.quantityValue ?? datos.valueDecimal ?? datos.valueText ?? '');
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
      ...(datos.interpretationConceptId === undefined ? {} : { interpretationConceptId: datos.interpretationConceptId }),
      ...(datos.categoryConceptId === undefined ? {} : { categoryConceptId: datos.categoryConceptId }),
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

  /* ---- planes de cuidados y documentos -------------------------------------
     Las dos rutas existían en el backend desde UC-15-09/10 y la maqueta no las
     tenía: el expediente sabía listar planes y documentos y no había forma de
     crear ninguno. Guardan en colección —no devuelven un id y se olvidan—
     porque lo que el expediente hace después de crear es **releer**, y una
     fila que no vuelve de la lectura se ve exactamente igual que una escritura
     que falló. */

  router.post('/charts/care-plans', (request) => {
    const datos = cuerpo<{ patientProfileId: string; conditionId?: string; encounterId?: string; intentConceptId?: string; goalText?: string; startDate?: string; endDate?: string; activities?: { activityConceptId?: string; scheduledAt?: string; detailText?: string }[] }>(request);
    const actividades = (datos.activities ?? []).map((actividad) => ({
      id: nuevoId('cp-act'),
      statusConceptId: ESTADO['ST-PENDING']!,
      detailText: actividad.detailText ?? '',
      scheduledAt: actividad.scheduledAt ?? null,
      ...(actividad.activityConceptId === undefined ? {} : { activityConceptId: actividad.activityConceptId }),
    }));
    const nuevo = planes.agregar({
      id: nuevoId('careplan'),
      patientProfileId: datos.patientProfileId ?? '',
      statusConceptId: ESTADO['ST-ACTIVE']!,
      intentConceptId: datos.intentConceptId ?? INTENCION_DEL_PLAN['CP-INTENT-PLAN']!,
      goalText: datos.goalText ?? '',
      startDate: datos.startDate ?? isoDia(0),
      endDate: datos.endDate ?? null,
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      ...(datos.conditionId === undefined ? {} : { conditionId: datos.conditionId }),
      activities: actividades,
      createdAt: ahora(),
    });
    return { status: 201, body: { id: nuevo.id, statusConceptId: nuevo.statusConceptId, activityCount: actividades.length, createdAt: nuevo.createdAt } };
  });

  router.post('/charts/documents', (request) => {
    const datos = cuerpo<{ patientProfileId: string; tenantId: string; title: string; categoryConceptId?: string; authorText?: string; isExternal?: boolean; encounterId?: string; files?: { fileId: string }[] }>(request);
    const nuevo = documentos.agregar({
      id: nuevoId('doc'),
      patientProfileId: datos.patientProfileId ?? '',
      title: datos.title ?? 'Documento sin título',
      categoryConceptId: datos.categoryConceptId ?? CATEGORIA_DOCUMENTO,
      statusConceptId: ESTADO['ST-DRAFT']!,
      authorText: datos.authorText ?? request.user?.displayName ?? '',
      isExternal: datos.isExternal ?? false,
      documentDate: ahora(),
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      createdAt: ahora(),
    });
    return { status: 201, body: { id: nuevo.id, statusConceptId: nuevo.statusConceptId, fileCount: (datos.files ?? []).length, createdAt: nuevo.createdAt } };
  });

  /* ---- plantillas de expediente ------------------------------------------- */

  router.get('/charts/templates', ({ query }) => {
    const esp = query.get('specialtyConceptId');
    return plantillasVigentes().filter((t) => esp === null || esp === '' || t.specialtyConceptId === esp);
  });
  router.get('/charts/templates/:id', ({ params }) => plantillasVigentes().find((t) => t.id === params['id']) ?? notFound('Plantilla no encontrada'));
  router.post('/charts/templates', (request) => {
    const datos = cuerpo<{ specialtyConceptId: string; code: string; name: string; fields: { code: string; name: string; dataType: string; required?: boolean }[] }>(request);
    const nueva = plantilla(datos.code ?? 'NUEVA', datos.name ?? 'Plantilla nueva', datos.specialtyConceptId ?? '', (datos.fields ?? []).map((f) => [f.code, f.name, f.dataType, f.required ?? false] as const));
    PLANTILLAS_CREADAS.push(nueva);
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
/**
 * El concepto de las fichas **transversales**.
 *
 * Consentimiento, anamnesis general, examen físico y epicrisis no pertenecen a
 * ninguna disciplina, así que no están en `VS_MEDICAL_SPECIALTY`. El backend
 * les acuña un concepto propio (`CODIGO_TRANSVERSAL` de
 * `clinical-forms-seed.service.ts`) y acá se hace lo mismo, con el derivador de
 * ids que usa `definir()`: el bloque clínico las reconoce por el prefijo
 * `TRANSV_` de su código y las deja siempre a mano.
 */
const ESPECIALIDAD_TRANSVERSAL = uuid('concept-TRANSVERSAL');

/**
 * Las 43 fichas clínicas estándar, portadas del backend.
 *
 * Antes eran **cuatro escritas a mano**, con códigos que ni siquiera coincidían
 * con los del catálogo sembrado (`CARDIO-BASE` contra `CARDIO_FICHA_BASE`).
 * Para una doctora de medicina general, de neurología o de odontología el
 * selector de «Formulario clínico» no tenía **nada** que ofrecer, que es lo que
 * el cliente reportó como «no deja poner los formularios respectivos».
 *
 * Se generan desde los JSON del backend con `yarn mock:chart-templates`; el
 * fixture es derivado y no se edita a mano.
 */
export const PLANTILLAS_DE_EXPEDIENTE = FICHAS_ESTANDAR.map((ficha) =>
  plantilla(
    ficha.code,
    ficha.name,
    ficha.specialty === 'TRANSVERSAL'
      ? ESPECIALIDAD_TRANSVERSAL
      : (ESPECIALIDAD[ficha.specialty] ?? ESPECIALIDAD_TRANSVERSAL),
    ficha.fields.map(
      (campo) =>
        [
          campo.code,
          campo.name,
          campo.dataType,
          campo.required,
          campo.options,
          campo.multiple,
        ] as const,
    ),
    ficha.provenance,
  ),
);

/**
 * Las plantillas que alguien creó por `POST /charts/templates` durante la
 * sesión.
 *
 * Van aparte de {@link PLANTILLAS_DE_EXPEDIENTE} y no empujadas dentro, porque
 * ese arreglo **es el fixture** —«las 43 fichas estándar»— y hay una prueba que
 * lo afirma contando. Empujar ahí convertía una creación del simulador en
 * estado que sobrevive al archivo de prueba que la hizo: los specs de un mismo
 * worker comparten la instancia del módulo, así que `fichas-estandar.spec.ts`
 * veía 51 fichas estándar donde hay 43 — y sólo cuando el reparto del pool
 * ponía antes al spec que crea. Un rojo que no se reproduce aislado.
 */
const PLANTILLAS_CREADAS: ReturnType<typeof plantilla>[] = [];

/**
 * El catálogo que sirve la API simulada: el estándar más lo creado en la
 * sesión. Es lo que leen todas las rutas; el fixture queda intacto.
 */
export function plantillasVigentes(): readonly ReturnType<typeof plantilla>[] {
  return [...PLANTILLAS_DE_EXPEDIENTE, ...PLANTILLAS_CREADAS];
}

function registroReceta(r: RecetaSimulada) {
  return { id: r.id, patientProfileId: r.patientProfileId, status: r.statusConceptId === ESTADO_RECETA['RX-DRAFT'] ? 'DRAFT' : 'ACTIVE', replacesRequestId: null, replacedByRequestId: null, renewedFromRequestId: null, signedAt: r.signedAt, createdAt: r.createdAt };
}

/**
 * Una plantilla de expediente sembrada.
 *
 * Cada campo es `[code, name, dataType, required]` y, si es de eleccion,
 * `[..., opciones, multiple?]`: `code` es el tipo tecnico de los que se
 * responden eligiendo, y lo que separa «una sola» de «varias» es la
 * cardinalidad, no el tipo.
 */
export function plantilla(
  code: string,
  name: string,
  specialtyConceptId: string,
  campos: readonly (readonly [string, string, string, boolean, (readonly string[])?, boolean?])[],
  provenance?: {
    readonly sourceTitle: string;
    readonly organization: string;
    readonly url: string;
    readonly license: string;
    readonly sourceVersion?: string;
    readonly retrievedAt: string;
    readonly note?: string;
  },
) {
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
    fields: campos.map(([c, n, dataType, required, options, multiple], i) => ({
      assignmentId: uuid(`tpl-assign-${code}-${c}`),
      fieldId: uuid(`tpl-field-${code}-${c}`),
      code: c,
      name: n,
      dataType,
      required,
      ...(options === undefined ? {} : { options, multiple: multiple ?? false }),
      ordinal: i + 1,
      // `false`: son los campos del formulario **estándar**, los que hacen
      // comparable una ficha entre consultorios. Marcarlos como propios ponía
      // los cinco bajo «Campos de tu organización» con el sello «Tuyo», dejaba
      // vacía la sección del estándar, y ofrecía editar lo que no se toca.
      own: false,
    })),
    // La procedencia REAL de la ficha —norma, organismo, URL y licencia—, tal
    // como la declara el JSON del backend. Antes había una inventada fija para
    // las cuatro plantillas escritas a mano; con las 43 portadas, inventarla
    // sería declarar una fuente falsa en pantalla.
    ...(provenance === undefined ? {} : { provenance }),
  };
}
