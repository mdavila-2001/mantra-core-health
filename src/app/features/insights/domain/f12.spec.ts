import { describe, expect, it } from 'vitest';

import { INSIGHTS_MODULES } from '../insights-nav';
import { METRIC_CATALOG } from './metric-catalog';

describe('marco', () => {
  it('la barra inferior usa módulos que existen', () => {
    for (const id of ['home', 'campaigns', 'alerts']) expect(INSIGHTS_MODULES.some((m) => m.id === id)).toBe(true);
  });
  it('el glosario cubre cada métrica con definición y decisión', () => {
    for (const m of Object.values(METRIC_CATALOG)) {
      expect(m.definition.length).toBeGreaterThan(0);
      expect(m.decision.length).toBeGreaterThan(0);
    }
  });
});
