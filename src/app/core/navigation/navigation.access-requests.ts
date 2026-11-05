import { ANY_ROLE, type AppSection } from './navigation.types';

/*
 * «Buzón de solicitudes» (care-relationship requests, FT-07-R06) now lives as
 * the «Solicitudes de vínculo» tab of «Mis solicitudes» (owner, 04/11/2026).
 * The old path redirects in `app.routes.ts` (`SECCIONES_REDIRIGIDAS`); the
 * section stays registered so that redirect resolves. It lives in its own file
 * because `navigation.map.ts` is frozen by `scripts/check-max-lines.mjs`.
 */
export const ACCESS_REQUESTS_SECTIONS: readonly AppSection[] = [
  {
    path: 'my-account/access-requests',
    fueraDelMenuPara: [ANY_ROLE],
    label: 'Buzón de solicitudes',
    group: 'Mi cuenta',
    icon: 'mail',
    roles: [ANY_ROLE],
    availability: 'disponible',
    summary: 'Solicitudes de vínculo asistencial.',
    module: 'M06 authz',
  },
];
