import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';

import { CAMPAIGN_RESULTS_CONCURRENCY } from './campaign-list';
import { AccessReviewsClient } from '../../../../core/data-access/access-governance/access-reviews.client';
import type { Campaign } from '../../../../core/data-access/access-governance/access-reviews.types';
import { campanas } from '../../../../core/mock/fixtures/support-hospital-governance';
import { reiniciarElGobiernoDeAccesos } from '../../../../core/mock/handlers/mock-reset';
import { uuid } from '../../../../core/mock/mock-store';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../../testing/governance-mock-backend';
import { CampaignList } from './campaign-list';

const ID_Q4 = uuid('demo-gov-campaign-q4');
const BORRADOR: Campaign = {
  id: 'borrador-1',
  name: 'Revisión de caja',
  kind: 'TARGETED',
  status: 'DRAFT',
  scope: { kind: 'TEMPLATE', templateCodes: ['BILLING_CASHIER'] },
  dueAt: '2027-01-15T23:59:00Z',
  graceDays: 7,
  reminderDaysBefore: [7, 3, 1],
  escalateAfterDays: 3,
  uncertifiedAction: 'UNCERTIFIED_ESCALATE',
};

const apiError = (status: number, code: string, reason?: string): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      code,
      message: 'x',
      ...(reason === undefined ? {} : { reason, details: { reason } }),
      correlationId: 'req-501',
      timestamp: '',
      path: '/x',
    },
  });

describe('CampaignList', () => {
  let fixture: ComponentFixture<CampaignList>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const texto = (id: string): string => byId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const refrescar = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };

  async function abrir(proveedores: unknown[]): Promise<void> {
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...(proveedores as never[])] });
    fixture = TestBed.createComponent(CampaignList);
    fixture.detectChanges();
    await refrescar();
  }

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });

  it('lista las campañas con su estado, el avance que sale de los resultados y el vencimiento', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    expect(host().textContent).toContain('Campañas de certificación');
    expect(texto(`campana-nombre-${ID_Q4}`)).toContain('Certificación Q4-2026');
    expect(texto(`campana-tipo-${ID_Q4}`)).toBe('Periódica · Toda la organización');
    expect(texto(`campana-estado-${ID_Q4}`)).toBe('Abierta');
    expect(texto(`campana-avance-${ID_Q4}`)).toContain('33 %');
    expect(texto(`campana-avance-${ID_Q4}`)).toContain('4 pendientes');
    expect(texto(`campana-vence-${ID_Q4}`)).toContain('Venció hace 4 días');
    expect(byId(`campana-ver-${ID_Q4}`)?.getAttribute('href')).toBe(
      `/administration/access-governance/campaigns/${ID_Q4}`,
    );
    expect(peticiones.map((p) => `${p.method} ${p.path}`)).toEqual(
      expect.arrayContaining([
        'GET /org/access-reviews/campaigns',
        `GET /org/access-reviews/campaigns/${ID_Q4}/results`,
      ]),
    );
  });

  /**
   * Pendiente 55: la API no trae conteos en el listado, así que el avance de cada campaña es una petición propia (N+1). Hasta que
   * la API los incluya, no se disparan todas a la vez: un tablero con muchas campañas no debe agotar el límite de peticiones.
   */
  it('pide el avance de a pocas campañas a la vez y no todas juntas', async () => {
    const abiertas: Campaign[] = Array.from({ length: 12 }, (_, i) => ({
      ...BORRADOR,
      id: `abierta-${i}`,
      name: `Campaña ${i}`,
      status: 'OPEN',
    }));
    const pendientes: Subject<unknown>[] = [];
    let enVuelo = 0;
    let maximo = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AccessReviewsClient,
          useValue: {
            listCampaigns: () => of({ items: abiertas, count: abiertas.length }),
            getCampaignResults: () => {
              enVuelo += 1;
              maximo = Math.max(maximo, enVuelo);
              const respuesta = new Subject<unknown>();
              pendientes.push(respuesta);
              return new Observable((suscriptor) => {
                const interna = respuesta.subscribe((valor) => {
                  enVuelo -= 1;
                  suscriptor.next(valor);
                  suscriptor.complete();
                });
                return () => interna.unsubscribe();
              });
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(CampaignList);
    fixture.detectChanges();
    await refrescar();
    expect(maximo).toBeLessThanOrEqual(CAMPAIGN_RESULTS_CONCURRENCY);
    expect(pendientes.length).toBe(CAMPAIGN_RESULTS_CONCURRENCY);
    // Cada respuesta libera el lugar de la siguiente, y al final salen las doce, en su orden.
    while (pendientes.length < 12 || enVuelo > 0) {
      const lista = pendientes.splice(0, pendientes.length);
      lista.forEach((s) => s.next({ coveragePercent: 50, pending: 1, total: 2 }));
      await refrescar();
      if (lista.length === 0) break;
    }
    expect(maximo).toBeLessThanOrEqual(CAMPAIGN_RESULTS_CONCURRENCY);
    expect(host().querySelectorAll('[data-testid^="campana-nombre-"]').length).toBe(12);
  });

  it('un borrador no tiene avance: dice que aún no se lanzó', async () => {
    campanas.agregar(BORRADOR);
    await abrir(provideGovernanceMock('hospital_piloto'));
    expect(texto('campana-avance-borrador-1')).toContain('Aún no se lanzó');
    expect(texto('campana-estado-borrador-1')).toBe('Borrador');
    expect(peticiones.some((p) => p.path.includes('borrador-1/results'))).toBe(false);
  });

  it('el filtro por estado deja ver solo lo elegido y cuenta cada grupo', async () => {
    campanas.agregar(BORRADOR);
    await abrir(provideGovernanceMock('hospital_piloto'));
    const filtro = byId('campanas-filtro')!;
    expect(filtro.textContent).toContain('Todas (2)');
    expect(filtro.textContent).toContain('Borradores (1)');
    (filtro.querySelector('[data-value="DRAFT"]') as HTMLElement).click();
    await refrescar();
    expect(byId('campana-nombre-borrador-1')).not.toBeNull();
    expect(byId(`campana-nombre-${ID_Q4}`)).toBeNull();
  });

  it('ofrece crear una campaña nueva', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    expect(byId('campanas-nueva')?.getAttribute('href')).toBe(
      '/administration/access-governance/campaigns/new',
    );
  });

  it('sin campañas es un vacío con su próxima acción (S3)', async () => {
    campanas.borrar(ID_Q4);
    await abrir(provideGovernanceMock('hospital_piloto'));
    expect(host().textContent).toContain('Aún no hay campañas');
    const accion = host().querySelector(
      'a[href="/administration/access-governance/campaigns/new"]',
    );
    expect(accion?.textContent).toContain('Crear la primera campaña');
  });

  it('quien no puede administrar campañas ve el motivo, no una lista vacía (S5)', async () => {
    await abrir(provideGovernanceMock('marcos'));
    expect(host().textContent).toContain('No tiene acceso');
    expect(byId('campanas-tabla')).toBeNull();
  });

  it('un fallo del servidor trae el código de soporte (S9)', async () => {
    await abrir([
      {
        provide: AccessReviewsClient,
        useValue: { listCampaigns: () => throwError(() => apiError(500, 'INTERNAL')) },
      },
    ]);
    expect(host().textContent).toContain('req-501');
  });

  it('si la campaña no devuelve resultados el avance queda en «—» y la lista sigue', async () => {
    const getCampaignResults = () => throwError(() => apiError(500, 'INTERNAL'));
    await abrir([
      {
        provide: AccessReviewsClient,
        useValue: {
          listCampaigns: () =>
            of({
              items: [BORRADOR, { ...BORRADOR, id: 'abierta-1', name: 'Otra', status: 'OPEN' }],
              count: 2,
            }),
          getCampaignResults,
        },
      },
    ]);
    expect(texto('campana-avance-abierta-1')).toBe('—');
    expect(byId('campana-nombre-borrador-1')).not.toBeNull();
  });

  it('si al volver a leer falla, deja lo que ya había y dice desde cuándo (S7)', async () => {
    const listCampaigns = vi.fn(() => of({ items: [BORRADOR], count: 1 }));
    await abrir([
      {
        provide: AccessReviewsClient,
        useValue: { listCampaigns, getCampaignResults: () => of({}) },
      },
    ]);
    listCampaigns.mockReturnValueOnce(throwError(() => apiError(500, 'INTERNAL')) as never);
    (fixture.componentInstance as unknown as { cargar(): void }).cargar();
    await refrescar();
    expect(byId('campana-nombre-borrador-1')).not.toBeNull();
    expect(host().textContent).toMatch(/Información al/);
  });
});
