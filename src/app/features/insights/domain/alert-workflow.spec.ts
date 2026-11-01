import type { InsightsAlertRule } from '../../../core/data-access/insights/insights.types';
import { isOpen, priorityOf, ruleOf, snapshotOf, visibleByRules } from './alert-workflow';
import { buildAlerts } from './alerts';

const rule = (code: InsightsAlertRule['code'], enabled: boolean): InsightsAlertRule => ({ code, name: code, description: null, severity: 'risk', unit: 'percent', threshold: 10, defaultThreshold: 10, direction: '+', enabled, rowVersion: 1 });

describe('flujo de trabajo de alertas', () => {
  it('solo «nuevo» y «en revisión» siguen pidiendo atención', () => {
    expect(isOpen('new')).toBe(true);
    expect(isOpen('in_progress')).toBe(true);
    expect(isOpen('resolved')).toBe(false);
    expect(isOpen('dismissed')).toBe(false);
  });

  it('cada familia de alertas cuelga de su regla y las demás no tienen', () => {
    expect(ruleOf({ id: 'cost-c3', severity: 'critical' })).toBe('cac');
    expect(ruleOf({ id: 'ctr-c2-tiktok', severity: 'anomaly' })).toBe('ctrspike');
    expect(ruleOf({ id: 'ctr-c2-tiktok', severity: 'risk' })).toBe('ctrdrop');
    expect(ruleOf({ id: 'onboarding-c1', severity: 'risk' })).toBe('onb');
    expect(ruleOf({ id: 'sent-verification', severity: 'risk' })).toBe('neg');
    expect(ruleOf({ id: 'response-backlog', severity: 'risk' })).toBeNull();
  });

  it('una regla apagada oculta sus alertas y deja las demás', () => {
    const all = buildAlerts();
    const rules = [rule('cac', false), rule('onb', true)];
    const shown = visibleByRules(all, rules);
    expect(shown.some((a) => ruleOf(a) === 'cac')).toBe(false);
    expect(shown.length).toBe(all.filter((a) => ruleOf(a) !== 'cac').length);
  });

  it('con todas las reglas activas no se oculta nada', () => {
    const all = buildAlerts();
    expect(visibleByRules(all, [rule('cac', true)]).length).toBe(all.length);
  });

  it('el snapshot que se manda al API lleva lo que hace falta para darla de alta', () => {
    const a = buildAlerts()[0]!;
    const s = snapshotOf(a);
    expect(s.title).toBe(a.title);
    expect(s.detectedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(s.priority).toBe(priorityOf(a));
  });
});
