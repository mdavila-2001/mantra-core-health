import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { API_BASE_URL } from '../../data-access/api';
import { InsightsClient } from '../../data-access/insights/insights.client';
import type { InsightsFactsQuery } from '../../data-access/insights/insights.types';
import { mockBackendInterceptor } from '../mock-backend.interceptor';
import { MOCK_CUTOFF } from './insights/catalog.dataset';

describe('simulador de AloVida Insights', { timeout: 60_000 }, () => {
  const originalMockBackend = environment.mockBackend;
  beforeAll(() => Object.assign(environment, { mockBackend: true }));
  afterAll(() => Object.assign(environment, { mockBackend: originalMockBackend }));

  let client: InsightsClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockBackendInterceptor])),
        { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
      ],
    });
    client = TestBed.inject(InsightsClient);
    TestBed.inject(HttpClient);
  });

  const facts = (q: InsightsFactsQuery) => firstValueFrom(client.getCampaignFacts(q));

  it('el catálogo trae las cuatro campañas del prototipo y seis hitos, declarados como demo', async () => {
    const res = await firstValueFrom(client.getCatalog());
    expect(res.data.campaigns.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    expect(res.data.milestones).toHaveLength(6);
    expect(res.meta.dataset).toBe('demo');
    expect(res.meta.cutoff).toBe(MOCK_CUTOFF);
    expect(res.meta.notice).toContain('sintéticos');
  });

  it('los hechos respetan la ventana y los filtros', async () => {
    const res = await facts({ from: '2026-10-01', to: '2026-10-07', campaignIds: ['c1'], channels: ['google'] });
    expect(res.data.length).toBe(7);
    expect(res.data.every((f) => f.campaignId === 'c1' && f.channel === 'google')).toBe(true);
    expect(res.data.every((f) => f.date >= '2026-10-01' && f.date <= '2026-10-07')).toBe(true);
    expect(res.meta.window).toEqual({ from: '2026-10-01', to: '2026-10-07' });
  });

  it('NEGATIVO: una ventana de más de 92 días se rechaza como validación', async () => {
    await expect(facts({ from: '2026-06-01', to: '2026-10-29' })).rejects.toMatchObject({ status: 400 });
  });

  it('NEGATIVO: una ventana invertida se rechaza', async () => {
    await expect(facts({ from: '2026-10-10', to: '2026-10-01' })).rejects.toMatchObject({ status: 400 });
  });

  /**
   * Suma de control del generador. El modelo (`gen_seeds.py`) debe sembrar EXACTAMENTE las mismas
   * cifras: si cambia la narrativa, cambia esta constante y la del modelo en la misma franja.
   */
  it('PARIDAD: la suma de control de los hechos de ejemplo no cambia', async () => {
    const res = await facts({ from: '2026-09-01', to: '2026-10-29' });
    const total = res.data.reduce(
      (acc, f) => ({
        rows: acc.rows + 1,
        impressions: acc.impressions + f.impressions,
        clicks: acc.clicks + f.clicks,
        registrations: acc.registrations + f.registrations,
        conversions: acc.conversions + f.conversions,
        spendCents: acc.spendCents + f.spendCents,
      }),
      { rows: 0, impressions: 0, clicks: 0, registrations: 0, conversions: 0, spendCents: 0 },
    );
    expect(total).toEqual({
      rows: 735,
      impressions: 5_455_307,
      clicks: 152_886,
      registrations: 9_116,
      conversions: 2_454,
      spendCents: 10_412_901,
    });
  });
});
