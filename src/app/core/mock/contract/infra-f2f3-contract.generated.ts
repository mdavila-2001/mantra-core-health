// GENERADO por scripts/gen-infra-contract.mjs desde openapi.json de la API: origin/claude/trusting-hawking-q3p12v (0a0beceb2).
// No editar a mano. 34 operaciones de F2/F3 · 61 esquemas.

export interface InfraContractOperation {
  readonly method: 'GET' | 'POST' | 'PATCH';
  readonly path: string;
  readonly published: boolean;
  readonly body: string | null;
  readonly response: string | null;
  readonly responseIsArray: boolean;
}

export interface InfraContractSchema {
  readonly keys: readonly string[];
  readonly required: readonly string[];
  readonly nested: Readonly<Record<string, { readonly schema: string; readonly array: boolean }>>;
}

export const INFRA_CONTRACT_ORIGIN = "origin/claude/trusting-hawking-q3p12v (0a0beceb2)";

export const INFRA_OPERATIONS: readonly InfraContractOperation[] = [
 {
  "method": "GET",
  "path": "/practice/infrastructure-access/me",
  "published": true,
  "body": null,
  "response": "InfraAccessMeDto",
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/practice/infrastructure-catalog",
  "published": true,
  "body": null,
  "response": "InfrastructureCatalogDto",
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/sites/:siteId/bed-board",
  "published": true,
  "body": null,
  "response": "BedBoardDto",
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/care-spaces/:id/operational-state",
  "published": true,
  "body": null,
  "response": "OperationalStateDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/care-spaces/:id/availability",
  "published": true,
  "body": "AvailabilityChangeDto",
  "response": "AvailabilityResultDto",
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/care-spaces/:id/blocks",
  "published": true,
  "body": null,
  "response": "CareSpaceBlockDto",
  "responseIsArray": true
 },
 {
  "method": "POST",
  "path": "/care-space-blocks/:id/end",
  "published": true,
  "body": "EndBlockDto",
  "response": "CareSpaceBlockDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/care-space-blocks/:id/cancel",
  "published": true,
  "body": "CancelBlockDto",
  "response": "CareSpaceBlockDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/care-spaces/:id/hygiene",
  "published": true,
  "body": "HygieneActionDto",
  "response": "HygieneResultDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/care-spaces/:id/isolation",
  "published": true,
  "body": "IsolationChangeDto",
  "response": "IsolationResultDto",
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/sites/:siteId/cleaning-orders",
  "published": true,
  "body": null,
  "response": "CleaningOrderListDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/sites/:siteId/cleaning-orders",
  "published": true,
  "body": "CreateCleaningOrderDto",
  "response": "CleaningOrderDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/cleaning-orders/:id/assign",
  "published": true,
  "body": "AssignCleaningOrderDto",
  "response": "CleaningOrderDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/cleaning-orders/:id/start",
  "published": true,
  "body": null,
  "response": "CleaningOrderDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/cleaning-orders/:id/finish",
  "published": true,
  "body": "FinishCleaningOrderDto",
  "response": "CleaningOrderDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/cleaning-orders/:id/inspect",
  "published": true,
  "body": "InspectCleaningOrderDto",
  "response": "CleaningOrderDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/cleaning-orders/:id/cancel",
  "published": true,
  "body": "CancelCleaningOrderDto",
  "response": "CleaningOrderDto",
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/care-spaces/:id/status-events",
  "published": true,
  "body": null,
  "response": "StatusEventListDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/clinical/bed-compatibility",
  "published": true,
  "body": "ProspectiveCompatibilityDto",
  "response": "CompatibilityResultDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/clinical/encounters/:id/bed-compatibility",
  "published": true,
  "body": "BedCompatibilityQueryDto",
  "response": null,
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/clinical/admissions",
  "published": true,
  "body": "CreateAdmissionDto",
  "response": "AdtResultDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/clinical/encounters/:id/bed-assignment",
  "published": true,
  "body": "BedAssignmentDto",
  "response": "AdtResultDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/clinical/encounters/:id/transfer",
  "published": true,
  "body": "TransferDto",
  "response": "AdtResultDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/clinical/bed-swaps",
  "published": true,
  "body": "BedSwapDto",
  "response": "AdtResultDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/clinical/encounters/:id/discharge",
  "published": true,
  "body": "DischargeDto",
  "response": "AdtResultDto",
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/clinical/encounter-locations/:id/cancel",
  "published": true,
  "body": "CancelLocationDto",
  "response": "AdtResultDto",
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/clinical/encounters/:id/stay",
  "published": true,
  "body": null,
  "response": null,
  "responseIsArray": false
 },
 {
  "method": "PATCH",
  "path": "/clinical/placement-incidents/:id",
  "published": true,
  "body": "ReviewIncidentDto",
  "response": null,
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/clinical/patients/:id/inpatient-stay",
  "published": true,
  "body": null,
  "response": null,
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/sites/:siteId/attending-practitioners",
  "published": true,
  "body": null,
  "response": "AttendingPractitionerDto",
  "responseIsArray": true
 },
 {
  "method": "GET",
  "path": "/sites/:siteId/census",
  "published": true,
  "body": null,
  "response": null,
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/sites/:siteId/census/:date/close",
  "published": true,
  "body": "CloseCensusDto",
  "response": null,
  "responseIsArray": false
 },
 {
  "method": "POST",
  "path": "/census-days/:id/adjustments",
  "published": true,
  "body": "CensusAdjustmentDto",
  "response": null,
  "responseIsArray": false
 },
 {
  "method": "GET",
  "path": "/sites/:siteId/inpatient-indicators",
  "published": true,
  "body": null,
  "response": null,
  "responseIsArray": false
 }
];

export const INFRA_SCHEMAS: Readonly<Record<string, InfraContractSchema>> = {
 "InfraAccessMeDto": {
  "keys": [
   "sites",
   "tenantId",
   "userId"
  ],
  "required": [
   "sites",
   "tenantId",
   "userId"
  ],
  "nested": {
   "sites": {
    "schema": "InfraAccessSiteDto",
    "array": true
   }
  }
 },
 "InfrastructureCatalogDto": {
  "keys": [
   "attributes",
   "availability",
   "blockReasons",
   "cleaningPriorities",
   "cleaningTypes",
   "forms",
   "functions",
   "hygiene",
   "isolation",
   "lifecycle",
   "occupancy",
   "parentRules",
   "regulatory",
   "typologyRules",
   "unitLifecycle",
   "v2Map"
  ],
  "required": [
   "attributes",
   "availability",
   "blockReasons",
   "cleaningPriorities",
   "cleaningTypes",
   "forms",
   "functions",
   "hygiene",
   "isolation",
   "lifecycle",
   "occupancy",
   "parentRules",
   "regulatory",
   "typologyRules",
   "unitLifecycle",
   "v2Map"
  ],
  "nested": {
   "forms": {
    "schema": "FormConceptDto",
    "array": true
   },
   "functions": {
    "schema": "FunctionProfileDto",
    "array": true
   },
   "parentRules": {
    "schema": "ParentRuleDto",
    "array": true
   },
   "typologyRules": {
    "schema": "TypologyRuleDto",
    "array": true
   },
   "lifecycle": {
    "schema": "ConceptDto",
    "array": true
   },
   "unitLifecycle": {
    "schema": "ConceptDto",
    "array": true
   },
   "attributes": {
    "schema": "CatalogAttributesDto",
    "array": false
   },
   "regulatory": {
    "schema": "CatalogRegulatoryDto",
    "array": false
   },
   "availability": {
    "schema": "ConceptDto",
    "array": true
   },
   "hygiene": {
    "schema": "ConceptDto",
    "array": true
   },
   "isolation": {
    "schema": "ConceptDto",
    "array": true
   },
   "occupancy": {
    "schema": "ConceptDto",
    "array": true
   },
   "blockReasons": {
    "schema": "BlockReasonConceptDto",
    "array": true
   },
   "cleaningTypes": {
    "schema": "ConceptDto",
    "array": true
   },
   "cleaningPriorities": {
    "schema": "ConceptDto",
    "array": true
   },
   "v2Map": {
    "schema": "V2MapRuleDto",
    "array": true
   }
  }
 },
 "BedBoardDto": {
  "keys": [
   "generatedAt",
   "lastEventAt",
   "nextCursor",
   "siteId",
   "units"
  ],
  "required": [
   "generatedAt",
   "lastEventAt",
   "nextCursor",
   "siteId",
   "units"
  ],
  "nested": {
   "units": {
    "schema": "BedBoardUnitDto",
    "array": true
   }
  }
 },
 "OperationalStateDto": {
  "keys": [
   "actions",
   "assignable",
   "availability",
   "code",
   "form",
   "function",
   "hygiene",
   "id",
   "isolation",
   "lastEventAt",
   "lifecycle",
   "name",
   "occupancy",
   "openBlocks",
   "openCleaningOrder",
   "openCleaningOrderId",
   "opsVersion",
   "path",
   "unitId",
   "v2Code"
  ],
  "required": [
   "actions",
   "assignable",
   "availability",
   "code",
   "form",
   "function",
   "hygiene",
   "id",
   "isolation",
   "lastEventAt",
   "lifecycle",
   "name",
   "occupancy",
   "openBlocks",
   "openCleaningOrder",
   "openCleaningOrderId",
   "opsVersion",
   "path",
   "unitId",
   "v2Code"
  ],
  "nested": {
   "path": {
    "schema": "SpacePathItemDto",
    "array": true
   },
   "availability": {
    "schema": "AvailabilityAxisDto",
    "array": false
   },
   "hygiene": {
    "schema": "HygieneAxisDto",
    "array": false
   },
   "isolation": {
    "schema": "IsolationAxisDto",
    "array": false
   },
   "occupancy": {
    "schema": "OccupancyAxisDto",
    "array": false
   },
   "openBlocks": {
    "schema": "CareSpaceBlockDto",
    "array": true
   },
   "openCleaningOrder": {
    "schema": "CleaningOrderDto",
    "array": false
   }
  }
 },
 "AvailabilityChangeDto": {
  "keys": [
   "acknowledgeConflicts",
   "action",
   "expectedEndAt",
   "kindCode",
   "reasonCode",
   "reasonText",
   "startsAt"
  ],
  "required": [
   "action"
  ],
  "nested": {}
 },
 "AvailabilityResultDto": {
  "keys": [
   "blockId",
   "cell",
   "conflicts",
   "requestId"
  ],
  "required": [
   "blockId",
   "cell"
  ],
  "nested": {
   "cell": {
    "schema": "BedBoardCellDto",
    "array": false
   }
  }
 },
 "CareSpaceBlockDto": {
  "keys": [
   "cancelReason",
   "cancelledAt",
   "careSpaceId",
   "endNote",
   "endedAt",
   "expectedEndAt",
   "id",
   "kindCode",
   "reasonCode",
   "reasonText",
   "requestId",
   "rowVersion",
   "startsAt"
  ],
  "required": [
   "cancelReason",
   "cancelledAt",
   "careSpaceId",
   "endNote",
   "endedAt",
   "expectedEndAt",
   "id",
   "kindCode",
   "reasonCode",
   "reasonText",
   "rowVersion",
   "startsAt"
  ],
  "nested": {}
 },
 "EndBlockDto": {
  "keys": [
   "note"
  ],
  "required": [],
  "nested": {}
 },
 "CancelBlockDto": {
  "keys": [
   "reason"
  ],
  "required": [
   "reason"
  ],
  "nested": {}
 },
 "HygieneActionDto": {
  "keys": [
   "action",
   "reasonText"
  ],
  "required": [
   "action"
  ],
  "nested": {}
 },
 "HygieneResultDto": {
  "keys": [
   "cell",
   "cleaningOrderId",
   "requestId"
  ],
  "required": [
   "cell",
   "cleaningOrderId"
  ],
  "nested": {
   "cell": {
    "schema": "BedBoardCellDto",
    "array": false
   }
  }
 },
 "IsolationChangeDto": {
  "keys": [
   "cohortApproved",
   "isolationCode",
   "organismText",
   "reasonText"
  ],
  "required": [
   "isolationCode"
  ],
  "nested": {}
 },
 "IsolationResultDto": {
  "keys": [
   "cell",
   "cleaningOrderId",
   "companionBlocks",
   "requestId"
  ],
  "required": [
   "cell",
   "companionBlocks"
  ],
  "nested": {
   "cell": {
    "schema": "BedBoardCellDto",
    "array": false
   },
   "companionBlocks": {
    "schema": "CompanionBlockDto",
    "array": true
   }
  }
 },
 "CleaningOrderListDto": {
  "keys": [
   "generatedAt",
   "items",
   "nextCursor"
  ],
  "required": [
   "generatedAt",
   "items",
   "nextCursor"
  ],
  "nested": {
   "items": {
    "schema": "CleaningOrderDto",
    "array": true
   }
  }
 },
 "CreateCleaningOrderDto": {
  "keys": [
   "careSpaceId",
   "note",
   "priorityCode",
   "typeCode"
  ],
  "required": [
   "careSpaceId",
   "typeCode"
  ],
  "nested": {}
 },
 "CleaningOrderDto": {
  "keys": [
   "ageMinutes",
   "allowedTransitions",
   "assignedUserId",
   "careSpaceCode",
   "careSpaceId",
   "careSpaceName",
   "clinicalUnitId",
   "dueAt",
   "finishedAt",
   "finishedByUserId",
   "id",
   "inspectedAt",
   "inspectionRequired",
   "inspectionResult",
   "previousOrderId",
   "priorityCode",
   "rejectionReason",
   "requestId",
   "requestedAt",
   "rowVersion",
   "startedAt",
   "statusCode",
   "triggerCode",
   "typeCode"
  ],
  "required": [
   "ageMinutes",
   "allowedTransitions",
   "assignedUserId",
   "careSpaceCode",
   "careSpaceId",
   "careSpaceName",
   "clinicalUnitId",
   "dueAt",
   "finishedAt",
   "finishedByUserId",
   "id",
   "inspectedAt",
   "inspectionRequired",
   "inspectionResult",
   "previousOrderId",
   "priorityCode",
   "rejectionReason",
   "requestedAt",
   "rowVersion",
   "startedAt",
   "statusCode",
   "triggerCode",
   "typeCode"
  ],
  "nested": {}
 },
 "AssignCleaningOrderDto": {
  "keys": [
   "userId"
  ],
  "required": [
   "userId"
  ],
  "nested": {}
 },
 "FinishCleaningOrderDto": {
  "keys": [
   "note"
  ],
  "required": [],
  "nested": {}
 },
 "InspectCleaningOrderDto": {
  "keys": [
   "reasonText",
   "result"
  ],
  "required": [
   "result"
  ],
  "nested": {}
 },
 "CancelCleaningOrderDto": {
  "keys": [
   "reason"
  ],
  "required": [
   "reason"
  ],
  "nested": {}
 },
 "StatusEventListDto": {
  "keys": [
   "items",
   "nextCursor"
  ],
  "required": [
   "items",
   "nextCursor"
  ],
  "nested": {
   "items": {
    "schema": "StatusEventDto",
    "array": true
   }
  }
 },
 "ProspectiveCompatibilityDto": {
  "keys": [
   "careSpaceId",
   "isolationOrganismText",
   "isolationPrecautionCode",
   "levelOfCareCode",
   "patientProfileId"
  ],
  "required": [
   "careSpaceId",
   "patientProfileId"
  ],
  "nested": {}
 },
 "CompatibilityResultDto": {
  "keys": [
   "assignable",
   "rules",
   "violations"
  ],
  "required": [
   "assignable",
   "rules",
   "violations"
  ],
  "nested": {
   "rules": {
    "schema": "CompatibilityRuleDto",
    "array": true
   }
  }
 },
 "BedCompatibilityQueryDto": {
  "keys": [
   "careSpaceId"
  ],
  "required": [
   "careSpaceId"
  ],
  "nested": {}
 },
 "CreateAdmissionDto": {
  "keys": [
   "admissionSourceCode",
   "attendingPractitionerId",
   "bed",
   "episodeId",
   "expectedDischargeAt",
   "isolationOrganismText",
   "isolationPrecautionCode",
   "levelOfCareCode",
   "openEpisode",
   "override",
   "patientProfileId",
   "practiceSiteId",
   "reasonText"
  ],
  "required": [
   "admissionSourceCode",
   "levelOfCareCode",
   "patientProfileId",
   "practiceSiteId",
   "reasonText"
  ],
  "nested": {
   "bed": {
    "schema": "AdmissionBedDto",
    "array": false
   },
   "override": {
    "schema": "PlacementOverrideDto",
    "array": false
   }
  }
 },
 "AdtResultDto": {
  "keys": [
   "cell",
   "cleaningOrderId",
   "encounterId",
   "encounterLocationId",
   "episodeId",
   "fromLocationId",
   "incidentId",
   "locations",
   "requestId",
   "toLocationId"
  ],
  "required": [],
  "nested": {}
 },
 "BedAssignmentDto": {
  "keys": [
   "careSpaceId",
   "mode",
   "override"
  ],
  "required": [
   "careSpaceId",
   "mode"
  ],
  "nested": {
   "override": {
    "schema": "PlacementOverrideDto",
    "array": false
   }
  }
 },
 "TransferDto": {
  "keys": [
   "occurredAt",
   "override",
   "reasonCode",
   "toCareSpaceId"
  ],
  "required": [
   "toCareSpaceId"
  ],
  "nested": {
   "override": {
    "schema": "PlacementOverrideDto",
    "array": false
   }
  }
 },
 "BedSwapDto": {
  "keys": [
   "encounterAId",
   "encounterBId",
   "occurredAt",
   "override",
   "reasonText"
  ],
  "required": [
   "encounterAId",
   "encounterBId",
   "reasonText"
  ],
  "nested": {
   "override": {
    "schema": "PlacementOverrideDto",
    "array": false
   }
  }
 },
 "DischargeDto": {
  "keys": [
   "closeEpisode",
   "dischargeDispositionCode",
   "occurredAt",
   "reasonText"
  ],
  "required": [],
  "nested": {}
 },
 "CancelLocationDto": {
  "keys": [
   "reasonText"
  ],
  "required": [
   "reasonText"
  ],
  "nested": {}
 },
 "ReviewIncidentDto": {
  "keys": [
   "reviewNote",
   "status"
  ],
  "required": [
   "reviewNote",
   "status"
  ],
  "nested": {}
 },
 "AttendingPractitionerDto": {
  "keys": [
   "displayName",
   "practitionerProfileId",
   "specialty"
  ],
  "required": [
   "displayName",
   "practitionerProfileId",
   "specialty"
  ],
  "nested": {
   "specialty": {
    "schema": "PractitionerSpecialtyDto",
    "array": false
   }
  }
 },
 "CloseCensusDto": {
  "keys": [
   "unitIds"
  ],
  "required": [],
  "nested": {}
 },
 "CensusAdjustmentDto": {
  "keys": [
   "entryRefId",
   "fieldCode",
   "newValue",
   "reasonText"
  ],
  "required": [
   "fieldCode",
   "newValue",
   "reasonText"
  ],
  "nested": {}
 },
 "InfraAccessSiteDto": {
  "keys": [
   "actions",
   "code",
   "globalRoles",
   "grants",
   "name",
   "practiceId",
   "roles",
   "siteId",
   "timeZone"
  ],
  "required": [
   "actions",
   "code",
   "globalRoles",
   "grants",
   "name",
   "practiceId",
   "roles",
   "siteId",
   "timeZone"
  ],
  "nested": {
   "grants": {
    "schema": "InfraAccessGrantDto",
    "array": true
   }
  }
 },
 "FormConceptDto": {
  "keys": [
   "code",
   "display",
   "fhirCode"
  ],
  "required": [
   "code",
   "display",
   "fhirCode"
  ],
  "nested": {}
 },
 "FunctionProfileDto": {
  "keys": [
   "allowOverlap",
   "billable",
   "code",
   "display",
   "forms",
   "hostsEquipment",
   "inpatient",
   "isolationCapable",
   "key",
   "requiresArea",
   "requiresHvac",
   "requiresTerminalCleaning",
   "schedulable",
   "stockPoint"
  ],
  "required": [
   "allowOverlap",
   "billable",
   "code",
   "display",
   "forms",
   "hostsEquipment",
   "inpatient",
   "isolationCapable",
   "key",
   "requiresArea",
   "requiresHvac",
   "requiresTerminalCleaning",
   "schedulable",
   "stockPoint"
  ],
  "nested": {}
 },
 "ParentRuleDto": {
  "keys": [
   "child",
   "parent"
  ],
  "required": [
   "child",
   "parent"
  ],
  "nested": {}
 },
 "TypologyRuleDto": {
  "keys": [
   "function",
   "rule",
   "typology"
  ],
  "required": [
   "function",
   "rule",
   "typology"
  ],
  "nested": {}
 },
 "ConceptDto": {
  "keys": [
   "code",
   "display"
  ],
  "required": [
   "code",
   "display"
  ],
  "nested": {}
 },
 "CatalogAttributesDto": {
  "keys": [
   "ageGroup",
   "asepsis",
   "bedCategory",
   "pressure",
   "sex",
   "unitRole"
  ],
  "required": [
   "ageGroup",
   "asepsis",
   "bedCategory",
   "pressure",
   "sex",
   "unitRole"
  ],
  "nested": {
   "asepsis": {
    "schema": "ConceptDto",
    "array": true
   },
   "pressure": {
    "schema": "ConceptDto",
    "array": true
   },
   "sex": {
    "schema": "ConceptDto",
    "array": true
   },
   "ageGroup": {
    "schema": "ConceptDto",
    "array": true
   },
   "bedCategory": {
    "schema": "ConceptDto",
    "array": true
   },
   "unitRole": {
    "schema": "ConceptDto",
    "array": true
   }
  }
 },
 "CatalogRegulatoryDto": {
  "keys": [
   "capacityKind",
   "careLevel",
   "licenseStatus",
   "sedes",
   "subsector",
   "typology"
  ],
  "required": [
   "capacityKind",
   "careLevel",
   "licenseStatus",
   "sedes",
   "subsector",
   "typology"
  ],
  "nested": {
   "subsector": {
    "schema": "ConceptDto",
    "array": true
   },
   "careLevel": {
    "schema": "ConceptDto",
    "array": true
   },
   "typology": {
    "schema": "ConceptDto",
    "array": true
   },
   "sedes": {
    "schema": "ConceptDto",
    "array": true
   },
   "licenseStatus": {
    "schema": "ConceptDto",
    "array": true
   },
   "capacityKind": {
    "schema": "ConceptDto",
    "array": true
   }
  }
 },
 "BlockReasonConceptDto": {
  "keys": [
   "code",
   "display",
   "kinds"
  ],
  "required": [
   "code",
   "display",
   "kinds"
  ],
  "nested": {}
 },
 "V2MapRuleDto": {
  "keys": [
   "condition",
   "order",
   "v2Code"
  ],
  "required": [
   "condition",
   "order",
   "v2Code"
  ],
  "nested": {}
 },
 "BedBoardUnitDto": {
  "keys": [
   "cells",
   "counts",
   "name",
   "unitId"
  ],
  "required": [
   "cells",
   "counts",
   "name",
   "unitId"
  ],
  "nested": {
   "counts": {
    "schema": "BedBoardCountsDto",
    "array": false
   },
   "cells": {
    "schema": "BedBoardCellDto",
    "array": true
   }
  }
 },
 "SpacePathItemDto": {
  "keys": [
   "code",
   "form",
   "id",
   "name"
  ],
  "required": [
   "code",
   "form",
   "id",
   "name"
  ],
  "nested": {}
 },
 "AvailabilityAxisDto": {
  "keys": [
   "code",
   "expectedUntil",
   "reasonCode",
   "reasonText",
   "since"
  ],
  "required": [
   "code",
   "expectedUntil",
   "reasonCode",
   "reasonText",
   "since"
  ],
  "nested": {}
 },
 "HygieneAxisDto": {
  "keys": [
   "code",
   "since",
   "terminalRequired"
  ],
  "required": [
   "code",
   "since",
   "terminalRequired"
  ],
  "nested": {}
 },
 "IsolationAxisDto": {
  "keys": [
   "code",
   "organism",
   "since"
  ],
  "required": [
   "code",
   "since"
  ],
  "nested": {}
 },
 "OccupancyAxisDto": {
  "keys": [
   "code",
   "encounterId",
   "encounterLocationId",
   "patient",
   "since"
  ],
  "required": [
   "code",
   "since"
  ],
  "nested": {
   "patient": {
    "schema": "BedPatientDto",
    "array": false
   }
  }
 },
 "BedBoardCellDto": {
  "keys": [
   "actions",
   "assignable",
   "availability",
   "code",
   "form",
   "function",
   "hygiene",
   "id",
   "isolation",
   "lastEventAt",
   "lifecycle",
   "name",
   "occupancy",
   "openCleaningOrderId",
   "opsVersion",
   "path",
   "unitId",
   "v2Code"
  ],
  "required": [
   "actions",
   "assignable",
   "availability",
   "code",
   "form",
   "function",
   "hygiene",
   "id",
   "isolation",
   "lastEventAt",
   "lifecycle",
   "name",
   "occupancy",
   "openCleaningOrderId",
   "opsVersion",
   "path",
   "unitId",
   "v2Code"
  ],
  "nested": {
   "path": {
    "schema": "SpacePathItemDto",
    "array": true
   },
   "availability": {
    "schema": "AvailabilityAxisDto",
    "array": false
   },
   "hygiene": {
    "schema": "HygieneAxisDto",
    "array": false
   },
   "isolation": {
    "schema": "IsolationAxisDto",
    "array": false
   },
   "occupancy": {
    "schema": "OccupancyAxisDto",
    "array": false
   }
  }
 },
 "CompanionBlockDto": {
  "keys": [
   "blockId",
   "careSpaceId"
  ],
  "required": [
   "blockId",
   "careSpaceId"
  ],
  "nested": {}
 },
 "StatusEventDto": {
  "keys": [
   "axis",
   "expectedUntil",
   "from",
   "id",
   "occurredAt",
   "reasonCode",
   "reasonText",
   "recordedByUserId",
   "requestId",
   "source",
   "sourceRefId",
   "to",
   "v2Code"
  ],
  "required": [
   "axis",
   "expectedUntil",
   "from",
   "id",
   "occurredAt",
   "reasonCode",
   "reasonText",
   "recordedByUserId",
   "requestId",
   "source",
   "sourceRefId",
   "to",
   "v2Code"
  ],
  "nested": {}
 },
 "CompatibilityRuleDto": {
  "keys": [
   "code",
   "detail",
   "overridable",
   "severity"
  ],
  "required": [
   "code",
   "detail",
   "overridable",
   "severity"
  ],
  "nested": {}
 },
 "AdmissionBedDto": {
  "keys": [
   "careSpaceId",
   "mode"
  ],
  "required": [
   "careSpaceId",
   "mode"
  ],
  "nested": {}
 },
 "PlacementOverrideDto": {
  "keys": [
   "justification",
   "ruleCodes"
  ],
  "required": [
   "justification",
   "ruleCodes"
  ],
  "nested": {}
 },
 "PractitionerSpecialtyDto": {
  "keys": [
   "boardCertified",
   "id",
   "isPrimary",
   "practiceScopeText",
   "specialtyConceptId",
   "validFrom",
   "validTo",
   "verificationStatusConceptId"
  ],
  "required": [
   "boardCertified",
   "id",
   "isPrimary",
   "specialtyConceptId",
   "verificationStatusConceptId"
  ],
  "nested": {}
 },
 "InfraAccessGrantDto": {
  "keys": [
   "actions",
   "careSpaceId",
   "clinicalUnitId",
   "role",
   "scope"
  ],
  "required": [
   "actions",
   "careSpaceId",
   "clinicalUnitId",
   "role",
   "scope"
  ],
  "nested": {}
 },
 "BedBoardCountsDto": {
  "keys": [
   "assignable",
   "blocked",
   "cleaning",
   "contaminated",
   "dirty",
   "isolation",
   "maintenance",
   "occupied",
   "reserved",
   "total"
  ],
  "required": [
   "assignable",
   "blocked",
   "cleaning",
   "contaminated",
   "dirty",
   "isolation",
   "maintenance",
   "occupied",
   "reserved",
   "total"
  ],
  "nested": {}
 },
 "BedPatientDto": {
  "keys": [
   "ageYears",
   "initials",
   "sexCode"
  ],
  "required": [
   "ageYears",
   "initials",
   "sexCode"
  ],
  "nested": {}
 }
};

/** Claves y obligatorias de cada esquema, como tipos (los usa `infra-f2f3-types.check.ts`). */
export interface InfraSchemaKeys {
  readonly AdmissionBedDto: { readonly keys: 'careSpaceId' | 'mode'; readonly required: 'careSpaceId' | 'mode' };
  readonly AdtResultDto: { readonly keys: 'cell' | 'cleaningOrderId' | 'encounterId' | 'encounterLocationId' | 'episodeId' | 'fromLocationId' | 'incidentId' | 'locations' | 'requestId' | 'toLocationId'; readonly required: never };
  readonly AssignCleaningOrderDto: { readonly keys: 'userId'; readonly required: 'userId' };
  readonly AttendingPractitionerDto: { readonly keys: 'displayName' | 'practitionerProfileId' | 'specialty'; readonly required: 'displayName' | 'practitionerProfileId' | 'specialty' };
  readonly AvailabilityAxisDto: { readonly keys: 'code' | 'expectedUntil' | 'reasonCode' | 'reasonText' | 'since'; readonly required: 'code' | 'expectedUntil' | 'reasonCode' | 'reasonText' | 'since' };
  readonly AvailabilityChangeDto: { readonly keys: 'acknowledgeConflicts' | 'action' | 'expectedEndAt' | 'kindCode' | 'reasonCode' | 'reasonText' | 'startsAt'; readonly required: 'action' };
  readonly AvailabilityResultDto: { readonly keys: 'blockId' | 'cell' | 'conflicts' | 'requestId'; readonly required: 'blockId' | 'cell' };
  readonly BedAssignmentDto: { readonly keys: 'careSpaceId' | 'mode' | 'override'; readonly required: 'careSpaceId' | 'mode' };
  readonly BedBoardCellDto: { readonly keys: 'actions' | 'assignable' | 'availability' | 'code' | 'form' | 'function' | 'hygiene' | 'id' | 'isolation' | 'lastEventAt' | 'lifecycle' | 'name' | 'occupancy' | 'openCleaningOrderId' | 'opsVersion' | 'path' | 'unitId' | 'v2Code'; readonly required: 'actions' | 'assignable' | 'availability' | 'code' | 'form' | 'function' | 'hygiene' | 'id' | 'isolation' | 'lastEventAt' | 'lifecycle' | 'name' | 'occupancy' | 'openCleaningOrderId' | 'opsVersion' | 'path' | 'unitId' | 'v2Code' };
  readonly BedBoardCountsDto: { readonly keys: 'assignable' | 'blocked' | 'cleaning' | 'contaminated' | 'dirty' | 'isolation' | 'maintenance' | 'occupied' | 'reserved' | 'total'; readonly required: 'assignable' | 'blocked' | 'cleaning' | 'contaminated' | 'dirty' | 'isolation' | 'maintenance' | 'occupied' | 'reserved' | 'total' };
  readonly BedBoardDto: { readonly keys: 'generatedAt' | 'lastEventAt' | 'nextCursor' | 'siteId' | 'units'; readonly required: 'generatedAt' | 'lastEventAt' | 'nextCursor' | 'siteId' | 'units' };
  readonly BedBoardUnitDto: { readonly keys: 'cells' | 'counts' | 'name' | 'unitId'; readonly required: 'cells' | 'counts' | 'name' | 'unitId' };
  readonly BedCompatibilityQueryDto: { readonly keys: 'careSpaceId'; readonly required: 'careSpaceId' };
  readonly BedPatientDto: { readonly keys: 'ageYears' | 'initials' | 'sexCode'; readonly required: 'ageYears' | 'initials' | 'sexCode' };
  readonly BedSwapDto: { readonly keys: 'encounterAId' | 'encounterBId' | 'occurredAt' | 'override' | 'reasonText'; readonly required: 'encounterAId' | 'encounterBId' | 'reasonText' };
  readonly BlockReasonConceptDto: { readonly keys: 'code' | 'display' | 'kinds'; readonly required: 'code' | 'display' | 'kinds' };
  readonly CancelBlockDto: { readonly keys: 'reason'; readonly required: 'reason' };
  readonly CancelCleaningOrderDto: { readonly keys: 'reason'; readonly required: 'reason' };
  readonly CancelLocationDto: { readonly keys: 'reasonText'; readonly required: 'reasonText' };
  readonly CareSpaceBlockDto: { readonly keys: 'cancelReason' | 'cancelledAt' | 'careSpaceId' | 'endNote' | 'endedAt' | 'expectedEndAt' | 'id' | 'kindCode' | 'reasonCode' | 'reasonText' | 'requestId' | 'rowVersion' | 'startsAt'; readonly required: 'cancelReason' | 'cancelledAt' | 'careSpaceId' | 'endNote' | 'endedAt' | 'expectedEndAt' | 'id' | 'kindCode' | 'reasonCode' | 'reasonText' | 'rowVersion' | 'startsAt' };
  readonly CatalogAttributesDto: { readonly keys: 'ageGroup' | 'asepsis' | 'bedCategory' | 'pressure' | 'sex' | 'unitRole'; readonly required: 'ageGroup' | 'asepsis' | 'bedCategory' | 'pressure' | 'sex' | 'unitRole' };
  readonly CatalogRegulatoryDto: { readonly keys: 'capacityKind' | 'careLevel' | 'licenseStatus' | 'sedes' | 'subsector' | 'typology'; readonly required: 'capacityKind' | 'careLevel' | 'licenseStatus' | 'sedes' | 'subsector' | 'typology' };
  readonly CensusAdjustmentDto: { readonly keys: 'entryRefId' | 'fieldCode' | 'newValue' | 'reasonText'; readonly required: 'fieldCode' | 'newValue' | 'reasonText' };
  readonly CleaningOrderDto: { readonly keys: 'ageMinutes' | 'allowedTransitions' | 'assignedUserId' | 'careSpaceCode' | 'careSpaceId' | 'careSpaceName' | 'clinicalUnitId' | 'dueAt' | 'finishedAt' | 'finishedByUserId' | 'id' | 'inspectedAt' | 'inspectionRequired' | 'inspectionResult' | 'previousOrderId' | 'priorityCode' | 'rejectionReason' | 'requestId' | 'requestedAt' | 'rowVersion' | 'startedAt' | 'statusCode' | 'triggerCode' | 'typeCode'; readonly required: 'ageMinutes' | 'allowedTransitions' | 'assignedUserId' | 'careSpaceCode' | 'careSpaceId' | 'careSpaceName' | 'clinicalUnitId' | 'dueAt' | 'finishedAt' | 'finishedByUserId' | 'id' | 'inspectedAt' | 'inspectionRequired' | 'inspectionResult' | 'previousOrderId' | 'priorityCode' | 'rejectionReason' | 'requestedAt' | 'rowVersion' | 'startedAt' | 'statusCode' | 'triggerCode' | 'typeCode' };
  readonly CleaningOrderListDto: { readonly keys: 'generatedAt' | 'items' | 'nextCursor'; readonly required: 'generatedAt' | 'items' | 'nextCursor' };
  readonly CloseCensusDto: { readonly keys: 'unitIds'; readonly required: never };
  readonly CompanionBlockDto: { readonly keys: 'blockId' | 'careSpaceId'; readonly required: 'blockId' | 'careSpaceId' };
  readonly CompatibilityResultDto: { readonly keys: 'assignable' | 'rules' | 'violations'; readonly required: 'assignable' | 'rules' | 'violations' };
  readonly CompatibilityRuleDto: { readonly keys: 'code' | 'detail' | 'overridable' | 'severity'; readonly required: 'code' | 'detail' | 'overridable' | 'severity' };
  readonly ConceptDto: { readonly keys: 'code' | 'display'; readonly required: 'code' | 'display' };
  readonly CreateAdmissionDto: { readonly keys: 'admissionSourceCode' | 'attendingPractitionerId' | 'bed' | 'episodeId' | 'expectedDischargeAt' | 'isolationOrganismText' | 'isolationPrecautionCode' | 'levelOfCareCode' | 'openEpisode' | 'override' | 'patientProfileId' | 'practiceSiteId' | 'reasonText'; readonly required: 'admissionSourceCode' | 'levelOfCareCode' | 'patientProfileId' | 'practiceSiteId' | 'reasonText' };
  readonly CreateCleaningOrderDto: { readonly keys: 'careSpaceId' | 'note' | 'priorityCode' | 'typeCode'; readonly required: 'careSpaceId' | 'typeCode' };
  readonly DischargeDto: { readonly keys: 'closeEpisode' | 'dischargeDispositionCode' | 'occurredAt' | 'reasonText'; readonly required: never };
  readonly EndBlockDto: { readonly keys: 'note'; readonly required: never };
  readonly FinishCleaningOrderDto: { readonly keys: 'note'; readonly required: never };
  readonly FormConceptDto: { readonly keys: 'code' | 'display' | 'fhirCode'; readonly required: 'code' | 'display' | 'fhirCode' };
  readonly FunctionProfileDto: { readonly keys: 'allowOverlap' | 'billable' | 'code' | 'display' | 'forms' | 'hostsEquipment' | 'inpatient' | 'isolationCapable' | 'key' | 'requiresArea' | 'requiresHvac' | 'requiresTerminalCleaning' | 'schedulable' | 'stockPoint'; readonly required: 'allowOverlap' | 'billable' | 'code' | 'display' | 'forms' | 'hostsEquipment' | 'inpatient' | 'isolationCapable' | 'key' | 'requiresArea' | 'requiresHvac' | 'requiresTerminalCleaning' | 'schedulable' | 'stockPoint' };
  readonly HygieneActionDto: { readonly keys: 'action' | 'reasonText'; readonly required: 'action' };
  readonly HygieneAxisDto: { readonly keys: 'code' | 'since' | 'terminalRequired'; readonly required: 'code' | 'since' | 'terminalRequired' };
  readonly HygieneResultDto: { readonly keys: 'cell' | 'cleaningOrderId' | 'requestId'; readonly required: 'cell' | 'cleaningOrderId' };
  readonly InfraAccessGrantDto: { readonly keys: 'actions' | 'careSpaceId' | 'clinicalUnitId' | 'role' | 'scope'; readonly required: 'actions' | 'careSpaceId' | 'clinicalUnitId' | 'role' | 'scope' };
  readonly InfraAccessMeDto: { readonly keys: 'sites' | 'tenantId' | 'userId'; readonly required: 'sites' | 'tenantId' | 'userId' };
  readonly InfraAccessSiteDto: { readonly keys: 'actions' | 'code' | 'globalRoles' | 'grants' | 'name' | 'practiceId' | 'roles' | 'siteId' | 'timeZone'; readonly required: 'actions' | 'code' | 'globalRoles' | 'grants' | 'name' | 'practiceId' | 'roles' | 'siteId' | 'timeZone' };
  readonly InfrastructureCatalogDto: { readonly keys: 'attributes' | 'availability' | 'blockReasons' | 'cleaningPriorities' | 'cleaningTypes' | 'forms' | 'functions' | 'hygiene' | 'isolation' | 'lifecycle' | 'occupancy' | 'parentRules' | 'regulatory' | 'typologyRules' | 'unitLifecycle' | 'v2Map'; readonly required: 'attributes' | 'availability' | 'blockReasons' | 'cleaningPriorities' | 'cleaningTypes' | 'forms' | 'functions' | 'hygiene' | 'isolation' | 'lifecycle' | 'occupancy' | 'parentRules' | 'regulatory' | 'typologyRules' | 'unitLifecycle' | 'v2Map' };
  readonly InspectCleaningOrderDto: { readonly keys: 'reasonText' | 'result'; readonly required: 'result' };
  readonly IsolationAxisDto: { readonly keys: 'code' | 'organism' | 'since'; readonly required: 'code' | 'since' };
  readonly IsolationChangeDto: { readonly keys: 'cohortApproved' | 'isolationCode' | 'organismText' | 'reasonText'; readonly required: 'isolationCode' };
  readonly IsolationResultDto: { readonly keys: 'cell' | 'cleaningOrderId' | 'companionBlocks' | 'requestId'; readonly required: 'cell' | 'companionBlocks' };
  readonly OccupancyAxisDto: { readonly keys: 'code' | 'encounterId' | 'encounterLocationId' | 'patient' | 'since'; readonly required: 'code' | 'since' };
  readonly OperationalStateDto: { readonly keys: 'actions' | 'assignable' | 'availability' | 'code' | 'form' | 'function' | 'hygiene' | 'id' | 'isolation' | 'lastEventAt' | 'lifecycle' | 'name' | 'occupancy' | 'openBlocks' | 'openCleaningOrder' | 'openCleaningOrderId' | 'opsVersion' | 'path' | 'unitId' | 'v2Code'; readonly required: 'actions' | 'assignable' | 'availability' | 'code' | 'form' | 'function' | 'hygiene' | 'id' | 'isolation' | 'lastEventAt' | 'lifecycle' | 'name' | 'occupancy' | 'openBlocks' | 'openCleaningOrder' | 'openCleaningOrderId' | 'opsVersion' | 'path' | 'unitId' | 'v2Code' };
  readonly ParentRuleDto: { readonly keys: 'child' | 'parent'; readonly required: 'child' | 'parent' };
  readonly PlacementOverrideDto: { readonly keys: 'justification' | 'ruleCodes'; readonly required: 'justification' | 'ruleCodes' };
  readonly PractitionerSpecialtyDto: { readonly keys: 'boardCertified' | 'id' | 'isPrimary' | 'practiceScopeText' | 'specialtyConceptId' | 'validFrom' | 'validTo' | 'verificationStatusConceptId'; readonly required: 'boardCertified' | 'id' | 'isPrimary' | 'specialtyConceptId' | 'verificationStatusConceptId' };
  readonly ProspectiveCompatibilityDto: { readonly keys: 'careSpaceId' | 'isolationOrganismText' | 'isolationPrecautionCode' | 'levelOfCareCode' | 'patientProfileId'; readonly required: 'careSpaceId' | 'patientProfileId' };
  readonly ReviewIncidentDto: { readonly keys: 'reviewNote' | 'status'; readonly required: 'reviewNote' | 'status' };
  readonly SpacePathItemDto: { readonly keys: 'code' | 'form' | 'id' | 'name'; readonly required: 'code' | 'form' | 'id' | 'name' };
  readonly StatusEventDto: { readonly keys: 'axis' | 'expectedUntil' | 'from' | 'id' | 'occurredAt' | 'reasonCode' | 'reasonText' | 'recordedByUserId' | 'requestId' | 'source' | 'sourceRefId' | 'to' | 'v2Code'; readonly required: 'axis' | 'expectedUntil' | 'from' | 'id' | 'occurredAt' | 'reasonCode' | 'reasonText' | 'recordedByUserId' | 'requestId' | 'source' | 'sourceRefId' | 'to' | 'v2Code' };
  readonly StatusEventListDto: { readonly keys: 'items' | 'nextCursor'; readonly required: 'items' | 'nextCursor' };
  readonly TransferDto: { readonly keys: 'occurredAt' | 'override' | 'reasonCode' | 'toCareSpaceId'; readonly required: 'toCareSpaceId' };
  readonly TypologyRuleDto: { readonly keys: 'function' | 'rule' | 'typology'; readonly required: 'function' | 'rule' | 'typology' };
  readonly V2MapRuleDto: { readonly keys: 'condition' | 'order' | 'v2Code'; readonly required: 'condition' | 'order' | 'v2Code' };
}
