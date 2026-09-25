import { conceptoPorId } from '../fixtures/conceptos';
import { PACIENTES, PACIENTE } from '../fixtures/personas';
import { forbidden, notFound, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_ASEGURADORA } from '../mock-session';
import {
  ahora,
  Coleccion,
  cuerpo,
  iso,
  isoDia,
  nuevoId,
  paginar,
  texto,
  uuid,
} from '../mock-store';

/* ============================================================================
    Seguros: catálogo de aseguradoras, fichas, corredores y solicitudes
    (claims) con sus líneas, adjudicaciones y disputas.
    ========================================================================== */

function c(code: string, display: string) {
  return { code, display };
}

const BOB = c('BOB', 'Boliviano');
const money = (amount: string) => ({ amount, currency: BOB });

interface BeneficioSimulado {
  readonly id: string;
  readonly category: ReturnType<typeof c>;
  readonly service: ReturnType<typeof c> | null;
  readonly coveragePercent: string | null;
  readonly copayAmount: string | null;
  readonly deductibleAmount: string | null;
  readonly annualLimitAmount: string | null;
  readonly requiresPriorAuthorization: boolean;
  readonly approvalRules: {
    readonly requiredDocuments: readonly string[];
    readonly exclusionNotes: string | null;
  };
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
}

interface PlanSimulado {
  readonly id: string;
  readonly planCode: string;
  readonly name: string;
  readonly planType: ReturnType<typeof c> | null;
  readonly currency: ReturnType<typeof c> | null;
  /** Prima de lista mensual del plan (v4.2.14, subtarea 3.1). `null` = sin declarar. */
  readonly monthlyPremiumAmount: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly status: ReturnType<typeof c>;
  readonly policyDocumentFileId: string | null;
  readonly benefits: readonly BeneficioSimulado[];
}

interface ProductoSimulado {
  readonly id: string;
  readonly productCode: string;
  readonly name: string;
  readonly productType: ReturnType<typeof c>;
  readonly marketSegment: ReturnType<typeof c> | null;
  readonly status: ReturnType<typeof c>;
  readonly plans: readonly PlanSimulado[];
}

interface DetalleAseguradoraSimulado {
  readonly id: string;
  readonly carrierCode: string;
  readonly legalName: string;
  readonly regulatorIdentifier: string | null;
  /** Canales de contacto directo (subtarea 2.3): ficticios, formato boliviano. */
  readonly whatsappNumber: string | null;
  readonly callCenterPhone: string | null;
  readonly supportEmail: string | null;
  readonly jurisdiction: ReturnType<typeof c> | null;
  readonly status: ReturnType<typeof c>;
  readonly verification: ReturnType<typeof c>;
  readonly productCount: number;
  readonly planCount: number;
  readonly networkCount: number;
  readonly createdAt: string;
  readonly canAdminister: boolean;
  readonly products: readonly ProductoSimulado[];
  readonly networks: readonly {
    readonly id: string;
    readonly networkCode: string;
    readonly name: string;
    readonly networkType: ReturnType<typeof c> | null;
    readonly status: ReturnType<typeof c>;
    readonly effectiveFrom: string | null;
    readonly effectiveTo: string | null;
    readonly memberCount: number;
  }[];
}

const ASEGURADORAS = [
  {
    id: uuid('carrier-andina'),
    carrierCode: 'ANDINA',
    legalName: 'Seguros Andina S.A.',
    name: 'Seguros Andina',
    regulatorIdentifier: 'APS-0042',
    isPublic: false,
    // Ficticios, formato boliviano (subtarea 2.3): la aseguradora del mock.
    whatsapp: '+59170000101',
    callCenter: '800-10-0101',
    supportEmail: 'siniestros@andina.mock.bo',
    planes: [
      ['ANDINA-INT', 'Plan Integral'],
      ['ANDINA-FAM', 'Plan Familiar'],
      ['ANDINA-ORO', 'Plan Oro'],
    ],
  },
  {
    id: uuid('carrier-vitalicia'),
    carrierCode: 'VITALICIA',
    legalName: 'La Vitalicia Seguros y Reaseguros de Vida S.A.',
    name: 'La Vitalicia',
    regulatorIdentifier: 'APS-0007',
    isPublic: false,
    // Sin WhatsApp a propósito: escenario "sólo call center" (Escenario 2).
    whatsapp: null,
    callCenter: '800-10-0102',
    supportEmail: 'siniestros@vitalicia.mock.bo',
    planes: [
      ['VIT-SALUD', 'Salud Total'],
      ['VIT-BASICO', 'Salud Básica'],
    ],
  },
  {
    id: uuid('carrier-alianza'),
    carrierCode: 'ALIANZA',
    legalName: 'Alianza Seguros y Reaseguros S.A.',
    name: 'Alianza Seguros',
    regulatorIdentifier: 'APS-0015',
    isPublic: false,
    whatsapp: '+59170000103',
    callCenter: '800-10-0103',
    supportEmail: 'siniestros@alianza.mock.bo',
    planes: [
      ['ALZ-ORO', 'Plan Oro'],
      ['ALZ-PLATA', 'Plan Plata'],
    ],
  },
  {
    id: uuid('carrier-cns'),
    carrierCode: 'CNS',
    legalName: 'Caja Nacional de Salud',
    name: 'Caja Nacional de Salud',
    regulatorIdentifier: 'ASUSS-001',
    isPublic: true,
    whatsapp: null,
    callCenter: '800-10-0104',
    supportEmail: null,
    planes: [['CNS-GEN', 'Seguro social obligatorio']],
  },
  {
    id: uuid('carrier-cps'),
    carrierCode: 'CPS',
    legalName: 'Caja Petrolera de Salud',
    name: 'Caja Petrolera de Salud',
    regulatorIdentifier: 'ASUSS-002',
    isPublic: true,
    // Escenario "ningún canal registrado".
    whatsapp: null,
    callCenter: null,
    supportEmail: null,
    planes: [['CPS-GEN', 'Seguro social obligatorio']],
  },
];

/**
 * Prima de lista mensual por código de plan, en Bs (v4.2.14, subtarea 3.1).
 * Ficticia y declarada como tal — igual que el resto de los datos del mock.
 * `ALZ-PLATA` queda sin prima a propósito: escenario «sin prima registrada».
 */
const PRIMAS: Readonly<Record<string, string>> = {
  'ANDINA-INT': '450.00',
  'ANDINA-FAM': '680.00',
  'ANDINA-ORO': '920.00',
  'VIT-SALUD': '510.00',
  'VIT-BASICO': '260.00',
  'ALZ-ORO': '780.00',
  'CNS-GEN': '150.00',
  'CPS-GEN': '150.00',
};

/**
 * Canales de contacto de una aseguradora sembrada, por nombre (Tarea 2).
 *
 * `/my-account` › «Seguros y tutores» usaba números fijos —el call center
 * el call center fijo que usaba esta tarjeta era, sin marcarlo, el real
 * de una aseguradora sembrada (BISA; patch
 * `2026-09-13_v4210_insurance_carriers_contact_channels.sql`)— en vez de
 * los ficticios ya declarados en `ASEGURADORAS`. Esta función es el único
 * puente entre las dos fuentes: si el nombre no coincide con ninguna
 * aseguradora sembrada (el caso de los 107 pacientes generados con
 * `fk.ASEGURADORAS`, cuyo nombre puede no calzar), devuelve `null` en los
 * dos canales en vez de inventar un número.
 *
 * @param nombre - El nombre corto de la aseguradora (`ASEGURADORAS[].name`).
 * @returns El WhatsApp y el call center ficticios de esa aseguradora, o
 *   `null` en ambos si no se la encuentra.
 */
export function contactChannelsOfCarrier(
  nombre: string,
): { whatsapp: string | null; callCenter: string | null } {
  const aseguradora = ASEGURADORAS.find((a) => a.name === nombre);
  return {
    whatsapp: aseguradora?.whatsapp ?? null,
    callCenter: aseguradora?.callCenter ?? null,
  };
}

function resumenDeAseguradora(a: (typeof ASEGURADORAS)[number], i: number, canAdminister = false) {
  return {
    id: a.id,
    carrierCode: a.carrierCode,
    legalName: a.legalName,
    regulatorIdentifier: a.regulatorIdentifier,
    whatsappNumber: a.whatsapp,
    callCenterPhone: a.callCenter,
    supportEmail: a.supportEmail,
    jurisdiction: c('BO', 'Bolivia'),
    status: c('ACTIVE', 'Activa'),
    verification: c('VERIFIED', 'Verificada'),
    productCount: 1 + (i % 2),
    planCount: a.planes.length,
    networkCount: 1,
    createdAt: iso(-600 + i * 40),
    canAdminister,
  };
}

function detalleDeAseguradora(
  a: (typeof ASEGURADORAS)[number],
  i: number,
): DetalleAseguradoraSimulado {
  return {
    ...resumenDeAseguradora(a, i),
    products: [
      {
        id: uuid(`product-${a.id}`),
        productCode: `${a.carrierCode}-SALUD`,
        name: `${a.name} · Salud`,
        productType: c('HEALTH', 'Salud'),
        marketSegment: c(
          a.isPublic ? 'PUBLIC' : 'INDIVIDUAL',
          a.isPublic ? 'Seguro social' : 'Individual y familiar',
        ),
        status: c('ACTIVE', 'Activo'),
        plans: a.planes.map(([code, name], k) => ({
          id: uuid(`plan-${code}`),
          planCode: code!,
          name: name!,
          planType: c(k === 0 ? 'PREMIUM' : 'STANDARD', k === 0 ? 'Premium' : 'Estándar'),
          currency: BOB,
          monthlyPremiumAmount: PRIMAS[code!] ?? null,
          effectiveFrom: isoDia(-365),
          effectiveTo: null,
          status: c('ACTIVE', 'Vigente'),
          policyDocumentFileId: null,
          benefits: [
            {
              id: uuid(`benefit-${code}-1`),
              category: c('CONSULTATION', 'Consulta médica'),
              service: c('CONS', 'Consulta ambulatoria'),
              coveragePercent: k === 0 ? '100' : '80',
              copayAmount: k === 0 ? '0.00' : '30.00',
              deductibleAmount: null,
              annualLimitAmount: null,
              requiresPriorAuthorization: false,
              approvalRules: { requiredDocuments: [], exclusionNotes: null },
              effectiveFrom: isoDia(-365),
              effectiveTo: null,
            },
            {
              id: uuid(`benefit-${code}-2`),
              category: c('HOSPITALIZATION', 'Internación'),
              service: null,
              coveragePercent: k === 0 ? '90' : '70',
              copayAmount: null,
              deductibleAmount: '500.00',
              annualLimitAmount: '150000.00',
              requiresPriorAuthorization: true,
              approvalRules: { requiredDocuments: ['ORDEN_MEDICA'], exclusionNotes: null },
              effectiveFrom: isoDia(-365),
              effectiveTo: null,
            },
            {
              id: uuid(`benefit-${code}-3`),
              category: c('LAB', 'Laboratorio e imagen'),
              service: null,
              coveragePercent: '80',
              copayAmount: null,
              deductibleAmount: null,
              annualLimitAmount: '20000.00',
              requiresPriorAuthorization: false,
              approvalRules: { requiredDocuments: [], exclusionNotes: null },
              effectiveFrom: isoDia(-365),
              effectiveTo: null,
            },
            {
              id: uuid(`benefit-${code}-4`),
              category: c('PHARMACY', 'Medicamentos'),
              service: null,
              coveragePercent: '60',
              copayAmount: null,
              deductibleAmount: null,
              annualLimitAmount: '8000.00',
              requiresPriorAuthorization: false,
              approvalRules: { requiredDocuments: [], exclusionNotes: null },
              effectiveFrom: isoDia(-365),
              effectiveTo: null,
            },
          ],
        })),
      },
    ],
    networks: [
      {
        id: uuid(`network-${a.id}`),
        networkCode: `${a.carrierCode}-RED`,
        name: `Red de prestadores ${a.name}`,
        networkType: c('PREFERRED', 'Preferente'),
        status: c('ACTIVE', 'Activa'),
        effectiveFrom: isoDia(-365),
        effectiveTo: null,
        memberCount: 120 + i * 35,
      },
    ],
  };
}

/**
 * Exportado para `insurance-analytics.handlers.ts` (subtarea 3.1): el tablero
 * lee las mismas primas y planes que edita la consola, incluidas las que se
 * hayan declarado en la sesión vía `PUT .../premium`.
 */
export const catalogoAdministrable = new Coleccion<DetalleAseguradoraSimulado>(
  [detalleDeAseguradora(ASEGURADORAS[0]!, 0)],
  'mock-insurance-administration',
);

function administraCatalogo(request: MockRequest): boolean {
  const user = request.user;
  return (
    user !== null &&
    (user.roles.includes('SECURITY_ADMIN') ||
      user.roles.includes('SUPERADMIN') ||
      user.key === 'aseguradora')
  );
}

/** Exportado: es también el guardián de `GET /insurance/analytics/loss-ratio`. */
export function perteneceALaAseguradora(request: MockRequest): boolean {
  return request.user?.tenants.includes(TENANT_ASEGURADORA) ?? false;
}

function conPermiso(detalle: DetalleAseguradoraSimulado, request: MockRequest) {
  return { ...detalle, canAdminister: administraCatalogo(request) };
}

function resumenAdministrable(detalle: DetalleAseguradoraSimulado, request: MockRequest) {
  const { products, networks, ...summary } = detalle;
  return {
    ...summary,
    productCount: products.length,
    planCount: products.reduce((total, product) => total + product.plans.length, 0),
    networkCount: networks.length,
    canAdminister: administraCatalogo(request),
  };
}

function localizarProducto(productId: string) {
  for (const carrier of catalogoAdministrable.todos()) {
    const product = carrier.products.find((item) => item.id === productId);
    if (product !== undefined) return { carrier, product };
  }
  return undefined;
}

export function localizarPlan(planId: string) {
  for (const carrier of catalogoAdministrable.todos()) {
    for (const product of carrier.products) {
      const plan = product.plans.find((item) => item.id === planId);
      if (plan !== undefined) return { carrier, product, plan };
    }
  }
  return undefined;
}

function actualizarProducto(
  carrier: DetalleAseguradoraSimulado,
  product: ProductoSimulado,
  changes: Partial<ProductoSimulado>,
): void {
  catalogoAdministrable.actualizar(carrier.id, {
    products: carrier.products.map((item) =>
      item.id === product.id ? { ...item, ...changes } : item,
    ),
  });
}

function concepto(id: string) {
  const item = conceptoPorId(id);
  return c(item?.code ?? id, item?.display ?? id);
}

const CORREDORES = [
  {
    id: uuid('broker-1'),
    brokerCode: 'BRK-001',
    legalName: 'Consultores en Seguros Oriente S.R.L.',
    licenseNumber: 'CS-2210',
    independent: true,
    carriers: [0, 1],
  },
  {
    id: uuid('broker-2'),
    brokerCode: 'BRK-002',
    legalName: 'Mónica Aguirre · Agente de seguros',
    licenseNumber: 'CS-3388',
    independent: true,
    carriers: [2],
  },
  {
    id: uuid('broker-3'),
    brokerCode: 'BRK-003',
    legalName: 'Andina Corredores S.A.',
    licenseNumber: 'CS-0910',
    independent: false,
    carriers: [0],
  },
];

function resumenDeCorredor(b: (typeof CORREDORES)[number], i: number) {
  return {
    id: b.id,
    brokerCode: b.brokerCode,
    legalName: b.legalName,
    licenseNumber: b.licenseNumber,
    jurisdiction: c('BO', 'Bolivia'),
    status: c('ACTIVE', 'Activo'),
    verification: c(i === 1 ? 'PENDING' : 'VERIFIED', i === 1 ? 'Pendiente' : 'Verificado'),
    independent: b.independent,
    currentCarrierCount: b.carriers.length,
    createdAt: iso(-400 + i * 50),
  };
}

export interface SolicitudSimulada {
  readonly id: string;
  readonly claimIdentifier: string;
  readonly patientProfileId: string;
  readonly carrierIndex: number;
  readonly policyIdentifier: string;
  readonly billed: string;
  readonly approved: string | null;
  readonly submittedAt: string;
  readonly status: { code: string; display: string };
  readonly hasOpenDispute: boolean;
  readonly lineas: readonly {
    service: string;
    billed: string;
    approved: string | null;
    decision: string;
    /** Cita de la cláusula contractual, sólo en líneas DENIED (subtarea 2.2). */
    clause: string | null;
    /** Justificación circunstanciada, sólo en líneas DENIED. */
    rationale: string | null;
  }[];
}

const solicitudes = new Coleccion<SolicitudSimulada>(
  [
    [
      'CLM-2026-0142',
      0,
      '1250.00',
      '1000.00',
      -20,
      'APPROVED',
      'Aprobada',
      false,
      [
        ['Consulta cardiológica', '250.00', '200.00', 'APPROVED'],
        ['Ecocardiograma Doppler', '480.00', '384.00', 'APPROVED'],
        ['Perfil lipídico', '90.00', '72.00', 'APPROVED'],
        ['Holter 24 h', '350.00', '280.00', 'APPROVED'],
        ['Certificado', '80.00', '64.00', 'APPROVED'],
      ],
    ],
    [
      'CLM-2026-0158',
      0,
      '520.00',
      null,
      -6,
      'IN_REVIEW',
      'En revisión',
      false,
      [['Prueba de esfuerzo', '520.00', null, 'PENDING']],
    ],
    [
      'CLM-2026-0163',
      1,
      '890.00',
      '0.00',
      -12,
      'REJECTED',
      'Rechazada',
      true,
      [
        [
          'Paquete de prevención',
          '890.00',
          '0.00',
          'DENIED',
          'Cláusula 4.1: Preexistencia declarada al momento de la afiliación',
          'La condición fue declarada como preexistencia en la solicitud de afiliación y queda excluida durante el período de carencia.',
        ],
      ],
    ],
    [
      'CLM-2026-0171',
      0,
      '250.00',
      '250.00',
      -2,
      'PAID',
      'Pagada',
      false,
      [['Consulta cardiológica', '250.00', '250.00', 'APPROVED']],
    ],
    [
      'CLM-2026-0177',
      2,
      '300.00',
      '150.00',
      -9,
      'PARTIAL',
      'Aprobada parcialmente',
      false,
      [
        ['Control cardiológico', '180.00', '150.00', 'APPROVED'],
        [
          'ECG',
          '120.00',
          '0.00',
          'DENIED',
          'Cláusula 12.3: Estudios complementarios sin autorización previa',
          'El estudio requiere autorización previa del área médica según las condiciones generales de la póliza.',
        ],
      ],
    ],
    [
      'CLM-2026-0180',
      0,
      '600.00',
      null,
      -1,
      'SUBMITTED',
      'Enviada',
      false,
      [
        ['Ecocardiograma Doppler', '480.00', null, 'PENDING'],
        ['ECG', '120.00', null, 'PENDING'],
      ],
    ],
    // Escenario "ningún canal registrado" (CA-2.3, Tarea 2): la aseguradora
    // de este reclamo es Caja Petrolera de Salud (carrierIndex 4), la única
    // de `ASEGURADORAS` sin WhatsApp, call center ni correo.
    [
      'CLM-2026-0185',
      4,
      '320.00',
      null,
      -3,
      'SUBMITTED',
      'Enviada',
      false,
      [['Consulta general', '320.00', null, 'PENDING']],
    ],
  ].map(
    (
      [claimIdentifier, carrierIndex, billed, approved, dias, code, display, disputa, lineas],
      i,
    ) => ({
      id: uuid(`claim-${claimIdentifier}`),
      claimIdentifier: claimIdentifier as string,
      // El índice 3 (`p-rocha`) no tiene aseguradora propia ni otro
      // reclamo, y a diferencia del 1 (`p-mamani`) ningún spec lo usa como
      // "titular sin coberturas" con recordCount === 0 esperado
      // (insurance-portability.handlers.spec.ts:16) — usar el 1 rompía
      // exactamente esa aserción.
      patientProfileId: PACIENTES[[0, 5, 2, 0, 8, 0, 3][i]!]!.id,
      carrierIndex: carrierIndex as number,
      policyIdentifier: `POL-${100200 + i * 17}`,
      billed: billed as string,
      approved: approved as string | null,
      submittedAt: iso(dias as number, 10),
      status: c(code as string, display as string),
      hasOpenDispute: disputa as boolean,
      lineas: (
        lineas as [string, string, string | null, string, string?, string?][]
      ).map(([service, b, a, decision, clause, rationale]) => ({
        service,
        billed: b,
        approved: a,
        decision,
        // Sólo las líneas DENIED de la receta traen los dos últimos elementos
        // (subtarea 2.2); el resto los destructura como `undefined` y acá se
        // normalizan a `null`, igual que hace la API.
        clause: clause ?? null,
        rationale: rationale ?? null,
      })),
    }),
  ),
);

/**
 * La solicitud de seguro de una cita, como la publica `GET /scheduling/bookings`
 * en `insuranceClaim`.
 *
 * La API la enlaza por la consulta atendida (cita → encuentro → reclamo). El
 * simulador no tiene encuentros, así que usa la del propio paciente si tiene y,
 * si no, reparte las sembradas de forma estable por el id de la cita: lo que se
 * quiere probar es la pantalla, y así la agenda de la médica muestra estados
 * distintos. Sólo las citas con aseguradora y ya confirmadas tienen solicitud.
 */
export function solicitudDeLaCita(cita: { id: string; patientProfileId: string; appointmentId: string | null; insuranceCarrierName: string | null }) {
  if (cita.insuranceCarrierName === null || cita.appointmentId === null) return null;
  const todas = solicitudes.todos();
  const propia = todas.filter((s) => s.patientProfileId === cita.patientProfileId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  let semilla = 0;
  for (const letra of cita.id) semilla = (semilla * 31 + letra.charCodeAt(0)) >>> 0;
  const elegida = propia ?? todas[semilla % todas.length];
  if (elegida === undefined) return null;
  return { id: elegida.id, claimIdentifier: elegida.claimIdentifier, statusCode: elegida.status.code, statusDisplay: elegida.status.display, submittedAt: elegida.submittedAt };
}

function itemDeSolicitud(s: SolicitudSimulada) {
  const paciente = PACIENTES.find((p) => p.id === s.patientProfileId) ?? PACIENTE;
  const aseguradora = ASEGURADORAS[s.carrierIndex]!;
  return {
    id: s.id,
    claimIdentifier: s.claimIdentifier,
    patient: {
      id: paciente.id,
      displayName: paciente.displayName,
      patientCode: paciente.patientCode,
      memberIdentifier: `AF-${paciente.patientCode.slice(4)}`,
    },
    carrierName: aseguradora.name,
    insuranceCarrierId: aseguradora.id,
    carrierWhatsappNumber: aseguradora.whatsapp,
    carrierCallCenterPhone: aseguradora.callCenter,
    carrierSupportEmail: aseguradora.supportEmail,
    policyIdentifier: s.policyIdentifier,
    policyBrokerName: s.carrierIndex === 0 ? CORREDORES[0]!.legalName : null,
    billedTotal: money(s.billed),
    approvedTotal: s.approved === null ? null : money(s.approved),
    submittedAt: s.submittedAt,
    status: s.status,
    hasOpenDispute: s.hasOpenDispute,
  };
}

export function registrarSeguros(router: MockRouter): void {
  // El sobre `{ carriers }` no es decorativo: `InsuranceClient.listCarrierCatalog`
  // mapea `body.carriers`, y devolver el array pelado le dejaba `undefined`.
  // El `for...of` de `RegisterPatient.opcionesDeSeguro` lo recorría igual y
  // tiraba la pantalla entera de alta de paciente.
  router.get('/insurance-carrier-catalog', () => ({
    carriers: ASEGURADORAS.map((a) => ({
      id: a.id,
      code: a.carrierCode,
      name: a.name,
      legalName: a.legalName,
      isPublic: a.isPublic,
      plans: a.planes.map(([code, name]) => ({ id: uuid(`plan-${code}`), code, name })),
    })),
  }));

  router.get('/insurance-carriers', (request) => {
    if (!perteneceALaAseguradora(request)) return { items: [], count: 0 };
    const items = catalogoAdministrable
      .todos()
      .map((carrier) => resumenAdministrable(carrier, request));
    return { items, count: items.length };
  });

  router.get('/insurance-carriers/:id', (request) => {
    if (!perteneceALaAseguradora(request)) return notFound('Aseguradora no encontrada');
    const carrier = catalogoAdministrable.get(request.params['id']!);
    return carrier === undefined
      ? notFound('Aseguradora no encontrada')
      : conPermiso(carrier, request);
  });

  router.post('/insurance-products/:productId/plans', (request) => {
    if (!administraCatalogo(request)) return forbidden();
    const match = localizarProducto(request.params['productId']!);
    if (match === undefined) return notFound('Producto no encontrado');
    const datos = cuerpo<{
      planCode: string;
      name: string;
      effectiveFrom?: string;
      effectiveTo?: string;
      currencyConceptId?: string;
      monthlyPremiumAmount?: string;
    }>(request);
    const id = nuevoId('insurance-plan');
    const plan = {
      id,
      planCode: datos.planCode ?? 'NUEVO',
      name: datos.name ?? 'Plan nuevo',
      planType: c('STANDARD', 'Estándar'),
      currency: datos.currencyConceptId === undefined ? BOB : concepto(datos.currencyConceptId),
      monthlyPremiumAmount: datos.monthlyPremiumAmount ?? null,
      effectiveFrom: datos.effectiveFrom ?? isoDia(0),
      effectiveTo: datos.effectiveTo ?? null,
      status: c('ACTIVE', 'Vigente'),
      policyDocumentFileId: null,
      benefits: [],
    };
    actualizarProducto(match.carrier, match.product, { plans: [...match.product.plans, plan] });
    return { status: 201, body: { id } };
  });

  router.post('/insurance-plans/:planId/benefits', (request) => {
    if (!administraCatalogo(request)) return forbidden();
    const match = localizarPlan(request.params['planId']!);
    if (match === undefined) return notFound('Plan no encontrado');
    const datos = cuerpo<{
      benefitCategoryConceptId: string;
      serviceConceptId?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
      coveragePercent?: string;
      copayAmount?: string;
      deductibleAmount?: string;
      annualLimitAmount?: string;
      requiresPriorAuthorization?: boolean;
    }>(request);
    const id = nuevoId('insurance-benefit');
    const benefit = {
      id,
      category: concepto(datos.benefitCategoryConceptId ?? ''),
      service: datos.serviceConceptId === undefined ? null : concepto(datos.serviceConceptId),
      coveragePercent: datos.coveragePercent ?? null,
      copayAmount: datos.copayAmount ?? null,
      deductibleAmount: datos.deductibleAmount ?? null,
      annualLimitAmount: datos.annualLimitAmount ?? null,
      requiresPriorAuthorization: datos.requiresPriorAuthorization ?? false,
      approvalRules: { requiredDocuments: [], exclusionNotes: null },
      effectiveFrom: datos.effectiveFrom ?? isoDia(0),
      effectiveTo: datos.effectiveTo ?? null,
    };
    const plans = match.product.plans.map((plan) =>
      plan.id === match.plan.id ? { ...plan, benefits: [...plan.benefits, benefit] } : plan,
    );
    actualizarProducto(match.carrier, match.product, { plans });
    return { status: 201, body: { id } };
  });

  router.put('/insurance-plans/:planId/benefits/:benefitId', (request) => {
    if (!administraCatalogo(request)) return forbidden();
    const match = localizarPlan(request.params['planId']!);
    if (match === undefined) return notFound('Plan no encontrado');
    const benefitId = request.params['benefitId']!;
    if (!match.plan.benefits.some((benefit) => benefit.id === benefitId))
      return notFound('Cobertura no encontrada');
    const datos = cuerpo<{
      coveragePercent: string | null;
      copayAmount: string | null;
      deductibleAmount: string | null;
      annualLimitAmount: string | null;
    }>(request);
    const plans = match.product.plans.map((plan) =>
      plan.id === match.plan.id
        ? {
            ...plan,
            benefits: plan.benefits.map((benefit) =>
              benefit.id === benefitId
                ? {
                    ...benefit,
                    coveragePercent: datos.coveragePercent ?? null,
                    copayAmount: datos.copayAmount ?? null,
                    deductibleAmount: datos.deductibleAmount ?? null,
                    annualLimitAmount: datos.annualLimitAmount ?? null,
                  }
                : benefit,
            ),
          }
        : plan,
    );
    actualizarProducto(match.carrier, match.product, { plans });
    return { ok: true };
  });

  router.put('/insurance-plans/:planId/benefits/:benefitId/rules', (request) => {
    if (!administraCatalogo(request)) return forbidden();
    const match = localizarPlan(request.params['planId']!);
    if (match === undefined) return notFound('Plan no encontrado');
    const benefitId = request.params['benefitId']!;
    if (!match.plan.benefits.some((benefit) => benefit.id === benefitId))
      return notFound('Cobertura no encontrada');
    const datos = cuerpo<{
      requiresPriorAuthorization: boolean;
      requiredDocuments: string[];
      exclusionNotes: string | null;
    }>(request);
    const plans = match.product.plans.map((plan) =>
      plan.id === match.plan.id
        ? {
            ...plan,
            benefits: plan.benefits.map((benefit) =>
              benefit.id === benefitId
                ? {
                    ...benefit,
                    requiresPriorAuthorization: datos.requiresPriorAuthorization ?? false,
                    approvalRules: {
                      requiredDocuments: [...(datos.requiredDocuments ?? [])],
                      exclusionNotes: datos.exclusionNotes ?? null,
                    },
                  }
                : benefit,
            ),
          }
        : plan,
    );
    actualizarProducto(match.carrier, match.product, { plans });
    return { ok: true };
  });

  /**
   * Subtarea 3.1 (v4.2.14) — declarar o quitar la prima de lista mensual de un
   * plan. Reemplazo completo de un solo valor, como el resto de las
   * mutaciones económicas del catálogo.
   */
  router.put('/insurance-plans/:planId/premium', (request) => {
    if (!administraCatalogo(request)) return forbidden();
    const match = localizarPlan(request.params['planId']!);
    if (match === undefined) return notFound('Plan no encontrado');
    const datos = cuerpo<{ monthlyPremiumAmount: string | null }>(request);
    const monthlyPremiumAmount = datos.monthlyPremiumAmount ?? null;
    const plans = match.product.plans.map((plan) =>
      plan.id === match.plan.id ? { ...plan, monthlyPremiumAmount } : plan,
    );
    actualizarProducto(match.carrier, match.product, { plans });
    return { id: match.plan.id, monthlyPremiumAmount };
  });

  router.get('/insurance-brokers', () => ({
    items: CORREDORES.map(resumenDeCorredor),
    count: CORREDORES.length,
  }));

  router.get('/insurance-brokers/:id', ({ params }) => {
    const i = CORREDORES.findIndex((b) => b.id === params['id']);
    if (i < 0) return notFound('Corredor no encontrado');
    const b = CORREDORES[i]!;
    return {
      ...resumenDeCorredor(b, i),
      publicProfileId: null,
      agreements: b.carriers.map((k, j) => ({
        id: uuid(`agreement-${b.id}-${k}`),
        insuranceCarrierId: ASEGURADORAS[k]!.id,
        carrierLegalName: ASEGURADORAS[k]!.legalName,
        agreementCode: `${b.brokerCode}-${ASEGURADORAS[k]!.carrierCode}`,
        commissionModel: c('PERCENT', 'Porcentaje de prima'),
        effectiveFrom: isoDia(-300 - j * 100),
        effectiveTo: null,
        status: c('ACTIVE', 'Vigente'),
        current: true,
        contractFileId: null,
      })),
    };
  });

  router.get('/insurance-brokers/:id/clients', ({ params }) => {
    const b = CORREDORES.find((x) => x.id === params['id']);
    if (b === undefined) return notFound('Corredor no encontrado');
    const items = PACIENTES.filter((p) => p.aseguradora !== undefined)
      .slice(0, 4)
      .map((p, i) => ({
        id: uuid(`broker-client-${b.id}-${p.id}`),
        patientProfileId: p.id,
        employerGroupId: null,
        clientType: c('INDIVIDUAL', 'Individual'),
        assignedBrokerUserId: uuid('user-broker-1'),
        effectiveFrom: isoDia(-200 - i * 20),
        effectiveTo: null,
        status: c('ACTIVE', 'Activo'),
      }));
    return { items, count: items.length };
  });

  router.get('/insurance-claims', ({ query }) => {
    const status = texto(query, 'statusConceptId');
    const carrier = texto(query, 'insuranceCarrierId');
    const items = solicitudes
      .todos()
      .filter((s) => status === null || s.status.code === status)
      .filter((s) => carrier === null || ASEGURADORAS[s.carrierIndex]!.id === carrier)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map(itemDeSolicitud);
    const pagina = paginar(items, query, 20);
    return { items: pagina.items, nextCursor: pagina.nextCursor };
  });

  router.post('/insurance-claims', (request) => {
    const datos = cuerpo<{
      patientProfileId?: string;
      insuranceCarrierId?: string;
      policyIdentifier?: string;
      lines?: { service: string; billedAmount: string }[];
    }>(request);
    const carrierIndex = Math.max(
      0,
      ASEGURADORAS.findIndex((a) => a.id === datos.insuranceCarrierId),
    );
    const lineas = (datos.lines ?? [{ service: 'Consulta', billedAmount: '250.00' }]).map((l) => ({
      service: l.service,
      billed: l.billedAmount,
      approved: null,
      decision: 'PENDING',
      clause: null,
      rationale: null,
    }));
    const nueva = solicitudes.agregar({
      id: nuevoId('claim'),
      claimIdentifier: `CLM-2026-${String(200 + solicitudes.tamano).padStart(4, '0')}`,
      patientProfileId: datos.patientProfileId ?? PACIENTE.id,
      carrierIndex,
      policyIdentifier: datos.policyIdentifier ?? 'POL-NUEVA',
      billed: lineas.reduce((s, l) => s + Number(l.billed), 0).toFixed(2),
      approved: null,
      submittedAt: ahora(),
      status: c('SUBMITTED', 'Enviada'),
      hasOpenDispute: false,
      lineas,
    });
    return { status: 201, body: itemDeSolicitud(nueva) };
  });

  /**
   * Antiduplicación de estudios (v4.2.17, T-26, subtarea 3.2): el ítem
   * «Perfil lipídico» de `CLM-2026-0142` viene de un estudio repetido con
   * justificación — la unidad diagnóstica que facturó no es la organización
   * del informe previo (`TENANT_LABORATORIO`), así que quien factura no ve la
   * conclusión, sólo la justificación del médico. El resto de las líneas de
   * todas las solicitudes viaja con `duplicateStudy: null`.
   */
  function duplicateStudyDe(claimIdentifier: string, service: string) {
    if (claimIdentifier !== 'CLM-2026-0142' || service !== 'Perfil lipídico') return null;
    return {
      previousDiagnosticReportId: uuid('report-order-0-STUDY-PERFIL-LIPIDICO'),
      studyName: 'Perfil lipídico',
      performedAt: iso(-14, 9),
      daysAgo: 14,
      providerName: 'Laboratorio Central',
      justification: 'Control de dislipidemia con cambio reciente de tratamiento; se repite para verificar respuesta.',
      reused: false,
    };
  }

  router.get('/insurance-claims/:id', ({ params }) => {
    const s = solicitudes.get(params['id']!);
    if (s === undefined) return notFound('Solicitud no encontrada');
    const adjudicada = s.approved !== null;
    const adjudicacion = adjudicada
      ? {
          id: uuid(`adj-${s.id}`),
          adjudicationVersion: 1,
          outcome: s.status,
          dispositionText:
            s.status.code === 'REJECTED'
              ? 'Prestación no cubierta por el plan contratado.'
              : s.status.code === 'PARTIAL'
                ? 'El electrocardiograma requiere autorización previa.'
                : 'Aprobada según tarifario vigente.',
          totalApprovedAmount: money(s.approved!),
          totalPatientAmount: money((Number(s.billed) - Number(s.approved)).toFixed(2)),
          totalDeniedAmount: money(
            s.lineas
              .filter((l) => l.decision === 'DENIED')
              .reduce((t, l) => t + Number(l.billed), 0)
              .toFixed(2),
          ),
          adjudicatedAt: iso(-1),
        }
      : null;
    return {
      header: itemDeSolicitud(s),
      lines: s.lineas.map((l, i) => ({
        id: uuid(`line-${s.id}-${i}`),
        lineSequence: i + 1,
        service: c(`SVC-${i}`, l.service),
        billedAmount: money(l.billed),
        patientResponsibilityAmount:
          l.approved === null ? null : money((Number(l.billed) - Number(l.approved)).toFixed(2)),
        approvedAmount: l.approved === null ? null : money(l.approved),
        deniedAmount: l.decision === 'DENIED' ? money(l.billed) : null,
        decision: c(
          l.decision,
          l.decision === 'APPROVED'
            ? 'Aprobada'
            : l.decision === 'DENIED'
              ? 'Denegada'
              : 'Pendiente',
        ),
        denialReason: l.decision === 'DENIED' ? c('NOT_COVERED', 'No cubierto') : null,
        policyClauseReference: l.clause,
        denialRationale: l.rationale,
        referenceType: null,
        reference: null,
        duplicateStudy: duplicateStudyDe(s.claimIdentifier, l.service),
      })),
      lineBilledTotal: money(s.billed),
      lineApprovedTotal: s.approved === null ? null : money(s.approved),
      adjudication: adjudicacion,
      adjudicationHistory: adjudicacion === null ? [] : [adjudicacion],
      disputes: s.hasOpenDispute
        ? [
            {
              id: uuid(`dispute-${s.id}`),
              disputeType: c('APPEAL', 'Apelación'),
              disputeReason: c('COVERAGE', 'Discrepancia de cobertura'),
              status: c('OPEN', 'Abierta'),
              submittedAt: iso(-8),
              filingDeadline: iso(22),
            },
          ]
        : [],
    };
  });

  router.post('/insurance-claims/:id/disputes', (request) => {
    const s = solicitudes.get(request.params['id']!);
    if (s === undefined) return notFound();
    solicitudes.actualizar(s.id, { hasOpenDispute: true });
    return {
      status: 201,
      body: {
        id: nuevoId('dispute'),
        disputeType: c('APPEAL', 'Apelación'),
        disputeReason: c('COVERAGE', 'Discrepancia de cobertura'),
        status: c('OPEN', 'Abierta'),
        submittedAt: ahora(),
        filingDeadline: iso(30),
      },
    };
  });
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
solicitudes.persistirEn('mock.insurance.solicitudes');

/**
 * Exportada para portabilidad de póliza (subtarea 3.3): sus reclamos reales,
 * reusados en el informe en vez de un segundo juego que se desalinee del que
 * ya lee `GET /insurance-claims`.
 */
export function reclamosDePaciente(patientProfileId: string): readonly SolicitudSimulada[] {
  return solicitudes.filtrar((s) => s.patientProfileId === patientProfileId);
}

/** El nombre de la aseguradora de una solicitud, por su índice en `ASEGURADORAS`. */
export function nombreDeAseguradora(carrierIndex: number): string {
  return ASEGURADORAS[carrierIndex]!.name;
}
