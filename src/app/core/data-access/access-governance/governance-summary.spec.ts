import { attentionItems, tileViews, type GovernanceTileId } from './governance-summary';
import type { GovernanceTiles } from './governance-reports.types';

const CALMA: GovernanceTiles = {
  peopleWithLiveAccess: 9,
  highRiskGrants: 0,
  overdueCertifications: 0,
  ownerlessAccounts: 0,
  inactiveAccounts: 0,
  activeSodExceptions: 0,
  pendingApprovalsOver24h: 0,
  openAnomalies: 0,
  grantsAboveCeiling: 0,
  breakGlassUnreviewed: 0,
};

describe('governance-summary', () => {
  it('arma los diez mosaicos en un orden estable, cada uno con su destino', () => {
    const views = tileViews(CALMA);
    expect(views).toHaveLength(10);
    expect(new Set(views.map((v) => v.id)).size).toBe(10);
    for (const v of views) {
      expect(v.route.startsWith('/')).toBe(true);
      expect(v.label.length).toBeGreaterThan(3);
    }
  });

  it('con todo en cero no hay nada que atender y cada mosaico dice «en orden» con texto, no solo con color', () => {
    const views = tileViews(CALMA);
    expect(attentionItems(CALMA)).toEqual([]);
    for (const v of views.filter((x) => x.id !== 'peopleWithLiveAccess')) {
      expect(v.tone).toBe('ok');
      expect(v.statusText).toBe('En orden');
    }
    expect(views.find((v) => v.id === 'peopleWithLiveAccess')?.tone).toBe('info');
  });

  it('un valor distinto de cero cambia el semáforo y el texto, con plural correcto', () => {
    const uno = tileViews({ ...CALMA, overdueCertifications: 1 }).find((v) => v.id === 'overdueCertifications')!;
    const tres = tileViews({ ...CALMA, overdueCertifications: 3 }).find((v) => v.id === 'overdueCertifications')!;
    expect(uno.tone).toBe('risk');
    expect(uno.statusText).toBe('Requiere atención');
    expect(uno.description).toContain('1 certificación vencida');
    expect(tres.description).toContain('3 certificaciones vencidas');
  });

  it('«Lo que necesita su atención hoy» trae como máximo cinco acciones, las de más riesgo primero', () => {
    const todo: GovernanceTiles = { ...CALMA, highRiskGrants: 4, overdueCertifications: 3, ownerlessAccounts: 1, inactiveAccounts: 2, activeSodExceptions: 1, pendingApprovalsOver24h: 2, openAnomalies: 2, grantsAboveCeiling: 1, breakGlassUnreviewed: 1 };
    const items = attentionItems(todo);
    expect(items).toHaveLength(5);
    const ids: GovernanceTileId[] = items.map((i) => i.id);
    expect(ids.indexOf('breakGlassUnreviewed')).toBeLessThan(ids.indexOf('ownerlessAccounts') === -1 ? 99 : ids.indexOf('ownerlessAccounts'));
    expect(items.every((i) => i.actionLabel.length > 0 && i.route.startsWith('/'))).toBe(true);
    expect(items[0]!.tone).toBe('risk');
  });

  it('tolera una respuesta incompleta de la API (campo ausente = cero)', () => {
    const views = tileViews({ peopleWithLiveAccess: 2 } as unknown as GovernanceTiles);
    expect(views.find((v) => v.id === 'openAnomalies')?.value).toBe(0);
  });
});
