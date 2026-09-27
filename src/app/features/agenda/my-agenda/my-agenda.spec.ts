import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import type { DialogConfig } from '../../../shared/components/molecules/dialog/dialog.types';
import { APPOINTMENT_NEW_ROUTE } from '../agenda.routes';
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

  /**
   * Abre el desplegable de acciones del horario y devuelve sus ítems. `app-menu`
   * muda el panel al `<body>` mientras está abierto: por eso se buscan en el
   * documento y no en el fixture.
   */
  function accionesDelHorario(): HTMLElement[] {
    cerrarAcciones();
    const disparador = document.querySelector<HTMLElement>(
      '[data-testid="horario-acciones"] [data-testid="row-actions-trigger"]',
    );
    disparador?.click();
    fixture.detectChanges();
    return [...document.querySelectorAll<HTMLElement>('app-menu [role="menuitem"]')];
  }

  function cerrarAcciones(): void {
    if (document.querySelector('app-menu [role="menuitem"]') === null) {
      return;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
  }

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

  /**
   * Responde la lectura de bloqueos que la grilla pinta en rojo (AC-C3-02).
   *
   * Con `match` y no `expectOne`: la pantalla la dispara cada vez que relee la
   * plantilla —reactivar o retirar un horario lo hace—, así que un test que
   * recarga deja dos en vuelo y `expectOne` fallaría por la segunda.
   */
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

  /* -- El selector de cuánto día se ve en la grilla (AC-C3-01) ------------- */

  it('ofrece elegir entre el horario de consulta y el día completo', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date('2030-01-01'));

    const consulta: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="grilla-rango-atencion"]',
    );
    const completo: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="grilla-rango-completo"]',
    );
    expect(consulta, 'falta el selector de rango').not.toBeNull();
    // El rótulo lleva las horas: «día completo» a secas no dice qué se gana.
    expect(completo.textContent).toContain('00:00');
    expect(completo.textContent).toContain('23:59');
    // Arranca en el día completo, que es lo único que muestra un bloqueo de
    // madrugada; y el que rige se anuncia, no sólo se pinta.
    expect(completo.getAttribute('aria-pressed')).toBe('true');
    expect(consulta.getAttribute('aria-pressed')).toBe('false');
  });

  it('elegir «horario de consulta» recorta la grilla, y se puede volver', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date('2030-01-01'));

    function filas(): number {
      return fixture.nativeElement.querySelectorAll('.grilla__hora').length;
    }
    expect(filas()).toBe(24);

    fixture.nativeElement.querySelector('[data-testid="grilla-rango-atencion"]').click();
    fixture.detectChanges();
    // De 9 a 12:59 — el fin es exclusivo, así que las 13 no cuentan.
    expect(filas()).toBe(4);

    fixture.nativeElement.querySelector('[data-testid="grilla-rango-completo"]').click();
    fixture.detectChanges();
    expect(filas()).toBe(24);
  });

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

    /**
     * Responde vacío todo lo que el calendario pide al abrir.
     *
     * Desde C-13 (2026-09-20) eso incluye las visitas de laboratorio del doctor
     * y el diccionario de conceptos que traduce sus estados: el día las dibuja
     * como tarjetas de visitador, así que el calendario las pide al montar.
     */
    function sinOcupacion(): void {
      for (const req of http.match(
        (r) =>
          r.url === '/scheduling/slots' ||
          r.url === '/scheduling/bookings' ||
          r.url === '/scheduling/resources/res-1/exceptions' ||
          r.url === '/visit-requests/inbox' ||
          r.url === '/pharma-labs/reference/concepts',
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

  /* -- La visita de laboratorio en la agenda (C-13, 2026-09-20) ------------- */

  /**
   * «Que la visita de laboratorio se vea en la misma pestana de consultas, como
   * tarjeta de visitador, de 15 minutos.»
   *
   * Lo que estas pruebas fijan:
   *
   * 1. **La duracion sale del DATO**, no de un numero escrito en la plantilla:
   *    `VisitRequest.durationMinutes` es parte del contrato. Los 15 minutos son
   *    el respaldo para cuando el campo no viene o viene absurdo.
   * 2. **Ni un dato clinico en la tarjeta.** El visitador no accede a
   *    informacion clinica (`pharma-lab.types.ts:9-11`), y la tarjeta no puede
   *    ser la grieta por donde eso entre.
   * 3. **Una visita que ya no esta en pie no ocupa el rato**: rechazada,
   *    cancelada o reprogramada no se dibujan.
   */
  describe('la visita de laboratorio en el dia (C-13)', () => {
    const HOY = new Date();
    const A_LAS_DIEZ = new Date(HOY.getFullYear(), HOY.getMonth(), HOY.getDate(), 10, 0);

    function visita(extra: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        id: 'vr-1',
        medicalVisitorId: 'mv-1',
        pharmaLabId: 'lab-1',
        doctorUserId: 'u-1',
        reason: 'Presentacion de linea cardiologica',
        requestedStartAt: A_LAS_DIEZ.toISOString(),
        durationMinutes: 15,
        timeZone: 'America/La_Paz',
        modalityConceptId: 'mod-1',
        statusConceptId: 'st-confirmada',
        ...extra,
      };
    }

    const CONCEPTOS = [
      { id: 'st-confirmada', code: 'PHL_VISIT_CONFIRMED', display: 'Confirmada' },
      { id: 'st-rechazada', code: 'PHL_VISIT_REJECTED', display: 'Rechazada' },
      { id: 'mv-1', code: 'PHL_VISITOR', display: 'Laboratorio Andes · Rita Pena' },
    ];

    /** Monta el calendario y responde lo del dia, con las visitas indicadas. */
    function conVisitas(visitas: readonly Record<string, unknown>[]): void {
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
      conRecurso();
      conPlantilla([{ dayOfWeek: HOY.getDay(), startTime: '09:00:00', endTime: '13:00:00' }]);
      for (const req of http.match(() => true)) {
        const url = req.request.url;
        req.flush(
          url === '/visit-requests/inbox'
            ? visitas
            : url === '/pharma-labs/reference/concepts'
              ? CONCEPTOS
              : { items: [], count: 0 },
        );
      }
      fixture.detectChanges();
    }

    function tarjetas(): string[] {
      return Array.from(
        fixture.nativeElement.querySelectorAll(
          '.dia__bloque[data-tipo="visita"]',
        ) as NodeListOf<HTMLElement>,
      ).map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim());
    }

    it('una visita aceptada se dibuja en el dia, con la palabra «Visitador»', () => {
      conVisitas([visita()]);

      expect(tarjetas()).toHaveLength(1);
      expect(tarjetas()[0]).toContain('Visitador');
      expect(tarjetas()[0]).toContain('Visita de laboratorio');
      expect(tarjetas()[0]).toContain('10:00');
      // Y NUNCA un uuid: el contrato del doctor no publica el nombre del
      // visitador, y mostrar su identificador es peor que no nombrarlo.
      expect(tarjetas()[0]).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
      // Y su puerta a la bandeja, que C-11 quito del encabezado.
      expect(
        fixture.nativeElement.querySelector('[data-testid="dia-ir-a-lab-visits"]'),
      ).not.toBeNull();
    });

    it('la duracion sale del DATO: 30 minutos se dibujan como 30, no como 15', () => {
      conVisitas([visita({ durationMinutes: 30 })]);

      expect(tarjetas()[0]).toContain('10:00');
      expect(tarjetas()[0]).toContain('10:30');
    });

    it('sin duracion valida cae a los 15 por omision, que es el respaldo y no la fuente', () => {
      conVisitas([visita({ durationMinutes: 0 })]);

      expect(tarjetas()[0]).toContain('10:00');
      expect(tarjetas()[0]).toContain('10:15');
    });

    it('la tarjeta no dice NADA clinico: ni paciente, ni expediente, ni diagnostico', () => {
      conVisitas([visita()]);

      const texto = tarjetas()[0];
      // Lo unico que se muestra es la visita comercial y con quien es.
      expect(texto).not.toMatch(/paciente/i);
      expect(texto).not.toMatch(/expediente/i);
      expect(texto).not.toMatch(/diagn/i);
      // Y no hay ningun enlace al expediente desde esta tarjeta.
      const tarjeta = fixture.nativeElement.querySelector('.dia__bloque[data-tipo="visita"]');
      const enlaces = Array.from(tarjeta.querySelectorAll('a')).map((a) =>
        (a as HTMLAnchorElement).getAttribute('href'),
      );
      expect(enlaces.every((h) => (h ?? '').includes('/lab-visits'))).toBe(true);
    });

    it('una visita RECHAZADA no ocupa el rato: no se dibuja', () => {
      conVisitas([visita({ statusConceptId: 'st-rechazada' })]);

      expect(tarjetas()).toHaveLength(0);
    });

    it('si la lectura de visitas falla, el dia sigue mostrando las consultas', () => {
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
      conRecurso();
      conPlantilla([{ dayOfWeek: HOY.getDay(), startTime: '09:00:00', endTime: '13:00:00' }]);
      for (const req of http.match(() => true)) {
        if (req.request.url === '/visit-requests/inbox') {
          req.flush({ message: 'caido' }, { status: 503, statusText: 'Service Unavailable' });
        } else {
          req.flush({ items: [], count: 0 });
        }
      }
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('app-day-view')).not.toBeNull();
      expect(tarjetas()).toHaveLength(0);
    });
  });

  /* -- El horario extra del final del día (C-10, 2026-09-20) ---------------- */

  /**
   * «Poder agregar un horario al final en caso de emergencia».
   *
   * Lo que estas pruebas fijan, y por qué importa cada una:
   *
   * 1. **Se pregunta antes**, con un diálogo que nombra que se sale del horario
   *    de atención. Cancelar no manda nada.
   * 2. **Es una excepción `EXTRA` con `isAvailable: true`**, no un cupo
   *    inventado. `EXTRA` es el único tipo del catálogo con `blocks: false`: el
   *    único que AÑADE disponibilidad. Un cupo escrito por el cliente sería
   *    disponibilidad que el horario publicado no respalda.
   * 3. **La franja arranca después de lo último que hay ese día**, para que
   *    extender dos veces no pise la primera extensión.
   */
  describe('agregar un horario al final del día (C-10)', () => {
    function calendarioConHorario(
      rules: unknown[] = [
        {
          dayOfWeek: new Date().getDay(),
          startTime: '09:00:00',
          endTime: '13:00:00',
          slotMinutes: 30,
        },
      ],
    ): void {
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
      conRecurso();
      conPlantilla(rules);
      for (const req of http.match(
        (r) =>
          r.url === '/scheduling/slots' ||
          r.url === '/scheduling/bookings' ||
          r.url === '/scheduling/resources/res-1/exceptions' ||
          r.url === '/visit-requests/inbox' ||
          r.url === '/pharma-labs/reference/concepts',
      )) {
        req.flush({ items: [], count: 0 });
      }
      fixture.detectChanges();
    }

    /** Lo que la prueba invoca del componente, tipado. */
    interface Extra {
      agregarHorarioExtra(dia: Date): Promise<void>;
    }
    const extra = (): Extra => fixture.componentInstance as unknown as Extra;

    /**
     * Responde el diálogo del sistema y devuelve la configuración con que se
     * abrió.
     *
     * Se espía `DialogService` en vez de buscar el `<dialog>` en el fixture:
     * el servicio monta el modal en el `body`, fuera del árbol del componente,
     * así que `fixture.nativeElement` no lo ve. Y además deja mirar el TEXTO
     * exacto con que se preguntó, que es la mitad de lo que estas pruebas
     * fijan.
     */
    function conDialogo(acepta: boolean): { config(): DialogConfig | undefined } {
      const espia = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(acepta);
      return { config: () => espia.mock.calls[0]?.[0] };
    }

    it('NIVEL CORRECTO · confirmar manda una excepción EXTRA que ABRE disponibilidad', async () => {
      calendarioConHorario();
      conDialogo(true);
      await extra().agregarHorarioExtra(new Date());
      fixture.detectChanges();

      const req = http.expectOne(
        (r) => r.url === '/scheduling/resources/res-1/exceptions' && r.method === 'POST',
      );
      // Los tres campos que hacen que esto sea un horario extra y no un bloqueo.
      expect(req.request.body.exceptionType).toBe('EXTRA');
      expect(req.request.body.isAvailable).toBe(true);
      // Arranca al final del horario publicado —13:00— y dura un turno.
      const desde = new Date(req.request.body.startAt as string);
      const hasta = new Date(req.request.body.endAt as string);
      expect(desde.getHours()).toBe(13);
      expect((hasta.getTime() - desde.getTime()) / 60_000).toBe(30);
      req.flush({ id: 'exc-extra', blockedSlots: 0 });
      // Y vuelve a leer el día y el mes: la disponibilidad cambió.
      for (const r of http.match(() => true)) r.flush({ items: [], count: 0 });
      fixture.detectChanges();
    });

    it('NIVEL LÍMITE · un día SIN horario publicado también se puede extender, y el aviso lo dice', async () => {
      // El borde del contrato: no hay `endTime` del que partir. La franja no se
      // inventa a las 00:00 ni se cae: se propone el final de la tarde y el
      // diálogo dice que ese día no se atiende.
      calendarioConHorario([
        { dayOfWeek: (new Date().getDay() + 3) % 7, startTime: '09:00:00', endTime: '13:00:00' },
      ]);
      const dialogo = conDialogo(true);
      await extra().agregarHorarioExtra(new Date());
      fixture.detectChanges();

      expect(dialogo.config()?.message).toContain('no atendés');

      const req = http.expectOne(
        (r) => r.url === '/scheduling/resources/res-1/exceptions' && r.method === 'POST',
      );
      expect(new Date(req.request.body.startAt as string).getHours()).toBe(18);
      req.flush({ id: 'exc-extra', blockedSlots: 0 });
      for (const r of http.match(() => true)) r.flush({ items: [], count: 0 });
      fixture.detectChanges();
    });

    it('NIVEL INVÁLIDO · cancelar no manda NADA: la pregunta no es una formalidad', async () => {
      calendarioConHorario();
      conDialogo(false);
      await extra().agregarHorarioExtra(new Date());
      fixture.detectChanges();

      http.expectNone((r) => r.method === 'POST');
      http.verify();
    });

    it('y el diálogo NOMBRA que se sale del horario de atención, con la hora', async () => {
      calendarioConHorario();
      const dialogo = conDialogo(false);
      await extra().agregarHorarioExtra(new Date());

      expect(dialogo.config()?.title).toContain('fuera de tu horario de atención');
      expect(dialogo.config()?.message).toContain('termina a las 13:00');
      expect(dialogo.config()?.message).toContain('se puede reservar');
      // Y el botón dice qué hace, no «Aceptar».
      expect(dialogo.config()?.confirmLabel).toBe('Agregar el horario extra');
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

    it('ya no muestra el aviso de alcance (propietario, 19/09/2026)', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
      });
      conCuposHasta(new Date('2030-01-01'));

      const texto: string = fixture.nativeElement.textContent;
      expect(texto).not.toContain('quirúrgicas');
    });

    it('ofrece retirar el horario, y dice retirar y no borrar', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
      });
      conCuposHasta(new Date('2030-01-01'));

      const retirar = accionesDelHorario().find((el) => el.dataset['action'] === 'retirar');
      expect(retirar).toBeDefined();
      // «Borrar» prometería algo que el sistema no hace: la plantilla no se
      // puede borrar nunca, la referencia la auditoría.
      expect(retirar?.textContent?.trim()).toBe('Retirar horario');
      expect(retirar?.textContent).not.toContain('Borrar');
      expect(retirar?.classList.contains('menu-item--destructive')).toBe(true);
      cerrarAcciones();
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

  it('las acciones del horario van en un desplegable: botón con ícono y texto, cada acción con ícono y texto', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const tarjeta: HTMLElement = fixture.nativeElement.querySelector('.mi-agenda__tarjeta');
    const barra = tarjeta.querySelector('[data-testid="horario-barra"]');
    expect(tarjeta.firstElementChild).toBe(barra);
    expect(barra?.textContent).toContain('Vigente');

    const disparador = barra?.querySelector<HTMLElement>('[data-testid="row-actions-trigger"]');
    expect(disparador, 'sin disparador del desplegable').not.toBeNull();
    expect(disparador?.textContent?.trim()).toBe('Acciones');
    expect(disparador?.getAttribute('aria-label')).toBe('Acciones de tu horario');
    expect(disparador?.querySelector('svg'), 'el disparador lleva ícono').not.toBeNull();

    const acciones = accionesDelHorario();
    expect(acciones.map((el) => el.textContent?.trim())).toEqual([
      'Cambiar mi horario',
      'Mis bloqueos',
      'Agendar una cita',
      'Retirar horario',
    ]);
    for (const accion of acciones) {
      expect(accion.querySelector('svg'), `${accion.dataset['action']} sin ícono`).not.toBeNull();
    }
    cerrarAcciones();
  });

  it('cada acción del desplegable lleva a su pantalla o pide confirmar el retiro', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const confirmar = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(false);

    for (const [code, destino] of [
      ['editar', '/schedule/edit'],
      ['bloqueos', '/schedule/blocks'],
      ['agendar', APPOINTMENT_NEW_ROUTE],
    ]) {
      accionesDelHorario()
        .find((el) => el.dataset['action'] === code)!
        .click();
      fixture.detectChanges();
      expect(navegar).toHaveBeenLastCalledWith(destino);
    }

    accionesDelHorario()
      .find((el) => el.dataset['action'] === 'retirar')!
      .click();
    fixture.detectChanges();
    expect(confirmar).toHaveBeenCalledTimes(1);
  });

  it('el aviso de agotamiento lleva ícono, texto y su tinta de advertencia', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000));

    const aviso: HTMLElement = fixture.nativeElement.querySelector('[data-testid="aviso-agotan"]');
    expect(aviso.textContent?.trim()).toBe('Turnos por agotarse');
    expect(aviso.querySelector('svg')).not.toBeNull();
    expect(aviso.classList.contains('mi-agenda__accion--aviso')).toBe(true);
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
    expect(acciones.querySelector('app-row-actions')).not.toBeNull();
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
