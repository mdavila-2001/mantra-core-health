import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { sinSolicitudDeAdmision, wireMine } from '../../../../testing/admissions';
import { MyVerifications } from './my-verifications';

/**
 * «Mis verificaciones».
 *
 * Lo que fijan estas pruebas:
 *
 * 1. Lee el perfil, las etiquetas, las solicitudes a aseguradoras y el
 *    catálogo, y pinta la hoja de ruta con un sello por tramo.
 * 2. La bandeja cuenta cada pedido como una conversación, con el motivo del
 *    rechazo dentro de la respuesta.
 * 3. Retirar y pedir **escriben en la API y vuelven a leer**: lo que se ve
 *    después es lo que la API devolvió, no lo que la pantalla supuso.
 * 4. Si las aseguradoras no se pueden leer, la pantalla no se cae: lo dice.
 */
describe('MyVerifications', () => {
  let fixture: ComponentFixture<MyVerifications>;
  let http: HttpTestingController;

  const PERFIL = {
    createdAt: '2026-01-01T00:00:00Z',
    verificationStatusConceptId: 'c-verified',
    specialties: [],
    credentials: [],
    licenses: [],
    languages: [],
    affiliations: [
      {
        id: 'af-1',
        practitionerProfileId: 'p-1',
        organizationName: 'Clínica Foianini',
        roleTitle: null,
        practiceSiteId: 'site-1',
        affiliationTypeConceptId: null,
        startDate: '2026-10-01',
        endDate: null,
        current: true,
        status: 'PENDING',
        statusKind: 'pendiente',
        decisionReasonText: null,
        createdAt: '2026-10-20T10:00:00Z',
      },
    ],
  };

  const SEGUROS = {
    items: [
      {
        id: 'ir-1',
        carrierId: 'car-1',
        carrierName: 'Alianza Seguros',
        status: 'REJECTED',
        decisionReasonText: 'Sin convenio vigente',
        createdAt: '2026-10-21T10:00:00Z',
        decidedAt: '2026-10-22T10:00:00Z',
      },
      {
        id: 'ir-2',
        carrierId: 'car-2',
        carrierName: 'La Vitalicia',
        status: 'PENDING',
        decisionReasonText: null,
        createdAt: '2026-10-25T10:00:00Z',
        decidedAt: null,
      },
    ],
    count: 2,
  };

  const CATALOGO = {
    carriers: [
      {
        id: 'car-1',
        code: 'A',
        name: 'Alianza Seguros',
        legalName: 'A',
        isPublic: false,
        plans: [],
      },
      { id: 'car-2', code: 'V', name: 'La Vitalicia', legalName: 'V', isPublic: false, plans: [] },
      { id: 'car-3', code: 'C', name: 'CNS', legalName: 'C', isPublic: true, plans: [] },
    ],
  };

  /**
   * `admission: 'none'` stubs the request card's read with a 404 (its own spec
   * covers it); `'http'` leaves it on the wire, for the tests about the request.
   */
  function montar(admission: 'none' | 'http' = 'none'): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...(admission === 'none' ? [sinSolicitudDeAdmision()] : []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyVerifications);
    fixture.detectChanges();
  }

  function responder(
    seguros: typeof SEGUROS | 'error' = SEGUROS,
    catalogo: typeof CATALOGO | 'error' = CATALOGO,
  ): void {
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL);
    for (const r of http.match((req) => req.url === '/terminology/concepts')) {
      r.flush({
        items: [
          {
            conceptId: 'c-verified',
            code: 'VERIFIED',
            display: 'Verificado',
            codeSystemVersionId: 'v1',
          },
        ],
        count: 1,
        limit: 200,
      });
    }
    const pedido = http.expectOne('/practitioners/me/insurer-requests');
    if (seguros === 'error') {
      pedido.flush(null, { status: 500, statusText: 'Error' });
    } else {
      pedido.flush(seguros);
    }
    const cat = http.expectOne('/insurance-carrier-catalog');
    if (catalogo === 'error') {
      cat.flush(null, { status: 503, statusText: 'Caída' });
    } else {
      cat.flush(catalogo);
    }
    fixture.detectChanges();
  }

  /** El componente por dentro, para manejar el selector sin el DOM de app-select. */
  function componente() {
    return fixture.componentInstance as unknown as {
      aseguradorasDisponibles(): readonly { value: string }[];
      aseguradoraNueva: { set(v: string): void };
      pedirAseguradora(): void;
    };
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function porTestId(id: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  }

  function abrirBandeja(): void {
    (fixture.componentInstance as unknown as { elegirPestana(i: number): void }).elegirPestana(1);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('pinta la hoja de ruta con un sello por tramo', () => {
    montar();
    responder();

    expect(porTestId('verif-tramo-profile')?.textContent).toContain('Verificado');
    expect(porTestId('verif-tramo-institutions')?.textContent).toContain('Pendiente');
    // Una rechazó y otra espera: el tramo espera; el rechazo lo cuenta el detalle.
    expect(porTestId('verif-tramo-insurers')?.textContent).toContain('Pendiente');
    expect(porTestId('verif-tramo-insurers')?.textContent).toContain('1 rechazada');
    expect(porTestId('verif-resumen')?.textContent).toContain('2 solicitudes esperando respuesta');
  });

  it('la bandeja cuenta cada pedido como conversación, con el motivo dentro de la respuesta', () => {
    montar();
    responder();
    abrirBandeja();

    const bandeja = porTestId('verif-bandeja')!;
    expect(bandeja.querySelectorAll('li')).toHaveLength(3);
    // La novedad más reciente arriba: la solicitud a La Vitalicia (25/10).
    expect(bandeja.querySelector('li')?.textContent).toContain('La Vitalicia');

    (porTestId('verif-hilo-ins-car-1') as HTMLButtonElement).click();
    fixture.detectChanges();
    const hilo = porTestId('verif-hilo-abierto')!;
    expect(hilo.textContent).toContain('Le pedí a Alianza Seguros');
    expect(hilo.textContent).toContain('«Sin convenio vigente»');
    expect(porTestId('verif-volver-a-pedir')).not.toBeNull();
  });

  it('retirar escribe en la API y vuelve a leer lo guardado', () => {
    montar();
    responder();
    abrirBandeja();
    (porTestId('verif-hilo-ins-car-2') as HTMLButtonElement).click();
    fixture.detectChanges();

    (porTestId('verif-retirar') as HTMLButtonElement).click();
    const retiro = http.expectOne('/practitioners/me/insurer-requests/ir-2/withdraw');
    expect(retiro.request.method).toBe('POST');
    retiro.flush({ ...SEGUROS.items[1], status: 'WITHDRAWN' });

    http.expectOne('/practitioners/me/insurer-requests').flush({
      items: [SEGUROS.items[0], { ...SEGUROS.items[1], status: 'WITHDRAWN' }],
      count: 2,
    });
    fixture.detectChanges();

    expect(porTestId('verif-aviso')?.textContent).toContain('Retiró su solicitud a La Vitalicia');
    expect(porTestId('verif-hilo-abierto')?.textContent).toContain('Retiré la solicitud.');
  });

  it('pedir a otra aseguradora sólo ofrece las que no están vivas, y relee', () => {
    montar();
    responder();
    abrirBandeja();

    const componente = fixture.componentInstance as unknown as {
      aseguradorasDisponibles(): readonly { value: string }[];
      aseguradoraNueva: { set(v: string): void };
      pedirAseguradora(): void;
    };
    // La Vitalicia está pendiente: no se ofrece. Alianza (rechazada) y CNS sí.
    expect(componente.aseguradorasDisponibles().map((o) => o.value)).toEqual(['car-1', 'car-3']);

    componente.aseguradoraNueva.set('car-3');
    componente.pedirAseguradora();
    const pedido = http.expectOne(
      (r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'POST',
    );
    expect(pedido.request.body).toEqual({ carrierIds: ['car-3'] });
    pedido.flush({ items: [], count: 0 });
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'GET')
      .flush(SEGUROS);
    fixture.detectChanges();

    expect(porTestId('verif-aviso')?.textContent).toContain('Solicitud enviada');
  });

  it('un 409 se dice con palabras, sin romper la pantalla', () => {
    montar();
    responder();
    abrirBandeja();
    const componente = fixture.componentInstance as unknown as {
      aseguradoraNueva: { set(v: string): void };
      pedirAseguradora(): void;
    };
    componente.aseguradoraNueva.set('car-3');
    componente.pedirAseguradora();
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'POST')
      .flush({ message: 'Ya pidió' }, { status: 409, statusText: 'Conflict' });
    // Lo que se ve está viejo: se relee.
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'GET')
      .flush(SEGUROS);
    fixture.detectChanges();

    expect(porTestId('verif-aviso')?.textContent).toContain('Ya tiene una solicitud viva');
  });

  it('un 422 al retirar (la aseguradora respondió entretanto) relee y muestra la respuesta', () => {
    montar();
    responder();
    abrirBandeja();
    (porTestId('verif-hilo-ins-car-2') as HTMLButtonElement).click();
    fixture.detectChanges();
    (porTestId('verif-retirar') as HTMLButtonElement).click();
    http
      .expectOne('/practitioners/me/insurer-requests/ir-2/withdraw')
      .flush({ message: 'ya decidida' }, { status: 422, statusText: 'Unprocessable' });
    http.expectOne('/practitioners/me/insurer-requests').flush({
      items: [
        SEGUROS.items[0],
        { ...SEGUROS.items[1], status: 'APPROVED', decidedAt: '2026-10-26T10:00:00Z' },
      ],
      count: 2,
    });
    fixture.detectChanges();

    expect(porTestId('verif-aviso')?.textContent).toContain('ya respondió');
    expect(porTestId('verif-hilo-abierto')?.textContent).toContain('confirmó');
    expect(porTestId('verif-retirar')).toBeNull();
  });

  it('un 422 al pedir dice que la aseguradora no recibe solicitudes, no que ya respondió', () => {
    montar();
    responder();
    abrirBandeja();
    componente().aseguradoraNueva.set('car-3');
    componente().pedirAseguradora();
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'POST')
      .flush({ message: 'inactiva' }, { status: 422, statusText: 'Unprocessable' });
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'GET')
      .flush(SEGUROS);
    fixture.detectChanges();

    const aviso = porTestId('verif-aviso')?.textContent ?? '';
    expect(aviso).toContain('no está recibiendo solicitudes');
    expect(aviso).not.toContain('ya respondió');
    expect(
      (porTestId('verif-enviar-aseguradora') as HTMLButtonElement).disabled ||
        porTestId('verif-enviar-aseguradora')?.getAttribute('aria-disabled') === 'true',
    ).toBe(true);
  });

  it('un error que no es de red no culpa a la conexión', () => {
    montar();
    responder();
    abrirBandeja();
    componente().aseguradoraNueva.set('car-3');
    componente().pedirAseguradora();
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'POST')
      .flush({ message: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(porTestId('verif-aviso')?.textContent).toContain('error 403');
  });

  it('si el pedido se guardó pero la relectura falla, dice que se guardó', () => {
    montar();
    responder();
    abrirBandeja();
    componente().aseguradoraNueva.set('car-3');
    componente().pedirAseguradora();
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'POST')
      .flush({ items: [], count: 0 }, { status: 201, statusText: 'Created' });
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'GET')
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    const aviso = porTestId('verif-aviso')?.textContent ?? '';
    expect(aviso).toContain('Solicitud enviada');
    expect(aviso).toContain('recargue la página');
    expect(aviso).not.toContain('No pudimos enviar');
  });

  it('volver a pedir conserva el rechazo anterior en la conversación', () => {
    montar();
    responder();
    abrirBandeja();
    (porTestId('verif-hilo-ins-car-1') as HTMLButtonElement).click();
    fixture.detectChanges();
    (porTestId('verif-volver-a-pedir') as HTMLButtonElement).click();
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'POST')
      .flush({ items: [], count: 0 });
    http
      .expectOne((r) => r.url === '/practitioners/me/insurer-requests' && r.method === 'GET')
      .flush({
        items: [
          {
            ...SEGUROS.items[0],
            id: 'ir-3',
            status: 'PENDING',
            decisionReasonText: null,
            createdAt: '2026-10-27T10:00:00Z',
            decidedAt: null,
          },
          ...SEGUROS.items,
        ],
        count: 3,
      });
    fixture.detectChanges();

    const hilo = porTestId('verif-hilo-abierto')!.textContent ?? '';
    expect(hilo).toContain('«Sin convenio vigente»');
    expect(hilo).toContain('Esperando que Alianza Seguros responda');
    expect(porTestId('verif-retirar')).not.toBeNull();
  });

  it('si las aseguradoras no se pueden leer, la hoja de ruta lo dice en vez de caerse', () => {
    montar();
    responder('error');

    expect(porTestId('verif-tramo-insurers')?.textContent).toContain('No pudimos leer');
    expect(texto()).toContain('Mis verificaciones');
  });

  it('y la bandeja avisa el error con reintento, no un «todavía no envió» falso', () => {
    montar();
    responder('error');
    abrirBandeja();
    expect(porTestId('verif-seguros-error')).not.toBeNull();
    expect(porTestId('verif-seguros-reintentar')).not.toBeNull();
    // La institución se sigue viendo; el vacío no se finge.
    expect(texto()).not.toContain('Todavía no envió ninguna solicitud');
  });

  it('si los estados del catálogo no se leen, la hoja de ruta lo avisa con reintento', () => {
    montar();
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL);
    for (const r of http.match((req) => req.url === '/terminology/concepts')) {
      r.flush(null, { status: 500, statusText: 'Error' });
    }
    http.expectOne('/practitioners/me/insurer-requests').flush(SEGUROS);
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    fixture.detectChanges();

    expect(porTestId('verif-etiquetas-error')).not.toBeNull();
    expect(porTestId('verif-etiquetas-reintentar')).not.toBeNull();
  });

  it('sin catálogo de aseguradoras, el campo dice por qué no se puede pedir', () => {
    montar();
    responder(SEGUROS, 'error');
    abrirBandeja();
    expect(porTestId('verif-nueva-ayuda')?.textContent).toContain(
      'No pudimos cargar la lista de aseguradoras',
    );
  });

  it('«Títulos» está entre las etapas obligatorias, con su salida a la sección exacta de «Editar perfil»', () => {
    montar();
    responder();
    const credentials = porTestId('verif-tramo-credentials')!;
    expect(credentials.closest('ol')?.getAttribute('aria-label')).toBe('Etapas de su verificación');
    expect(credentials.textContent).not.toContain('Opcional');
    // No license yet, so the license is the next step: the main call to action goes to its section.
    expect(porTestId('verif-siguiente')?.getAttribute('href')).toBe(
      '/my-account/edit?pestana=5#licenses',
    );
    expect(porTestId('verif-step-action-credentials')?.textContent).toContain('Cargar un título');
    expect(porTestId('verif-step-action-credentials')?.getAttribute('href')).toBe(
      '/my-account/edit?pestana=5#credentials',
    );
    expect(porTestId('verif-step-action-specialties')?.getAttribute('href')).toBe(
      '/my-account/edit?pestana=0#specialties',
    );
  });

  describe('la solicitud de verificación (admisión)', () => {
    const ADMISSION_URL = '/profiles/practitioners/me/admission';
    const ATTESTATION = { attested: true, attestationVersion: '2026-10' };

    /** Mounts the screen, answers its reads and the request's read. */
    function mountWithAdmission(answer: 'none' | ReturnType<typeof wireMine>): void {
      montar('http');
      responder();
      const read = http.expectOne(ADMISSION_URL);
      if (answer === 'none') {
        read.flush(
          { code: 'NOT_FOUND', reason: 'ADMISSION_NOT_FOUND' },
          { status: 404, statusText: 'Not Found' },
        );
      } else {
        read.flush(answer);
      }
      fixture.detectChanges();
    }

    function attestAndSubmit(): void {
      porTestId('admission-card-submit-attest')!.querySelector<HTMLInputElement>('input')!.click();
      fixture.detectChanges();
      porTestId('admission-card-submit')!.click();
    }

    function refusal(status: number, reason: string): [object, { status: number; statusText: string }] {
      return [{ code: 'X', reason, message: reason }, { status, statusText: 'x' }];
    }

    it('con admisión muestra su estado, y la hoja de ruta sigue debajo', () => {
      mountWithAdmission(
        wireMine({
          status: { code: 'INFORMACION_REQUERIDA', label: 'Información requerida' },
          canResubmit: true,
        }),
      );
      expect(porTestId('admission-card-status')?.textContent).toContain('Información requerida');
      expect(porTestId('admission-card-submit')).toBeNull();
      expect(porTestId('verif-tramo-profile')).not.toBeNull();
    });

    it('mientras la lee, y si su lectura falla, la hoja de ruta no se tapa', () => {
      montar('http');
      responder();
      expect(porTestId('admission-card-loading')).not.toBeNull();
      expect(porTestId('verif-tramo-profile')).not.toBeNull();
      http.expectOne(ADMISSION_URL).flush(null, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(porTestId('admission-card-error')?.textContent).toContain('No pudimos cargar');
      expect(porTestId('verif-tramo-profile')).not.toBeNull();
    });

    it('sin admisión (404) ofrece enviarla con la declaración y su versión; si sale bien, muestra la nueva', () => {
      mountWithAdmission('none');
      expect(texto()).toContain('Enviar a verificación');
      expect(texto()).toContain('Declaro que los datos y documentos son verídicos.');

      attestAndSubmit();
      const submission = http.expectOne(`${ADMISSION_URL}/submit`);
      expect(submission.request.method).toBe('POST');
      expect(submission.request.body).toEqual(ATTESTATION);
      submission.flush(wireMine({ status: { code: 'ENVIADA', label: 'Enviada' } }));
      fixture.detectChanges();

      expect(porTestId('admission-card-status')?.textContent).toContain('Enviada');
      expect(porTestId('admission-card-submit')).toBeNull();
    });

    it('un 409 (ya tenía una) relee la admisión y la muestra', () => {
      mountWithAdmission('none');
      attestAndSubmit();
      http.expectOne(`${ADMISSION_URL}/submit`).flush(...refusal(409, 'ADMISSION_ALREADY_EXISTS'));
      http
        .expectOne(ADMISSION_URL)
        .flush(wireMine({ status: { code: 'EN_REVISION', label: 'En revisión' } }));
      fixture.detectChanges();

      expect(porTestId('admission-card-status')?.textContent).toContain('En revisión');
      expect(porTestId('admission-card-submit')).toBeNull();
    });

    it('un 422 ADMISSION_NOT_PENDING relee el resumen y deja de ofrecer el envío', () => {
      mountWithAdmission('none');
      attestAndSubmit();
      http.expectOne(`${ADMISSION_URL}/submit`).flush(...refusal(422, 'ADMISSION_NOT_PENDING'));
      fixture.detectChanges();
      // The screen reads the profile summary again: what it shows is out of date.
      responder();

      expect(porTestId('admission-card-not-pending')?.textContent).toContain('ya no está pendiente');
      expect(porTestId('admission-card-submit')).toBeNull();
      expect(porTestId('verif-tramo-profile')).not.toBeNull();
    });

    it('un 422 ADMISSION_ATTESTATION_REQUIRED marca el error en la declaración, sin releer nada', () => {
      mountWithAdmission('none');
      attestAndSubmit();
      http
        .expectOne(`${ADMISSION_URL}/submit`)
        .flush(...refusal(422, 'ADMISSION_ATTESTATION_REQUIRED'));
      fixture.detectChanges();

      const hint = porTestId('admission-card-submit-attest-error')!;
      expect(hint.textContent).toContain('No recibimos su declaración');
      expect(hint.getAttribute('role')).toBe('alert');
      const checkbox = porTestId('admission-card-submit-attest')!.querySelector('input')!;
      expect(checkbox.checked).toBe(false);
      expect(checkbox.getAttribute('aria-invalid')).toBe('true');
      expect(porTestId('admission-card-submit-error')).toBeNull();
    });
  });
});
