import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import { vi } from 'vitest';

import {
  AccessGovernanceClient,
  type GovernanceSummary,
  type GovernanceTiles,
} from '../../../core/data-access/access-governance';
import { reiniciarElGobiernoDeAccesos } from '../../../core/mock/handlers/mock-reset';
import { auditarA11y, describirViolaciones } from '../../../../testing/a11y';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { GovernanceHome } from './governance-home';

const ZERO_TILES: GovernanceTiles = {
  peopleWithLiveAccess: 0,
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

const apiError = (
  status: number,
  code: string,
  message: string,
  reason?: string,
): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      code,
      message,
      correlationId: 'req-77',
      ...(reason === undefined ? {} : { reason, details: { reason } }),
      timestamp: '',
      path: '/x',
    },
  });

describe('GovernanceHome', () => {
  let fixture: ComponentFixture<GovernanceHome>;
  let client: AccessGovernanceClient;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => el().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const mount = async (
    summary?: () => ReturnType<AccessGovernanceClient['getSummary']>,
  ): Promise<void> => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideGovernanceMock('hospital_piloto')],
    });
    client = TestBed.inject(AccessGovernanceClient);
    if (summary !== undefined) vi.spyOn(client, 'getSummary').mockImplementation(summary);
    fixture = TestBed.createComponent(GovernanceHome);
    await settle();
  };

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });

  it('pide el resumen y pinta los diez mosaicos con su número, su estado en palabras y su enlace', async () => {
    await mount();
    expect(
      peticiones.filter((p) => p.method === 'GET' && p.path === '/org/governance/summary'),
    ).toHaveLength(1);
    const real = (await firstValueFrom(client.getSummary())).tiles;
    expect(el().querySelectorAll('[data-testid="governance-tiles"] li')).toHaveLength(10);
    for (const id of Object.keys(real) as (keyof GovernanceTiles)[]) {
      expect(byId(`governance-tile-value-${id}`)?.textContent?.trim(), id).toBe(String(real[id]));
      expect(byId(`governance-tile-status-${id}`)?.textContent?.trim().length, id).toBeGreaterThan(
        3,
      );
    }
    // El estado no depende solo del color: el texto lo dice.
    expect(byId('governance-tile-status-openAnomalies')?.textContent).toContain(
      'Requiere atención',
    );
    expect(byId('governance-tile-status-peopleWithLiveAccess')?.textContent).toContain(
      'Informativo',
    );
  });

  it('cada mosaico lleva a su lista filtrada', async () => {
    await mount();
    const href = (id: string): string | null => byId(`governance-tile-${id}`)!.getAttribute('href');
    expect(href('openAnomalies')).toBe('/administration/access-governance/anomalies');
    expect(href('peopleWithLiveAccess')).toBe('/administration/access-governance/matrix');
    expect(href('activeSodExceptions')).toBe(
      '/administration/access-governance/sod?tab=exceptions',
    );
    expect(href('ownerlessAccounts')).toBe('/administration/access-governance/lifecycle');
    expect(href('pendingApprovalsOver24h')).toBe('/administration/access-governance/approvals');
  });

  it('«Lo que necesita su atención hoy» trae como máximo cinco acciones, las de más riesgo primero, cada una con su botón', async () => {
    await mount();
    const items = Array.from(el().querySelectorAll('[data-testid="governance-attention"] ol > li'));
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items[0]!.textContent).toContain('Requiere atención');
    for (const item of items)
      expect(item.querySelector('a')?.getAttribute('href')).toMatch(/^\/administration\//);
  });

  it('si nada necesita atención, lo dice y ofrece un camino (con los mosaicos visibles)', async () => {
    await mount(() =>
      of({
        generatedAt: new Date().toISOString(),
        tiles: { ...ZERO_TILES, peopleWithLiveAccess: 7 },
      } satisfies GovernanceSummary),
    );
    expect(byId('governance-attention-empty')?.textContent).toContain('Todo en orden');
    expect(byId('governance-attention-empty')?.querySelector('a')?.getAttribute('href')).toBe(
      '/administration/access-governance/matrix',
    );
    expect(byId('governance-tile-value-peopleWithLiveAccess')?.textContent?.trim()).toBe('7');
  });

  it('S3: sin ninguna persona con acceso ni pendientes, la pantalla vacía propone invitar a alguien', async () => {
    await mount(() =>
      of({ generatedAt: new Date().toISOString(), tiles: ZERO_TILES } satisfies GovernanceSummary),
    );
    expect(el().textContent).toContain('Todavía no hay personas con acceso que gobernar.');
    expect(
      el().querySelector('a[href="/administration/support-invitations"]')?.textContent,
    ).toContain('Emita una invitación');
    expect(byId('governance-tiles')).toBeNull();
  });

  it('S7: un cálculo de hace horas se muestra con su antigüedad y se puede refrescar', async () => {
    const viejo = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const summary = vi.fn<() => Observable<GovernanceSummary>>(() =>
      of({ generatedAt: viejo, tiles: { ...ZERO_TILES, openAnomalies: 2 } }),
    );
    await mount(summary);
    expect(el().textContent).toMatch(/atrasad|actualiz|hace/i);
    expect(byId('governance-tile-value-openAnomalies')?.textContent?.trim()).toBe('2');
    summary.mockReturnValue(
      of({ generatedAt: new Date().toISOString(), tiles: { ...ZERO_TILES, openAnomalies: 1 } }),
    );
    (
      el().querySelector(
        '.view-state-host__stale button, [data-testid="governance-refresh"]',
      ) as HTMLButtonElement
    ).click();
    await settle();
    expect(byId('governance-tile-value-openAnomalies')?.textContent?.trim()).toBe('1');
  });

  it('S5: sin permiso, lo dice con el texto del contrato y no muestra ningún número', async () => {
    await mount(() =>
      throwError(() => apiError(403, 'FORBIDDEN', 'No tiene permiso para esta operación.')),
    );
    expect(el().textContent).toContain('No tiene permiso');
    expect(byId('governance-tiles')).toBeNull();
  });

  it('S8: sin conexión ofrece reintentar y, al reintentar, vuelve a pedir y pinta el resumen', async () => {
    const summary = vi.fn<() => Observable<GovernanceSummary>>(() =>
      throwError(() => new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') })),
    );
    await mount(summary);
    const retry = el().querySelector('button') as HTMLButtonElement;
    expect(retry.textContent).toMatch(/reintentar/i);
    summary.mockReturnValue(
      of({ generatedAt: new Date().toISOString(), tiles: { ...ZERO_TILES, openAnomalies: 3 } }),
    );
    retry.click();
    await settle();
    expect(summary).toHaveBeenCalledTimes(2);
    expect(byId('governance-tile-value-openAnomalies')?.textContent?.trim()).toBe('3');
  });

  it('S9: un error inesperado muestra el código de la petición', async () => {
    await mount(() => throwError(() => apiError(500, 'INTERNAL', 'Fallo')));
    expect(el().textContent).toContain('req-77');
  });

  it('«Actualizar» vuelve a pedir el resumen: una anomalía resuelta baja el mosaico (UI → petición → respuesta → recarga → UI)', async () => {
    await mount();
    const antes = Number(byId('governance-tile-value-openAnomalies')!.textContent);
    const abiertas = await firstValueFrom(client.listAnomalies({ status: 'OPEN' }));
    await firstValueFrom(client.resolveAnomaly(abiertas.items[0]!.id, { status: 'ACKNOWLEDGED' }));
    olvidarPeticiones();
    (byId('governance-refresh') as HTMLButtonElement).click();
    await settle();
    expect(peticiones.filter((p) => p.path === '/org/governance/summary')).toHaveLength(1);
    expect(Number(byId('governance-tile-value-openAnomalies')!.textContent)).toBe(antes - 1);
  });

  it('enlaza con las demás herramientas del gobierno de accesos', async () => {
    await mount();
    const rutas = Array.from(el().querySelectorAll('[data-testid="governance-tools"] a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(rutas).toEqual(
      expect.arrayContaining([
        '/administration/access-governance/matrix',
        '/administration/access-governance/anomalies',
        '/administration/access-governance/campaigns',
        '/administration/access-governance/simulator',
      ]),
    );
  });

  it('no tiene violaciones de accesibilidad que una máquina pueda ver', async () => {
    await mount();
    const violaciones = await auditarA11y(el());
    expect(violaciones, describirViolaciones(violaciones)).toEqual([]);
  });
});
