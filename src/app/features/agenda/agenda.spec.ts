import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../core/auth/session.store';
import { DialogService } from '../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
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
  // Dónde se atiende. Llega resuelto en la misma lectura de recursos: el
  // backend lo deriva de la asignación de rol vigente del profesional, así que
  // la agenda no encadena una petición por recurso.
  site: {
    id: 'site-1',
    name: 'Consultorio Central',
    code: 'CC',
    addressText: 'Av. Brasil 1234, La Paz',
    timeZone: 'America/La_Paz',
  },
};

/** El mismo recurso sin sede: un estado corriente, no un fallo. */
const RECURSO_SIN_SEDE = { ...RECURSO, id: 'r-2', name: 'Box 3', site: null };

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
        provideRouter([{ path: 'schedule', component: Agenda }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  /**
   * Cierra el caso: primero se vacían las lecturas del CALENDARIO —y sólo si
   * estaba abierto—, y después se verifica que no quedó nada suelto.
   *
   * Desde C-07 (2026-09-20) quien atiende no tiene lista: `/schedule` le abre
   * el calendario, que es otro `app-my-agenda` con sus propias lecturas (día,
   * mes, plantillas, tipos de actividad). Ninguna prueba de esta pantalla trata
   * de ellas, y dejarlas abiertas haría fallar `verify()` en todas.
   *
   * **El drenaje está acotado al caso en que hay un `app-my-agenda` montado**
   * —el calendario o «Mis horarios»—: con la lista abierta no se vacía nada y
   * `verify()` sigue siendo tan estricto como antes. No es una vía de escape
   * general.
   */
  afterEach(async () => {
    // Dos señales, porque el calendario puede haberse montado y destruido
    // dentro del caso —pasa cuando los recursos revelan que la agenda no es
    // propia— y entonces ya no está en el DOM pero dejó sus lecturas vivas.
    const montado =
      componente !== undefined &&
      (interno<() => boolean>('enCalendario')() || interno<() => boolean>('enHorario')());
    const dejoLecturasSuyas =
      http.match((r) => r.url === '/scheduling/activity-types' || r.url.endsWith('/templates'))
        .length > 0;
    if (montado || dejoLecturasSuyas || delCalendario.length > 0) {
      await drenarCalendario();
    }
    http.verify();
  });

  /**
   * Abre sesión **antes** de montar: la agenda decide en su constructor si
   * puede pedir algo, y esa decisión sale de la organización del token.
   */
  /**
   * Monta la pantalla en la tabla de Consultas (`vista=table`): casi todo este
   * archivo prueba las listas. `/schedule` a secas, para quien atiende, es la
   * agenda del día — la prueban los casos de «la agenda del día por defecto».
   */
  async function montar(
    claims: Record<string, unknown> = {},
    url = '/schedule?vista=table',
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
  /**
   * Las peticiones que `primeraPeticion()` sacó de la cola y no le tocan a la
   * prueba: son del calendario. Las vacía `drenarCalendario()`.
   *
   * Hace falta guardarlas porque `HttpTestingController.match()` **las retira**
   * de la cola: no hay forma de mirar sin sacar.
   */
  let delCalendario: TestRequest[] = [];

  /**
   * La **primera** petición pendiente a esa URL, que es siempre la de la
   * pantalla: el calendario se monta después de que la pantalla renderiza, así
   * que sus lecturas —del mismo endpoint— entran a la cola detrás.
   *
   * Reemplaza a `expectOne` desde C-07 (2026-09-20): con el calendario abierto
   * hay dos peticiones vivas a `/scheduling/bookings` y a `/scheduling/slots`,
   * y **las dos son legítimas**. La de la pantalla la responde la prueba; la
   * del calendario queda anotada y la vacía `drenarCalendario()`.
   */
  function primeraPeticion(url: string): TestRequest {
    const pendientes = http.match((r) => r.url === url);
    expect(pendientes.length).toBeGreaterThan(0);
    const [primera, ...resto] = pendientes;
    delCalendario.push(...resto);
    return primera;
  }

  function responderResto(
    opciones: { citas?: unknown[]; cupos?: unknown[]; recortadas?: boolean } = {},
  ): void {
    primeraPeticion('/scheduling/bookings').flush({
        items: opciones.citas ?? [CITA],
        count: 1,
        limit: 100,
        truncated: opciones.recortadas ?? false,
      });
    primeraPeticion('/scheduling/slots').flush({
        items: opciones.cupos ?? [CUPO],
        count: 1,
        limit: 100,
        truncated: false,
      });
    primeraPeticion('/terminology/concepts').flush({
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
          // TAREA-13: hace falta para distinguir lo que espera respuesta de lo
          // que ya está agendado. Sin el concepto, `porResponder` no resuelve
          // el código y la fila no cae en ninguna de las dos tablas.
          {
            conceptId: 'c-pendiente',
            code: 'BOOKING_PENDING_CONFIRMATION',
            display: 'Por confirmar',
            codeSystemVersionId: 'csv-1',
          },
          // TAREA-13 punto 5: hace falta para probar que una cita cancelada NO
          // admite estado de pago.
          {
            conceptId: 'c-cancelada',
            code: 'BOOKING_CANCELLED',
            display: 'Cancelada',
            codeSystemVersionId: 'csv-1',
          },
        ],
        count: 4,
        limit: 200,
      });
  }

  /**
   * Responde el arranque con una cita en el estado que se quiera probar.
   *
   * Las acciones de la agenda se ofrecen por **código de estado** (correcciones
   * #11 y #15), así que cada caso necesita que terminología resuelva el suyo:
   * sin eso, el código llega vacío y —correctamente— no se ofrece nada.
   */
  async function responderConEstado(code: string, display: string): Promise<void> {
    await responderRecursos();
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush({
        items: [{ ...CITA, statusConceptId: 'c-estado' }],
        count: 1,
        limit: 100,
        truncated: false,
      });
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ items: [], count: 0, limit: 100, truncated: false });
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [{ conceptId: 'c-estado', code, display, codeSystemVersionId: 'csv-1' }],
        count: 1,
        limit: 200,
      });
    harness.detectChanges();
  }

  /**
   * Los recursos, y la espera para que el efecto de la agenda los vea.
   *
   * Responde **todas** las lecturas de recursos pendientes y no exactamente
   * una. Desde C-07 (2026-09-20) quien atiende no tiene lista: `/schedule` le
   * abre el calendario, y el calendario es otro `app-my-agenda` que pide sus
   * propios recursos. Son dos lecturas legítimas, no una de más.
   *
   * La garantía de «ni una lectura de más» no se perdió: dejó de estar
   * escondida en este ayudante y pasó a la prueba que trata de eso
   * —«el panel cerrado de Mis horarios no se construye»—, que cuenta las
   * lecturas de forma explícita.
   */
  async function responderRecursos(items: unknown[] = [RECURSO]): Promise<void> {
    const pedidos = http.match((r) => r.url === '/scheduling/resources');
    expect(pedidos.length).toBeGreaterThan(0);
    for (const pedido of pedidos) {
      pedido.flush({ items, count: items.length });
    }
    await harness.fixture.whenStable();
  }

  /**
   * Vacía lo que haya quedado abierto después de que la prueba respondió lo
   * suyo: las lecturas del calendario, que desde C-07 monta junto a la
   * pantalla para quien atiende (día, mes, plantillas, tipos de actividad).
   *
   * No responde nada de lo que la prueba quiera controlar —eso ya se flusheó
   * antes—; sólo impide que `verify()` acuse peticiones que no son del caso.
   */
  async function drenarCalendario(): Promise<void> {
    for (let vuelta = 0; vuelta < 4; vuelta += 1) {
      const apartadas = delCalendario.filter((r) => !r.cancelled);
      delCalendario = [];
      const abiertas = [...apartadas, ...http.match(() => true)].filter((r) => !r.cancelled);
      if (abiertas.length === 0) break;
      for (const req of abiertas) {
        const url = req.request.url;
        req.flush(
          url === '/scheduling/resources'
            ? { items: [RECURSO], count: 1 }
            : url.endsWith('/templates')
              ? { items: [], count: 0 }
              : { items: [], count: 0, limit: 100, truncated: false },
        );
      }
      await harness.fixture.whenStable();
    }
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
    // El `code` viaja junto al sello porque es lo que decide qué acciones
    // ofrece la fila (correcciones #11 y #15); el uuid nunca llega a pantalla.
    expect(fila['estado']).toEqual({
      variant: 'approved',
      label: 'Confirmada',
      code: 'BOOKING_CONFIRMED',
    });
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
      // Sin código resuelto no se ofrece ninguna acción: no se opera sobre un
      // estado que no se conoce.
      code: '',
    });
  });

  /**
   * Sin `SECURITY_ADMIN`, el enlace a la ficha sería una invitación a un 403.
   * Se dice que hay paciente y no cuál.
   */
  /**
   * La prueba que faltaba, y que costó una sesión entera de un médico diciendo
   * «literalmente no puedo ver la agenda».
   *
   * «Turnos» es donde el menú deja a quien entra: es la única sección de agenda
   * con renglón propio. Las cuatro pantallas del horario —«Mi agenda», los
   * bloqueos, cambiar el horario, publicar— cuelgan de ella por ruta, y se
   * enlazaban **entre ellas**: «Mi agenda» ofrecía bloqueos y editar, bloqueos
   * volvía a «Mi agenda»… y nadie enlazaba a «Mi agenda». Un circuito cerrado
   * sobre sí mismo, con la puerta de calle tapiada.
   *
   * Todo compilaba y todas las pruebas pasaban, porque ninguna miraba si se
   * podía llegar. Ésta lo mira.
   */
  it('ofrece la puerta a «Mis horarios»: sin esto la sección no se puede recorrer', async () => {
    // Con `hpid`, que es como llega una sesión de médico de verdad: sin el
    // claim la pantalla no resuelve recurso y no llega a pedir las citas.
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responderRecursos();
    responderResto();
    harness.fixture.detectChanges();

    // La puerta dejó de ser un enlace a otra pantalla: «Mi agenda» es una
    // solapa de ésta. El requisito no cambió —tiene que poder llegarse—, sí el
    // camino, así que lo que se mira es la solapa y no el `href`.
    const solapas = [
      ...harness.fixture.nativeElement.querySelectorAll('[role="tab"]'),
    ] as HTMLElement[];

    expect(solapas.map((s) => s.textContent?.trim())).toContain('Mis horarios');
  });

  /**
   * Y no se construye hasta que se la pide.
   *
   * `app-tab` no dibuja el panel inactivo, pero el contenido **proyectado** lo
   * instancia el padre igual: sin un `@if` en la plantilla de Consultas, «Mi
   * agenda» se construía en cada visita a la lista y disparaba su propia
   * lectura de recursos sin que nadie abriera la solapa. Esta prueba es esa
   * lectura de más.
   */
  it('«Mis horarios» no se construye mientras la solapa esté cerrada', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responderRecursos();
    responderResto();
    harness.fixture.detectChanges();

    // Una sola lectura de recursos: la de esta pantalla. Si «Mi agenda» se
    // hubiera construido, habría pedido la suya.
    http.expectNone((r) => r.url === '/scheduling/resources');
  });

  /* -- La agenda del día por defecto (propietario, 18/09) ------------------ */

  /** Responde vacío todo lo que haya salido: la pantalla y el calendario. */
  async function responderTodo(): Promise<void> {
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      for (const req of http.match(() => true)) {
        if (req.cancelled) continue;
        const url = req.request.url;
        req.flush(
          url === '/scheduling/resources'
            ? { items: [{ ...RECURSO, resourceRefId: 'hp-1' }], count: 1 }
            : url.endsWith('/templates')
              ? {
                  items: [
                    {
                      id: 'tpl-1',
                      name: 'Horario',
                      statusConceptId: 'c',
                      rules: [{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }],
                    },
                  ],
                  count: 1,
                }
              : { items: [], count: 0, limit: 100, truncated: false },
        );
      }
      await harness.fixture.whenStable();
      harness.detectChanges();
    }
  }

  it('a quien atiende, `/schedule` abre la agenda del día, en una barra de DOS', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' }, '/schedule');
    await responderTodo();

    const raiz = harness.fixture.nativeElement as HTMLElement;
    expect(interno<() => boolean>('enCalendario')()).toBe(true);
    expect(raiz.querySelector('[data-testid="agenda-calendario"]')).not.toBeNull();
    expect(raiz.querySelector('app-day-view')).not.toBeNull();
    // C-07 y C-08 (2026-09-20): la barra pasó de cuatro a dos. La que se llama
    // «Consultas» ES el calendario; la tabla de consultas y la grilla de cupos
    // no están. El horario se llama «Mis horarios», no «Mi agenda».
    const solapas = [...raiz.querySelectorAll('[role="tab"]')] as HTMLElement[];
    expect(solapas.map((s) => s.textContent?.trim().replace(/\s*\(\d+\)$/, ''))).toEqual([
      'Consultas',
      'Mis horarios',
    ]);
    // Y hay UNA sola «Consultas»: dos con el mismo nombre es el defecto que el
    // renombre y el retiro de la tabla, hechos juntos, existen para evitar.
    expect(
      solapas.filter((s) => s.textContent?.trim().replace(/\s*\(\d+\)$/, '') === 'Consultas'),
    ).toHaveLength(1);
    // Ni los filtros de las listas ni los íconos que cambiaban de vista.
    expect(raiz.querySelector('.agenda__filtros')).toBeNull();
    expect(raiz.querySelector('[data-testid="ver-como-tabla"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="ver-como-agenda"]')).toBeNull();
    // Y el encabezado quedó sin sus tres botones de acción (C-11).
    expect(raiz.querySelector('[data-testid="agenda-ingreso-mostrador"]')).toBeNull();
    expect(raiz.querySelector('[data-testid="agenda-avisar-demora"]')).toBeNull();
    expect(raiz.querySelector('a[href="/lab-visits"]')).toBeNull();
  });

  it('la solapa «Mis horarios» abre el horario sin cambiar la barra', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' }, '/schedule');
    await responderTodo();
    const router = TestBed.inject(Router);
    const raiz = harness.fixture.nativeElement as HTMLElement;

    const solapa = [...raiz.querySelectorAll('[role="tab"]')].find(
      (s) => s.textContent?.trim() === 'Mis horarios',
    ) as HTMLElement;
    solapa.click();
    await responderTodo();

    expect(router.url).toContain('vista=agenda');
    expect(interno<() => boolean>('enHorario')()).toBe(true);
    // Índice 1 y no 2: la barra es de dos desde C-07.
    expect(interno<() => number>('pestana')()).toBe(1);
    // El calendario no se construye mientras se mira el horario.
    expect(raiz.querySelector('[data-testid="agenda-calendario"]')).toBeNull();
    expect(raiz.querySelector('app-my-agenda')).not.toBeNull();
    // Ni los filtros de las listas: el horario no se filtra por ventana.
    expect(raiz.querySelector('.agenda__filtros')).toBeNull();
    expect(interno<() => readonly string[]>('pestanas')()).toHaveLength(2);
  });

  /**
   * C-07 (2026-09-20) — el kill-test del pedido, en prueba.
   *
   * La solapa «Consultas» ERA una tabla y ahora es el calendario. Los tres
   * valores viejos de `vista=` que llevaban a esa tabla —`table`, `citas` y
   * `solicitudes`— siguen llegando por enlaces guardados: tienen que caer en
   * una solapa que exista y **no mostrar ninguna tabla**, sin romper el
   * «atrás» del navegador con una redirección.
   */
  for (const vieja of ['table', 'citas', 'solicitudes', 'cupos'] as const) {
    it(`con calendario, \`vista=${vieja}\` cae al calendario y no a una tabla`, async () => {
      await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' }, `/schedule?vista=${vieja}`);
      await responderTodo();
      const raiz = harness.fixture.nativeElement as HTMLElement;

      expect(interno<() => boolean>('enCalendario')()).toBe(true);
      expect(raiz.querySelector('app-day-view')).not.toBeNull();
      // Ninguna tabla, y ningún filtro de lista: eran de la tabla.
      expect(raiz.querySelector('app-data-table')).toBeNull();
      expect(raiz.querySelector('.agenda__filtros')).toBeNull();
      // Y sin redirección: el parámetro viejo sigue en la URL, así que el
      // «atrás» del navegador devuelve a donde estaba quien llegó por el enlace.
      expect(TestBed.inject(Router).url).toContain(`vista=${vieja}`);
    });
  }

  it('las citas del día llevan las mismas acciones que la fila de Consultas', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' }, '/schedule');
    await responderTodo();
    // La plantilla que recibe el día es la celda de la tabla, no una copia.
    const dia = harness.fixture.debugElement.query(
      (d) => d.name === 'app-day-view',
    )?.componentInstance as { appointmentActions: () => unknown } | undefined;
    expect(dia?.appointmentActions()).not.toBeNull();
  });

  it('quien reparte turnos no tiene agenda propia: `/schedule` sigue siendo la tabla', async () => {
    await montar({ roles: ['SCHEDULING_AGENT'] }, '/schedule');
    await responder();
    harness.fixture.detectChanges();

    const raiz = harness.fixture.nativeElement as HTMLElement;
    expect(interno<() => boolean>('enCalendario')()).toBe(false);
    // Sin Calendario ni «Mis horarios»: Consultas y Cupos.
    expect(raiz.querySelectorAll('[role="tab"]').length).toBe(2);
  });

  it('a quien no atiende no le ofrece «Mis horarios», que no son suyos', async () => {
    // Mismo criterio que «Visitas de laboratorio»: no se ofrece una puerta que
    // la pantalla del otro lado no va a reconocer como propia.
    await montar({ roles: ['SCHEDULING_AGENT'] });
    await responder();
    harness.fixture.detectChanges();

    const solapas = [
      ...harness.fixture.nativeElement.querySelectorAll('[role="tab"]'),
    ] as HTMLElement[];

    expect(solapas.map((s) => s.textContent?.trim())).not.toContain('Mis horarios');
  });

  /* -- Ingreso por mostrador (AC-C3-03) ------------------------------------ */

  /**
   * El botón que abre el modal, o `null` si no se ofrece.
   *
   * C-11 (2026-09-20) lo había bajado del encabezado de la página al del día.
   * Desde el 24/09 **el médico no lo ve en ninguno de los dos**: el ingreso por
   * mostrador es de quien reparte turnos, que no tiene calendario y lo sigue
   * teniendo en el encabezado de la página.
   */
  function botonDeMostrador(): HTMLElement | null {
    return harness.fixture.nativeElement.querySelector(
      '[data-testid="dia-ingreso-mostrador"], [data-testid="agenda-ingreso-mostrador"]',
    );
  }

  it('al médico no le ofrece el ingreso por mostrador, ni en el día ni arriba', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' }, '/schedule');
    await responderTodo();

    // El día está pintado: la ausencia no es porque falte la agenda.
    expect(harness.fixture.nativeElement.querySelector('app-day-view')).not.toBeNull();
    expect(botonDeMostrador()).toBeNull();
    expect(harness.fixture.nativeElement.querySelector('app-walk-in-form')).toBeNull();
  });

  it('se lo sigue ofreciendo a quien reparte turnos, con recurso elegido', async () => {
    await montar({ roles: ['SCHEDULING_AGENT'] }, '/schedule');
    await responder();
    harness.fixture.detectChanges();

    expect(botonDeMostrador()?.textContent).toContain('Ingreso Mostrador');
    // Cerrado hasta que alguien lo toque: el `<dialog>` atrapa el foco, y
    // dejarlo montado metería sus campos en el orden de tabulación de atrás.
    expect(harness.fixture.nativeElement.querySelector('app-walk-in-form')).toBeNull();
  });

  it('sin agenda elegida no ofrece el mostrador: el turno no tendría dónde ir', async () => {
    // Mismo criterio que el aviso de demora. La autoridad sigue siendo la API
    // —`walk-in` declara SCHEDULING_ADMIN, AGENT y PRACTITIONER—; esconder el
    // botón sólo evita ofrecer un gesto que no se puede completar.
    await montar({ roles: ['SCHEDULING_AGENT'] });
    await responderRecursos([]);
    harness.fixture.detectChanges();

    expect(botonDeMostrador()).toBeNull();
  });

  it('el botón abre el modal sobre la agenda, sin navegar', async () => {
    await montar({ roles: ['SCHEDULING_AGENT'] }, '/schedule');
    await responder();
    harness.fixture.detectChanges();

    const antes = TestBed.inject(Router).url;
    botonDeMostrador()?.click();
    harness.fixture.detectChanges();

    expect(harness.fixture.nativeElement.querySelector('app-walk-in-form')).not.toBeNull();
    // Sigue en la misma pantalla: quien atiende el mostrador tiene a la
    // siguiente persona esperando y no puede perder el día de vista.
    expect(TestBed.inject(Router).url).toBe(antes);
  });

  it('sin rol de padrón no ofrece el enlace a la ficha del paciente', async () => {
    await montar({ roles: ['SCHEDULING_AGENT'] });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['rutaPaciente']).toBeNull();
  });

  /**
   * Va acompañado de un rol de agenda a propósito: `SECURITY_ADMIN` administra
   * el padrón, no la grilla, así que por sí solo no abre ninguna agenda —es la
   * regla que fija «sin rol de agenda no se elige recurso»—. Lo que esta prueba
   * mira es otra cosa: que teniendo el rol del padrón, el enlace a la ficha
   * aparezca.
   */
  it('con SECURITY_ADMIN el enlace apunta a la ficha', async () => {
    await montar({ roles: ['SECURITY_ADMIN', 'SCHEDULING_AGENT'] });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['rutaPaciente']).toBe(
      '/administration/patients/p-1',
    );
  });

  /** `SUPERADMIN` es comodín en el `RolesGuard` del backend; acá también. */
  it('con SUPERADMIN el enlace apunta a la ficha', async () => {
    await montar({ roles: ['SUPERADMIN'] });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['rutaPaciente']).toBe(
      '/administration/patients/p-1',
    );
  });

  /* ---- la agenda propia (claim `hpid`) ----------------------------------- */

  /**
   * Quien reparte turnos sí cae en el primero: su trabajo es la grilla de la
   * organización y no tiene agenda propia que preferir.
   */
  it('con rol de agenda y sin `hpid` se abre en el primer recurso', async () => {
    await montar({ roles: ['SCHEDULING_ADMIN'] });
    await responderRecursos([RECURSO_AJENO, RECURSO]);
    await responderResto();

    expect(interno<() => string | null>('recursoElegido')()).toBe('r-0');
    expect(interno<() => boolean>('mirandoAgendaPropia')()).toBe(false);
  });

  /**
   * **La regla que reemplaza a la caída al primer recurso.**
   *
   * Antes, quien atiende sin agenda propia en esa organización abría la pantalla
   * y se encontraba mirando el primer consultorio de la lista: los pacientes y
   * los motivos de consulta de un colega, sin haber pedido nada. Ahora no se
   * muestra ninguna agenda y la pantalla explica qué falta.
   */
  it('quien atiende sin agenda propia no cae en la de otro', async () => {
    // Sin `hpid`: la sesión no declara perfil profesional, así que ningún
    // recurso de la organización es suyo.
    await montar({ roles: ['PRACTITIONER'] });
    await responderRecursos([RECURSO_AJENO, RECURSO]);

    // Ni citas ni cupos: no hay recurso que pedir, así que no sale ni una lectura.
    http.verify();
    expect(interno<() => string | null>('recursoElegido')()).toBeNull();
    expect(interno<() => boolean>('sinAgendaPropia')()).toBe(true);

    // El aviso dejó de mandar a «pedírselo a quien administra»: desde el
    // autoservicio, el siguiente paso es publicar la propia, y el CTA tiene
    // que llevar directo al asistente.
    harness.fixture.detectChanges();
    const alerta = harness.fixture.nativeElement.querySelector('app-alert');
    expect(alerta?.textContent).toContain('no pueden pedirte turno');
    expect(alerta?.querySelector('a[app-button]')?.getAttribute('href')).toContain('/schedule/new');
    expect(citas().status).toBe('empty');
  });

  /** El selector de agendas ajenas no existe para quien atiende. */
  it('quien atiende no tiene selector de recurso', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responderRecursos([RECURSO_AJENO, RECURSO]);
    await responderResto();

    expect(interno<() => boolean>('puedeElegirRecurso')()).toBe(false);
  });

  it('quien reparte turnos sí tiene selector', async () => {
    await montar({ roles: ['SCHEDULING_AGENT'] });
    await responder();

    expect(interno<() => boolean>('puedeElegirRecurso')()).toBe(true);
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
   *
   * Vale **para quien puede elegir recurso**, que es el que comparte grillas.
   */
  it('el recurso de la URL manda sobre la agenda propia', async () => {
    await montar({ roles: ['SCHEDULING_ADMIN'], hpid: 'hp-1' }, '/schedule?recurso=r-0');
    await responderRecursos([RECURSO_AJENO, RECURSO]);
    await responderResto();

    expect(interno<() => string | null>('recursoElegido')()).toBe('r-0');
    expect(interno<() => boolean>('mirandoAgendaPropia')()).toBe(false);
  });

  /**
   * Y el reverso: para quien atiende, el parámetro no abre nada.
   *
   * Es el agujero que dejaba la regla anterior — bastaba pegar un `?recurso=`
   * en la barra para leer la agenda clínica de cualquier colega—, y por eso la
   * guarda vive en el componente y no en un `@if` de la plantilla.
   */
  it('a quien atiende, un `?recurso=` ajeno no le abre esa agenda', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' }, '/schedule?vista=table&recurso=r-0');
    await responderRecursos([RECURSO_AJENO, RECURSO]);
    await responderResto();

    expect(interno<() => string | null>('recursoElegido')()).toBe('r-1');
    expect(interno<() => boolean>('mirandoAgendaPropia')()).toBe(true);
    // Y no se avisa de un recurso «inexistente»: existe, simplemente no es suyo.
    expect(interno<() => boolean>('recursoInexistente')()).toBe(false);
  });

  /**
   * El identificador solo no alcanza: dos filas de tablas distintas pueden
   * compartir uuid sin tener nada que ver.
   *
   * Con la regla nueva, no reconocer la agenda como propia ya no significa caer
   * en la de al lado: significa no abrir ninguna.
   */
  it('no toma por propia una agenda que apunta a otra tabla', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responderRecursos([RECURSO_DE_OTRA_TABLA, RECURSO_AJENO]);

    // El calendario alcanzó a montarse y a pedir lo suyo antes de que los
    // recursos revelaran que ninguna agenda es propia. Sus lecturas se vacían
    // acá para que el `verify()` de la línea siguiente siga diciendo lo que
    // esta prueba quiere que diga: que la PANTALLA no pidió citas ni cupos.
    await drenarCalendario();
    http.verify();
    expect(interno<() => boolean>('mirandoAgendaPropia')()).toBe(false);
    expect(interno<() => string | null>('recursoElegido')()).toBeNull();
    expect(interno<() => boolean>('sinAgendaPropia')()).toBe(true);
  });

  /**
   * El enlace que cierra el recorrido del médico: del turno a la historia de
   * quien llega. Es el que `CLINICIAN` y `PRACTITIONER` sí pueden abrir — la
   * ficha de filiación pide `SECURITY_ADMIN`, que no tienen —, así que sin él la
   * agenda de quien atiende terminaba en un callejón.
   */
  it('con rol clínico el turno enlaza al expediente', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder();

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['rutaExpediente']).toBe('/medical-records/p-1');
    // Y no la ficha de filiación, que su rol no puede abrir.
    expect(fila['rutaPaciente']).toBeNull();
  });

  it('sin rol clínico no ofrece el expediente', async () => {
    await montar({ roles: ['SCHEDULING_AGENT'] });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['rutaExpediente']).toBeNull();
  });

  /** Orden pedido por el propietario el 2026-09-13; las acciones van al final. */
  it('las columnas van en el orden pedido: fecha, paciente, motivo, seguro, estado, pago', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder();

    const claves = interno<() => readonly { key: string }[]>('columnasDeConsultas')().map(
      (columna) => columna.key,
    );
    expect(claves.filter((clave) => clave !== 'acciones')).toEqual([
      'cuando',
      'paciente',
      'motivo',
      'cobertura',
      'estado',
      'pago',
    ]);
  });

  /**
   * El globo del nombre: la última consulta ANTERIOR a esta cita que llegó a
   * ser consulta —una cancelada no cuenta—, con su motivo. Se pide una vez.
   */
  it('el globo del paciente dice su última consulta y el motivo', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder();

    const fila = citas().data?.[0];
    const precargar = interno<(cita: unknown) => void>('precargarUltimaConsulta');
    const resumen = interno<(cita: unknown) => string>('resumenDelPaciente');

    precargar(fila);
    expect(resumen(fila)).toContain('Buscando la última consulta');

    http
      .expectOne(
        (r) => r.url === '/scheduling/bookings' && r.params.get('patientProfileId') === 'p-1',
      )
      .flush({
        items: [
          CITA,
          // «Atendida» no está entre las etiquetas de la ventana: hay que pedirla.
          {
            ...CITA,
            id: 'b-0',
            startAt: '2026-07-01T13:00:00.000Z',
            statusConceptId: 'c-atendida',
            reasonText: 'Dolor de cabeza',
          },
          {
            ...CITA,
            id: 'b-x',
            startAt: '2026-07-20T13:00:00.000Z',
            statusConceptId: 'c-cancelada',
            reasonText: 'Cancelada, no cuenta',
          },
        ],
        count: 3,
        limit: 50,
        truncated: false,
      });
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [
          {
            conceptId: 'c-atendida',
            code: 'BOOKING_COMPLETED',
            display: 'Atendida',
            codeSystemVersionId: 'csv-1',
          },
        ],
        count: 1,
        limit: 200,
      });

    const texto = resumen(fila);
    expect(texto).toContain('Última consulta');
    expect(texto).toContain('Dolor de cabeza');
    expect(texto).not.toContain('no cuenta');

    precargar(fila);
    http.expectNone((r) => r.url === '/scheduling/bookings');
  });

  /** El motivo viaja al expediente para precargar el del encuentro. */
  it('lleva el motivo de la cita para precargar el del encuentro', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder();

    expect((citas().data?.[0] as Record<string, unknown>)['motivoCrudo']).toBe('Control anual');
  });

  /**
   * El vínculo turno → encuentro. Viaja el `appointmentId` de la reserva —la
   * cita clínica— y **no** el `id` de la reserva, que apunta a otra tabla y
   * violaría la clave foránea del encuentro.
   */
  it('lleva la cita clínica del turno cuando la reserva la tiene', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder({ citas: [{ ...CITA, appointmentId: 'ap-1' }] });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['appointmentId']).toBe('ap-1');
    expect(fila['paramsDeLaAtencion']).toEqual({ motivo: 'Control anual', cita: 'ap-1' });
  });

  /**
   * `null` es lo corriente —la reserva nace en la agenda y la cita clínica es un
   * registro posterior— y no puede colarse en la URL como el texto «null».
   */
  it('una reserva sin cita clínica no manda el parámetro', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder({ citas: [{ ...CITA, appointmentId: null }] });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['appointmentId']).toBeNull();
    expect(fila['paramsDeLaAtencion']).toEqual({ motivo: 'Control anual' });
  });

  it('una cita sin motivo no inventa uno para llevar', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    const { reasonText: _omitido, ...sinMotivo } = CITA;
    await responder({ citas: [sinMotivo] });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['motivoCrudo']).toBeNull();
    // En la tabla sí se rellena: una celda vacía se lee como un dato que no cargó.
    expect(fila['motivo']).toBe('Sin registrar');
  });

  /* -- ALV-024: navegación temporal ----------------------------------------
     Antes «Próximos 7 días» era SIEMPRE desde hoy: no había forma de mirar la
     ventana anterior ni adelantarse a la que viene sin cambiar la fecha del
     sistema. `fechaBase` corre en la URL (`?desde=`) para que se pueda
     compartir por enlace y, al volver, traiga la misma consulta. */
  describe('navegación temporal', () => {
    /** Medianoche de hoy, igual que la calcula el propio componente. */
    function hoy(): Date {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }

    function diasEntre(a: Date, b: Date): number {
      return Math.round((b.getTime() - a.getTime()) / 86_400_000);
    }

    it('por defecto la ventana arranca hoy, y lo dice `enVentanaDeHoy`', async () => {
      await montar();
      await responder();

      expect(interno<() => Date>('fechaBase')().getTime()).toBe(hoy().getTime());
      expect(interno<() => boolean>('enVentanaDeHoy')()).toBe(true);
    });

    it('«Siguiente» adelanta la ventana un tramo completo, no un día', async () => {
      // Con «Próximos 7 días», un tramo son 7 días: es la página siguiente,
      // no un desplazamiento de un día.
      await montar();
      await responder();

      interno<(d: -1 | 1) => void>('moverVentana')(1);
      await harness.fixture.whenStable();
      harness.detectChanges();

      const nueva = interno<() => Date>('fechaBase')();
      expect(diasEntre(hoy(), nueva)).toBe(7);
      expect(interno<() => boolean>('enVentanaDeHoy')()).toBe(false);

      // La navegación disparó una lectura real (efecto de ALV-024): se
      // responde, si no queda un pedido abierto que `afterEach` rechaza.
      http.expectOne((r) => r.url === '/scheduling/bookings').flush({
        items: [],
        count: 0,
        limit: 100,
        truncated: false,
      });
      http
        .expectOne((r) => r.url === '/scheduling/slots')
        .flush({ items: [], count: 0, limit: 100, truncated: false });
    });

    it('«Anterior» la atrasa, y la lectura siguiente pide ESA ventana', async () => {
      await montar();
      await responder();

      interno<(d: -1 | 1) => void>('moverVentana')(-1);
      await harness.fixture.whenStable();
      harness.detectChanges();

      // Los recursos NO se vuelven a pedir: son el catálogo de la agenda, no
      // su contenido — el propio constructor lo dice. Lo que cambia es la
      // ventana de citas y cupos.
      http.expectNone((r) => r.url === '/scheduling/resources');
      const bookings = http.expectOne((r) => r.url === '/scheduling/bookings');
      const desde = new Date(bookings.request.params.get('from') ?? '');
      // Una semana ANTES de hoy, no siete días desde hoy hacia atrás mal
      // contados: el punto de fuga es el mismo `hoy()` que usa la pantalla.
      expect(diasEntre(desde, hoy())).toBe(7);
      bookings.flush({ items: [], count: 0, limit: 100, truncated: false });
      http
        .expectOne((r) => r.url === '/scheduling/slots')
        .flush({ items: [], count: 0, limit: 100, truncated: false });
    });

    it('volver exactamente a hoy limpia la URL — no se queda un `?desde=hoy` colgado', async () => {
      await montar();
      await responder();

      interno<(d: -1 | 1) => void>('moverVentana')(-1);
      await harness.fixture.whenStable();
      harness.detectChanges();
      responderResto();

      interno<(d: -1 | 1) => void>('moverVentana')(1);
      await harness.fixture.whenStable();
      harness.detectChanges();
      responderResto();

      expect(interno<() => boolean>('enVentanaDeHoy')()).toBe(true);
      expect(interno<() => Date>('fechaBase')().getTime()).toBe(hoy().getTime());
    });

    it('«Hoy» vuelve de un clic, sin contar los tramos de regreso', async () => {
      await montar();
      await responder();

      interno<(d: -1 | 1) => void>('moverVentana')(1);
      await harness.fixture.whenStable();
      harness.detectChanges();
      responderResto();
      interno<(d: -1 | 1) => void>('moverVentana')(1);
      await harness.fixture.whenStable();
      harness.detectChanges();
      responderResto();
      expect(interno<() => boolean>('enVentanaDeHoy')()).toBe(false);

      interno<() => void>('irAHoy')();
      await harness.fixture.whenStable();
      harness.detectChanges();
      responderResto();

      expect(interno<() => boolean>('enVentanaDeHoy')()).toBe(true);
    });

    it('cambiar el tamaño de la ventana vuelve a hoy: un desplazamiento no sobrevive al cambio de escala', async () => {
      await montar();
      await responder();

      interno<(d: -1 | 1) => void>('moverVentana')(1);
      await harness.fixture.whenStable();
      harness.detectChanges();
      responderResto();

      interno<(c: string | null) => void>('elegirVentana')('mes');
      await harness.fixture.whenStable();
      harness.detectChanges();
      responderResto();

      expect(interno<() => boolean>('enVentanaDeHoy')()).toBe(true);
    });

    it('una fecha inválida en la URL no rompe la pantalla: cae a hoy', async () => {
      await montar({}, '/schedule?desde=no-es-una-fecha');
      await responder();

      expect(interno<() => Date>('fechaBase')().getTime()).toBe(hoy().getTime());
    });
  });

  /* -- ALV-021: seguro del paciente en la consulta ------------------------- */

  it('con aseguradora declarada, la fila dice su nombre', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder({ citas: [{ ...CITA, insuranceCarrierName: 'Seguros Illimani' }] });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['cobertura']).toBe('Seguros Illimani');
  });

  it('sin aseguradora (`null` desde la API), la fila dice Particular', async () => {
    // `null` es la respuesta comprobada, no la ausencia del campo: se buscó
    // y el paciente no tiene. Es distinto del caso de abajo.
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder({ citas: [{ ...CITA, insuranceCarrierName: null }] });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['cobertura']).toBe('Particular');
  });

  it('cuando la API no manda el campo, la celda no inventa Particular', async () => {
    // Mismo criterio que el nombre del paciente: si la API omite el campo por
    // privacidad, la pantalla no puede rellenarlo con un valor que también es
    // una afirmación —«no tiene seguro»— que nadie comprobó para esta sesión.
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    const { ...sinCampo } = CITA;
    await responder({ citas: [sinCampo] });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['cobertura']).toBe('—');
    expect(fila['cobertura']).not.toBe('Particular');
  });

  /* -- Seguro clicable: el estado de la solicitud (propietario, 2026-09-13) -- */

  const SOLICITUD = {
    id: 'claim-1',
    claimIdentifier: 'CLM-2026-0142',
    statusCode: 'APPROVED',
    statusDisplay: 'Aprobada',
    submittedAt: '2026-09-01T10:00:00.000Z',
  };

  it('con solicitud de seguro, la fila la trae con su estado', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder({
      citas: [{ ...CITA, insuranceCarrierName: 'Seguros Illimani', insuranceClaim: SOLICITUD }],
    });

    const fila = citas().data?.[0] as Record<string, unknown>;
    expect(fila['solicitudSeguro']).toEqual({
      id: 'claim-1',
      numero: 'CLM-2026-0142',
      estado: 'Aprobada',
      codigo: 'APPROVED',
      enviada: new Date('2026-09-01T10:00:00.000Z'),
    });
  });

  it('sin solicitud (`null` o campo omitido), la celda no ofrece nada que abrir', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder({
      citas: [
        { ...CITA, id: 'b-null', insuranceCarrierName: 'Seguros Illimani', insuranceClaim: null },
        { ...CITA, id: 'b-sin', insuranceCarrierName: 'Seguros Illimani' },
      ],
    });

    for (const fila of (citas().data ?? []) as Record<string, unknown>[]) {
      expect(fila['solicitudSeguro']).toBeNull();
    }
  });

  it('la médica ve el estado en un resumen, sin enlace a facturación', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder({
      citas: [{ ...CITA, insuranceCarrierName: 'Seguros Illimani', insuranceClaim: SOLICITUD }],
    });
    const dialogs = TestBed.inject(DialogService);
    const confirmar = vi.spyOn(dialogs, 'confirm').mockResolvedValue(true);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await interno<(c: unknown) => Promise<void>>('verSolicitudDeSeguro')(citas().data?.[0]);

    const config = confirmar.mock.calls[0]?.[0];
    expect(config?.title).toContain('CLM-2026-0142');
    expect(config?.details).toContainEqual({ label: 'Estado', value: 'Aprobada' });
    expect(config?.confirmLabel).toBe('Entendido');
    // Sin rol de facturación el detalle es un 403: no se navega aunque confirme.
    expect(navegar).not.toHaveBeenCalled();
  });

  it('con rol de facturación, el resumen abre la solicitud', async () => {
    await montar({ roles: ['PRACTITIONER', 'BILLING_OPERATOR'], hpid: 'hp-1' });
    await responder({
      citas: [{ ...CITA, insuranceCarrierName: 'Seguros Illimani', insuranceClaim: SOLICITUD }],
    });
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await interno<(c: unknown) => Promise<void>>('verSolicitudDeSeguro')(citas().data?.[0]);

    expect(navegar).toHaveBeenCalledWith(['/administration/insurance-claims', 'claim-1']);
  });

  it('el tono del estado sigue al código, no a la etiqueta', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responder();
    const tono = interno<(c: string) => string>('tonoDeSolicitud');

    expect(tono('APPROVED')).toBe('success');
    expect(tono('PAID')).toBe('success');
    expect(tono('PARTIAL')).toBe('warning');
    expect(tono('REJECTED')).toBe('error');
    expect(tono('IN_REVIEW')).toBe('info');
    // Los del catálogo de la API.
    expect(tono('CLAIM_PAID')).toBe('success');
    expect(tono('CLAIM_ADJUDICATED')).toBe('primary');
    expect(tono('CLAIM_REVERSED')).toBe('error');
    expect(tono('CLAIM_SUBMITTED')).toBe('info');
  });

  it('una cita sin paciente no enlaza a ningún expediente', async () => {
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
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
    componente = await harness.navigateByUrl('/schedule?recurso=r-borrado', Agenda);

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
    componente = await harness.navigateByUrl('/schedule', Agenda);

    http.verify();
    expect(interno<() => boolean>('sinOrganizacion')()).toBe(true);
  });

  it('los rótulos de las pestañas llevan el conteo del otro panel', async () => {
    await montar();
    await responder();

    // ALV-019: una sola lista para el ciclo. El conteo es del total, no de
    // la mitad que ya estaba confirmada.
    expect(interno<() => string>('rotuloDeConsultas')()).toBe('Consultas (1)');
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

  it('cancelar pide motivo y no hace nada si no se dio', async () => {
    await montar();
    await responder();

    const dialogs = TestBed.inject(DialogService);
    // `null` es lo que devuelve el diálogo cuando se vuelve sin confirmar.
    vi.spyOn(dialogs, 'confirmWithReason').mockResolvedValue(null);

    await interno<(c: unknown) => Promise<void>>('cancelarCita')(primeraCita());

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(citas().status).toBe('ready');
  });

  it('cancelar con motivo lo manda al servidor, libera el cupo y recarga', async () => {
    await montar();
    await responder();

    const dialogs = TestBed.inject(DialogService);
    vi.spyOn(dialogs, 'confirmWithReason').mockResolvedValue('El profesional tuvo una urgencia');

    const pendiente = interno<(c: unknown) => Promise<void>>('cancelarCita')(primeraCita());
    await harness.fixture.whenStable();

    const req = http.expectOne('/scheduling/bookings/b-1/cancel');
    // Desde esta pantalla cancela la organización; `isNoShow` no viaja si
    // nadie lo marcó, porque es lo que dispara el cargo de la política. El
    // motivo sí va siempre: el paciente tiene que poder leer por qué se le
    // canceló el turno (corrección #14).
    expect(req.request.body).toEqual({
      cancelledBy: 'PROVIDER',
      reasonText: 'El profesional tuvo una urgencia',
    });
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
    componente = await harness.navigateByUrl('/schedule', Agenda);
    // Sólo los recursos: un paciente no elige agenda ajena ni tiene una propia,
    // así que no sale ninguna lectura de citas ni de cupos. Las columnas se
    // derivan de los roles, no de los datos, y es eso lo que se mira acá. Su
    // pantalla de reservas es `my-account/appointments`, que sí lista agendas.
    await responderRecursos();

    const columnasDeCitas = interno<() => readonly { key: string }[]>('columnasDeConsultas')();
    const columnasDeCupos = interno<() => readonly { key: string }[]>('columnasDeCupos')();

    expect(columnasDeCitas.some((columna) => columna.key === 'acciones')).toBe(false);
    expect(columnasDeCupos.some((columna) => columna.key === 'reservar')).toBe(true);
  });

  /* ---- dónde atiende el recurso ------------------------------------------- */

  /**
   * La agenda sabía *cuándo* y no *dónde*, y un turno sin dirección obliga a
   * averiguarla por fuera del sistema. Llega en la misma lectura de recursos,
   * así que no cuesta una petición más ni una por recurso.
   */
  it('dice dónde se atiende con el recurso elegido', async () => {
    await montar();
    await responder();

    harness.detectChanges();

    expect(interno<() => string>('ubicacionDelRecurso')()).toBe(
      'Consultorio Central · Av. Brasil 1234, La Paz',
    );
    expect(harness.routeNativeElement?.textContent).toContain('Av. Brasil 1234, La Paz');
  });

  /**
   * Sin sede vigente el renglón lo dice con esas palabras. Dejar el hueco se
   * leería como un dato que no cargó, que es otra cosa.
   */
  it('cuando el recurso no tiene sede lo dice, en vez de dejar el hueco', async () => {
    await montar();
    await responderRecursos([RECURSO_SIN_SEDE]);
    responderResto();
    harness.detectChanges();

    expect(interno<() => unknown>('sedeDelRecurso')()).toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('Sin consultorio registrado');
  });

  /* ========================================================================
     Carril 07 — el profesional decide sobre la cita.
     ======================================================================== */

  /** El botón de una acción, por su `data-testid`. */
  /**
   * Abre la solapa «Citas» y espera al render.
   *
   * Hace falta desde que las solicitudes tienen solapa propia y **es la de
   * arranque** (TAREA-13, punto 1): una cita ya agendada vive en la segunda, y
   * el panel inactivo no se renderiza. Sin esto, buscar su botón devuelve
   * `null` por no estar en pantalla, no por no ofrecerse.
   */
  /**
   * La lista de consultas es la solapa 0 desde ALV-019 (antes «Citas» era la 1
   * y «Solicitudes» la 0). Se sigue seleccionando explícitamente aunque hoy sea
   * la de arranque: la prueba dice sobre qué lista afirma.
   */
  async function verSolapaDeCitas(): Promise<void> {
    // Por nombre y no por índice: el orden depende del rol.
    const indice = interno<() => readonly string[]>('pestanas')().indexOf('consultations');
    if (indice >= 0) {
      interno<(i: number) => void>('elegirPestana')(indice);
      await harness.fixture.whenStable();
      harness.detectChanges();
      return;
    }

    // C-07 (2026-09-20): quien atiende no tiene lista, y las acciones de la
    // cita se dibujan en el DÍA con la misma celda (`#accionesDeLaCitaDelDia`
    // → `celdaAccionesCita`). No es una copia: es la misma plantilla. Así que
    // acá se le da al día la misma cita que la pantalla ya tiene, que es lo que
    // el servidor devolvería, y las acciones se miran ahí.
    await responderDiaConLaMismaCita();
  }

  /**
   * Responde las lecturas del calendario con la cita y el cupo que la pantalla
   * ya recibió, para que el día dibuje su tarjeta con sus acciones.
   */
  async function responderDiaConLaMismaCita(): Promise<void> {
    // Con `bookableSlotId`: el día arma sus bloques a partir de los CUPOS y le
    // cuelga la cita al que coincide. Una cita sin cupo no se dibuja —es lo
    // mismo que hace la pantalla real—, así que sin esto no habría tarjeta.
    const conEstado = { ...CITA, statusConceptId: 'c-estado', bookableSlotId: CUPO.id };
    for (let vuelta = 0; vuelta < 4; vuelta += 1) {
      const apartadas = delCalendario.filter((r) => !r.cancelled);
      delCalendario = [];
      const abiertas = [...apartadas, ...http.match(() => true)].filter((r) => !r.cancelled);
      if (abiertas.length === 0) break;
      for (const req of abiertas) {
        const url = req.request.url;
        req.flush(
          url === '/scheduling/resources'
            ? { items: [RECURSO], count: 1 }
            : url === '/scheduling/bookings'
              ? { items: [conEstado], count: 1, limit: 100, truncated: false }
              : url === '/scheduling/slots'
                ? { items: [CUPO], count: 1, limit: 100, truncated: false }
                : url.endsWith('/templates')
                  ? {
                      items: [
                        {
                          id: 'tpl-1',
                          name: 'Horario',
                          statusConceptId: 'c',
                          rules: [{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }],
                        },
                      ],
                      count: 1,
                    }
                  : { items: [], count: 0, limit: 100, truncated: false },
        );
      }
      await harness.fixture.whenStable();
      harness.detectChanges();
    }
  }

  /**
   * El control de una acción de la fila, abriendo el desplegable si hace falta.
   *
   * C-06 (2026-09-20): las acciones de la tabla pasaron de ocho botones de sólo
   * ícono en línea a `app-row-actions`, que con tres o más las manda a un
   * **desplegable**. `app-menu` no renderiza sus ítems mientras está cerrado
   * —por costo, no por accesibilidad—, así que preguntar «¿la fila ofrece
   * Aceptar?» ahora exige abrirlo, que es lo que hace una persona. Con dos o
   * menos van en la fila y se encuentran directo.
   *
   * La pregunta no cambió y la respuesta tampoco: si la acción no se ofrece, el
   * desplegable se abre y no está. Lo que cambió es dónde hay que mirar.
   */
  function boton(testid: string): HTMLElement | null {
    // El desplegable abierto se cuelga del `<body>` —`app-menu` lo mueve ahí
    // para que ningún `overflow` lo recorte—, así que buscar sólo dentro de la
    // ruta no lo encuentra.
    // `app-row-actions` identifica cada acción con `data-action`, que lleva el
    // mismo código que la acción tenía como `data-testid` cuando era un botón
    // suelto: la acción es la misma y se llama igual.
    const buscar = (): HTMLElement | null =>
      harness.routeNativeElement?.ownerDocument.querySelector(
        `[data-testid="${testid}"], [data-action="${testid}"]`,
      ) ?? null;

    const directo = buscar();
    if (directo !== null) return directo;

    const disparador = harness.routeNativeElement?.querySelector<HTMLButtonElement>(
      '[data-testid="row-actions-trigger"]',
    );
    if (disparador === null || disparador === undefined) return null;
    disparador.click();
    harness.detectChanges();
    return buscar();
  }


  /**
   * C-06 (2026-09-20) — «botón = icono + texto; las acciones de una tabla, en
   * un desplegable».
   *
   * La celda eran hasta ocho botones de sólo ícono en línea. El motivo estaba
   * escrito y era bueno —con texto la fila crecía a tres renglones—; el pedido
   * resuelve la misma tensión de otra manera, y ahora la fila sigue en un
   * renglón Y cada opción tiene su palabra.
   */
  describe('las acciones de la fila las dibuja `app-row-actions` (C-06)', () => {
    /** El componente compartido, montado en la celda de acciones. */
    function rowActions(): HTMLElement | null {
      return harness.routeNativeElement?.querySelector('app-row-actions') ?? null;
    }

    it('es el componente del sistema de diseno, no un desplegable escrito aca', async () => {
      await montar();
      await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
      await verSolapaDeCitas();

      // La primera version de este turno escribio su propio bloque sobre
      // `app-menu`, antes de que el componente estuviera publicado. Esta prueba
      // fija que se migro: una implementacion paralela de algo que el sistema
      // ya resuelve es el defecto que la regla 95.1 nombra.
      expect(rowActions()).not.toBeNull();
    });

    it('con muchas acciones la fila no crece: van a un desplegable con su texto', async () => {
      await montar();
      await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
      await verSolapaDeCitas();

      // Una confirmada ofrece seis: detalle, iniciar, llegada, demora, mover y
      // cancelar. Con tres o mas, `app-row-actions` las colapsa.
      expect(interno<(c: unknown) => readonly unknown[]>('accionesDe')(citas().data?.[0]).length)
        .toBeGreaterThan(2);
      const disparador = harness.routeNativeElement?.querySelector(
        '[data-testid="row-actions-trigger"]',
      ) as HTMLElement;
      expect(disparador).not.toBeNull();
      expect(disparador.textContent?.trim()).toContain('Acciones');
      // Cerrado, ninguna opcion suelta en la fila.
      expect(
        harness.routeNativeElement?.querySelectorAll('[role="menuitem"]'),
      ).toHaveLength(0);
    });

    it('cada opcion lleva su TEXTO, y las que el set cubre llevan ademas su icono', async () => {
      await montar();
      await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
      await verSolapaDeCitas();
      (
        harness.routeNativeElement?.querySelector(
          '[data-testid="row-actions-trigger"]',
        ) as HTMLElement
      ).click();
      harness.detectChanges();

      const opciones = Array.from(
        harness.routeNativeElement?.ownerDocument.querySelectorAll('[role="menuitem"]') ?? [],
      ) as HTMLElement[];
      expect(opciones.length).toBeGreaterThan(2);

      for (const opcion of opciones) {
        expect(opcion.textContent?.trim(), 'una opcion sin texto es C-06 sin cumplir').not.toBe('');
      }
      // El set de iconos del sistema es cerrado y todavia no cubre «ver»,
      // «aceptar», «completar» ni «registrar llegada»: esas van con su texto,
      // que es lo que el contrato de `RowAction` declara. Lo que esta prueba
      // fija es que las que SI tienen icono lo llevan.
      const conIcono = opciones.filter((o) => o.querySelector('app-nav-icon') !== null);
      expect(conIcono.length).toBeGreaterThan(0);
    });

    it('con dos acciones o menos van EN la fila, con su texto, sin desplegable', async () => {
      // Una cita ya atendida ofrece una sola: ver su detalle.
      await montar();
      await responderConEstado('BOOKING_COMPLETED', 'Atendida');
      await verSolapaDeCitas();

      expect(interno<(c: unknown) => readonly unknown[]>('accionesDe')(citas().data?.[0]))
        .toHaveLength(1);
      expect(
        harness.routeNativeElement?.querySelector('[data-testid="row-actions-trigger"]'),
      ).toBeNull();
      const enLinea = harness.routeNativeElement?.querySelector(
        '[data-action="agenda-detalle"]',
      ) as HTMLElement;
      expect(enLinea).not.toBeNull();
      expect(enLinea.textContent?.trim()).toContain('Ver detalle de la cita');
    });

    it('sin estado resuelto no se ofrece ninguna accion', async () => {
      // No se opera sobre un estado que no se conoce: un desplegable vacio
      // promete algo y no lo cumple.
      await montar();
      await responderRecursos();
      responderResto();
      harness.detectChanges();

      const sinEstado = { ...(citas().data?.[0] as object), estado: { code: '', label: '' } };
      expect(interno<(c: unknown) => readonly unknown[]>('accionesDe')(sinEstado)).toHaveLength(0);
    });
  });

  it('una solicitud pendiente ofrece aceptar y rechazar, no iniciar', async () => {
    await montar();
    await responderConEstado('BOOKING_PENDING_CONFIRMATION', 'Por confirmar');

    expect(boton('agenda-aceptar')).not.toBeNull();
    expect(boton('agenda-rechazar')).not.toBeNull();
    expect(boton('agenda-iniciar')).toBeNull();
    expect(boton('agenda-completar')).toBeNull();
  });

  it('aceptar confirma la cita y relee la agenda', async () => {
    await montar();
    await responderConEstado('BOOKING_PENDING_CONFIRMATION', 'Por confirmar');

    interno<(c: unknown) => void>('aceptarCita')(citas().data?.[0]);
    await harness.fixture.whenStable();

    const req = http.expectOne('/scheduling/bookings/b-1/accept');
    expect(req.request.method).toBe('POST');
    req.flush({
      bookingId: 'b-1',
      statusConceptId: 'c-confirmada',
      occurredAt: '2026-08-15T12:00:00.000Z',
    });
    // Releer es lo que hace que el estado nuevo llegue a pantalla sin
    // inventarlo del lado del cliente. La recarga NO vuelve a pedir los
    // recursos: son el catálogo de la agenda, no su contenido.
    responderResto();
  });

  it('rechazar sin motivo no manda nada; con motivo manda el motivo', async () => {
    await montar();
    await responderConEstado('BOOKING_PENDING_CONFIRMATION', 'Por confirmar');
    const dialogs = TestBed.inject(DialogService);

    vi.spyOn(dialogs, 'confirmWithReason').mockResolvedValue(null);
    await interno<(c: unknown) => Promise<void>>('rechazarCita')(citas().data?.[0]);
    // El `http.verify()` del afterEach falla si algo salió a la red.

    vi.spyOn(dialogs, 'confirmWithReason').mockResolvedValue('La agenda de ese día se cerró');
    const pendiente = interno<(c: unknown) => Promise<void>>('rechazarCita')(citas().data?.[0]);
    await harness.fixture.whenStable();

    const req = http.expectOne('/scheduling/bookings/b-1/reject');
    expect(req.request.body).toEqual({ reasonText: 'La agenda de ese día se cerró' });
    req.flush({ bookingId: 'b-1', capacityReleased: true });
    responderResto();
    await pendiente;
  });

  /* ---- mover la cita (UC-41-08) -------------------------------------------
     **Es de quien atiende, no de quien pidió el turno** (propietario,
     2026-09-13): reordenar el día reacomoda a los demás pacientes de esa
     agenda. La vista del paciente ve y cancela, y su prueba de que no ofrece
     «Reprogramar» vive en `account/appointments`. Acá se fija la mitad que
     falta: que acá sí se ofrece, y que hace lo que dice. */

  it('una cita vigente ofrece moverla a otro horario', async () => {
    await montar();
    await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
    await verSolapaDeCitas();

    expect(boton('agenda-reprogramar')).not.toBeNull();
  });

  /**
   * El backend sólo mueve una cita **vigente**; sobre una solicitud sin
   * responder devuelve 422. Un botón que va a fallar es un error con forma de
   * oferta, así que no se dibuja.
   */
  it('una solicitud sin responder no ofrece moverla', async () => {
    await montar();
    await responderConEstado('BOOKING_PENDING_CONFIRMATION', 'Por confirmar');
    await verSolapaDeCitas();

    expect(boton('agenda-reprogramar')).toBeNull();
  });

  it('moverla abre la solapa de cupos, y el cupo deja de ofrecer reservar', async () => {
    await montar();
    await responder();
    await verSolapaDeCitas();

    interno<(c: unknown) => void>('iniciarReprogramacion')(primeraCita());
    // Dos vueltas: la primera resuelve la navegación que abre «Cupos» y la
    // segunda pinta su panel, que hasta entonces no existía en el DOM.
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(interno<() => boolean>('enReprogramacion')()).toBe(true);
    // Sin el salto a «Cupos» el botón no haría nada visible: los destinos
    // posibles están ahí. Sin «Mis horarios» —no es quien atiende— es la solapa 1.
    expect(interno<() => number>('pestana')()).toBe(1);
    expect(boton('agenda-reprogramando')).not.toBeNull();
    expect(boton('agenda-mover-aca')).not.toBeNull();
    // El mismo hueco no puede significar dos cosas a la vez.
    expect(boton('agenda-reservar')).toBeNull();
  });

  it('sin motivo no se mueve nada', async () => {
    await montar();
    await responder();

    vi.spyOn(TestBed.inject(DialogService), 'confirmWithReason').mockResolvedValue(null);
    interno<(c: unknown) => void>('iniciarReprogramacion')(primeraCita());
    await interno<(c: unknown) => Promise<void>>('reprogramarA')(cupos().data?.[0]);

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => boolean>('enReprogramacion')()).toBe(true);
  });

  it('con motivo manda el cupo destino, recarga y sale del modo', async () => {
    await montar();
    await responder();

    vi.spyOn(TestBed.inject(DialogService), 'confirmWithReason').mockResolvedValue(
      'La sala quedó ocupada por una urgencia',
    );
    interno<(c: unknown) => void>('iniciarReprogramacion')(primeraCita());
    const pendiente = interno<(c: unknown) => Promise<void>>('reprogramarA')(cupos().data?.[0]);
    await harness.fixture.whenStable();

    const req = http.expectOne('/scheduling/bookings/b-1/reschedule');
    expect(req.request.method).toBe('POST');
    // El motivo es obligatorio (corrección #14): el paciente lo lee junto con
    // el horario nuevo. Moverle el día sin decir por qué es medio aviso.
    expect(req.request.body).toEqual({
      toSlotId: 's-1',
      reasonText: 'La sala quedó ocupada por una urgencia',
    });
    req.flush({ bookingId: 'b-1', fromSlotId: 's-0', toSlotId: 's-1' });
    responderRecarga();
    await pendiente;

    expect(interno<() => boolean>('enReprogramacion')()).toBe(false);
  });

  /**
   * Un fallo deja el modo puesto: el destino elegido puede haberse llenado
   * entre que se miró y se tocó, y lo que corresponde es elegir otro — no
   * volver a la lista y empezar de cero.
   */
  it('si el servidor rechaza el movimiento, el modo sigue puesto', async () => {
    await montar();
    await responder();

    vi.spyOn(TestBed.inject(DialogService), 'confirmWithReason').mockResolvedValue('Sin lugar');
    interno<(c: unknown) => void>('iniciarReprogramacion')(primeraCita());
    const pendiente = interno<(c: unknown) => Promise<void>>('reprogramarA')(cupos().data?.[0]);
    await harness.fixture.whenStable();

    http
      .expectOne('/scheduling/bookings/b-1/reschedule')
      .flush({ message: 'El cupo ya no tiene lugar' }, { status: 422, statusText: 'Unprocessable' });
    await pendiente;

    expect(interno<() => boolean>('enReprogramacion')()).toBe(true);
    expect(interno<() => string | null>('cupoDestino')()).toBeNull();
  });

  it('dejar la cita como está apaga el modo y vuelve a las consultas', async () => {
    await montar();
    await responder();

    interno<(c: unknown) => void>('iniciarReprogramacion')(primeraCita());
    await harness.fixture.whenStable();
    interno<() => void>('cancelarReprogramacion')();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(interno<() => boolean>('enReprogramacion')()).toBe(false);
    expect(interno<() => number>('pestana')()).toBe(0);
  });

  /**
   * Corrección #15: el botón existe sobre una cita confirmada **sin ninguna
   * comprobación de fecha**. La cita de estas pruebas es del 8 de agosto y la
   * acción se ofrece igual, corra el día que corra.
   */
  it('una cita confirmada ofrece iniciar la consulta, sin esperar el día', async () => {
    await montar();
    await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
    await verSolapaDeCitas();

    expect(boton('agenda-iniciar')).not.toBeNull();
    expect(boton('agenda-completar')).toBeNull();

    interno<(c: unknown) => void>('iniciarAtencion')(citas().data?.[0]);
    await harness.fixture.whenStable();

    const req = http.expectOne('/scheduling/bookings/b-1/start');
    expect(req.request.method).toBe('POST');
    req.flush({
      bookingId: 'b-1',
      statusConceptId: 'c-curso',
      occurredAt: '2026-08-15T12:00:00.000Z',
    });
    responderResto();
  });

  /**
   * Fase 1 del plan de atención: «Iniciar consulta» es el **único** origen de
   * la atención, así que además de marcar la cita tiene que llevar allá. Antes
   * sólo hacía `start` y recargaba la tabla: el botón prometía una consulta
   * que no abría.
   */
  it('iniciar la consulta entra a atender, con el motivo y el turno en la URL', async () => {
    // Atender exige poder abrir expedientes: es la misma compuerta.
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
    await verSolapaDeCitas();

    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    interno<(c: unknown) => void>('iniciarAtencion')(citas().data?.[0]);
    await harness.fixture.whenStable();

    http.expectOne('/scheduling/bookings/b-1/start').flush({
      bookingId: 'b-1',
      statusConceptId: 'c-curso',
      occurredAt: '2026-08-15T12:00:00.000Z',
    });
    await harness.fixture.whenStable();

    expect(navegar).toHaveBeenCalledTimes(1);
    const [ruta, extras] = navegar.mock.calls[0] as [string[], { queryParams: unknown }];
    expect(ruta[0]).toMatch(/\/medical-records\/[^/]+\/consultation$/);
    expect(extras.queryParams).toEqual(citas().data?.[0]?.['paramsDeLaAtencion']);
    // Ya no recarga la tabla: se fue de la pantalla. Si recargara, el
    // `http.verify()` del afterEach encontraría la petición huérfana.
  });

  /**
   * `startBooking` sobre una cita ya iniciada es un 409: volver a entrar tiene
   * que navegar y **no** repetir la transición.
   */
  it('continuar una consulta en curso navega sin volver a iniciarla', async () => {
    // Atender exige poder abrir expedientes: es la misma compuerta.
    await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
    await responderConEstado('BOOKING_IN_PROGRESS', 'En curso');
    await verSolapaDeCitas();

    expect(boton('agenda-continuar')).not.toBeNull();

    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    interno<(c: unknown) => void>('continuarAtencion')(citas().data?.[0]);
    await harness.fixture.whenStable();

    expect(navegar).toHaveBeenCalledTimes(1);
    // El `http.verify()` del afterEach falla si esto salió a la red.
  });

  /**
   * C-11 (2026-09-20) — **una sola consulta a la vez**.
   *
   * El dato que lo dice ya existe y es un estado del ciclo
   * (`BOOKING_IN_PROGRESS`, `booking-status.ts`): no se agrega ninguna bandera
   * en el cliente, que se desincronizaria en cuanto alguien atienda desde otra
   * pestana.
   *
   * ## Los tres niveles del contrato del servidor (regla 65)
   *
   * `POST /scheduling/bookings/:id/start` **no valida nada en el manejador
   * simulado**: transiciona a «en curso» sea cual sea el estado anterior y haya
   * o no otra consulta abierta (`core/mock/handlers/scheduling.handlers.ts:301`
   * y `:308`). Es una brecha del contrato, no una funcionalidad: el freno del
   * cliente **no reemplaza** la validacion del servidor (regla 95.6.1), y por
   * eso aca se ejercita el camino del 409 contra un doble del endpoint,
   * declarado como tal. Lo que queda pendiente de verificar contra el servidor
   * real es que el 409 exista; lo que queda verificado es que si llega, la
   * pantalla lo trata bien y no deja la segunda cita cambiada.
   */
  describe('una sola consulta a la vez (C-11)', () => {
    /** Dos citas de la ventana: una en curso y otra confirmada. */
    async function conUnaEnCursoYOtraConfirmada(): Promise<void> {
      await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
      await responderRecursos();
      primeraPeticion('/scheduling/bookings').flush({
        items: [
          { ...CITA, id: 'b-curso', statusConceptId: 'c-curso', reasonText: 'Dolor de pecho' },
          { ...CITA, id: 'b-otra', statusConceptId: 'c-confirmada' },
        ],
        count: 2,
        limit: 100,
        truncated: false,
      });
      primeraPeticion('/scheduling/slots').flush({ items: [], count: 0, limit: 100, truncated: false });
      primeraPeticion('/terminology/concepts').flush({
        items: [
          { conceptId: 'c-curso', code: 'BOOKING_IN_PROGRESS', display: 'En curso', codeSystemVersionId: 'csv-1' },
          { conceptId: 'c-confirmada', code: 'BOOKING_CONFIRMED', display: 'Confirmada', codeSystemVersionId: 'csv-1' },
        ],
        count: 2,
        limit: 200,
      });
      harness.detectChanges();
    }

    function laCita(id: string): unknown {
      return (citas().data ?? []).find((c) => (c as { id: string }).id === id);
    }

    it('reconoce cual es la consulta en curso, del estado del ciclo y no de una bandera', async () => {
      await conUnaEnCursoYOtraConfirmada();

      const enCurso = interno<() => { id: string } | null>('consultaEnCurso')();
      expect(enCurso?.id).toBe('b-curso');
    });

    it('con una en curso, iniciar OTRA no la inicia y dice cual esta abierta', async () => {
      await conUnaEnCursoYOtraConfirmada();
      const confirmar = vi
        .spyOn(TestBed.inject(DialogService), 'confirm')
        .mockResolvedValue(false);

      interno<(c: unknown) => void>('iniciarAtencion')(laCita('b-otra'));
      await harness.fixture.whenStable();

      // Nada salio a la red: el `http.verify()` del afterEach lo confirma.
      const config = confirmar.mock.calls[0]?.[0];
      expect(config?.title).toContain('Ya tenés una consulta en curso');
      // «Paciente asignado» y no el nombre: esta sesión no tiene permiso de
      // padrón, y la compuerta del nombre es la misma de siempre. Lo que el
      // aviso tiene que decir es CUÁL está abierta, no quién es.
      expect(config?.details).toContainEqual({ label: 'En curso con', value: 'Paciente asignado' });
      expect(config?.details).toContainEqual({ label: 'Motivo', value: 'Dolor de pecho' });
      expect(config?.details?.map((d) => d.label)).toContain('Desde');
      expect(config?.confirmLabel).toBe('Ir a la consulta abierta');
      // Y la segunda NO cambio de estado.
      expect((laCita('b-otra') as { estado: { code: string } }).estado.code).toBe(
        'BOOKING_CONFIRMED',
      );
    });

    it('y ofrece SALIR a la que esta abierta, no solo frenar', async () => {
      await conUnaEnCursoYOtraConfirmada();
      vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      interno<(c: unknown) => void>('iniciarAtencion')(laCita('b-otra'));
      await harness.fixture.whenStable();

      expect(navegar).toHaveBeenCalledTimes(1);
      const [ruta, extras] = navegar.mock.calls[0] as [string[], { queryParams: unknown }];
      expect(ruta[0]).toMatch(/consultation$/);
      // Con los datos de la ABIERTA, no los de la que se quiso iniciar.
      expect(extras.queryParams).toEqual(
        (laCita('b-curso') as { paramsDeLaAtencion: unknown }).paramsDeLaAtencion,
      );
    });

    it('sin ninguna en curso, iniciar arranca normalmente', async () => {
      // El nivel CORRECTO del contrato: sin conflicto, el camino es el de
      // siempre y el freno no molesta.
      await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
      await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      expect(interno<() => unknown>('consultaEnCurso')()).toBeNull();
      interno<(c: unknown) => void>('iniciarAtencion')(citas().data?.[0]);

      http.expectOne('/scheduling/bookings/b-1/start').flush({
        bookingId: 'b-1',
        statusConceptId: 'c-curso',
        occurredAt: '2026-08-15T12:00:00.000Z',
      });
      await harness.fixture.whenStable();
      expect(navegar).toHaveBeenCalledTimes(1);
    });

    it('NIVEL INVALIDO · si el servidor responde 409 igual, se dice y no se navega', async () => {
      // El doble: el manejador simulado NO valida esto, asi que el 409 se
      // fabrica aca para ejercitar el camino. Queda declarado como simulacion;
      // lo que falta verificar contra el servidor real es que el 409 exista.
      await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
      await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const avisarError = vi.spyOn(TestBed.inject(ToastService), 'error');

      interno<(c: unknown) => void>('iniciarAtencion')(citas().data?.[0]);
      http.expectOne('/scheduling/bookings/b-1/start').flush(
        { message: 'Ya hay una consulta en curso para este profesional.' },
        { status: 409, statusText: 'Conflict' },
      );
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(navegar).not.toHaveBeenCalled();
      expect(avisarError).toHaveBeenCalledTimes(1);
      const [mensaje] = avisarError.mock.calls[0] as [string];
      expect(mensaje).toContain('No se pudo iniciar la atención');
      // Y la cita sigue confirmada: un 409 no la deja «en curso» en la pantalla.
      expect((citas().data?.[0] as { estado: { code: string } }).estado.code).toBe(
        'BOOKING_CONFIRMED',
      );
    });
  });

  /**
   * C-04 (2026-09-20) — «las tarjetas de /schedule llevan a iniciar el
   * encuentro».
   *
   * La tarjeta no repite un botón: hace lo que la cita admite en su estado, y
   * el estado sale del ciclo (`booking-status.ts`), no de una bandera nueva.
   */
  describe('la tarjeta del calendario lleva a atender (C-04)', () => {
    /** Activa la tarjeta como lo hace el día, con la reserva cruda. */
    function tocarLaTarjeta(): void {
      const cruda = { ...CITA, statusConceptId: 'c-estado', bookableSlotId: CUPO.id };
      interno<(b: unknown) => void>('atenderDesdeLaTarjeta')(cruda);
    }

    it('una cita CONFIRMADA se inicia y se entra a atender', async () => {
      await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
      await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      tocarLaTarjeta();
      http.expectOne('/scheduling/bookings/b-1/start').flush({
        bookingId: 'b-1',
        statusConceptId: 'c-curso',
        occurredAt: '2026-08-15T12:00:00.000Z',
      });
      await harness.fixture.whenStable();

      expect(navegar).toHaveBeenCalledTimes(1);
      const [ruta] = navegar.mock.calls[0] as [string[]];
      expect(ruta[0]).toMatch(/\/medical-records\/[^/]+\/consultation$/);
    });

    it('una cita EN CURSO se continúa, sin repetir la transición', async () => {
      await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
      await responderConEstado('BOOKING_IN_PROGRESS', 'En curso');
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      tocarLaTarjeta();
      await harness.fixture.whenStable();

      expect(navegar).toHaveBeenCalledTimes(1);
      // Y no salió ninguna petición: `start` sobre una en curso es un 409.
      // El `http.verify()` del afterEach lo confirma.
    });

    it('una SOLICITUD sin aceptar no navega: abre su detalle y dice por qué', async () => {
      await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' });
      await responderConEstado('BOOKING_PENDING_CONFIRMATION', 'Por confirmar');
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const confirmar = vi
        .spyOn(TestBed.inject(DialogService), 'confirm')
        .mockResolvedValue(false);

      tocarLaTarjeta();
      await harness.fixture.whenStable();

      expect(navegar).not.toHaveBeenCalled();
      const config = confirmar.mock.calls[0]?.[0];
      expect(config?.title).toContain('todavía no se atiende');
      expect(config?.message).toContain('aceptala primero');
    });

    it('sin permiso de expediente la atención se inicia igual, y se DICE que no se entró', async () => {
      // `rutaAtencion` es `null` sin permiso de expedientes: antes esto era
      // silencioso —la cita cambiaba de estado y la pantalla se quedaba igual—.
      await montar({ roles: ['SCHEDULING_ADMIN'] });
      await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      // El contenedor de avisos no se monta en esta prueba —vive en el
      // armazón—, así que el mensaje se mira donde se emite.
      const avisar = vi.spyOn(TestBed.inject(ToastService), 'info');

      expect(interno<() => boolean>('puedeVerExpedientes')()).toBe(false);
      tocarLaTarjeta();
      http.expectOne('/scheduling/bookings/b-1/start').flush({
        bookingId: 'b-1',
        statusConceptId: 'c-curso',
        occurredAt: '2026-08-15T12:00:00.000Z',
      });
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(navegar).not.toHaveBeenCalled();
      expect(avisar).toHaveBeenCalledTimes(1);
      const [mensaje, titulo] = avisar.mock.calls[0] as [string, string];
      expect(titulo).toBe('No se pudo entrar a atender');
      expect(mensaje).toContain('no puede abrir expedientes');
      expect(mensaje).toContain('La atención quedó iniciada');
      // Y la lista se releyó: la cita quedó iniciada y tiene que verse.
      for (const req of http.match(() => true)) {
        req.flush({ items: [], count: 0, limit: 100, truncated: false });
      }
    });
  });

  it('una cita en curso ofrece completarla, y solo eso', async () => {
    await montar();
    await responderConEstado('BOOKING_IN_PROGRESS', 'En curso');
    await verSolapaDeCitas();

    expect(boton('agenda-completar')).not.toBeNull();
    expect(boton('agenda-iniciar')).toBeNull();
    // En curso ya no se cancela ni se mueve: el backend tampoco lo acepta.
    expect(boton('agenda-cancelar')).toBeNull();

    interno<(c: unknown) => void>('completarCita')(citas().data?.[0]);
    await harness.fixture.whenStable();

    const req = http.expectOne('/scheduling/bookings/b-1/complete');
    req.flush({
      bookingId: 'b-1',
      statusConceptId: 'c-completada',
      occurredAt: '2026-08-15T12:30:00.000Z',
    });
    responderResto();
  });

  it('una cita completada no ofrece ninguna acción', async () => {
    await montar();
    await responderConEstado('BOOKING_COMPLETED', 'Completada');

    expect(boton('agenda-aceptar')).toBeNull();
    expect(boton('agenda-iniciar')).toBeNull();
    expect(boton('agenda-completar')).toBeNull();
    expect(boton('agenda-cancelar')).toBeNull();
  });

  /* ========================================================================
     P8 · «el médico se demora» (registro del cliente 3.5 y 4.2)
     ======================================================================== */

  /** Acceso tipado a lo que las pruebas de la demora ejercen. */
  function demora() {
    return componente as unknown as {
      abrirDemoraDeAgenda(): void;
      abrirDemoraDeCita(cita: { id: string }): void;
      cerrarDemora(): void;
      confirmarDemora(): void;
      minutosDeDemora: { set(v: string): void };
      mensajeDeDemora: { set(v: string): void };
      panelDeDemoraAbierto(): boolean;
      puedeAvisarDemora(): boolean;
    };
  }

  it('ofrece avisar demora cuando hay una agenda que mirar', async () => {
    await montar();
    await responder();
    harness.detectChanges();

    expect(demora().puedeAvisarDemora()).toBe(true);
    expect(boton('agenda-avisar-demora')).not.toBeNull();
  });

  it('el panel está cerrado hasta que se pide', async () => {
    await montar();
    await responder();
    harness.detectChanges();

    expect(demora().panelDeDemoraAbierto()).toBe(false);
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="agenda-demora-panel"]'),
    ).toBeNull();
  });

  it('la demora de la agenda avisa por recurso y no mueve ningún turno', async () => {
    await montar();
    await responder();
    harness.detectChanges();

    demora().abrirDemoraDeAgenda();
    harness.detectChanges();
    expect(demora().panelDeDemoraAbierto()).toBe(true);

    demora().minutosDeDemora.set('30');
    demora().mensajeDeDemora.set('  Estoy en una urgencia  ');
    demora().confirmarDemora();

    const req = http.expectOne('/scheduling/resources/r-1/delay');
    expect(req.request.method).toBe('POST');
    // El mensaje viaja recortado y sin ventana: la de por omisión —de ahora al
    // fin del día— la pone el servidor.
    expect(req.request.body).toEqual({
      delayMinutes: 30,
      message: 'Estoy en una urgencia',
    });

    req.flush({ notified: 2, affected: 2, bookingIds: ['b-1'], detail: 'ok' });
    harness.detectChanges();

    // No se reprograma nada: la agenda sólo se relee para reflejar la demora.
    expect(demora().panelDeDemoraAbierto()).toBe(false);
    responderResto();
  });

  it('la demora de un turno concreto pega al endpoint de la cita', async () => {
    await montar();
    await responder();
    harness.detectChanges();

    demora().abrirDemoraDeCita({ id: 'b-1' });
    demora().minutosDeDemora.set('15');
    demora().confirmarDemora();

    const req = http.expectOne('/scheduling/bookings/b-1/delay');
    // Sin mensaje: la clave no viaja, porque `forbidNonWhitelisted` rechaza un
    // opcional declarado en `undefined`.
    expect(req.request.body).toEqual({ delayMinutes: 15 });

    req.flush({ notified: 1, affected: 1, bookingIds: ['b-1'], detail: 'ok' });
    harness.detectChanges();
    responderResto();
  });

  it('volver cierra el panel sin avisar nada', async () => {
    await montar();
    await responder();
    harness.detectChanges();

    demora().abrirDemoraDeAgenda();
    demora().cerrarDemora();
    harness.detectChanges();

    expect(demora().panelDeDemoraAbierto()).toBe(false);
    // `http.verify()` del `afterEach` comprueba que no salió ninguna petición.
  });

  /**
   * LA TABLA DE SOLICITUDES — TAREA-13, punto 1.
   *
   * Lo que fijan estas pruebas es la mitad del pedido que no es cosmética:
   * **separar lo que espera respuesta de lo que ya está agendado**, y que
   * responder una solicitud tenga **un solo lugar**. La ficha advertía que
   * separarlas «duplica el lugar donde se responde una solicitud si la solapa
   * queda como está», y eso es justo lo que no puede pasar.
   */
  describe('la tabla de solicitudes', () => {
    function filas(nombre: 'solicitudes' | 'citasAgendadas') {
      return interno<() => { status: string; data?: readonly Record<string, unknown>[] }>(
        nombre,
      )();
    }

    it('separa lo que espera respuesta de lo que ya está agendado', async () => {
      await montar();
      await responderRecursos();
      responderResto({
        citas: [
          { ...CITA, id: 'b-1', statusConceptId: 'c-confirmada' },
          { ...CITA, id: 'b-2', statusConceptId: 'c-pendiente' },
        ],
      });

      expect(filas('solicitudes').data?.map((f) => f['id'])).toEqual(['b-2']);
      // Y la contraparte: la solicitud NO aparece también en «Citas». Si
      // apareciera, habría dos lugares para aceptar la misma cita.
      expect(filas('citasAgendadas').data?.map((f) => f['id'])).toEqual(['b-1']);
    });

    it('trae la fecha de solicitud, que ninguna pantalla mostraba', async () => {
      // Es `created_at`, que la lectura ya devolvía. La columna del punto 1 no
      // necesitó tocar la API.
      await montar();
      await responderRecursos();
      responderResto({ citas: [{ ...CITA, statusConceptId: 'c-pendiente' }] });

      const fila = filas('solicitudes').data?.[0] as Record<string, unknown>;
      expect(fila['solicitada']).toBeInstanceOf(Date);
      expect((fila['solicitada'] as Date).toISOString()).toBe('2026-08-01T10:00:00.000Z');
    });

    it('las dos tablas comparten el estado: si una falla, la otra no finge', async () => {
      // Salen de la MISMA lectura. Partirlas no puede hacer que una diga
      // «no hay nada» mientras la otra dice «no se pudo leer».
      await montar();
      await responderRecursos();
      http.expectOne((r) => r.url === '/scheduling/bookings').flush(
        { message: 'boom' },
        { status: 500, statusText: 'Server Error' },
      );
      http
        .expectOne((r) => r.url === '/scheduling/slots')
        .flush({ items: [], count: 0, limit: 100, truncated: false });
      // La lectura de terminología no llega a pedirse: sin citas no hay
      // conceptos que resolver. Esperarla acá sería fijar un detalle de
      // implementación en vez del comportamiento que importa.

      expect(filas('solicitudes').status).toBe(filas('citasAgendadas').status);
      expect(filas('solicitudes').status).not.toBe('ready');
    });

    it('el rótulo cuenta sólo las que esperan respuesta', async () => {
      await montar();
      await responderRecursos();
      responderResto({
        citas: [
          { ...CITA, id: 'b-1', statusConceptId: 'c-confirmada' },
          { ...CITA, id: 'b-2', statusConceptId: 'c-pendiente' },
        ],
      });

      // Las dos van a la MISMA lista (ALV-019): el rótulo cuenta las dos.
      expect(interno<() => string>('rotuloDeConsultas')()).toBe('Consultas (2)');
      // Lo que espera respuesta sigue contándose: es el aviso de arriba.
      expect(interno<() => number>('cuantasEsperanRespuesta')()).toBe(1);
    });

    it('`vista=cupos` llega a los cupos con y sin «Mis horarios» en el medio', async () => {
      // Los enlaces que ya existen no se rompen, y el índice **depende del
      // rol**: quien atiende tiene Calendario y «Mis horarios» antes, así que
      // sus cupos son el 3; quien reparte turnos no los tiene y sus cupos son
      // el 1. Fijar el número suelto escondía esa diferencia.
      await montar({}, '/schedule?vista=cupos');
      await responder();

      expect(interno<() => number>('pestana')()).toBe(1);
    });

    /**
     * C-10 (2026-09-20) — con agenda propia **no hay solapa de cupos**.
     *
     * La prueba anterior fijaba que `vista=cupos` fuera la última de cuatro.
     * El requisito cambió: la grilla de cupos se retiró para quien tiene
     * calendario, porque el calendario ya muestra los huecos del día. El enlace
     * viejo no se rompe —cae al calendario—, pero la solapa no existe.
     */
    it('con agenda propia `vista=cupos` cae al calendario: la solapa ya no existe', async () => {
      await montar({ roles: ['PRACTITIONER'], hpid: 'hp-1' }, '/schedule?vista=cupos');
      await responderRecursos();
      responderResto();

      expect(interno<() => string>('pestanaActual')()).toBe('calendar');
      expect(interno<() => readonly string[]>('pestanas')()).toEqual(['calendar', 'schedule']);
    });
  });

  /**
   * EL ESTADO DE PAGO EN LA FILA — TAREA-13, punto 5.
   *
   * Lo que se fija acá es la regla del propietario llevada a la pantalla, y una
   * distinción que es fácil de perder al pintar: **«nadie lo marcó» no es
   * «pendiente de pago»**. Pendiente es una afirmación que alguien firmó.
   */
  describe('Agenda · el estado de pago', () => {
    it('una cita sin marca NO se muestra como pendiente', async () => {
      await montar();
      await responderRecursos();
      responderResto({ citas: [CITA] });

      const fila = citas().data?.[0] as Record<string, unknown>;
      // `null`, no un estado por defecto: la celda pinta un guión y no una
      // etiqueta que nadie escribió.
      expect(fila['pago']).toBeNull();
      expect(fila['admitePago']).toBe(true);
    });

    it('el estado marcado llega con su etiqueta del servidor', async () => {
      await montar();
      await responderRecursos();
      responderResto({
        citas: [
          {
            ...CITA,
            paymentState: {
              state: 'PARTIALLY_PAID',
              label: 'Parcialmente pagada',
              conceptId: 'c-pago-parcial',
              insuranceUsed: true,
              markedByUserId: 'u-9',
              markedAt: '2026-09-01T10:00:00.000Z',
            },
          },
        ],
      });

      const pago = (citas().data?.[0] as Record<string, unknown>)['pago'] as Record<string, unknown>;
      // La etiqueta viene del servidor: la pantalla no traduce estados.
      expect(pago['label']).toBe('Parcialmente pagada');
      // El seguro es una marca SEPARADA, no un cuarto estado.
      expect(pago['insuranceUsed']).toBe(true);
      // Y la fecha llega como Date, no como el string del cable.
      expect(pago['markedAt']).toBeInstanceOf(Date);
    });

    it('una cita cancelada no admite estado de pago', async () => {
      // La mitad excluyente de la regla del propietario. No ofrecer el botón es
      // una cortesía: la garantía es el 422 del servidor.
      await montar();
      await responderRecursos();
      responderResto({ citas: [{ ...CITA, statusConceptId: 'c-cancelada' }] });

      expect((citas().data?.[0] as Record<string, unknown>)['admitePago']).toBe(false);
    });

    it('con el estado sin resolver tampoco se ofrece', async () => {
      // Mismo criterio que las demás acciones de la fila: sobre un estado que
      // esta versión no sabe leer no se opera.
      await montar();
      await responderRecursos();
      responderResto({ citas: [{ ...CITA, statusConceptId: 'c-desconocido' }] });

      expect((citas().data?.[0] as Record<string, unknown>)['admitePago']).toBe(false);
    });
  });

  /**
   * EL MODAL DE DETALLE — TAREA-13, punto 2.
   *
   * Lo que se fija acá no es que el modal abra: es **qué muestra y qué no**. El
   * nombre del paciente tiene compuerta —la API lo manda sólo al titular y al
   * profesional de esa agenda— y un modal es justo el lugar donde es fácil
   * saltearla sin darse cuenta.
   */
  describe('el modal de detalle de una solicitud', () => {
    async function montarSolicitud(extra: Record<string, unknown> = {}): Promise<void> {
      await montar();
      await responderRecursos();
      responderResto({
        citas: [{ ...CITA, statusConceptId: 'c-pendiente', ...extra }],
      });
      // `responderResto` no pinta; los que miran el DOM necesitan el render.
      harness.detectChanges();
    }

    function fila(): Record<string, unknown> {
      return interno<() => { data?: readonly Record<string, unknown>[] }>('solicitudes')()
        .data?.[0] as Record<string, unknown>;
    }

    function detalle(): readonly { label: string; value: string }[] {
      return interno<(c: unknown) => readonly { label: string; value: string }[]>(
        'detalleDeSolicitud',
      )(fila());
    }

    it('una solicitud ofrece «ver detalle»', async () => {
      await montarSolicitud();
      expect(boton('agenda-detalle')).not.toBeNull();
    });

    it('una cita ya agendada también lo ofrece, sin «Aceptar»', async () => {
      // Toda fila lleva «Ver detalle» (propietario, 18/09): en una atendida era
      // lo único que quedaba, y sin él la columna de acciones se veía vacía.
      // Pero no se la ofrece aceptar: ya está aceptada.
      await montar();
      await responderConEstado('BOOKING_CONFIRMED', 'Confirmada');
      await verSolapaDeCitas();

      // C-06 · el nombre de la acción dejó de vivir en un `aria-label`
      // invisible y pasó a ser el TEXTO de la opción, que es el punto del
      // pedido: se lee sin lector de pantalla y sin pasar el puntero.
      const detalle = boton('agenda-detalle');
      expect(detalle?.textContent?.trim()).toContain('Ver detalle de la cita');
    });

    it('muestra el nombre del paciente cuando la API lo mandó', async () => {
      await montarSolicitud({ patientName: 'Marisol Quispe' });

      const paciente = detalle().find((d) => d.label === 'Paciente');
      expect(paciente?.value).toBe('Marisol Quispe');
    });

    it('sin nombre dice que hay paciente, NO quién es', async () => {
      // Es la misma compuerta que la celda de la tabla. Un modal que la
      // saltease filtraría la identidad de alguien a quien esa sesión no
      // atiende — y es el error fácil de cometer al armar un detalle.
      await montarSolicitud();

      const paciente = detalle().find((d) => d.label === 'Paciente');
      expect(paciente?.value).toBe('Paciente asignado');
      // Y en ninguna parte del detalle se cuela el identificador.
      expect(JSON.stringify(detalle())).not.toContain('p-1');
    });

    it('lo que falta se dice, no se omite', async () => {
      // Un dato que desaparece parece un dato que no se pidió. Acá lo que
      // importa es saber qué falta.
      await montarSolicitud({ startAt: null, endAt: null, reasonText: undefined });

      const etiquetas = detalle().map((d) => d.label);
      expect(etiquetas).toContain('Cita');
      expect(detalle().find((d) => d.label === 'Cita')?.value).toBe('Sin registrar');
      expect(detalle().find((d) => d.label === 'Motivo')?.value).toBe('Sin registrar');
    });

    it('trae los siete datos, incluido cuándo se pidió', async () => {
      await montarSolicitud();

      expect(detalle().map((d) => d.label)).toEqual([
        'Estado',
        'Paciente',
        'Solicitada',
        'Cita',
        'Hasta',
        'Profesional',
        'Motivo',
      ]);
    });
  });
});
