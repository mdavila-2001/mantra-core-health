/* ============================================================================
    Gobierno de accesos: la superficie pública de `core/data-access/access-governance`.

    Una pantalla importa de acá y no de cada archivo. Los clientes son `providedIn: 'root'`.
   ========================================================================== */
export * from './access-approvals.client';
export * from './access-errors';
export * from './access-explain.client';
export * from './access-explain.types';
export * from './access-governance.client';
export * from './access-governance.types';
export * from './access-lifecycle.client';
export * from './access-reviews.client';
export * from './conditions.types';
export * from './step-up.client';
export * from './team-admin.client';
export * from './governance-summary';
export type { AtomGrantChange, NewAtomGrant, SupportActionInput } from '../support-access/support-atom-grants.types';
