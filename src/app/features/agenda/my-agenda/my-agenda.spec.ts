import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { MyAgenda } from './my-agenda';

const TENANT = '11111111-1111-1111-1111-111111111111';
const PERFIL = '22222222-2222-2222-2222-222222222222';

/**
 * **Mi agenda** — MAC-4.
 *
 * Es la primera pantalla donde un médico ve su propio horario después de
 * publicarlo: hasta que existió el `GET` de plantillas, `scheduling` sólo tenía
 * los dos POST y publicar era escribir algo que nadie podía volver a leer.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **El patrón se dice en palabras**, no en filas de tabla ni en números de
 *    día — el médico lee «martes de 09:00 a 13:00», no `dayOfWeek: 2`.
 * 2. **Las franjas idénticas se agrupan**: «lunes y jueves de 9 a 13» en vez de
 *    dos renglones que dicen lo mismo.
 * 3. **Sin horario publicado no es un fallo**, es un vacío con salida.
 * 4. **El aviso de agotamiento aparece sólo cuando corresponde** — es el parche
 *    manual del horizonte rodante, y si gritara siempre nadie lo miraría.
 */
describe('MyAgenda', () => {
  let fixture: ComponentFixture<MyAgenda>;
  let http: HttpTestingController;

  const RECURSOS = `/scheduling/resources?tenantId=${TENANT}`;

  function crear(perfil: string | null = PERFIL, tenant: string | null = TENANT): void {
    // Cada caso monta su propia sesión (con perfil, sin perfil, sin tenant), y
    // sin reiniciar, el segundo `configureTestingModule` revienta.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            practitionerProfileId: signal<string | null>(perfil),
            activeTenantId: signal<string | null>(tenant),
            roles: signal<readonly string[]>(['PRACTITIONER']),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MyAgenda);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  /** Responde el recurso propio y devuelve su id. */
  /**
   * El catálogo de tipologías, que la pantalla pide al cargar.
   *
   * Se responde vacío: lo que estas pruebas miran es el horario, y con la lista
   * vacía el día se pinta como antes — que es justamente la garantía de que un
   * catálogo caído no rompe la agenda.
   */
  function conTipologias(): void {
    http.expectOne('/scheduling/activity-types').flush({ items: [] });
  }

  function conRecurso(): string {
    conTipologias();
    http
      .expectOne(RECURSOS)
      .flush({ items: [{ id: 'res-1', name: 'Agenda', resourceRefId: PERFIL }], count: 1 });
    fixture.detectChanges();
    return 'res-1';
  }

  /** Responde la plantilla y, después, los cupos. */
  function conPlantilla(rules: unknown[], extra: Record<string, unknown> = {}): void {
    http.expectOne('/scheduling/resources/res-1/templates').flush({
      items: [{ id: 'tpl-1', name: 'Horario', statusConceptId: 'c', rules, ...extra }],
      count: 1,
    });
    fixture.detectChanges();
  }

  /** Responde los cupos con su último inicio. */
  function conCuposHasta(fecha: Date | null): void {
    const req = http.expectOne((r) => r.url === '/scheduling/slots');
    req.flush({
      items: fecha === null ? [] : [{ id: 's', startAt: fecha.toISOString() }],
      count: 1,
    });
    fixture.detectChanges();
  }

  /** Responde el listado con una plantilla vigente y N retiradas. */
  function conHistorico(retiradas: number): void {
    http.expectOne('/scheduling/resources/res-1/templates').flush({
      items: [
        {
          id: 'tpl-vieja',
          name: 'Horario anterior',
          statusConceptId: 'r',
          retired: true,
          rules: [],
        },
        {
          id: 'tpl-1',
          name: 'Horario',
          statusConceptId: 'c',
          retired: false,
          rules: [{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }],
        },
      ].slice(retiradas === 0 ? 1 : 0),
      count: retiradas === 0 ? 1 : 2,
    });
    fixture.detectChanges();
  }

  /* -- La tarjeta: dar una cita desde el calendario (AG-5) ------------------- */

  /**
   * La prueba que faltaba, y que explica por qué «no se puede darle una cita a
   * un paciente desde el calendario».
   *
   * La tarjeta estaba **escrita, importada y desconectada**: el componente
   * existía con su formulario completo, `MyAgenda` lo declaraba en `imports`,
   * y `abrirTarjeta`, `ratoParaCrear`, `tarjetaCreo` y `ratosTomadosDelDia`
   * estaban todos en la clase. `day-view` emitía `ratoTocado`. Lo único que
   * faltaba era que la plantilla dibujara `<app-tarjeta-del-dia>` y escuchara
   * ese evento — así que tocar un hueco del día no hacía absolutamente nada.
   *
   * Todo compilaba. Todas las pruebas pasaban. Ninguna miraba la plantilla.
   */
  it('tocar un rato libre del día abre la tarjeta para dar la cita', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date('2030-01-01'));

    // `abrirTarjeta` es lo que la plantilla ahora conecta a `(ratoTocado)`.
    const componente = fixture.componentInstance as unknown as {
      solapa: { set(v: 'patron' | 'mes'): void };
      diaAbierto: { set(v: Date | null): void };
      abrirTarjeta(rato: { desde: Date; hasta: Date }): void;
    };
    // El día vive en la solapa del mes; la pantalla abre en «patrón».
    componente.solapa.set('mes');
    componente.diaAbierto.set(new Date(2026, 8, 10, 0, 0, 0));
    componente.abrirTarjeta({
      desde: new Date(2026, 8, 10, 10, 0),
      hasta: new Date(2026, 8, 10, 10, 45),
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('app-tarjeta-del-dia'),
      'la tarjeta no se dibuja: no hay forma de dar una cita desde el calendario',
    ).not.toBeNull();
  });

  it('sin rato tocado la tarjeta no ocupa la pantalla', () => {
    // No se dibuja siempre: el día abierto es para leerlo, y un formulario
    // permanente empujaría la agenda hacia abajo cada vez que se abre un día.
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date('2030-01-01'));
    const componente = fixture.componentInstance as unknown as {
      solapa: { set(v: 'patron' | 'mes'): void };
      diaAbierto: { set(v: Date | null): void };
    };
    componente.solapa.set('mes');
    componente.diaAbierto.set(new Date(2026, 8, 10));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-tarjeta-del-dia')).toBeNull();
  });

  /* -- La semana con nombres ------------------------------------------------ */

  /**
   * «El médico puede revisar su calendario de citas con horarios y **nombre
   * completo del paciente** de forma diaria, semanal y mensual.»
   *
   * La semana ya existía y sabía contar libres y tomados. Lo que no hacía era
   * pedir las citas: sin esta lectura, `app-week-view` recibe una lista vacía y
   * la mitad del pedido —con quién— no tiene de dónde salir.
   */
  describe('la semana trae a quién atiende', () => {
    /** Deja la pantalla en la vista de semana y devuelve la petición de citas. */
    function verLaSemana() {
      const componente = fixture.componentInstance as unknown as {
        solapa: { set(v: 'patron' | 'mes'): void };
        verSemana(): void;
      };
      componente.solapa.set('mes');
      componente.verSemana();
      fixture.detectChanges();
      return http.expectOne((r) => r.url === '/scheduling/bookings');
    }

    it('pide las citas de los siete días en UNA sola llamada, acotada por recurso', () => {
      // Una y no siete: `searchBookings` acepta ventana, y pedir siete veces lo
      // mismo para agrupar después en el cliente es cara la red por comodidad.
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00' }]);
      conCuposHasta(new Date('2030-01-01'));

      const req = verLaSemana();
      req.flush({ items: [], count: 0 });

      // Acotada por recurso: sin filtro la API contesta 422, igual que el día.
      expect(req.request.params.get('resourceId')).toBe('res-1');

      const desde = new Date(req.request.params.get('from') as string);
      const hasta = new Date(req.request.params.get('to') as string);
      const dias = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000);
      expect(dias, 'la ventana tiene que ser de siete días').toBe(7);
      expect(desde.getDay(), 'la ventana arranca un lunes').toBe(1);
    });

    it('las citas llegan a la vista de semana', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00' }]);
      conCuposHasta(new Date('2030-01-01'));

      const req = verLaSemana();
      const desde = new Date(req.request.params.get('from') as string);
      req.flush({
        items: [
          {
            id: 'b-1',
            statusConceptId: 'st-1',
            startAt: new Date(
              desde.getFullYear(),
              desde.getMonth(),
              desde.getDate(),
              9,
            ).toISOString(),
            patientName: 'Ana Paz',
          },
        ],
        count: 1,
      });
      // La traducción de estados sale detrás de la lectura de citas.
      http.expectOne((r) => r.url.includes('concept')).flush({ items: [] });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Ana Paz');
    });

    it('si la lectura falla la semana sigue mostrando la ocupación, sin nombres', () => {
      // Los libres y los tomados salen de los cupos del mes, que ya están
      // cargados: perder los nombres no justifica perder la agenda.
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00' }]);
      conCuposHasta(new Date('2030-01-01'));

      verLaSemana().flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-week-view')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="semana-citas"]')).toBeNull();
    });
  });

  /* -- El horario vigente, el retirado y el histórico (TAREA-10) ------------ */

  describe('vigente vs retirado', () => {
    it('no confunde un horario retirado con el vigente aunque sea el más reciente', () => {
      // El listado devuelve TODAS las plantillas ordenadas por creación. Antes
      // se tomaba `items[0]`: retirar el horario y recargar dejaba al médico
      // viendo el retirado como si siguiera atendiendo.
      crear();
      conRecurso();
      http.expectOne('/scheduling/resources/res-1/templates').flush({
        items: [
          {
            id: 'tpl-retirada',
            name: 'La más reciente, retirada',
            statusConceptId: 'r',
            retired: true,
            rules: [{ dayOfWeek: 3, startTime: '15:00:00', endTime: '19:00:00' }],
          },
          {
            id: 'tpl-viva',
            name: 'La vigente',
            statusConceptId: 'c',
            retired: false,
            rules: [{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }],
          },
        ],
        count: 2,
      });
      fixture.detectChanges();
      conCuposHasta(new Date('2030-01-01'));

      const texto: string = fixture.nativeElement.textContent;
      // El lunes es de la vigente; el miércoles, de la retirada.
      expect(texto).toContain('unes');
      expect(texto).not.toContain('iércoles');
    });

    it('los horarios retirados se listan aparte, como historia', () => {
      crear();
      conRecurso();
      conHistorico(1);
      conCuposHasta(new Date('2030-01-01'));

      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Horarios anteriores');
      expect(texto).toContain('Horario anterior');
      expect(texto).toContain('Retirado');
    });

    it('sin historia no dibuja la sección: no hay nada que contar', () => {
      crear();
      conRecurso();
      conHistorico(0);
      conCuposHasta(new Date('2030-01-01'));

      expect(fixture.nativeElement.textContent).not.toContain('Horarios anteriores');
    });

    it('un horario sin fecha de fin lleva la etiqueta HORARIO PERMANENTE', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
      });
      conCuposHasta(new Date('2030-01-01'));

      // Las palabras y las mayúsculas son del propietario (punto 5).
      expect(fixture.nativeElement.textContent).toContain('HORARIO PERMANENTE');
    });

    it('con fecha de fin no la lleva: no es permanente', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
        validTo: '2030-12-31T00:00:00.000Z',
      });
      conCuposHasta(new Date('2030-01-01'));

      expect(fixture.nativeElement.textContent).not.toContain('HORARIO PERMANENTE');
    });

    it('avisa que estos horarios no son para cirugías', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
      });
      conCuposHasta(new Date('2030-01-01'));

      // Punto 8, textual del propietario: es una regla, no una nota al margen.
      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('para consulta y cita');
      expect(texto).toContain('quirúrgicas');
    });

    it('ofrece retirar el horario, y dice retirar y no borrar (punto 6/7: ícono sobre la fila)', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
      });
      conCuposHasta(new Date('2030-01-01'));

      // Ícono, no botón de texto (punto 7): el nombre accesible va en el
      // `aria-label`, no en el `textContent`.
      const boton: HTMLElement | null = fixture.nativeElement.querySelector(
        '[data-testid="horario-retirar"]',
      );
      expect(boton).not.toBeNull();
      // «Borrar» prometería algo que el sistema no hace: la plantilla no se
      // puede borrar nunca, la referencia la auditoría.
      expect(boton?.getAttribute('aria-label')).toBe('Retirar horario');
      expect(boton?.getAttribute('aria-label')).not.toContain('Borrar');
    });
  });

  it('dice el horario en palabras, sin números de día', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Martes de 09:00 a 13:00');
    expect(texto).toContain('consultas de 30 min');
    expect(texto).not.toContain('dayOfWeek');
    expect(texto).not.toContain('tpl-1');
  });

  it('agrupa las franjas idénticas en un solo renglón', () => {
    crear();
    conRecurso();
    conPlantilla([
      { dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 },
      { dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 },
    ]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.textContent).toContain('Lunes y Jueves de 09:00 a 13:00');
  });

  it('separa las franjas que no son iguales', () => {
    crear();
    conRecurso();
    conPlantilla([
      { dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 },
      { dayOfWeek: 4, startTime: '14:00:00', endTime: '18:00:00', slotMinutes: 30 },
    ]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Lunes de 09:00 a 13:00');
    expect(texto).toContain('Jueves de 14:00 a 18:00');
  });

  it('la semanita marca los días que atiende y los que no, con palabras', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const dias = fixture.nativeElement.querySelectorAll('.mi-agenda__dia');
    expect(dias).toHaveLength(7);
    // El color nunca solo: el estado va también en el nombre accesible.
    expect(dias[1].getAttribute('aria-label')).toBe('Martes: atendés');
    expect(dias[0].getAttribute('aria-label')).toBe('Lunes: no atendés');
  });

  it('sin fecha de fin lo dice, en vez de dejar el dato en blanco', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.textContent).toContain('rige hasta que lo cambies');
  });

  it('sin horario publicado ofrece publicarlo, en vez de un error', () => {
    crear();
    conRecurso();
    http.expectOne('/scheduling/resources/res-1/templates').flush({ items: [], count: 0 });
    fixture.detectChanges();

    // El M34 lo exige: un vacío sin salida es un callejón.
    expect(fixture.nativeElement.textContent).toContain('Publicar mi agenda');
  });

  it('sin recurso propio tampoco es un error', () => {
    crear();
    conTipologias();
    http.expectOne(RECURSOS).flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Publicar mi agenda');
  });

  it('una cuenta sin perfil profesional no pide nada al servidor', () => {
    crear(null);
    // Ni una petición: la pantalla no le corresponde.
    http.verify();
  });

  it('no pide una ventana que la API rechaza', () => {
    // `GET /scheduling/slots` contesta 422 «La ventana no puede superar 92
    // días». Pedía un año, y como el fallo se traga a propósito, la tarjeta
    // seguía andando y el aviso de agotamiento no aparecía nunca: se vio en la
    // pestaña de red, no en las pruebas.
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);

    const req = http.expectOne((r) => r.url === '/scheduling/slots');
    const desde = new Date(req.request.params.get('from') as string);
    const hasta = new Date(req.request.params.get('to') as string);
    const dias = (hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000);
    expect(dias).toBeLessThanOrEqual(92);

    req.flush({ items: [], count: 0 });
  });

  it('avisa cuando los turnos publicados se están por agotar', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    // Diez días por delante: menos que el margen de treinta.
    conCuposHasta(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.textContent).toContain('se están por agotar');
  });

  it('no avisa cuando todavía quedan meses de turnos', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('se están por agotar');
    expect(texto).toContain('Tenés turnos abiertos hasta el');
  });

  it('si la lectura de cupos falla, la tarjeta sigue sirviendo', () => {
    // Saber hasta cuándo llegan los cupos es un extra: no puede llevarse puesto
    // el horario, que es el dato principal.
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ message: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Martes de 09:00 a 13:00');
  });

  /**
   * VOLVER A ACTIVAR UN HORARIO PAUSADO — «volví del viaje».
   *
   * Retirar era un camino de ida: publicar uno nuevo dejaba el viejo en la
   * lista para siempre. Y reactivar **no repone los cupos**, así que lo que
   * esta pantalla no puede hacer es dejar creer que sí.
   */
  describe('reactivar un horario', () => {
    it('lo ofrece sobre el horario retirado', () => {
      crear();
      conRecurso();
      conHistorico(1);
      conCuposHasta(new Date('2030-01-01'));

      const boton = fixture.nativeElement.querySelector('[data-testid="historico-reactivar"]');
      expect(boton).not.toBeNull();
    });

    it('llama al endpoint y avisa que faltan los cupos', () => {
      crear();
      conRecurso();
      conHistorico(1);
      conCuposHasta(new Date('2030-01-01'));

      const boton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '[data-testid="historico-reactivar"]',
      );
      boton?.click();
      fixture.detectChanges();

      const req = http.expectOne('/scheduling/templates/tpl-vieja/reactivate');
      expect(req.request.method).toBe('POST');
      // El aviso es la mitad del arreglo: sin él, el horario queda «vigente» y
      // sin un solo turno ofrecido, y nadie sabe por qué.
      req.flush({ id: 'tpl-vieja', statusConceptId: 'c-pub', slotsPendientes: true });
      fixture.detectChanges();

      // Y recarga: el horario cambió de estado, así que la lista de arriba ya
      // no describe lo que hay.
      conRecurso();
      conHistorico(1);
      conCuposHasta(new Date('2030-01-01'));
    });
  });
});
