import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { PublicShare } from './public-share';

/** base64url sobre UTF-8, como el token real (mismo helper que `prescriptions-page.spec`). */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

/** Un token sintético con la forma del real (base64url, 43 caracteres). */
const TOKEN = 'TkSynthetic0123456789abcdefghijklmnopqrstuv';
const PUBLIC_URL = `/public/prescription-shares/${TOKEN}`;
const OWNERSHIP_URL = `/clinical/prescription-shares/by-token/${TOKEN}`;

/** La vista pública válida, sintética. */
const VALID = {
  status: 'VALID',
  issuedAt: '2026-10-01T10:00:00.000Z',
  prescriberName: 'Dra. Prueba Sintética',
  prescriberLicense: { number: 'MP-0001', authority: 'Colegio de prueba', state: 'ACTIVE' },
  itemCount: 2,
};

/**
 * `/rx/:token` (FAR-01, REQ-016 y REQ-019).
 *
 * Lo que fijan estas pruebas: el texto de cada estado del enlace, y que los
 * datos y la entrada de la farmacia salen solo con `VALID`; que el DOM
 * no muestra nada del paciente ni de los fármacos aunque la respuesta lo
 * trajera; el 404 con texto propio; la farmacia va a «Abrir receta» sin pedir
 * nada; el dueño va a «Mis recetas» y cualquier otro paciente se queda en la
 * vista pública; los estados de carga y error, y el `noindex`.
 */
describe('PublicShare', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn<Router['navigate']>>;

  beforeEach(() => {
    navigate = vi.fn<Router['navigate']>().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ token: TOKEN }) } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
  });

  afterEach(() => http.verify());

  function startSession(payload: Record<string, unknown>): void {
    TestBed.inject(SessionStore).start({ accessToken: jwt(payload), refreshToken: 'r-1' });
  }

  function mount(): ComponentFixture<PublicShare> {
    const fixture = TestBed.createComponent(PublicShare);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<PublicShare>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function flushPublic(fixture: ComponentFixture<PublicShare>, body: object): void {
    http.expectOne(PUBLIC_URL).flush(body);
    fixture.detectChanges();
  }

  it('sin sesión: mientras consulta muestra la carga, después «Receta válida» con quién y cuándo', () => {
    const fixture = mount();
    expect(fixture.nativeElement.querySelector('.view-state-host__loading')).not.toBeNull();

    flushPublic(fixture, VALID);

    const shown = text(fixture);
    expect(shown).toContain('Receta válida');
    expect(shown).toContain('Dra. Prueba Sintética');
    expect(shown).toContain('MP-0001');
    expect(shown).toContain('2 medicamentos');
    http.expectNone(OWNERSHIP_URL);
  });

  it('con VALID ofrece la entrada de la farmacia', () => {
    const fixture = mount();
    flushPublic(fixture, VALID);

    expect(text(fixture)).toContain('Soy farmacia: iniciar sesión');
  });

  it('anulada o reemplazada antes de su plazo: no dice «venció» (H12-09)', () => {
    const fixture = mount();
    flushPublic(fixture, {
      ...VALID,
      status: 'EXPIRED',
      endedReason: 'PRESCRIPTION_NOT_ACTIVE',
      itemCount: 0,
    });

    const shown = text(fixture);
    expect(shown).toContain('Esta receta ya no está vigente');
    expect(shown).not.toContain('venció');
  });

  it('vencida: solo el estado, sin «0 medicamentos» ni la entrada de la farmacia', () => {
    const fixture = mount();
    // La forma real de la API: vencida, `itemCount` cuenta los ítems vigentes (cero).
    flushPublic(fixture, { ...VALID, status: 'EXPIRED', itemCount: 0 });

    const shown = text(fixture);
    expect(shown).toContain('Esta receta venció');
    expect(shown).not.toContain('medicamento');
    expect(shown).not.toContain('Sin registrar');
    expect(shown).not.toContain('Soy farmacia');
    expect(
      fixture.nativeElement.querySelector('[data-testid="prescription-share-public-item-count"]'),
    ).toBeNull();
  });

  it('revocada: solo el estado, con la forma que manda la API (todo nulo)', () => {
    const fixture = mount();
    flushPublic(fixture, {
      status: 'REVOKED',
      issuedAt: null,
      prescriberName: null,
      prescriberLicense: null,
      itemCount: 0,
    });

    const shown = text(fixture);
    expect(shown).toContain('El paciente dejó de compartir esta receta');
    expect(shown).not.toContain('Sin registrar');
    expect(shown).not.toContain('medicamento');
    expect(shown).not.toContain('Soy farmacia');
  });

  it('el DOM no muestra nada del paciente ni de los fármacos, aunque la respuesta lo trajera', () => {
    const fixture = mount();
    flushPublic(fixture, {
      ...VALID,
      patientName: 'PACIENTE-NO-DEBE-VERSE',
      items: [{ display: 'FARMACO-NO-DEBE-VERSE' }],
    });

    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('PACIENTE-NO-DEBE-VERSE');
    expect(html).not.toContain('FARMACO-NO-DEBE-VERSE');
  });

  it('un token desconocido muestra «Este enlace no existe», no la página 404', () => {
    const fixture = mount();
    http
      .expectOne(PUBLIC_URL)
      .flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="prescription-share-public-not-found"]'),
    ).not.toBeNull();
    expect(text(fixture)).toContain('Este enlace no existe');
  });

  it('un fallo inesperado queda recuperable con su código de soporte', () => {
    const fixture = mount();
    http
      .expectOne(PUBLIC_URL)
      .flush(
        { code: 'INTERNAL', message: 'x', correlationId: 'req-123' },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();

    expect(text(fixture)).toContain('req-123');
    expect(text(fixture)).toContain('Reintentar');
  });

  it('sin conexión ofrece reintentar, y reintentar vuelve a consultar', () => {
    const fixture = mount();
    http.expectOne(PUBLIC_URL).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();
    expect(text(fixture)).toContain('Sin conexión');

    const retry = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Reintentar'),
    );
    retry?.click();
    fixture.detectChanges();
    flushPublic(fixture, VALID);

    expect(text(fixture)).toContain('Receta válida');
  });

  it('una farmacia va a «Abrir receta» de FAR-02 antes de pedir nada', () => {
    startSession({
      sub: 'u-f',
      roles: ['PHARMACY_STAFF'],
      tenants: ['t-f'],
      tenantTypes: { 't-f': 'PHARMACY' },
    });
    mount();

    http.expectNone(() => true);
    expect(navigate).toHaveBeenCalledWith(['/administration/pharmacy-orders/rx', TOKEN], {
      replaceUrl: true,
    });
  });

  it('el paciente dueño va a «Mis recetas» con el enlace marcado, sin el token en la dirección', () => {
    startSession({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-1' });
    mount();

    http
      .expectOne(OWNERSHIP_URL)
      .flush({ shareId: 'sh-1', resourceType: 'PRESCRIPTION_ENCOUNTER', resourceId: 'enc-1' });

    http.expectNone(PUBLIC_URL);
    expect(navigate).toHaveBeenCalledWith(['/my-account/pharmacy/prescriptions'], {
      queryParams: { share: 'sh-1' },
      replaceUrl: true,
    });
  });

  it('otro paciente (404 de by-token) se queda en la vista pública', () => {
    startSession({ sub: 'u-2', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-2' });
    const fixture = mount();

    http
      .expectOne(OWNERSHIP_URL)
      .flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    flushPublic(fixture, VALID);

    expect(navigate).not.toHaveBeenCalled();
    expect(text(fixture)).toContain('Receta válida');
  });

  it('una médica ve la vista pública, sin preguntar si es suya', () => {
    startSession({ sub: 'u-m', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: 'hp-1' });
    const fixture = mount();

    http.expectNone(OWNERSHIP_URL);
    flushPublic(fixture, VALID);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('pide a los buscadores que no la indexen y lo retira al salir', () => {
    const fixture = mount();
    const meta = TestBed.inject(Meta);
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, nofollow');
    expect(meta.getTag('name="referrer"')?.content).toBe('no-referrer');

    http.expectOne(PUBLIC_URL).flush(VALID);
    fixture.destroy();

    expect(meta.getTag('name="robots"')).toBeNull();
  });
});
