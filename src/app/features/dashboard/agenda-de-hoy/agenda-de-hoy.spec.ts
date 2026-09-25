import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { AgendaDeHoy, type CifrasDeHoy, type CitaDeHoy, type TramoDeLaJornada } from './agenda-de-hoy';

/**
 * «Lo que toca hoy» — las reglas que sólo esta pantalla fija.
 *
 * 1. **Todas las agendas, no la primera.** Quien atiende en dos sedes tiene dos
 *    recursos, y con uno solo la mitad del día era invisible. Un resumen
 *    incompleto es peor que no tenerlo: invita a confiar en él.
 * 2. **Lo que manda ahora no es lo que sigue en el reloj.** Una consulta en
 *    curso gana sobre quien acaba de llegar, y quien llegó gana sobre la
 *    próxima del horario. Ordenar sólo por hora pondría en el titular a alguien
 *    que todavía no está.
 * 3. **La sede se nombra sólo si el día se reparte entre varias.** Una columna
 *    que repite siempre lo mismo ocupa lugar y no informa.
 * 4. **Los tres vacíos son distintos**: sin agenda publicada, sin citas hoy y
 *    jornada terminada dicen cosas distintas y ofrecen salidas distintas.
 * 5. **La cinta es a escala** y su marca de «ahora» cae donde tiene que caer.
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

/* Los identificadores de los conceptos de estado. Da igual cuáles sean —la
   pantalla los resuelve contra el catálogo— así que se nombran por lo que
   significan y se responden con su código. */
const ESTADO = {
  confirmada: 'c-confirmada',
  enCurso: 'c-en-curso',
  llego: 'c-llego',
  atendida: 'c-atendida',
  solicitada: 'c-solicitada',
} as const;

const CODIGO_POR_CONCEPTO: Readonly<Record<string, string>> = {
  [ESTADO.confirmada]: 'BOOKING_CONFIRMED',
  [ESTADO.enCurso]: 'BOOKING_IN_PROGRESS',
  [ESTADO.llego]: 'BOOKING_CHECKED_IN',
  [ESTADO.atendida]: 'BOOKING_COMPLETED',
  [ESTADO.solicitada]: 'BOOKING_REQUESTED',
};

const PERFIL = 'hp-1';
const TENANT = 't-1';

/** Hoy a la hora que se pida. Todo el componente razona en horas locales. */
function hoyALas(hora: number, minutos = 0): Date {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hora, minutos, 0, 0);
}

interface CitaCruda {
  readonly id: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly estado: string;
  readonly paciente?: string;
  readonly motivo?: string;
}

function wire(cita: CitaCruda): Record<string, unknown> {
  return {
    id: cita.id,
    resourceId: 'r-1',
    startAt: cita.desde.toISOString(),
    endAt: cita.hasta.toISOString(),
    statusConceptId: cita.estado,
    patientName: cita.paciente ?? 'Paciente de prueba',
    reasonText: cita.motivo ?? 'Control',
  };
}

describe('AgendaDeHoy', () => {
  let fixture: ComponentFixture<AgendaDeHoy>;
  let component: AgendaDeHoy;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgendaDeHoy],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => http.verify());

  /** Abre la sesión de quien atiende y monta la franja. */
  function crear(claims: Record<string, unknown> = {}): void {
    session.start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: [TENANT], hpid: PERFIL, ...claims }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(AgendaDeHoy);
    component = fixture.componentInstance;
  }

  /**
   * Responde el listado de agendas.
   *
   * La API devuelve los recursos de TODA la organización; el filtro por el
   * perfil propio lo hace el cliente. Se responde igual —con una agenda ajena
   * en la lista— para que eso quede fijado y no se mude al servidor por
   * accidente.
   */
  function responderRecursos(
    ...propias: readonly { readonly id: string; readonly sede: string | null }[]
  ): void {
    const items = [
      ...propias.map(({ id, sede }) => ({
        id,
        name: `Agenda ${id}`,
        resourceTypeConceptId: 'rt-1',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: PERFIL,
        practitionerName: 'Dra. Prueba',
        practiceId: null,
        timeZone: 'America/La_Paz',
        capacity: 1,
        stateConceptId: 'st-activo',
        site: sede === null ? null : { id: `site-${id}`, name: sede },
      })),
      {
        id: 'r-ajena',
        name: 'Agenda de otra persona',
        resourceTypeConceptId: 'rt-1',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: 'hp-otro',
        practitionerName: 'Otro',
        practiceId: null,
        timeZone: 'America/La_Paz',
        capacity: 1,
        stateConceptId: 'st-activo',
        site: null,
      },
    ];

    http
      .expectOne((request) => request.url.endsWith('/scheduling/resources'))
      .flush({ items, count: items.length });
  }

  /** Responde las citas de una agenda concreta. */
  function responderCitas(resourceId: string, citas: readonly CitaCruda[]): void {
    const pedido = http.expectOne(
      (request) =>
        request.url.endsWith('/scheduling/bookings') &&
        request.params.get('resourceId') === resourceId,
    );
    pedido.flush({
      items: citas.map((cita) => wire({ ...cita })),
      count: citas.length,
      limit: 100,
      truncated: false,
    });
  }

  /** Resuelve el catálogo de estados con el código que cada concepto significa. */
  function responderCatalogo(): void {
    for (const pedido of http.match((request) => request.url.endsWith('/terminology/concepts'))) {
      const ids = (pedido.request.params.get('ids') ?? '').split(',').filter((id) => id !== '');
      pedido.flush({
        items: ids.map((id) => ({
          conceptId: id,
          code: CODIGO_POR_CONCEPTO[id] ?? 'DESCONOCIDO',
          display: CODIGO_POR_CONCEPTO[id] ?? 'Desconocido',
          codeSystemVersionId: 'v-1',
        })),
        count: ids.length,
      });
    }
    fixture.detectChanges();
  }

  function estado(): { status: string; nextAction?: { label: string; route?: string } } {
    return (
      component as unknown as {
        estado: () => { status: string; nextAction?: { label: string; route?: string } };
      }
    ).estado();
  }

  function citas(): readonly CitaDeHoy[] {
    return (component as unknown as { citas: () => readonly CitaDeHoy[] }).citas();
  }

  function destacada(): CitaDeHoy | null {
    return (component as unknown as { destacada: () => CitaDeHoy | null }).destacada();
  }

  function siguientes(): readonly CitaDeHoy[] {
    return (component as unknown as { siguientes: () => readonly CitaDeHoy[] }).siguientes();
  }

  function cifras(): CifrasDeHoy {
    return (component as unknown as { cifras: () => CifrasDeHoy }).cifras();
  }

  function tramos(): readonly TramoDeLaJornada[] {
    return (component as unknown as { tramos: () => readonly TramoDeLaJornada[] }).tramos();
  }

  function fijarReloj(hora: number, minutos = 0): void {
    (component as unknown as { ahora: { set: (d: Date) => void } }).ahora.set(
      hoyALas(hora, minutos),
    );
    fixture.detectChanges();
  }

  /* -- 1 · todas las agendas ------------------------------------------------ */

  it('junta las citas de TODAS las agendas propias, ordenadas por hora', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: 'Clínica' }, { id: 'r-2', sede: 'Consultorio' });

    // La tarde del consultorio va primero en la respuesta y segunda en la
    // pantalla: el orden lo pone la hora, no el orden de las lecturas.
    responderCitas('r-1', [
      { id: 'b-manana', desde: hoyALas(9), hasta: hoyALas(9, 30), estado: ESTADO.confirmada },
    ]);
    responderCitas('r-2', [
      { id: 'b-tarde', desde: hoyALas(16), hasta: hoyALas(16, 20), estado: ESTADO.confirmada },
    ]);
    responderCatalogo();

    expect(citas().map((c) => c.id)).toEqual(['b-manana', 'b-tarde']);
  });

  it('si una sede falla, el día no se pierde entero', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: 'Clínica' }, { id: 'r-2', sede: 'Consultorio' });
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(9), hasta: hoyALas(9, 30), estado: ESTADO.confirmada },
    ]);
    http
      .expectOne(
        (request) =>
          request.url.endsWith('/scheduling/bookings') && request.params.get('resourceId') === 'r-2',
      )
      .flush(null, { status: 500, statusText: 'Server Error' });
    responderCatalogo();

    expect(estado().status).toBe('ready');
    expect(citas()).toHaveLength(1);
  });

  /* -- 2 · qué manda ahora -------------------------------------------------- */

  it('lo que está en curso gana sobre quien acaba de llegar y sobre la próxima', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', [
      { id: 'b-curso', desde: hoyALas(9), hasta: hoyALas(9, 30), estado: ESTADO.enCurso },
      { id: 'b-llego', desde: hoyALas(9, 30), hasta: hoyALas(10), estado: ESTADO.llego },
      { id: 'b-proxima', desde: hoyALas(10), hasta: hoyALas(10, 30), estado: ESTADO.confirmada },
    ]);
    responderCatalogo();
    fijarReloj(9, 15);

    expect(destacada()?.id).toBe('b-curso');
    // Y lo que sigue es lo que viene DESPUÉS de la destacada, en orden.
    expect(siguientes().map((c) => c.id)).toEqual(['b-llego', 'b-proxima']);
  });

  it('sin nada en curso ni en sala, manda la próxima del reloj', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', [
      { id: 'b-pasada', desde: hoyALas(8), hasta: hoyALas(8, 30), estado: ESTADO.atendida },
      { id: 'b-proxima', desde: hoyALas(10), hasta: hoyALas(10, 30), estado: ESTADO.confirmada },
    ]);
    responderCatalogo();
    fijarReloj(9);

    expect(destacada()?.id).toBe('b-proxima');
  });

  it('con la jornada terminada no hay destacada, y eso NO es un día vacío', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(8), hasta: hoyALas(8, 30), estado: ESTADO.atendida },
    ]);
    responderCatalogo();
    fijarReloj(20);

    expect(destacada()).toBeNull();
    expect(
      (component as unknown as { jornadaTerminada: () => boolean }).jornadaTerminada(),
    ).toBe(true);
    // El estado sigue siendo `ready`: hubo jornada. S3 diría que no hay nada.
    expect(estado().status).toBe('ready');
  });

  /* -- 3 · la sede ---------------------------------------------------------- */

  it('con el día en una sola sede, no se nombra la sede en cada renglón', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: 'Clínica' }, { id: 'r-2', sede: 'Consultorio' });
    // Dos agendas, pero hoy sólo se pisa una: repetir «Clínica» en cada fila no
    // informa de nada.
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(9), hasta: hoyALas(9, 30), estado: ESTADO.confirmada },
      { id: 'b-2', desde: hoyALas(10), hasta: hoyALas(10, 30), estado: ESTADO.confirmada },
    ]);
    responderCitas('r-2', []);
    responderCatalogo();

    expect(citas().map((c) => c.sede)).toEqual([null, null]);
  });

  it('con el día repartido entre dos sedes, cada renglón dice dónde', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: 'Clínica' }, { id: 'r-2', sede: 'Consultorio' });
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(9), hasta: hoyALas(9, 30), estado: ESTADO.confirmada },
    ]);
    responderCitas('r-2', [
      { id: 'b-2', desde: hoyALas(16), hasta: hoyALas(16, 20), estado: ESTADO.confirmada },
    ]);
    responderCatalogo();

    expect(citas().map((c) => c.sede)).toEqual(['Clínica', 'Consultorio']);
  });

  /* -- 4 · los vacíos ------------------------------------------------------- */

  it('sin agenda publicada, la próxima acción es publicar el horario', () => {
    crear();
    responderRecursos();
    fixture.detectChanges();

    expect(estado().status).toBe('empty');
    expect(estado().nextAction?.route).toBe('/schedule/new');
  });

  it('con agenda y sin citas hoy, la próxima acción es agendar —no «ver la agenda»—', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', []);
    fixture.detectChanges();

    expect(estado().status).toBe('empty');
    // «Ver la agenda» ya está en el botón del encabezado: repetirlo acá sería
    // ofrecer dos veces la misma puerta y ninguna salida nueva.
    expect(estado().nextAction?.route).toBe('/schedule/appointment/new');
  });

  it('una cuenta sin perfil profesional no pide nada al servidor', () => {
    crear({ hpid: undefined });
    fixture.detectChanges();

    // El `verify()` del teardown ata el resto: cualquier petición dejaría la
    // prueba en rojo.
    expect(estado().status).toBe('empty');
  });

  /* -- 5 · la cinta --------------------------------------------------------- */

  it('la cinta reparte los tramos a escala entre la primera hora en punto y la última', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    // La ventana va de la hora en punto de la PRIMERA consulta a la hora en
    // punto que cierra la última: de 09:00 a 12:00, tres horas. Una consulta de
    // 09:00 a 10:00 es un tercio del ancho y arranca pegada al borde.
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(9), hasta: hoyALas(10), estado: ESTADO.confirmada },
      { id: 'b-2', desde: hoyALas(11), hasta: hoyALas(11, 30), estado: ESTADO.confirmada },
    ]);
    responderCatalogo();

    const [primero, segundo] = tramos();
    expect(primero.izquierda).toBeCloseTo(0, 5);
    expect(primero.ancho).toBeCloseTo(100 / 3, 5);
    expect(segundo.izquierda).toBeCloseTo(200 / 3, 5);
    // Y el tono es el del estado, que es lo que la leyenda repite en palabras.
    expect(primero.tono).toBe('firme');
  });

  it('una jornada que termina EN PUNTO no se estira una hora de más', () => {
    // El defecto que esto fija: `setMinutes(60)` sobre un instante que ya cae
    // en punto suma una hora entera. Con la última consulta terminando a las
    // 12:00, la cinta llegaba hasta las 13:00 y regalaba un quinto del ancho a
    // una hora en la que no pasa nada — con la marca de «ahora» corrida.
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(8), hasta: hoyALas(9), estado: ESTADO.confirmada },
      { id: 'b-2', desde: hoyALas(11), hasta: hoyALas(12), estado: ESTADO.confirmada },
    ]);
    responderCatalogo();

    const hasta = (
      component as unknown as { hastaLasHoras: () => Date }
    ).hastaLasHoras();
    expect(hasta.getHours()).toBe(12);
    expect(hasta.getMinutes()).toBe(0);
  });

  it('la marca de «ahora» cae donde está el reloj, y no se dibuja fuera de la jornada', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(8), hasta: hoyALas(9), estado: ESTADO.confirmada },
      { id: 'b-2', desde: hoyALas(11), hasta: hoyALas(12), estado: ESTADO.confirmada },
    ]);
    responderCatalogo();

    const marca = () =>
      (component as unknown as { marcaDeAhora: () => number | null }).marcaDeAhora();

    fijarReloj(10);
    expect(marca()).toBeCloseTo(50, 5);

    // Antes de abrir y después de cerrar no hay marca: dibujarla pegada a un
    // extremo diría que la jornada está por empezar cuando terminó ayer.
    fijarReloj(6);
    expect(marca()).toBeNull();
    fijarReloj(23);
    expect(marca()).toBeNull();
  });

  /* -- Las cifras, que son la leyenda de la cinta --------------------------- */

  it('cuenta por estado, y «por venir» excluye lo que ya pasó', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(8), hasta: hoyALas(8, 30), estado: ESTADO.atendida },
      { id: 'b-2', desde: hoyALas(9), hasta: hoyALas(9, 30), estado: ESTADO.enCurso },
      { id: 'b-3', desde: hoyALas(10), hasta: hoyALas(10, 30), estado: ESTADO.llego },
      { id: 'b-4', desde: hoyALas(11), hasta: hoyALas(11, 30), estado: ESTADO.confirmada },
      { id: 'b-5', desde: hoyALas(12), hasta: hoyALas(12, 30), estado: ESTADO.solicitada },
    ]);
    responderCatalogo();
    fijarReloj(9, 15);

    expect(cifras()).toEqual({
      total: 5,
      atendidas: 1,
      enCurso: 1,
      enSala: 1,
      porVenir: 1,
      solicitudes: 1,
    });
  });

  it('sin catálogo resuelto la jornada se muestra igual, con el texto de reserva', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(9), hasta: hoyALas(9, 30), estado: ESTADO.confirmada },
    ]);
    for (const pedido of http.match((request) => request.url.endsWith('/terminology/concepts'))) {
      pedido.flush(null, { status: 503, statusText: 'Service Unavailable' });
    }
    fixture.detectChanges();

    // Perder la etiqueta no justifica perder la agenda del día.
    expect(estado().status).toBe('ready');
    expect(citas()[0].estado.label).toBe('Reservada');
  });

  /* -- La pantalla, dibujada ------------------------------------------------ */

  it('pinta la salida a la agenda y una fila por cita', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(9), hasta: hoyALas(9, 30), estado: ESTADO.enCurso, paciente: 'Ana Pérez' },
      { id: 'b-2', desde: hoyALas(10), hasta: hoyALas(10, 30), estado: ESTADO.confirmada, paciente: 'Luis Rojas' },
    ]);
    responderCatalogo();
    fijarReloj(9, 15);

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="panel-hoy-ver-agenda"]')?.getAttribute('href')).toBe(
      '/schedule',
    );
    expect(raiz.querySelector('[data-testid="panel-hoy-destacada"]')?.textContent).toContain(
      'Ana Pérez',
    );
    expect(raiz.querySelectorAll('[data-testid="panel-hoy-lista"] .lista__fila')).toHaveLength(1);
  });

  it('la tarjeta «Ahora» y cada renglón llevan a SU cita en la agenda, para iniciarla', () => {
    crear();
    responderRecursos({ id: 'r-1', sede: null });
    responderCitas('r-1', [
      { id: 'b-1', desde: hoyALas(9), hasta: hoyALas(9, 30), estado: ESTADO.enCurso, paciente: 'Ana Pérez' },
      { id: 'b-2', desde: hoyALas(10), hasta: hoyALas(10, 30), estado: ESTADO.confirmada, paciente: 'Luis Rojas' },
    ]);
    responderCatalogo();
    fijarReloj(9, 15);

    const raiz = fixture.nativeElement as HTMLElement;
    const tarjeta = raiz.querySelector<HTMLAnchorElement>('[data-testid="panel-hoy-destacada-abrir"]');
    expect(tarjeta?.getAttribute('href')).toBe('/schedule?booking=b-1');
    expect(tarjeta?.getAttribute('aria-label')).toMatch(/^Abrir la consulta de Ana Pérez, a las 09:00/);
    // El enlace vive DENTRO de la tarjeta: su `::after` la cubre entera.
    expect(tarjeta?.closest('[data-testid="panel-hoy-destacada"]')).not.toBeNull();

    const filas = raiz.querySelectorAll<HTMLAnchorElement>('[data-testid="panel-hoy-fila-abrir"]');
    expect([...filas].map((a) => a.getAttribute('href'))).toEqual(['/schedule?booking=b-2']);
  });
});
