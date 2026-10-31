import type { ActionConditions, SupportCondition } from '../../data-access/access-governance/conditions.types';
import type {
  ExpansionMode,
  SupportActionCode,
  SupportEngagementOrigin,
  SupportEngagementRequest,
  SupportEngagementStatus,
  SupportOwnerKind,
  SupportRequestItem,
  SupportRoleTemplateCode,
  SupportScopeTarget,
} from '../../data-access/support-access/support-access.types';

/* ============================================================================
    Las filas de estado del hospital piloto que comparten `support-hospital.ts`
    y `support-hospital-review.ts`. Viven aparte para que ninguno importe del otro:
    `support-hospital.ts` las reexporta, así que quien las importaba de allá sigue igual.
   ========================================================================== */

export interface FilaVinculo {
  readonly id: string;
  readonly tenantId: string;
  readonly ownerKind: SupportOwnerKind;
  readonly userId: string;
  readonly personName: string;
  readonly personEmail: string;
  readonly roleTemplate: SupportRoleTemplateCode;
  readonly status: SupportEngagementStatus;
  readonly origin: SupportEngagementOrigin;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly recertifyEveryMonths: 6 | 12;
  readonly nextRecertificationAt: string;
  readonly endedReason?: string;
  readonly suspendedAt?: string;
  readonly lastConfirmedAt?: string;
  readonly lastConfirmedBy?: 'PERSON' | 'ORGANIZATION';
}

export interface FilaPermiso extends SupportScopeTarget {
  readonly id: string;
  readonly engagementId: string;
  readonly expansionMode: ExpansionMode;
  readonly actions: readonly SupportActionCode[];
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  /**
   * Gobierno de accesos (fase 5): la concesión escrita con átomos. `atoms`, `effect`, `condition` y `actionConditions` ya
   * viajan en la respuesta de los permisos; sin ellos la fila es un alias antiguo (`origin: 'LEGACY'`).
   */
  readonly effect?: 'ALLOW' | 'DENY';
  readonly atoms?: readonly string[];
  readonly condition?: SupportCondition;
  readonly actionConditions?: ActionConditions;
  readonly reasonText?: string;
}

export interface FilaSolicitud extends Omit<SupportEngagementRequest, 'items' | 'organizationName'> {
  readonly items: readonly SupportRequestItem[];
}

export interface FilaBitacora {
  readonly id: string;
  readonly tenantId: string;
  readonly occurredAt: string;
  readonly actorName: string;
  readonly action: string;
  readonly summary: string;
  readonly doctorId?: string;
  readonly patientLabel?: string;
}
