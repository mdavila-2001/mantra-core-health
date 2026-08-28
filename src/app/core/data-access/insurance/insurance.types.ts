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
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
}

/** Un plan del producto, con sus beneficios vigentes. */
export interface Plan {
  readonly id: string;
  readonly planCode: string;
  readonly name: string;
  readonly planType: InsuranceConcept | null;
  readonly currency: InsuranceConcept | null;
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

/** Ficha de la aseguradora (`GET /insurance-carriers/:id`). */
export interface CarrierDetail extends CarrierSummary {
  readonly products: readonly Product[];
  readonly networks: readonly ProviderNetwork[];
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
