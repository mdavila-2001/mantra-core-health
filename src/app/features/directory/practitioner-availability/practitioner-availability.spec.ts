import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { PractitionerAvailability } from './practitioner-availability';

/**
 * La mini-disponibilidad del profesional — TP-4.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Sólo los recursos del profesional**: el catálogo devuelve los de toda la
 *    organización, y mostrar los de un colega sería ofrecer turnos con otra
 *    persona.
 * 2. **Nunca cupos del pasado**: la ventana arranca en el momento actual, no en
 *    el lunes, cuando la semana visible es la de hoy.
 * 3. **El «próximo hueco» sólo cuando hace falta**: pedirlo siempre sería una
 *    consulta de más por sede en el caso normal.
 * 4. **Un clic lleva a la reserva con todo elegido**, con los tres datos que la
 *    reserva necesita para reencontrar el cupo al recargar.
 * 5. **Sin sesión se dice**, en vez de prometer horarios que van a volver 401.
 */
describe('PractitionerAvailability', () => {
  let fixture: ComponentFixture<PractitionerAvailability>;
  let http: HttpTestingController;
  let router: Router;

  const PERFIL = 'hp-1';
  const TENANT = 'ten-1';

  /** Un recurso agendable tal como lo devuelve el catálogo. */
  function recurso(overrides: Record<string, unknown> = {}) {
    return {
      id: 'res-1',
      name: 'Consultorio Centro',
      resourceTypeConceptId: 'rt-1',
      resourceRefType: 'health_practitioner_profiles',
      resourceRefId: PERFIL,
      practitionerName: 'Dra. Lucía Salas',
      practiceId: null,
      timeZone: 'America/La_Paz',
      capacity: 1,
      stateConceptId: 'st-1',
      tenantId: TENANT,
      ...overrides,
    };
  }

  /** Un cupo libre. */
  function cupo(id: string, startAt: string, resourceId = 'res-1') {
    return {
      id,
      resourceId,
      scheduleTemplateId: null,
      startAt,
      endAt: startAt,
      capacity: 1,
      remainingCapacity: 1,
      statusConceptId: 'st-open',
      serviceConceptId: null,
    };
  }

  /**
   * Monta el componente y espera a que el efecto de carga corra.
   *
   * El efecto es asíncrono a propósito —los inputs no tienen valor cuando el
   * componente se construye— así que sin esta espera las pruebas buscan una
   * petición que todavía no salió.
   */
  async function montar(autenticado = true, tenantId: string | null = TENANT): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => autenticado,
            activeTenantId: () => tenantId,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(PractitionerAvailability);
    fixture.componentRef.setInput('practitionerProfileId', PERFIL);
    fixture.componentRef.setInput('tenantId', tenantId);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /** Responde el catálogo de recursos y deja salir las peticiones de cupos. */
  async function responderRecursos(recursos: unknown[]): Promise<void> {
    http
      .expectOne((r) => r.url === '/scheduling/resources')
      .flush({ items: recursos, count: recursos.length, limit: 50 });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function responderCupos(cupos: unknown[]): Promise<void> {
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ items: cupos, count: cupos.length, limit: 200, truncated: false });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('sin sesión no promete horarios: ofrece entrar', async () => {
    await montar(false);

    expect(texto()).toContain('Entrá para ver los horarios');
    http.expectNone((r) => r.url === '/scheduling/resources');
  });

  it('sin organización activa lo dice', async () => {
    await montar(true, null);

    expect(texto()).toContain('Elegí una organización');
    http.expectNone((r) => r.url === '/scheduling/resources');
  });

  /**
   * El catálogo devuelve los recursos de toda la organización: mostrar los de
   * un colega sería ofrecer turnos con otra persona.
   */
  it('sólo pide cupos de los recursos de este profesional', async () => {
    await montar();
    await responderRecursos([
      recurso(),
      recurso({ id: 'res-ajeno', resourceRefId: 'hp-otro' }),
      recurso({ id: 'res-sala', resourceRefType: 'care_spaces', resourceRefId: 'sala-1' }),
    ]);

    const pedidos = http.match((r) => r.url === '/scheduling/slots');
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].request.params.get('resourceId')).toBe('res-1');
    pedidos[0].flush({ items: [], count: 0, limit: 200, truncated: false });
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('pide sólo los cupos disponibles', async () => {
    await montar();
    await responderRecursos([recurso()]);

    const pedido = http.expectOne((r) => r.url === '/scheduling/slots');
    expect(pedido.request.params.get('onlyAvailable')).toBe('true');
    pedido.flush({ items: [], count: 0, limit: 200, truncated: false });
    fixture.detectChanges();
  });

  /**
   * Un cupo de esta mañana ya pasó: ofrecerlo sólo sirve para que la reserva lo
   * rechace.
   */
  it('la ventana de la semana actual arranca ahora, no el lunes', async () => {
    await montar();
    await responderRecursos([recurso()]);

    const pedido = http.expectOne((r) => r.url === '/scheduling/slots');
    const desde = new Date(pedido.request.params.get('from') ?? '');
    // Con un margen de un minuto para no depender del reloj exacto.
    expect(desde.getTime()).toBeGreaterThan(Date.now() - 60_000);
    pedido.flush({ items: [], count: 0, limit: 200, truncated: false });
    fixture.detectChanges();
  });

  it('un profesional sin recursos no está lleno: no publicó horarios', async () => {
    await montar();
    await responderRecursos([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('Todavía no publicó horarios');
  });

  it('muestra un chip por cupo libre', async () => {
    await montar();
    await responderRecursos([recurso()]);
    await responderCupos([
      cupo('slot-1', '2026-09-07T13:30:00.000Z'),
      cupo('slot-2', '2026-09-07T14:00:00.000Z'),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('Consultorio Centro');
    const chips = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.disponibilidad__cupos button',
    );
    expect(chips).toHaveLength(2);
  });

  /**
   * El «próximo hueco» es una segunda consulta: sólo se paga cuando la semana
   * quedó vacía, que es cuando la persona se queda sin saber qué hacer.
   */
  it('con cupos esta semana no busca el próximo hueco', async () => {
    await montar();
    await responderRecursos([recurso()]);
    await responderCupos([cupo('slot-1', '2026-09-07T13:30:00.000Z')]);
    await fixture.whenStable();
    fixture.detectChanges();

    http.expectNone((r) => r.url === '/scheduling/slots');
  });

  it('con la semana vacía ofrece el próximo hueco', async () => {
    await montar();
    await responderRecursos([recurso()]);
    await responderCupos([]);
    await responderCupos([cupo('slot-9', '2026-09-26T14:00:00.000Z')]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('Próximo turno');
  });

  it('sin nada en el horizonte lo dice con todas las letras', async () => {
    await montar();
    await responderRecursos([recurso()]);
    await responderCupos([]);
    await responderCupos([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto()).toContain('No tiene turnos disponibles');
  });

  /**
   * Los tres datos viajan porque no existe `GET /scheduling/slots/:id`: son lo
   * que permite reencontrar el cupo si la persona recarga la reserva.
   */
  it('un clic abre la reserva con la sede y el cupo elegidos', async () => {
    await montar();
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await responderRecursos([recurso()]);
    await responderCupos([cupo('slot-1', '2026-09-07T13:30:00.000Z')]);
    await fixture.whenStable();
    fixture.detectChanges();

    (
      (fixture.nativeElement as HTMLElement).querySelector(
        '.disponibilidad__cupos button',
      ) as HTMLButtonElement
    ).click();

    expect(navegar).toHaveBeenCalledWith(
      ['/my-account/appointments/book/slot-1'],
      expect.objectContaining({
        queryParams: expect.objectContaining({ recurso: 'res-1' }),
      }),
    );
  });

  /** No se navega al pasado: esa semana siempre estaría vacía. */
  it('no deja retroceder antes de la semana actual', async () => {
    await montar();
    await responderRecursos([]);

    const anterior = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Semana anterior'));
    // `aria-disabled` y no el atributo nativo: es como el botón del banco
    // marca el deshabilitado, para que siga siendo enfocable y el lector diga
    // por qué no responde.
    expect(anterior?.getAttribute('aria-disabled')).toBe('true');
  });
});
