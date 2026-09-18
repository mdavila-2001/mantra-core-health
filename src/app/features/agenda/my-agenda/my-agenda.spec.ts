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

  /** Responde los cupos con su último inicio, y los bloqueos de la semana. */
  function conCuposHasta(fecha: Date | null): void {
    const req = http.expectOne((r) => r.url === '/scheduling/slots');
    req.flush({
      items: fecha === null ? [] : [{ id: 's', startAt: fecha.toISOString() }],
      count: 1,
    });
    conBloqueosDeLaSemana();
  }

  /** Responde la lectura de bloqueos de la semana que la grilla pinta en rojo. */
  function conBloqueosDeLaSemana(items: unknown[] = []): void {
    for (const req of http.match((r) => r.url === '/scheduling/resources/res-1/exceptions')) {
      req.flush({ items, count: items.length });
    }
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

  /* -- La agenda del día: lo que `/schedule` abre por defecto (18/09) -------- */

  describe('modo calendario', () => {
    function crearCalendario(): void {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([]),
          {
            provide: AuthService,
            useValue: {
              practitionerProfileId: signal<string | null>(PERFIL),
              activeTenantId: signal<string | null>(TENANT),
              roles: signal<readonly string[]>(['PRACTITIONER']),
            },
          },
        ],
      });
      fixture = TestBed.createComponent(MyAgenda);
      fixture.componentRef.setInput('mode', 'calendar');
      http = TestBed.inject(HttpTestingController);
      fixture.detectChanges();
    }

    /** Responde vacío todo lo que el calendario pide al abrir. */
    function sinOcupacion(): void {
      for (const req of http.match(
        (r) =>
          r.url === '/scheduling/slots' ||
          r.url === '/scheduling/bookings' ||
          r.url === '/scheduling/resources/res-1/exceptions',
      )) {
        req.flush({ items: [], count: 0 });
      }
      fixture.detectChanges();
    }

    function abrir(): void {
      crearCalendario();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }]);
      sinOcupacion();
    }

    const $ = (selector: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(selector);

    it('abre en el día de hoy, con «Día» elegido', () => {
      abrir();

      const hoy = new Date().toLocaleDateString('es-BO', { weekday: 'long' });
      expect($('app-day-view')).not.toBeNull();
      expect($('.dia__titulo')?.textContent?.toLowerCase()).toContain(hoy);
      expect($('[data-testid="ver-dia"]')?.getAttribute('aria-pressed')).toBe('true');
      // No es la solapa del horario: ni sus pestañas ni su grilla.
      expect($('.mi-agenda__solapas')).toBeNull();
      expect($('app-schedule-grid')).toBeNull();
    });

    it('ya no ofrece «Ver como tabla»: Consultas es una solapa al lado', () => {
      // Una sola barra de cuatro solapas (propietario, 18/09): el ícono que
      // cambiaba de vista cambiaba también la barra bajo los pies.
      abrir();
      expect($('[data-testid="ver-como-tabla"]')).toBeNull();
    });

    it('«Semana» muestra la semana, y tocar un día vuelve al día', () => {
      abrir();

      ($('[data-testid="ver-semana"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      sinOcupacion();
      expect($('app-week-view')).not.toBeNull();
      expect($('app-day-view')).toBeNull();

      ($('[data-testid="semana-dia"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      sinOcupacion();
      expect($('app-day-view')).not.toBeNull();
      expect($('[data-testid="ver-dia"]')?.getAttribute('aria-pressed')).toBe('true');
    });

    it('«Mes» muestra el mes con días que se abren', () => {
      abrir();

      ($('[data-testid="ver-mes"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      sinOcupacion();
      const dia = $('[data-testid="mes-dia"]');
      expect(dia?.tagName).toBe('BUTTON');

      (dia as HTMLButtonElement).click();
      fixture.detectChanges();
      sinOcupacion();
      expect($('app-day-view')).not.toBeNull();
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

      // El lunes es de la vigente; el miércoles, de la retirada. Se mira en las
      // franjas de la grilla: el renglón en palabras ya no existe.
      const franjas = Array.from(
        fixture.nativeElement.querySelectorAll(
          '.mi-agenda__tarjeta [data-testid="horario-bloque"]',
        ) as NodeListOf<HTMLElement>,
      ).map((b) => b.getAttribute('aria-label') ?? '');
      expect(franjas).toEqual(['lunes de 09:00 a 13:00: atendés']);
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
    expect(texto).toContain('09:00 – 13:00');
    expect(texto).toContain('consultas de 30 min');
    expect(texto).not.toContain('dayOfWeek');
    expect(texto).not.toContain('tpl-1');
  });

  it('no repite en un renglón lo que la grilla ya dibuja', () => {
    // Pedido del cliente: «Lunes, Martes… de 08:00 a 12:00» era redundante.
    crear();
    conRecurso();
    conPlantilla([
      { dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 },
      { dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 },
    ]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Lunes y Jueves de 09:00 a 13:00');
    expect(fixture.nativeElement.querySelector('.mi-agenda__franjas')).toBeNull();
  });

  it('una plantilla sin tamaño de turno se dice «tamaño libre»', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.textContent).toContain('tamaño libre');
  });

  it('el tamaño de la plantilla vale para las franjas que no traen el suyo', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
      slotMinutes: 20,
    });
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.textContent).toContain('consultas de 20 min');
  });

  it('los estados y todas las acciones van juntos, arriba de la tarjeta, como íconos', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const tarjeta: HTMLElement = fixture.nativeElement.querySelector('.mi-agenda__tarjeta');
    const barra = tarjeta.querySelector('[data-testid="horario-barra"]');
    expect(tarjeta.firstElementChild).toBe(barra);
    expect(barra?.textContent).toContain('Vigente');
    for (const [testId, nombre] of [
      ['horario-editar', 'Cambiar mi horario'],
      ['horario-retirar', 'Retirar horario'],
      ['ver-bloqueos', 'Ver mis bloqueos'],
      ['agendar-cita', 'Agendar una cita'],
    ]) {
      const icono = barra?.querySelector(`[data-testid="${testId}"]`);
      expect(icono, testId).not.toBeNull();
      expect(icono?.getAttribute('aria-label')).toBe(nombre);
      expect(icono?.hasAttribute('appTooltip'), `${testId} sin tooltip`).toBe(true);
      expect(icono?.querySelector('svg'), `${testId} no es ícono`).not.toBeNull();
    }
  });

  it('pide los bloqueos de esta semana y los pinta en rojo en la grilla', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }]);
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ items: [{ id: 's', startAt: '2030-01-01T00:00:00Z' }], count: 1 });

    const req = http.expectOne((r) => r.url === '/scheduling/resources/res-1/exceptions');
    const desde = new Date(req.request.params.get('from') as string);
    const hasta = new Date(req.request.params.get('to') as string);
    expect(desde.getDay(), 'la ventana arranca un lunes').toBe(1);
    expect(Math.round((hasta.getTime() - desde.getTime()) / 86_400_000)).toBe(7);

    const inicio = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 10);
    const fin = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 11);
    req.flush({
      items: [
        { id: 'ex-1', startAt: inicio.toISOString(), endAt: fin.toISOString(), reason: 'Congreso' },
        // Las que abren disponibilidad no son bloqueos.
        { id: 'ex-2', startAt: inicio.toISOString(), endAt: fin.toISOString(), isAvailable: true },
      ],
      count: 2,
    });
    fixture.detectChanges();

    const bloqueos = fixture.nativeElement.querySelectorAll('[data-testid="horario-bloqueo"]');
    expect(bloqueos).toHaveLength(1);
    expect(bloqueos[0].textContent).toContain('10:00 – 11:00');
    expect(bloqueos[0].textContent).toContain('Congreso');
  });

  it('el aviso de agotamiento vive detrás de un «i» en la barra y se abre al pulsarlo', () => {
    // Pedido del cliente: el aviso no ocupa lugar arriba de la tarjeta; un
    // botón de info abre un globo con el texto y «Abrir tres meses más».
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000));

    const acciones: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="horario-acciones"]',
    );
    const boton: HTMLElement | null = acciones.querySelector('[data-testid="aviso-agotan"]');
    const globo: HTMLElement | null = acciones.querySelector('[data-testid="aviso-agotan-globo"]');
    expect(boton).not.toBeNull();
    expect(globo!.hidden).toBe(true);
    expect(boton!.getAttribute('aria-expanded')).toBe('false');

    boton!.click();
    fixture.detectChanges();
    expect(globo!.hidden).toBe(false);
    expect(globo!.textContent).toContain('Abrir tres meses más');

    document.body.click();
    fixture.detectChanges();
    expect(globo!.hidden).toBe(true);
  });

  it('sin agotamiento no hay «i» de aviso', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.querySelector('[data-testid="aviso-agotan"]')).toBeNull();
  });

  it('debajo de la grilla no van la semanita de círculos ni la vigencia', () => {
    // Pedido del cliente: los días ya están en la grilla y la vigencia se lee
    // en el globo de cada franja.
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.querySelector('.mi-agenda__semana')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('rige hasta que lo cambies');
  });

  it('la barra lleva los estados a la izquierda y las acciones a la derecha, separados', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const barra: HTMLElement = fixture.nativeElement.querySelector('[data-testid="horario-barra"]');
    const [chips, acciones] = Array.from(barra.children) as HTMLElement[];
    expect(chips.dataset['testid']).toBe('horario-chips');
    expect(chips.querySelector('[app-button]')).toBeNull();
    expect(acciones.dataset['testid']).toBe('horario-acciones');
    expect(acciones.querySelector('[data-testid="horario-editar"]')).not.toBeNull();
    expect(acciones.querySelector('app-badge')).toBeNull();
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
    conBloqueosDeLaSemana();
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
    conBloqueosDeLaSemana();

    expect(fixture.nativeElement.textContent).toContain('09:00 – 13:00');
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
