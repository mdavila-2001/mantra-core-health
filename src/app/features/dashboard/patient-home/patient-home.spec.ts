import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { PatientHome } from './patient-home';

/**
 * «Mi salud» — el panel de quien viene a atenderse (F-16 / F-17).
 *
 * Lo que estas pruebas fijan no es la maqueta sino las tres promesas del
 * carril: que el paciente vea **lo suyo**, que quien recién llega no se
 * encuentre una pantalla vacía, y que en ninguna parte aparezca vocabulario de
 * sistema —organización, secciones, roles, uuid—, que es exactamente lo que la
 * analista marcó del panel anterior.
 */

/** base64url sobre UTF-8, como el token real. */
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

const PERFIL = 'pp-1';

/** Una historia vacía, con la forma exacta del resumen clínico. */
function historiaVacia(): Record<string, unknown> {
  return {
    patientProfileId: PERFIL,
    conditions: [],
    allergies: [],
    medicationRequests: [],
    observations: [],
    encounters: [],
    careEpisodes: [],
    limit: 20,
    truncated: [],
  };
}

describe('PatientHome', () => {
  let fixture: ComponentFixture<PatientHome>;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Declarado en `imports` para que `compileComponents` lo alcance: la
      // plantilla trae un `@defer` desde C5 y sin compilar queda sin metadatos.
      imports: [PatientHome],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(async () => {
    // Tarea 4 · M-06: el widget de beneficios del seguro pide sus campañas desde
    // un `@defer`. Las pruebas que no van de eso lo responden vacío acá, para que
    // el panel quede exactamente como estaba y `verify` siga exigiendo que no haya
    // ninguna otra petición suelta.
    await fixture?.whenStable();
    for (const pedido of http.match((r) => r.url.startsWith('/insurance-campaigns/patient/'))) {
      pedido.flush([]);
    }
    http.verify();
  });

  /**
   * Abre sesión de paciente y monta. `pid` ausente = cuenta sin ficha.
   *
   * `async` desde que el panel encabeza con el flujo de síntomas (C5 del plan
   * de UX): va dentro de un `@defer` —la tabla de síntomas no puede viajar en
   * el bundle inicial— y una plantilla con `@defer` exige `compileComponents`.
   */
  async function montar({ pid }: { pid?: string } = { pid: PERFIL }): Promise<void> {
    session.start({
      accessToken: jwt({
        sub: 'u-1',
        roles: ['USER', 'PATIENT'],
        tenants: ['t-1'],
        name: 'Ana Quispe',
        ...(pid === undefined ? {} : { pid }),
      }),
      refreshToken: 'r-1',
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(PatientHome);
    fixture.detectChanges();
  }

  /**
   * Responde las lecturas del panel.
   *
   * Las dos primeras son fijas. La tercera —el catálogo de recursos, que FT-03
   * usa para decir con quién y dónde es la próxima cita— sólo se pide cuando
   * hay una cita por delante, así que se drena con `match` en vez de
   * `expectOne`: exigirla siempre rompería los casos sin citas.
   */
  function responder(
    citas: unknown[],
    historia: Record<string, unknown> | null,
    recursos: unknown[] = [],
  ): void {
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush({ items: citas, count: citas.length, limit: 20, truncated: false });
    http
      .expectOne((r) => r.url === `/clinical/patients/${PERFIL}/summary`)
      .flush(historia ?? historiaVacia());
    fixture.detectChanges();
    for (const pedido of http.match((r) => r.url === '/scheduling/resources')) {
      pedido.flush({ items: recursos, count: recursos.length });
    }
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /**
   * Tarea 4 · M-06: los beneficios preventivos de la aseguradora del paciente van
   * en su panel. Sin campañas vigentes no se dibuja ni un renglón.
   */
  describe('beneficios preventivos del seguro', () => {
    const CAMPANA = {
      id: 'camp-1',
      code: 'CMP-CARDIO-2026',
      title: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
      description: null,
      campaignType: 'LABORATORY',
      targetCondition: null,
      copayBonusPercentage: 100,
      validFrom: '2026-01-01',
      validTo: '2099-12-31',
      carrierName: 'Seguros Andina',
      partners: [{ role: 'PROVIDER', type: 'LABORATORY', name: 'Laboratorio Central AloVida' }],
    };

    it('muestra la tarjeta con el sello y el botón cuando hay una campaña vigente', async () => {
      await montar();
      responder([], null);
      await fixture.whenStable();

      http.expectOne(`/insurance-campaigns/patient/${PERFIL}`).flush([CAMPANA]);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      expect(texto()).toContain('Beneficios preventivos de tu seguro');
      expect(texto()).toContain('100% Cubierto por tu Seguro');
      expect(raiz.querySelector('[data-testid="btn-campaign-action"]')?.textContent).toContain(
        'Agendar chequeo preventivo',
      );
    });

    it('sin campañas vigentes el panel no suma ni un renglón', async () => {
      await montar();
      responder([], null);
      await fixture.whenStable();

      http.expectOne(`/insurance-campaigns/patient/${PERFIL}`).flush([]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(texto()).not.toContain('Beneficios preventivos');
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[data-testid="campaigns-widget"]'),
      ).toBeNull();
    });

    it('si la consulta de campañas falla, el resto del panel sigue igual', async () => {
      await montar();
      responder([], null);
      await fixture.whenStable();

      http
        .expectOne(`/insurance-campaigns/patient/${PERFIL}`)
        .flush(
          { statusCode: 403, code: 'FORBIDDEN', message: 'no', timestamp: 'x', path: '/x' },
          { status: 403, statusText: 'Forbidden' },
        );
      fixture.detectChanges();
      await fixture.whenStable();

      expect(texto()).toContain('Ana Quispe');
      expect(texto()).not.toContain('Beneficios preventivos');
    });
  });

  it('saluda por el nombre y habla de lo suyo, no de la organización', async () => {
    await montar();
    responder([], null);

    expect(texto()).toContain('Ana Quispe');
    // El subtítulo cambió con C5: el panel ahora encabeza con los síntomas.
    expect(texto()).toContain('Contanos qué te pasa');
  });

  /**
   * F-16 / F-17. Lo que la analista marcó del panel anterior: «¿a qué se
   * refiere organización desde la vista del paciente?», «Secciones disponibles:
   * 12», «estado del sistema». Nada de eso es del paciente.
   */
  it('no usa vocabulario de sistema ni muestra identificadores', async () => {
    await montar();
    responder([{ id: 'b-1', statusConceptId: 'c-1', startAt: '2099-01-01T13:00:00.000Z' }], null);

    const t = texto().toLowerCase();
    for (const palabra of [
      'organización',
      'organizaciones',
      'secciones',
      'estado del sistema',
      'tenant',
      'patient',
    ]) {
      expect(t).not.toContain(palabra);
    }
    expect(texto()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it('muestra el próximo turno, no el más viejo ni uno que ya pasó', async () => {
    await montar();
    responder(
      [
        { id: 'pasado', statusConceptId: 'c-1', startAt: '2020-01-01T13:00:00.000Z' },
        { id: 'lejano', statusConceptId: 'c-1', startAt: '2099-12-31T13:00:00.000Z' },
        { id: 'proximo', statusConceptId: 'c-1', startAt: '2099-01-01T13:00:00.000Z' },
      ],
      null,
    );

    // Se comprueba cuál es, no cómo se formatea la fecha.
    const tarjeta = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="mi-salud-proxima-cita"]',
    );
    expect(tarjeta?.getAttribute('data-turno')).toBe('proximo');
  });

  /* ---- FT-03 · el bloque de la próxima cita ------------------------------ */

  /**
   * FT-03-R01. El texto es el pedido literal del cliente: «Tu próximo turno»
   * no puede quedar en ninguna parte de la pantalla.
   */
  it('llama al bloque «Tu próxima cita» y no «Tu próximo turno»', async () => {
    await montar();
    responder([{ id: 'b-1', statusConceptId: 'c-1', startAt: '2099-01-01T13:00:00.000Z' }], null);

    expect(texto()).toContain('Tu próxima cita');
    expect(texto()).not.toContain('Tu próximo turno');
  });

  /**
   * FT-03-R03. La cita dice con quién y dónde, no sólo cuándo. Sin esto el
   * bloque tenía un único dato y por eso no había jerarquía que mostrar.
   */
  it('dice con quién y en qué consultorio es la próxima cita', async () => {
    await montar();
    responder(
      [
        {
          id: 'b-1',
          statusConceptId: 'c-1',
          resourceId: 'rec-1',
          startAt: '2099-01-01T13:00:00.000Z',
        },
      ],
      null,
      [
        {
          id: 'rec-1',
          name: 'Agenda cardiología',
          resourceTypeConceptId: 'c-t',
          resourceRefType: 'health_practitioner_profiles',
          resourceRefId: 'pr-1',
          practitionerName: 'Dra. Valeria Rojas',
          practiceId: null,
          timeZone: null,
          capacity: 1,
          stateConceptId: 'c-s',
          site: { id: 's-1', name: 'Consultorio 3', code: 'C3', addressText: null, timeZone: null },
        },
      ],
    );

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="mi-salud-cita-profesional"]')?.textContent).toContain(
      'Dra. Valeria Rojas',
    );
    expect(raiz.querySelector('[data-testid="mi-salud-cita-lugar"]')?.textContent).toContain(
      'Consultorio 3',
    );
  });

  /**
   * FT-03-R06. Sin citas por delante el bloque dice que no hay y ofrece la
   * salida, en vez de quedar en blanco —que se lee como «no cargó».
   */
  it('sin citas por delante, el bloque lo dice y ofrece pedir una', async () => {
    await montar();
    // Una cita que ya pasó: hay historia, así que no es la pantalla de bienvenida.
    responder([{ id: 'viejo', statusConceptId: 'c-1', startAt: '2020-01-01T13:00:00.000Z' }], {
      ...historiaVacia(),
      encounters: [{ id: 'e-1', startAt: '2020-01-01T13:00:00.000Z' }],
    });

    const bloque = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="mi-salud-proxima-cita"]',
    );
    expect(bloque?.getAttribute('data-estado')).toBe('empty');
    expect(bloque?.textContent).toContain('No tenés citas pedidas');
    expect(bloque?.textContent).toContain('Pedir una cita');
  });

  it('quien recién llega recibe una invitación, no tres tarjetas vacías', async () => {
    await montar();
    responder([], null);

    const primera = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="mi-salud-primera-vez"]',
    );
    expect(primera).not.toBeNull();
    expect(primera?.textContent).toContain('Pedir mi primer turno');
  });

  it('con historia, ofrece ver y descargar la última receta', async () => {
    await montar();
    responder([], {
      ...historiaVacia(),
      medicationRequests: [
        { id: 'r-1', medicationConceptId: 'm-1', issuedAt: '2026-08-10T10:00:00.000Z' },
      ],
    });

    const receta = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="mi-salud-receta"]',
    );
    expect(receta?.textContent).toContain('Ver y descargar');
    expect(receta?.textContent).toContain('2026');
  });

  /**
   * La grilla «Ir a lo tuyo» se retiró a pedido del doctor (P-03, 22/09/2026):
   * turnos e historia siguen a mano desde las tarjetas del resumen, y la Guía,
   * desde el menú. Lo que se comprueba es que no volvió, y que el camino a los
   * turnos no se fue con ella.
   */
  it('ya no ofrece la grilla de accesos; los turnos siguen a mano desde el resumen', async () => {
    await montar();
    responder([], null);

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="mi-salud-acceso"]')).toBeNull();
    expect(html.querySelector('nav.mi-salud__accesos')).toBeNull();

    const rutas = [...html.querySelectorAll<HTMLAnchorElement>('a[href]')].map((enlace) =>
      enlace.getAttribute('href'),
    );
    expect(rutas).toContain('/my-account/appointments');
  });

  /** Media pantalla útil es mejor que un error que tapa lo que sí se pudo leer. */
  it('si falla una lectura, muestra la otra', async () => {
    await montar();
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush('nope', { status: 500, statusText: 'Server Error' });
    http
      .expectOne((r) => r.url === `/clinical/patients/${PERFIL}/summary`)
      .flush({
        ...historiaVacia(),
        medicationRequests: [
          { id: 'r-1', medicationConceptId: 'm-1', issuedAt: '2026-08-10T10:00:00.000Z' },
        ],
      });
    fixture.detectChanges();

    expect(texto()).toContain('Ver y descargar');
  });

  it('sin ficha de paciente no sale a la red', async () => {
    await montar({ pid: undefined });

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(texto()).toContain('ficha de paciente');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="mi-salud-sin-ficha"]'),
    ).not.toBeNull();
  });
});
