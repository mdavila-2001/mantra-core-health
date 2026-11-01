export interface TenantSimulado {
  readonly id: string;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName: string;
  readonly tenantTypeConceptId: string;
  readonly statusConceptId: string;
  readonly verificationStatusConceptId: string;
  readonly parentTenantId: string | null;
  readonly createdAt: string;
  readonly timeZone: string;
}
