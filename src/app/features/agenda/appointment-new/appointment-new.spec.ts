import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { AppointmentNew } from './appointment-new';

const TENANT = '11111111-1111-1111-1111-111111111111';
const PERFIL = '22222222-2222-2222-2222-222222222222';
const RECURSOS = `/scheduling/resources?tenantId=${TENANT}`;

/**
 * **Agendar una cita** — carril 14.
 *
 * El pedido central del carril es de seguridad, no de forma: *«el doctor debe
 * ser obligatoriamente el usuario autenticado»*, con la instrucción explícita
 * de no confiar sólo en ocultar el campo en el frontend. El backend ya lo
 * impone (`assertRecursoDelActor` en `createDirectAppointment`, probado en
 * `scheduling-bookings.service.spec.ts` — «un profesional NO asigna en la
 * agenda de otro»); lo que faltaba acá era la mitad del frontend: que el campo
 * de profesional **no exista en absoluto** en el DOM, y que la pantalla no
 * tenga ningún camino para mandar un `resourceId` que no sea el de sus propias
 * agendas.
 */
describe('AppointmentNew', () => {
  let fixture: ComponentFixture<AppointmentNew>;
  let http: HttpTestingController;

  let organizationNames: Record<string, string> = { [TENANT]: 'Clínica Norte' };

  function crear(): void {
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
            tenantName: (id: string) => organizationNames[id] ?? id,
            roles: signal<readonly string[]>(['PRACTITIONER']),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(AppointmentNew);
    http = TestBed.inject(HttpTestingController);
    // Sin rutas registradas (`provideRouter([])`), un `navigate` real no
    // encuentra `/schedule` y revienta con un rechazo sin manejar. Se
    // espía siempre, no sólo en la prueba que lo verifica: cualquier alta
    // exitosa navega, y esa promesa no puede quedar suelta.
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  /** Responde el listado de recursos con las agendas dadas. */
  function conAgendas(
    agendas: readonly { id: string; name: string; site?: unknown }[],
  ): void {
    http.expectOne(RECURSOS).flush({
      items: agendas.map((a) => ({
        id: a.id,
        name: a.name,
        resourceTypeConceptId: 'rt-1',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: PERFIL,
        site: a.site ?? null,
      })),
      count: agendas.length,
    });
    fixture.detectChanges();
  }

  /**
   * Responde la lectura de cupos del día con los horarios dados, de 30 minutos,
   * y la de horas del horario flexible (P36) con las dadas, de `minutosFlexibles`.
   */
  function conCupos(
    horas: readonly string[] = ['09:30'],
    flexibles: readonly string[] = [],
    minutosFlexibles = 30,
  ): void {
    fixture.detectChanges();
    for (const lectura of http.match((r) => r.url.endsWith('/flexible-availability'))) {
      // La de un intento anterior que falló queda cancelada: no se responde.
      if (lectura.cancelled) continue;
      lectura.flush({
        resourceId: 'res-1',
        stepMinutes: 15,
        items: flexibles.map((hora) => {
          const [hh, mm] = hora.split(':').map(Number);
          const inicio = new Date(2099, 0, 5, hh, mm);
          return {
            templateId: 'tpl-flex',
            startAt: inicio.toISOString(),
            endAt: new Date(inicio.getTime() + minutosFlexibles * 60_000).toISOString(),
          };
        }),
      });
    }
    for (const lectura of http.match((r) => r.url === '/scheduling/slots')) {
      lectura.flush({
        items: horas.map((hora, i) => {
          const [hh, mm] = hora.split(':').map(Number);
          const inicio = new Date(2026, 8, 10, hh, mm);
          return {
            id: `slot-${i}`,
            resourceId: 'res-1',
            scheduleTemplateId: null,
            startAt: inicio.toISOString(),
            endAt: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
            capacity: 1,
            remainingCapacity: 1,
            statusConceptId: 'st-open',
            serviceConceptId: null,
          };
        }),
        count: horas.length,
        limit: 200,
        truncated: false,
      });
    }
    fixture.detectChanges();
  }

  /**
   * NUNCA hay un campo de profesional — punto 2 del carril, literal.
   *
   * No basta con que el formulario no lo pida: si algún día alguien agrega un
   * `<select>` u otro control cuyo `name`/`label`/`data-testid` mencione al
   * profesional, esta prueba tiene que fallar. Se busca por texto y por
   * `data-testid` a la vez porque un campo puede escaparse de uno de los dos.
   */
  it('no existe ningún campo para elegir el profesional', () => {
    crear();
    conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

    const texto: string = fixture.nativeElement.textContent.toLowerCase();
    expect(texto).not.toContain('profesional');
    expect(texto).not.toContain('doctor');
    expect(texto).not.toContain('médico');

    const controlesSospechosos = fixture.nativeElement.querySelectorAll(
      '[data-testid*="profesional"], [data-testid*="doctor"], [data-testid*="medico"]',
    );
    expect(controlesSospechosos.length).toBe(0);
  });

  /**
   * Con una sola agenda no se pregunta — es el mismo criterio que «Mi
   * agenda»: preguntar algo sin alternativa es un paso de más, y además es
   * la única fuente posible de `resourceId` para el alta.
   */
  it('con una sola agenda, la elige sola y no muestra el selector', () => {
    crear();
    conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

    expect(fixture.nativeElement.querySelector('[data-testid="cita-agenda"]')).toBeNull();

    const agendaElegida = (
      fixture.componentInstance as unknown as { agendaElegida: () => string | null }
    ).agendaElegida();
    expect(agendaElegida).toBe('res-1');
  });

  /** Con dos agendas sí hay algo que decidir, y se ofrece. */
  it('con más de una agenda, sí muestra el selector', () => {
    crear();
    conAgendas([
      { id: 'res-1', name: 'Consultorio Centro' },
      { id: 'res-2', name: 'Consultorio Norte' },
    ]);

    expect(fixture.nativeElement.querySelector('[data-testid="cita-agenda"]')).not.toBeNull();
  });

  describe('dónde queda la cita', () => {
    const SEDE_CENTRO = { id: 's-1', name: 'Sede Centro', code: 'C', addressText: 'Av. Busch 100', timeZone: null };
    const SEDE_NORTE = { id: 's-2', name: 'Sede Norte', code: 'N', addressText: null, timeZone: null };

    function locationText(): string {
      const nodo: HTMLElement = fixture.nativeElement.querySelector('[data-testid="cita-location"]');
      return nodo.textContent.replace(/\s+/g, ' ').trim();
    }

    afterEach(() => {
      organizationNames = { [TENANT]: 'Clínica Norte' };
    });

    it('con una sola agenda, dice la organización, la sede y la dirección', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Agenda', site: SEDE_CENTRO }]);

      expect(locationText()).toBe('Esta cita queda en Clínica Norte · Sede Centro Av. Busch 100');
    });

    it('cambia con la agenda elegida', () => {
      crear();
      conAgendas([
        { id: 'res-1', name: 'Agenda A', site: SEDE_CENTRO },
        { id: 'res-2', name: 'Agenda B', site: SEDE_NORTE },
      ]);

      (
        fixture.componentInstance as unknown as { agendaElegida: { set(id: string): void } }
      ).agendaElegida.set('res-2');
      fixture.detectChanges();

      expect(locationText()).toBe('Esta cita queda en Clínica Norte · Sede Norte');
    });

    it('sin sede vigente lo dice, en vez de dejar el hueco', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Agenda' }]);

      expect(locationText()).toBe('Esta cita queda en Clínica Norte · Sin consultorio registrado');
    });

    it('no repite la organización si la sede ya la nombra', () => {
      crear();
      conAgendas([
        { id: 'res-1', name: 'Agenda', site: { ...SEDE_NORTE, name: 'CLÍNICA NORTE · Sede Central' } },
      ]);

      expect(locationText()).toBe('Esta cita queda en CLÍNICA NORTE · Sede Central');
    });

    it('sin nombre de organización en el token, no muestra el id', () => {
      organizationNames = {};
      crear();
      conAgendas([{ id: 'res-1', name: 'Agenda', site: SEDE_NORTE }]);

      expect(locationText()).toBe('Esta cita queda en Sede Norte');
    });
  });

  /** Sin ninguna agenda publicada, no hay dónde poner la cita: se dice, no se adivina. */
  it('sin ninguna agenda, avisa y no dibuja el formulario', () => {
    crear();
    conAgendas([]);

    expect(fixture.nativeElement.querySelector('[data-testid="cita-sin-agenda"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  describe('el botón de guardar', () => {
    function instancia(): {
      paciente: { set(v: { value: string; label: string } | null): void };
      dia: { set(v: Date | null): void };
      hora: { set(v: string): void };
      puedeGuardar: () => boolean;
    } {
      return fixture.componentInstance as unknown as ReturnType<typeof instancia>;
    }

    it('arranca deshabilitado: falta paciente y horario', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="cita-guardar"]',
      );
      // `AppButton` deshabilita con `aria-disabled`, no con el atributo nativo
      // — así el botón sigue siendo enfocable y anunciado por el lector.
      expect(boton.getAttribute('aria-disabled')).toBe('true');
    });

    it('se habilita recién con paciente, día y hora válidos', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.paciente.set({ value: 'pac-1', label: 'Ana Pérez' });
      c.dia.set(new Date(2026, 8, 10));
      c.hora.set('09:30');
      conCupos();

      const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="cita-guardar"]',
      );
      expect(boton.getAttribute('aria-disabled')).toBe('false');
    });

    it('una hora que no es un horario libre no habilita el botón', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.paciente.set({ value: 'pac-1', label: 'Ana Pérez' });
      c.dia.set(new Date(2026, 8, 10));
      c.hora.set('07:00');
      conCupos();

      const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="cita-guardar"]',
      );
      expect(boton.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('los horarios', () => {
    function instancia(): {
      elegirDia(d: Date | null): void;
      elegirHora(h: string | null): void;
      hora: () => string;
      duracion: () => string;
      opcionesDeHora: () => readonly { value: string; label: string }[];
      opcionesDeDuracion: () => readonly { value: string }[];
      reintentarCupos(): void;
    } {
      return fixture.componentInstance as unknown as ReturnType<typeof instancia>;
    }

    it('no hay campo de texto: la hora es un select sin opciones hasta elegir el día', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      expect(fixture.nativeElement.querySelector('app-input[data-testid="cita-hora"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-select[data-testid="cita-hora"]')).not.toBeNull();
      expect(instancia().opcionesDeHora()).toEqual([]);
      http.expectNone((r) => r.url === '/scheduling/slots');
    });

    it('pide sólo los cupos libres de esa agenda ese día y los ofrece', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      instancia().elegirDia(new Date(2099, 0, 5));
      fixture.detectChanges();

      const lectura = http.expectOne((r) => r.url === '/scheduling/slots');
      expect(lectura.request.params.get('resourceId')).toBe('res-1');
      expect(lectura.request.params.get('onlyAvailable')).toBe('true');
      expect(lectura.request.params.get('from')).toBe(new Date(2099, 0, 5).toISOString());
      expect(lectura.request.params.get('to')).toBe(new Date(2099, 0, 6).toISOString());
      lectura.flush({ items: [], count: 0, limit: 200, truncated: false });
      conCupos();
    });

    it('sin cupos ese día lo dice y no deja guardar', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      instancia().elegirDia(new Date(2099, 0, 5));
      conCupos([]);

      expect(fixture.nativeElement.textContent).toContain('No tiene horarios libres ese día');
      expect(instancia().opcionesDeHora()).toEqual([]);
    });

    it('la duración arranca en la del cupo y no pasa de los cupos seguidos', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      instancia().elegirDia(new Date(2099, 0, 5));
      // 09:00 y 09:30 están pegados; 11:00 queda después de un hueco.
      conCupos(['09:00', '09:30', '11:00']);

      instancia().elegirHora('09:00');
      fixture.detectChanges();

      expect(instancia().duracion()).toBe('30');
      expect(instancia().opcionesDeDuracion().map((o) => o.value)).toEqual([
        '15', '20', '30', '45', '60',
      ]);
    });

    /*
     * Un día «Horario flexible» no tiene cupos fijos: sus horas las calcula la
     * API al leer. Antes la hora salía «Sin horarios libres» ese día.
     */
    it('un día de horario flexible ofrece sus horas aunque no tenga cupos fijos', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      instancia().elegirDia(new Date(2099, 0, 5));
      fixture.detectChanges();

      const [flexible] = http.match(
        (r) => r.url === '/scheduling/resources/res-1/flexible-availability',
      );
      expect(flexible!.request.params.get('from')).toBe(new Date(2099, 0, 5).toISOString());
      expect(flexible!.request.params.get('to')).toBe(new Date(2099, 0, 6).toISOString());
      // Cada 15 min con 30 por paciente; 10:00 y 10:15 ocupados por otra cita.
      flexible!.flush({
        resourceId: 'res-1',
        stepMinutes: 15,
        items: ['09:00', '09:15', '09:30', '10:30'].map((hora) => {
          const [hh, mm] = hora.split(':').map(Number);
          const inicio = new Date(2099, 0, 5, hh, mm);
          return {
            templateId: 'tpl-flex',
            startAt: inicio.toISOString(),
            endAt: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
          };
        }),
      });
      conCupos([]);

      expect(instancia().opcionesDeHora().map((o) => o.value)).toEqual([
        '09:00', '09:15', '09:30', '10:30',
      ]);
      expect(fixture.nativeElement.textContent).not.toContain('No tiene horarios libres ese día');

      // 09:00 → 10:00 libre de corrido (la última hora, 09:30, termina a las 10:00).
      instancia().elegirHora('09:00');
      expect(instancia().duracion()).toBe('30');
      expect(instancia().opcionesDeDuracion().map((o) => o.value)).toEqual([
        '15', '20', '30', '45', '60',
      ]);
    });

    it('si falla la lectura de horas flexibles igual ofrece los cupos fijos', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      instancia().elegirDia(new Date(2099, 0, 5));
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/flexible-availability'))
        .flush({}, { status: 500, statusText: 'Server Error' });
      conCupos(['09:00']);

      expect(instancia().opcionesDeHora().map((o) => o.value)).toEqual(['09:00']);
      expect(fixture.nativeElement.querySelector('[data-testid="cita-hora-caida"]')).toBeNull();
    });

    it('cambiar el día suelta la hora elegida', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      instancia().elegirDia(new Date(2099, 0, 5));
      conCupos(['09:00']);
      instancia().elegirHora('09:00');

      instancia().elegirDia(new Date(2099, 0, 6));
      conCupos(['10:00']);

      expect(instancia().hora()).toBe('');
    });

    it('si la lectura falla lo dice y deja reintentar', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      instancia().elegirDia(new Date(2099, 0, 5));
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === '/scheduling/slots')
        .flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="cita-hora-caida"]')).not.toBeNull();

      instancia().reintentarCupos();
      conCupos();
      expect(fixture.nativeElement.querySelector('[data-testid="cita-hora-caida"]')).toBeNull();
    });
  });

  describe('al guardar', () => {
    function completarYEnviar(): void {
      const c = fixture.componentInstance as unknown as {
        paciente: { set(v: { value: string; label: string } | null): void };
        dia: { set(v: Date | null): void };
        hora: { set(v: string): void };
        guardar(): void;
      };
      c.paciente.set({ value: 'pac-1', label: 'Ana Pérez' });
      c.dia.set(new Date(2026, 8, 10));
      c.hora.set('09:30');
      conCupos();
      c.guardar();
    }

    /**
     * El `resourceId` que viaja es el de LA AGENDA DE LA SESIÓN, resuelta por
     * `GET /scheduling/resources` — nunca un valor que el formulario deje
     * escribir a mano. Es la mitad de frontend de REQ-14-005: no hay ningún
     * control en esta pantalla capaz de mandar un `resourceId` ajeno.
     */
    it('manda el resourceId de la agenda propia, no uno inventado', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      completarYEnviar();

      const peticion = http.expectOne('/scheduling/appointments/direct');
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.body.resourceId).toBe('res-1');
      expect(peticion.request.body.patientProfileId).toBe('pac-1');
      peticion.flush({
        bookingId: 'book-1',
        bookableSlotId: 'slot-1',
        statusConceptId: 'st-1',
        retractedSlots: 0,
      });
    });

    it('creada la cita, avisa y vuelve a Mi agenda', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      const router = TestBed.inject(Router);
      const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const toasts = TestBed.inject(ToastService);
      const exito = vi.spyOn(toasts, 'success');

      completarYEnviar();
      http.expectOne('/scheduling/appointments/direct').flush({
        bookingId: 'book-1',
        bookableSlotId: 'slot-1',
        statusConceptId: 'st-1',
        retractedSlots: 0,
      });

      expect(exito).toHaveBeenCalled();
      expect(navegar).toHaveBeenCalledWith(['/schedule']);
    });

    /**
     * El 422 de la regla madre («con qué, cuándo y dónde») llega como
     * `CONFLICT`, que `errorToViewState` traduce a estado `validation` sin
     * `message` de nivel superior — sólo en `issues[].message`. Fijado como
     * regresión: ya se rompió una vez (leer `estado.message` daba
     * `undefined` y mostraba el genérico), ver `mensajeDeError` en el
     * componente.
     */
    it('un choque de horario (422) muestra el mensaje real del servidor, no el genérico', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      completarYEnviar();
      http.expectOne('/scheduling/appointments/direct').flush(
        {
          code: 'CONFLICT',
          message: 'Tiene una cita confirmada en ese rato en «Consultorio Norte».',
        },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      const aviso = fixture.nativeElement.querySelector('[data-testid="cita-error"]');
      expect(aviso?.textContent).toContain('Consultorio Norte');
      expect(aviso?.textContent).not.toContain('No pudimos agendar');
    });

    it('un profesional NO puede forzar la agenda de otro (403 del servidor)', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      completarYEnviar();
      http.expectOne('/scheduling/appointments/direct').flush(
        {
          code: 'FORBIDDEN',
          message: 'Un profesional solo puede asignar citas en su propia agenda.',
        },
        { status: 403, statusText: 'Forbidden' },
      );
      fixture.detectChanges();

      const aviso = fixture.nativeElement.querySelector('[data-testid="cita-error"]');
      expect(aviso?.textContent).toContain('propia agenda');
    });

    /* -- Telemedicina por franja (422 TELEMEDICINE_NOT_ENABLED) ------------ */

    /** Jueves 10/09/2026 de 14 a 18 con telemedicina; el resto, presencial. */
    const PLANTILLAS_CON_TELEMEDICINA = {
      items: [
        {
          id: 'tpl-1',
          retired: false,
          name: 'Horario',
          statusConceptId: 'c',
          rules: [
            { dayOfWeek: 4, startTime: '08:00:00', endTime: '12:00:00', telemedicineEnabled: false },
            { dayOfWeek: 4, startTime: '14:00:00', endTime: '18:00:00', telemedicineEnabled: true },
          ],
        },
        {
          // Retirada: su telemedicina de la mañana ya no cuenta.
          id: 'tpl-0',
          retired: true,
          name: 'Viejo',
          statusConceptId: 'c',
          rules: [
            { dayOfWeek: 4, startTime: '08:00:00', endTime: '12:00:00', telemedicineEnabled: true },
          ],
        },
      ],
      count: 2,
    };

    /** Elige teleconsulta para el jueves 10/09 a la hora dada, sin guardar. */
    function teleconsultaA(hora: string): {
      puedeGuardar(): boolean;
      guardar(): void;
    } {
      const c = fixture.componentInstance as unknown as {
        paciente: { set(v: { value: string; label: string } | null): void };
        dia: { set(v: Date | null): void };
        hora: { set(v: string): void };
        modalidad: { set(v: string): void };
        puedeGuardar(): boolean;
        guardar(): void;
      };
      c.paciente.set({ value: 'pac-1', label: 'Ana Pérez' });
      c.dia.set(new Date(2026, 8, 10));
      c.hora.set(hora);
      c.modalidad.set('TELECONSULTA');
      conCupos([hora]);
      return c;
    }

    it('presencial no lee franjas: la telemedicina sólo importa en teleconsulta', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      completarYEnviar();
      http.expectNone('/scheduling/resources/res-1/templates');
      expect(http.expectOne('/scheduling/appointments/direct').request.body.channel).toBe(
        'PRESENCIAL',
      );
    });

    it('teleconsulta fuera de una franja con telemedicina: avisa y no deja guardar', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      const c = teleconsultaA('09:30');
      http.expectOne('/scheduling/resources/res-1/templates').flush(PLANTILLAS_CON_TELEMEDICINA);
      fixture.detectChanges();

      const aviso = fixture.nativeElement.querySelector('[data-testid="cita-sin-telemedicina"]');
      expect(aviso?.textContent).toContain('habilitada para telemedicina');
      expect(c.puedeGuardar()).toBe(false);
      c.guardar();
      http.expectNone('/scheduling/appointments/direct');
    });

    it('teleconsulta dentro de una franja con telemedicina: guarda con TELECONSULTA', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      const c = teleconsultaA('15:00');
      http.expectOne('/scheduling/resources/res-1/templates').flush(PLANTILLAS_CON_TELEMEDICINA);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector('[data-testid="cita-sin-telemedicina"]'),
      ).toBeNull();
      expect(c.puedeGuardar()).toBe(true);
      c.guardar();
      const peticion = http.expectOne('/scheduling/appointments/direct');
      expect(peticion.request.body.channel).toBe('TELECONSULTA');
      peticion.flush({
        bookingId: 'book-1',
        bookableSlotId: 'slot-1',
        statusConceptId: 'st-1',
        retractedSlots: 0,
      });
    });

    it('sin franjas leídas no adivina, y el 422 TELEMEDICINE_NOT_ENABLED se explica claro', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);
      const c = teleconsultaA('09:30');
      // La lectura de franjas falla: no hay aviso temprano, decide el servidor.
      http
        .expectOne('/scheduling/resources/res-1/templates')
        .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(c.puedeGuardar()).toBe(true);

      c.guardar();
      http.expectOne('/scheduling/appointments/direct').flush(
        {
          statusCode: 422,
          code: 'PRECONDITION_FAILED',
          message: 'Ese horario no atiende por telemedicina.',
          reason: 'TELEMEDICINE_NOT_ENABLED',
          correlationId: 'req-42',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      fixture.detectChanges();

      const aviso = fixture.nativeElement.querySelector('[data-testid="cita-error"]');
      expect(aviso?.textContent).toContain('no está en una franja de su horario habilitada');
      expect(aviso?.textContent).toContain('Atiende por telemedicina');
      expect(aviso?.textContent).toContain('req-42');
    });
  });
  /* ==========================================================================
     El paciente que no está en el sistema — §1.1 del registro de procesos.
     ========================================================================== */

  describe('paciente que no está en el sistema', () => {
    /** Lo que el componente expone y estas pruebas manejan. */
    function instancia(): {
      modo: { (): string; set(v: 'registrado' | 'nuevo'): void };
      paciente: { (): unknown; set(v: { value: string; label: string } | null): void };
      nuevoNombre: { set(v: string): void };
      nuevoApellidoPaterno: { set(v: string): void };
      nuevoSegundoNombre: { (): string; set(v: string): void };
      nuevosNombresExtra: { (): readonly string[]; set(v: readonly string[]): void };
      nuevoDocumento: { set(v: string): void };
      nuevoCelular: { set(v: string): void };
      nuevoNacimiento: { set(v: Date | null): void };
      ocupacionElegida: { set(v: { value: string; label: string } | null): void };
      edadDelNuevo: () => number | null;
      ocupacionEsOtra: () => boolean;
      registrarPacienteNuevo(): void;
      buscarRegistrado(): void;
      elegirOcupacion(o: { value: string; label: string } | null): void;
      dia: { set(v: Date | null): void };
      hora: { set(v: string): void };
      guardar(): void;
    } {
      return fixture.componentInstance as unknown as ReturnType<typeof instancia>;
    }

    /**
     * Responde los dos catálogos que pide el alta.
     *
     * Se contestan con `match` y no con `expectOne` porque el orden en que
     * salen no es parte del contrato: lo que importa es que ninguno frene el
     * alta, no cuál se pidió primero.
     */
    function conCatalogos(): void {
      for (const peticion of http.match((r) => r.url.endsWith('/terminology/value-sets'))) {
        const codigo = peticion.request.params.get('code');
        peticion.flush({ items: [{ id: `vs-${codigo}`, internalCode: codigo }], count: 1 });
      }
      for (const peticion of http.match((r) => r.url.includes('$expand'))) {
        const opciones = peticion.request.url.includes('OCCUPATION')
          ? [
              { conceptId: 'oc-1', code: 'occupation:bo:DOCENTE', display: 'Docente', codeSystemVersionId: 'v1' },
              { conceptId: 'oc-otra', code: 'occupation:bo:OTRA', display: 'Otra ocupación', codeSystemVersionId: 'v1' },
            ]
          : [{ conceptId: 'dep-sc', code: 'geo:bo:department:SC', display: 'Santa Cruz', codeSystemVersionId: 'v1' }];
        peticion.flush({ items: opciones, nextCursor: null });
      }
      fixture.detectChanges();
    }

    /** Lo mínimo que el mostrador consigue, más el horario. */
    function completarAlta(): void {
      const c = instancia();
      c.nuevoNombre.set('Rosa');
      c.nuevoApellidoPaterno.set('Ticona');
      c.nuevoDocumento.set('8123456');
      c.nuevoCelular.set('+591 71234567');
      c.dia.set(new Date(2026, 8, 10));
      c.hora.set('09:30');
      conCupos();
    }

    /**
     * El pedido, en una prueba: tiene que haber una salida cuando el que llegó
     * no está en la lista. Sin ella, la única forma de atenderlo es abandonar
     * la cita a medio completar.
     */
    it('ofrece dar de alta a quien no aparece en la búsqueda', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      expect(fixture.nativeElement.querySelector('[data-testid="cita-paciente-nuevo"]')).not.toBeNull();
    });

    /**
     * El bloque **entra y sale del DOM**, no se esconde con CSS: un campo
     * escondido igual se tabula y el buscador dejaría de ser la única respuesta
     * a «¿con quién?».
     */
    it('al elegirlo, el buscador deja lugar al alta y vuelve si se arrepiente', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      instancia().registrarPacienteNuevo();
      conCatalogos();

      expect(fixture.nativeElement.querySelector('[data-testid="cita-alta-paciente"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="cita-paciente"]')).toBeNull();

      instancia().buscarRegistrado();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="cita-paciente"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="cita-alta-paciente"]')).toBeNull();
    });

    /**
     * Lo buscado como cédula llega escrito al alta.
     *
     * Es el número que la persona acaba de teclear; pedirlo otra vez dos
     * renglones más abajo es donde aparecen los documentos con un dígito
     * cambiado — y el duplicado que vienen a evitar.
     */
    it('la cédula que se buscó queda puesta en el alta', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = fixture.componentInstance as unknown as {
        buscarPaciente(t: string): void;
        registrarPacienteNuevo(): void;
        nuevoDocumento: () => string;
      };
      c.buscarPaciente('8123456');
      http
        .expectOne((r) => r.url === '/profiles/patients/search')
        .flush({ items: [], count: 0, limit: 10, nextCursor: null });
      c.registrarPacienteNuevo();
      conCatalogos();

      expect(c.nuevoDocumento()).toBe('8123456');
    });

    /**
     * Regresión: con un paciente ya elegido, pasar a «paciente nuevo» tiene que
     * soltarlo. Si quedara puesto, «¿con quién?» tendría dos respuestas a la
     * vez y la cita se agendaría con la que no se ve en pantalla.
     */
    it('pasar al alta suelta al paciente que estaba elegido', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.paciente.set({ value: 'pac-1', label: 'Ana Pérez' });
      c.registrarPacienteNuevo();
      conCatalogos();

      expect(c.paciente()).toBeNull();
    });

    /** Lo escrito no se pierde al ir a comprobar una vez más en la lista. */
    it('volver a la lista no borra lo que ya se escribió', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.registrarPacienteNuevo();
      conCatalogos();
      c.nuevoSegundoNombre.set('Elena');
      c.buscarRegistrado();
      fixture.detectChanges();

      expect(c.nuevoSegundoNombre()).toBe('Elena');
    });

    /** «La app tiene que arrojar de manera automática la edad» (§1.1.9). */
    it('la edad sale de la fecha de nacimiento, no se pregunta', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.registrarPacienteNuevo();
      conCatalogos();

      const hoy = new Date();
      // Cumplió ayer: la edad ya está completa.
      c.nuevoNacimiento.set(new Date(hoy.getFullYear() - 30, hoy.getMonth(), hoy.getDate() - 1));
      expect(c.edadDelNuevo()).toBe(30);

      // Cumple mañana: todavía le falta un año.
      c.nuevoNacimiento.set(new Date(hoy.getFullYear() - 30, hoy.getMonth(), hoy.getDate() + 1));
      expect(c.edadDelNuevo()).toBe(29);
    });

    /** Sin cédula no se da de alta a nadie: es lo que evita el duplicado. */
    it('no se puede guardar sin nombre, apellido, cédula y celular', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.registrarPacienteNuevo();
      conCatalogos();
      c.nuevoNombre.set('Rosa');
      c.nuevoApellidoPaterno.set('Ticona');
      c.dia.set(new Date(2026, 8, 10));
      c.hora.set('09:30');
      conCupos();

      const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="cita-guardar"]',
      );
      expect(boton.getAttribute('aria-disabled')).toBe('true');

      c.nuevoDocumento.set('8123456');
      c.nuevoCelular.set('+591 71234567');
      fixture.detectChanges();

      expect(boton.getAttribute('aria-disabled')).toBe('false');
    });

    /**
     * UNA petición y una transacción — P22 cerrado.
     *
     * Esto eran dos: `POST /profiles/patients` y después la cita. Y no
     * funcionaba: `CreatePatientDto` no declara cédula ni celular, así que
     * `forbidNonWhitelisted` rechazaba la petición entera con 400 contra la API
     * real. La prueba fija ahora el endpoint atómico, con la filiación entera
     * adentro de `patient`, y **que ya no se llame al alta suelta**.
     */
    it('los nombres agregados con «+ Agregar otro nombre» viajan junto al segundo en middleName', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.registrarPacienteNuevo();
      conCatalogos();
      c.nuevoSegundoNombre.set('Elena');
      c.nuevosNombresExtra.set(['Beatriz', '']);
      completarAlta();
      c.guardar();

      const turno = http.expectOne('/scheduling/appointments/walk-in');
      expect(turno.request.body.patient.middleName).toBe('Elena Beatriz');

      turno.flush({
        patientProfileId: 'pac-nuevo',
        personId: 'per-nuevo',
        patientCode: 'PAC-99',
        bookingId: 'book-1',
        bookableSlotId: 'slot-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        statusConceptId: 'st-1',
        retractedSlots: 0,
      });
    });

    it('registra y agenda en una sola petición al walk-in, sin abrir la atención', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.registrarPacienteNuevo();
      conCatalogos();
      c.nuevoSegundoNombre.set('Elena');
      completarAlta();
      c.guardar();

      // El alta suelta ya no existe: si vuelve, esta línea falla.
      http.expectNone('/profiles/patients');
      http.expectNone('/scheduling/appointments/direct');

      const turno = http.expectOne('/scheduling/appointments/walk-in');
      expect(turno.request.method).toBe('POST');
      expect(turno.request.body.patient.name).toBe('Rosa');
      expect(turno.request.body.patient.lastName).toBe('Ticona');
      expect(turno.request.body.patient.middleName).toBe('Elena');
      expect(turno.request.body.patient.nationalId).toBe('8123456');
      expect(turno.request.body.patient.phone).toBe('+591 71234567');
      // El mostrador no acuña códigos de paciente: son únicos en toda la
      // instalación y el servidor ya los emite él.
      expect(turno.request.body.patient.patientCode).toBeUndefined();
      // Ni nombre visible: `WalkInPatientDto` no lo declara, y mandarlo haría
      // rebotar la petición entera con 400.
      expect(turno.request.body.patient.displayName).toBeUndefined();
      // El rato viaja afuera de la filiación, no adentro.
      expect(turno.request.body.resourceId).toBe('res-1');
      expect(typeof turno.request.body.startAt).toBe('string');
      expect(turno.request.body.durationMinutes).toBeGreaterThan(0);
      // Esta pantalla agenda, no atiende: sin esto la cita de otro día nacía
      // con la atención abierta hoy.
      expect(turno.request.body.startAttention).toBe(false);

      turno.flush({
        patientProfileId: 'pac-nuevo',
        personId: 'per-nuevo',
        patientCode: 'PAC-99',
        bookingId: 'book-1',
        bookableSlotId: 'slot-1',
        appointmentId: 'appt-1',
        encounterId: 'enc-1',
        statusConceptId: 'st-1',
        retractedSlots: 0,
      });
    });

    /** El 409 dice dónde seguir: buscarlo arriba, no volver a teclear la cédula. */
    it('si el documento ya está registrado, lo dice y manda a buscarlo', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.registrarPacienteNuevo();
      conCatalogos();
      completarAlta();
      c.guardar();

      http.expectOne('/scheduling/appointments/walk-in').flush(
        { code: 'CONFLICT', message: 'Ya hay un paciente con esa cédula.' },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      // Una sola transacción: nada quedó creado por el camino.
      http.expectNone('/profiles/patients');
      const aviso = fixture.nativeElement.querySelector('[data-testid="cita-error"]');
      expect(aviso?.textContent).toContain('ya está registrado');
      expect(aviso?.textContent).toContain('cédula');
    });

    /** «Otra ocupación» es la que destraba el oficio escrito a mano (§1.1.7). */
    it('elegir «Otra ocupación» pide escribir cuál', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.registrarPacienteNuevo();
      conCatalogos();

      c.elegirOcupacion({ value: 'oc-1', label: 'Docente' });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="cita-alta-ocupacion-otra"]')).toBeNull();

      c.elegirOcupacion({ value: 'oc-otra', label: 'Otra ocupación' });
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-testid="cita-alta-ocupacion-otra"]'),
      ).not.toBeNull();
    });
  });

  /**
   * Tecleada una cédula, la búsqueda tiene que ir por el documento y no por el
   * nombre: `query` es texto libre sobre el nombre y el código, así que un
   * documento por ahí no encuentra a nadie y la pantalla concluiría que hay que
   * dar de alta a alguien que ya estaba — justo el duplicado que el cliente
   * pide evitar (§1.1.4).
   */
  describe('la búsqueda del paciente', () => {
    function buscar(texto: string): void {
      (fixture.componentInstance as unknown as { buscarPaciente(t: string): void }).buscarPaciente(
        texto,
      );
    }

    it('lo que son puros dígitos va por cédula', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      buscar('8123456');
      const peticion = http.expectOne((r) => r.url === '/profiles/patients/search');
      expect(peticion.request.body.nationalId).toBe('8123456');
      expect(peticion.request.body).not.toHaveProperty('q');
      peticion.flush({ items: [], count: 0, limit: 10, nextCursor: null });
    });

    it('un nombre sigue yendo por texto libre', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      buscar('Ana');
      const peticion = http.expectOne((r) => r.url === '/profiles/patients/search');
      // La clave del cuerpo se llama `q`, no `query`.
      expect(peticion.request.body.q).toBe('Ana');
      expect(peticion.request.body).not.toHaveProperty('nationalId');
      peticion.flush({ items: [], count: 0, limit: 10, nextCursor: null });
    });
  });
});
