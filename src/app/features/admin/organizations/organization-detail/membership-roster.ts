import type { MembershipListItem } from '../../../../core/data-access/directory/directory.types';
import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { membershipNewRoute } from '../organizations.routes';

/** The API lists every status; these concept codes decide what the roster shows. */
/** `DIR_MEMBERSHIP_INVITED` is what the API sends; `..._PENDING_ACCEPTANCE` is the simulator's name for the same state. */
const PENDING_CODES: readonly string[] = ['DIR_MEMBERSHIP_INVITED', 'DIR_MEMBERSHIP_PENDING_ACCEPTANCE'];
const ENDED = 'DIR_MEMBERSHIP_ENDED';
/** Support staff is a ROLE in the API (`DIR_ROLE_SUPPORT`), not a membership status. */
const SUPPORT_ROLE = 'DIR_ROLE_SUPPORT';

/** An invitation the person has not accepted yet. */
export function isPendingInvitation(statusCode: string | undefined): boolean {
  return statusCode !== undefined && PENDING_CODES.includes(statusCode);
}

/** An invited person is not a member yet, and a support link is not part of the staff: no member actions on either (the API answers 412). */
export function isManageable(statusCode: string | undefined, roleCode?: string): boolean {
  return !isPendingInvitation(statusCode) && roleCode !== SUPPORT_ROLE;
}

/** The roster without the ended memberships (a declined or withdrawn invitation leaves one behind). */
export function visibleRoster(
  state: ViewState<readonly MembershipListItem[]>,
  codeOf: (statusConceptId: string) => string | undefined,
  tenantId: string,
): ViewState<readonly MembershipListItem[]> {
  if (state.status !== 'ready') return state;
  const rows = state.data.filter((m) => codeOf(m.statusConceptId) !== ENDED);
  if (rows.length === state.data.length) return state;
  return rows.length > 0
    ? ready(rows)
    : empty({ label: 'Sumar a alguien', route: membershipNewRoute(tenantId) }, 'Nadie con membresía vigente ni invitado.');
}
