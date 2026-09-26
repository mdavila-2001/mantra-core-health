/**
 * «Mi cobertura» (`GET /patient-coverages/me`, CV-11): las coberturas que el
 * paciente tiene registradas, tal como las expone `insurance.patient_coverages`.
 *
 * Los estados viajan como identificador de concepto. El plan llega como id
 * (`insurancePlanId`): la API no publica todavía una lectura de plan para el
 * paciente, así que el **nombre** de la aseguradora y del plan sale de la ficha
 * propia (`OwnCoverage`) cuando el id coincide, y si no coincide se dice sin
 * inventarlo.
 */
export interface MyCoverage {
  readonly id: string;
  readonly insurancePlanId: string;
  readonly insuranceBrokerId?: string;
  readonly memberIdentifier: string;
  readonly policyIdentifier?: string;
  /** 1 = primaria, 2 = secundaria… Es el orden en que se cobra a cada seguro. */
  readonly coverageOrder?: number;
  readonly relationshipToSubscriberConceptId?: string;
  readonly effectiveFrom?: Date;
  readonly effectiveTo?: Date;
  readonly verificationStatusConceptId: string;
  readonly statusConceptId: string;
  readonly createdAt: Date;
}
