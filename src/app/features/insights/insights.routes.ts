import type { Route, Routes } from '@angular/router';

import { APP_TITLE } from '../../core/navigation/navigation.types';
import { INSIGHTS_MODULES, type InsightsModule } from './insights-nav';

const TITLE = `${APP_TITLE} - AloVida Insights`;

/** Cada módulo se descarga al entrar; el marco los contiene. */
const PAGES: Readonly<Record<InsightsModule['id'], NonNullable<Route['loadComponent']>>> = {
  home: () => import('./modules/home/home-page').then((m) => m.HomePage),
  campaigns: () => import('./modules/campaigns/campaigns-page').then((m) => m.CampaignsPage),
  funnel: () => import('./modules/funnel/funnel-page').then((m) => m.FunnelPage),
  app: () => import('./modules/app-usage/app-usage-page').then((m) => m.AppUsagePage),
  social: () => import('./modules/social/social-page').then((m) => m.SocialPage),
  opinion: () => import('./modules/opinion/opinion-page').then((m) => m.OpinionPage),
  reports: () => import('./modules/reports/reports-page').then((m) => m.ReportsPage),
  observatory: () => import('./modules/observatory/observatory-page').then((m) => m.ObservatoryPage),
  alerts: () => import('./modules/alerts/alerts-page').then((m) => m.AlertsPage),
};

/**
 * Rutas relativas a `administration/marketing-insights`. El marco
 * (`InsightsShell`) las contiene; los roles los hereda de la sección.
 */
export const INSIGHTS_RUTAS: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  ...INSIGHTS_MODULES.map(
    (m): Route => ({ path: m.path, title: `${TITLE} - ${m.label}`, loadComponent: PAGES[m.id] }),
  ),
];
