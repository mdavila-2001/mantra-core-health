import { CODE_SYSTEM_VERSION_ID, setByCode, MEDICAMENTO, membersOf, UNIDAD, VIA } from '../fixtures/concepts';
import '../fixtures/tenant-types';
import { MEDICAL } from '../fixtures/people';
import { conflict, noContent, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Lo que queda: enumeraciones dinámicas, paquetes de contenido, recetas
    favoritas y direcciones. The `authz` bases of access moved to
    `authz.store.ts`, `authz.handlers.ts` and `access-requests.handlers.ts`.
    ========================================================================== */

/** De `esquema.tabla.columna` al conjunto de valores que la gobierna. */
const ENUMS: readonly (readonly [patron: RegExp, valueSet: string, name: string])[] = [
  /*
   * La recepción de muestras del laboratorio: `specimen-type` y
   * `specimen-container-type` de la API, que gobiernan estos tres campos. Van
   * primero y con esquema y tabla en el patrón: `*_type_concept_id` casaría con
   * cualquier genérico de abajo, y un catálogo equivocado se ve como un
   * catálogo, no como un error.
   */
  [/diagnostics\.specimens\.specimen_type_concept_id/, 'VS_SPECIMEN_TYPE', 'Tipo de espécimen'],
  [
    /diagnostics\.(specimen_containers|specimens)\.container_type_concept_id/,
    'VS_SPECIMEN_CONTAINER_TYPE',
    'Tipo de contenedor de la muestra',
  ],
  /*
   * Los cuatro del alta pública de laboratorio y centro de imagenología
   * (BR-09). Van PRIMERO y con la tabla en el patrón: sin ellos, el tipo de
   * unidad y la modalidad casaban con `/unit/` —las unidades de dosis— y el
   * país con nada, así que el alta no encontraba `DU_TYPE_LAB` ni `BO` y
   * frenaba con «No pudimos cargar los catálogos del alta». La jurisdicción
   * casaba con `/jurisdiction/`, cuyos códigos (`JUR-*`) no son los de la API.
   */
  [/diagnostic_units\.diagnostic_unit_type_concept_id/, 'VS_DIAGNOSTIC_UNIT_TYPE', 'Tipo de unidad diagnóstica'],
  [/diagnostic_study_offerings\.modality_concept_id/, 'VS_DIAGNOSTIC_MODALITY', 'Modalidad diagnóstica'],
  [/directory\.tenants\.country_concept_id/, 'VS_TENANT_COUNTRY', 'País de la organización'],
  [/jurisdiction_authorizations\.jurisdiction_concept_id/, 'VS_LICENSE_JURISDICTION', 'Jurisdicción'],
  [/insurance_plans\.currency_concept_id/, 'VS_INSURANCE_PLAN_CURRENCY', 'Moneda'],
  [
    /insurance_plan_benefits\.benefit_category_concept_id/,
    'VS_INSURANCE_BENEFIT_CATEGORY',
    'Categoría de cobertura',
  ],
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
  [
    /observation_performers\.performer_type_concept_id/,
    'VS_OBSERVATION_PERFORMER_TYPE',
    'Tipo de ejecutante',
  ],
  [/observations\.code_concept_id/, 'VS_OBSERVATION_CODE', 'Medición'],
  [/observations\.quantity_unit_concept_id/, 'VS_OBSERVATION_UNIT', 'Unidad'],
  [/observations\.category_concept_id/, 'VS_OBSERVATION_CATEGORY', 'Categoría'],
  [/observations\.interpretation_concept_id/, 'VS_OBSERVATION_INTERPRETATION', 'Interpretación'],
  [/care_plans\.intent_concept_id/, 'VS_CARE_PLAN_INTENT', 'Intención del plan'],
  [/care_plan_activities\.activity_concept_id/, 'VS_CARE_PLAN_ACTIVITY', 'Actividad'],
  [/document_records\.category_concept_id/, 'VS_DOCUMENT_CATEGORY', 'Categoría documental'],

  /*
   * Laboratorio e imagenología (antiduplicación de estudios, v4.2.17, T-26,
   * subtarea 3.2). Sin estas tres filas el selector «Estudio» de
   * `AnalysisOrderBlock` caía al fallback `VS_RECORD_STATUS` y la maqueta no
   * podía pedir un estudio: mismo defecto que ya se había cerrado para el
   * diagnóstico. Van antes de `/category/` a secas, que casaría con
   * `service_requests.category_concept_id` pero con el conjunto equivocado.
   */
  [/service_requests\.code_concept_id/, 'VS_DIAGNOSTIC_STUDY', 'Estudio'],
  /* El buscador de la receta (`medication-block`) pide este catálogo y no estaba
     mapeado: caía al `VS_RECORD_STATUS` de respaldo y ofrecía «Activo»,
     «Inactivo»… como medicamentos, así que ninguna búsqueda encontraba nada. */
  [/medication_requests\.medication_concept_id/, 'VS_MEDICATION', 'Medicamento'],
  [/service_requests\.category_concept_id/, 'VS_SERVICE_REQUEST_CATEGORY', 'Tipo'],
  [/service_requests\.priority_concept_id/, 'VS_PRIORITY', 'Prioridad'],

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
  [/tenant_type/, 'VS_TENANT_TYPE', 'Tipo de organización'], // códigos reales: ver `tenant-types.ts`
  [/organization_type/, 'VS_ORGANIZATION_TYPE', 'Tipo de organización'],
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
  {
    id: uuid('fav-1'),
    userId: MEDICAL.userId,
    name: 'Enalapril inicio',
    medicationConceptId: MEDICAMENTO['MED-ENALAPRIL']!,
    substanceAtcConceptId: null,
    doseText: '10 mg',
    routeConceptId: VIA['ROUTE-ORAL']!,
    frequencyText: 'Una vez al día por la mañana',
    quantityDecimal: '30',
    unitConceptId: UNIDAD['UNIT-TAB']!,
    patientInstructionsText: 'Controlar la presión en casa dos veces por semana.',
  },
  {
    id: uuid('fav-2'),
    userId: MEDICAL.userId,
    name: 'Atorvastatina nocturna',
    medicationConceptId: MEDICAMENTO['MED-ATORVASTATINA']!,
    substanceAtcConceptId: null,
    doseText: '20 mg',
    routeConceptId: VIA['ROUTE-ORAL']!,
    frequencyText: 'Una vez al día por la noche',
    quantityDecimal: '30',
    unitConceptId: UNIDAD['UNIT-TAB']!,
    patientInstructionsText: 'Evitar jugo de pomelo.',
  },
  {
    id: uuid('fav-3'),
    userId: MEDICAL.userId,
    name: 'Paracetamol a demanda',
    medicationConceptId: MEDICAMENTO['MED-PARACETAMOL']!,
    substanceAtcConceptId: null,
    doseText: '500 mg',
    routeConceptId: VIA['ROUTE-ORAL']!,
    frequencyText: 'Cada 8 horas si hay dolor',
    quantityDecimal: '20',
    unitConceptId: UNIDAD['UNIT-TAB']!,
    patientInstructionsText: 'No superar 3 g por día.',
  },
]);

export function registrarVarios(router: MockRouter): void {
  router.get('/system-context/dynamic-enums', ({ query }) => {
    const target = query.get('target') ?? '';
    const [, valueSet, name] = ENUMS.find(([patron]) => patron.test(target)) ?? [
      null,
      'VS_RECORD_STATUS',
      'Estado',
    ];
    const conjunto = setByCode(valueSet);
    return {
      code: target,
      name,
      description: `Valores admitidos por ${target}.`,
      definitionId: uuid(`enum-def-${target}`),
      valueSetId: conjunto?.id ?? '',
      versionId: conjunto?.defaultVersionId ?? CODE_SYSTEM_VERSION_ID,
      cacheToken: `v1-${valueSet}`,
      allowCustomValue: valueSet === 'VS_BO_OCCUPATION',
      options: membersOf(valueSet).map((c, i) => ({
        conceptId: c.id,
        code: c.code,
        display: c.display,
        ordinal: c.ordinal,
        isDefault: i === 0,
      })),
    };
  });

  router.get('/admin/content-packs', () => ({
    items: [
      {
        code: 'nomenclador-procedimientos',
        name: 'Nomenclador de procedimientos',
        description: 'Arancel de referencia del Colegio Médico, 1.240 prestaciones con precio.',
        approxRows: 1240,
        requiresDemoPassword: false,
      },
      {
        code: 'aseguradoras-bolivia',
        name: 'Aseguradoras de Bolivia',
        description:
          'Las aseguradoras de salud registradas en la APS y las cajas de seguro social.',
        approxRows: 28,
        requiresDemoPassword: false,
      },
      {
        code: 'glosario-medico',
        name: 'Glosario de terminología médica',
        description: 'Diccionario de términos con definiciones clínicas y en lenguaje simple.',
        approxRows: 3200,
        requiresDemoPassword: false,
      },
      {
        code: 'vademecum-ndc',
        name: 'Vademécum NDC',
        description: 'Catálogo de medicamentos importado del NDC, con presentaciones.',
        approxRows: 135000,
        requiresDemoPassword: false,
      },
      {
        code: 'datos-de-demostracion',
        name: 'Datos de demostración',
        description:
          'Médicos, pacientes, agendas y publicaciones de prueba para mirar la aplicación llena.',
        approxRows: 5400,
        requiresDemoPassword: true,
      },
    ],
  }));
  router.post('/admin/content-packs/:code/apply', ({ params }) => ({
    code: params['code'],
    inserted: 1240,
    tookMs: 4210,
    counters: { insertados: 1240, omitidos: 12, actualizados: 3 },
  }));

  /* ---- recetas favoritas ---------------------------------------------------- */

  router.get('/prescription-favorites', (request) =>
    favoritas
      .filtrar(
        (f) =>
          f.userId === request.user?.id ||
          (request.user?.practitionerProfileId !== undefined && f.userId === MEDICAL.userId),
      )
      .map(({ userId: _u, ...f }) => f),
  );
  router.post('/prescription-favorites', (request) => {
    const datos = cuerpo<
      Omit<FavoritaSimulada, 'id' | 'userId'> & { quantityDecimal?: number | string }
    >(request);
    if (favoritas.filtrar((f) => f.userId === request.user?.id && f.name === datos.name).length > 0)
      return conflict('Ya tiene una favorita con ese nombre');
    const nueva = favoritas.agregar({
      id: nuevoId('fav'),
      userId: request.user?.id ?? MEDICAL.userId,
      name: datos.name ?? 'Favorita',
      medicationConceptId: datos.medicationConceptId ?? '',
      substanceAtcConceptId: datos.substanceAtcConceptId ?? null,
      doseText: datos.doseText ?? null,
      routeConceptId: datos.routeConceptId ?? null,
      frequencyText: datos.frequencyText ?? null,
      quantityDecimal: datos.quantityDecimal === undefined ? null : String(datos.quantityDecimal),
      unitConceptId: datos.unitConceptId ?? null,
      patientInstructionsText: datos.patientInstructionsText ?? null,
    });
    const { userId: _u, ...resto } = nueva;
    return { status: 201, body: resto };
  });
  router.delete('/prescription-favorites/:id', ({ params }) => {
    favoritas.borrar(params['id']!);
    return noContent();
  });

  /* ---- direcciones ----------------------------------------------------------- */

  router.post('/common/addresses', (request) => {
    const datos = cuerpo<{
      lines?: string[];
      city?: string;
      latitude?: number;
      longitude?: number;
    }>(request);
    return {
      status: 201,
      body: {
        id: nuevoId('address'),
        lines: datos.lines ?? [],
        city: datos.city ?? 'Santa Cruz de la Sierra',
        latitude: datos.latitude ?? -17.78,
        longitude: datos.longitude ?? -63.18,
        createdAt: ahora(),
      },
    };
  });

  /*
   * Ingesta de interacciones del portal (mapas de calor). La maqueta no guarda
   * nada: responde lo que respondería la API con el consentimiento otorgado,
   * para que la captura se pueda encender en la rama sin un aviso por lote.
   */
  router.post('/telemetry/activity-events', (request) => {
    const eventos = cuerpo<{ events: readonly unknown[] }>(request).events ?? [];
    return {
      status: 201,
      body: { inserted: eventos.length, skipped: 0, eventIds: eventos.map(() => nuevoId('ux')) },
    };
  });
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
favoritas.persistirEn('mock.misc.favoritas');
