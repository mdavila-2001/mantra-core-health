import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { FollowUpBlock, enFranjas } from './follow-up-block';

/** Mañana a la hora que se pida, en hora local: los cupos se ofrecen así. */
function manana(hora: number, minutos = 0): Date {
  const dia = new Date(Date.now() + 24 * 60 * 60 * 1000);
  dia.setHours(hora, minutos, 0, 0);
  return dia;
}

/** Una cita de origen tal como la manda la API, con sus dos campos de C4. */
function citaDeOrigen(extra: Record<string, unknown> = {}) {
  return {
    id: 'b-origen',
    patientProfileId: 'pp-1',
    resourceId: 'r-1',
    statusConceptId: 'c-completed',
    startAt: '2026-09-12T13:00:00.000Z',
    endAt: '2026-09-12T13:30:00.000Z',
    reasonText: 'Control de presión arterial',
    createdAt: '2026-09-01T10:00:00.000Z',
    followUpOf: null,
    followUpBookingId: null,
    ...extra,
  };
}

const RECURSO = {
  id: 'r-1',
  name: 'Agenda de la Dra. Rojas',
  resourceTypeConceptId: 'c-prac',
  resourceRefType: 'health_practitioner_profiles',
  resourceRefId: 'hp-1',
  practitionerName: 'Dra. Rojas',
  practiceId: 'pr-1',
  timeZone: 'America/La_Paz',
  capacity: 1,
  stateConceptId: 'c-activo',
  site: {
    id: 's-1',
    name: 'Clínica Los Olivos',
    code: 'OLIVOS',
    addressText: null,
    timeZone: 'America/La_Paz',
  },
};

/** Un cupo libre tal como lo manda `GET /scheduling/slots`. */
function cupo(id: string, desde: Date, minutos = 30) {
  return {
    id,
    resourceId: 'r-1',
    scheduleTemplateId: 't-1',
    startAt: desde.toISOString(),
    endAt: new Date(desde.getTime() + minutos * 60_000).toISOString(),
    capacity: 1,
    remainingCapacity: 1,
    statusConceptId: 'c-activo',
    serviceConceptId: 'c-consulta',
  };
}

async function montar(
  opciones: {
    bookingId?: string | null;
    encounterId?: string | null;
    origen?: Record<string, unknown>;
    reconsulta?: Record<string, unknown>;
    /** Los cupos libres del mes, que el calendario pide apenas se resuelve. */
    cupos?: readonly unknown[];
  } = {},
) {
  await TestBed.configureTestingModule({
    imports: [FollowUpBlock],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          activeTenantId: signal('t-1'),
          practitionerProfileId: signal('hp-1'),
        },
      },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<FollowUpBlock> = TestBed.createComponent(FollowUpBlock);
  fixture.componentRef.setInput('patientProfileId', 'pp-1');
  fixture.componentRef.setInput(
    'bookingId',
    opciones.bookingId === undefined ? 'b-origen' : opciones.bookingId,
  );
  fixture.componentRef.setInput(
    'encounterId',
    opciones.encounterId === undefined ? 'enc-1' : opciones.encounterId,
  );
  fixture.detectChanges();

  const http = TestBed.inject(HttpTestingController);

  if (opciones.bookingId !== null) {
    http.expectOne('/scheduling/bookings/b-origen').flush(citaDeOrigen(opciones.origen));
    http.expectOne((r) => r.url === '/scheduling/resources').flush({
      items: [RECURSO],
      count: 1,
    });
    if (opciones.reconsulta !== undefined) {
      http
        .expectOne('/scheduling/bookings/b-reconsulta')
        .flush(citaDeOrigen({ id: 'b-reconsulta', ...opciones.reconsulta }));
    }
    fixture.detectChanges();

    // Con la consulta resuelta, el calendario pide los cupos del mes para
    // pintar de verde y de rojo. Con la reconsulta ya agendada no hay
    // formulario, así que no pide nada.
    if (opciones.reconsulta === undefined) {
      responderCuposDelMes(http, opciones.cupos ?? []);
      fixture.detectChanges();
    }
  }

  return { fixture, http };
}

/** Responde la lectura de cupos del mes que dispara el calendario. */
function responderCuposDelMes(http: HttpTestingController, cupos: readonly unknown[]): void {
  http
    .expectOne((r) => r.url === '/scheduling/slots')
    .flush({ items: cupos, count: cupos.length, limit: 1500, truncated: false });
}

/** Una señal, una computada o un método del componente. */
type UnMiembro = (...args: never[]) => unknown;

function api(fixture: ComponentFixture<FollowUpBlock>): Record<string, UnMiembro> {
  return fixture.componentInstance as unknown as Record<string, UnMiembro>;
}

/**
 * Elige el día de mañana.
 *
 * Ya no pide nada: los cupos del día salen de la lectura del mes que el
 * calendario hizo al montar.
 */
function elegirDia(fixture: ComponentFixture<FollowUpBlock>): void {
  (api(fixture)['dia'] as unknown as { set(v: Date): void }).set(manana(0));
  fixture.detectChanges();
}

describe('FollowUpBlock', () => {
  afterEach(() => TestBed.resetTestingModule());

  /* ---- los tres estados ---------------------------------------------------- */

  it('sin cita de origen explica de dónde se agenda, y no pide nada al servidor', async () => {
    const { fixture, http } = await montar({ bookingId: null });

    expect(fixture.nativeElement.textContent).toContain('La reconsulta se agenda desde una cita');
    expect(
      fixture.nativeElement.querySelector('[data-testid="reconsulta-sin-cita"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="reconsulta-guardar"]')).toBeNull();
    http.verify();
  });

  it('con una reconsulta ya agendada muestra la que hay y ofrece reprogramar, sin formulario', async () => {
    const { fixture, http } = await montar({
      origen: { followUpBookingId: 'b-reconsulta' },
      reconsulta: {
        startAt: manana(10).toISOString(),
        reasonText: 'Reconsulta: Control de presión arterial',
      },
    });

    const tarjeta = fixture.nativeElement.querySelector('[data-testid="reconsulta-ya-agendada"]');
    expect(tarjeta).not.toBeNull();
    expect(tarjeta.textContent).toContain('Ya la citaste de nuevo');
    expect(tarjeta.textContent).toContain('Reprogramar');
    expect(fixture.nativeElement.querySelector('[data-testid="reconsulta-guardar"]')).toBeNull();
    http.verify();
  });

  it('sin reconsulta previa ofrece el formulario, con el día y el motivo heredado', async () => {
    const { fixture, http } = await montar();

    expect(
      fixture.nativeElement.querySelector('[data-testid="reconsulta-calendario"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="reconsulta-guardar"]')).not.toBeNull();
    expect(api(fixture)['motivo']()).toBe('Reconsulta: Control de presión arterial');
    http.verify();
  });

  /* ---- día, cupos y motivo ------------------------------------------------- */

  it('sin cupo elegido no se puede agendar, y el botón queda deshabilitado', async () => {
    const { fixture, http } = await montar();

    expect(api(fixture)['puedeAgendar']()).toBe(false);
    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="reconsulta-guardar"]',
    );
    expect(boton.getAttribute('aria-disabled')).toBe('true');

    // Y no escribe nada aunque se lo empuje: la interfaz no es la barrera.
    api(fixture)['agendar']();
    http.expectNone('/scheduling/appointments/direct');
    http.verify();
  });

  it('pide los cupos libres del mes entero de una sola vez, para pintar el calendario', async () => {
    await TestBed.configureTestingModule({
      imports: [FollowUpBlock],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { activeTenantId: signal('t-1'), practitionerProfileId: signal('hp-1') },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FollowUpBlock);
    fixture.componentRef.setInput('patientProfileId', 'pp-1');
    fixture.componentRef.setInput('bookingId', 'b-origen');
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/scheduling/bookings/b-origen').flush(citaDeOrigen());
    http.expectOne((r) => r.url === '/scheduling/resources').flush({ items: [RECURSO], count: 1 });
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url === '/scheduling/slots');
    expect(req.request.params.get('resourceId')).toBe('r-1');
    expect(req.request.params.get('onlyAvailable')).toBe('true');
    // La ventana es el mes a la vista, no un día: es lo que hace falta para
    // saber de qué color va cada casilla.
    const desde = new Date(req.request.params.get('from')!);
    const hasta = new Date(req.request.params.get('to')!);
    expect(desde.getDate()).toBe(1);
    expect(hasta.getDate()).toBe(1);
    expect(hasta.getTime()).toBeGreaterThan(desde.getTime());
    req.flush({ items: [], count: 0, limit: 1500, truncated: false });
    fixture.detectChanges();
    http.verify();
  });

  it('el calendario pinta de verde los días con lugar y de rojo los que no', async () => {
    const { fixture, http } = await montar({ cupos: [cupo('s-manana', manana(8, 30))] });

    const dias: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="reconsulta-dia"]'),
    );
    const verdes = dias.filter((d) => d.getAttribute('data-estado') === 'libre');
    const rojos = dias.filter((d) => d.getAttribute('data-estado') === 'sin-cupos');

    // El único día con cupo es mañana: verde, y el resto del mes en rojo.
    expect(verdes).toHaveLength(1);
    expect(verdes[0]!.textContent).toContain('1 horario');
    expect(verdes[0]!.disabled).toBe(false);
    expect(rojos.length).toBeGreaterThan(0);
    // Los rojos no se pueden elegir: llevarían a una lista vacía.
    expect(rojos.every((d) => d.disabled)).toBe(true);
    expect(rojos[0]!.textContent).toContain('Sin lugar');

    // Y tocar el verde elige ese día, sin pedir nada más.
    verdes[0]!.click();
    fixture.detectChanges();
    expect((api(fixture)['dia']() as Date).getDate()).toBe(manana(0).getDate());
    http.verify();
  });

  it('el día elegido reparte sus cupos en mañana y tarde, en tarjetas', async () => {
    const { fixture, http } = await montar({
      cupos: [cupo('s-manana', manana(8, 30)), cupo('s-tarde', manana(15))],
    });
    elegirDia(fixture);

    const franjas = api(fixture)['franjas']() as { manana: unknown[]; tarde: unknown[] };
    expect(franjas.manana).toHaveLength(1);
    expect(franjas.tarde).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Mañana');
    expect(fixture.nativeElement.textContent).toContain('Tarde');
    // La sede va en la tarjeta: es lo que hace elegible un rato.
    expect(fixture.nativeElement.textContent).toContain('Clínica Los Olivos');

    const tarjetas: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="reconsulta-cupo-opcion"]'),
    );
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0]!.textContent).toContain('08:30 – 09:00');

    // Tocar una tarjeta la deja elegida, y lo dice con `aria-pressed`.
    tarjetas[0]!.click();
    fixture.detectChanges();
    expect(api(fixture)['cupoElegido']()).toBe('s-manana');
    expect(
      fixture.nativeElement
        .querySelectorAll('[data-testid="reconsulta-cupo-opcion"]')[0]
        .getAttribute('aria-pressed'),
    ).toBe('true');
    http.verify();
  });

  it('un día sin cupos lo dice en vez de dejar el grupo vacío', async () => {
    const { fixture, http } = await montar();
    elegirDia(fixture);

    expect(fixture.nativeElement.querySelector('[data-testid="reconsulta-sin-cupos"]')).not.toBeNull();
    expect(api(fixture)['puedeAgendar']()).toBe(false);
    http.verify();
  });

  it('lo que la persona escribe en el motivo gana sobre el heredado', async () => {
    const { fixture, http } = await montar();

    (api(fixture)['escribirMotivo'] as unknown as (t: string) => void)(
      'Reconsulta: traer el laboratorio',
    );
    fixture.detectChanges();

    expect(api(fixture)['motivo']()).toBe('Reconsulta: traer el laboratorio');
    http.verify();
  });

  /* ---- agendar ------------------------------------------------------------- */

  it('agenda la reconsulta con el cupo, la duración del cupo y el origen, y avisa el cambio', async () => {
    const { fixture, http } = await montar({ cupos: [cupo('s-manana', manana(8, 30), 20)] });
    elegirDia(fixture);

    (api(fixture)['cupoElegido'] as unknown as { set(v: string): void }).set('s-manana');
    fixture.detectChanges();
    expect(api(fixture)['puedeAgendar']()).toBe(true);

    let aviso = 0;
    fixture.componentInstance.cambio.subscribe(() => (aviso += 1));
    api(fixture)['agendar']();

    const req = http.expectOne('/scheduling/appointments/direct');
    expect(req.request.body).toEqual({
      patientProfileId: 'pp-1',
      resourceId: 'r-1',
      startAt: manana(8, 30).toISOString(),
      // Del cupo, no de una constante: una agenda de 20 minutos y otra de 30
      // conviven, y media hora fija pisaría el turno siguiente.
      durationMinutes: 20,
      reasonText: 'Reconsulta: Control de presión arterial',
      followUpOf: { bookingId: 'b-origen', encounterId: 'enc-1' },
    });
    req.flush({
      bookingId: 'b-nueva',
      bookableSlotId: 's-manana',
      statusConceptId: 'c-conf',
      retractedSlots: 0,
    });

    // Relee la consulta de origen: la reconsulta tiene que venir del servidor.
    // La relectura la dispara un efecto, así que necesita su pasada de CD.
    fixture.detectChanges();
    http.expectOne('/scheduling/bookings/b-origen').flush(
      citaDeOrigen({ followUpBookingId: 'b-nueva' }),
    );
    http.expectOne((r) => r.url === '/scheduling/resources').flush({ items: [RECURSO], count: 1 });
    http
      .expectOne('/scheduling/bookings/b-nueva')
      .flush(citaDeOrigen({ id: 'b-nueva', startAt: manana(8, 30).toISOString() }));
    fixture.detectChanges();

    expect(aviso).toBe(1);
    http.verify();
  });

  it('el éxito se ve con la fecha y con la salida a Consultas médicas', async () => {
    const { fixture, http } = await montar({ cupos: [cupo('s-manana', manana(9))] });
    elegirDia(fixture);
    (api(fixture)['cupoElegido'] as unknown as { set(v: string): void }).set('s-manana');
    fixture.detectChanges();

    api(fixture)['agendar']();
    http.expectOne('/scheduling/appointments/direct').flush({
      bookingId: 'b-nueva',
      bookableSlotId: 's-manana',
      statusConceptId: 'c-conf',
      retractedSlots: 0,
    });
    // La relectura devuelve la consulta SIN reconsulta (el servidor todavía no
    // la enlazó): así el aviso de éxito es lo único que se está mirando.
    fixture.detectChanges();
    http.expectOne('/scheduling/bookings/b-origen').flush(citaDeOrigen());
    http.expectOne((r) => r.url === '/scheduling/resources').flush({ items: [RECURSO], count: 1 });
    fixture.detectChanges();
    // El día sigue elegido, así que los cupos se releen: el que se acaba de
    // tomar ya no está libre y la lista tiene que reflejarlo.
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ items: [], count: 0, limit: 500, truncated: false });
    fixture.detectChanges();

    const exito = fixture.nativeElement.querySelector('[data-testid="reconsulta-exito"]');
    expect(exito).not.toBeNull();
    expect(exito.textContent).toContain('Ver en Consultas médicas');
    http.verify();
  });

  it('el 409 se cuenta en el bloque como «ya hay una», no como un error', async () => {
    const { fixture, http } = await montar({ cupos: [cupo('s-manana', manana(9))] });
    elegirDia(fixture);
    (api(fixture)['cupoElegido'] as unknown as { set(v: string): void }).set('s-manana');
    fixture.detectChanges();

    api(fixture)['agendar']();
    http.expectOne('/scheduling/appointments/direct').flush(
      {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Esta consulta ya tiene una reconsulta agendada',
        error: 'Conflict',
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="reconsulta-duplicada"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="reconsulta-error"]')).toBeNull();
    http.verify();
  });

  it('el 403 de una agenda ajena se explica con esas palabras', async () => {
    const { fixture, http } = await montar({ cupos: [cupo('s-manana', manana(9))] });
    elegirDia(fixture);
    (api(fixture)['cupoElegido'] as unknown as { set(v: string): void }).set('s-manana');
    fixture.detectChanges();

    api(fixture)['agendar']();
    http.expectOne('/scheduling/appointments/direct').flush(
      { statusCode: 403, code: 'FORBIDDEN', message: '', error: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('[data-testid="reconsulta-error"]');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('tu propia agenda');
    http.verify();
  });
});

/* ---- la partición de la jornada, como función pura ------------------------ */

describe('enFranjas', () => {
  const recurso = RECURSO as never;

  it('parte por la hora LOCAL del cupo, no por el texto del ISO', () => {
    const franjas = enFranjas(
      [
        { ...cupo('a', manana(11, 30)), startAt: manana(11, 30), endAt: manana(12) },
        { ...cupo('b', manana(12)), startAt: manana(12), endAt: manana(12, 30) },
      ] as never,
      recurso,
    );

    expect(franjas.manana.map((c) => c.id)).toEqual(['a']);
    expect(franjas.tarde.map((c) => c.id)).toEqual(['b']);
  });

  it('descarta los cupos sin lugar y los que ya pasaron', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const franjas = enFranjas(
      [
        { ...cupo('lleno', manana(9)), startAt: manana(9), endAt: manana(9, 30), remainingCapacity: 0 },
        { ...cupo('viejo', ayer), startAt: ayer, endAt: ayer },
        { ...cupo('libre', manana(9)), startAt: manana(9), endAt: manana(9, 30) },
      ] as never,
      recurso,
    );

    expect([...franjas.manana, ...franjas.tarde].map((c) => c.id)).toEqual(['libre']);
  });

  it('sin sede registrada la etiqueta queda con la hora sola, sin un separador colgando', () => {
    const franjas = enFranjas(
      [{ ...cupo('a', manana(9)), startAt: manana(9), endAt: manana(9, 30) }] as never,
      null,
    );

    expect(franjas.manana[0]!.etiqueta).toBe('09:00 – 09:30');
  });
});
