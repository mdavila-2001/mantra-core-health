import {
  ETIQUETA_DE_PRECISION,
  ETIQUETA_DE_VIGENCIA,
  LABORATORIOS_DEL_CORPUS,
  NOMBRE_DE_CATEGORIA,
  pruebaDelCorpus,
} from '../fixtures/bolivia-eje-central';
import { patientSettlementFixture } from '../fixtures/patient-settlements';
import { PHARMACIES_AND_LABS } from '../fixtures/markdown-institutions.generated';
import { ordenes } from '../fixtures/clinica';
import { vitrinas } from '../fixtures/comunidad';
import { ESTADO, ESTUDIO, PRIORIDAD, displayDe } from '../fixtures/conceptos';
import { MEDICA, PACIENTE, PACIENTES, PROFESIONALES } from '../fixtures/personas';
import { forbidden, notFound, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_CLINICA, TENANT_LABORATORIO, TENANT_NAMES, type MockUser } from '../mock-session';
import { ahora, Coleccion, contiene, cuerpo, iso, isoDia, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Diagnóstico: órdenes e informes del circuito clínico, la cola de trabajo
    del laboratorio, los resultados que ve la persona y los centros de
    diagnóstico (directorio, buscador, ficha y consola de administración).
    ========================================================================== */

function c(code: string, display: string) {
  return { code, display };
}

const ROL_CONTENIDO = uuid('concept-result-content-role-report');
const FORMATO_PDF = uuid('concept-presentation-format-pdf');

export interface InformeSimulado {
  readonly id: string;
  readonly patientProfileId: string;
  readonly serviceRequestId: string;
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly lifecycleStatusConceptId: string;
  readonly currentVersionId: string;
  readonly released: boolean;
  readonly conclusionText: string;
  readonly issuedAt: string;
  readonly releasedAt: string | null;
  readonly createdAt: string;
  readonly custodianTenantId: string;
}

const CONCLUSIONES: Readonly<Record<string, string>> = {
  'Hemograma completo': 'Hemoglobina 13,8 g/dL, leucocitos 6.400/µL, plaquetas 245.000/µL. Sin alteraciones.',
  'Perfil lipídico': 'Colesterol total 212 mg/dL, LDL 138 mg/dL, HDL 48 mg/dL, triglicéridos 160 mg/dL. LDL por encima de la meta.',
  Electrocardiograma: 'Ritmo sinusal a 72 lpm, eje normal, sin alteraciones de la repolarización.',
  'Glucosa en ayunas': 'Glucemia 96 mg/dL. Normal.',
  TSH: 'TSH 3,1 mUI/L. Normal.',
  'Ecografía abdominal': 'Hígado de tamaño y ecogenicidad conservados. Vesícula sin litiasis. Riñones normales.',
};

export const informes = new Coleccion<InformeSimulado>(
  ordenes
    .filtrar((o) => o.statusConceptId === ESTADO['ST-COMPLETED'])
    .map((o, i) => ({
      id: uuid(`report-${o.id}`),
      patientProfileId: o.patientProfileId,
      serviceRequestId: o.id,
      codeConceptId: o.codeConceptId,
      categoryConceptId: o.categoryConceptId,
      lifecycleStatusConceptId: ESTADO['ST-COMPLETED']!,
      currentVersionId: uuid(`report-version-${o.id}`),
      released: i % 4 !== 3,
      conclusionText: CONCLUSIONES[displayDe(o.codeConceptId)] ?? 'Sin hallazgos de significación clínica.',
      issuedAt: iso(-3 - (i % 5), 14),
      releasedAt: i % 4 !== 3 ? iso(-2 - (i % 5), 9) : null,
      createdAt: iso(-3 - (i % 5), 13),
      custodianTenantId: i % 2 === 0 ? TENANT_LABORATORIO : TENANT_CLINICA,
    })),
);

interface CompartidoSimulado {
  readonly id: string;
  readonly reportId: string;
  readonly practitionerUserId: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly active: boolean;
}

const compartidos = new Coleccion<CompartidoSimulado>(
  informes.filtrar((r) => r.patientProfileId === PACIENTE.id && r.released).slice(0, 1).map((r) => ({ id: uuid(`share-${r.id}`), reportId: r.id, practitionerUserId: MEDICA.userId, validFrom: iso(-2), validTo: iso(28), active: true })),
);

const ordenesDeTrabajo = new Coleccion<{ id: string; workOrderNumber: string; laboratoryAccessionId: string; statusConceptId: string; priorityConceptId: string; assignedProfileId: string | null; scheduledAt: string; completedAt: string | null }>(
  ordenes.todos().slice(0, 12).map((o, i) => ({
    id: uuid(`work-order-${o.id}`),
    workOrderNumber: `OT-2026-${String(400 + i).padStart(4, '0')}`,
    laboratoryAccessionId: `ACC-${String(9000 + i)}`,
    statusConceptId: o.statusConceptId,
    priorityConceptId: o.priorityConceptId,
    assignedProfileId: i % 3 === 0 ? null : PROFESIONALES[12]!.id,
    scheduledAt: iso(-2 + (i % 4), 8 + (i % 6)),
    completedAt: o.statusConceptId === ESTADO['ST-COMPLETED'] ? iso(-1 + (i % 3), 15) : null,
  })),
);

/* ---- centros de diagnóstico ------------------------------------------------ */

interface UnidadSimulada {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly kind: 'LABORATORY' | 'IMAGING';
  readonly rating: number;
  readonly ratingCount: number;
  /**
   * `null` = el corpus no lo declara, y «no lo sabemos» no es «no». El sello
   * sólo se dibuja con `true`; los centros reales lo traen en `null` salvo la
   * toma a domicilio, que sí está declarada.
   */
  readonly walkIn: boolean | null;
  readonly home: boolean;
  readonly external: boolean | null;
  readonly publiclyListed: boolean;
  readonly verified: boolean;
  readonly lat: number;
  readonly lng: number;
  /** El id en `data/bolivia-salud-eje-central/`. Sólo los centros reales. */
  readonly corpusId?: string;
  /** La sede que publica la planilla del propietario, con su dirección y teléfono. */
  readonly sedePublicada?: {
    readonly addressText: string | null;
    readonly phone: string | null;
    readonly locationAccuracy: string;
  };
}

/**
 * Los cinco centros de siempre: dos laboratorios y dos centros de imagen de la
 * clínica de la maqueta, más uno en habilitación.
 *
 * Siguen acá por dos razones concretas. La consola de administración
 * (`/diagnostic-units/administration`) muestra los de la clínica con la que se
 * inicia sesión, y los diez del corpus son de otros dueños: sin estos, esa
 * pantalla queda vacía. Y el corpus **no investigó centros de imagen**, así
 * que los de imagenología sólo pueden salir de acá.
 */
const UNIDADES_DE_MAQUETA: readonly UnidadSimulada[] = [
  { id: uuid('unit-lab-central'), tenantId: TENANT_LABORATORIO, code: 'LABCEN', name: 'Laboratorio Central', kind: 'LABORATORY', rating: 4.8, ratingCount: 210, walkIn: true, home: true, external: true, publiclyListed: true, verified: true, lat: -17.784, lng: -63.1815 },
  { id: uuid('unit-lab-olivos'), tenantId: TENANT_CLINICA, code: 'LAB-OLIVOS', name: 'Laboratorio Clínica Los Olivos', kind: 'LABORATORY', rating: 4.5, ratingCount: 88, walkIn: true, home: false, external: false, publiclyListed: true, verified: true, lat: -17.7712, lng: -63.1955 },
  { id: uuid('unit-imagen-sur'), tenantId: uuid('tenant-imagen-sur'), code: 'IMG-SUR', name: 'Centro de Imagen Sur', kind: 'IMAGING', rating: 4.4, ratingCount: 64, walkIn: false, home: false, external: true, publiclyListed: true, verified: true, lat: -17.74, lng: -63.175 },
  { id: uuid('unit-imagen-olivos'), tenantId: TENANT_CLINICA, code: 'IMG-OLIVOS', name: 'Imagenología Clínica Los Olivos', kind: 'IMAGING', rating: 4.6, ratingCount: 120, walkIn: false, home: false, external: true, publiclyListed: true, verified: true, lat: -17.7712, lng: -63.1955 },
  { id: uuid('unit-lab-nuevo'), tenantId: TENANT_CLINICA, code: 'LAB-NORTE', name: 'Laboratorio Norte (en habilitación)', kind: 'LABORATORY', rating: 0, ratingCount: 0, walkIn: true, home: false, external: false, publiclyListed: false, verified: false, lat: -17.75, lng: -63.2 },
];

/**
 * Los diez laboratorios y centros del corpus «Bolivia Salud · Eje Central».
 *
 * Existen: Plexus, Zuna, SELADIS, INLASA, CENETROP, Magnus, Universo, Praxis,
 * LabClinics y el del Hospital San Juan de Dios, con sus 21 sedes en La Paz, El
 * Alto, Cochabamba y Santa Cruz. Cada uno cita la fuente de la que salió.
 *
 * Van **sin puntuación** (`rating: 0`, `ratingCount: 0`, que el directorio
 * publica como `rating: null`): inventarle una nota media a un laboratorio que
 * existe es una afirmación sobre un negocio real, y no se hace.
 */
const UNIDADES_DEL_CORPUS: readonly UnidadSimulada[] = LABORATORIOS_DEL_CORPUS.map(
  (laboratorio) => ({
    id: laboratorio.id,
    tenantId: laboratorio.tenantId,
    code: laboratorio.code,
    name: laboratorio.name,
    kind: laboratorio.kind,
    rating: 0,
    ratingCount: 0,
    walkIn: null,
    home: laboratorio.homeCollection,
    external: null,
    publiclyListed: true,
    verified: laboratorio.verified,
    lat: laboratorio.lat,
    lng: laboratorio.lng,
    corpusId: laboratorio.corpusId,
  }),
);

/**
 * Los laboratorios y centros de análisis de la planilla del propietario
 * (`markdown_convertidos/LISTA_DE_FARMACIAS__LABORATORIOS_Y_ANALISIS_MEDICOS.md`).
 *
 * Plexus y Zuna ya vienen en el corpus, con sus sedes: no se repiten. Van sin
 * puntuación ni sellos, por lo mismo que los del corpus. Los tres «centros de
 * análisis» son de diagnóstico por imagen y cardiológico, así que entran como
 * `IMAGING`, el único tipo de centro no laboratorio que tiene la maqueta.
 */
const YA_EN_EL_CORPUS = /plexus|zuna/i;
const UNIDADES_DE_LA_PLANILLA: readonly UnidadSimulada[] = PHARMACIES_AND_LABS.filter(
  (u) => u.kind !== 'PHARMACY' && !YA_EN_EL_CORPUS.test(u.name),
).map((u) => ({
  id: uuid(`unit-${u.id}`),
  tenantId: uuid(`tenant-${u.id}`),
  code: u.id.replace(/^(laboratory|diagnostic_center)-/, '').toUpperCase().slice(0, 24),
  name: u.name,
  kind: u.kind === 'LABORATORY' ? ('LABORATORY' as const) : ('IMAGING' as const),
  rating: 0,
  ratingCount: 0,
  walkIn: null,
  home: false,
  external: null,
  publiclyListed: true,
  verified: false,
  lat: u.lat,
  lng: u.lng,
  sedePublicada: {
    addressText: u.address,
    phone: u.phone,
    locationAccuracy: u.precision === 'direccion' ? 'Ubicación exacta' : 'Ubicación aproximada · centro de la ciudad',
  },
}));

const UNIDADES: readonly UnidadSimulada[] = [...UNIDADES_DEL_CORPUS, ...UNIDADES_DE_LA_PLANILLA, ...UNIDADES_DE_MAQUETA];

/** El laboratorio del corpus detrás de una unidad, si lo hay. */
function corpusDe(u: UnidadSimulada) {
  return u.corpusId === undefined
    ? undefined
    : LABORATORIOS_DEL_CORPUS.find((laboratorio) => laboratorio.corpusId === u.corpusId);
}

const ESTUDIOS_POR_TIPO: Readonly<Record<'LABORATORY' | 'IMAGING', readonly (keyof typeof ESTUDIO)[]>> = {
  LABORATORY: ['STUDY-HEMOGRAMA', 'STUDY-GLUCOSA', 'STUDY-PERFIL-LIPIDICO', 'STUDY-TSH', 'STUDY-ORINA', 'STUDY-CREATININA', 'STUDY-UREA', 'STUDY-HBA1C', 'STUDY-COAGULACION', 'STUDY-HEPATICO', 'STUDY-COPROLOGICO', 'STUDY-CULTIVO', 'STUDY-VITAMINA-D'],
  IMAGING: ['STUDY-RX-TORAX', 'STUDY-ECO-ABD', 'STUDY-ECG', 'STUDY-RMN-RODILLA', 'STUDY-TAC-CRANEO', 'STUDY-MAMOGRAFIA', 'STUDY-ECO-OBSTETRICA', 'STUDY-RX-COLUMNA', 'STUDY-TAC-ABDOMEN', 'STUDY-RMN-CEREBRO', 'STUDY-DENSITOMETRIA'],
};

/**
 * Las sedes de un centro.
 *
 * Los del corpus tienen las suyas —hasta ocho, con dirección, teléfono y
 * horario publicados—, y cada una dice en el nombre de su rol con qué
 * precisión se resolvió su punto en el mapa y si el registro está verificado en
 * 2026 o es línea base histórica. Un centro de la maqueta tiene una sola,
 * sintética, como siempre.
 */
const SEDES_EN_MEMORIA = new Map<string, ReturnType<typeof construirSedes>>();

function sedesDe(u: UnidadSimulada) {
  const memorizado = SEDES_EN_MEMORIA.get(u.id);
  if (memorizado !== undefined) return memorizado;
  const calculado = construirSedes(u);
  SEDES_EN_MEMORIA.set(u.id, calculado);
  return calculado;
}

function construirSedes(u: UnidadSimulada) {
  const laboratorio = corpusDe(u);
  if (laboratorio !== undefined) {
    return laboratorio.sites.map((sede, i) => ({
      id: sede.id,
      code: sede.code,
      name: sede.name,
      role: c(i === 0 ? 'MAIN' : 'BRANCH', ETIQUETA_DE_VIGENCIA[sede.vigencia]),
      sampleCollectionAvailable: true,
      imagingAvailable: false,
      addressText: sede.addressText,
      city: sede.city,
      phone: sede.phone,
      openingHours: sede.openingHours,
      latitude: sede.lat,
      longitude: sede.lng,
      locationAccuracy: ETIQUETA_DE_PRECISION[sede.locationPrecision],
    }));
  }
  return [
    {
      id: uuid(`unit-site-${u.id}`),
      code: `${u.code}-1`,
      name: `${u.name} · Sede principal`,
      role: c('MAIN', 'Sede principal'),
      sampleCollectionAvailable: u.kind === 'LABORATORY',
      imagingAvailable: u.kind === 'IMAGING',
      ...(u.sedePublicada === undefined
        ? {}
        : {
            addressText: u.sedePublicada.addressText,
            city: 'Santa Cruz de la Sierra',
            phone: u.sedePublicada.phone,
            latitude: u.lat,
            longitude: u.lng,
            locationAccuracy: u.sedePublicada.locationAccuracy,
          }),
    },
  ];
}

/**
 * Las ciudades donde el centro tiene sede, sin repetir. Un centro de la maqueta
 * sin sede publicada no tiene ninguna: no se le inventa una.
 */
function ciudadesDe(u: UnidadSimulada): readonly string[] {
  const ciudades = sedesDe(u)
    .map((sede) => ('city' in sede ? sede.city : undefined))
    .filter((ciudad): ciudad is string => typeof ciudad === 'string' && ciudad !== '');
  return [...new Set(ciudades)];
}

/** La sede principal: la que ancla precios, equipos y acreditaciones. */
function sitioDe(u: UnidadSimulada) {
  return sedesDe(u)[0]!;
}

/**
 * Lo que un centro ofrece.
 *
 * Para los diez del corpus son las pruebas de `data/bolivia-salud-eje-central/`
 * —el catálogo que Plexus publicó, o la derivación de los servicios que el
 * propio centro declara— con su categoría, sus muestras y sus metodologías.
 *
 * **Los precios no salen del corpus, que no publica ninguno.** Los calcula
 * esta función a partir de la categoría, son maqueta declarada, y por eso la
 * tarifa se llama `MAQUETA` en vez de `PUBLICO`: quien lea la respuesta tiene
 * que poder distinguir un precio real de uno de demostración.
 */
function estudiosDelCorpus(u: UnidadSimulada) {
  const laboratorio = corpusDe(u)!;
  const sitio = sitioDe(u);
  return laboratorio.testIds.flatMap((testId, i) => {
    const prueba = pruebaDelCorpus(testId);
    if (prueba === undefined) return [];
    const precio = 45 + (i % 12) * 30;
    return [
      {
        id: uuid(`offering-${u.id}-${testId}`),
        code: testId.replace('test_', 'T'),
        name: prueba.name,
        description:
          prueba.synonyms.length === 0
            ? NOMBRE_DE_CATEGORIA.get(prueba.categoryId) ?? null
            : `${NOMBRE_DE_CATEGORIA.get(prueba.categoryId) ?? ''} · también ${prueba.synonyms.join(', ')}`,
        siteId: sitio.id,
        modality: null,
        preparationInstructions: prueba.patientPreparation,
        expectedDurationMinutes: 10,
        expectedTurnaroundMinutes: 240,
        // El corpus no declara qué exige orden médica. `null` lo dice; `false`
        // sería afirmar que cualquiera se la puede hacer sin receta.
        requiresMedicalOrder: null,
        prices: [{ amount: precio.toFixed(2), currency: c('BOB', 'Boliviano'), scheduleCode: 'MAQUETA', siteId: sitio.id }],
        conceptId: uuid(`corpus-test-${testId}`),
        specimens: prueba.specimens,
        methods: prueba.methods,
        categoryName: NOMBRE_DE_CATEGORIA.get(prueba.categoryId) ?? prueba.categoryId,
        isPanel: prueba.kind === 'PANEL',
      },
    ];
  });
}

/**
 * La oferta de un centro, calculada una sola vez.
 *
 * No es optimización prematura: el buscador llama a esto **por unidad y por
 * filtro** —para contar estudios, para resolver `studyCode`, para el precio
 * mínimo—, y un laboratorio del corpus tiene hasta 252 pruebas. Sin la memoria
 * intermedia, una búsqueda reconstruye miles de objetos que ya existían.
 */
const ESTUDIOS_EN_MEMORIA = new Map<string, ReturnType<typeof construirEstudios>>();

function estudiosDe(u: UnidadSimulada) {
  const memorizado = ESTUDIOS_EN_MEMORIA.get(u.id);
  if (memorizado !== undefined) return memorizado;
  const calculado = construirEstudios(u);
  ESTUDIOS_EN_MEMORIA.set(u.id, calculado);
  return calculado;
}

function construirEstudios(u: UnidadSimulada) {
  if (u.corpusId !== undefined) return estudiosDelCorpus(u);
  return ESTUDIOS_POR_TIPO[u.kind].map((code, i) => {
    const conceptId = ESTUDIO[code]!;
    const precio = u.kind === 'LABORATORY' ? 40 + i * 25 : 120 + i * 180;
    return {
      id: uuid(`offering-${u.id}-${code}`),
      code: code.replace('STUDY-', ''),
      name: displayDe(conceptId),
      description: `${displayDe(conceptId)} realizado en ${u.name}.`,
      siteId: sitioDe(u).id,
      modality: u.kind === 'IMAGING' ? c(['XR', 'US', 'ECG', 'MR', 'CT'][i]!, ['Radiografía', 'Ecografía', 'Electrocardiografía', 'Resonancia', 'Tomografía'][i]!) : null,
      preparationInstructions: i === 1 ? 'Ayuno de 8 horas.' : i === 4 && u.kind === 'IMAGING' ? 'Retirar objetos metálicos.' : null,
      expectedDurationMinutes: u.kind === 'LABORATORY' ? 10 : 20 + i * 10,
      expectedTurnaroundMinutes: u.kind === 'LABORATORY' ? 240 : 60 * 24,
      requiresMedicalOrder: i > 1,
      prices: [{ amount: precio.toFixed(2), currency: c('BOB', 'Boliviano'), scheduleCode: 'PUBLICO', siteId: sitioDe(u).id }],
      conceptId,
    };
  });
}

function itemDeDirectorio(u: UnidadSimulada) {
  return {
    id: u.id,
    code: u.code,
    name: u.name,
    // El código del **concepto** (`DU_TYPE_*`), que no es el mismo vocabulario
    // que el del filtro `kind` (`LABORATORY`/`IMAGING`). Emitir el del filtro
    // acá dejaba a `categoryName` sin reconocer ninguno de los dos tipos, así
    // que el directorio rotulaba los grupos con el `display` crudo y la portada
    // no encontraba su ícono.
    type: c(
      u.kind === 'LABORATORY' ? 'DU_TYPE_LAB' : 'DU_TYPE_IMAGING',
      u.kind === 'LABORATORY' ? 'Laboratorio clínico' : 'Centro de imagenología',
    ),
    siteCount: sedesDe(u).length,
    equipmentCount: equipoDe(u).length,
    studyCount: estudiosDe(u).length,
    acceptsExternalOrders: u.external,
    walkInAvailable: u.walkIn,
    homeCollectionAvailable: u.home,
  };
}

/**
 * El parque de equipos de un centro.
 *
 * **Vacío para los del corpus**, por lo mismo que las acreditaciones: decir que
 * el laboratorio del Hospital San Juan de Dios tiene un Sysmex XN-550 con
 * número de serie y fecha de calibración es inventar el inventario de una
 * institución real. El corpus no lo declara y la ficha no lo dibuja.
 */
function equipoDe(u: UnidadSimulada) {
  if (u.corpusId !== undefined) return [];
  // Nueve y ocho, no cuatro: con cuatro equipos la sección nunca cruzaba el
  // umbral del buscador ni el de la paginación, así que esos controles no se
  // podían ver funcionando. Un laboratorio de segundo nivel tiene esta cantidad.
  const base = u.kind === 'IMAGING' ? [['XR', 'Radiografía digital', 'Siemens', 'Ysio Max'], ['US', 'Ecógrafo', 'GE', 'Logiq E10'], ['MR', 'Resonador 1.5T', 'Philips', 'Ingenia'], ['CT', 'Tomógrafo 64 cortes', 'Siemens', 'Somatom go.Up'], ['XR', 'Arco en C', 'Ziehm', 'Vision RFD'], ['US', 'Ecógrafo portátil', 'Mindray', 'DP-10'], ['MG', 'Mamógrafo digital', 'Hologic', 'Selenia'], ['DX', 'Densitómetro óseo', 'GE', 'Lunar iDXA']] : [['ANALYZER', 'Analizador hematológico', 'Sysmex', 'XN-550'], ['ANALYZER', 'Analizador bioquímico', 'Roche', 'cobas c311'], ['CENTRIFUGE', 'Centrífuga', 'Hettich', 'Rotina 380'], ['MICROSCOPE', 'Microscopio', 'Olympus', 'CX23'], ['ANALYZER', 'Analizador de coagulación', 'Stago', 'STart 4'], ['ANALYZER', 'Analizador de inmunoensayo', 'Abbott', 'Architect i1000'], ['INCUBATOR', 'Incubadora de cultivos', 'Memmert', 'IN55'], ['CENTRIFUGE', 'Centrífuga refrigerada', 'Eppendorf', '5810 R'], ['MICROSCOPE', 'Microscopio de fluorescencia', 'Leica', 'DM2000']];
  return base.map(([code, display, manufacturer, model], i) => ({
    id: uuid(`equipment-${u.id}-${i}`),
    siteId: sitioDe(u).id,
    type: c(code!, display!),
    manufacturer: manufacturer!,
    model: model!,
    serialNumber: `SN-${1000 + i}`,
    modality: u.kind === 'IMAGING' ? c(code!, display!) : null,
    // Tres estados y no dos: con «en mantenimiento» como única excepción, el
    // filtro por estado de la ficha tenía dos chips y uno de ellos con un solo
    // equipo detrás. Un parque de nueve equipos tiene alguno fuera de servicio.
    operationalStatus:
      i === 2 || i === 7
        ? c('MAINTENANCE', 'En mantenimiento')
        : i === 5
          ? c('OUT_OF_SERVICE', 'Fuera de servicio')
          : c('OPERATIONAL', 'Operativo'),
    lastCalibrationAt: isoDia(-90 - i * 20),
    nextCalibrationDueAt: isoDia(275 - i * 20),
    daysToCalibration: 275 - i * 20,
  }));
}

/**
 * Las acreditaciones de un centro.
 *
 * **Los del corpus no tienen ninguna, y eso es deliberado.** Esta función
 * fabrica un número de habilitación SEDES y una ISO 15189 a partir del código
 * del centro, y para los inventados de la maqueta eso es relleno inofensivo.
 * Para SELADIS o Plexus sería otra cosa: un número de registro sanitario que
 * nadie emitió, atribuido a una institución que existe. El corpus no declara
 * acreditaciones, así que la ficha no muestra ninguna.
 */
function acreditacionesDe(u: UnidadSimulada) {
  if (u.corpusId !== undefined) return [];
  return [
    { id: uuid(`accr-1-${u.id}`), siteId: sitioDe(u).id, type: c('SEDES', 'Habilitación SEDES'), number: `HAB-${u.code}-2024`, evidenceFileId: uuid(`file-accr-${u.id}`), validFrom: isoDia(-400), validTo: isoDia(330), daysToExpiry: 330, verificationStatus: c('VERIFIED', 'Verificada') },
    { id: uuid(`accr-2-${u.id}`), siteId: null, type: c('ISO15189', 'ISO 15189'), number: `ISO-${u.code}`, evidenceFileId: null, validFrom: isoDia(-700), validTo: isoDia(u.verified ? 20 : -10), daysToExpiry: u.verified ? 20 : -10, verificationStatus: c(u.verified ? 'VERIFIED' : 'PENDING', u.verified ? 'Verificada' : 'Pendiente') },
  ];
}

function resultadoPropio(r: InformeSimulado) {
  return {
    reportId: r.id,
    versionId: r.currentVersionId,
    versionNumber: 1,
    serviceRequestId: r.serviceRequestId,
    codeConceptId: r.codeConceptId,
    categoryConceptId: r.categoryConceptId,
    custodianTenantId: r.custodianTenantId,
    conclusionText: r.conclusionText,
    issuedAt: r.issuedAt,
    releasedAt: r.releasedAt ?? r.issuedAt,
    clinicalStatusConceptId: ESTADO['ST-COMPLETED']!,
    observationIds: [uuid(`obs-result-${r.id}-1`), uuid(`obs-result-${r.id}-2`)],
    files: [{ id: uuid(`result-file-${r.id}`), fileId: uuid(`file-lab-${r.patientProfileId}`), contentRoleConceptId: ROL_CONTENIDO, presentationFormatConceptId: FORMATO_PDF, ordinal: 1 }],
  };
}

function pacienteDeSesion(request: MockRequest): string {
  return request.user?.patientProfileId ?? (request.user?.key === 'medica' ? PACIENTE.id : '');
}

/* ---- antiduplicación de estudios (v4.2.17, T-26, subtarea 3.2) ------------ */

/** Mismo default que `DEFAULT_DUPLICATE_STUDY_WINDOW_DAYS` del servidor. */
export const DUPLICATE_STUDY_WINDOW_DAYS = 30;

const MILISEGUNDOS_POR_DIA = 86_400_000;

function diasDesde(fechaIso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(fechaIso)) / MILISEGUNDOS_POR_DIA));
}

/**
 * El informe liberado más reciente del mismo paciente y estudio dentro de la
 * ventana, más si hay uno sin liberar todavía (informativo, `pendingReport`).
 * Espejo simplificado de `DuplicateStudyDetector` del servidor: acá no hay
 * dos caminos de liberación que reconciliar, `released` ya es la señal única.
 */
export function estudioDuplicado(
  patientProfileId: string,
  codeConceptId: string,
  windowDays: number,
): { readonly informe: InformeSimulado; readonly performedAt: string } | null {
  const candidatos = informes
    .filtrar((r) => r.patientProfileId === patientProfileId && r.codeConceptId === codeConceptId && r.released)
    .map((r) => ({ informe: r, performedAt: r.releasedAt ?? r.issuedAt }))
    .filter(({ performedAt }) => diasDesde(performedAt) <= windowDays)
    .sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt));
  return candidatos[0] ?? null;
}

function hayInformePendiente(patientProfileId: string, codeConceptId: string): boolean {
  return informes.filtrar(
    (r) => r.patientProfileId === patientProfileId && r.codeConceptId === codeConceptId && !r.released,
  ).length > 0;
}

/**
 * El `PreviousStudyDto` del estudio detectado. La conclusión sólo viaja si
 * quien pide comparte organización con el informe —mismo recorte de FT-32-R02
 * que hace el servidor—.
 */
export function estudioPrevio(
  informe: InformeSimulado,
  performedAt: string,
  user: MockUser | null,
) {
  const sameOrganization = user?.tenants.includes(informe.custodianTenantId) ?? false;
  return {
    reportId: informe.id,
    serviceRequestId: informe.serviceRequestId,
    studyName: displayDe(informe.codeConceptId),
    providerName: TENANT_NAMES[informe.custodianTenantId] ?? 'Prestador',
    performedAt,
    daysAgo: diasDesde(performedAt),
    resultsAvailable: true,
    conclusionText: sameOrganization ? informe.conclusionText : null,
    reportDownloadUrl: null,
    sameOrganization,
  };
}

export function registrarDiagnostico(router: MockRouter): void {
  /*
   * `POST /clinical/service-requests/duplicate-check` — vive acá y no en
   * `clinical.handlers.ts` porque necesita cruzar `informes`, que es de este
   * módulo. La ruta empieza con `/clinical` en el contrato real (el chequeo
   * hereda el `@Roles` del controller de órdenes); el router del mock no
   * agrupa por archivo, así que esto no cambia nada para quien lo consume.
   */
  router.post('/clinical/service-requests/duplicate-check', (request) => {
    const datos = cuerpo<{
      patientProfileId?: string;
      codeConceptId?: string;
      windowDays?: number;
    }>(request);
    const patientProfileId = datos.patientProfileId ?? '';
    const codeConceptId = datos.codeConceptId ?? '';
    const windowDays = datos.windowDays ?? DUPLICATE_STUDY_WINDOW_DAYS;
    const pendingReport = hayInformePendiente(patientProfileId, codeConceptId);
    const encontrado = estudioDuplicado(patientProfileId, codeConceptId, windowDays);

    if (encontrado === null) {
      return {
        isDuplicate: false,
        previousStudy: null,
        warningMessage: null,
        requiresJustification: false,
        pendingReport,
        windowDays,
      };
    }

    const previousStudy = estudioPrevio(encontrado.informe, encontrado.performedAt, request.user);
    return {
      isDuplicate: true,
      previousStudy,
      warningMessage: `Ya se hizo ${previousStudy.studyName} hace ${previousStudy.daysAgo} días.`,
      requiresJustification: true,
      pendingReport,
      windowDays,
    };
  });

  router.get('/diagnostics/patients/:id/orders', ({ params, query }) => {
    const id = params['id']!;
    const limit = Number(query.get('limit') ?? 50) || 50;
    return {
      patientProfileId: id,
      orders: ordenes.filtrar((o) => o.patientProfileId === id).map(({ patientProfileId: _p, reasonText: _r, ...o }) => ({ ...o, patientProfileId: id })),
      reports: informes.filtrar((r) => r.patientProfileId === id).map((r) => ({ id: r.id, patientProfileId: r.patientProfileId, serviceRequestId: r.serviceRequestId, codeConceptId: r.codeConceptId, categoryConceptId: r.categoryConceptId, lifecycleStatusConceptId: r.lifecycleStatusConceptId, currentVersionId: r.currentVersionId, currentReleasedVersionId: r.released ? r.currentVersionId : null, resultReleaseStatusConceptId: r.released ? ESTADO['ST-PUBLISHED']! : ESTADO['ST-PENDING']!, createdAt: r.createdAt })),
      limit,
      truncated: [],
    };
  });

  router.get('/diagnostics/patients/:id/imaging-studies', ({ params }) =>
    ordenes
      .filtrar((o) => o.patientProfileId === params['id'] && [ESTUDIO['STUDY-ECO-ABD'], ESTUDIO['STUDY-RX-TORAX'], ESTUDIO['STUDY-TAC-CRANEO'], ESTUDIO['STUDY-RMN-RODILLA']].includes(o.codeConceptId))
      .map((o) => ({ id: uuid(`imaging-${o.id}`), patientProfileId: o.patientProfileId, serviceRequestId: o.id, statusConceptId: o.statusConceptId, studyInstanceUid: `1.2.826.0.1.${Math.abs(o.id.charCodeAt(0) * 7919)}` })),
  );

  router.get('/diagnostics/work-orders', ({ query }) => {
    const status = texto(query, 'statusConceptId');
    const assigned = texto(query, 'assignedProfileId');
    return ordenesDeTrabajo
      .todos()
      .filter((w) => status === null || w.statusConceptId === status)
      .filter((w) => assigned === null || w.assignedProfileId === assigned)
      .slice(Number(query.get('offset') ?? 0), Number(query.get('offset') ?? 0) + (Number(query.get('limit') ?? 50) || 50));
  });

  /* ---- resultados de la persona ------------------------------------------- */

  router.get('/diagnostic-results/me', (request) => {
    const id = pacienteDeSesion(request);
    const items = informes.filtrar((r) => r.patientProfileId === id && r.released).map(resultadoPropio);
    return { patientProfileId: id, items, limit: Number(request.query.get('limit') ?? 50) || 50, truncated: false };
  });

  router.get('/diagnostic-results/me/orders', (request) => {
    const id = pacienteDeSesion(request);
    const items = ordenes.filtrar((o) => o.patientProfileId === id).map((o, index) => {
      const informe = informes.filtrar((r) => r.serviceRequestId === o.id)[0];
      return {
        ...(index === 3
          ? { insuranceSettlement: null, insuranceSettlementAvailability: 'PENDING_PUBLICATION' }
          : patientSettlementFixture(o.id, (['APPROVED', 'PARTIALLY_APPROVED', 'DENIED'] as const)[index % 3]!, '100.00', displayDe(o.codeConceptId))),
        id: o.id,
        encounterId: o.encounterId,
        codeConceptId: o.codeConceptId,
        categoryConceptId: o.categoryConceptId,
        statusConceptId: o.statusConceptId,
        priorityConceptId: o.priorityConceptId,
        createdAt: o.createdAt,
        preparationInstructions: o.codeConceptId === ESTUDIO['STUDY-GLUCOSA'] || o.codeConceptId === ESTUDIO['STUDY-PERFIL-LIPIDICO'] ? 'Ayuno de 8 a 12 horas. Podés tomar agua.' : undefined,
        hasReleasedResult: informe?.released ?? false,
        reportId: informe?.released ? informe.id : undefined,
      };
    });
    return { patientProfileId: id, items, limit: 50, truncated: false };
  });

  router.get('/diagnostic-results/me/:id', (request) => {
    const r = informes.get(request.params['id']!);
    if (r === undefined || !r.released) return notFound('Resultado no encontrado');
    if (r.patientProfileId !== pacienteDeSesion(request) && request.user?.practitionerProfileId === undefined) return forbidden();
    return resultadoPropio(r);
  });

  router.get('/diagnostic-results/me/:id/shares', ({ params }) => compartidos.filtrar((s) => s.reportId === params['id']));

  router.post('/diagnostic-results/me/:id/shares', (request) => {
    const datos = cuerpo<{ practitionerUserId: string; validUntil: string }>(request);
    const nuevo = compartidos.agregar({ id: nuevoId('share'), reportId: request.params['id']!, practitionerUserId: datos.practitionerUserId ?? MEDICA.userId, validFrom: ahora(), validTo: datos.validUntil ?? iso(30), active: true });
    return { status: 201, body: nuevo };
  });

  router.delete('/diagnostic-results/me/:id/shares/:shareId', ({ params }) => {
    const s = compartidos.get(params['shareId']!);
    if (s === undefined) return notFound('Acceso no encontrado');
    return compartidos.actualizar(s.id, { active: false, validTo: ahora() });
  });
  router.post('/diagnostic-results/me/:id/shares/:shareId/revoke', ({ params }) => {
    const s = compartidos.get(params['shareId']!);
    if (s === undefined) return notFound('Acceso no encontrado');
    return compartidos.actualizar(s.id, { active: false, validTo: ahora() });
  });

  /* ---- centros de diagnóstico ------------------------------------------- */

  router.get('/diagnostic-units', () => {
    const items = UNIDADES.filter((u) => u.tenantId === TENANT_CLINICA).map(itemDeDirectorio);
    return { items, count: items.length };
  });

  router.get('/diagnostic-units/search', ({ query }) => {
    const q = texto(query, 'q');
    const kind = texto(query, 'kind');
    const studyCode = texto(query, 'studyCode');
    const home = query.get('homeCollection') === 'true';
    const walkIn = query.get('walkIn') === 'true';
    const external = query.get('acceptsExternalOrders') === 'true';
    const maxAmount = Number(query.get('maxAmount') ?? Infinity);
    const minRating = Number(query.get('minRating') ?? 0);
    const offset = Number(query.get('offset') ?? 0);
    const limit = Number(query.get('limit') ?? 20) || 20;
    const todos = UNIDADES.filter((u) => u.publiclyListed)
      .filter((u) => contiene(u.name, q))
      .filter((u) => kind === null || u.kind === kind)
      .filter((u) => studyCode === null || estudiosDe(u).some((e) => e.code === studyCode || contiene(e.name, studyCode)))
      .filter((u) => (!home || u.home) && (!walkIn || u.walkIn) && (!external || u.external))
      .filter((u) => u.rating >= minRating)
      .map((u) => ({ ...itemDeDirectorio(u), tenantId: u.tenantId, rating: u.ratingCount === 0 ? null : u.rating, ratingCount: u.ratingCount, minAmount: Math.min(...estudiosDe(u).map((e) => Number(e.prices[0]!.amount))), cities: ciudadesDe(u) }))
      .filter((u) => u.minAmount === null || u.minAmount <= maxAmount);
    return { items: todos.slice(offset, offset + limit), total: todos.length, limit, offset };
  });

  router.get('/diagnostic-units/administration', () => {
    const items = UNIDADES.filter((u) => u.tenantId === TENANT_CLINICA || u.tenantId === TENANT_LABORATORIO).map((u) => ({
      ...itemDeDirectorio(u),
      status: c(u.verified ? 'ACTIVE' : 'PENDING', u.verified ? 'Activa' : 'En habilitación'),
      verificationStatus: c(u.verified ? 'VERIFIED' : 'PENDING', u.verified ? 'Verificada' : 'Pendiente'),
      publiclyListed: u.publiclyListed,
    }));
    return { items, count: items.length };
  });

  router.get('/diagnostic-units/:id/administration', ({ params }) => {
    const u = UNIDADES.find((x) => x.id === params['id']);
    if (u === undefined) return notFound('Centro no encontrado');
    const sitio = sitioDe(u);
    return {
      ...itemDeDirectorio(u),
      status: c(u.verified ? 'ACTIVE' : 'PENDING', u.verified ? 'Activa' : 'En habilitación'),
      verificationStatus: c(u.verified ? 'VERIFIED' : 'PENDING', u.verified ? 'Verificada' : 'Pendiente'),
      publiclyListed: u.publiclyListed,
      sites: sedesDe(u).map((sede) => ({ ...sede, practiceSiteId: uuid(`practice-site-${sede.id}`), accessionPrefix: u.code.slice(0, 3), status: c('ACTIVE', 'Activa') })),
      equipment: equipoDe(u),
      studies: estudiosDe(u).map(({ conceptId: _c, prices, ...e }, i) => ({
        ...e,
        specimenType: u.kind === 'LABORATORY' ? c(i === 4 ? 'URINE' : 'BLOOD', i === 4 ? 'Orina' : 'Sangre') : null,
        requiresPriorAuthorization: i === 4,
        homeCollectionEligible: u.home && u.kind === 'LABORATORY',
        status: c('ACTIVE', 'Activo'),
        prices: prices.map((p, k) => ({ id: uuid(`price-${e.id}-${k}`), scheduleId: uuid(`schedule-${u.id}`), scheduleCode: p.scheduleCode, schedulePublic: true, versionNumber: 1, baseAmount: p.amount, patientAmount: p.amount, insurerAmount: (Number(p.amount) * 0.8).toFixed(2), currency: p.currency, effectiveFrom: isoDia(-100), effectiveTo: null, status: c('ACTIVE', 'Vigente') })),
      })),
      accreditations: acreditacionesDe(u),
      staff: PROFESIONALES.slice(9, 13).map((p, i) => ({ id: uuid(`unit-staff-${u.id}-${p.id}`), practitionerRoleAssignmentId: uuid(`ra-${p.id}`), practitionerProfileId: p.id, practitionerName: p.displayName, siteId: sitio.id, assignmentRole: c(i === 0 ? 'DIRECTOR' : 'ANALYST', i === 0 ? 'Director técnico' : 'Bioquímico/a'), specialty: null, mayValidateResults: i < 2, maySignReports: i === 0, validFrom: isoDia(-300), validTo: null, status: c('ACTIVE', 'Activo') })),
    };
  });

  router.get('/diagnostic-units/:id', ({ params }) => {
    const u = UNIDADES.find((x) => x.id === params['id']);
    if (u === undefined) return notFound('Centro no encontrado');
    return { ...itemDeDirectorio(u), sites: sedesDe(u), equipment: equipoDe(u).map(({ serialNumber: _s, daysToCalibration: _d, ...e }) => e), studies: estudiosDe(u).map(({ conceptId: _c, ...e }) => e), accreditations: acreditacionesDe(u).map(({ evidenceFileId: _f, daysToExpiry: _d, verificationStatus: _v, ...a }) => a) };
  });

  router.post('/diagnostic-units/:id/verify-and-publish', ({ params }) => {
    const u = UNIDADES.find((x) => x.id === params['id']);
    if (u === undefined) return notFound('Centro no encontrado');
    return { id: u.id, code: u.code, name: u.name, verificationStatus: 'VERIFIED', status: 'ACTIVE', publicProfileId: vitrinas.filtrar((v) => v.tenantId === u.tenantId)[0]?.id, siteCount: 1, accreditationCount: 2 };
  });
  router.post('/diagnostic-units/:id/study-offerings', (request) => {
    const datos = cuerpo<{ studyCode: string }>(request);
    return { status: 201, body: { id: nuevoId('offering'), studyCode: datos.studyCode ?? 'NUEVO', status: 'ACTIVE', componentCount: 0 } };
  });
  router.post('/diagnostic-units/:id/price-schedules', (request) => {
    const datos = cuerpo<{ code: string }>(request);
    return { status: 201, body: { id: nuevoId('schedule'), code: datos.code ?? 'TARIFA', status: 'ACTIVE' } };
  });
  router.post('/price-schedules/:id/study-prices', (request) => {
    const datos = cuerpo<{ effectiveFrom?: string }>(request);
    return { status: 201, body: { id: nuevoId('price'), versionNumber: 1, status: 'ACTIVE', effectiveFrom: datos.effectiveFrom ?? isoDia(0) } };
  });
  router.post('/study-prices/:id/close', () => ({ ok: true }));
  router.delete('/diagnostic-study-offerings/:id', () => ({ ok: true }));

  void PRIORIDAD;
  void PACIENTES;
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
informes.persistirEn('mock.diagnostics.informes');
compartidos.persistirEn('mock.diagnostics.compartidos');
ordenesDeTrabajo.persistirEn('mock.diagnostics.ordenesDeTrabajo');
