import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { API_BASE_URL } from '../../data-access/api';
import { InsightsWorkspaceClient } from '../../data-access/insights/insights-workspace.client';
import type { InsightsAlertSnapshot, PutReportBody } from '../../data-access/insights/insights.types';
import { mockBackendInterceptor } from '../mock-backend.interceptor';

const SNAPSHOT: InsightsAlertSnapshot = { severity: 'risk', title: 'El CPM de Facebook subió', whatText: 'Sube 28 %', detectedOn: '2026-10-29', moduleCode: 'campaigns', priority: 2 };
const REPORT: PutReportBody = { title: 'Informe', type: 'executive', audience: 'direction', periodFrom: '2026-10-01', periodTo: '2026-10-29', campaignIds: ['c1'], channels: [], sections: ['kpis'] };

describe('simulador de lo que las personas hacen en Insights', { timeout: 60_000 }, () => {
  const original = environment.mockBackend;
  beforeAll(() => Object.assign(environment, { mockBackend: true }));
  afterAll(() => Object.assign(environment, { mockBackend: original }));

  let c: InsightsWorkspaceClient;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([mockBackendInterceptor])), { provide: API_BASE_URL, useValue: environment.apiBaseUrl }] });
    c = TestBed.inject(InsightsWorkspaceClient);
  });

  const put = (fp: string, status: 'new' | 'in_progress' | 'resolved' | 'dismissed', version: number | null, owner: 'marketing' | null = null) =>
    firstValueFrom(c.putAlertWorkflow(fp, { status, ownerTeam: owner, snapshot: SNAPSHOT }, version));

  it('una alerta se da de alta al primer cambio y deja una transición', async () => {
    const res = await put('cost-c3', 'in_progress', null, 'marketing');
    expect(res.data.rowVersion).toBe(1);
    expect(res.data.transitions).toHaveLength(1);
    expect(res.data.transitions[0]).toMatchObject({ fromStatus: null, toStatus: 'in_progress', toOwner: 'marketing' });
    const list = await firstValueFrom(c.listAlertWorkflow());
    expect(list.data).toHaveLength(1);
  });

  it('el estado persiste: una lectura nueva lo devuelve', async () => {
    await put('cost-c3', 'resolved', null);
    const again = await firstValueFrom(c.listAlertWorkflow());
    expect(again.data[0]?.status).toBe('resolved');
  });

  it('NEGATIVO: con la versión vieja el cambio se rechaza (412) y no pisa nada', async () => {
    await put('cost-c3', 'in_progress', null);
    await expect(put('cost-c3', 'resolved', 0)).rejects.toMatchObject({ status: 412 });
    const list = await firstValueFrom(c.listAlertWorkflow());
    expect(list.data[0]?.status).toBe('in_progress');
  });

  it('repetir el mismo estado no suma versión ni transición', async () => {
    const first = await put('cost-c3', 'in_progress', null);
    const again = await put('cost-c3', 'in_progress', first.data.rowVersion);
    expect(again.data.rowVersion).toBe(first.data.rowVersion);
    expect(again.data.transitions).toHaveLength(1);
  });

  it('NEGATIVO: un estado o un responsable desconocidos son un 400', async () => {
    await expect(firstValueFrom(c.putAlertWorkflow('x', { status: 'wat' as never, ownerTeam: null, snapshot: SNAPSHOT }, null))).rejects.toMatchObject({ status: 400 });
    await expect(firstValueFrom(c.putAlertWorkflow('x', { status: 'new', ownerTeam: 'ventas' as never, snapshot: SNAPSHOT }, null))).rejects.toMatchObject({ status: 400 });
  });

  it('las siete reglas se pueden apagar y el umbral vive entre 1 y 500', async () => {
    const rules = (await firstValueFrom(c.listAlertRules())).data;
    expect(rules).toHaveLength(7);
    const cac = rules.find((r) => r.code === 'cac')!;
    const off = await firstValueFrom(c.patchAlertRule('cac', { enabled: false }, cac.rowVersion));
    expect(off.data.enabled).toBe(false);
    await expect(firstValueFrom(c.patchAlertRule('cac', { threshold: 501 }, off.data.rowVersion))).rejects.toMatchObject({ status: 400 });
    await expect(firstValueFrom(c.patchAlertRule('cac', { threshold: 30 }, cac.rowVersion))).rejects.toMatchObject({ status: 412 });
  });

  it('las vistas guardadas no repiten nombre y reintentar el mismo id no duplica', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    await firstValueFrom(c.putSavedView(id, { name: 'Mi vista', url: '/insights/campaigns?c=c1' }));
    await firstValueFrom(c.putSavedView(id, { name: 'Mi vista', url: '/insights/campaigns?c=c1' }));
    expect((await firstValueFrom(c.listSavedViews())).data).toHaveLength(1);
    await expect(firstValueFrom(c.putSavedView('22222222-2222-4222-8222-222222222222', { name: 'mi vista', url: '/insights/home' }))).rejects.toMatchObject({ status: 409 });
    await expect(firstValueFrom(c.putSavedView('33333333-3333-4333-8333-333333333333', { name: 'x', url: 'https://otro.sitio' }))).rejects.toMatchObject({ status: 400 });
  });

  it('el historial de informes guarda 12 y el 13.º expulsa el más viejo', async () => {
    for (let i = 0; i < 13; i += 1) {
      await firstValueFrom(c.putReport(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, { ...REPORT, title: `Informe ${i}` }));
    }
    const list = (await firstValueFrom(c.listReports())).data;
    expect(list).toHaveLength(12);
    expect(list.some((r) => r.title === 'Informe 0')).toBe(false);
    expect(list[0]?.title).toBe('Informe 12');
  });

  it('las preferencias de aviso dicen que nada se envía', async () => {
    const n = (await firstValueFrom(c.getNotificationPreferences())).data;
    expect(n.nothingIsSent).toBe(true);
    const saved = await firstValueFrom(c.putNotificationPreferences({ ...n, frequency: 'daily_digest' }, n.rowVersion));
    expect(saved.data.frequency).toBe('daily_digest');
    expect(saved.data.nothingIsSent).toBe(true);
  });
});
