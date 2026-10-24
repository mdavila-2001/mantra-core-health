import { CORREDORES_CON_PERFIL, vitrinas, type VitrinaSimulada } from '../fixtures/comunidad';
import { ASEGURADORAS_REALES, type AseguradoraReal } from '../fixtures/instituciones.generated';
import { conceptoPorId } from '../fixtures/conceptos';
import { INSURER_NETWORK_PRACTITIONERS } from '../fixtures/insurer-network.generated';
import { MEDICA, PACIENTES, PACIENTE, profesionalPorId } from '../fixtures/personas';
import { conflict, forbidden, noContent, notFound, preconditionFailed, validation, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_ASEGURADORA } from '../mock-session';
import { procedimientoPorConceptId } from './practice.handlers';
import type { CreateAdjudicationInput } from '../../data-access/insurance/insurance.types';
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

function cents(amount: string | undefined): number | null {
  if (amount === undefined) return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return null;
  const [units, fraction = ''] = amount.split('.');
  const value = Number(units) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

const asAmount = (value: number): string => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;

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

/**
 * Una aseguradora con catálogo en el simulador: las cinco sembradas a mano en
 * {@link ASEGURADORAS} o una armada para la ficha de un directorio que no
 * tiene catálogo propio (ver {@link aseguradoraDeLaFicha}).
 */
interface AseguradoraDelCatalogo {
  readonly id: string;
  readonly carrierCode: string;
  readonly legalName: string;
  readonly name: string;
  readonly regulatorIdentifier: string | null;
  readonly isPublic: boolean;
  readonly whatsapp: string | null;
  readonly callCenter: string | null;
  readonly supportEmail: string | null;
  /** `[código, nombre]` de cada plan. El primero es el de mayor cobertura. */
  readonly planes: readonly (readonly string[])[];
  /**
   * Los slugs de sus fichas en el directorio de aseguradoras. Van escritos y no
   * se deducen del nombre: «Alianza Vida S.A.» no se llama como «Alianza
   * Seguros», y es la misma compañía de personas.
   */
  readonly fichas?: readonly string[];
  /**
   * Qué vende: salud (el valor por omisión) o, en una aseguradora de seguros
   * generales, accidentes personales —que no es un seguro de salud, pero es lo
   * que esas compañías le ofrecen a una persona—.
   */
  readonly ramo?: 'SALUD' | 'ACCIDENTES';
  /** Primas propias por código de plan; si no, se buscan en {@link PRIMAS}. */
  readonly primas?: Readonly<Record<string, string>>;
}

const ASEGURADORAS: readonly AseguradoraDelCatalogo[] = [
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
    fichas: ['seguros-andina'],
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
    // La ficha inventada de siempre y la real de la planilla del propietario:
    // las dos son la misma compañía y abren el mismo catálogo.
    fichas: ['la-vitalicia', 'la-vitalicia-seguros-y-reaseguros-de-vida-s-a'],
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
    // Sus planes son de salud, así que su ficha es la de la compañía de
    // personas —Alianza Vida— y no la de generales, que tiene la suya.
    fichas: ['alianza-vida-seguros-y-reaseguros-s-a'],
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

function resumenDeAseguradora(a: AseguradoraDelCatalogo, i: number, canAdminister = false) {
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

/** Una cláusula del simulador: lo que cambia de una a otra; el resto es fijo. */
function beneficio(
  id: string,
  category: ReturnType<typeof c>,
  datos: Partial<Omit<BeneficioSimulado, 'id' | 'category'>>,
): BeneficioSimulado {
  return {
    id: uuid(id),
    category,
    service: null,
    coveragePercent: null,
    copayAmount: null,
    deductibleAmount: null,
    annualLimitAmount: null,
    requiresPriorAuthorization: false,
    approvalRules: { requiredDocuments: [], exclusionNotes: null },
    effectiveFrom: isoDia(-365),
    effectiveTo: null,
    ...datos,
  };
}

/** Las cláusulas de un plan de salud. `k === 0` es el plan de mayor cobertura. */
function beneficiosDeSalud(code: string, k: number): readonly BeneficioSimulado[] {
  return [
    beneficio(`benefit-${code}-1`, c('CONSULTATION', 'Consulta médica'), {
      service: c('CONS', 'Consulta ambulatoria'),
      coveragePercent: k === 0 ? '100' : '80',
      copayAmount: k === 0 ? '0.00' : '30.00',
    }),
    beneficio(`benefit-${code}-2`, c('HOSPITALIZATION', 'Internación'), {
      coveragePercent: k === 0 ? '90' : '70',
      deductibleAmount: '500.00',
      annualLimitAmount: '150000.00',
      requiresPriorAuthorization: true,
      approvalRules: { requiredDocuments: ['ORDEN_MEDICA'], exclusionNotes: null },
    }),
    beneficio(`benefit-${code}-3`, c('LAB', 'Laboratorio e imagen'), {
      coveragePercent: '80',
      annualLimitAmount: '20000.00',
    }),
    beneficio(`benefit-${code}-4`, c('PHARMACY', 'Medicamentos'), {
      coveragePercent: '60',
      annualLimitAmount: '8000.00',
    }),
  ];
}

/**
 * Las cláusulas de un plan de accidentes personales. El capital asegurado va
 * como tope anual: es lo que paga la póliza, una vez, si pasa lo que cubre.
 */
function beneficiosDeAccidentes(code: string, k: number): readonly BeneficioSimulado[] {
  const capital = k === 0 ? '100000.00' : '50000.00';
  return [
    beneficio(`benefit-${code}-1`, c('ACCIDENTAL_DEATH', 'Muerte accidental'), {
      coveragePercent: '100',
      annualLimitAmount: capital,
    }),
    beneficio(`benefit-${code}-2`, c('PERMANENT_DISABILITY', 'Invalidez total y permanente'), {
      coveragePercent: '100',
      annualLimitAmount: capital,
      approvalRules: { requiredDocuments: ['INFORME_CLINICO'], exclusionNotes: null },
    }),
    beneficio(`benefit-${code}-3`, c('ACCIDENT_MEDICAL', 'Gastos médicos por accidente'), {
      coveragePercent: k === 0 ? '100' : '80',
      annualLimitAmount: k === 0 ? '15000.00' : '8000.00',
      approvalRules: {
        requiredDocuments: ['INFORME_CLINICO'],
        exclusionNotes: 'Enfermedades que no vengan de un accidente',
      },
    }),
    beneficio(`benefit-${code}-4`, c('FUNERAL', 'Gastos de sepelio'), {
      coveragePercent: '100',
      annualLimitAmount: k === 0 ? '5000.00' : '3000.00',
    }),
  ];
}

function detalleDeAseguradora(
  a: AseguradoraDelCatalogo,
  i: number,
): DetalleAseguradoraSimulado {
  const accidentes = a.ramo === 'ACCIDENTES';
  return {
    ...resumenDeAseguradora(a, i),
    products: [
      {
        id: uuid(`product-${a.id}`),
        productCode: `${a.carrierCode}-${accidentes ? 'AP' : 'SALUD'}`,
        name: `${a.name} · ${accidentes ? 'Accidentes personales' : 'Salud'}`,
        productType: accidentes
          ? c('PERSONAL_ACCIDENT', 'Accidentes personales')
          : c('HEALTH', 'Salud'),
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
          monthlyPremiumAmount: a.primas?.[code!] ?? PRIMAS[code!] ?? null,
          effectiveFrom: isoDia(-365),
          effectiveTo: null,
          status: c('ACTIVE', 'Vigente'),
          policyDocumentFileId: null,
          benefits: accidentes ? beneficiosDeAccidentes(code!, k) : beneficiosDeSalud(code!, k),
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

/** Exportado: es también la guarda de escritura de `insurance-campaigns.handlers.ts`. */
export function administraCatalogo(request: MockRequest): boolean {
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

/**
 * El servicio de una cláusula. Se busca primero en el arancel —de ahí salen
 * los servicios que ofrece el médico— y después en el registro general.
 */
function servicioDeClausula(id: string) {
  const procedimiento = procedimientoPorConceptId(id);
  return procedimiento === undefined
    ? concepto(id)
    : c(procedimiento.code, procedimiento.display);
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
  readonly adjudicationVersion?: number;
  readonly dispositionText?: string;
  readonly adjudicatedAt?: string;
  /** undefined conserva las EOB historicas; null significa dictamen aun no publicado. */
  readonly eobPublishedAt?: string | null;
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
    // Tarea 3 · H8 (CA-3.3): una exclusión sin cláusula contractual degrada
    // la liquidación a UNDER_REVIEW — nunca se publica un rechazo sin
    // respaldo de póliza. Nivel inválido de la maqueta (`insurance.handlers.spec.ts`).
    [
      'CLM-2026-0183',
      0,
      '200.00',
      '80.00',
      -4,
      'PARTIAL',
      'Aprobada parcialmente',
      false,
      [
        ['Consulta cardiológica', '120.00', '80.00', 'APPROVED'],
        ['Radiografía de tórax', '80.00', '0.00', 'DENIED'],
      ],
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
      //
      // CLM-2026-0183 (el último, Tarea 3) va al índice 5 (`p-torrez`, también
      // de Seguros Andina) y no a PACIENTE: el certificado de portabilidad de
      // la titular de demostración suma exactamente sus 3 reclamos reales más
      // el relleno histórico (14 reclamos / Bs 12 450, ver
      // `insurance-portability.handlers.ts`), y un cuarto lo rompía.
      patientProfileId: PACIENTES[[0, 5, 2, 0, 8, 0, 3, 5][i]!]!.id,
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

/**
 * Las redes que publica cada aseguradora, con la forma de
 * `GET /practitioners/:id/insurance-carriers`.
 *
 * La aseguradora que ya está en el catálogo del simulador conserva su id —así
 * el mismo seguro no aparece con dos identidades—; la que no, recibe uno
 * estable derivado de su nombre. Cada plan publicado es una red: es como la
 * aseguradora arma su listado.
 */
export function carriersOfPractitioner(
  networks: readonly { readonly insurer: string; readonly plans: readonly string[] }[],
) {
  return networks
    .map((network) => {
      const carrierId =
        ASEGURADORAS.find((a) => a.name === network.insurer)?.id ??
        uuid(`carrier-network-${network.insurer}`);
      return {
        carrierId,
        carrierName: network.insurer,
        networks: network.plans.map((plan) => ({
          id: uuid(`network-${network.insurer}-${plan}`),
          name: plan,
        })),
      };
    })
    .sort((a, b) => a.carrierName.localeCompare(b.carrierName, 'es'));
}

/**
 * Lo que la práctica espera cobrarles a las aseguradoras, a hoy.
 *
 * Enviadas sin dictamen cuentan por lo facturado; aprobadas —total o
 * parcialmente— y todavía sin pagar, por lo aprobado. Pagadas y rechazadas no
 * se esperan. Exportado para la contabilidad simple del doctor, que lo
 * muestra como uno de sus tres números.
 */
export function pendienteDeAseguradoras(): { monto: string; solicitudes: number } {
  let centavos = 0;
  let cuantas = 0;
  for (const s of solicitudes.todos()) {
    const codigo = s.status.code;
    const importe =
      codigo === 'SUBMITTED'
        ? s.billed
        : codigo === 'APPROVED' || codigo === 'PARTIAL'
          ? s.approved
          : null;
    if (importe === null) continue;
    centavos += Math.round(Number(importe) * 100);
    cuantas += 1;
  }
  return { monto: (centavos / 100).toFixed(2), solicitudes: cuantas };
}

/* ---- con qué aseguradoras trabaja un profesional ----------------------------
   `GET /practitioners/:id/insurance-networks`. La API real todavía no la sirve
   (`docs/pendientes-backend-seguros-del-medico.md`); la forma es la que pide
   ahí el contrato.

   Dos fuentes, y ninguna inventa nada sobre alguien real:

   - La médica escrita a mano (`MEDICA`) es ficticia: se le dan tres redes del
     catálogo del simulador, con la red y el id que ya sirve
     `GET /insurance-carriers/:id`, para que la misma red se lea igual desde
     las dos puntas.
   - Los médicos de la red importada (`insurer-network.generated.ts`) traen lo
     que su aseguradora publica: en qué red figuran. La fuente no publica desde
     cuándo, así que la vigencia viaja nula en vez de fabricarse. */

interface RedDelProfesional {
  readonly membershipId: string;
  readonly carrierId: string;
  readonly carrierName: string;
  readonly networkName: string;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
}

function redDelCatalogo(
  profesionalId: string,
  aseguradora: (typeof ASEGURADORAS)[number],
  desde: string,
): RedDelProfesional {
  return {
    membershipId: uuid(`membership-${profesionalId}-${aseguradora.id}`),
    carrierId: aseguradora.id,
    carrierName: aseguradora.name,
    networkName: `Red de prestadores ${aseguradora.name}`,
    effectiveFrom: desde,
    effectiveTo: null,
  };
}

let redesDeLaRedImportada: ReadonlyMap<string, readonly RedDelProfesional[]> | null = null;

/** Se arma la primera vez que se pide: son más de mil médicos. */
function redesImportadas(): ReadonlyMap<string, readonly RedDelProfesional[]> {
  if (redesDeLaRedImportada !== null) return redesDeLaRedImportada;
  const mapa = new Map<string, readonly RedDelProfesional[]>();
  for (const medico of INSURER_NETWORK_PRACTITIONERS) {
    const id = uuid(`hpid-${medico.id}`);
    mapa.set(
      id,
      medico.networks.map((red) => {
        const delCatalogo = ASEGURADORAS.find((a) => a.name === red.insurer);
        const carrierId = delCatalogo?.id ?? uuid(`carrier-${red.insurer}`);
        return {
          membershipId: uuid(`membership-${id}-${carrierId}`),
          carrierId,
          carrierName: red.insurer,
          networkName: `Red médica ${red.insurer}`,
          effectiveFrom: null,
          effectiveTo: null,
        };
      }),
    );
  }
  redesDeLaRedImportada = mapa;
  return mapa;
}

/** Las redes en las que figura un profesional; vacío si no figura en ninguna. */
export function redesDelProfesional(practitionerProfileId: string): readonly RedDelProfesional[] {
  if (practitionerProfileId === MEDICA.id) {
    return [
      redDelCatalogo(MEDICA.id, ASEGURADORAS[0]!, isoDia(-480)),
      redDelCatalogo(MEDICA.id, ASEGURADORAS[2]!, isoDia(-300)),
      redDelCatalogo(MEDICA.id, ASEGURADORAS[3]!, isoDia(-120)),
    ];
  }
  return redesImportadas().get(practitionerProfileId) ?? [];
}

/* ---- de la ficha del directorio al catálogo --------------------------- */

/**
 * Un nombre para comparar: sin tildes, sin mayúsculas y sin puntuación.
 * «LA VITALICIA SEGUROS Y REASEGUROS DE VIDA S.A.» y «La Vitalicia Seguros y
 * Reaseguros de Vida S.A.» son el mismo nombre escrito por dos planillas.
 */
function nombreComparable(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** La aseguradora real de la planilla del propietario detrás de una ficha, si la hay. */
function aseguradoraRealDe(ficha: VitrinaSimulada): AseguradoraReal | undefined {
  return ASEGURADORAS_REALES.find((real) => uuid(`insurer-${real.id}`) === ficha.targetId);
}

/**
 * El índice en {@link ASEGURADORAS} del catálogo sembrado de una ficha, o -1.
 *
 * Primero por los slugs que cada aseguradora declara —es lo único que no
 * depende de cómo escribió el nombre cada planilla— y después por nombre:
 * el que muestra la ficha o la razón social de la planilla contra el nombre o
 * la razón social del catálogo, sin distinguir tildes ni mayúsculas. Antes se
 * comparaba `displayName === name` al pie de la letra, y ninguna de las 19
 * aseguradoras reales calzaba: todas abrían «todavía no publicó sus productos».
 */
function indiceDelCatalogo(ficha: VitrinaSimulada): number {
  const porSlug = ASEGURADORAS.findIndex((a) => a.fichas?.includes(ficha.slug) ?? false);
  if (porSlug >= 0) return porSlug;
  const nombres = new Set(
    [ficha.displayName, aseguradoraRealDe(ficha)?.name]
      .filter((nombre): nombre is string => nombre !== undefined)
      .map(nombreComparable),
  );
  return ASEGURADORAS.findIndex(
    (a) => nombres.has(nombreComparable(a.name)) || nombres.has(nombreComparable(a.legalName)),
  );
}

/** Un número estable a partir de un texto: el mismo slug da siempre el mismo. */
function semilla(texto: string): number {
  return Number.parseInt(uuid(texto).slice(0, 8), 16);
}

/** Palabras que no distinguen a una aseguradora de otra en su código. */
const PALABRAS_GENERICAS = new Set([
  's', 'a', 'y', 'de', 'la', 'del', 'seguros', 'reaseguros', 'compania', 'empresa',
  'generales', 'fianzas', 'personales',
]);

/** «bisa-seguros-y-reaseguros-s-a» → «BISA»; «seguros-illimani-s-a-…» → «ILLIMANI». */
function codigoDeAseguradora(slug: string): string {
  const palabras = slug.split('-').filter((palabra) => !PALABRAS_GENERICAS.has(palabra));
  return (palabras.slice(0, 2).join('-') || 'ASEG').toUpperCase();
}

/** Un importe redondeado a la decena, con dos decimales, como lo escribe la base. */
function aDecena(monto: number): string {
  return (Math.round(monto / 10) * 10).toFixed(2);
}

/**
 * **El catálogo de ejemplo de una aseguradora del directorio sin catálogo
 * sembrado** (29/09/2026).
 *
 * «En el directorio al ir a una aseguradora no cargan sus productos»: de las
 * 21 fichas del directorio, sólo Seguros Andina y La Vitalicia tenían planes;
 * las otras 19 —las reales de la planilla del propietario— abrían vacías, y el
 * mercado de seguros parecía no existir.
 *
 * Se arma de la ficha, siempre igual para el mismo slug: ids con `uuid()`,
 * código de la aseguradora sacado del slug y primas que dependen de él. Quien
 * cubre salud ofrece tres planes de salud; una compañía de seguros generales y
 * fianzas —que según la planilla no cubre salud— ofrece accidentes personales,
 * que es lo que esas compañías le venden a una persona. **Son planes de ejemplo**, como el resto de la maqueta:
 * los nombres son genéricos a propósito para no atribuirle a una compañía real
 * un producto que no tiene, y no lleva canales de contacto ni matrícula del
 * regulador por lo mismo.
 */
function aseguradoraDeLaFicha(ficha: VitrinaSimulada): AseguradoraDelCatalogo {
  const real = aseguradoraRealDe(ficha);
  const cubreSalud = real?.coversHealth ?? ficha.categoria?.code !== 'seguros-generales';
  const codigo = codigoDeAseguradora(ficha.slug);
  // La prima base se mueve de a 15 Bs entre compañías: comparar dos
  // aseguradoras con los mismos precios al centavo no enseñaría nada.
  const paso = semilla(`prima-${ficha.slug}`) % 7;
  const planes: readonly (readonly [string, string, number])[] = cubreSalud
    ? [
        [`${codigo}-SALUD-PLUS`, 'Plan Salud Plus', (240 + paso * 15) * 1.8],
        [`${codigo}-SALUD-ESENCIAL`, 'Plan Salud Esencial', 240 + paso * 15],
        [`${codigo}-SALUD-FAMILIAR`, 'Plan Familiar', (240 + paso * 15) * 2.6],
      ]
    : [
        [`${codigo}-AP-PLUS`, 'Accidentes Personales Plus', 90 + paso * 5],
        [`${codigo}-AP-INDIVIDUAL`, 'Accidentes Personales Individual', 50 + paso * 5],
      ];
  return {
    id: uuid(`carrier-${ficha.slug}`),
    carrierCode: codigo,
    legalName: real?.name ?? ficha.displayName,
    name: ficha.displayName,
    regulatorIdentifier: null,
    isPublic: false,
    whatsapp: null,
    callCenter: null,
    supportEmail: null,
    fichas: [ficha.slug],
    ramo: cubreSalud ? 'SALUD' : 'ACCIDENTES',
    planes: planes.map(([code, name]) => [code, name]),
    primas: Object.fromEntries(planes.map(([code, , prima]) => [code, aDecena(prima)])),
  };
}

/**
 * Los brokers de una aseguradora del catálogo, con el slug de su chat.
 *
 * Una armada para su ficha no figura en `carriers` de ningún corredor, así
 * que se le asigna uno, siempre el mismo para el mismo slug. Sólo entre los
 * independientes: «Andina Corredores» trabaja sólo con Seguros Andina, y
 * ofrecerlo en la ficha de otra aseguradora sería contradecir su tarjeta.
 */
function brokersDelMercado(indice: number, slug: string) {
  const conChat = (corredor: (typeof CORREDORES)[number]) => ({
    ...resumenDeCorredor(corredor, CORREDORES.indexOf(corredor)),
    chatSlug:
      CORREDORES_CON_PERFIL.find((p) => p.brokerCode === corredor.brokerCode)?.slug ?? null,
  });
  if (indice >= 0) {
    return CORREDORES.filter((corredor) => corredor.carriers.includes(indice)).map(conChat);
  }
  const independientes = CORREDORES.filter((corredor) => corredor.independent);
  return [conChat(independientes[semilla(`broker-${slug}`) % independientes.length]!)];
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

  // La ficha del profesional: con qué aseguradoras trabaja (su red y planes).
  router.get('/practitioners/:id/insurance-carriers', ({ params }) => {
    const practitioner = profesionalPorId(params['id']!);
    if (practitioner === undefined) return notFound('Profesional no encontrado');
    return { items: carriersOfPractitioner(practitioner.insurerNetworks ?? []) };
  });

  router.get('/practitioners/:id/insurance-networks', ({ params }) => {
    const items = redesDelProfesional(params['id']!);
    return { items, count: items.length };
  });

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

  // La vitrina de una aseguradora para el paciente (P48): se busca por el slug
  // de su ficha pública, que es lo que trae el directorio. Lee el MISMO
  // catálogo que administra la aseguradora —lo que ella corrige en su consola
  // es lo que ve el paciente— y, si no lo administró todavía, el sembrado.
  // Una ficha sin catálogo sembrado recibe el de ejemplo: ninguna tarjeta del
  // directorio abre una página sin productos.
  router.get('/insurance-marketplace/insurers/:slug', ({ params }) => {
    const ficha = vitrinas
      .todos()
      .find((vitrina) => vitrina.slug === params['slug'] && vitrina.kind === 'INSURER');
    if (ficha === undefined) return notFound('Aseguradora no encontrada');
    const indice = indiceDelCatalogo(ficha);
    const brokers = brokersDelMercado(indice, ficha.slug);
    if (indice < 0) {
      // Sin catálogo sembrado: el de ejemplo, armado de la ficha. El índice
      // sólo mueve la fecha de alta y el tamaño de la red.
      const sintetica = aseguradoraDeLaFicha(ficha);
      const carrier = detalleDeAseguradora(sintetica, semilla(ficha.slug) % 10);
      return { carrier: { ...carrier, canAdminister: false }, brokers };
    }
    const aseguradora = ASEGURADORAS[indice]!;
    const carrier =
      catalogoAdministrable.get(aseguradora.id) ?? detalleDeAseguradora(aseguradora, indice);
    return { carrier: { ...carrier, canAdminister: false }, brokers };
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
      service:
        datos.serviceConceptId === undefined ? null : servicioDeClausula(datos.serviceConceptId),
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
  /* Editar y dar de baja un producto seguro: **sólo maqueta**. La API real no
     tiene todavía `PUT` ni `DELETE /insurance-plans/:planId`. */
  router.put('/insurance-plans/:planId', (request) => {
    if (!administraCatalogo(request)) return forbidden();
    const match = localizarPlan(request.params['planId']!);
    if (match === undefined) return notFound('Plan no encontrado');
    const datos = cuerpo<{
      planCode: string;
      name: string;
      effectiveFrom: string | null;
      effectiveTo: string | null;
    }>(request);
    const plans = match.product.plans.map((plan) =>
      plan.id === match.plan.id
        ? {
            ...plan,
            planCode: datos.planCode ?? plan.planCode,
            name: datos.name ?? plan.name,
            effectiveFrom: datos.effectiveFrom ?? null,
            effectiveTo: datos.effectiveTo ?? null,
          }
        : plan,
    );
    actualizarProducto(match.carrier, match.product, { plans });
    return { ok: true };
  });

  router.delete('/insurance-plans/:planId', (request) => {
    if (!administraCatalogo(request)) return forbidden();
    const match = localizarPlan(request.params['planId']!);
    if (match === undefined) return notFound('Plan no encontrado');
    actualizarProducto(match.carrier, match.product, {
      plans: match.product.plans.filter((plan) => plan.id !== match.plan.id),
    });
    return noContent();
  });

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
    const items = s.lineas.map((l, i) => ({
      id: uuid(`line-${s.id}-${i}`),
      linea: l,
    }));
    // El copago del paciente es SOLO lo que queda a su cargo en las líneas
    // APROBADAS (facturado − aprobado de esa línea). Una línea DENIED no le
    // agrega copago al paciente: su importe entero va a "rechazado". Sumar
    // `billed − approved` a nivel de cabecera (como antes) contaba el
    // rechazado dos veces — CLM-2026-0177 daba 150+150+120=420 sobre 300
    // facturados.
    const totalPatientAmount = s.lineas
      .filter((l) => l.decision === 'APPROVED')
      .reduce((t, l) => t + (Number(l.billed) - Number(l.approved ?? '0')), 0)
      .toFixed(2);
    const totalDeniedAmount = s.lineas
      .filter((l) => l.decision === 'DENIED')
      .reduce((t, l) => t + Number(l.billed), 0)
      .toFixed(2);
    // CA-3.3: una exclusión sin cláusula contractual nunca se publica como
    // liquidación firme.
    const exclusionSinClausula = s.lineas.some(
      (l) => l.decision === 'DENIED' && (l.clause === null || l.clause.trim() === ''),
    );
    const settlementAvailability = !adjudicada || s.eobPublishedAt === null
      ? 'PENDING_PUBLICATION'
      : exclusionSinClausula
        ? 'UNDER_REVIEW'
        : 'AVAILABLE';
    const settlement = {
      availability: settlementAvailability,
      totalBilledAmount: settlementAvailability === 'AVAILABLE' ? s.billed : null,
      totalApprovedAmount: settlementAvailability === 'AVAILABLE' ? s.approved : null,
      totalPatientAmount: settlementAvailability === 'AVAILABLE' ? totalPatientAmount : null,
      totalDeniedAmount: settlementAvailability === 'AVAILABLE' ? totalDeniedAmount : null,
      reconciled: settlementAvailability === 'AVAILABLE',
      exclusions:
        settlementAvailability === 'AVAILABLE'
          ? items
              .filter(({ linea }) => linea.decision === 'DENIED')
              .map(({ id, linea }) => ({
                claimLineId: id,
                itemName: linea.service,
                amount: linea.billed,
                policyClauseReference: linea.clause!,
                denialRationale: linea.rationale,
              }))
          : [],
    };
    const adjudicacion = adjudicada
      ? {
          id: uuid(`adj-${s.id}`),
          adjudicationVersion: s.adjudicationVersion ?? 1,
          outcome: s.status,
          dispositionText: s.dispositionText ?? (
            s.status.code === 'REJECTED'
              ? 'Prestación no cubierta por el plan contratado.'
              : s.status.code === 'PARTIAL'
                ? 'El electrocardiograma requiere autorización previa.'
                : 'Aprobada según tarifario vigente.'),
          totalApprovedAmount: money(s.approved!),
          totalPatientAmount: money(totalPatientAmount),
          totalDeniedAmount: money(totalDeniedAmount),
          adjudicatedAt: s.adjudicatedAt ?? iso(-1),
        }
      : null;
    return {
      header: itemDeSolicitud(s),
      lines: items.map(({ id, linea: l }, i) => ({
        id,
        lineSequence: i + 1,
        service: c(`SVC-${i}`, l.service),
        billedAmount: money(l.billed),
        patientResponsibilityAmount:
          l.approved === null ? null : money(l.decision === 'DENIED' ? '0.00' : (Number(l.billed) - Number(l.approved)).toFixed(2)),
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
      settlement,
      eob: adjudicada && s.eobPublishedAt !== null ? { id: uuid(`eob-${s.id}`), publishedAt: s.eobPublishedAt ?? iso(-1) } : null,
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

  router.post('/insurance-claims/:id/adjudications', (request) => {
    const claim = solicitudes.get(request.params['id']!);
    if (claim === undefined) return notFound('Solicitud no encontrada');
    const input = cuerpo<CreateAdjudicationInput>(request);
    if (input.outcome !== 'APPROVED' && input.outcome !== 'DENIED') {
      return validation('Dictamen inválido', [{ field: 'outcome', message: 'debe ser APPROVED o DENIED' }]);
    }
    if (!Array.isArray(input.lineAdjudications) || input.lineAdjudications.length !== claim.lineas.length) {
      return validation('Cada línea requiere dictamen', [{ field: 'lineAdjudications', message: 'cantidad incorrecta' }]);
    }

    const byId = new Map(input.lineAdjudications.map((line) => [line.insuranceClaimLineId, line]));
    if (byId.size !== claim.lineas.length) {
      return validation('Cada línea requiere un dictamen único', [{ field: 'lineAdjudications', message: 'línea duplicada' }]);
    }

    let approvedTotal = 0;
    let patientTotal = 0;
    let deniedTotal = 0;
    const lines: SolicitudSimulada['lineas'][number][] = [];
    for (const [index, current] of claim.lineas.entries()) {
      const line = byId.get(uuid(`line-${claim.id}-${index}`));
      if (line === undefined || (line.decision !== 'APPROVED' && line.decision !== 'DENIED')) {
        return validation('Línea de dictamen inválida', [{ field: 'lineAdjudications', message: 'id o decisión inválida' }]);
      }
      const approved = cents(line.approvedAmount);
      const patient = cents(line.patientAmount);
      const denied = cents(line.deniedAmount);
      const billed = cents(current.billed)!;
      if (approved === null || patient === null || denied === null || approved + patient + denied !== billed ||
        (line.decision === 'DENIED' && (approved !== 0 || patient !== 0)) ||
        (line.decision === 'APPROVED' && denied !== 0)) {
        return validation('Importes de línea inválidos', [{ field: 'lineAdjudications', message: 'los importes deben conciliar con lo facturado' }]);
      }
      approvedTotal += approved;
      patientTotal += patient;
      deniedTotal += denied;
      lines.push({
        ...current,
        approved: asAmount(approved),
        decision: line.decision,
        clause: line.decision === 'DENIED' ? line.policyClauseReference?.trim() || null : null,
        rationale: line.decision === 'DENIED' ? line.denialRationale?.trim() || null : null,
      });
    }
    if ((input.outcome === 'DENIED' && approvedTotal > 0) || (input.outcome === 'APPROVED' && approvedTotal === 0)) {
      return validation('Resultado incongruente con las líneas', [{ field: 'outcome', message: 'no coincide con los importes' }]);
    }
    const totals = [
      [input.totalApprovedAmount, approvedTotal],
      [input.totalPatientAmount, patientTotal],
      [input.totalDeniedAmount, deniedTotal],
    ] as const;
    if (totals.some(([declared, calculated]) => declared !== undefined && cents(declared) !== calculated)) {
      return validation('Totales incongruentes', [{ field: 'totalApprovedAmount', message: 'no coincide con las líneas' }]);
    }

    const nextVersion = (claim.adjudicationVersion ?? (claim.approved === null ? 0 : 1)) + 1;
    solicitudes.actualizar(claim.id, {
      approved: asAmount(approvedTotal),
      status: deniedTotal === 0 ? c('APPROVED', 'Aprobada') : approvedTotal === 0 ? c('REJECTED', 'Rechazada') : c('PARTIAL', 'Aprobada parcialmente'),
      lineas: lines,
      adjudicationVersion: nextVersion,
      dispositionText: input.dispositionText,
      adjudicatedAt: ahora(),
      eobPublishedAt: null,
    });
    return { status: 201, body: { id: uuid(`adj-${claim.id}-${nextVersion}`) } };
  });

  router.post('/insurance-claims/:id/eob', (request) => {
    const claim = solicitudes.get(request.params['id']!);
    if (claim === undefined) return notFound('Solicitud no encontrada');
    if (claim.approved === null) return preconditionFailed('Adjudicá la solicitud antes de publicar la EOB');
    if (claim.eobPublishedAt !== null) return conflict('La EOB ya fue publicada');
    solicitudes.actualizar(claim.id, { eobPublishedAt: ahora() });
    return { status: 201, body: { id: uuid(`eob-${claim.id}`) } };
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
