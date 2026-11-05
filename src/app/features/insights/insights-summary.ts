import { buildAlerts } from './domain/alerts';

/** Cantidad de alertas críticas o de riesgo abiertas, para la insignia del menú. */
export function openAlertCount(): number {
  return buildAlerts().filter((a) => a.status === 'open' && (a.severity === 'critical' || a.severity === 'risk')).length;
}
