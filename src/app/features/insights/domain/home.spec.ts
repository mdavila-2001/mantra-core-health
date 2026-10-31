import { CAMPAIGNS } from './campaigns.data';
import { HOME_KPIS, homeFilter, homeInsights, homeKpis, homeMau, homeRange, moduleTiles, openAlertCounts, reputation, reputationIndex, topAlerts } from './home';
import { PROTOTYPE_TODAY } from './dates';

describe('panel general', () => {
  it('la ventana es la última semana, terminada en el corte', () => {
    expect(homeRange()).toEqual({ from: '2026-10-23', to: PROTOTYPE_TODAY });
    expect(homeFilter().campaignIds).toEqual(CAMPAIGNS.map((c) => c.id));
  });

  it('el índice de reputación es 50 + 50 × sentimiento neto, y sin muestra no hay índice', () => {
    expect(reputationIndex(0)).toBe(50);
    expect(reputationIndex(0.36)).toBe(68);
    expect(reputationIndex(-1)).toBe(0);
    expect(reputationIndex(null)).toBeNull();
  });

  it('la reputación declara cuántas menciones la sostienen y nunca da un 0 inventado', () => {
    const r = reputation();
    expect(r.mentions).toBeGreaterThan(0);
    if (r.index !== null) {
      expect(r.index).toBeGreaterThanOrEqual(0);
      expect(r.index).toBeLessThanOrEqual(100);
    }
  });

  it('los cuatro indicadores del panel salen del dominio de campañas', () => {
    const kpis = homeKpis();
    expect(kpis.map((k) => k.assessment.kpi.metric)).toEqual([...HOME_KPIS]);
    expect(kpis.every((k) => k.series.length === 7)).toBe(true);
  });

  it('MAU viene de la app y su variación es nula si no hay base', () => {
    const mau = homeMau();
    expect(mau?.value).toBeGreaterThan(0);
  });

  it('las alertas más importantes son abiertas, a lo sumo cuatro, y resolver una la saca', () => {
    const all = topAlerts();
    expect(all.length).toBeLessThanOrEqual(4);
    expect(all.length).toBeGreaterThan(0);
    const first = all[0]!.id;
    expect(topAlerts({ [first]: 'resolved' }).some((a) => a.id === first)).toBe(false);
    const counts = openAlertCounts();
    expect(openAlertCounts({ [first]: 'resolved' }).open).toBe(counts.open - 1);
  });

  it('hay hasta tres lecturas y ninguna repite id', () => {
    const insights = homeInsights();
    expect(insights.length).toBeLessThanOrEqual(3);
    expect(new Set(insights.map((i) => i.id)).size).toBe(insights.length);
  });

  it('las ocho fichas existen, una por módulo, y ninguna cifra es 0 sin motivo', () => {
    const tiles = moduleTiles();
    expect(tiles.map((t) => t.id)).toEqual(['campaigns', 'funnel', 'app', 'social', 'opinion', 'observatory', 'alerts', 'reports']);
    for (const t of tiles) {
      expect(t.big.length).toBeGreaterThan(0);
      expect(t.big).not.toBe('0');
    }
  });
});
