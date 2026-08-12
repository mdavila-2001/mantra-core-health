import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../core/auth/session.store';
import { DialogService } from '../../shared/components/molecules/dialog/dialog-service';
import { Agenda } from './agenda';

/**
 * La agenda es la primera sección de **Atención** que deja de ser un cartel.
 *
 * Se monta con `RouterTestingHarness` y no con `TestBed.createComponent` porque
 * **los filtros viven en la URL**: sin un router de verdad, elegir un recurso
 * navegaría al vacío y el efecto que recarga no se enteraría nunca.
 *
 * Las tres reglas que estas pruebas fijan, y que un refactor rompería en
 * silencio:
 *
 * 1. **Sin organización no se pide nada.** `GET /scheduling/resources` exige
 *    `tenantId`; pedirlo sin él da un 400 que se lee como «la agenda falló».
 * 2. **Un bloque roto no se lleva puesto al otro.** Citas y cupos son dos
 *    lecturas: que una falle no puede vaciar la que sí respondió.
 * 3. **El identificador del paciente no se muestra sin permiso de ficha.** El
 *    enlace lleva a `GET /profiles/patients/:id`, que pide `SECURITY_ADMIN`.
 */

/** base64url **sobre UTF-8**, como el token real. */
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

const RECURSO = {
  id: 'r-1',
  name: 'Consultorio 1 · Dra. Salas',
  resourceTypeConceptId: 'rt-1',
  resourceRefType: 'health_practitioner_profiles',
  resourceRefId: 'hp-1',
  practiceId: null,
  timeZone: 'America/La_Paz',
  capacity: 1,
  stateConceptId: 'st-activo',
};

const CITA = {
  id: 'b-1',
  patientProfileId: 'p-1',
  resourceId: 'r-1',
  statusConceptId: 'c-confirmada',
  startAt: '2026-08-08T13:00:00.000Z',
  endAt: '2026-08-08T13:30:00.000Z',
  reasonText: 'Control anual',
  createdAt: '2026-08-01T10:00:00.000Z',
};

/** La agenda de OTRO profesional, para que «la primera» y «la mía» no coincidan. */
const RECURSO_AJENO = {
  ...RECURSO,
  id: 'r-0',
  name: 'Consultorio 0 · Dr. Otro',
  resourceRefId: 'hp-0',
};

/**
 * Un recurso que apunta al mismo uuid pero **desde otra tabla**.
 *
 * Existe para fijar que el cruce compara las dos cosas: si sólo mirara el
 * identificador, dos filas de tablas distintas que compartan uuid se tomarían
 * por la misma agenda.
 */
const RECURSO_DE_OTRA_TABLA = {
  ...RECURSO,
  id: 'r-9',
  name: 'Sala de rayos',
  resourceRefType: 'equipment',
  resourceRefId: 'hp-1',
};

const CUPO = {
  id: 's-1',
  resourceId: 'r-1',
  scheduleTemplateId: null,
  startAt: '2026-08-09T13:00:00.000Z',
  endAt: '2026-08-09T13:30:00.000Z',
  capacity: 2,
  remainingCapacity: 1,
  statusConceptId: 'c-abierto',
  serviceConceptId: null,
};

describe('Agenda', () => {
  let harness: RouterTestingHarness;
  let componente: Agenda;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'agenda', component: Agenda }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  /**
   * Abre sesión **antes** de montar: la agenda decide en su constructor si
   * puede pedir algo, y esa decisión sale de la organización del token.
   */
  async function montar(
    claims: Record<string, unknown> = {},
    url = '/agenda',
  ): Promise<void> {
    session.start({
      accessToken: jwt({
        sub: 'u-1',
        roles: ['SCHEDULING_ADMIN'],
        tenants: ['t-1'],
        ...claims,
      }),
      refreshToken: 'r-1',
    });
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(url, Agenda);
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function citas() {
    return interno<() => { status: string; data?: readonly Record<string, unknown>[] }>('citas')();
  }

  function cupos() {
    return interno<() => { status: string; data?: readonly Record<string, unknown>[] }>('cupos')();
  }

  /**
   * Responde las lecturas del arranque en el orden en que salen.
   *
   * Los recursos van **primero y solos**: las citas no se piden hasta saber qué
   * recurso mirar —`GET /scheduling/bookings` sin acotar responde `422`— así que
   * hay que dejar que el efecto corra antes de esperar el resto.
   */
  async function responder(
    opciones: { citas?: unknown[]; cupos?: unknown[]; recortadas?: boolean } = {},
  ): Promise<void> {
    await responderRecursos();
    responderResto(opciones);
  }

  /**
   * Todo menos los recursos, para los casos que necesitan sembrarlos a medida.
   *
   * Separado de `responder` porque **cuál recurso se elige** es justamente lo que
   * varias pruebas ejercitan, y esas necesitan controlar la lista antes de que
   * salgan las lecturas que dependen de ella.
   */
  function responderResto(
    opciones: { citas?: unknown[]; cupos?: unknown[]; recortadas?: boolean } = {},
  ): void {
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush({
        items: opciones.citas ?? [CITA],
        count: 1,
        limit: 100,
        truncated: opciones.recortadas ?? false,
      });
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({
        items: opciones.cupos ?? [CUPO],
        count: 1,
        limit: 100,
        truncated: false,
      });
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [
          {
            conceptId: 'c-confirmada',
            code: 'BOOKING_CONFIRMED',
            display: 'Confirmada',
            codeSystemVersionId: 'csv-1',
          },
          {
            conceptId: 'c-abierto',
            code: 'OPEN',
            display: 'Abierto',
            codeSystemVersionId: 'csv-1',
          },
        ],
        count: 2,
        limit: 200,
      });
  }

  /** Los recursos, y la espera para que el efecto de la agenda los vea. */
  async function responderRecursos(items: unknown[] = [RECURSO]): Promise<void> {
    http.expectOne((r) => r.url === '/scheduling/resources').flush({ items, count: items.length });
    await harness.fixture.whenStable();
  }

  it('pide recursos, citas y cupos de la ventana por defecto', async () => {
    await montar();

    const recursos = http.expectOne((r) => r.url === '/scheduling/resources');
    expect(recursos.request.params.get('tenantId')).toBe('t-1');
    recursos.flush({ items: [RECURSO], count: 1 });
    await harness.fixture.whenStable();

    const bookings = http.expectOne((r) => r.url === '/scheduling/bookings');
    // Siete días: la ventana por defecto responde «qué viene», no «qué hay hoy».
    const desde = new Date(bookings.request.params.get('from') ?? '');
    const hasta = new Date(bookings.request.params.get('to') ?? '');
    expect(Math.round((hasta.getTime() - desde.getTime()) / 86_400_000)).toBe(7);
    // La ventana arranca al comienzo del día: una cita de las nueve no debe
    // desaparecer de la agenda a las nueve y cinco.
    expect(desde.getHours()).toBe(0);
    bookings.flush({ items: [CITA], count: 1, limit: 100, truncated: false });

    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ items: [CUPO], count: 1, limit: 100, truncated: false });
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({ items: [], count: 0, limit: 200 });

    expect(citas().status).toBe('ready');
    expect(cupos().status).toBe('ready');
  });

  it('traduce el estado y el recurso: en pantalla no queda ningún uuid', async () => {
    await montar();
    await responder();

    const fila = citas().data?.[0] as Record<string, unknown>;
    // El estado lleva sus tres canales: la palabra del catálogo y la variante
    // que le da tono y forma. Nunca el uuid.
    expect(fila['estado']).toEqual({ variant: 'approved', label: 'Confirmada' });
    expect(fila['recurso']).toBe('Consultorio 1 · Dra. Salas');
  });

  /**
   * Un estado que esta versión no sabe pintar no puede romper la agenda del
   * día: sale en neutro, con la palabra que el catálogo sí resolvió.
   */
  it('un estado desconocido cae en neutro sin perder la palabra', async () => {
    await montar();
    await responderRecursos();
    responderResto({ citas: [{ ...CITA, statusConceptId: 'c-nuevo' }] });

    expect(citas().data?.[0]?.['estado']).toEqual({
      variant: 'unknown',
      label: 'Sin registrar',
    });
  });

  /**
   * Sin `SECURITY_ADMIN`, el enlace a la ficha sería una invitación a un 403.
   * Se dice que hay paciente y no cuál.
   */
  it('sin rol de padrón no ofrece el enlace a la ficha del paciente', async () => {
    await montar({ roles: ['SCHEDULING_AGENT'] });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['rutaPaciente']).toBeNull();
  });

  it('con SECURITY_ADMIN el enlace apunta a la ficha', async () => {
    await montar({ roles: ['SECURITY_ADMIN'] });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['rutaPaciente']).toBe(
      '/administracion/pacientes/p-1',
    );
  });

  /** `SUPERADMIN` es comodín en el `RolesGuard` del backend; acá también. */
  it('con SUPERADMIN el enlace apunta a la ficha', async () => {
    await montar({ roles: ['SUPERADMIN'] });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['rutaPaciente']).toBe(
      '/administracion/pacientes/p-1',
    );
  });

  /* ---- la agenda propia (claim `hpid`) ----------------------------------- */

  /**
   * Sin el claim, la agenda cae en el primer recurso de la organización — que
   * con varios consultorios es el de otra persona, y las dos se ven igual.
   */
  it('sin `hpid` se abre en el primer recurso, como antes', async () => {
    await montar({ roles: ['PRACTITIONER'] });
    await responderRecursos([RECURSO_AJENO, RECURSO]);
    await responderResto();

    expect(interno<() => string | null>('recursoElegido')()).toBe('r-0');
    expect(interno<() => boolean>('mirandoAgendaPropia')()).toBe(false);
  });

  it('con `hpid` se abre en la agenda propia aunque no sea la primera', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responderRecursos([RECURSO_AJENO, RECURSO]);
    await responderResto();

    expect(interno<() => string | null>('recursoElegido')()).toBe('r-1');
    expect(interno<() => boolean>('mirandoAgendaPropia')()).toBe(true);
  });

  /**
   * Un enlace compartido tiene que abrir lo que dice. Si la agenda propia
   * ganara, dos personas no podrían mirar la misma pantalla.
   */
  it('el recurso de la URL manda sobre la agenda propia', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' }, '/agenda?recurso=r-0');
    await responderRecursos([RECURSO_AJENO, RECURSO]);
    await responderResto();

    expect(interno<() => string | null>('recursoElegido')()).toBe('r-0');
    expect(interno<() => boolean>('mirandoAgendaPropia')()).toBe(false);
  });

  /**
   * El identificador solo no alcanza: dos filas de tablas distintas pueden
   * compartir uuid sin tener nada que ver.
   */
  it('no toma por propia una agenda que apunta a otra tabla', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responderRecursos([RECURSO_DE_OTRA_TABLA, RECURSO_AJENO]);
    await responderResto();

    expect(interno<() => boolean>('mirandoAgendaPropia')()).toBe(false);
    expect(interno<() => string | null>('recursoElegido')()).toBe('r-9');
  });

  /**
   * El enlace que cierra el recorrido del médico: del turno a la historia de
   * quien llega. Es el que `CLINICIAN` y `PRACTITIONER` sí pueden abrir — la
   * ficha de filiación pide `SECURITY_ADMIN`, que no tienen —, así que sin él la
   * agenda de quien atiende terminaba en un callejón.
   */
  it('con rol clínico el turno enlaza al expediente', async () => {
    await montar({ roles: ['PRACTITIONER'] });
    await responder();

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['rutaExpediente']).toBe('/clinico/p-1');
    // Y no la ficha de filiación, que su rol no puede abrir.
    expect(fila['rutaPaciente']).toBeNull();
  });

  it('sin rol clínico no ofrece el expediente', async () => {
    await montar({ roles: ['SCHEDULING_AGENT'] });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['rutaExpediente']).toBeNull();
  });

  /** El motivo viaja al expediente para precargar el del encuentro. */
  it('lleva el motivo de la cita para precargar el del encuentro', async () => {
    await montar({ roles: ['PRACTITIONER'] });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['motivoCrudo']).toBe('Control anual');
  });

  /**
   * El vínculo turno → encuentro. Viaja el `appointmentId` de la reserva —la
   * cita clínica— y **no** el `id` de la reserva, que apunta a otra tabla y
   * violaría la clave foránea del encuentro.
   */
  it('lleva la cita clínica del turno cuando la reserva la tiene', async () => {
    await montar({ roles: ['PRACTITIONER'] });
    await responder({ citas: [{ ...CITA, appointmentId: 'ap-1' }] });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['appointmentId']).toBe('ap-1');
    expect(fila['paramsDelExpediente']).toEqual({ motivo: 'Control anual', cita: 'ap-1' });
  });

  /**
   * `null` es lo corriente —la reserva nace en la agenda y la cita clínica es un
   * registro posterior— y no puede colarse en la URL como el texto «null».
   */
  it('una reserva sin cita clínica no manda el parámetro', async () => {
    await montar({ roles: ['PRACTITIONER'] });
    await responder({ citas: [{ ...CITA, appointmentId: null }] });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['appointmentId']).toBeNull();
    expect(fila['paramsDelExpediente']).toEqual({ motivo: 'Control anual' });
  });

  it('una cita sin motivo no inventa uno para llevar', async () => {
    await montar({ roles: ['PRACTITIONER'] });
    const { reasonText: _omitido, ...sinMotivo } = CITA;
    await responder({ citas: [sinMotivo] });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['motivoCrudo']).toBeNull();
    // En la tabla sí se rellena: una celda vacía se lee como un dato que no cargó.
    expect(fila['motivo']).toBe('Sin registrar');
  });

  it('una cita sin paciente no enlaza a ningún expediente', async () => {
    await montar({ roles: ['PRACTITIONER'] });
    const { patientProfileId: _omitido, ...sinPaciente } = CITA;
    await responder({ citas: [sinPaciente] });

    expect((citas().data?.[0] as Record<string, unknown>)['rutaExpediente']).toBeNull();
  });

  it('un fallo en citas no vacía los cupos, que sí respondieron', async () => {
    await montar();

    await responderRecursos();
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ items: [CUPO], count: 1, limit: 100, truncated: false });
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({ items: [], count: 0, limit: 200 });

    expect(citas().status).toBe('offline');
    expect(cupos().status).toBe('ready');
  });

  /**
   * `GET /scheduling/bookings` sin `resourceId` ni `patientProfileId` responde
   * `422 PRECONDITION_FAILED`. Sin recurso no se pide: la pantalla lo dice, y
   * pedirlo igual convertiría una organización recién creada en un error.
   */
  it('sin recursos agendables no pide citas ni cupos, y lo dice', async () => {
    await montar();
    await responderRecursos([]);

    http.verify();
    expect(interno<() => boolean>('sinRecursos')()).toBe(true);
    expect(citas().status).toBe('empty');
    expect(cupos().status).toBe('empty');
  });

  /**
   * `403` en los recursos **no** es «esta organización no tiene agenda».
   *
   * Es lo que recibe un profesional recién registrado, sin rol de agenda. Decirle
   * que no hay recursos lo manda a buscar un problema que no existe: el M34
   * separa S5 de S3 justamente por esto.
   */
  it('un 403 en los recursos sale como S5, no como «no hay recursos»', async () => {
    await montar();

    http
      .expectOne((r) => r.url === '/scheduling/resources')
      .flush(
        { code: 'FORBIDDEN', message: 'Rol insuficiente para la operación' },
        { status: 403, statusText: 'Forbidden' },
      );
    await harness.fixture.whenStable();

    http.verify();
    expect(interno<() => boolean>('sinRecursos')()).toBe(false);
    expect(citas().status).toBe('forbidden');
    expect(cupos().status).toBe('forbidden');
  });

  /** Un enlace viejo apunta a un recurso dado de baja: se cae al primero y avisa. */
  it('un recurso de la URL que ya no existe cae al primero y lo dice', async () => {
    session.start({
      accessToken: jwt({ sub: 'u-1', roles: ['SCHEDULING_ADMIN'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/agenda?recurso=r-borrado', Agenda);

    await responder();

    expect(interno<() => boolean>('recursoInexistente')()).toBe(true);
    expect(interno<() => string>('nombreDelRecurso')()).toBe('Consultorio 1 · Dra. Salas');
  });

  it('avisa cuando la ventana vino recortada por el tope', async () => {
    await montar();
    await responder({ recortadas: true });

    expect(interno<() => boolean>('citasRecortadas')()).toBe(true);
  });

  it('sin citas ofrece una salida, no un vacío mudo', async () => {
    await montar();
    await responder({ citas: [] });

    const estado = citas() as { status: string; nextAction?: { label: string } };
    expect(estado.status).toBe('empty');
    expect(estado.nextAction?.label).toBeTruthy();
  });

  /**
   * `tenantId` es obligatorio en el backend. Sin organización elegida, pedirlo
   * daría un 400 que se leería como un fallo de la agenda y no como el paso
   * previo que en realidad falta.
   */
  it('sin organización no dispara ninguna lectura', async () => {
    session.start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: [] }),
      refreshToken: 'r-1',
    });
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/agenda', Agenda);

    http.verify();
    expect(interno<() => boolean>('sinOrganizacion')()).toBe(true);
  });

  it('los rótulos de las pestañas llevan el conteo del otro panel', async () => {
    await montar();
    await responder();

    expect(interno<() => string>('rotuloDeCitas')()).toBe('Citas (1)');
    expect(interno<() => string>('rotuloDeCupos')()).toBe('Cupos (1)');
  });

  /* ---- acciones sobre una cita (UC-41-09 / UC-41-10) ---------------------- */

  /** La recarga que sigue a una acción: citas, cupos y etiquetas de nuevo. */
  function responderRecarga(): void {
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush({ items: [CITA], count: 1, limit: 100, truncated: false });
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ items: [CUPO], count: 1, limit: 100, truncated: false });
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({ items: [], count: 0, limit: 200 });
  }

  function primeraCita(): Record<string, unknown> {
    const estado = citas();
    return (estado.data ?? [])[0] as Record<string, unknown>;
  }

  it('registrar la llegada hace el check-in y recarga la agenda', async () => {
    await montar();
    await responder();

    interno<(c: unknown) => void>('registrarLlegada')(primeraCita());

    http
      .expectOne('/scheduling/bookings/b-1/check-in')
      .flush({ bookingId: 'b-1', checkedInAt: '2026-08-08T13:02:00.000Z' });
    responderRecarga();

    expect(citas().status).toBe('ready');
  });

  it('cancelar pide confirmación explícita y no hace nada sin ella', async () => {
    await montar();
    await responder();

    const dialogs = TestBed.inject(DialogService);
    vi.spyOn(dialogs, 'confirm').mockResolvedValue(false);

    await interno<(c: unknown) => Promise<void>>('cancelarCita')(primeraCita());

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(citas().status).toBe('ready');
  });

  it('cancelar confirmado libera el cupo y recarga', async () => {
    await montar();
    await responder();

    const dialogs = TestBed.inject(DialogService);
    vi.spyOn(dialogs, 'confirm').mockResolvedValue(true);

    const pendiente = interno<(c: unknown) => Promise<void>>('cancelarCita')(primeraCita());
    await harness.fixture.whenStable();

    const req = http.expectOne('/scheduling/bookings/b-1/cancel');
    // Desde esta pantalla cancela la organización; `isNoShow` no viaja si
    // nadie lo marcó, porque es lo que dispara el cargo de la política.
    expect(req.request.body).toEqual({ cancelledBy: 'PROVIDER' });
    req.flush({ bookingId: 'b-1', capacityReleased: true });
    responderRecarga();
    await pendiente;

    expect(citas().status).toBe('ready');
  });

  /**
   * Las columnas de acción sólo existen para quien puede ejecutarlas: un
   * botón que la API va a rechazar con 403 es un error con forma de oferta.
   */
  it('un PATIENT ve el enlace de reservar pero no las acciones de mostrador', async () => {
    session.start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/agenda', Agenda);
    await responder();

    const columnasDeCitas = interno<() => readonly { key: string }[]>('columnasDeCitas')();
    const columnasDeCupos = interno<() => readonly { key: string }[]>('columnasDeCupos')();

    expect(columnasDeCitas.some((columna) => columna.key === 'acciones')).toBe(false);
    expect(columnasDeCupos.some((columna) => columna.key === 'reservar')).toBe(true);
  });
});
