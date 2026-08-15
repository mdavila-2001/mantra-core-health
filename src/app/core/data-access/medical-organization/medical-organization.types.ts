/* ============================================================================
    Contratos de la consola de organización médica — CARRIL 13.

    Espejo de `MedicalOrganizationConsoleDto` del backend
    (`GET /practices/:practiceId/organization`). Todo `readonly`: la pantalla
    proyecta y filtra, nunca muta la respuesta.

    Los conceptos llegan **resueltos** (`code` + `display`), no como uuid. Es una
    diferencia deliberada con los contratos de `directory`, que devuelven
    `*ConceptId` crudos y obligan a cada pantalla a encadenar una lectura de
    terminología: el servidor ya tiene los conceptos del árbol cargados para
    componer la respuesta, y resolverlos ahí evita una petición por pantalla y
    la posibilidad de que dos pantallas traduzcan distinto.
    ========================================================================== */

/** Concepto de terminología, ya legible. */
export interface OrganizationConcept {
  /** Código estable: es lo que se compara, nunca la etiqueta. */
  readonly code: string;
  /** Etiqueta para mostrar. */
  readonly display: string;
}

/** La organización médica: la cabecera de la consola. */
export interface OrganizationHeader {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: OrganizationConcept;
  readonly status: OrganizationConcept;
  readonly timeZone: string | null;
  readonly currency: OrganizationConcept | null;
}

/** Sede, con el recuento de lo que cuelga de ella. */
export interface OrganizationSite {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: OrganizationConcept;
  readonly physicalType: OrganizationConcept | null;
  readonly operationalStatus: OrganizationConcept | null;
  readonly status: OrganizationConcept;
  readonly timeZone: string | null;
  readonly branchId: string | null;
  readonly clinicalUnitCount: number;
  readonly careSpaceCount: number;
}

/** Área, departamento o sección de una sede. */
export interface OrganizationClinicalUnit {
  readonly id: string;
  readonly siteId: string;
  readonly parentUnitId: string | null;
  readonly code: string;
  readonly name: string;
  readonly type: OrganizationConcept;
  readonly specialty: OrganizationConcept | null;
  readonly serviceMode: OrganizationConcept | null;
  readonly status: OrganizationConcept;
}

/** Espacio físico: quirófano, consultorio, box, sala. */
export interface OrganizationCareSpace {
  readonly id: string;
  readonly siteId: string;
  readonly clinicalUnitId: string | null;
  readonly parentSpaceId: string | null;
  readonly code: string;
  readonly name: string;
  readonly type: OrganizationConcept;
  readonly capacity: number | null;
  readonly operationalStatus: OrganizationConcept | null;
  readonly status: OrganizationConcept;
}

/** Servicio de salud publicado por la organización. */
export interface OrganizationHealthcareService {
  readonly id: string;
  readonly siteId: string | null;
  readonly clinicalUnitId: string | null;
  readonly service: OrganizationConcept;
  readonly specialty: OrganizationConcept | null;
  readonly referralRequired: boolean | null;
  readonly appointmentRequired: boolean | null;
  readonly telehealthAvailable: boolean | null;
  readonly status: OrganizationConcept;
}

/** Integrante de la plantilla profesional. */
export interface OrganizationStaffMember {
  readonly id: string;
  readonly practitionerProfileId: string;
  /** `null` cuando el perfil no tiene persona registrada: es un dato faltante real. */
  readonly practitionerName: string | null;
  readonly siteId: string | null;
  readonly clinicalUnitId: string | null;
  readonly healthcareServiceId: string | null;
  readonly role: OrganizationConcept;
  readonly specialty: OrganizationConcept | null;
  readonly isPrimary: boolean | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly status: OrganizationConcept;
}

/** Documento legal o acreditación de la organización. */
export interface OrganizationLegalDocument {
  readonly id: string;
  readonly siteId: string | null;
  readonly type: OrganizationConcept;
  readonly number: string | null;
  readonly issuerName: string | null;
  readonly evidenceFileId: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  /**
   * Días hasta el vencimiento, calculados por el servidor.
   *
   * Negativo si ya venció, `null` si el documento no declara vencimiento. No se
   * recalcula acá: el reloj del navegador daría un resultado distinto por
   * pantalla, y la alerta de vencimiento tiene que ser la misma para todos.
   */
  readonly daysToExpiry: number | null;
  readonly verificationStatus: OrganizationConcept;
}

/** Insumo o equipamiento del inventario. */
export interface OrganizationInventoryItem {
  readonly id: string;
  readonly name: string;
  readonly lotNumber: string | null;
  readonly expiryDate: string | null;
  readonly quantityOnHand: string;
  readonly unit: OrganizationConcept | null;
  readonly reorderLevel: string | null;
  readonly belowReorderLevel: boolean;
  readonly status: OrganizationConcept;
}

/** Respuesta de `GET /practices/:practiceId/organization`. */
export interface MedicalOrganizationConsole {
  readonly organization: OrganizationHeader;
  readonly sites: readonly OrganizationSite[];
  readonly clinicalUnits: readonly OrganizationClinicalUnit[];
  readonly careSpaces: readonly OrganizationCareSpace[];
  readonly healthcareServices: readonly OrganizationHealthcareService[];
  readonly staff: readonly OrganizationStaffMember[];
  readonly legalDocuments: readonly OrganizationLegalDocument[];
  readonly inventory: readonly OrganizationInventoryItem[];
}

/** Una práctica del listado `GET /practices`, para elegir cuál se administra. */
export interface PracticeSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly status: string;
}
