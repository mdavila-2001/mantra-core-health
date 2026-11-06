import type { Type } from '@angular/core';

/**
 * Pantallas diferidas de Gobierno de Accesos y Soporte Asistencial (Secretaría/Apoyo).
 * Desacopladas de app.routes.ts bajo la reforma estructural lean.
 */
export const ACCESS_GOVERNANCE_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'administration/support-requests': () =>
    import('../support-access/support-requests/support-requests').then((m) => m.SupportRequests),
  'administration/support-team': () =>
    import('../support-access/support-team/support-team').then((m) => m.SupportTeam),
  'administration/support-access-lookup': () =>
    import('../support-access/access-lookup/access-lookup').then((m) => m.AccessLookup),
  'administration/support-invitations': () =>
    import('../support-access/invitations/invitations').then((m) => m.Invitations),
  'administration/session-controls': () =>
    import('../support-access/session-controls/session-controls').then((m) => m.SessionControls),
  'administration/support-review': () =>
    import('../support-access/support-review/support-review').then((m) => m.SupportReview),
  'administration/support-activity': () =>
    import('../support-access/support-activity/support-activity').then((m) => m.SupportActivity),
  'administration/access-governance': () =>
    import('./governance-home/governance-home').then((m) => m.GovernanceHome),
  'administration/team-management': () =>
    import('./team-management/team-management').then((m) => m.TeamManagement),
  'my-reviews': () =>
    import('./my-reviews/my-reviews').then((m) => m.MyReviews),
  'my-team': () =>
    import('../support-access/my-team/my-team').then((m) => m.MyTeam),
};
