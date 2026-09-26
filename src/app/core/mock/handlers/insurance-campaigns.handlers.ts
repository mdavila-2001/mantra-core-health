import { pacientePorId } from '../fixtures/personas';
import {
  conflict,
  forbidden,
  notFound,
  reply,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
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
import { administraCatalogo, perteneceALaAseguradora } from './insurance.handlers';

/* ============================================================================
    Campañas preventivas de la aseguradora (Tarea 4 · M-06).

    Espejo del contrato `docs/contracts/insurer-preventive-campaigns.md` de la
    API, para que el front se comporte igual contra el simulador y contra el
    backend real:

    - la aseguradora administra las suyas y no ve las de otra;
    - el afiliado ve sólo las ACTIVAS, dentro de su vigencia y de SU aseguradora,
      y sólo pide con su propio perfil (403 si es el de otro);
    - la patología (CIE-10) describe la campaña, nunca filtra afiliados (D4).
    ========================================================================== */

type CampaignType = 'LABORATORY' | 'PHARMACY' | 'DIAGNOSTIC_IMAGING' | 'VACCINATION';
type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';
type PartnerRole = 'SPONSOR' | 'PROVIDER';
type PartnerType = 'IMPORTER' | 'MANUFACTURER' | 'LABORATORY' | 'PHARMACY' | 'MEDICAL_CENTER';

interface MockPartner {
  readonly id: string;
  readonly role: PartnerRole;
  readonly type: PartnerType;
  readonly name: string;
  readonly networkProviderMembershipId: string | null;
}

/** Lo que guarda el simulador: la forma de la API más la aseguradora dueña. */
interface MockCampaign {
  readonly id: string;
  /** El simulador identifica la aseguradora por nombre, como `personas.ts`. */
  readonly carrierName: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly campaignType: CampaignType;
  readonly status: CampaignStatus;
  readonly targetCondition: { readonly code: string; readonly display: string } | null;
  readonly copayBonusPercentage: number;
  readonly validFrom: string;
  readonly validTo: string;
  readonly activatedAt: string | null;
  readonly partners: readonly MockPartner[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

const TYPES: readonly CampaignType[] = [
  'LABORATORY',
  'PHARMACY',
  'DIAGNOSTIC_IMAGING',
  'VACCINATION',
];
const ROLES: readonly PartnerRole[] = ['SPONSOR', 'PROVIDER'];
const PARTNER_TYPES: readonly PartnerType[] = [
  'IMPORTER',
  'MANUFACTURER',
  'LABORATORY',
  'PHARMACY',
  'MEDICAL_CENTER',
];

/** Los mismos códigos y límites que valida la API. */
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,39}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Aseguradora de la sesión de aseguradora del simulador (`aseguradora@alovida.mock`). */
const INSURER_CARRIER = 'Seguros Andina';

/**
 * El catálogo CIE-10 que el simulador conoce. La API real rechaza (400) un
 * código que su catálogo no trae —`I10` está sembrado; `E11` sólo como `E11.9`—,
 * así que el simulador también.
 */
const ICD10: Readonly<Record<string, string>> = {
  I10: 'Hipertensión esencial (primaria)',
  'E11.9': 'Diabetes mellitus tipo 2 sin complicaciones',
  'C50.9': 'Neoplasia maligna de la mama, parte no especificada',
  'J06.9': 'Infección aguda de las vías respiratorias superiores',
  Z23: 'Necesidad de inmunización contra una sola enfermedad bacteriana',
};

const TRANSITIONS: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['PAUSED', 'EXPIRED'],
  PAUSED: ['ACTIVE', 'EXPIRED'],
  EXPIRED: [],
};

function partner(seed: string, role: PartnerRole, type: PartnerType, name: string): MockPartner {
  return {
    id: uuid(`campaign-partner-${seed}`),
    role,
    type,
    name,
    networkProviderMembershipId: null,
  };
}

function seedCampaigns(): readonly MockCampaign[] {
  const base = {
    description: null,
    activatedAt: null,
    createdAt: iso(-20),
    updatedAt: iso(-20),
  } as const;
  return [
    // La que pide el criterio CA-4.1/4.2: activa, 100 % bonificada, con dos aliados.
    {
      ...base,
      id: uuid('campaign-cmp-cardio-2026'),
      carrierName: INSURER_CARRIER,
      code: 'CMP-CARDIO-2026',
      title: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
      description:
        'Presión arterial, perfil lipídico y glicemia en ayunas, sin costo para vos. Detectar a tiempo evita internaciones.',
      campaignType: 'LABORATORY',
      status: 'ACTIVE',
      targetCondition: { code: 'I10', display: ICD10['I10']! },
      copayBonusPercentage: 100,
      validFrom: isoDia(0),
      validTo: isoDia(60),
      activatedAt: iso(-1),
      createdAt: iso(-1),
      updatedAt: iso(-1),
      partners: [
        partner('cardio-lab', 'PROVIDER', 'LABORATORY', 'Laboratorio Central AloVida'),
        partner('cardio-farm', 'PROVIDER', 'PHARMACY', 'Farmacias Aliadas'),
      ],
    },
    // CA-4.3: un borrador nunca llega al afiliado.
    {
      ...base,
      id: uuid('campaign-cmp-diabetes-2026'),
      carrierName: INSURER_CARRIER,
      code: 'CMP-DIABETES-2026',
      title: 'Despistaje de diabetes tipo 2',
      campaignType: 'LABORATORY',
      status: 'DRAFT',
      targetCondition: { code: 'E11.9', display: ICD10['E11.9']! },
      copayBonusPercentage: 80,
      validFrom: isoDia(0),
      validTo: isoDia(90),
      createdAt: iso(-3),
      updatedAt: iso(-3),
      partners: [partner('diabetes-lab', 'SPONSOR', 'MANUFACTURER', 'Laboratorios Bagó')],
    },
    // CA-4.3: pausada.
    {
      ...base,
      id: uuid('campaign-cmp-mama-2026'),
      carrierName: INSURER_CARRIER,
      code: 'CMP-MAMA-2026',
      title: 'Mamografía preventiva',
      campaignType: 'DIAGNOSTIC_IMAGING',
      status: 'PAUSED',
      targetCondition: { code: 'C50.9', display: ICD10['C50.9']! },
      copayBonusPercentage: 50,
      validFrom: isoDia(-10),
      validTo: isoDia(120),
      activatedAt: iso(-10),
      createdAt: iso(-10),
      updatedAt: iso(-5),
      partners: [
        partner('mama-centro', 'PROVIDER', 'MEDICAL_CENTER', 'Centro de Diagnóstico Andino'),
      ],
    },
    // CA-4.3: sigue ACTIVA pero su vigencia terminó; el vencimiento lo manda la fecha.
    {
      ...base,
      id: uuid('campaign-cmp-flu-2025'),
      carrierName: INSURER_CARRIER,
      code: 'CMP-FLU-2025',
      title: 'Vacunación antigripal',
      campaignType: 'VACCINATION',
      status: 'ACTIVE',
      targetCondition: { code: 'J06.9', display: ICD10['J06.9']! },
      copayBonusPercentage: 100,
      validFrom: isoDia(-70),
      validTo: isoDia(-10),
      activatedAt: iso(-70),
      createdAt: iso(-70),
      updatedAt: iso(-70),
      partners: [partner('flu-farm', 'PROVIDER', 'PHARMACY', 'Farmacias Aliadas')],
    },
    // CA-4.4: de OTRA aseguradora; ni la consola de Seguros Andina ni sus afiliados la ven.
    {
      ...base,
      id: uuid('campaign-cmp-vitalicia-osteo'),
      carrierName: 'La Vitalicia',
      code: 'CMP-VITALICIA-OSTEO',
      title: 'Densitometría ósea preventiva',
      campaignType: 'DIAGNOSTIC_IMAGING',
      status: 'ACTIVE',
      targetCondition: null,
      copayBonusPercentage: 70,
      validFrom: isoDia(-5),
      validTo: isoDia(50),
      activatedAt: iso(-5),
      createdAt: iso(-5),
      updatedAt: iso(-5),
      partners: [
        partner('vitalicia-centro', 'PROVIDER', 'MEDICAL_CENTER', 'Centro Médico Vitalicia'),
      ],
    },
  ];
}

const campaigns = new Coleccion<MockCampaign>(seedCampaigns(), 'mock-insurance-campaigns');

function isPlatform(request: MockRequest): boolean {
  const roles = request.user?.roles ?? [];
  return roles.includes('SECURITY_ADMIN') || roles.includes('SUPERADMIN');
}

/** Sin la aseguradora propia y sin `carrierName`: es lo que ve quien la administra. */
function toAdminView(campaign: MockCampaign) {
  const { carrierName: _carrierName, ...view } = campaign;
  return view;
}

/**
 * Lo que ve el afiliado: se arma campo por campo para que un dato nuevo del
 * simulador no llegue a su pantalla por descuido (ni id de aseguradora, ni
 * estado, ni ids de aliado).
 */
function toPatientView(campaign: MockCampaign) {
  return {
    id: campaign.id,
    code: campaign.code,
    title: campaign.title,
    description: campaign.description,
    campaignType: campaign.campaignType,
    targetCondition: campaign.targetCondition,
    copayBonusPercentage: campaign.copayBonusPercentage,
    validFrom: campaign.validFrom,
    validTo: campaign.validTo,
    carrierName: campaign.carrierName,
    partners: campaign.partners.map(({ role, type, name }) => ({ role, type, name })),
  };
}

interface CreateBody {
  code: string;
  title: string;
  description: string;
  campaignType: CampaignType;
  targetConditionCode: string;
  copayBonusPercentage: number;
  validFrom: string;
  validTo: string;
  partners: { role: PartnerRole; type: PartnerType; name: string }[];
  activate: boolean;
}

/** Primer problema de la entrada, con el mismo criterio que los DTO de la API. */
function problemWith(body: Partial<CreateBody>): string | null {
  if (typeof body.code !== 'string' || !CODE_PATTERN.test(body.code)) {
    return 'El código debe tener de 3 a 40 caracteres: mayúsculas, dígitos y guiones';
  }
  if (typeof body.title !== 'string' || body.title.trim().length < 3 || body.title.length > 200) {
    return 'El título debe tener de 3 a 200 caracteres';
  }
  if (!TYPES.includes(body.campaignType as CampaignType)) {
    return 'El tipo de campaña no es válido';
  }
  const bonus = body.copayBonusPercentage;
  if (typeof bonus !== 'number' || !Number.isFinite(bonus) || bonus < 0 || bonus > 100) {
    return 'El porcentaje de copago bonificado debe estar entre 0 y 100';
  }
  if (Math.abs(bonus * 100 - Math.round(bonus * 100)) > 1e-6) {
    return 'El porcentaje admite hasta dos decimales';
  }
  if (typeof body.validFrom !== 'string' || !DATE_ONLY.test(body.validFrom)) {
    return 'validFrom debe ser AAAA-MM-DD';
  }
  if (typeof body.validTo !== 'string' || !DATE_ONLY.test(body.validTo)) {
    return 'validTo debe ser AAAA-MM-DD';
  }
  if (body.validTo < body.validFrom) {
    return 'validTo debe ser igual o posterior a validFrom';
  }
  const partners = body.partners;
  if (!Array.isArray(partners) || partners.length < 1 || partners.length > 20) {
    return 'La campaña necesita entre 1 y 20 aliados';
  }
  for (const item of partners) {
    if (
      !ROLES.includes(item?.role) ||
      !PARTNER_TYPES.includes(item?.type) ||
      typeof item?.name !== 'string' ||
      item.name.trim().length < 2
    ) {
      return 'Cada aliado necesita rol, tipo y nombre';
    }
  }
  return null;
}

/** El estado de una transición fuera de la tabla o de una campaña vencida es 422, como en la API. */
function preconditionFailed(message: string, details: unknown = {}) {
  return reply(422, {
    statusCode: 422,
    code: 'PRECONDITION_FAILED',
    message,
    error: 'Unprocessable Entity',
    details,
  });
}

export function registerInsuranceCampaigns(router: MockRouter): void {
  /** Campañas de la aseguradora activa, o `null` si quien pide no pertenece a una. */
  const ownCampaigns = (request: MockRequest): MockCampaign[] | null =>
    perteneceALaAseguradora(request)
      ? campaigns.filtrar((campaign) => campaign.carrierName === INSURER_CARRIER)
      : null;

  router.get('/insurance-campaigns', (request) => {
    const own = ownCampaigns(request);
    if (own === null) return forbidden('La organización activa no es una aseguradora');

    const type = texto(request.query, 'type');
    const status = texto(request.query, 'status');
    const filtered = own
      .filter((campaign) => type === null || campaign.campaignType === type)
      .filter((campaign) => status === null || campaign.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

    const page = paginar(filtered.map(toAdminView), request.query, 25);
    return { items: page.items, nextCursor: page.nextCursor };
  });

  router.post('/insurance-campaigns', (request) => {
    if (!perteneceALaAseguradora(request) || !administraCatalogo(request)) {
      return forbidden(
        'Se requiere ser OWNER o ADMIN de la organización, o administrador de la plataforma',
      );
    }
    const body = cuerpo<CreateBody>(request);
    const problem = problemWith(body);
    if (problem !== null) return validation(problem);

    const code = body.code!;
    if (campaigns.filtrar((c) => c.carrierName === INSURER_CARRIER && c.code === code).length > 0) {
      return conflict('Ya existe una campaña con ese código en la aseguradora', { code });
    }

    let targetCondition: MockCampaign['targetCondition'] = null;
    const requestedCode = body.targetConditionCode?.trim().toUpperCase();
    if (requestedCode) {
      const display = ICD10[requestedCode];
      if (display === undefined) {
        return validation(`El código CIE-10 ${requestedCode} no está en el catálogo`);
      }
      targetCondition = { code: requestedCode, display };
    }

    const activate = body.activate === true;
    if (activate && body.validTo! < isoDia(0)) {
      return validation('No se puede activar una campaña cuya vigencia ya terminó');
    }

    const now = ahora();
    const created = campaigns.agregar({
      id: nuevoId('campaign'),
      carrierName: INSURER_CARRIER,
      code,
      title: body.title!.trim(),
      description: body.description?.trim() || null,
      campaignType: body.campaignType!,
      status: activate ? 'ACTIVE' : 'DRAFT',
      targetCondition,
      copayBonusPercentage: body.copayBonusPercentage!,
      validFrom: body.validFrom!,
      validTo: body.validTo!,
      activatedAt: activate ? now : null,
      partners: body.partners!.map((item, index) => ({
        id: nuevoId(`campaign-partner-${index}`),
        role: item.role,
        type: item.type,
        name: item.name.trim(),
        networkProviderMembershipId: null,
      })),
      createdAt: now,
      updatedAt: now,
    });
    return reply(201, toAdminView(created));
  });

  // Antes que `/:id`: `patient` no es un identificador.
  router.get('/insurance-campaigns/patient/:patientProfileId', (request) => {
    const profileId = request.params['patientProfileId']!;
    // Titularidad contra la sesión. Un perfil ajeno es 403, no una lista vacía:
    // así el intento se distingue de «no tenés campañas».
    if (request.user?.patientProfileId !== profileId && !isPlatform(request)) {
      return forbidden('Sólo el titular del perfil puede ver sus campañas');
    }

    const carrierName = pacientePorId(profileId)?.aseguradora;
    if (carrierName === undefined) return [];

    const today = isoDia(0);
    return campaigns
      .filtrar(
        (campaign) =>
          campaign.carrierName === carrierName &&
          campaign.status === 'ACTIVE' &&
          campaign.validFrom <= today &&
          campaign.validTo >= today,
      )
      .sort((a, b) => a.validTo.localeCompare(b.validTo))
      .map(toPatientView);
  });

  router.get('/insurance-campaigns/:id', (request) => {
    const own = ownCampaigns(request);
    if (own === null) return forbidden('La organización activa no es una aseguradora');
    const found = own.find((campaign) => campaign.id === request.params['id']);
    return found === undefined ? notFound('Campaña no encontrada') : toAdminView(found);
  });

  router.patch('/insurance-campaigns/:id/status', (request) => {
    if (!perteneceALaAseguradora(request) || !administraCatalogo(request)) {
      return forbidden(
        'Se requiere ser OWNER o ADMIN de la organización, o administrador de la plataforma',
      );
    }
    // Acotada a la aseguradora: la de otra responde igual que una inexistente.
    const current = ownCampaigns(request)?.find((campaign) => campaign.id === request.params['id']);
    if (current === undefined) return notFound('Campaña no encontrada');

    const target = cuerpo<{ status: CampaignStatus }>(request).status;
    if (target !== 'ACTIVE' && target !== 'PAUSED' && target !== 'EXPIRED') {
      return validation('El estado destino debe ser ACTIVE, PAUSED o EXPIRED');
    }
    // Repetir el estado actual es idempotente.
    if (current.status === target) return toAdminView(current);

    if (!TRANSITIONS[current.status].includes(target)) {
      return preconditionFailed(
        `Una campaña en estado ${current.status} no puede pasar a ${target}`,
        {
          from: current.status,
          to: target,
        },
      );
    }
    if (target === 'ACTIVE' && current.validTo < isoDia(0)) {
      return preconditionFailed('La campaña ya venció: no se puede activar', {
        validTo: current.validTo,
      });
    }

    const now = ahora();
    const updated = campaigns.actualizar(current.id, {
      status: target,
      activatedAt: target === 'ACTIVE' ? (current.activatedAt ?? now) : current.activatedAt,
      updatedAt: now,
    });
    return toAdminView(updated ?? current);
  });
}
