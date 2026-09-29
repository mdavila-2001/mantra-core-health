/**
 * Tipos de la vista para `insurance` (módulo 26): el catálogo de la aseguradora
 * y sus brokers. **No son los DTOs de la API**: las fechas ya son `Date` y los
 * nulos del transporte se normalizan en el cliente, como manda `wire.ts`.
 */

/**
 * Un concepto del catálogo, ya resuelto por el servidor.
 *
 * Llega con código y etiqueta porque un `conceptId` no se puede pintar. El
 * `code` es lo estable —lo que una pantalla puede condicionar—; el `display` es
 * lo que se muestra.
 */
export interface InsuranceConcept {
  readonly code: string;
  readonly display: string;
}

/**
 * Una aseguradora con el volumen de su catálogo
 * (`GET /insurance-carriers`).
 *
 * Los recuentos vienen del servidor: son lo que permite distinguir una
 * aseguradora con catálogo publicado de una recién dada de alta sin pedir tres
 * listados más.
 */
export interface CarrierSummary {
  readonly id: string;
  readonly carrierCode: string;
  readonly legalName: string;
  readonly regulatorIdentifier: string | null;
  /**
   * Canales de contacto directo de la aseguradora (subtarea 2.3): WhatsApp
   * (E.164), teléfono/línea gratuita del call center y correo de
   * siniestros. `null` cuando la aseguradora no publicó ese canal.
   */
  readonly whatsappNumber: string | null;
  readonly callCenterPhone: string | null;
  readonly supportEmail: string | null;
  readonly jurisdiction: InsuranceConcept | null;
  readonly status: InsuranceConcept;
  /**
   * Estado de verificación, sin colapsar a un booleano: «declarada» y
   * «verificada» son cosas distintas y la pantalla tiene que poder decirlo.
   */
  readonly verification: InsuranceConcept;
  readonly productCount: number;
  readonly planCount: number;
  readonly networkCount: number;
  readonly createdAt: Date;
  /** Decisión de la API basada en la membresía activa del tenant. */
  readonly canAdminister: boolean;
}

/** Respuesta del listado. No pagina: hay una aseguradora por organización. */
export interface CarrierDirectory {
  readonly items: readonly CarrierSummary[];
  readonly count: number;
}

/** Un beneficio de un plan, con sus topes económicos. */
export interface PlanBenefit {
  readonly id: string;
  readonly category: InsuranceConcept;
  readonly service: InsuranceConcept | null;
  /**
   * Importes y porcentaje viajan como texto y **se conservan como texto**: las
   * columnas son `numeric` y pasarlas por `Number` perdería los decimales que
   * definen una cobertura.
   */
  readonly coveragePercent: string | null;
  readonly copayAmount: string | null;
  readonly deductibleAmount: string | null;
  readonly annualLimitAmount: string | null;
  readonly requiresPriorAuthorization: boolean | null;
  readonly approvalRules: BenefitApprovalRules;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
}

export const APPROVAL_DOCUMENT_CODES = [
  'FIRMA_MEDICO',
  'SELLO_MEDICO',
  'ORDEN_MEDICA',
  'INFORME_CLINICO',
] as const;

export type ApprovalDocumentCode = (typeof APPROVAL_DOCUMENT_CODES)[number];

export interface BenefitApprovalRules {
  readonly requiredDocuments: readonly ApprovalDocumentCode[];
  readonly exclusionNotes: string | null;
}

export interface CreateInsurancePlanInput {
  readonly planCode: string;
  readonly name: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly currencyConceptId?: string;
  /** Prima de lista mensual del plan, en la moneda del plan (v4.2.14). */
  readonly monthlyPremiumAmount?: string;
}

/**
 * Datos generales de un producto seguro (un plan) que se pueden corregir.
 *
 * Reemplazo completo: una vigencia en `null` se quita, no se conserva. La
 * moneda y la prima quedan afuera a propósito —la prima tiene su propio
 * endpoint y cambiar la moneda reinterpretaría todos los importes de sus
 * cláusulas—.
 *
 * **Contrato pendiente en la API**: `PUT /insurance-plans/:planId` hoy existe
 * sólo en la maqueta de `mockup`.
 */
export interface UpdateInsurancePlanInput {
  readonly planCode: string;
  readonly name: string;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
}

/** Reemplazo completo de la prima de lista mensual de un plan (v4.2.14). */
export interface UpdatePlanPremiumInput {
  readonly monthlyPremiumAmount: string | null;
}

export interface CreatePlanBenefitInput {
  readonly benefitCategoryConceptId: string;
  readonly serviceConceptId?: string;
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
  readonly coveragePercent?: string;
  readonly copayAmount?: string;
  readonly deductibleAmount?: string;
  readonly annualLimitAmount?: string;
  readonly requiresPriorAuthorization?: boolean;
}

export interface UpdatePlanBenefitInput {
  readonly coveragePercent: string | null;
  readonly copayAmount: string | null;
  readonly deductibleAmount: string | null;
  readonly annualLimitAmount: string | null;
}

export interface UpdatePlanBenefitRulesInput extends BenefitApprovalRules {
  readonly requiresPriorAuthorization: boolean;
}

/** Un plan del producto, con sus beneficios vigentes. */
export interface Plan {
  readonly id: string;
  readonly planCode: string;
  readonly name: string;
  readonly planType: InsuranceConcept | null;
  readonly currency: InsuranceConcept | null;
  /**
   * Prima de lista mensual del plan, en su moneda (v4.2.14). `null` cuando la
   * aseguradora no la declaró — es el denominador del loss ratio del tablero
   * de siniestralidad.
   */
  readonly monthlyPremiumAmount: string | null;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
  readonly status: InsuranceConcept;
  /**
   * Condicionado contratado. Es un identificador y no un enlace: la descarga
   * pasa por el módulo de archivos, que aplica su propio control de acceso.
   */
  readonly policyDocumentFileId: string | null;
  readonly benefits: readonly PlanBenefit[];
}

/** Un producto de aseguramiento, con sus planes. */
export interface Product {
  readonly id: string;
  readonly productCode: string;
  readonly name: string;
  readonly productType: InsuranceConcept;
  readonly marketSegment: InsuranceConcept | null;
  readonly status: InsuranceConcept;
  readonly plans: readonly Plan[];
}

/** Una red de prestadores de la aseguradora. */
export interface ProviderNetwork {
  readonly id: string;
  readonly networkCode: string;
  readonly name: string;
  readonly networkType: InsuranceConcept | null;
  readonly status: InsuranceConcept;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
  readonly memberCount: number;
}

/**
 * Una red de la aseguradora en la que atiende un profesional.
 *
 * Las aseguradoras bolivianas publican su red **por plan** («AFI GOLD»,
 * «SALUD FLEXIBLE»), así que el nombre de la red es el del plan que la
 * persona tiene en su carnet.
 */
export interface PractitionerNetwork {
  readonly id: string;
  readonly name: string;
}

/**
 * Una aseguradora con la que trabaja un profesional, con sus redes.
 *
 * Sale de `insurance.network_provider_memberships` activas del profesional,
 * agrupadas por la aseguradora dueña de cada red (`provider_networks →
 * insurance_carriers`). Es la aseguradora la que da de alta al prestador en
 * su red (UC-26-01): el profesional no lo declara de sí mismo.
 */
export interface PractitionerInsuranceCarrier {
  readonly carrierId: string;
  readonly carrierName: string;
  readonly networks: readonly PractitionerNetwork[];
}

/**
 * Una aseguradora con la que trabaja un profesional: su membresía vigente en
 * una red de prestadores (`insurance.network_provider_memberships`).
 *
 * La carga la aseguradora al firmar el convenio, no el profesional, así que es
 * de sólo lectura para él. `effectiveTo` nulo es «sin fecha de fin».
 */
export interface PractitionerInsuranceNetwork {
  readonly membershipId: string;
  readonly carrierId: string;
  readonly carrierName: string;
  readonly networkName: string;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
}

/** `GET /practitioners/:id/insurance-networks`. */
export interface PractitionerInsuranceNetworkPage {
  readonly items: readonly PractitionerInsuranceNetwork[];
  readonly count: number;
}

/** Ficha de la aseguradora (`GET /insurance-carriers/:id`). */
export interface CarrierDetail extends CarrierSummary {
  readonly products: readonly Product[];
  readonly networks: readonly ProviderNetwork[];
}

/* ---- mercado de seguros para el paciente ---------------------------------
   Lo que un paciente puede leer de una aseguradora antes de contratarla: sus
   productos con planes, cláusulas y coberturas, y los brokers con los que
   puede hablar. El catálogo comercial completo (`GET /insurance-carriers/:id`)
   sólo lo lee la propia aseguradora; esto es la vitrina.

   **Contrato pendiente en la API** (P48 de `PENDIENTES-BACKEND.md`): hoy
   existe sólo en la maqueta de `mockup`. */

/** Un broker que vende productos de la aseguradora, con cómo escribirle. */
export interface MarketplaceBroker {
  readonly id: string;
  readonly brokerCode: string;
  readonly legalName: string;
  readonly licenseNumber: string | null;
  readonly verification: InsuranceConcept;
  /** Corredor independiente (varias aseguradoras) o de la casa. */
  readonly independent: boolean;
  /**
   * El slug de su perfil público: lo que abre el chat
   * (`/messaging?escribirA=<slug>`). `null` si todavía no tiene perfil, y
   * entonces no se ofrece el botón.
   */
  readonly chatSlug: string | null;
}

/** La vitrina de una aseguradora (`GET /insurance-marketplace/insurers/:slug`). */
export interface InsurerMarketplace {
  /**
   * Productos, planes y cláusulas. `null` cuando la aseguradora tiene ficha
   * pública pero todavía no publicó su catálogo: se dice así, no como error.
   */
  readonly carrier: CarrierDetail | null;
  readonly brokers: readonly MarketplaceBroker[];
}

/** Un vínculo del broker con una aseguradora. */
export interface BrokerAgreement {
  readonly id: string;
  readonly insuranceCarrierId: string;
  readonly carrierLegalName: string;
  readonly agreementCode: string;
  readonly commissionModel: InsuranceConcept | null;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
  readonly status: InsuranceConcept;
  /**
   * Si el acuerdo está vigente hoy. **Lo calcula el servidor**, no la pantalla:
   * de esto depende que un broker no pueda presentarse como representante de
   * una aseguradora con la vinculación vencida.
   */
  readonly current: boolean;
  readonly contractFileId: string | null;
}

/** Un broker del tenant activo (`GET /insurance-brokers`). */
export interface BrokerSummary {
  readonly id: string;
  readonly brokerCode: string;
  readonly legalName: string;
  readonly licenseNumber: string | null;
  readonly jurisdiction: InsuranceConcept | null;
  readonly status: InsuranceConcept;
  readonly verification: InsuranceConcept;
  /** Derivado de los acuerdos vigentes, no de un campo declarativo. */
  readonly independent: boolean;
  readonly currentCarrierCount: number;
  readonly createdAt: Date;
}

/** Respuesta del listado de brokers. */
export interface BrokerDirectory {
  readonly items: readonly BrokerSummary[];
  readonly count: number;
}

/**
 * Perfil del broker (`GET /insurance-brokers/:id`).
 *
 * Incluye el histórico completo de vinculaciones —es un requisito explícito de
 * la especificación— con la marca de cuáles siguen vigentes. La cartera **no**
 * viene acá: es otra lectura, para que ver un perfil no arrastre la lista de
 * asegurados.
 */
export interface BrokerProfile extends BrokerSummary {
  readonly agreements: readonly BrokerAgreement[];
  readonly publicProfileId: string | null;
}

/**
 * Una relación broker–cliente (`GET /insurance-brokers/:id/clients`).
 *
 * Sólo la relación comercial. La API no sirve un solo campo clínico por esta
 * ruta, y este tipo no tiene dónde ponerlo: el broker no puede acceder al
 * historial médico del asegurado.
 */
export interface BrokerClient {
  readonly id: string;
  /** Referencia al perfil del asegurado, no su expediente. */
  readonly patientProfileId: string | null;
  readonly employerGroupId: string | null;
  readonly clientType: InsuranceConcept;
  readonly assignedBrokerUserId: string | null;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
  readonly status: InsuranceConcept;
}

/** Cartera comercial de un broker. */
export interface BrokerPortfolio {
  readonly items: readonly BrokerClient[];
  readonly count: number;
}

/** Un plan de salud tal como lo elige quien se registra. */
export interface CarrierCatalogPlan {
  readonly id: string;
  /** `BASE` es el plan comodín: la opción «no sé cuál tengo». */
  readonly code: string;
  readonly name: string;
}

/**
 * Una aseguradora del catálogo público, con sus planes de salud.
 *
 * Es un contrato distinto del de {@link CarrierSummary}: aquél lista las
 * aseguradoras del tenant activo y éste el catálogo boliviano completo, que se
 * consulta sin haber iniciado sesión.
 */
export interface CarrierCatalogEntry {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly legalName: string;
  /** Si es un seguro público o de la seguridad social (CNS, CPS, SUS…). */
  readonly isPublic: boolean;
  readonly plans: readonly CarrierCatalogPlan[];
}

/* ---- solicitudes de seguro presentadas (TAREA-16) -------------------------
   Los importes se quedan como **cadena decimal** de punta a punta. No se
   convierten a `number` en la frontera, y no es un descuido: el criterio
   AC-16-6 exige que el total de la tabla de ítems coincida con el declarado en
   la fila **carácter por carácter**, y `Number('1250.00')` ya perdió la forma
   con la que se va a comparar. La pantalla los formatea para mostrarlos; nunca
   los suma. */

/** Un importe con la moneda en la que se expresó. */
export interface Money {
  /** Importe como cadena decimal, tal cual lo devolvió el servidor. */
  readonly amount: string;
  /** Moneda del importe. `null` si la solicitud no la declaró. */
  readonly currency: InsuranceConcept | null;
}

/** El paciente de una solicitud, con lo mínimo para nombrarlo. */
export interface ClaimPatient {
  readonly id: string;
  /** Nombre visible, o `null` si la persona no tiene uno registrado. */
  readonly displayName: string | null;
  readonly patientCode: string | null;
  readonly memberIdentifier: string | null;
}

/**
 * Una fila del listado de solicitudes.
 *
 * `policyBrokerName` es el corredor de la **póliza**, no el «broker
 * responsable de la solicitud» que pide la bitácora: ese dato no tiene columna
 * en `insurance_claims` todavía (TAREA-16 §5.2). La pantalla lo rotula por lo
 * que es.
 */
export interface ClaimListItem {
  readonly id: string;
  readonly claimIdentifier: string;
  readonly patient: ClaimPatient;
  readonly carrierName: string;
  readonly insuranceCarrierId: string;
  /**
   * Canales de contacto directo de la aseguradora (subtarea 2.3). Viajan en
   * la cabecera de la solicitud porque el detalle **es** la fila. `null`
   * cuando la aseguradora no publicó ese canal.
   */
  readonly carrierWhatsappNumber: string | null;
  readonly carrierCallCenterPhone: string | null;
  readonly carrierSupportEmail: string | null;
  readonly policyIdentifier: string | null;
  readonly policyBrokerName: string | null;
  readonly billedTotal: Money;
  /** `null` mientras no haya dictamen. **No es cero.** */
  readonly approvedTotal: Money | null;
  readonly submittedAt: Date | null;
  readonly status: InsuranceConcept | null;
  readonly hasOpenDispute: boolean;
}

/** Página del listado, paginada por cursor opaco. */
export interface ClaimPage {
  readonly items: readonly ClaimListItem[];
  /** Se reenvía tal cual; no se interpreta. */
  readonly nextCursor: string | null;
}

/** Filtros y paginación del listado. */
export interface ClaimQuery {
  readonly statusConceptId?: string;
  readonly insuranceCarrierId?: string;
  readonly submittedFrom?: string;
  readonly submittedTo?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Qué documento clínico respalda un ítem, cuando el modelo lo sabe. */
export type ClaimLineReferenceType = 'DIAGNOSTIC_STUDY' | 'MEDICATION_DISPENSATION';

/**
 * El estudio duplicado que originó la orden de esta línea (antiduplicación,
 * subtarea 3.2). Nunca incluye el informe: fecha, prestador, estudio y la
 * justificación del médico, si la hay.
 */
export interface ClaimLineDuplicateStudy {
  readonly previousDiagnosticReportId: string;
  readonly studyName: string;
  readonly performedAt: Date;
  /** Días entre el estudio previo y ESTA orden, no contra hoy. */
  readonly daysAgo: number;
  readonly providerName: string;
  /** `null` cuando la orden reutilizó el informe (sin justificación). */
  readonly justification: string | null;
  /** Si la orden nació satisfecha por el informe previo (no facturable). */
  readonly reused: boolean;
}

/** Un ítem de la solicitud, con su dictamen si lo tiene. */
export interface ClaimLine {
  readonly id: string;
  readonly lineSequence: number;
  readonly service: InsuranceConcept | null;
  readonly billedAmount: Money;
  readonly patientResponsibilityAmount: Money | null;
  /** `null` si este ítem todavía no fue dictaminado. */
  readonly approvedAmount: Money | null;
  readonly deniedAmount: Money | null;
  readonly decision: InsuranceConcept | null;
  readonly denialReason: InsuranceConcept | null;
  /**
   * Cita textual de la cláusula contractual que fundamenta el rechazo (subtarea 2.2).
   * `null` mientras el ítem no tenga dictamen, o si el dictamen es anterior a v4.2.9.
   */
  readonly policyClauseReference: string | null;
  /** Justificación circunstanciada del rechazo, por ítem. Mismas condiciones de `null`. */
  readonly denialRationale: string | null;
  /** `null` cuando el origen es una referencia de texto libre. */
  readonly referenceType: ClaimLineReferenceType | null;
  readonly reference: string | null;
  /** `null` salvo que la orden de origen esté enlazada a un informe previo. */
  readonly duplicateStudy: ClaimLineDuplicateStudy | null;
}

/** Una versión del dictamen. Las versiones no se editan: se suceden. */
export interface ClaimAdjudication {
  readonly id: string;
  readonly adjudicationVersion: number;
  readonly outcome: InsuranceConcept | null;
  readonly dispositionText: string | null;
  readonly totalApprovedAmount: Money | null;
  readonly totalPatientAmount: Money | null;
  readonly totalDeniedAmount: Money | null;
  readonly adjudicatedAt: Date;
}

/** Una disputa presentada sobre la solicitud. */
export interface ClaimDispute {
  readonly id: string;
  readonly disputeType: InsuranceConcept | null;
  readonly disputeReason: InsuranceConcept | null;
  readonly status: InsuranceConcept | null;
  readonly submittedAt: Date | null;
  /** Fecha límite de presentación: es un día, no un instante. */
  readonly filingDeadline: Date | null;
}

/** El detalle completo de una solicitud. */
export interface ClaimDetail {
  readonly header: ClaimListItem;
  readonly lines: readonly ClaimLine[];
  /** Suma de los ítems, calculada **en el servidor**. */
  readonly lineBilledTotal: Money;
  readonly lineApprovedTotal: Money | null;
  readonly adjudication: ClaimAdjudication | null;
  readonly adjudicationHistory: readonly ClaimAdjudication[];
  readonly disputes: readonly ClaimDispute[];
}

/* ---- solicitudes recibidas por la aseguradora ----------------
   La cara de QUIEN PAGA del mismo `insurance_claims`: lo que los prestadores le
   presentaron a esta aseguradora. Todo sale de columnas que el modelo ya
   declara —ninguna tabla nueva—:

   - médico y fecha de prestación → `insurance_claims.encounter_id` →
     `clinical.encounters` (profesional y comienzo de la atención);
   - servicio prestado → `insurance_claim_lines.service_concept_id` (la línea
     de mayor importe; el resto se cuenta en `additionalServiceCount`);
   - prestador → `billing_provider_entity_id`.

   Contrato: `docs/contracts/insurer-received-claims.md` (repo del front). La API todavía no
   expone esta cara; hoy la sirve el simulador. */

/** El médico que prestó el servicio. `null` si la solicitud no nace de una atención. */
export interface ReceivedClaimPractitioner {
  readonly id: string;
  readonly displayName: string;
  /** Especialidad principal, como la muestra el directorio. */
  readonly specialty: string | null;
}

/** Una solicitud recibida por la aseguradora, lista para la tabla. */
export interface ReceivedClaim {
  readonly id: string;
  readonly claimIdentifier: string;
  readonly patient: ClaimPatient;
  readonly practitioner: ReceivedClaimPractitioner | null;
  /** Quien factura: el consultorio o establecimiento del médico. */
  readonly providerName: string;
  /** El servicio de mayor importe de la solicitud. */
  readonly service: InsuranceConcept | null;
  /** Cuántos servicios más trae la solicitud, además de `service`. */
  readonly additionalServiceCount: number;
  readonly billedTotal: Money;
  /** `null` mientras no haya dictamen. **No es cero.** */
  readonly approvedTotal: Money | null;
  readonly submittedAt: Date | null;
  /** Día de la atención: es una fecha, no un instante. */
  readonly serviceDate: Date | null;
  readonly policyIdentifier: string | null;
  readonly planName: string | null;
  readonly status: InsuranceConcept | null;
}

/** Listado completo de solicitudes recibidas en la ventana consultada. */
export interface ReceivedClaimList {
  readonly items: readonly ReceivedClaim[];
  /** `true` si el servidor recortó al tope: hay más solicitudes que las recibidas. */
  readonly truncated: boolean;
}

/* ============================================================================
   Campañas preventivas de la aseguradora (Tarea 4 · M-06)

   Proceso 4 del cliente, «Módulo de promociones»: la aseguradora publica
   campañas de prevención junto a laboratorios e importadoras y el afiliado las
   ve en su portal. Contrato de la API:
   `docs/contracts/insurer-preventive-campaigns.md`.

   La patología (CIE-10) sólo DESCRIBE lo que la campaña previene: nunca segmenta
   afiliados por su historia clínica (decisión D4).
   ========================================================================== */

export type CampaignType =
  | 'LABORATORY'
  | 'PHARMACY'
  | 'DIAGNOSTIC_IMAGING'
  | 'VACCINATION';

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED';

/** A qué estados puede llevar un operador una campaña (nunca `DRAFT`). */
export type CampaignTargetStatus = Exclude<CampaignStatus, 'DRAFT'>;

/** `SPONSOR`: importadora o fabricante que financia. `PROVIDER`: dónde se atiende. */
export type CampaignPartnerRole = 'SPONSOR' | 'PROVIDER';

export type CampaignPartnerType =
  | 'IMPORTER'
  | 'MANUFACTURER'
  | 'LABORATORY'
  | 'PHARMACY'
  | 'MEDICAL_CENTER';

/** La patología que la campaña previene, resuelta desde el catálogo CIE-10. */
export interface CampaignCondition {
  readonly code: string;
  readonly display: string | null;
}

/** Un aliado tal como lo ve la aseguradora. */
export interface CampaignPartner {
  readonly id: string;
  readonly role: CampaignPartnerRole;
  readonly type: CampaignPartnerType;
  readonly name: string;
  readonly networkProviderMembershipId: string | null;
}

/** Una campaña tal como la ve la aseguradora que la creó. */
export interface InsuranceCampaign {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly campaignType: CampaignType;
  readonly status: CampaignStatus;
  readonly targetCondition: CampaignCondition | null;
  /** 0..100. `100` significa copago Bs. 0. */
  readonly copayBonusPercentage: number;
  /** Día civil, a medianoche local (ver `maybeDateOnly`). */
  readonly validFrom: Date;
  readonly validTo: Date;
  readonly activatedAt: Date | null;
  readonly partners: readonly CampaignPartner[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Filtros y paginación del listado administrativo. */
export interface CampaignQuery {
  readonly type?: CampaignType;
  readonly status?: CampaignStatus;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Página del listado, paginada por cursor opaco. */
export interface CampaignPage {
  readonly items: readonly InsuranceCampaign[];
  /** Se reenvía tal cual; no se interpreta. */
  readonly nextCursor: string | null;
}

/** Un aliado al crear la campaña. */
export interface CreateCampaignPartnerInput {
  readonly role: CampaignPartnerRole;
  readonly type: CampaignPartnerType;
  readonly name: string;
}

/** Cuerpo de `POST /insurance-campaigns`. Las fechas viajan como `AAAA-MM-DD`. */
export interface CreateCampaignInput {
  readonly code: string;
  readonly title: string;
  readonly description?: string;
  readonly campaignType: CampaignType;
  /** Código CIE-10, p. ej. `I10`. Sólo descriptivo. */
  readonly targetConditionCode?: string;
  readonly copayBonusPercentage: number;
  readonly validFrom: string;
  readonly validTo: string;
  readonly partners: readonly CreateCampaignPartnerInput[];
  /** Si es `true`, la campaña nace activa en vez de en borrador. */
  readonly activate?: boolean;
}

/** Aliado tal como lo ve el afiliado: sin ningún identificador interno. */
export interface PatientCampaignPartner {
  readonly role: CampaignPartnerRole;
  readonly type: CampaignPartnerType;
  readonly name: string;
}

/**
 * Una campaña vigente para el afiliado. Sólo llegan campañas activas, dentro de
 * su vigencia y de la aseguradora de una cobertura vigente propia.
 */
export interface PatientCampaign {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly campaignType: CampaignType;
  readonly targetCondition: CampaignCondition | null;
  readonly copayBonusPercentage: number;
  readonly validFrom: Date;
  readonly validTo: Date;
  readonly carrierName: string;
  readonly partners: readonly PatientCampaignPartner[];
}
