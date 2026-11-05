import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { AuthzClient } from '../../../core/data-access/authz/authz.client';
import type { AccessRequestItem, CareRelationshipDecision } from '../../../core/data-access/authz/authz.types';
import { PractitionerAccessClient } from '../../../core/data-access/consent/practitioner-access.client';
import type { InboxRole } from './access-requests.copy';

/**
 * Which endpoint answers each inbox action. The kind of request decides it:
 * the access by specialty lives in `consent`, the primary practitioner and the
 * care episode in `authz`, and the practitioner answers by his own route.
 */
@Injectable({ providedIn: 'root' })
export class AccessRequestActions {
  private readonly authz = inject(AuthzClient);
  private readonly granular = inject(PractitionerAccessClient);

  list(role: InboxRole): Observable<readonly AccessRequestItem[]> {
    return role === 'practitioner' ? this.authz.listPractitionerAccessRequests() : this.authz.listMyAccessRequests();
  }

  /** `specialtyIds` only counts for a granular request the patient accepts. */
  decide(
    role: InboxRole,
    item: AccessRequestItem,
    decision: CareRelationshipDecision,
    specialtyIds: readonly string[],
  ): Observable<unknown> {
    if (role === 'practitioner') {
      return this.authz.respondAsPractitioner(item.id, decision);
    }
    if (item.kind === 'GRANULAR') {
      const accepted = decision === 'ACCEPT';
      return this.granular.decide(item.id, {
        decision: accepted ? 'ACCEPTED' : 'DECLINED',
        authorizedSpecialtyConceptIds: accepted ? specialtyIds : [],
      });
    }
    return this.authz.respondToCareRelationshipRequest(item.id, { decision });
  }

  /** Only the patient revokes, and only what is active. */
  revoke(item: AccessRequestItem): Observable<unknown> {
    return item.kind === 'GRANULAR'
      ? this.granular.revoke(item.id)
      : this.authz.revokeMyCareRelationship(item.id);
  }
}
