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
 * 3. **Una lectura por sede, en paralelo (R-02)**: el «próximo hueco» sale de
 *    la misma lectura y sólo se muestra con la semana vacía; ninguna sede
 *    espera a otra, y cada una muestra su propia carga.
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
   * Deja correr la cadena de promesas de cada sede (lectura → reparto →
   * estado) y pinta: una sola vuelta de `whenStable` no alcanza.
   */
  async function asentar(): Promise<void> {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  /** Un instante dentro de la ventana pedida, `horas` después de su inicio. */
  function despuesDelInicio(
    pedido: { request: { params: { get(k: string): string | null } } },
    horas: number,
  ): string {
    const desde = new Date(pedido.request.params.get('from') ?? '');
    return new Date(desde.getTime() + horas * 60 * 60 * 1000).toISOString();
  }

  /**
   * R-02 (H2.S2.M2): la API no admite filtro por profesional, así que la unidad
   * es la sede — pero todas salen a la vez, antes de que vuelva ninguna.
   */
  it('pide los cupos de todas las sedes en paralelo, una lectura por sede', async () => {
    await montar();
    await responderRecursos([recurso(), recurso({ id: 'res-2', name: 'Consultorio Norte' })]);

    const pedidos = http.match((r) => r.url === '/scheduling/slots');
    expect(pedidos.map((p) => p.request.params.get('resourceId'))).toEqual(['res-1', 'res-2']);
    for (const pedido of pedidos) {
      pedido.flush({ items: [], count: 0, limit: 500, truncated: false });
    }
    await asentar();

    // Ni la semana vacía dispara una segunda lectura: el próximo hueco ya vino.
    http.expectNone((r) => r.url === '/scheduling/slots');
  });

  /**
   * H2.S2.M3: una sola lectura cubre la semana y el horizonte del próximo
   * hueco, así que no hay una segunda espera en serie.
   */
  it('la única lectura cubre la semana visible y el horizonte del próximo hueco', async () => {
    await montar();
    await responderRecursos([recurso()]);

    const pedido = http.expectOne((r) => r.url === '/scheduling/slots');
    const desde = new Date(pedido.request.params.get('from') ?? '').getTime();
    const hasta = new Date(pedido.request.params.get('to') ?? '').getTime();
    const dias = (hasta - desde) / (24 * 60 * 60 * 1000);
    expect(dias).toBeGreaterThan(60);
    // La API rechaza ventanas de más de 92 días.
    expect(dias).toBeLessThanOrEqual(92);
    expect(pedido.request.params.get('limit')).toBe('500');
    pedido.flush({ items: [], count: 0, limit: 500, truncated: false });
    fixture.detectChanges();
  });

  it('con cupos esta semana no ofrece el próximo hueco aunque venga en la lectura', async () => {
    await montar();
    await responderRecursos([recurso()]);
    const pedido = http.expectOne((r) => r.url === '/scheduling/slots');
    pedido.flush({
      items: [
        cupo('slot-1', despuesDelInicio(pedido, 1)),
        cupo('slot-lejos', despuesDelInicio(pedido, 30 * 24)),
      ],
      count: 2,
      limit: 500,
      truncated: false,
    });
    await asentar();

    const chips = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.disponibilidad__cupos button',
    );
    expect(chips).toHaveLength(1);
    expect(texto()).not.toContain('Próximo turno');
  });

  it('con la semana vacía ofrece el próximo hueco de la misma lectura', async () => {
    await montar();
    await responderRecursos([recurso()]);
    const pedido = http.expectOne((r) => r.url === '/scheduling/slots');
    pedido.flush({
      items: [cupo('slot-9', despuesDelInicio(pedido, 30 * 24))],
      count: 1,
      limit: 500,
      truncated: false,
    });
    await asentar();

    expect(texto()).toContain('Próximo turno');
    http.expectNone((r) => r.url === '/scheduling/slots');
  });

  it('sin nada en el horizonte lo dice con todas las letras', async () => {
    await montar();
    await responderRecursos([recurso()]);
    await responderCupos([]);
    await asentar();

    expect(texto()).toContain('No tiene turnos disponibles');
  });

  /**
   * H2.S2.M4: cada sede con su carga. La que respondió ya muestra sus cupos
   * mientras la otra sigue buscando, anunciado con `role="status"`.
   */
  it('cada sede muestra su propia carga y no espera a la más lenta', async () => {
    await montar();
    await responderRecursos([recurso(), recurso({ id: 'res-2', name: 'Consultorio Norte' })]);
    const [primera, segunda] = http.match((r) => r.url === '/scheduling/slots');
    primera!.flush({
      items: [cupo('slot-1', despuesDelInicio(primera!, 1))],
      count: 1,
      limit: 500,
      truncated: false,
    });
    await asentar();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('.disponibilidad__cupos button')).toHaveLength(1);
    const buscando = raiz.querySelectorAll('.disponibilidad__buscando[role="status"]');
    expect(buscando).toHaveLength(1);
    expect(buscando[0]!.textContent).toContain('Buscando turnos en Consultorio Norte');

    segunda!.flush({ items: [], count: 0, limit: 500, truncated: false });
    await asentar();
    expect(raiz.querySelectorAll('.disponibilidad__buscando')).toHaveLength(0);
  });

  it('si una sede falla, las otras siguen y esa ofrece reintentar sola', async () => {
    await montar();
    await responderRecursos([recurso(), recurso({ id: 'res-2', name: 'Consultorio Norte' })]);
    const [primera, segunda] = http.match((r) => r.url === '/scheduling/slots');
    primera!.flush({ items: [], count: 0, limit: 500, truncated: false });
    segunda!.flush({ message: 'caído' }, { status: 503, statusText: 'Service Unavailable' });
    await asentar();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.disponibilidad__error')?.textContent).toContain(
      'No pudimos traer los turnos de esta sede',
    );
    expect(texto()).toContain('No tiene turnos disponibles');

    const reintentar = Array.from(raiz.querySelectorAll('.disponibilidad__error button')).find(
      (b) => b.textContent?.includes('Reintentar'),
    ) as HTMLButtonElement;
    reintentar.click();
    const reintento = http.expectOne((r) => r.url === '/scheduling/slots');
    expect(reintento.request.params.get('resourceId')).toBe('res-2');
    reintento.flush({ items: [], count: 0, limit: 500, truncated: false });
    await fixture.whenStable();
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

  it('mientras abre un cupo no permite iniciar otra reserva', async () => {
    await montar();
    let resolverNavegacion: ((value: boolean) => void) | undefined;
    const navegar = vi.spyOn(router, 'navigate').mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolverNavegacion = resolve;
      }),
    );
    await responderRecursos([recurso()]);
    await responderCupos([
      cupo('slot-1', '2026-09-07T13:30:00.000Z'),
      cupo('slot-2', '2026-09-07T14:00:00.000Z'),
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const botones = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.disponibilidad__cupos button',
    );
    (botones[0] as HTMLButtonElement).click();
    (botones[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(navegar).toHaveBeenCalledTimes(1);
    expect((botones[0] as HTMLButtonElement).getAttribute('aria-busy')).toBe('true');
    expect((botones[1] as HTMLButtonElement).getAttribute('aria-disabled')).toBe('true');

    resolverNavegacion?.(true);
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
