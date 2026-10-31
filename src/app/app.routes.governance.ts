import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { ErrorRecovery } from './features/error-recovery/error-recovery';
import { seccionRolesGuard } from './core/navigation/section-roles.guard';
import { APP_TITLE } from './core/navigation/navigation.types';

/* ============================================================================
    Las rutas del **gobierno de accesos** (CONTRATO-GOBIERNO §9.3 y §9.7), en su propio archivo para no engordar
    `app.routes.ts` (congelado por `check-max-lines`).

    Cada pantalla cuelga de una sección del registro (`navigation.support.ts`) y hereda su regla de rol por prefijo,
    como `pantallaDeOperacion` en `app.routes.ts`: `seccionRolesGuard` explícito, título «AloVida - …» y carga diferida
    con la pantalla de recuperación si el fragmento no baja. Cada pantalla vive en su carpeta de
    `features/access-governance/` y la reemplaza su agente; el orden importa (los segmentos fijos, antes que los parámetros).

    Los guards **no autorizan**: ocultan menú y evitan una pantalla intermedia. La API decide en cada petición.
   ========================================================================== */

function pantalla(seccion: string, subpath: string, titulo: string, loader: () => Promise<Type<unknown>>): Routes[number] {
  return {
    path: `${seccion}/${subpath}`,
    title: `${APP_TITLE} - ${titulo}`,
    canActivate: [seccionRolesGuard],
    loadComponent: () => loader().catch(() => ErrorRecovery),
  };
}

/** Las 18 rutas hijas del gobierno de accesos (16 pantallas distintas y dos accesos del doctor), sin contar las tres secciones (que cargan por `PANTALLAS_DIFERIDAS`). */
export const RUTAS_DE_GOBIERNO: Routes = [
    // Gobierno de accesos (fase 5). Cada pantalla vive en su carpeta de `features/access-governance/` y la reemplaza su
    // agente; la ruta, el título y el guard de rol (por prefijo de sección) quedan como están. Los segmentos fijos van antes
    // que los parámetros.
    pantalla('administration/access-governance', 'matrix', 'Matriz de accesos', () =>
      import('./features/access-governance/access-matrix/access-matrix').then((m) => m.AccessMatrix),
    ),
    pantalla('administration/access-governance', 'anomalies', 'Anomalías de acceso', () =>
      import('./features/access-governance/anomalies/anomalies').then((m) => m.Anomalies),
    ),
    pantalla('administration/access-governance', 'campaigns', 'Campañas de certificación', () =>
      import('./features/access-governance/campaigns/campaign-list/campaign-list').then((m) => m.CampaignList),
    ),
    pantalla('administration/access-governance', 'campaigns/new', 'Nueva campaña de certificación', () =>
      import('./features/access-governance/campaigns/campaign-wizard/campaign-wizard').then((m) => m.CampaignWizard),
    ),
    pantalla('administration/access-governance', 'campaigns/:campaignId', 'Seguimiento de la campaña', () =>
      import('./features/access-governance/campaigns/campaign-detail/campaign-detail').then((m) => m.CampaignDetail),
    ),
    pantalla('administration/access-governance', 'sod', 'Separación de funciones', () =>
      import('./features/access-governance/sod/sod').then((m) => m.Sod),
    ),
    pantalla('administration/access-governance', 'rules', 'Barandillas de la organización', () =>
      import('./features/access-governance/rules/rules').then((m) => m.Rules),
    ),
    pantalla('administration/access-governance', 'approvals', 'Aprobaciones de cuatro ojos', () =>
      import('./features/access-governance/approvals/approvals').then((m) => m.Approvals),
    ),
    pantalla('administration/access-governance', 'lifecycle', 'Ciclo de vida del equipo', () =>
      import('./features/access-governance/lifecycle/lifecycle-list/lifecycle-list').then((m) => m.LifecycleList),
    ),
    pantalla('administration/access-governance', 'lifecycle/:caseId', 'Caso de ciclo de vida', () =>
      import('./features/access-governance/lifecycle/lifecycle-case/lifecycle-case').then((m) => m.LifecycleCase),
    ),
    pantalla('administration/access-governance', 'simulator', 'Simulador de permisos', () =>
      import('./features/access-governance/simulator/simulator').then((m) => m.Simulator),
    ),
    pantalla('administration/support-team', ':engagementId/move', 'Cambiar de rol o alcance', () =>
      import('./features/access-governance/lifecycle/move-dialog/move-dialog').then((m) => m.MoveEngagement),
    ),
    pantalla('administration/support-team', ':engagementId/offboard', 'Dar de baja con traspaso', () =>
      import('./features/access-governance/lifecycle/offboard-dialog/offboard-dialog').then((m) => m.OffboardEngagement),
    ),
    pantalla('administration/team-management', ':memberId', 'Persona de mi equipo', () =>
      import('./features/access-governance/team-management/team-member/team-member').then((m) => m.TeamMember),
    ),
    pantalla('my-reviews', ':itemId', 'Revisión de un acceso', () =>
      import('./features/access-governance/my-reviews/my-reviews').then((m) => m.MyReviews),
    ),
    // «Aprobaciones» del doctor: la misma pantalla que la del administrador, en «Mi equipo».
    // El doctor llega a sus revisiones por «Mi equipo»: su menú es una lista cerrada y «Mis revisiones» no entra.
    pantalla('my-team', 'reviews', 'Mis revisiones', () =>
      import('./features/access-governance/my-reviews/my-reviews').then((m) => m.MyReviews),
    ),
    pantalla('my-team', 'reviews/:itemId', 'Revisión de un acceso', () =>
      import('./features/access-governance/my-reviews/my-reviews').then((m) => m.MyReviews),
    ),
    pantalla('my-team', 'approvals', 'Aprobaciones de mi equipo', () =>
      import('./features/access-governance/approvals/approvals').then((m) => m.Approvals),
    ),
];
