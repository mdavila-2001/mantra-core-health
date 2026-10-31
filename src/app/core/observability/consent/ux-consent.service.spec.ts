import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../auth/session.store';
import { UX_ANALYTICS_CONFIG, type UxAnalyticsConfig } from '../ux/ux-analytics.config';
import { UxConsent } from './ux-consent.service';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTRO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PROPOSITO = '9889b3b6-4293-5266-bba2-b27fa26bec2e';
const CONSENTIMIENTO = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const URL_ME = '/telemetry/tracking-consents/me';
const URL_CONSENTIMIENTOS = '/telemetry/tracking-consents';

const CONFIG: UxAnalyticsConfig = {
  active: true,
  eventSchemaDefinitionId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  anonymousSchemaDefinitionId: 'df630ae0-3bf4-567d-97f3-5b75ea77bc94',
  consentPurposeDefinitionId: PROPOSITO,
  sampleRatio: 1,
  flushIntervalMs: 10_000,
  maxBatch: 50,
  maxKeepaliveBatch: 20,
  maxBuffer: 500,
};

describe('UxConsent', () => {
  let http: HttpTestingController;
  let session: SessionStore;

  function preparar(config: Partial<UxAnalyticsConfig> = {}): UxConsent {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UX_ANALYTICS_CONFIG, useValue: { ...CONFIG, ...config } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    return TestBed.inject(UxConsent);
  }

  function entrar(sub = USER_ID): void {
    session.start({ accessToken: jwt({ sub, roles: [], tenants: [] }), refreshToken: 'r' });
    TestBed.tick();
  }

  function apiState(status: 'GRANTED' | 'WITHDRAWN' | 'NONE', consentId?: string): void {
    http
      .expectOne((r) => r.url === URL_ME && r.params.get('purposeDefinitionId') === PROPOSITO)
      .flush({ status, purposeDefinitionId: PROPOSITO, ...(consentId ? { consentId } : {}) });
  }

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
  });

  afterEach(() => {
    http.verify();
    delete (navigator as unknown as Record<string, unknown>)['globalPrivacyControl'];
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
  });

  describe('decisión ausente, otorgada y retirada', () => {
    it('sin sesión no consulta nada y solo permite vistas anónimas', () => {
      const consent = preparar();
      TestBed.tick();

      http.expectNone(() => true);
      expect(consent.decision()).toBe('desconocida');
      expect(consent.modo()).toBe('anonimo');
      expect(consent.avisoVisible()).toBe(false);
    });

    it('al iniciar sesión pregunta a la API; NONE → anónimo y se muestra el aviso', () => {
      const consent = preparar();
      entrar();
      apiState('NONE');

      expect(consent.decision()).toBe('ninguna');
      expect(consent.modo()).toBe('anonimo');
      expect(consent.avisoVisible()).toBe(true);
    });

    it('con varias organizaciones: la consulta previa a elegir falla (403) y al elegir organización se repite', () => {
      const consent = preparar();
      session.start({ accessToken: jwt({ sub: USER_ID, roles: ['USER'], tenants: ['t-1', 't-2'] }), refreshToken: 'r' });
      TestBed.tick();
      http
        .expectOne((r) => r.url === URL_ME)
        .flush({ code: 'FORBIDDEN', reason: 'TENANT_AMBIGUOUS' }, { status: 403, statusText: 'Forbidden' });
      expect(consent.avisoVisible()).toBe(false);

      session.selectTenant('t-1');
      TestBed.tick();
      apiState('NONE');

      expect(consent.decision()).toBe('ninguna');
      expect(consent.avisoVisible()).toBe(true);
    });

    it('GRANTED → completo y sin aviso', () => {
      const consent = preparar();
      entrar();
      apiState('GRANTED', CONSENTIMIENTO);

      expect(consent.modo()).toBe('completo');
      expect(consent.avisoVisible()).toBe(false);
    });

    it('WITHDRAWN → ninguno: ni siquiera vistas anónimas', () => {
      const consent = preparar();
      entrar();
      apiState('WITHDRAWN');

      expect(consent.decision()).toBe('retirada');
      expect(consent.modo()).toBe('ninguno');
      expect(consent.avisoVisible()).toBe(false);
    });

    it('otorgar manda POST con el propósito y la versión, sin ningún usuario, y pasa a completo', () => {
      const consent = preparar();
      entrar();
      apiState('NONE');

      consent.otorgar();
      const req = http.expectOne(URL_CONSENTIMIENTOS);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        purposeDefinitionId: PROPOSITO,
        consentVersion: expect.stringMatching(/^ux-heatmap-/),
      });
      expect(JSON.stringify(req.request.body)).not.toContain(USER_ID);
      req.flush({ id: CONSENTIMIENTO, userId: USER_ID, purposeDefinitionId: PROPOSITO, decisionConceptId: 'x' });

      expect(consent.modo()).toBe('completo');
      expect(consent.avisoVisible()).toBe(false);
      expect(localStorage.getItem(`mch.ux.aviso.${USER_ID}`)).toBe('1');
    });

    it('retirar usa el id del consentimiento vigente y pasa a ninguno', () => {
      const consent = preparar();
      entrar();
      apiState('GRANTED', CONSENTIMIENTO);

      consent.retirar();
      const req = http.expectOne(`${URL_CONSENTIMIENTOS}/${CONSENTIMIENTO}/withdraw`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 'nuevo', userId: USER_ID, purposeDefinitionId: PROPOSITO, decisionConceptId: 'x' });

      expect(consent.decision()).toBe('retirada');
      expect(consent.modo()).toBe('ninguno');
    });

    it('tras un retiro se puede volver a otorgar', () => {
      const consent = preparar();
      entrar();
      apiState('WITHDRAWN');

      consent.otorgar();
      http
        .expectOne(URL_CONSENTIMIENTOS)
        .flush({ id: CONSENTIMIENTO, userId: USER_ID, purposeDefinitionId: PROPOSITO, decisionConceptId: 'x' });

      expect(consent.modo()).toBe('completo');
    });
  });

  describe('aviso de una sola vez', () => {
    it('«Ahora no» lo oculta, deja la captura anónima y no vuelve en este navegador', () => {
      const consent = preparar();
      entrar();
      apiState('NONE');

      consent.descartarAviso();
      expect(consent.avisoVisible()).toBe(false);
      expect(consent.modo()).toBe('anonimo');
      expect(localStorage.getItem(`mch.ux.aviso.${USER_ID}`)).toBe('1');
    });

    it('lo descartado por una persona no se lo oculta a otra del mismo navegador', () => {
      const consent = preparar();
      entrar();
      apiState('NONE');
      consent.descartarAviso();

      session.clear();
      TestBed.tick();
      entrar(OTRO);
      apiState('NONE');

      expect(consent.avisoVisible()).toBe(true);
    });

    it('con el almacenamiento bloqueado igual se oculta (hasta recargar) y no rompe', () => {
      const consent = preparar();
      entrar();
      apiState('NONE');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('bloqueado', 'SecurityError');
      });

      expect(() => consent.descartarAviso()).not.toThrow();
      expect(consent.avisoVisible()).toBe(false);
    });
  });

  describe('señales de privacidad y configuración', () => {
    it('con DNT activo no pregunta ni muestra aviso, y el modo es ninguno', () => {
      Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
      const consent = preparar();
      entrar();

      http.expectNone(() => true);
      expect(consent.bloqueadaPorPrivacidad).toBe(true);
      expect(consent.modo()).toBe('ninguno');
      expect(consent.avisoVisible()).toBe(false);
    });

    it('con Global Privacy Control activo tampoco', () => {
      Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
      const consent = preparar();
      entrar();

      http.expectNone(() => true);
      expect(consent.modo()).toBe('ninguno');
    });

    it('con la captura apagada no consulta, no avisa y el modo es ninguno', () => {
      const consent = preparar({ active: false });
      entrar();

      http.expectNone(() => true);
      expect(consent.modo()).toBe('ninguno');
      expect(consent.avisoVisible()).toBe(false);
    });
  });

  describe('fallos', () => {
    it('si la consulta falla no inventa una decisión: sigue sin aviso y sin clics', () => {
      const consent = preparar();
      entrar();
      http.expectOne((r) => r.url === URL_ME).flush(null, { status: 500, statusText: 'Server Error' });

      expect(consent.decision()).toBe('desconocida');
      expect(consent.modo()).toBe('anonimo');
      expect(consent.avisoVisible()).toBe(false);
    });

    it('si otorgar falla (403) deja el mensaje y no cambia el modo', () => {
      const consent = preparar();
      entrar();
      apiState('NONE');

      consent.otorgar();
      http.expectOne(URL_CONSENTIMIENTOS).flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

      expect(consent.error()).toBe('No pudimos registrar su decisión. Pruebe de nuevo.');
      expect(consent.modo()).toBe('anonimo');
      expect(consent.ocupado()).toBe(false);
    });

    it('si retirar falla por red dice que no hay conexión y conserva el permiso', () => {
      const consent = preparar();
      entrar();
      apiState('GRANTED', CONSENTIMIENTO);

      consent.retirar();
      http.expectOne(`${URL_CONSENTIMIENTOS}/${CONSENTIMIENTO}/withdraw`).error(new ProgressEvent('error'));

      expect(consent.error()).toContain('conectarnos');
      expect(consent.modo()).toBe('completo');
    });

    it('retirar sin un consentimiento vigente no manda nada', () => {
      const consent = preparar();
      entrar();
      apiState('NONE');

      consent.retirar();
      http.expectNone(() => true);
    });

    it('una respuesta tardía de la persona anterior no se aplica a la siguiente', () => {
      const consent = preparar();
      entrar();
      const tardia = http.expectOne((r) => r.url === URL_ME);

      session.clear();
      TestBed.tick();
      entrar(OTRO);
      tardia.flush({ status: 'GRANTED', consentId: CONSENTIMIENTO, purposeDefinitionId: PROPOSITO });
      apiState('NONE');

      expect(consent.decision()).toBe('ninguna');
    });
  });
});
