import {
  ETIQUETA_DE_PRECISION,
  ETIQUETA_DE_VIGENCIA,
  LABORATORIOS_DEL_CORPUS,
  NOMBRE_DE_CATEGORIA,
  pruebaDelCorpus,
} from '../fixtures/bolivia-eje-central';
import { abrirAgendaDeCentro, ZONA_HORARIA_POR_OMISION } from '../fixtures/agenda';
import { patientSettlementFixture } from '../fixtures/patient-settlements';
import { PHARMACIES_AND_LABS } from '../fixtures/markdown-institutions.generated';
import { ordenes } from '../fixtures/clinica';
import { analisisInlasaDe, TARIFA_INLASA } from '../fixtures/inlasa';
import { ANALISIS_INLASA } from '../fixtures/inlasa-aranceles.generated';
import { precioDeImagen, precioDePrueba, prestacionDeImagen, type PrecioDeReferencia } from '../fixtures/precios-de-referencia';
import { vitrinas } from '../fixtures/comunidad';
import {
  ACCESSION_STATUS,
  CATEGORIA_ORDEN,
  CONTAINER_STATUS,
  CUSTODY_EVENT_TYPE,
  ESTADO,
  ESTUDIO,
  PRIORIDAD,
  SPECIMEN_CONTAINER_TYPE,
  SPECIMEN_STATUS,
  SPECIMEN_TYPE,
  displayDe,
} from '../fixtures/conceptos';
import { MEDICA, PACIENTE, PACIENTES, PROFESIONALES, pacientePorId } from '../fixtures/personas';
import { forbidden, notFound, preconditionFailed, reply, validation, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_CLINICA, TENANT_HOSPITAL, TENANT_LABORATORIO, TENANT_NAMES, TENANT_TYPES, type MockUser } from '../mock-session';
import { ahora, Coleccion, contiene, cuerpo, iso, isoDia, nuevoId, texto, uuid } from '../mock-store';
import { citaDeLaOrden } from '../fixtures/centros';

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

/* ---- el circuito de especímenes del laboratorio (BR-17, CL-47) ------------

   Espécimen → acesión → contenedor → cadena de custodia, con las reglas de
   `DiagnosticsSpecimensService`. Las órdenes de trabajo de la cola cuelgan de
   estas acesiones: `laboratoryAccessionId` es el id de una acesión que existe y
   se puede abrir con `GET /diagnostics/accessions/:id`, no un número suelto.

   Sólo las órdenes de **laboratorio** llegan a la cola: una orden de trabajo
   nace de acesionar especímenes, y un electrocardiograma o una ecografía no
   tienen espécimen que acesionar. */

export interface LabSpecimenRecord {
  readonly id: string;
  readonly patientProfileId: string;
  readonly custodianTenantId: string;
  readonly specimenTypeConceptId: string;
  readonly statusConceptId: string;
  readonly serviceRequestId: string | null;
  readonly collectedAt: string;
  readonly receivedAt: string | null;
}

export interface LabContainerRecord {
  readonly id: string;
  readonly specimenId: string;
  readonly containerIdentifier: string;
  readonly containerTypeConceptId: string;
  readonly statusConceptId: string;
}

export interface LabCustodyEventRecord {
  readonly id: string;
  readonly specimenId: string;
  readonly specimenContainerId: string | null;
  readonly custodyEventTypeConceptId: string;
  readonly occurredAt: string;
  readonly toPartyTypeConceptId: string | null;
  readonly sealIdentifier: string | null;
  readonly signedByUserId: string | null;
}

export interface LabAccessionRecord {
  readonly id: string;
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly accessionNumber: string;
  readonly receivedAt: string;
  readonly priorityConceptId: string;
  readonly statusConceptId: string;
  readonly serviceRequestId: string | null;
  readonly items: readonly { readonly accessionSpecimenId: string; readonly specimenId: string; readonly sequenceNumber: number; readonly statusConceptId: string }[];
}

/** Las órdenes de laboratorio que ya pasaron por la recepción: las de la cola. */
const LAB_ORDERS = ordenes.filtrar((o) => o.categoryConceptId === CATEGORIA_ORDEN['SRQ-LAB']).slice(0, 12);

/** Qué muestra pide cada estudio, y en qué tubo viaja. El resto, suero. */
const SPECIMEN_FOR_STUDY: Readonly<Record<string, readonly [specimenType: string, containerType: string]>> = {
  [ESTUDIO['STUDY-HEMOGRAMA']!]: [SPECIMEN_TYPE['BLDV']!, SPECIMEN_CONTAINER_TYPE['TUBE_LAVENDER_EDTA']!],
  [ESTUDIO['STUDY-ORINA']!]: [SPECIMEN_TYPE['UR']!, SPECIMEN_CONTAINER_TYPE['CUP_URINE_STERILE']!],
};
const SERUM: readonly [string, string] = [SPECIMEN_TYPE['SER']!, SPECIMEN_CONTAINER_TYPE['TUBE_GOLD_SST']!];

/**
 * El laboratorio de la clínica de la maqueta (`LAB-OLIVOS`) es el custodio de
 * lo sembrado: es el tenant con el que inician sesión la médica y el
 * administrador, así que sus acesiones se pueden abrir desde la cola.
 */
const LAB_CUSTODIAN_TENANT = TENANT_CLINICA;

export const labSpecimens = new Coleccion<LabSpecimenRecord>(
  LAB_ORDERS.map((o, i) => ({
    id: uuid(`specimen-${o.id}`),
    patientProfileId: o.patientProfileId,
    custodianTenantId: LAB_CUSTODIAN_TENANT,
    specimenTypeConceptId: (SPECIMEN_FOR_STUDY[o.codeConceptId] ?? SERUM)[0],
    statusConceptId: SPECIMEN_STATUS['SPEC_RECEIVED']!,
    serviceRequestId: o.id,
    collectedAt: iso(-3 + (i % 3), 7, 30),
    receivedAt: iso(-3 + (i % 3), 8, 10),
  })),
);

export const labContainers = new Coleccion<LabContainerRecord>(
  LAB_ORDERS.map((o, i) => ({
    id: uuid(`container-${o.id}`),
    specimenId: uuid(`specimen-${o.id}`),
    containerIdentifier: `TUBO-${String(5000 + i)}`,
    containerTypeConceptId: (SPECIMEN_FOR_STUDY[o.codeConceptId] ?? SERUM)[1],
    statusConceptId: o.statusConceptId === ESTADO['ST-COMPLETED'] ? CONTAINER_STATUS['CONTAINER_STORED']! : CONTAINER_STATUS['CONTAINER_ACTIVE']!,
  })),
);

export const labCustodyEvents = new Coleccion<LabCustodyEventRecord>(
  LAB_ORDERS.map((o, i) => ({
    id: uuid(`custody-reception-${o.id}`),
    specimenId: uuid(`specimen-${o.id}`),
    specimenContainerId: null,
    custodyEventTypeConceptId: CUSTODY_EVENT_TYPE['CUSTODY_RECEPTION']!,
    occurredAt: iso(-3 + (i % 3), 8, 10),
    toPartyTypeConceptId: null,
    sealIdentifier: null,
    signedByUserId: null,
  })),
);

export const labAccessions = new Coleccion<LabAccessionRecord>(
  LAB_ORDERS.map((o, i) => ({
    id: uuid(`accession-${o.id}`),
    custodianTenantId: LAB_CUSTODIAN_TENANT,
    patientProfileId: o.patientProfileId,
    accessionNumber: `ACC-${String(9000 + i)}`,
    receivedAt: iso(-3 + (i % 3), 8, 10),
    priorityConceptId: o.priorityConceptId,
    statusConceptId: o.statusConceptId === ESTADO['ST-PENDING'] ? ACCESSION_STATUS['ACC_RECEIVED']! : ACCESSION_STATUS['ACC_IN_PROCESS']!,
    serviceRequestId: o.id,
    items: [{ accessionSpecimenId: uuid(`accession-item-${o.id}`), specimenId: uuid(`specimen-${o.id}`), sequenceNumber: 1, statusConceptId: ACCESSION_STATUS['ACC_ITEM_RECEIVED']! }],
  })),
);

/* ---- la bandeja de recepción del laboratorio -----------------------------

   `POST /diagnostics/service-requests/inbox`: las órdenes de laboratorio que
   otras organizaciones le dirigieron a `TENANT_LABORATORIO` (su
   `performer_tenant_id`) y que todavía no tienen acesión. Son órdenes propias
   de la bandeja y no filas de `ordenes`: aquéllas ya tienen su circuito
   sembrado arriba (espécimen, acesión, orden de trabajo) y sumarles un
   ejecutante movería lo que ven la ficha del paciente y sus pruebas.

   Dos de ellas vienen avanzadas para que la maqueta muestre los tres estados
   de la columna: una con la muestra ya recibida, otra con la muestra
   rechazada y el resto esperando. */

export interface LabInboxOrderRecord {
  readonly id: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly priorityConceptId: string;
  readonly statusConceptId: string;
  readonly requesterProfileId: string;
  readonly requestingTenantId: string;
  readonly performerTenantId: string;
  readonly requestedAt: string;
}

const INBOX_STUDIES = ['STUDY-HEMOGRAMA', 'STUDY-GLUCOSA', 'STUDY-PERFIL-LIPIDICO', 'STUDY-TSH', 'STUDY-ORINA'] as const;

export const labInboxOrders = new Coleccion<LabInboxOrderRecord>(
  PACIENTES.slice(0, 8).map((p, i) => ({
    id: uuid(`inbox-order-${p.id}`),
    patientProfileId: p.id,
    codeConceptId: ESTUDIO[INBOX_STUDIES[i % INBOX_STUDIES.length]!]!,
    categoryConceptId: CATEGORIA_ORDEN['SRQ-LAB']!,
    priorityConceptId: i === 2 ? PRIORIDAD['PRI-URGENT']! : PRIORIDAD['PRI-ROUTINE']!,
    statusConceptId: ESTADO['ST-ACTIVE']!,
    requesterProfileId: MEDICA.id,
    requestingTenantId: i % 2 === 0 ? TENANT_CLINICA : TENANT_HOSPITAL,
    performerTenantId: TENANT_LABORATORIO,
    requestedAt: iso(-(8 - i), 8 + (i % 4), 15),
  })),
);

/** Las muestras sembradas de la bandeja: una recibida y una rechazada. */
function seedInboxSpecimens(): void {
  const [, received, , rejected] = labInboxOrders.todos();
  const seeds = [
    { order: received, key: 'received', status: SPECIMEN_STATUS['SPEC_COLLECTED']!, container: 'TUBO-7001' },
    { order: rejected, key: 'rejected', status: SPECIMEN_STATUS['SPEC_REJECTED']!, container: 'TUBO-7002' },
  ];
  for (const { order, key, status, container } of seeds) {
    if (order === undefined) continue;
    const specimenId = uuid(`inbox-specimen-${key}-${order.id}`);
    if (labSpecimens.get(specimenId) !== undefined) continue;
    labSpecimens.agregar({
      id: specimenId,
      patientProfileId: order.patientProfileId,
      custodianTenantId: TENANT_LABORATORIO,
      specimenTypeConceptId: SPECIMEN_TYPE['BLDV']!,
      statusConceptId: status,
      serviceRequestId: order.id,
      collectedAt: iso(-1, 8, 40),
      receivedAt: null,
    });
    labContainers.agregar({
      id: uuid(`inbox-container-${key}-${order.id}`),
      specimenId,
      containerIdentifier: container,
      containerTypeConceptId: SPECIMEN_CONTAINER_TYPE['TUBE_LAVENDER_EDTA']!,
      statusConceptId: CONTAINER_STATUS['CONTAINER_ACTIVE']!,
    });
  }
}
seedInboxSpecimens();

const ordenesDeTrabajo = new Coleccion<{ id: string; workOrderNumber: string; laboratoryAccessionId: string; statusConceptId: string; priorityConceptId: string; assignedProfileId: string | null; scheduledAt: string; completedAt: string | null }>(
  LAB_ORDERS.map((o, i) => ({
    id: uuid(`work-order-${o.id}`),
    workOrderNumber: `OT-2026-${String(400 + i).padStart(4, '0')}`,
    laboratoryAccessionId: uuid(`accession-${o.id}`),
    statusConceptId: o.statusConceptId,
    priorityConceptId: o.priorityConceptId,
    assignedProfileId: i % 3 === 0 ? null : PROFESIONALES[12]!.id,
    scheduledAt: iso(-2 + (i % 4), 8 + (i % 6)),
    completedAt: o.statusConceptId === ESTADO['ST-COMPLETED'] ? iso(-1 + (i % 3), 15) : null,
  })),
);

/* ---- centros de diagnóstico ------------------------------------------------ */

export interface UnidadSimulada {
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

export const UNIDADES: readonly UnidadSimulada[] = [...UNIDADES_DEL_CORPUS, ...UNIDADES_DE_LA_PLANILLA, ...UNIDADES_DE_MAQUETA];

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
export function sitioDe(u: UnidadSimulada) {
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
  return laboratorio.testIds.flatMap((testId) => {
    const prueba = pruebaDelCorpus(testId);
    if (prueba === undefined) return [];
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
        // El corpus no publica precios: el estudio lleva el de referencia de
        // INLASA o, si INLASA no la hace, el de FONASA convertido a Bs
        // (`precios-de-referencia.ts`); sin equivalente, viaja sin tarifa.
        prices: preciosDeReferencia(precioDePrueba(testId), sitio.id),
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

export function estudiosDe(u: UnidadSimulada) {
  const memorizado = ESTUDIOS_EN_MEMORIA.get(u.id);
  if (memorizado !== undefined) return memorizado;
  const calculado = construirEstudios(u);
  ESTUDIOS_EN_MEMORIA.set(u.id, calculado);
  return calculado;
}

/**
 * Modalidad de cada estudio de imagen, por código (DICOM: CR radiografía,
 * US ecografía, MR resonancia, CT tomografía, MG mamografía, BMD densitometría,
 * ECG electrocardiografía). Antes salía de la POSICIÓN del estudio en la lista y
 * la mamografía o la densitometría quedaban sin modalidad.
 */
const MODALIDAD_DE_ESTUDIO: Readonly<Record<string, readonly [code: string, display: string]>> = {
  'STUDY-RX-TORAX': ['CR', 'Radiografía'],
  'STUDY-RX-COLUMNA': ['CR', 'Radiografía'],
  'STUDY-ECO-ABD': ['US', 'Ecografía'],
  'STUDY-ECO-OBSTETRICA': ['US', 'Ecografía'],
  'STUDY-ECG': ['ECG', 'Electrocardiografía'],
  'STUDY-RMN-RODILLA': ['MR', 'Resonancia magnética'],
  'STUDY-RMN-CEREBRO': ['MR', 'Resonancia magnética'],
  'STUDY-TAC-CRANEO': ['CT', 'Tomografía computarizada'],
  'STUDY-TAC-ABDOMEN': ['CT', 'Tomografía computarizada'],
  'STUDY-MAMOGRAFIA': ['MG', 'Mamografía'],
  'STUDY-DENSITOMETRIA': ['BMD', 'Densitometría ósea'],
};

/**
 * El menor precio publicado entre los estudios del centro, o `null` si ninguno
 * tiene tarifa (los laboratorios del corpus no publican precios). Con `null` el
 * filtro por importe máximo deja pasar al centro: no hay precio que lo excluya.
 */
function precioMinimoDe(u: UnidadSimulada): number | null {
  const precios = estudiosDe(u).flatMap((e) => (e.prices[0] === undefined ? [] : [Number(e.prices[0].amount)]));
  return precios.length === 0 ? null : Math.min(...precios);
}

/** Id del INLASA en el corpus del eje central (`bolivia-eje-central.generated.ts`). */
const CORPUS_INLASA = 'lab_inlasa';

/**
 * El catálogo del propio INLASA: sus 287 análisis a pacientes con el precio que
 * publica (`PUBLICO`: es su tarifa, no una referencia ajena).
 */
function estudiosDeInlasa(u: UnidadSimulada) {
  const sitio = sitioDe(u);
  return ANALISIS_INLASA.map((a) => ({
    id: uuid(`offering-${u.id}-${a.code}`),
    code: a.code,
    name: a.name,
    description: a.area,
    siteId: sitio.id,
    modality: null,
    preparationInstructions: null,
    expectedDurationMinutes: null,
    expectedTurnaroundMinutes: null,
    requiresMedicalOrder: null,
    prices: a.priceBs === null ? [] : [{ amount: a.priceBs, currency: c('BOB', 'Boliviano'), scheduleCode: 'PUBLICO', siteId: sitio.id }],
    conceptId: uuid(`inlasa-${a.code}`),
  }));
}

/** Un precio de referencia como la lista `prices` de la oferta (vacía si no hay). */
function preciosDeReferencia(precio: PrecioDeReferencia | null, siteId: string) {
  return precio === null ? [] : [{ amount: precio.amount, currency: c('BOB', 'Boliviano'), scheduleCode: precio.scheduleCode, siteId }];
}

function construirEstudios(u: UnidadSimulada) {
  if (u.corpusId === CORPUS_INLASA) return estudiosDeInlasa(u);
  if (u.corpusId !== undefined) return estudiosDelCorpus(u);
  return ESTUDIOS_POR_TIPO[u.kind].map((code) => {
    const conceptId = ESTUDIO[code]!;
    const inlasa = analisisInlasaDe(code);
    const modalidad = MODALIDAD_DE_ESTUDIO[code];
    const referencia: PrecioDeReferencia | null =
      inlasa?.priceBs == null ? precioDeImagen(code) : { amount: inlasa.priceBs, scheduleCode: TARIFA_INLASA };
    return {
      id: uuid(`offering-${u.id}-${code}`),
      code: inlasa?.code ?? prestacionDeImagen(code)?.code ?? code.replace('STUDY-', ''),
      name: displayDe(conceptId),
      description: `${displayDe(conceptId)} realizado en ${u.name}.`,
      siteId: sitioDe(u).id,
      modality: modalidad === undefined ? null : c(modalidad[0], modalidad[1]),
      // Las indicaciones al paciente las publica el centro: la maqueta no las redacta.
      preparationInstructions: null,
      expectedDurationMinutes: u.kind === 'LABORATORY' ? 10 : null,
      expectedTurnaroundMinutes: u.kind === 'LABORATORY' ? 240 : 60 * 24,
      requiresMedicalOrder: null,
      // Laboratorio: el precio de referencia de INLASA 2026. Imagen: FONASA 2026
      // convertido a Bs (Bolivia no publica arancel de imagen); sin equivalente
      // (densitometría, ECG), sin precio.
      prices: preciosDeReferencia(referencia, sitioDe(u).id),
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
export function equipoDe(u: UnidadSimulada) {
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

export function pacienteDeSesion(request: MockRequest): string {
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

/* ---- apoyo del circuito de especímenes ------------------------------------ */

/** Los campos obligatorios que faltan, con el texto de `class-validator`. */
function requiredFields<T extends object>(data: Partial<T>, fields: readonly (keyof T & string)[]) {
  return fields
    .filter((field) => {
      const value = data[field];
      return typeof value !== 'string' || value.trim() === '';
    })
    .map((field) => ({ field, message: 'should not be empty' }));
}

/**
 * Si el recurso es del tenant del contexto. Sin `X-Tenant-Id` no hay contexto
 * que comparar —pasa en las pruebas del simulador, no en la maqueta, donde el
 * interceptor de autenticación siempre la manda con sesión—.
 */
function inTenantContext(request: MockRequest, custodianTenantId: string): boolean {
  const context = request.headers.get('X-Tenant-Id');
  return context === null || context === custodianTenantId;
}

/** El detalle de un espécimen como lo devuelve la API: los opcionales ausentes no viajan. */
function specimenDetail(specimen: LabSpecimenRecord) {
  return {
    id: specimen.id,
    patientProfileId: specimen.patientProfileId,
    specimenTypeConceptId: specimen.specimenTypeConceptId,
    statusConceptId: specimen.statusConceptId,
    collectedAt: specimen.collectedAt,
    ...(specimen.receivedAt === null ? {} : { receivedAt: specimen.receivedAt }),
    containers: labContainers
      .filtrar((c) => c.specimenId === specimen.id)
      .map(({ id, containerIdentifier, containerTypeConceptId, statusConceptId }) => ({ id, containerIdentifier, containerTypeConceptId, statusConceptId })),
    custodyEvents: labCustodyEvents
      .filtrar((e) => e.specimenId === specimen.id)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .map((e) => ({
        id: e.id,
        ...(e.specimenContainerId === null ? {} : { specimenContainerId: e.specimenContainerId }),
        custodyEventTypeConceptId: e.custodyEventTypeConceptId,
        occurredAt: e.occurredAt,
        ...(e.toPartyTypeConceptId === null ? {} : { toPartyTypeConceptId: e.toPartyTypeConceptId }),
        ...(e.sealIdentifier === null ? {} : { sealIdentifier: e.sealIdentifier }),
        ...(e.signedByUserId === null ? {} : { signedByUserId: e.signedByUserId }),
      })),
  };
}

/**
 * Los catálogos contra los que la API valida el alta de espécimen y de
 * contenedor (422 `PRECONDITION_FAILED` con `details.reason`).
 */
const SPECIMEN_TYPE_IDS: ReadonlySet<string> = new Set(Object.values(SPECIMEN_TYPE));
const CONTAINER_TYPE_IDS: ReadonlySet<string> = new Set(Object.values(SPECIMEN_CONTAINER_TYPE));

/**
 * Si quien pide es personal del laboratorio del tenant activo: la regla de
 * `LabStaffGuard` en la API. `SUPERADMIN`; `CLINICIAN`/`PRACTITIONER`; o
 * miembro de un tenant `DIAGNOSTIC_CENTER`. En `mockup` las cuentas no tienen
 * `scopedRoles`, así que el rol clínico vale en cualquier organización.
 */
function isLabStaff(user: MockUser | null, tenantId: string | null): boolean {
  if (user === null || tenantId === null) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  if (['CLINICIAN', 'PRACTITIONER'].some((role) => user.roles.includes(role))) return true;
  return user.tenants.includes(tenantId) && TENANT_TYPES[tenantId] === 'DIAGNOSTIC_CENTER';
}

/** Minúsculas y sin tildes: la búsqueda por paciente no distingue ni una cosa ni la otra. */
function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Cursor opaco de la bandeja: la clave de la última fila devuelta. */
function encodeInboxCursor(order: LabInboxOrderRecord): string {
  return btoa(JSON.stringify({ requestedAt: order.requestedAt, id: order.id }));
}

function decodeInboxCursor(cursor: string): { requestedAt: string; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(atob(cursor));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { requestedAt, id } = parsed as Record<string, unknown>;
    return typeof requestedAt === 'string' && typeof id === 'string' ? { requestedAt, id } : null;
  } catch {
    return null;
  }
}

export function registrarDiagnostico(router: MockRouter): void {
  // Cada centro publicado tiene agenda: desde Cotizaciones un análisis se
  // reserva como una cita, eligiendo un cupo del centro (25/09/2026).
  for (const u of UNIDADES) {
    if (!u.publiclyListed) continue;
    const sede = sitioDe(u);
    abrirAgendaDeCentro({
      id: u.id,
      name: u.name,
      tenantId: u.tenantId,
      kind: u.kind,
      site: {
        id: sede.id,
        name: sede.name,
        code: sede.code,
        addressText: 'addressText' in sede ? (sede.addressText ?? null) : null,
        timeZone: ZONA_HORARIA_POR_OMISION,
      },
    });
  }

  router.post('/clinical/service-requests', (request) => {
    const datos = cuerpo<{
      patientProfileId: string;
      codeConceptId: string;
      categoryConceptId?: string;
      priorityConceptId?: string;
      reasonText?: string;
      encounterId?: string;
      formInstanceId?: string;
      // Antiduplicación de estudios (v4.2.17, T-26, subtarea 3.2).
      previousDiagnosticReportId?: string;
      reusePreviousReport?: boolean;
      duplicateOverrideReason?: string;
    }>(request);

    const patientProfileId = datos.patientProfileId ?? '';
    const codeConceptId = datos.codeConceptId ?? '';
    const conDecision = datos.previousDiagnosticReportId !== undefined;

    // Sin decisión, el alta vuelve a correr el mismo detector que el
    // chequeo: la UI no es la barrera. Con decisión, se confía en lo que el
    // diálogo ya mostró — el mock no reproduce la carrera check→alta del
    // servidor (`DUPLICATE_STUDY_MISMATCH`).
    if (!conDecision) {
      const duplicado = estudioDuplicado(patientProfileId, codeConceptId, DUPLICATE_STUDY_WINDOW_DAYS);
      if (duplicado !== null) {
        const previousStudy = estudioPrevio(duplicado.informe, duplicado.performedAt, request.user);
        return preconditionFailed('Ya existe un estudio igual reciente.', {
          reason: 'DUPLICATE_STUDY_DETECTED',
          previousStudy,
        });
      }
    }

    const reutilizada = conDecision && datos.reusePreviousReport === true;
    const nueva = ordenes.agregar({
      id: nuevoId('order'),
      patientProfileId,
      codeConceptId,
      categoryConceptId: datos.categoryConceptId ?? '',
      priorityConceptId: datos.priorityConceptId ?? '',
      statusConceptId: reutilizada ? ESTADO['ST-SATISFIED-BY-PRIOR']! : ESTADO['ST-PENDING']!,
      requesterProfileId: request.user?.practitionerProfileId ?? MEDICA.id,
      ...(datos.encounterId === undefined ? {} : { encounterId: datos.encounterId }),
      ...(datos.formInstanceId === undefined ? {} : { formInstanceId: datos.formInstanceId }),
      reasonText: datos.reasonText ?? '',
      createdAt: ahora(),
      ...(datos.previousDiagnosticReportId === undefined
        ? {}
        : { previousDiagnosticReportId: datos.previousDiagnosticReportId }),
      ...(datos.duplicateOverrideReason === undefined
        ? {}
        : { duplicateOverrideReason: datos.duplicateOverrideReason }),
    });
    return {
      status: 201,
      body: {
        id: nueva.id,
        patientProfileId: nueva.patientProfileId,
        status: reutilizada ? 'SATISFIED_BY_PRIOR' : 'ACTIVE',
        createdAt: nueva.createdAt,
      },
    };
  });

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

  // La cola de trabajo la autoriza `LabStaffGuard` en la API, igual que la
  // recepción: el personal del laboratorio por su membresía, y
  // CLINICIAN/PRACTITIONER como antes.
  router.get('/diagnostics/work-orders', ({ query, headers, user }) => {
    const tenantId = headers.get('X-Tenant-Id') ?? user?.tenants[0] ?? null;
    if (!isLabStaff(user, tenantId)) {
      return forbidden('Se requiere ser personal del laboratorio de la organización activa');
    }
    const status = texto(query, 'statusConceptId');
    const assigned = texto(query, 'assignedProfileId');
    return ordenesDeTrabajo
      .todos()
      .filter((w) => status === null || w.statusConceptId === status)
      .filter((w) => assigned === null || w.assignedProfileId === assigned)
      .slice(Number(query.get('offset') ?? 0), Number(query.get('offset') ?? 0) + (Number(query.get('limit') ?? 50) || 50));
  });

  /* ---- especímenes, acesiones y custodia (BR-17, CL-47) ------------------
     Las reglas de `DiagnosticsSpecimensService`, en el mismo orden. Las dos
     lecturas se acotan al tenant del contexto (`X-Tenant-Id`): una acesión de
     otro laboratorio responde 404, sin confirmar que existe. Sin la cabecera
     —las pruebas unitarias del simulador— no hay contexto que comparar y se
     lee igual. */

  router.post('/diagnostics/specimens', (request) => {
    const data = cuerpo<{ patientProfileId: string; custodianTenantId: string; specimenTypeConceptId: string; serviceRequestId?: string }>(request);
    const missing = requiredFields(data, ['patientProfileId', 'custodianTenantId', 'specimenTypeConceptId']);
    if (missing.length > 0) return validation('Faltan datos del espécimen', missing);
    if (!SPECIMEN_TYPE_IDS.has(data.specimenTypeConceptId!)) {
      return preconditionFailed('El tipo de espécimen no pertenece al catálogo de tipos de espécimen', {
        reason: 'SPECIMEN_TYPE_NOT_IN_CATALOG',
        field: 'specimenTypeConceptId',
        conceptId: data.specimenTypeConceptId,
        catalog: 'specimen-type',
      });
    }
    const specimen: LabSpecimenRecord = {
      id: nuevoId('specimen'),
      patientProfileId: data.patientProfileId!,
      custodianTenantId: data.custodianTenantId!,
      specimenTypeConceptId: data.specimenTypeConceptId!,
      statusConceptId: SPECIMEN_STATUS['SPEC_COLLECTED']!,
      serviceRequestId: data.serviceRequestId ?? null,
      collectedAt: ahora(),
      receivedAt: null,
    };
    labSpecimens.agregar(specimen);
    return reply(201, { id: specimen.id, status: specimen.statusConceptId });
  });

  /** UC-20-01: la recepción. Marca cada espécimen recibido y firma la recepción en la custodia. */
  router.post('/diagnostics/accessions', (request) => {
    const data = cuerpo<{ patientProfileId: string; custodianTenantId?: string; specimenIds: readonly string[]; accessionNumber?: string; priorityConceptId?: string; serviceRequestId?: string }>(request);
    const missing = [
      ...requiredFields(data, ['patientProfileId']),
      ...(Array.isArray(data.specimenIds) && data.specimenIds.length > 0 ? [] : [{ field: 'specimenIds', message: 'must contain at least 1 elements' }]),
    ];
    if (missing.length > 0) return validation('Faltan datos de la acesión', missing);

    const specimens: LabSpecimenRecord[] = [];
    for (const specimenId of data.specimenIds!) {
      const specimen = labSpecimens.get(specimenId);
      if (specimen === undefined) return notFound('Espécimen no encontrado');
      if (specimen.statusConceptId === SPECIMEN_STATUS['SPEC_REJECTED']) {
        return preconditionFailed('El espécimen está rechazado y no puede acesionarse', { specimenId });
      }
      specimens.push(specimen);
    }

    const receivedAt = ahora();
    const accessionId = nuevoId('accession');
    const items = specimens.map((specimen, index) => {
      labSpecimens.actualizar(specimen.id, { statusConceptId: SPECIMEN_STATUS['SPEC_RECEIVED']!, receivedAt });
      labCustodyEvents.agregar({
        id: nuevoId('custody'),
        specimenId: specimen.id,
        specimenContainerId: null,
        custodyEventTypeConceptId: CUSTODY_EVENT_TYPE['CUSTODY_RECEPTION']!,
        occurredAt: receivedAt,
        toPartyTypeConceptId: null,
        sealIdentifier: null,
        signedByUserId: request.user?.id ?? null,
      });
      return {
        accessionSpecimenId: nuevoId('accession-item'),
        specimenId: specimen.id,
        sequenceNumber: index + 1,
        statusConceptId: ACCESSION_STATUS['ACC_ITEM_RECEIVED']!,
      };
    });
    const accession: LabAccessionRecord = {
      id: accessionId,
      custodianTenantId: data.custodianTenantId ?? specimens[0]!.custodianTenantId,
      patientProfileId: data.patientProfileId!,
      accessionNumber: data.accessionNumber ?? `ACC-${Date.now()}`,
      receivedAt,
      priorityConceptId: data.priorityConceptId ?? PRIORIDAD['PRI-ROUTINE']!,
      statusConceptId: ACCESSION_STATUS['ACC_RECEIVED']!,
      serviceRequestId: data.serviceRequestId ?? null,
      items,
    };
    labAccessions.agregar(accession);
    return reply(201, { id: accession.id, status: accession.statusConceptId, accessionSpecimenIds: items.map((item) => item.accessionSpecimenId) });
  });

  router.get('/diagnostics/accessions/:id', (request) => {
    const accession = labAccessions.get(request.params['id']!);
    if (accession === undefined || !inTenantContext(request, accession.custodianTenantId)) {
      return notFound('Acesión no encontrada');
    }
    return {
      id: accession.id,
      custodianTenantId: accession.custodianTenantId,
      patientProfileId: accession.patientProfileId,
      accessionNumber: accession.accessionNumber,
      receivedAt: accession.receivedAt,
      priorityConceptId: accession.priorityConceptId,
      statusConceptId: accession.statusConceptId,
      specimens: accession.items.flatMap((item) => {
        const specimen = labSpecimens.get(item.specimenId);
        return specimen === undefined
          ? []
          : [{ accessionSpecimenId: item.accessionSpecimenId, sequenceNumber: item.sequenceNumber, statusConceptId: item.statusConceptId, specimen: specimenDetail(specimen) }];
      }),
    };
  });

  router.get('/diagnostics/specimens/:id', (request) => {
    const specimen = labSpecimens.get(request.params['id']!);
    if (specimen === undefined || !inTenantContext(request, specimen.custodianTenantId)) {
      return notFound('Espécimen no encontrado');
    }
    return specimenDetail(specimen);
  });

  /** UC-20-02: rechazar. Un espécimen rechazado ya no se puede acesionar ni volver a rechazar. */
  router.post('/diagnostics/specimens/:id/rejection', (request) => {
    const data = cuerpo<{ rejectionReasonConceptId: string; notes?: string; recollectionRequired?: boolean }>(request);
    const missing = requiredFields(data, ['rejectionReasonConceptId']);
    if (missing.length > 0) return validation('Falta el motivo del rechazo', missing);
    const specimen = labSpecimens.get(request.params['id']!);
    if (specimen === undefined) return notFound('Espécimen no encontrado');
    if (specimen.statusConceptId === SPECIMEN_STATUS['SPEC_REJECTED']) {
      return preconditionFailed('El espécimen ya está rechazado', { specimenId: specimen.id });
    }
    labSpecimens.actualizar(specimen.id, { statusConceptId: SPECIMEN_STATUS['SPEC_REJECTED']! });
    return reply(201, { id: nuevoId('specimen-rejection'), status: SPECIMEN_STATUS['SPEC_REJECTED']! });
  });

  router.post('/diagnostics/specimens/:id/containers', (request) => {
    const data = cuerpo<{ containerIdentifier: string; containerTypeConceptId: string }>(request);
    const missing = requiredFields(data, ['containerIdentifier', 'containerTypeConceptId']);
    if (missing.length > 0) return validation('Faltan datos del contenedor', missing);
    if (!CONTAINER_TYPE_IDS.has(data.containerTypeConceptId!)) {
      return preconditionFailed('El tipo de contenedor no pertenece al catálogo de contenedores de muestra', {
        reason: 'CONTAINER_TYPE_NOT_IN_CATALOG',
        field: 'containerTypeConceptId',
        conceptId: data.containerTypeConceptId,
        catalog: 'specimen-container-type',
      });
    }
    const specimen = labSpecimens.get(request.params['id']!);
    if (specimen === undefined) return notFound('Espécimen no encontrado');
    const container: LabContainerRecord = {
      id: nuevoId('container'),
      specimenId: specimen.id,
      containerIdentifier: data.containerIdentifier!.trim(),
      containerTypeConceptId: data.containerTypeConceptId!,
      statusConceptId: CONTAINER_STATUS['CONTAINER_ACTIVE']!,
    };
    labContainers.agregar(container);
    return reply(201, { id: container.id, status: container.statusConceptId });
  });

  /** UC-20-03: el traslado. Queda en la custodia del espécimen y mueve el estado del contenedor. */
  /**
   * La bandeja de recepción (`POST` de lectura: la búsqueda por paciente va en
   * el cuerpo). Órdenes activas dirigidas al tenant activo, sin acesión, de la
   * más vieja a la más nueva, con las muestras que el laboratorio ya recibió.
   */
  router.post('/diagnostics/service-requests/inbox', (request) => {
    const tenantId = request.headers.get('X-Tenant-Id') ?? request.user?.tenants[0] ?? null;
    if (!isLabStaff(request.user, tenantId)) {
      return forbidden('Se requiere ser personal del laboratorio de la organización activa');
    }
    const data = cuerpo<{ cursor: unknown; limit: unknown; patientQuery: unknown }>(request);

    const limit = data.limit === undefined ? 25 : data.limit;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return validation('El tope de la bandeja no es válido', [{ field: 'limit', message: 'must not be greater than 100' }]);
    }
    const query = typeof data.patientQuery === 'string' ? data.patientQuery.trim() : data.patientQuery;
    if (query !== undefined && (typeof query !== 'string' || query.length < 2 || query.length > 80)) {
      return validation('La búsqueda por paciente no es válida', [
        { field: 'patientQuery', message: 'must be longer than or equal to 2 characters' },
      ]);
    }
    let after: { requestedAt: string; id: string } | null = null;
    if (data.cursor !== undefined) {
      after = typeof data.cursor === 'string' && data.cursor.length <= 512 ? decodeInboxCursor(data.cursor) : null;
      if (after === null) return validation('El cursor de paginación no es válido');
    }
    const cursorKey = after;

    const accessioned = new Set(
      labAccessions
        .filtrar((a) => a.custodianTenantId === tenantId && a.serviceRequestId !== null)
        .map((a) => a.serviceRequestId),
    );
    const needle = typeof query === 'string' ? normalizeText(query) : null;
    const pending = labInboxOrders
      .filtrar((o) => o.performerTenantId === tenantId && o.statusConceptId === ESTADO['ST-ACTIVE'] && !accessioned.has(o.id))
      .filter((o) => {
        if (needle === null) return true;
        const patient = pacientePorId(o.patientProfileId);
        return (
          patient !== undefined &&
          (normalizeText(patient.displayName).includes(needle) || normalizeText(patient.patientCode).includes(needle))
        );
      })
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt) || a.id.localeCompare(b.id))
      .filter(
        (o) =>
          cursorKey === null ||
          o.requestedAt > cursorKey.requestedAt ||
          (o.requestedAt === cursorKey.requestedAt && o.id > cursorKey.id),
      );

    const page = pending.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((o) => {
        const patient = pacientePorId(o.patientProfileId);
        return {
          serviceRequestId: o.id,
          patientProfileId: o.patientProfileId,
          patientDisplayName: patient?.displayName ?? null,
          patientCode: patient?.patientCode ?? null,
          codeConceptId: o.codeConceptId,
          codeDisplay: displayDe(o.codeConceptId) || null,
          categoryConceptId: o.categoryConceptId,
          priorityConceptId: o.priorityConceptId,
          statusConceptId: o.statusConceptId,
          requesterProfileId: o.requesterProfileId,
          requestingTenantId: o.requestingTenantId,
          requestingTenantName: TENANT_NAMES[o.requestingTenantId] ?? null,
          requestedAt: o.requestedAt,
          specimens: labSpecimens
            .filtrar((sp) => sp.serviceRequestId === o.id && sp.custodianTenantId === tenantId)
            .sort((a, b) => a.collectedAt.localeCompare(b.collectedAt))
            .map(specimenDetail),
        };
      }),
      count: page.length,
      limit,
      nextCursor: pending.length > limit && last !== undefined ? encodeInboxCursor(last) : null,
    };
  });

  router.post('/diagnostics/containers/:id/custody-events', (request) => {
    const data = cuerpo<{ specimenId: string; toPartyTypeConceptId?: string; sealIdentifier?: string; destinationStatusConceptId?: string }>(request);
    const missing = requiredFields(data, ['specimenId']);
    if (missing.length > 0) return validation('Falta el espécimen del traslado', missing);
    const container = labContainers.get(request.params['id']!);
    if (container === undefined) return notFound('Contenedor no encontrado');
    const event: LabCustodyEventRecord = {
      id: nuevoId('custody'),
      specimenId: data.specimenId!,
      specimenContainerId: container.id,
      custodyEventTypeConceptId: CUSTODY_EVENT_TYPE['CUSTODY_TRANSFER']!,
      occurredAt: ahora(),
      toPartyTypeConceptId: data.toPartyTypeConceptId ?? null,
      sealIdentifier: data.sealIdentifier ?? null,
      signedByUserId: request.user?.id ?? null,
    };
    labCustodyEvents.agregar(event);
    const status = data.destinationStatusConceptId ?? CONTAINER_STATUS['CONTAINER_STORED']!;
    labContainers.actualizar(container.id, { statusConceptId: status });
    return reply(201, { id: event.id, status });
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
        // El turno que el paciente reservó en un centro para esta orden.
        appointment: citaDeLaOrden(o.id),
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
      .map((u) => ({ ...itemDeDirectorio(u), tenantId: u.tenantId, rating: u.ratingCount === 0 ? null : u.rating, ratingCount: u.ratingCount, minAmount: precioMinimoDe(u), cities: ciudadesDe(u) }))
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
labSpecimens.persistirEn('mock.diagnostics.labSpecimens');
labContainers.persistirEn('mock.diagnostics.labContainers');
labCustodyEvents.persistirEn('mock.diagnostics.labCustodyEvents');
labAccessions.persistirEn('mock.diagnostics.labAccessions');
labInboxOrders.persistirEn('mock.diagnostics.labInboxOrders');
