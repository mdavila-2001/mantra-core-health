import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { PrescriptionsPage } from './prescriptions-page';

/** base64url sobre UTF-8, como el token real (mismo helper que `where-to-buy.spec`). */
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

const CONCEPTO_AMOXI = 'c-0000-0001';
const CONCEPTO_IBU = 'c-0000-0002';
const CONCEPTO_PARA = 'c-0000-0003';

/** Dos recetas: una de dos medicamentos en la misma consulta, otra suelta. */
const RESUMEN = {
  patientProfileId: 'pp-1',
  conditions: [],
  allergies: [],
  observations: [],
  encounters: [],
  medicationRequests: [
    {
      id: 'm-1',
      medicationConceptId: CONCEPTO_AMOXI,
      statusConceptId: 'st-activa',
      encounterId: 'e-1',
      doseText: '500 mg',
      frequencyText: 'cada 8 horas',
      issuedAt: '2026-03-01T11:00:00.000Z',
      createdAt: '2026-03-01T10:30:00.000Z',
    },
    {
      id: 'm-2',
      medicationConceptId: CONCEPTO_IBU,
      statusConceptId: 'st-activa',
      encounterId: 'e-1',
      doseText: '400 mg',
      issuedAt: '2026-03-01T11:00:00.000Z',
      createdAt: '2026-03-01T10:31:00.000Z',
    },
    {
      id: 'm-3',
      medicationConceptId: CONCEPTO_PARA,
      statusConceptId: 'st-activa',
      createdAt: '2026-05-10T08:00:00.000Z',
    },
  ],
};

const CONCEPTOS = {
  items: [
    { conceptId: CONCEPTO_AMOXI, code: 'J01CA04', display: 'Amoxicilina', codeSystemVersionId: 'v1' },
    { conceptId: CONCEPTO_IBU, code: 'M01AE01', display: 'Ibuprofeno', codeSystemVersionId: 'v1' },
    { conceptId: CONCEPTO_PARA, code: 'N02BE01', display: 'Paracetamol', codeSystemVersionId: 'v1' },
  ],
};

/**
 * Mis recetas (carril 43 · H4).
 *
 * Lo que estas pruebas fijan: que las recetas salen del resumen clínico y se
 * agrupan por consulta, que los medicamentos se nombran con terminología —no
 * con su uuid—, que cada tarjeta lleva a «Dónde comprar» con el id correcto, y
 * que los cuatro estados existen: cargando, con datos, vacío accionable y
 * error recuperable, más «sin perfil».
 */
describe('PrescriptionsPage', () => {
  let fixture: ComponentFixture<PrescriptionsPage>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function entrarComoPaciente(): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-1' }),
      refreshToken: 'r-1',
    });
  }

  function montar(): void {
    fixture = TestBed.createComponent(PrescriptionsPage);
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function responder(resumen: object = RESUMEN, conceptos: object = CONCEPTOS): void {
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(resumen);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(conceptos);
    fixture.detectChanges();
  }

  it('lee el resumen con el mismo tope que la historia clínica', () => {
    entrarComoPaciente();
    montar();

    const req = http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
  });

  it('agrupa por consulta: dos medicamentos de la misma consulta son una receta', () => {
    entrarComoPaciente();
    montar();
    responder();

    const tarjetas = raiz().querySelectorAll('.receta');
    expect(tarjetas).toHaveLength(2);
    expect(raiz().textContent).toContain('2 medicamentos');
    expect(raiz().textContent).toContain('1 medicamento');
  });

  it('nombra los medicamentos con terminología: ningún uuid llega a la pantalla', () => {
    entrarComoPaciente();
    montar();
    responder();

    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Amoxicilina');
    expect(texto).toContain('Ibuprofeno');
    expect(texto).toContain('Paracetamol');
    for (const uuid of [CONCEPTO_AMOXI, CONCEPTO_IBU, CONCEPTO_PARA]) {
      expect(texto).not.toContain(uuid);
    }
  });

  it('sin etiquetas, la receta se lista igual y el renglón lo dice', () => {
    entrarComoPaciente();
    montar();
    responder(RESUMEN, { items: [] });

    expect(raiz().querySelectorAll('.receta')).toHaveLength(2);
    expect(raiz().textContent).toContain('Sin registrar');
  });

  it('«Buscar dónde comprarla» lleva a la receta correcta', () => {
    entrarComoPaciente();
    montar();
    responder();

    const enlaces = [
      ...raiz().querySelectorAll<HTMLAnchorElement>('[data-testid="pharmacy-prescription-search"]'),
    ];
    expect(enlaces).toHaveLength(2);
    // La más reciente arriba: la receta suelta del 10/05.
    expect(enlaces[0].getAttribute('href')).toBe(
      '/my-account/medical-record/where-to-buy/m-3',
    );
    expect(enlaces[1].getAttribute('href')).toBe(
      '/my-account/medical-record/where-to-buy/m-1',
    );
  });

  it('la lista lleva el id de prueba congelado', () => {
    entrarComoPaciente();
    montar();
    responder();

    expect(raiz().querySelector('[data-testid="pharmacy-prescriptions-list"]')).not.toBeNull();
  });

  it('sin recetas, un vacío que manda a la historia clínica', () => {
    entrarComoPaciente();
    montar();
    http
      .expectOne((r) => r.url === '/clinical/patients/pp-1/summary')
      .flush({ ...RESUMEN, medicationRequests: [] });
    // Sin conceptos que resolver, el cliente de terminología no consulta nada.
    http.expectNone((r) => r.url === '/terminology/concepts');
    fixture.detectChanges();

    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Ir a mi historia clínica');
    expect(raiz().querySelectorAll('.receta')).toHaveLength(0);
  });

  it('un error de la lectura queda recuperable, no como ausencia de recetas', () => {
    entrarComoPaciente();
    montar();
    http
      .expectOne((r) => r.url === '/clinical/patients/pp-1/summary')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const texto = raiz().textContent ?? '';
    expect(texto).not.toContain('Todavía no tenés recetas');
    expect(texto).toContain('Reintentar');
  });

  it('sin perfil de paciente no consulta nada y lo dice', () => {
    montar();

    http.expectNone(() => true);
    expect(
      raiz().querySelector('[data-testid="pharmacy-prescriptions-sin-perfil"]'),
    ).not.toBeNull();
  });
});
