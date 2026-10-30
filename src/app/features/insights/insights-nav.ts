import type { NavIconName } from '../../shared/components/atoms/nav-icon/nav-icon.types';
import type { InsightModuleId } from './domain/insights.types';

/** Base de las rutas de AloVida Insights. */
export const INSIGHTS_BASE = '/administration/marketing-insights';

export interface InsightsModule {
  readonly id: InsightModuleId;
  readonly number: string;
  readonly path: string;
  readonly label: string;
  /** Nombre corto para la barra lateral contraída y el móvil. */
  readonly short: string;
  readonly icon: NavIconName;
  /** La pregunta de negocio que responde: cada módulo responde una distinta. */
  readonly question: string;
}

export const INSIGHTS_MODULES: readonly InsightsModule[] = [
  { id: 'campaigns', number: '01', path: 'campaigns', label: 'Resumen de campañas', short: 'Campañas', icon: 'megaphone', question: '¿Cómo funcionó nuestra campaña?' },
  { id: 'funnel', number: '02', path: 'funnel', label: 'Embudo y experiencia del paciente', short: 'Embudo', icon: 'route', question: '¿Estamos convirtiendo y entregando una buena experiencia?' },
  { id: 'app', number: '03', path: 'app-usage', label: 'Uso de la app', short: 'App', icon: 'grid', question: '¿Qué hacen realmente nuestros usuarios?' },
  { id: 'social', number: '04', path: 'social', label: 'Redes sociales', short: 'Redes', icon: 'share', question: '¿Qué está pasando objetivamente en nuestras redes?' },
  { id: 'opinion', number: '05', path: 'opinion', label: 'Opinión pública', short: 'Opinión', icon: 'chat', question: '¿Qué piensa y dice la gente de AloVida?' },
  { id: 'reports', number: '06', path: 'reports', label: 'Generador de informes', short: 'Informes', icon: 'clipboard', question: '¿Cómo convertimos los datos en conocimiento comunicable?' },
  { id: 'observatory', number: '07', path: 'observatory', label: 'Observatorio de salud', short: 'Observatorio', icon: 'eye', question: '¿Qué está pasando en el ecosistema de salud?' },
  { id: 'alerts', number: '08', path: 'alerts', label: 'Alertas de marketing', short: 'Alertas', icon: 'bell', question: '¿Qué requiere nuestra atención ahora?' },
];

export const MODULE_BY_ID: ReadonlyMap<InsightModuleId, InsightsModule> = new Map(INSIGHTS_MODULES.map((m) => [m.id, m]));

export function moduleLink(id: InsightModuleId): string[] {
  const m = MODULE_BY_ID.get(id);
  return [INSIGHTS_BASE, m?.path ?? 'campaigns'];
}
