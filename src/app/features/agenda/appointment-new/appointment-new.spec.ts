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
});
