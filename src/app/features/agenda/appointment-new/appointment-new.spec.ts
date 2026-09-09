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
  function conAgendas(agendas: readonly { id: string; name: string }[]): void {
    http.expectOne(RECURSOS).flush({
      items: agendas.map((a) => ({
        id: a.id,
        name: a.name,
        resourceTypeConceptId: 'rt-1',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: PERFIL,
      })),
      count: agendas.length,
    });
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
      fixture.detectChanges();

      const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="cita-guardar"]',
      );
      expect(boton.getAttribute('aria-disabled')).toBe('false');
    });

    it('una hora mal escrita no habilita el botón', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.paciente.set({ value: 'pac-1', label: 'Ana Pérez' });
      c.dia.set(new Date(2026, 8, 10));
      c.hora.set('9:5');
      fixture.detectChanges();

      const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[data-testid="cita-guardar"]',
      );
      expect(boton.getAttribute('aria-disabled')).toBe('true');
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
      fixture.detectChanges();
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
          message: 'Tenés una cita confirmada en ese rato en «Consultorio Norte».',
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
      fixture.detectChanges();
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
    it('al elegirlo, el buscador deja lugar al alta y vuelve si te arrepentís', () => {
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
        .expectOne((r) => r.url === '/profiles/patients')
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
      fixture.detectChanges();

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
     * El alta primero y la cita después, con el perfil que devolvió el alta —
     * no con nada inventado por la pantalla.
     */
    it('da de alta al paciente y agenda con el perfil que devolvió el alta', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.registrarPacienteNuevo();
      conCatalogos();
      c.nuevoSegundoNombre.set('Elena');
      completarAlta();
      c.guardar();

      const alta = http.expectOne('/profiles/patients');
      expect(alta.request.method).toBe('POST');
      expect(alta.request.body.name).toBe('Rosa');
      expect(alta.request.body.lastName).toBe('Ticona');
      expect(alta.request.body.middleName).toBe('Elena');
      expect(alta.request.body.nationalId).toBe('8123456');
      expect(alta.request.body.phone).toBe('+591 71234567');
      // El mostrador no acuña códigos de paciente: son únicos en toda la
      // instalación y el servidor ya los emite él.
      expect(alta.request.body.patientCode).toBeUndefined();
      alta.flush({
        profileId: 'pac-nuevo',
        personId: 'per-nuevo',
        patientCode: 'PAC-99',
        recordLinkageStatus: 'UNLINKED',
        createdAt: new Date().toISOString(),
      });

      const cita = http.expectOne('/scheduling/appointments/direct');
      expect(cita.request.body.patientProfileId).toBe('pac-nuevo');
      cita.flush({
        bookingId: 'book-1',
        bookableSlotId: 'slot-1',
        statusConceptId: 'st-1',
        retractedSlots: 0,
      });
    });

    /** Si el alta falla, no se agenda nada y se dice qué pasó. */
    it('si el alta del paciente falla, no llega a agendar', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      const c = instancia();
      c.registrarPacienteNuevo();
      conCatalogos();
      completarAlta();
      c.guardar();

      http.expectOne('/profiles/patients').flush(
        { code: 'CONFLICT', message: 'Ya hay un paciente con esa cédula.' },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      http.expectNone('/scheduling/appointments/direct');
      const aviso = fixture.nativeElement.querySelector('[data-testid="cita-error"]');
      expect(aviso?.textContent).toContain('esa cédula');
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
      const peticion = http.expectOne((r) => r.url === '/profiles/patients');
      expect(peticion.request.params.get('nationalId')).toBe('8123456');
      expect(peticion.request.params.get('q')).toBeNull();
      peticion.flush({ items: [], count: 0, limit: 10, nextCursor: null });
    });

    it('un nombre sigue yendo por texto libre', () => {
      crear();
      conAgendas([{ id: 'res-1', name: 'Consultorio Centro' }]);

      buscar('Ana');
      const peticion = http.expectOne((r) => r.url === '/profiles/patients');
      // El parámetro del cable se llama `q`, no `query`.
      expect(peticion.request.params.get('q')).toBe('Ana');
      expect(peticion.request.params.get('nationalId')).toBeNull();
      peticion.flush({ items: [], count: 0, limit: 10, nextCursor: null });
    });
  });
});
