import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import { SHARE_QR_DRAWER } from './share-dialog/share-dialog';
import { agrupar, PrescriptionsPage, shareTargetOf } from './prescriptions-page';

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
      statusConceptId: 'st-borrador',
      createdAt: '2026-05-10T08:00:00.000Z',
    },
  ],
};

const CONCEPTOS = {
  items: [
    {
      conceptId: CONCEPTO_AMOXI,
      code: 'J01CA04',
      display: 'Amoxicilina',
      codeSystemVersionId: 'v1',
    },
    { conceptId: CONCEPTO_IBU, code: 'M01AE01', display: 'Ibuprofeno', codeSystemVersionId: 'v1' },
    {
      conceptId: CONCEPTO_PARA,
      code: 'N02BE01',
      display: 'Paracetamol',
      codeSystemVersionId: 'v1',
    },
    // Los estados, con el código que sirve la API (`<módulo>:<clave>`).
    ...(
      [
        ['st-activa', 'clinical:MEDICATION_REQUEST_ISSUED'],
        ['st-borrador', 'clinical:MEDICATION_REQUEST_DRAFT'],
        ['st-anulada', 'clinical:MEDICATION_REQUEST_INVALIDATED'],
        ['st-reemplazada', 'clinical:MEDICATION_REQUEST_REPLACED'],
        ['st-completada', 'clinical:MEDICATION_REQUEST_COMPLETED'],
      ] as const
    ).map(([conceptId, code]) => ({
      conceptId,
      code,
      display: code,
      codeSystemVersionId: 'v1',
    })),
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

  it('«Buscar dónde comprarla» lleva a la receta correcta, y sólo en la vigente', () => {
    entrarComoPaciente();
    montar();
    responder();

    const enlaces = [
      ...raiz().querySelectorAll<HTMLAnchorElement>('[data-testid="pharmacy-prescription-search"]'),
    ];
    // La suelta del 10/05 es un borrador: no se ofrece comprarla.
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0].getAttribute('href')).toBe('/my-account/medical-record/where-to-buy/m-1');
  });

  it('pide al catálogo también el estado de cada fila', () => {
    entrarComoPaciente();
    montar();
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    const req = http.expectOne((r) => r.url === '/terminology/concepts');
    const ids = req.request.params.getAll('ids')?.join(',') ?? '';
    expect(ids).toContain('st-activa');
    expect(ids).toContain('st-borrador');
    req.flush(CONCEPTOS);
  });

  it.each([
    ['st-borrador', undefined, 'Sin emitir', 'todavía no la emitió'],
    ['st-anulada', undefined, 'Anulada', 'anuló'],
    ['st-reemplazada', undefined, 'Reemplazada', 'reemplazó'],
    ['st-completada', undefined, 'Completada', 'ya se completó'],
    ['st-activa', '2026-01-01T00:00:00.000Z', 'Vencida', 'venció'],
  ] as const)(
    'una receta %s (vence %s) dice «%s», y no ofrece comprar ni compartir',
    (status, validTo, label, reason) => {
      entrarComoPaciente();
      montar();
      responder(
        {
          ...RESUMEN,
          medicationRequests: [
            {
              id: 'm-9',
              medicationConceptId: CONCEPTO_AMOXI,
              statusConceptId: status,
              encounterId: 'e-9',
              issuedAt: '2025-12-01T11:00:00.000Z',
              createdAt: '2025-12-01T10:30:00.000Z',
              ...(validTo === undefined ? {} : { validTo }),
            },
          ],
        },
        CONCEPTOS,
      );

      expect(
        raiz().querySelector('[data-testid="pharmacy-prescription-status"]')?.textContent?.trim(),
      ).toBe(label);
      expect(
        raiz().querySelector('[data-testid="pharmacy-prescription-not-orderable"]')?.textContent,
      ).toContain(reason);
      expect(raiz().querySelector('[data-testid="pharmacy-prescription-search"]')).toBeNull();
      expect(raiz().querySelector('[data-testid="prescription-share-button"]')).toBeNull();
    },
  );

  it('una receta emitida y vigente dice «Vigente» con el código real del catálogo', () => {
    entrarComoPaciente();
    montar();
    responder();

    expect(
      [...raiz().querySelectorAll('[data-testid="pharmacy-prescription-status"]')].map((badge) =>
        badge.textContent?.trim(),
      ),
    ).toEqual(['Sin emitir', 'Vigente']);
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
    expect(texto).not.toContain('Todavía no tiene recetas');
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

/**
 * «Compartir» y «Enlaces compartidos» en Mis recetas (FAR-01, REQ-017 y
 * REQ-018).
 *
 * Lo que fijan estas pruebas: la agrupación conserva la consulta, que es lo
 * que se comparte; una receta sin emitir no ofrece «Compartir»; el botón abre
 * el diálogo, que crea el enlace de la consulta; la segunda pestaña lista los
 * enlaces; y el dueño que llega desde `/rx/:token` (`?share=`) cae directo en
 * esa pestaña.
 */
describe('PrescriptionsPage · compartir', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SHARE_QR_DRAWER, useValue: () => Promise.resolve() },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-1' }),
      refreshToken: 'r-1',
    });
  });

  afterEach(() => http.verify());

  function mount(): ComponentFixture<PrescriptionsPage> {
    const fixture = TestBed.createComponent(PrescriptionsPage);
    fixture.detectChanges();
    return fixture;
  }

  function answer(fixture: ComponentFixture<PrescriptionsPage>): void {
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    fixture.detectChanges();
  }

  function shareButtons(fixture: ComponentFixture<PrescriptionsPage>): HTMLButtonElement[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '[data-testid="prescription-share-button"]',
      ),
    ];
  }

  it('la agrupación conserva la consulta; la receta suelta queda sin ella', () => {
    const rows: MedicationRequest[] = RESUMEN.medicationRequests.map(
      ({ issuedAt, createdAt, ...rest }) => ({
        ...rest,
        ...(issuedAt === undefined ? {} : { issuedAt: new Date(issuedAt) }),
        createdAt: new Date(createdAt),
      }),
    );
    const prescriptions = agrupar(rows, new Map(), new Date('2026-06-01T00:00:00.000Z'));

    const fromEncounter = prescriptions.find((item) => item.requestId === 'm-1');
    const standalone = prescriptions.find((item) => item.requestId === 'm-3');
    expect(fromEncounter?.encounterId).toBe('e-1');
    expect(standalone?.encounterId).toBeNull();
    expect(fromEncounter && shareTargetOf(fromEncounter)).toEqual({ encounterId: 'e-1' });
    expect(standalone && shareTargetOf(standalone)).toEqual({ medicationRequestId: 'm-3' });
  });

  it('solo la receta vigente ofrece «Compartir»', () => {
    const fixture = mount();
    answer(fixture);

    // Dos recetas: la de la consulta (emitida) y la standalone (sin emitir).
    expect(fixture.nativeElement.querySelectorAll('.receta')).toHaveLength(2);
    expect(shareButtons(fixture)).toHaveLength(1);
  });

  it('«Compartir» abre el diálogo y crea el enlace de esa consulta', () => {
    const fixture = mount();
    answer(fixture);

    shareButtons(fixture)[0].click();
    fixture.detectChanges();

    const req = http.expectOne('/clinical/prescription-shares');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ encounterId: 'e-1' });
    req.flush({
      shareId: 'sh-1',
      url: 'https://app.example.test/rx/tk',
      token: 'tk',
      expiresAt: '2026-11-29T12:00:00.000Z',
      itemCount: 2,
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="prescription-share-dialog-url"]')
        ?.textContent,
    ).toContain('https://app.example.test/rx/tk');
  });

  it('la pestaña «Enlaces compartidos» pide los enlaces del paciente', () => {
    const fixture = mount();
    answer(fixture);

    const tab = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')].find(
      (element) => element.textContent?.includes('Enlaces compartidos'),
    ) as HTMLButtonElement;
    tab.click();
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url === '/clinical/prescription-shares');
    expect(req.request.params.get('patientProfileId')).toBe('pp-1');
    req.flush([]);
  });

  it('con ?share= abre directo en «Enlaces compartidos»', async () => {
    await TestBed.inject(Router).navigateByUrl('/?share=sh-1');
    const fixture = mount();

    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/clinical/prescription-shares').flush([]);
  });
});
