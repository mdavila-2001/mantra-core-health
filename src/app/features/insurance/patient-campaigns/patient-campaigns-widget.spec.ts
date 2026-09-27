import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { PatientCampaign } from '../../../core/data-access/insurance/insurance.types';
import {
  CAMPAIGN_PARAM,
  CAMPAIGN_TITLE_PARAM,
  MIS_TURNOS_ROUTE,
} from '../../account/appointments/appointments.routes';
import { LAB_RESOURCE, RESOURCE_PARAM } from '../../account/appointments/appointments';
import { campaignAction, daysLeft, PatientCampaignsWidget } from './patient-campaigns-widget';

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_URL = `/insurance-campaigns/patient/${PROFILE_ID}`;

function campaignWire(overrides: Record<string, unknown> = {}) {
  return {
    id: 'camp-1',
    code: 'CMP-CARDIO-2026',
    title: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
    description: 'Presión arterial, perfil lipídico y glicemia en ayunas.',
    campaignType: 'LABORATORY',
    targetCondition: { code: 'I10', display: 'Hipertensión esencial' },
    copayBonusPercentage: 100,
    validFrom: '2026-01-01',
    validTo: '2099-12-31',
    carrierName: 'Seguros Andina',
    partners: [
      { role: 'PROVIDER', type: 'LABORATORY', name: 'Laboratorio Central AloVida' },
      { role: 'PROVIDER', type: 'PHARMACY', name: 'Farmacias Aliadas' },
      { role: 'SPONSOR', type: 'MANUFACTURER', name: 'Laboratorios Bagó' },
    ],
    ...overrides,
  };
}

function forbiddenBody() {
  return {
    statusCode: 403,
    code: 'FORBIDDEN',
    message: 'Sólo el titular del perfil puede ver sus campañas',
    timestamp: '2026-09-25T00:00:00.000Z',
    path: REQUEST_URL,
  };
}

describe('PatientCampaignsWidget', () => {
  let fixture: ComponentFixture<PatientCampaignsWidget>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function mount(emptyMessage: string | null = null): void {
    fixture = TestBed.createComponent(PatientCampaignsWidget);
    fixture.componentRef.setInput('patientProfileId', PROFILE_ID);
    fixture.componentRef.setInput('emptyMessage', emptyMessage);
    fixture.detectChanges();
  }

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const cards = () => root().querySelectorAll('[data-testid="campaign-card"]');
  const action = () =>
    root().querySelector('[data-testid="btn-campaign-action"]') as HTMLAnchorElement;

  /** El href de un botón como URL, para comparar parámetros sin depender del orden ni del escape. */
  const hrefOf = (element: HTMLAnchorElement): URL =>
    new URL(element.getAttribute('href') ?? '', 'http://alovida.test');

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('la tarjeta del beneficio (CA-4.2)', () => {
    it('pide las campañas con el perfil propio en la URL', async () => {
      mount();
      const request = http.expectOne(REQUEST_URL);
      expect(request.request.method).toBe('GET');
      request.flush([]);
      await settle();
    });

    it('muestra el sello «100% Cubierto por tu Seguro», la descripción y el botón', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush([campaignWire()]);
      await settle();

      expect(cards()).toHaveLength(1);
      const text = root().textContent ?? '';
      expect(
        root().querySelector('[data-testid="campaign-badge-coverage"]')?.textContent,
      ).toContain('100% Cubierto por tu Seguro');
      expect(text).toContain('Chequeo Preventivo Cardiovascular y Perfil Lipídico');
      expect(text).toContain('Hipertensión esencial');
      expect(text).toContain('Seguros Andina');
      expect(action().textContent).toContain('Agendar chequeo preventivo');
    });

    it('con menos de 100 dice cuánto se bonifica, no «100% Cubierto»', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush([campaignWire({ copayBonusPercentage: 50 })]);
      await settle();

      const badge = root().querySelector('[data-testid="campaign-badge-coverage"]')?.textContent;
      expect(badge).toContain('50% de bonificación en copago');
      expect(badge).not.toContain('100%');
    });

    it('separa dónde se atiende (prestadores) de quién financia (auspiciantes)', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush([campaignWire()]);
      await settle();

      const providers = root().querySelector('[data-testid="campaign-providers"]')?.textContent;
      expect(providers).toContain('Laboratorio Central AloVida, Farmacias Aliadas');
      expect(providers).not.toContain('Laboratorios Bagó');
      expect(root().textContent).toContain('Laboratorios Bagó');
    });

    it('no dibuja la patología ni los datos de aliados cuando no los hay', async () => {
      mount();
      http
        .expectOne(REQUEST_URL)
        .flush([campaignWire({ targetCondition: null, description: null, partners: [] })]);
      await settle();

      expect(root().textContent).not.toContain('Ayuda a prevenir');
      expect(root().querySelector('[data-testid="campaign-providers"]')).toBeNull();
    });

    it('muestra una tarjeta por campaña, cada una con su botón', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush([
        campaignWire(),
        campaignWire({
          id: 'camp-2',
          code: 'CMP-FLU-2026',
          title: 'Vacunación antigripal',
          campaignType: 'VACCINATION',
        }),
      ]);
      await settle();

      expect(cards()).toHaveLength(2);
      expect(root().querySelectorAll('[data-testid="btn-campaign-action"]')).toHaveLength(2);
    });
  });

  describe('el botón lleva a agendar o canjear, con la campaña como contexto', () => {
    it('laboratorio: «Agendar chequeo preventivo» abre turnos ya orientada a un laboratorio', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush([campaignWire()]);
      await settle();

      expect(action().textContent).toContain('Agendar chequeo preventivo');
      const url = hrefOf(action());
      expect(url.pathname).toBe('/my-account/appointments');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        seccion: 'pedir',
        resource: 'lab',
        campaign: 'CMP-CARDIO-2026',
        campaignTitle: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
      });
    });

    it('estudio por imagen: «Agendar estudio»', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush([campaignWire({ campaignType: 'DIAGNOSTIC_IMAGING' })]);
      await settle();

      expect(action().textContent).toContain('Agendar estudio');
      expect(action().getAttribute('href')).toContain('/my-account/appointments?');
    });

    it('vacunación: «Agendar vacunación», sin fijar el laboratorio', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush([campaignWire({ campaignType: 'VACCINATION' })]);
      await settle();

      expect(action().textContent).toContain('Agendar vacunación');
      const url = hrefOf(action());
      expect(Object.fromEntries(url.searchParams)).toEqual({
        seccion: 'pedir',
        campaign: 'CMP-CARDIO-2026',
        campaignTitle: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
      });
      expect(url.searchParams.has('resource')).toBe(false);
    });

    it('farmacia: «Canjear en farmacia» abre el directorio de farmacias', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush([campaignWire({ campaignType: 'PHARMACY' })]);
      await settle();

      expect(action().textContent).toContain('Canjear en farmacia');
      expect(action().getAttribute('href')).toBe('/pharmacies-directory?campaign=CMP-CARDIO-2026');
    });

    /**
     * Los literales del widget deben decir lo mismo que las constantes de la
     * pantalla de turnos. El widget no las importa (esa pantalla es un chunk
     * diferido y el widget viaja en el bundle inicial del panel), así que este
     * test es lo único que impide que se desincronicen sin que nadie lo note.
     */
    it('usa exactamente los parámetros que lee la pantalla de turnos', () => {
      const lab = campaignAction({
        campaignType: 'LABORATORY',
        code: 'X',
        title: 'Un título',
      } as PatientCampaign);

      expect(lab.route).toBe(MIS_TURNOS_ROUTE);
      expect(lab.queryParams[RESOURCE_PARAM]).toBe(LAB_RESOURCE);
      expect(lab.queryParams[CAMPAIGN_PARAM]).toBe('X');
      expect(lab.queryParams['seccion']).toBe('pedir');
      expect(lab.queryParams[CAMPAIGN_TITLE_PARAM]).toBe('Un título');
    });
  });

  describe('cuando no hay nada que mostrar', () => {
    it('en el panel principal (sin mensaje) no dibuja ni un renglón', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush([]);
      await settle();

      expect(root().querySelector('[data-testid="campaigns-widget"]')).toBeNull();
      expect(root().textContent?.trim()).toBe('');
    });

    it('en la pestaña de seguros dice que hoy no hay campañas', async () => {
      mount('Tu seguro no tiene campañas preventivas activas hoy.');
      http.expectOne(REQUEST_URL).flush([]);
      await settle();

      expect(root().querySelector('[data-testid="campaigns-empty"]')?.textContent).toContain(
        'Tu seguro no tiene campañas preventivas activas hoy.',
      );
    });

    it('mientras carga no dibuja nada', () => {
      mount('Sin campañas.');

      expect(root().querySelector('[data-testid="campaigns-widget"]')).toBeNull();
      http.expectOne(REQUEST_URL).flush([]);
    });
  });

  describe('cuando la consulta falla', () => {
    it('en el panel principal no ensucia la pantalla', async () => {
      mount();
      http.expectOne(REQUEST_URL).flush(forbiddenBody(), { status: 403, statusText: 'Forbidden' });
      await settle();

      expect(root().querySelector('[data-testid="campaigns-widget"]')).toBeNull();
    });

    it('en la pestaña de seguros lo dice y ofrece reintentar', async () => {
      mount('Sin campañas.');
      http.expectOne(REQUEST_URL).flush(forbiddenBody(), { status: 403, statusText: 'Forbidden' });
      await settle();

      expect(root().querySelector('[data-testid="campaigns-error"]')).not.toBeNull();
      const retry = [...root().querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Reintentar'),
      )!;
      retry.click();
      await settle();

      // El reintento vuelve a pedir, y ahora responde bien.
      http.expectOne(REQUEST_URL).flush([campaignWire()]);
      await settle();
      expect(cards()).toHaveLength(1);
    });
  });

  it('si cambia el perfil, vuelve a pedir con el nuevo', async () => {
    mount();
    http.expectOne(REQUEST_URL).flush([]);
    await settle();

    const OTHER = '22222222-2222-4222-8222-222222222222';
    fixture.componentRef.setInput('patientProfileId', OTHER);
    await settle();

    http.expectOne(`/insurance-campaigns/patient/${OTHER}`).flush([]);
  });
});

describe('daysLeft', () => {
  const now = new Date(2026, 8, 25, 15, 30);

  it('el último día de vigencia todavía vale: queda 1', () => {
    expect(daysLeft(new Date(2026, 8, 25), now)).toBe(1);
  });

  it('cuenta días de calendario, no horas', () => {
    expect(daysLeft(new Date(2026, 8, 26), now)).toBe(2);
    expect(daysLeft(new Date(2026, 10, 24), now)).toBe(61);
  });

  it('una vigencia ya pasada da cero o negativo', () => {
    expect(daysLeft(new Date(2026, 8, 24), now)).toBe(0);
  });
});
