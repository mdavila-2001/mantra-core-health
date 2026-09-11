import { CODE_SYSTEM_VERSION_ID, conjuntoPorCodigo, ESPECIALIDAD, ESTADO, MEDICAMENTO, miembrosDe, PARENTESCO, UNIDAD, VIA } from '../fixtures/conceptos';
import { MEDICA, PACIENTE, PACIENTES, PROFESIONALES, pacientePorId, profesionalPorId } from '../fixtures/personas';
import { conflict, noContent, notFound, preconditionFailed, type MockRouter } from '../mock-router';
import { TENANT_CLINICA } from '../mock-session';
import { ahora, Coleccion, cuerpo, iso, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Lo que queda: enumeraciones dinámicas, paquetes de contenido, recetas
    favoritas, direcciones y las bases de acceso de `authz` (relaciones
    asistenciales, solicitudes de vínculo y representación legal).
    ========================================================================== */

/** De `esquema.tabla.columna` al conjunto de valores que la gobierna. */
const ENUMS: readonly (readonly [patron: RegExp, valueSet: string, name: string])[] = [
  /*
   * El diagnóstico va PRIMERO y con la tabla en el patrón: `code_concept_id` es
   * una columna que existe en media docena de tablas clínicas y cada una lee de
   * un conjunto distinto.
   *
   * Faltaba, y no fallaba: sin patrón que casara, el fallback dejaba
   * `VS_RECORD_STATUS`, así que el desplegable «Elegí un diagnóstico» ofrecía
   * «Activo, Inactivo, Pendiente, Verificado…». Un catálogo equivocado se ve
   * como un catálogo, no como un error: la pantalla no avisaba nada y los cinco
   * casos de demostración salían «aplicados parcialmente». Con esto, el paso
   * 2.6.1.1 —el médico registra su diagnóstico— se puede recorrer en la maqueta.
   *
   * `VS_CONDITION_CODE` ya existía en los fixtures, con sus quince códigos
   * CIE-10; lo único que faltaba era esta línea.
   */
  [/conditions\.code_concept_id/, 'VS_CONDITION_CODE', 'Diagnóstico'],
  // Los otros cuatro catálogos del diagnóstico. Sin ellos caían en el default
  // —`VS_RECORD_STATUS`— y el selector de «Curso clínico» ofrecía
  // Activo/Archivado: **«Crónico» no existía en la maqueta**. Van antes que
  // `/severity/`, que casaría con `conditions.severity_concept_id` por su
  // cuenta pero con otro conjunto.
  // Los catálogos de la alergia. Van antes que `/severity/` porque la severidad
  // de una reacción sí usa `VS_SEVERITY`, y ese patrón casaría igual.
  [/allergy_reactions\.manifestation_concept_id/, 'VS_ALLERGY_MANIFESTATION', 'Manifestación'],
  [/allergy_intolerances\.substance_concept_id/, 'VS_ALLERGY_SUBSTANCE', 'Sustancia'],
  [/allergy_intolerances\.type_concept_id/, 'VS_ALLERGY_TYPE', 'Tipo'],
  [/allergy_intolerances\.category_concept_id/, 'VS_ALLERGY_CATEGORY', 'Categoría'],
  [/allergy_intolerances\.criticality_concept_id/, 'VS_ALLERGY_CRITICALITY', 'Criticidad'],
  [/conditions\.clinical_course_concept_id/, 'VS_CONDITION_CLINICAL_COURSE', 'Curso clínico'],
  [/conditions\.category_concept_id/, 'VS_CONDITION_CATEGORY', 'Categoría'],
  [/conditions\.laterality_concept_id/, 'VS_CONDITION_LATERALITY', 'Lateralidad'],
  [/conditions\.clinical_status_concept_id/, 'VS_CONDITION_CLINICAL_STATUS', 'Estado clínico'],

  /*
   * Los catálogos de la observación, el plan de cuidados y el documento. Van
   * ANTES que los patrones genéricos de abajo porque casarían con ellos por
   * casualidad y con el conjunto equivocado: `quantity_unit_concept_id` habría
   * caído en `/unit/` —las unidades de dosis, donde no existe «mmHg»— y
   * `document_records.category_concept_id` en `/conditions\.category/` no, pero
   * sí en cualquier `category` que se agregue después. Un catálogo equivocado
   * se ve como un catálogo, no como un error.
   */
  [/observation_performers\.performer_type_concept_id/, 'VS_OBSERVATION_PERFORMER_TYPE', 'Tipo de ejecutante'],
  [/observations\.code_concept_id/, 'VS_OBSERVATION_CODE', 'Medición'],
  [/observations\.quantity_unit_concept_id/, 'VS_OBSERVATION_UNIT', 'Unidad'],
  [/observations\.category_concept_id/, 'VS_OBSERVATION_CATEGORY', 'Categoría'],
  [/observations\.interpretation_concept_id/, 'VS_OBSERVATION_INTERPRETATION', 'Interpretación'],
  [/care_plans\.intent_concept_id/, 'VS_CARE_PLAN_INTENT', 'Intención del plan'],
  [/care_plan_activities\.activity_concept_id/, 'VS_CARE_PLAN_ACTIVITY', 'Actividad'],
  [/document_records\.category_concept_id/, 'VS_DOCUMENT_CATEGORY', 'Categoría documental'],

  [/sex_at_birth/, 'VS_BIRTH_SEX', 'Sexo al nacer'],
  [/gender/, 'VS_ADMINISTRATIVE_GENDER', 'Género'],
  [/municipality/, 'VS_BO_MUNICIPALITY', 'Municipio'],
  [/administrative_area|department/, 'VS_BO_DEPARTMENT', 'Departamento'],
  [/occupation/, 'VS_BO_OCCUPATION', 'Ocupación'],
  [/employer/, 'VS_BO_EMPLOYER', 'Empleador'],
  [/specialty/, 'VS_MEDICAL_SPECIALTY', 'Especialidad'],
  [/relationship/, 'VS_RELATED_PERSON_RELATIONSHIP', 'Parentesco'],
  [/language/, 'VS_LANGUAGE', 'Idioma'],
  [/nationality/, 'VS_NATIONALITY', 'Nacionalidad'],
  [/tenant_type|organization_type/, 'VS_ORGANIZATION_TYPE', 'Tipo de organización'],
  // Subtarea 1.1: `directory.tenants.legal_entity_type_concept_id`. Va antes
  // que nada más pudiera casar por casualidad con "type" a secas.
  [/legal_entity_type/, 'VS_LEGAL_ENTITY_TYPE', 'Forma societaria'],
  [/credential_type/, 'VS_CREDENTIAL_TYPE', 'Tipo de credencial'],
  [/practitioner_category/, 'VS_PRACTITIONER_CATEGORY', 'Categoría profesional'],
  [/jurisdiction/, 'VS_JURISDICTION', 'Jurisdicción'],
  [/route/, 'VS_ROUTE', 'Vía de administración'],
  [/unit/, 'VS_DOSE_UNIT', 'Unidad'],
  [/severity/, 'VS_SEVERITY', 'Severidad'],
  [/priority/, 'VS_PRIORITY', 'Prioridad'],
  [/abo/, 'VS_BLOOD_GROUP', 'Grupo sanguíneo'],
  [/rh/, 'VS_RH_FACTOR', 'Factor Rh'],
];

interface FavoritaSimulada {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly medicationConceptId: string;
  readonly substanceAtcConceptId: string | null;
  readonly doseText: string | null;
  readonly routeConceptId: string | null;
  readonly frequencyText: string | null;
  readonly quantityDecimal: string | null;
  readonly unitConceptId: string | null;
  readonly patientInstructionsText: string | null;
}

const favoritas = new Coleccion<FavoritaSimulada>([
  { id: uuid('fav-1'), userId: MEDICA.userId, name: 'Enalapril inicio', medicationConceptId: MEDICAMENTO['MED-ENALAPRIL']!, substanceAtcConceptId: null, doseText: '10 mg', routeConceptId: VIA['ROUTE-ORAL']!, frequencyText: 'Una vez al día por la mañana', quantityDecimal: '30', unitConceptId: UNIDAD['UNIT-TAB']!, patientInstructionsText: 'Controlar la presión en casa dos veces por semana.' },
  { id: uuid('fav-2'), userId: MEDICA.userId, name: 'Atorvastatina nocturna', medicationConceptId: MEDICAMENTO['MED-ATORVASTATINA']!, substanceAtcConceptId: null, doseText: '20 mg', routeConceptId: VIA['ROUTE-ORAL']!, frequencyText: 'Una vez al día por la noche', quantityDecimal: '30', unitConceptId: UNIDAD['UNIT-TAB']!, patientInstructionsText: 'Evitar jugo de pomelo.' },
  { id: uuid('fav-3'), userId: MEDICA.userId, name: 'Paracetamol a demanda', medicationConceptId: MEDICAMENTO['MED-PARACETAMOL']!, substanceAtcConceptId: null, doseText: '500 mg', routeConceptId: VIA['ROUTE-ORAL']!, frequencyText: 'Cada 8 horas si hay dolor', quantityDecimal: '20', unitConceptId: UNIDAD['UNIT-TAB']!, patientInstructionsText: 'No superar 3 g por día.' },
]);

/* ---- authz: relaciones asistenciales y representación legal ---------------- */

const TIPO_RELACION = { TREATING: uuid('concept-care-rel-treating'), CONSULTING: uuid('concept-care-rel-consulting') } as const;

interface RelacionSimulada {
  readonly id: string;
  readonly tenantId: string;
  readonly patientProfileId: string;
  readonly practitionerProfileId: string;
  readonly relationshipTypeConceptId: string;
  readonly statusConceptId: string;
  readonly purposeConceptId: string | null;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly reasonText: string | null;
}

const relaciones = new Coleccion<RelacionSimulada>([
  { id: uuid('care-rel-1'), tenantId: TENANT_CLINICA, patientProfileId: PACIENTE.id, practitionerProfileId: MEDICA.id, relationshipTypeConceptId: TIPO_RELACION.TREATING, statusConceptId: ESTADO['ST-ACTIVE']!, purposeConceptId: null, validFrom: iso(-400), validTo: null, reasonText: null },
  { id: uuid('care-rel-2'), tenantId: TENANT_CLINICA, patientProfileId: PACIENTE.id, practitionerProfileId: PROFESIONALES[3]!.id, relationshipTypeConceptId: TIPO_RELACION.CONSULTING, statusConceptId: ESTADO['ST-ACTIVE']!, purposeConceptId: null, validFrom: iso(-12), validTo: iso(80), reasonText: null },
  { id: uuid('care-request-pendiente'), tenantId: TENANT_CLINICA, patientProfileId: PACIENTE.id, practitionerProfileId: PROFESIONALES[6]!.id, relationshipTypeConceptId: TIPO_RELACION.TREATING, statusConceptId: ESTADO['ST-PENDING']!, purposeConceptId: null, validFrom: iso(0, 8, 30), validTo: null, reasonText: 'Te encontré por la derivación de la Dra. Rojas: quisiera ver tu expediente antes de la consulta de salud mental.' },
  ...PACIENTES.slice(1, 6).map((p, i) => ({ id: uuid(`care-rel-medica-${p.id}`), tenantId: TENANT_CLINICA, patientProfileId: p.id, practitionerProfileId: MEDICA.id, relationshipTypeConceptId: TIPO_RELACION.TREATING, statusConceptId: ESTADO['ST-ACTIVE']!, purposeConceptId: null, validFrom: iso(-300 + i * 20), validTo: null, reasonText: null })),
]);

const representaciones = new Coleccion<{ id: string; tenantId: string; patientProfileId: string; representativeUserId: string; representativeName: string; relationshipConceptId: string; statusConceptId: string; validFrom: string; validTo: string | null }>([
  { id: uuid('legal-rep-1'), tenantId: TENANT_CLINICA, patientProfileId: PACIENTES[3]!.id, representativeUserId: uuid('user-p-guzman'), representativeName: 'Elena María Guzmán Arauz', relationshipConceptId: PARENTESCO['REL-MADRE']!, statusConceptId: ESTADO['ST-ACTIVE']!, validFrom: iso(-800), validTo: null },
  { id: uuid('legal-rep-2'), tenantId: TENANT_CLINICA, patientProfileId: PACIENTES[11]!.id, representativeUserId: uuid('user-p-soliz'), representativeName: 'Andrés Solíz Rojas', relationshipConceptId: PARENTESCO['REL-PADRE']!, statusConceptId: ESTADO['ST-ACTIVE']!, validFrom: iso(-500), validTo: null },
]);

function vistaRelacion(r: RelacionSimulada) {
  return { id: r.id, patientProfileId: r.patientProfileId, practitionerProfileId: r.practitionerProfileId, relationshipTypeConceptId: r.relationshipTypeConceptId, statusConceptId: r.statusConceptId, purposeConceptId: r.purposeConceptId, validFrom: r.validFrom, validTo: r.validTo };
}

export function registrarVarios(router: MockRouter): void {
  router.get('/system-context/dynamic-enums', ({ query }) => {
    const target = query.get('target') ?? '';
    const [, valueSet, name] = ENUMS.find(([patron]) => patron.test(target)) ?? [null, 'VS_RECORD_STATUS', 'Estado'];
    const conjunto = conjuntoPorCodigo(valueSet);
    return {
      code: target,
      name,
      description: `Valores admitidos por ${target}.`,
      definitionId: uuid(`enum-def-${target}`),
      valueSetId: conjunto?.id ?? '',
      versionId: conjunto?.defaultVersionId ?? CODE_SYSTEM_VERSION_ID,
      cacheToken: `v1-${valueSet}`,
      allowCustomValue: valueSet === 'VS_BO_OCCUPATION',
      options: miembrosDe(valueSet).map((c, i) => ({ conceptId: c.id, code: c.code, display: c.display, ordinal: c.ordinal, isDefault: i === 0 })),
    };
  });

  router.get('/admin/content-packs', () => ({
    items: [
      { code: 'nomenclador-procedimientos', name: 'Nomenclador de procedimientos', description: 'Arancel de referencia del Colegio Médico, 1.240 prestaciones con precio.', approxRows: 1240, requiresDemoPassword: false },
      { code: 'aseguradoras-bolivia', name: 'Aseguradoras de Bolivia', description: 'Las aseguradoras de salud registradas en la APS y las cajas de seguro social.', approxRows: 28, requiresDemoPassword: false },
      { code: 'glosario-medico', name: 'Glosario de terminología médica', description: 'Diccionario de términos con definiciones clínicas y en lenguaje simple.', approxRows: 3200, requiresDemoPassword: false },
      { code: 'vademecum-ndc', name: 'Vademécum NDC', description: 'Catálogo de medicamentos importado del NDC, con presentaciones.', approxRows: 135000, requiresDemoPassword: false },
      { code: 'datos-de-demostracion', name: 'Datos de demostración', description: 'Médicos, pacientes, agendas y publicaciones de prueba para mirar la aplicación llena.', approxRows: 5400, requiresDemoPassword: true },
    ],
  }));
  router.post('/admin/content-packs/:code/apply', ({ params }) => ({ code: params['code'], inserted: 1240, tookMs: 4210, counters: { insertados: 1240, omitidos: 12, actualizados: 3 } }));

  /* ---- recetas favoritas ---------------------------------------------------- */

  router.get('/prescription-favorites', (request) => favoritas.filtrar((f) => f.userId === request.user?.id || (request.user?.practitionerProfileId !== undefined && f.userId === MEDICA.userId)).map(({ userId: _u, ...f }) => f));
  router.post('/prescription-favorites', (request) => {
    const datos = cuerpo<Omit<FavoritaSimulada, 'id' | 'userId'> & { quantityDecimal?: number | string }>(request);
    if (favoritas.filtrar((f) => f.userId === request.user?.id && f.name === datos.name).length > 0) return conflict('Ya tenés una favorita con ese nombre');
    const nueva = favoritas.agregar({ id: nuevoId('fav'), userId: request.user?.id ?? MEDICA.userId, name: datos.name ?? 'Favorita', medicationConceptId: datos.medicationConceptId ?? '', substanceAtcConceptId: datos.substanceAtcConceptId ?? null, doseText: datos.doseText ?? null, routeConceptId: datos.routeConceptId ?? null, frequencyText: datos.frequencyText ?? null, quantityDecimal: datos.quantityDecimal === undefined ? null : String(datos.quantityDecimal), unitConceptId: datos.unitConceptId ?? null, patientInstructionsText: datos.patientInstructionsText ?? null });
    const { userId: _u, ...resto } = nueva;
    return { status: 201, body: resto };
  });
  router.delete('/prescription-favorites/:id', ({ params }) => {
    favoritas.borrar(params['id']!);
    return noContent();
  });

  /* ---- direcciones ----------------------------------------------------------- */

  router.post('/common/addresses', (request) => {
    const datos = cuerpo<{ lines?: string[]; city?: string; latitude?: number; longitude?: number }>(request);
    return { status: 201, body: { id: nuevoId('address'), lines: datos.lines ?? [], city: datos.city ?? 'Santa Cruz de la Sierra', latitude: datos.latitude ?? -17.78, longitude: datos.longitude ?? -63.18, createdAt: ahora() } };
  });

  /* ---- authz ------------------------------------------------------------------ */

  router.get('/authz/care-relationships', ({ query }) => {
    const patient = query.get('patientProfileId');
    return relaciones.filtrar((r) => patient === null || r.patientProfileId === patient).map(vistaRelacion);
  });
  router.post('/authz/care-relationships', (request) => {
    const datos = cuerpo<{ tenantId: string; patientProfileId: string; practitionerProfileId: string; relationshipType?: string; validTo?: string }>(request);
    const nueva = relaciones.agregar({ id: nuevoId('care-rel'), tenantId: datos.tenantId ?? TENANT_CLINICA, patientProfileId: datos.patientProfileId ?? '', practitionerProfileId: datos.practitionerProfileId ?? '', relationshipTypeConceptId: datos.relationshipType === 'CONSULTING' ? TIPO_RELACION.CONSULTING : TIPO_RELACION.TREATING, statusConceptId: ESTADO['ST-ACTIVE']!, purposeConceptId: null, validFrom: ahora(), validTo: datos.validTo ?? null, reasonText: null });
    return { status: 201, body: { id: nueva.id, status: 'ACTIVE', createdAt: nueva.validFrom } };
  });
  router.post('/authz/care-relationships/:id/revoke', ({ params }) => {
    const r = relaciones.get(params['id']!);
    if (r === undefined) return notFound('Relación no encontrada');
    relaciones.actualizar(r.id, { statusConceptId: ESTADO['ST-REVOKED']!, validTo: ahora() });
    return { ok: true, affected: 1 };
  });
  router.post('/authz/care-relationships/request', (request) => {
    const datos = cuerpo<{ tenantId: string; patientProfileId: string; reasonText?: string }>(request);
    const hpid = request.user?.practitionerProfileId;
    if (hpid === undefined) return preconditionFailed('Sólo un practicante con perfil propio puede solicitar acceso a un expediente');
    if (pacientePorId(datos.patientProfileId ?? '') === undefined) return notFound('Paciente no encontrado');
    if (relaciones.filtrar((r) => r.patientProfileId === datos.patientProfileId && r.practitionerProfileId === hpid && (r.statusConceptId === ESTADO['ST-ACTIVE'] || r.statusConceptId === ESTADO['ST-PENDING'])).length > 0) {
      return conflict('Ya existe una solicitud pendiente o una relación activa con ese paciente');
    }
    const nueva = relaciones.agregar({ id: nuevoId('care-request'), tenantId: datos.tenantId ?? TENANT_CLINICA, patientProfileId: datos.patientProfileId ?? '', practitionerProfileId: hpid, relationshipTypeConceptId: TIPO_RELACION.TREATING, statusConceptId: ESTADO['ST-PENDING']!, purposeConceptId: null, validFrom: ahora(), validTo: null, reasonText: datos.reasonText ?? null });
    return { status: 201, body: { id: nueva.id, status: 'PENDING', createdAt: nueva.validFrom } };
  });
  router.get('/authz/care-relationships/requests/mine', (request) => {
    const pid = request.user?.patientProfileId ?? (request.user?.key === 'medica' ? PACIENTE.id : '');
    return relaciones.filtrar((r) => r.patientProfileId === pid && r.statusConceptId === ESTADO['ST-PENDING']).map(vistaRelacion);
  });
  router.post('/authz/care-relationships/:id/respond', (request) => {
    const r = relaciones.get(request.params['id']!);
    if (r === undefined) return notFound('Solicitud no encontrada');
    if (r.statusConceptId !== ESTADO['ST-PENDING']) return preconditionFailed('La solicitud ya fue respondida');
    const datos = cuerpo<{ decision: 'ACCEPT' | 'REJECT' }>(request);
    relaciones.actualizar(r.id, datos.decision === 'REJECT' ? { statusConceptId: ESTADO['ST-REVOKED']!, validTo: ahora() } : { statusConceptId: ESTADO['ST-ACTIVE']!, validFrom: ahora() });
    return { ok: true, affected: 1 };
  });

  router.get('/authz/legal-representations', ({ query }) => {
    const patient = query.get('patientProfileId');
    return representaciones.filtrar((r) => patient === null || r.patientProfileId === patient).map(({ tenantId: _t, ...r }) => r);
  });
  router.post('/authz/legal-representations', (request) => {
    const datos = cuerpo<{ tenantId: string; patientProfileId: string; representativeUserId: string; relationshipConceptId?: string }>(request);
    const nueva = representaciones.agregar({ id: nuevoId('legal-rep'), tenantId: datos.tenantId ?? TENANT_CLINICA, patientProfileId: datos.patientProfileId ?? '', representativeUserId: datos.representativeUserId ?? '', representativeName: 'Representante', relationshipConceptId: datos.relationshipConceptId ?? PARENTESCO['REL-TUTOR']!, statusConceptId: ESTADO['ST-ACTIVE']!, validFrom: ahora(), validTo: null });
    return { status: 201, body: { id: nueva.id, status: 'ACTIVE', createdAt: nueva.validFrom } };
  });
  router.post('/authz/legal-representations/:id/revoke', ({ params }) => {
    const r = representaciones.get(params['id']!);
    if (r === undefined) return notFound('Representación no encontrada');
    representaciones.actualizar(r.id, { statusConceptId: ESTADO['ST-REVOKED']!, validTo: ahora() });
    return { ok: true, affected: 1 };
  });

  void ESPECIALIDAD;
  void profesionalPorId;
}
