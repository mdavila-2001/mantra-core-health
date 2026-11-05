import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { throwError } from 'rxjs';
import { vi } from 'vitest';

import { SessionStore } from '../../../../core/auth/session.store';
import { AccessReviewsClient } from '../../../../core/data-access/access-governance/access-reviews.client';
import type { Campaign } from '../../../../core/data-access/access-governance/access-reviews.types';
import {
  campanas,
  itemsDeRevision,
} from '../../../../core/mock/fixtures/support-hospital-governance';
import { reiniciarElGobiernoDeAccesos } from '../../../../core/mock/handlers/mock-reset';
import { buscarUsuario, emitirAccessToken, emitirRefreshToken } from '../../../../core/mock/mock-session';
import { uuid } from '../../../../core/mock/mock-store';
import { resolverDesafiosEnPrueba } from '../../../../../testing/access-challenge-test';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../../testing/governance-mock-backend';
import { CampaignDetail } from './campaign-detail';

const ID_Q4 = uuid('demo-gov-campaign-q4');
const ID_SOFIA = uuid('demo-gov-item-sofia');
const BORRADOR: Campaign = {
  id: 'borrador-1',
  name: 'Revisión de caja',
  kind: 'TARGETED',
  status: 'DRAFT',
  scope: { kind: 'ORGANIZATION' },
  dueAt: '2027-01-15T23:59:00Z',
  graceDays: 7,
  reminderDaysBefore: [7, 3, 1],
  escalateAfterDays: 3,
  uncertifiedAction: 'UNCERTIFIED_ESCALATE',
};

const apiError = (status: number, code: string): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      code,
      message: 'x',
      correlationId: 'req-909',
      timestamp: '',
      path: '/x',
    },
  });

describe('CampaignDetail', () => {
  let fixture: ComponentFixture<CampaignDetail>;
  let componente: CampaignDetail;
  let confirmar: ReturnType<typeof vi.fn>;
  let confirmarConMotivo: ReturnType<typeof vi.fn>;
  let clicDescarga: ReturnType<typeof vi.spyOn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const texto = (id: string): string => byId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const refrescar = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  const clic = async (id: string): Promise<void> => {
    const el = byId(id);
    if (el === null) throw new Error(`No existe ${id}`);
    el.click();
    await refrescar();
  };
  const pestana = async (nombre: string): Promise<void> => {
    const tab = [...host().querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (t) => t.textContent?.trim() === nombre,
    );
    if (tab === undefined) throw new Error(`No hay pestaña ${nombre}`);
    tab.click();
    await refrescar();
  };

  async function abrir(id: string, proveedores: unknown[]): Promise<void> {
    confirmar = vi.fn(() => Promise.resolve(true));
    confirmarConMotivo = vi.fn(() => Promise.resolve('Ya no hace falta esta revisión.'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'administration/access-governance/campaigns/:campaignId',
            component: CampaignDetail,
          },
        ]),
        ...(proveedores as never[]),
        {
          provide: DialogService,
          useValue: { confirm: confirmar, confirmWithReason: confirmarConMotivo },
        },
      ],
    });
    // La pantalla decide qué ofrecer por los roles de la sesión (exportar es del administrador de seguridad).
    const piloto = buscarUsuario('hospital_piloto')!;
    TestBed.inject(SessionStore).start({ accessToken: emitirAccessToken(piloto), refreshToken: emitirRefreshToken(piloto) });
    const harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(
      `/administration/access-governance/campaigns/${id}`,
      CampaignDetail,
    );
    fixture = harness.fixture as unknown as ComponentFixture<CampaignDetail>;
    await refrescar();
  }

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:campana'), revokeObjectURL: vi.fn() });
    clicDescarga = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
  });
  afterEach(() => clicDescarga.mockRestore());

  it('muestra la campaña con su estado y los resultados: avance, pendientes, por decisión, por sensibilidad y tiempo medio', async () => {
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto'));
    expect(texto('campana-nombre')).toBe('Certificación Q4-2026');
    expect(texto('campana-estado')).toBe('Abierta');
    expect(texto('campana-vence')).toContain('Venció hace 4 días');
    expect(texto('resultados-avance')).toContain('33 %');
    expect(
      byId('resultados-avance')!
        .querySelector('[role="progressbar"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('33');
    expect(texto('resultados-pendientes')).toContain('4');
    expect(texto('resultados-por-decision')).toContain('Mantenido');
    expect(texto('resultados-por-decision')).toContain('Quitado');
    expect(texto('resultados-por-sensibilidad')).toContain('Riesgo alto');
    expect(texto('resultados-tiempo')).toContain('30 horas');
    expect(byId('campana-cerrar')).not.toBeNull();
    expect(byId('campana-lanzar')).toBeNull();
  });

  it('la pestaña de accesos lista cada ítem con su revisor, su estado y marca lo vencido y lo escalado', async () => {
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto'));
    await pestana('Accesos');
    expect(texto(`item-persona-${ID_SOFIA}`)).toContain('Sofía Camacho');
    expect(texto(`item-revisor-${ID_SOFIA}`)).toContain('Administración de seguridad');
    expect(texto(`item-estado-${ID_SOFIA}`)).toBe('Pendiente');
    expect(texto(`item-vence-${ID_SOFIA}`)).toContain('Venció hace 4 días');
    expect(byId(`item-escalado-${ID_SOFIA}`)).not.toBeNull();
    expect(texto(`item-estado-${uuid('demo-gov-item-mario')}`)).toBe('Mantenido');
  });

  it('muestra los accesos que se quitaron solos y la configuración de plazos', async () => {
    itemsDeRevision.actualizar(ID_SOFIA, { state: 'AUTO_REVOKED' });
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto'));
    expect(texto('resultados-auto-revocados')).toContain('Sofía Camacho');
    await pestana('Configuración');
    expect(texto('configuracion-alcance')).toContain('Toda la organización');
    expect(texto('configuracion-recordatorios')).toContain('7, 3 y 1 día');
    expect(texto('configuracion-no-certificado')).toContain('se quita');
    expect(texto('configuracion-gracia')).toContain('7 días');
  });

  it('cerrar pide confirmación diciendo qué pasa con lo pendiente; la API cierra, aplica la acción y la pantalla vuelve a leer', async () => {
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto'));
    olvidarPeticiones();
    await clic('campana-cerrar');
    expect(confirmar).toHaveBeenCalledOnce();
    const aviso = confirmar.mock.calls[0]![0] as { message: string; destructive?: boolean };
    expect(aviso.message).toContain('4 accesos');
    expect(aviso.message).toContain('se quita');
    expect(aviso.destructive).toBe(true);

    const pedido = peticiones.find((p) => p.method === 'POST' && p.path.endsWith('/close'));
    expect(pedido?.status).toBe(200);
    expect(campanas.get(ID_Q4)?.status).toBe('CLOSED');
    expect(itemsDeRevision.get(ID_SOFIA)?.state).toBe('AUTO_REVOKED');
    expect(
      peticiones.filter(
        (p) => p.method === 'GET' && p.path === `/org/access-reviews/campaigns/${ID_Q4}`,
      ),
    ).toHaveLength(1);
    expect(texto('campana-estado')).toBe('Cerrada');
    expect(texto('campana-resultado')).toContain('Se quitaron 4 accesos');
    expect(byId('campana-cerrar')).toBeNull();
    expect(byId('campana-cancelar')).toBeNull();
  });

  it('si no se confirma, no se cierra nada', async () => {
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto'));
    confirmar.mockResolvedValue(false);
    olvidarPeticiones();
    await clic('campana-cerrar');
    expect(peticiones.filter((p) => p.method === 'POST')).toEqual([]);
    expect(campanas.get(ID_Q4)?.status).toBe('OPEN');
  });

  it('cancelar pide el motivo, no revoca nada y deja la campaña «Cancelada»', async () => {
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto'));
    olvidarPeticiones();
    await clic('campana-cancelar');
    expect(confirmarConMotivo).toHaveBeenCalledOnce();
    const pedido = peticiones.find((p) => p.method === 'POST' && p.path.endsWith('/cancel'));
    expect(pedido?.body).toEqual({ reason: 'Ya no hace falta esta revisión.' });
    expect(campanas.get(ID_Q4)?.status).toBe('CANCELLED');
    expect(itemsDeRevision.get(ID_SOFIA)?.state).toBe('PENDING');
    expect(texto('campana-estado')).toBe('Cancelada');
    expect(texto('campana-resultado')).toContain('no se quitó ningún acceso');
  });

  it('un borrador se lanza: genera los ítems y queda «Abierta»', async () => {
    campanas.agregar(BORRADOR);
    await abrir('borrador-1', provideGovernanceMock('hospital_piloto'));
    expect(byId('campana-cerrar')).toBeNull();
    olvidarPeticiones();
    await clic('campana-lanzar');
    expect(confirmar).toHaveBeenCalledOnce();
    expect(peticiones.find((p) => p.method === 'POST' && p.path.endsWith('/launch'))?.status).toBe(
      200,
    );
    expect(campanas.get('borrador-1')?.status).toBe('OPEN');
    expect(texto('campana-estado')).toBe('Abierta');
    expect(texto('campana-resultado')).toMatch(/Se generaron \d+ accesos para revisar/);
    expect(itemsDeRevision.filtrar((i) => i.campaignId === 'borrador-1').length).toBeGreaterThan(0);
  });

  it('exportar pide el motivo y el paso extra, y entrega el archivo con su huella y cuántas filas tiene', async () => {
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto', { desafios: true }));
    const desafios = resolverDesafiosEnPrueba();
    const exportar = vi.spyOn(TestBed.inject(AccessReviewsClient), 'exportCampaign');
    olvidarPeticiones();
    await clic('campana-exportar-csv');
    // La API exige el código del motivo (lo que se eligió en la pantalla) y el paso extra: sin él es 403.
    expect(exportar).toHaveBeenCalledWith(ID_Q4, 'csv', 'AUDIT_REVIEW');
    expect(desafios.preguntados.map((d) => d.kind)).toEqual(['STEP_UP']);
    const pedidos = peticiones.filter((p) => p.path.endsWith('/export'));
    expect(pedidos.map((p) => p.status)).toEqual([403, 200]);
    expect(clicDescarga).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(texto('campana-exportado')).toContain('6 filas');
    expect(texto('campana-exportado')).toMatch(/[0-9a-f]{12}/);
  });

  it('si la API no deja exportar (solo administración de seguridad) lo dice sin tapar la campaña', async () => {
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto'));
    vi.spyOn(TestBed.inject(AccessReviewsClient), 'exportCampaign').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              statusCode: 403,
              code: 'FORBIDDEN',
              message: 'x',
              correlationId: 'req-909',
              timestamp: '',
              path: '/x',
            },
          }),
      ),
    );
    await clic('campana-exportar-json');
    expect(texto('campana-error')).toContain('req-909');
    expect(texto('campana-nombre')).toBe('Certificación Q4-2026');
    expect(clicDescarga).not.toHaveBeenCalled();
  });

  /**
   * Pendiente 54: `GET /org/access-reviews/campaigns/:id/export` es solo de `SECURITY_ADMIN`, y el resto de las rutas de campañas
   * admiten a quien administra personal de apoyo (`SUPPORT_STAFF`, un delegado). Ofrecerle un botón que va a dar 403 es una trampa.
   */
  it('quien administra pero no es administrador de seguridad no ve los botones de exportar: se le dice por qué', async () => {
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto'));
    expect(byId('campana-exportar-csv')).not.toBeNull();
    const codificar = (valor: object): string =>
      btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    TestBed.inject(SessionStore).start({
      accessToken: `${codificar({ alg: 'HS256', typ: 'JWT' })}.${codificar({ sub: 'u-delegado', sid: 's-1', roles: ['USER', 'SUPPORT_STAFF'], tenants: ['t-1'] })}.firma`,
      refreshToken: 'r-1',
    });
    await refrescar();
    expect(byId('campana-exportar-csv')).toBeNull();
    expect(byId('campana-exportar-json')).toBeNull();
    expect(byId('campana-exportar-motivo')).toBeNull();
    expect(texto('campana-exportar-solo-admin')).toContain('administrador de seguridad');
    expect(byId('campana-cerrar')).not.toBeNull();
  });

  it('una campaña ajena o inexistente se ve como «no encontrada» (S6)', async () => {
    await abrir(uuid('no-existe'), provideGovernanceMock('hospital_piloto'));
    expect(host().textContent).toContain('No encontramos lo que busca');
    expect(byId('campana-nombre')).toBeNull();
    expect(
      host().querySelector('a[href="/administration/access-governance/campaigns"]'),
    ).not.toBeNull();
  });

  it('quien no administra campañas recibe el motivo (S5)', async () => {
    await abrir(ID_Q4, provideGovernanceMock('marcos'));
    expect(host().textContent).toContain('No tiene acceso');
  });

  it('un fallo del servidor trae el código de soporte (S9)', async () => {
    await abrir(ID_Q4, [
      {
        provide: AccessReviewsClient,
        useValue: { getCampaign: () => throwError(() => apiError(500, 'INTERNAL')) },
      },
    ]);
    expect(host().textContent).toContain('req-909');
  });

  it('si al recargar falla, conserva lo que había y dice desde cuándo (S7)', async () => {
    await abrir(ID_Q4, provideGovernanceMock('hospital_piloto'));
    vi.spyOn(TestBed.inject(AccessReviewsClient), 'getCampaign').mockReturnValue(
      throwError(() => apiError(500, 'INTERNAL')),
    );
    (componente as unknown as { cargar(): void }).cargar();
    await refrescar();
    expect(texto('campana-nombre')).toBe('Certificación Q4-2026');
    expect(host().textContent).toMatch(/Información al/);
  });
});
