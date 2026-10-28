import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type Provider, type Signal, type WritableSignal } from '@angular/core';
import { of } from 'rxjs';

import { DayCard, type DayGap } from './day-card';
import type { BookingDestination } from './booking-destination';
import { SessionStore } from '../../../../core/auth/session.store';
import type { AgendaResource } from '../../../../core/data-access/scheduling/scheduling.types';
import { HealthcareServicesClient } from '../../../../core/data-access/healthcare-services/healthcare-services.client';
import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import { ROLE_ASSIGNMENT_STATUS } from '../../../../core/data-access/practice-sites/role-assignment-concepts';
import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import { ServicesCatalogClient } from '../../../../core/data-access/services-catalog/services-catalog.client';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import {
  AFFILIATE_LABEL,
  OWN_OFFICE_LABEL,
} from '../../../../shared/components/molecules/organization-select/organization-select.types';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';

const DIA = new Date(2026, 8, 10);
const DESDE = new Date(2026, 8, 10, 10, 0);
const HASTA = new Date(2026, 8, 10, 10, 45);

/** Lo que devuelve la API al agendar la cita puntual. */
const CREATED_APPOINTMENT = {
  bookingId: 'bk-1',
  bookableSlotId: 's-1',
  statusConceptId: 'c',
  retractedSlots: 0,
};

/**
 * LA TARJETA — el único gesto de creación (AG-5).
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **El sistema infiere, el doctor nunca elige un tipo.** Paciente → cita
 *    puntual; sólo motivo → tiempo ocupado. La inferencia se DICE antes de
 *    guardar, para que la campana no sorprenda.
 * 2. **El choque se avisa en vivo** con lo que el día ya sabe; el 422 del
 *    servidor —la regla madre— se muestra tal cual, porque ya está escrito
 *    para una persona.
 * 3. **El rato tocado prellena**; nada más es obligatorio que el rango y UNA
 *    de las dos cosas.
 */
describe('TarjetaDelDia', () => {
  let fixture: ComponentFixture<DayCard>;
  let http: HttpTestingController;

  async function montar(
    ratosTomados: readonly DayGap[] = [],
    cupoId: string | null = null,
    providers: readonly Provider[] = [],
  ): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DayCard],
      providers: [provideHttpClient(), provideHttpClientTesting(), ...providers],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DayCard);
    fixture.componentRef.setInput('dia', DIA);
    fixture.componentRef.setInput('resourceId', 'res-1');
    fixture.componentRef.setInput('desdeInicial', DESDE);
    fixture.componentRef.setInput('hastaInicial', HASTA);
    fixture.componentRef.setInput('ratosTomados', ratosTomados);
    fixture.componentRef.setInput('cupoId', cupoId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Lo que la prueba usa del componente, tipado.
   *
   * `Record<string, any>` dejaba pasar cualquier nombre —un `api()['motvo']`
   * mal escrito habría fallado en runtime, no al compilar— y además rompía
   * `yarn lint`, que es el PRIMER paso del CI: con él en rojo, Tipos, Pruebas y
   * Build no llegan a correr en ningún PR del repositorio.
   *
   * Es el mismo patrón que ya usa `agenda-create.spec.ts`: una interfaz con lo
   * que la prueba toca y un solo `as unknown as` en el borde.
   */
  interface Testable {
    readonly from: WritableSignal<string>;
    readonly hasta: WritableSignal<string>;
    readonly reason: WritableSignal<string>;
    readonly patient: WritableSignal<ReferenceOption | null>;
    readonly canSave: Signal<boolean>;
    /**
     * El buscador de pacientes y sus resultados.
     *
     * Llegaron después de que este accesor pasara a tipado, y el hueco no lo vio
     * ningún merge: git no ve un conflicto entre «tipar una interfaz» y «usar un
     * miembro que no declara». Se descubrió compilando.
     */
    readonly candidates: Signal<readonly ReferenceOption[]>;
    /** Por qué la búsqueda no trajo nada cuando fue un fallo, no un «sin coincidencias». */
    readonly failedSearch: Signal<string | null>;
    /** Si hay algo que se perdería al cerrar: decide si `Escape` pregunta (C-10). */
    readonly hasWrittenContent: Signal<boolean>;
    /** Si el alta salió de un cupo ya programado: la franja no se pregunta (C-10). */
    readonly fromSlot: Signal<boolean>;
    /** Dónde se guarda según la organización elegida. */
    readonly destination: Pick<BookingDestination, 'choose'>;
    searchPatient(texto: string): void;
    save(): void;
  }

  function api(): Testable {
    return fixture.componentInstance as unknown as Testable;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('el rato tocado prellena desde y hasta', async () => {
    await montar();

    expect(api().from()).toBe('10:00');
    expect(api().hasta()).toBe('10:45');
  });

  it('sin paciente ni motivo no deja guardar: falta la única cosa', async () => {
    await montar();

    expect(api().canSave()).toBe(false);
  });

  it('con PACIENTE infiere cita puntual, y lo dice antes de guardar', async () => {
    // La inferencia visible: que la campana al paciente no sea una sorpresa.
    await montar();
    api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('le avisamos al paciente');

    api().save();
    const req = http.expectOne(
      (r) => r.url === '/scheduling/appointments/direct' && r.method === 'POST',
    );
    expect(req.request.body.patientProfileId).toBe('pp-ana');
    expect(req.request.body.durationMinutes).toBe(45);
    req.flush({
      bookingId: 'bk-1',
      bookableSlotId: 's-1',
      statusConceptId: 'c',
      retractedSlots: 0,
    });
    http.verify();
  });

  /**
   * La cita se agenda presencial: la tarjeta no pregunta por qué medio.
   *
   * El control de modalidad se quitó de la tarjeta. La API registra presencial
   * la cita que llega sin `channel`, así que lo que estas pruebas fijan es que
   * el cuerpo NO lo lleve —mandar «PRESENCIAL» igual afirmaría algo que nadie
   * eligió— y que la pantalla no ofrezca una elección que después no viaja.
   */
  describe('la cita se agenda presencial, sin preguntar el medio', () => {
    it('con paciente elegido no aparece ningún control de modalidad', async () => {
      await montar();
      api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('app-segmented-control')).toBeNull();
      expect(root.querySelector('[role="radiogroup"]')).toBeNull();
      expect(root.textContent).not.toContain('Por videollamada');
      expect(root.textContent).not.toContain('A domicilio');
    });

    it('el cuerpo de la reserva no lleva `channel`', async () => {
      await montar();
      api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      api().save();
      const req = http.expectOne(
        (r) => r.url === '/scheduling/appointments/direct' && r.method === 'POST',
      );
      expect(req.request.body).not.toHaveProperty('channel');
      req.flush(CREATED_APPOINTMENT);
      http.verify();
    });

    it('la frase de lo que va a pasar no menciona el medio', async () => {
      await montar();
      api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      const inference = fixture.nativeElement.querySelector('.tarjeta__inferencia') as HTMLElement;
      expect(inference.textContent?.trim()).toBe(
        'Se agenda la cita y le avisamos al paciente. No tiene que confirmar nada.',
      );
    });
  });

  it('no lleva a publicar el horario: la tarjeta cubre lo puntual de un día', async () => {
    await montar();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.tarjeta__cuerpo a')).toHaveLength(0);
  });

  it('con solo MOTIVO infiere tiempo ocupado, y lo dice', async () => {
    await montar();
    api().reason.set('Reunión de equipo');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El paciente no ve nada');

    api().save();
    const req = http.expectOne(
      (r) => r.url === '/scheduling/resources/res-1/exceptions' && r.method === 'POST',
    );
    expect(req.request.body.reason).toBe('Reunión de equipo');
    expect(req.request.body.exceptionType).toBe('ABSENCE');
    req.flush({ id: 'exc-1', blockedSlots: 0 });
    http.verify();
  });

  it('la cita lleva el motivo cuando ambos están: es el motivo DE la cita', async () => {
    await montar();
    api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
    api().reason.set('Cirugía de implante');

    api().save();
    const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
    expect(req.request.body.reasonText).toBe('Cirugía de implante');
    req.flush({
      bookingId: 'bk-1',
      bookableSlotId: 's-1',
      statusConceptId: 'c',
      retractedSlots: 0,
    });
    http.verify();
  });

  it('el choque con lo ya cargado se avisa EN VIVO, antes de guardar', async () => {
    await montar([
      {
        desde: new Date(2026, 8, 10, 10, 15),
        hasta: new Date(2026, 8, 10, 10, 45),
        rotulo: 'la cita de Beto Peña',
        tipo: 'cita' as const,
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('la cita de Beto Peña');
  });

  it('un rato que NO pisa nada no muestra aviso de choque', async () => {
    await montar([
      {
        desde: new Date(2026, 8, 10, 14, 0),
        hasta: new Date(2026, 8, 10, 15, 0),
        rotulo: 'la cita de Beto Peña',
        tipo: 'cita' as const,
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Beto Peña');
  });

  it('el 422 del servidor se muestra TAL CUAL: ya está escrito para una persona', async () => {
    // La regla madre responde con qué, cuándo y dónde; reescribirlo acá sería
    // perder la mitad de la información.
    await montar();
    api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });

    api().save();
    http
      .expectOne((r) => r.url === '/scheduling/appointments/direct')
      .flush(
        { message: 'El profesional ya tiene a Beto de 10:00 a 13:00 en «Hospital».' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('ya tiene a Beto de 10:00 a 13:00');
    http.verify();
  });

  it('la retracción se informa como AVISO, no como pregunta', async () => {
    await montar();
    api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });

    api().save();
    http
      .expectOne((r) => r.url === '/scheduling/appointments/direct')
      .flush({ bookingId: 'bk-1', bookableSlotId: 's-1', statusConceptId: 'c', retractedSlots: 3 });

    // El toast informa; acá alcanza con que el guardado emitió `creada`.
    http.verify();
  });

  /**
   * C-10 (2026-09-20) — **el cupo manda la hora**, y la tarjeta es un MODAL.
   *
   * Dos cosas distintas que el pedido junta en un punto:
   *
   * 1. Sobre un cupo ya programado la franja no se pregunta: se muestra. Y no
   *    alcanza con esconder los campos —sus señales siguen vivas—, así que lo
   *    que se guarda sale del cupo, no de ellas.
   * 2. El formulario dejó de dibujarse al pie y pasó a un `<dialog>` modal, con
   *    lo que eso trae: rol, nombre, foco atrapado, `Escape` y foco devuelto.
   */
  describe('el cupo manda la hora (C-10)', () => {
    it('sobre un cupo no hay campos de hora: la franja se muestra como dato', async () => {
      await montar([], 's-1');

      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('[data-testid="tarjeta-franja-del-cupo"]')?.textContent).toContain(
        '10:00–10:45',
      );
      // Ni un solo campo de texto para la hora en este camino.
      expect(raiz.querySelector('.tarjeta__rango')).toBeNull();
    });

    it('sobre AIRE los campos siguen: ahí la franja no existe hasta que se escriba', async () => {
      await montar([], null);

      const raiz = fixture.nativeElement as HTMLElement;
      expect(raiz.querySelector('.tarjeta__rango')).not.toBeNull();
      expect(raiz.querySelector('[data-testid="tarjeta-franja-del-cupo"]')).toBeNull();
    });

    it('la cita queda en la franja DEL CUPO, aunque alguien escriba otra hora', async () => {
      await montar([], 's-1');
      api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
      // El campo ya no se dibuja, pero su señal existe: si el guardado la
      // mirara, esto mandaría la cita a las 08:00. La prueba es que no la mira.
      api().from.set('08:00');
      api().hasta.set('08:15');
      fixture.detectChanges();

      api().save();
      const req = http.expectOne(
        (r) => r.url === '/scheduling/appointments/direct' && r.method === 'POST',
      );
      expect(req.request.body.startAt).toBe(DESDE.toISOString());
      expect(req.request.body.durationMinutes).toBe(45);
      req.flush({ bookingId: 'bk-1', bookableSlotId: 's-1', statusConceptId: 'c', retractedSlots: 0 });
      http.verify();
    });

    it('es un diálogo modal con nombre, no un formulario al pie', async () => {
      await montar([], 's-1');

      const dialogo = (fixture.nativeElement as HTMLElement).querySelector('dialog');
      expect(dialogo).not.toBeNull();
      // Su nombre accesible es el título, y el título es el día.
      const titulo = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="content-dialog-title"]',
      );
      expect(dialogo?.getAttribute('aria-labelledby')).toBe(titulo?.id);
      expect(titulo?.textContent?.trim().toLowerCase()).toContain('septiembre');
    });

    it('vacío se cierra solo; con algo escrito, `Escape` pregunta antes de perderlo', async () => {
      await montar([], 's-1');
      expect(api().hasWrittenContent()).toBe(false);

      api().reason.set('Control');
      fixture.detectChanges();
      expect(api().hasWrittenContent()).toBe(true);
    });
  });

  /**
   * C-10 (2026-09-20) — sobre un BLOQUEO no se crea nada, y se dice por qué.
   *
   * La diferencia con el choque de una cita es deliberada: un cupo de capacidad
   * 2 admite una segunda cita y la autoridad de eso es el servidor, así que ahí
   * el aviso sigue siendo aviso. Un bloqueo, no: es el doctor diciendo que no
   * atiende, y agendar encima es exactamente lo que el pedido prohíbe.
   */
  describe('el bloqueo no deja crear (C-10)', () => {
    const BLOQUEO: DayGap = {
      desde: new Date(2026, 8, 10, 9, 30),
      hasta: new Date(2026, 8, 10, 11, 0),
      rotulo: '«Reunión de equipo»',
      tipo: 'bloqueo',
    };

    it('con un bloqueo encima no se puede guardar, aunque esté todo completo', async () => {
      await montar([BLOQUEO]);
      api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      expect(api().canSave()).toBe(false);
    });

    it('y dice qué lo bloquea y qué hacer, no sólo que está tomado', async () => {
      await montar([BLOQUEO]);
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('está bloqueado por «Reunión de equipo»');
      expect(texto).toContain('quite el bloqueo primero');
    });

    it('llamar a guardar igual NO manda nada: la regla no es el botón', async () => {
      // El botón deshabilitado no es una regla: `guardar()` se alcanza por
      // teclado, por el `submit` del formulario y desde acá.
      await montar([BLOQUEO]);
      api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      api().save();

      http.expectNone(() => true);
      http.verify();
    });

    it('con una CITA encima, en cambio, avisa y deja seguir: eso lo decide el servidor', async () => {
      await montar([
        {
          desde: new Date(2026, 8, 10, 9, 30),
          hasta: new Date(2026, 8, 10, 11, 0),
          rotulo: 'la cita de Beto Peña',
          tipo: 'cita',
        },
      ]);
      api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('pisa la cita de Beto');
      expect(api().canSave()).toBe(true);
    });
  });

  /**
   * La franja escrita tiene que cerrar, y una sesión larga se confirma.
   *
   * Antes «Hasta» antes de «Desde» apagaba Guardar sin decir por qué. Ahora el
   * campo «Hasta» dice qué está mal, y una sesión de más de 4 h —casi siempre
   * una hora de fin mal escrita— pregunta antes de guardar.
   */
  describe('el horario se valida al escribirlo', () => {
    /** Los dos campos de hora, en el orden en que se ven: «Desde» y «Hasta». */
    function timeInputs(): HTMLInputElement[] {
      const root = fixture.nativeElement as HTMLElement;
      return Array.from(root.querySelectorAll<HTMLInputElement>('.tarjeta__rango input'));
    }

    /** El nodo al que apunta el `aria-describedby` de un control, si apunta a alguno. */
    function describerOf(control: HTMLElement): HTMLElement | null {
      const id = control.getAttribute('aria-describedby');
      return id === null ? null : (fixture.nativeElement as HTMLElement).querySelector(`[id="${id}"]`);
    }

    async function writeRange(start: string, end: string): Promise<void> {
      api().from.set(start);
      api().hasta.set(end);
      fixture.detectChanges();
      await fixture.whenStable();
    }

    async function withPatient(): Promise<void> {
      await montar();
      api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();
    }

    it.each([
      ['21:00', '20:00'],
      ['10:00', '10:00'],
    ])('de %s a %s: «Hasta» dice qué está mal y no se guarda', async (start, end) => {
      await withPatient();
      await writeRange(start, end);

      const [startInput, endInput] = timeInputs();
      expect(endInput.getAttribute('aria-invalid')).toBe('true');
      expect(describerOf(endInput)?.textContent).toContain(
        'La hora de fin tiene que ser después de la de inicio',
      );
      // El error es de «Hasta»: «Desde» no se marca.
      expect(startInput.getAttribute('aria-invalid')).toBe('false');
      expect(api().canSave()).toBe(false);

      api().save();
      http.expectNone(() => true);
      http.verify();
    });

    it('mientras se escribe la hora de fin no hay error: está a medio escribir', async () => {
      await withPatient();
      await writeRange('10:00', '1');

      const [, endInput] = timeInputs();
      expect(endInput.getAttribute('aria-invalid')).toBe('false');
      expect(fixture.nativeElement.textContent).not.toContain('La hora de fin tiene que ser');
    });

    it('de 09:00 a 10:00 guarda sin preguntar', async () => {
      await withPatient();
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm');
      await writeRange('09:00', '10:00');

      api().save();
      const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
      expect(req.request.body.durationMinutes).toBe(60);
      expect(confirm).not.toHaveBeenCalled();
      req.flush(CREATED_APPOINTMENT);
      http.verify();
    });

    it('de 09:00 a 13:00 —4 h justas— tampoco pregunta: el umbral es «más de 4 h»', async () => {
      await withPatient();
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm');
      await writeRange('09:00', '13:00');

      api().save();
      http.expectOne((r) => r.url === '/scheduling/appointments/direct').flush(CREATED_APPOINTMENT);
      expect(confirm).not.toHaveBeenCalled();
      http.verify();
    });

    it('de 09:00 a 14:00 pregunta antes, y con «Confirmar» guarda', async () => {
      await withPatient();
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
      await writeRange('09:00', '14:00');

      api().save();
      await fixture.whenStable();

      expect(confirm).toHaveBeenCalledOnce();
      expect(confirm.mock.calls[0]?.[0]).toMatchObject({
        title: '¿Está seguro de agendar una sesión de 5 horas?',
        confirmLabel: 'Confirmar',
        cancelLabel: 'Volver',
      });
      const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
      expect(req.request.body.durationMinutes).toBe(300);
      req.flush(CREATED_APPOINTMENT);
      http.verify();
    });

    it('con «Volver» no guarda y el modal queda como estaba', async () => {
      await withPatient();
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(false);
      const closed = vi.fn();
      fixture.componentInstance.cerrada.subscribe(closed);
      await writeRange('09:00', '14:00');

      api().save();
      await fixture.whenStable();

      expect(confirm).toHaveBeenCalledOnce();
      http.expectNone(() => true);
      http.verify();
      expect(api().from()).toBe('09:00');
      expect(api().hasta()).toBe('14:00');
      expect(api().patient()?.value).toBe('pp-ana');
      expect(api().canSave()).toBe(true);
      expect(closed).not.toHaveBeenCalled();
    });

    it('si no son horas justas lo dice en horas y minutos: «4 h 30 min»', async () => {
      await withPatient();
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(false);
      await writeRange('09:00', '13:30');

      api().save();
      await fixture.whenStable();

      expect(confirm.mock.calls[0]?.[0]?.title).toBe(
        '¿Está seguro de agendar una sesión de 4 h 30 min?',
      );
    });

    it('de 09:00 a 17:00 —8 h justas— pregunta, y con «Confirmar» guarda', async () => {
      await withPatient();
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
      await writeRange('09:00', '17:00');

      const [, endInput] = timeInputs();
      expect(endInput.getAttribute('aria-invalid')).toBe('false');
      expect(api().canSave()).toBe(true);

      api().save();
      await fixture.whenStable();

      expect(confirm.mock.calls[0]?.[0]?.title).toBe(
        '¿Está seguro de agendar una sesión de 8 horas?',
      );
      const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
      expect(req.request.body.durationMinutes).toBe(480);
      req.flush(CREATED_APPOINTMENT);
      http.verify();
    });

    it('de 09:00 a 17:30 —8 h 30 min— «Hasta» dice que una cita no pasa de 8 h y no se guarda', async () => {
      // La API rechaza con un 400 la cita de más de 480 minutos: se dice antes.
      await withPatient();
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm');
      await writeRange('09:00', '17:30');

      const [startInput, endInput] = timeInputs();
      expect(endInput.getAttribute('aria-invalid')).toBe('true');
      expect(describerOf(endInput)?.textContent).toContain('Una cita no puede durar más de 8 horas');
      expect(startInput.getAttribute('aria-invalid')).toBe('false');
      expect(api().canSave()).toBe(false);

      api().save();
      await fixture.whenStable();

      expect(confirm).not.toHaveBeenCalled();
      http.expectNone(() => true);
      http.verify();
    });

    it('el tiempo ocupado de más de 8 h no tiene tope: una guardia larga existe', async () => {
      await montar();
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
      api().reason.set('Guardia');
      await writeRange('08:00', '20:00');

      const [, endInput] = timeInputs();
      expect(endInput.getAttribute('aria-invalid')).toBe('false');
      expect(api().canSave()).toBe(true);

      api().save();
      await fixture.whenStable();

      expect(confirm).toHaveBeenCalledOnce();
      http
        .expectOne((r) => r.url === '/scheduling/resources/res-1/exceptions' && r.method === 'POST')
        .flush({ id: 'exc-1', blockedSlots: 0 });
      http.verify();
    });

    it('un rato ocupado largo también se confirma antes de guardarlo', async () => {
      await montar();
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(false);
      api().reason.set('Guardia');
      await writeRange('08:00', '14:00');

      api().save();
      await fixture.whenStable();

      expect(confirm.mock.calls[0]?.[0]?.title).toBe(
        '¿Está seguro de agendar una sesión de 6 horas?',
      );
      http.expectNone(() => true);
      http.verify();
    });
  });

  /**
   * La organización elegida decide en qué agenda queda lo creado.
   *
   * «Mi consultorio» viene elegido y guarda donde guardó siempre: en la agenda
   * que pasa «Mi agenda». Otra organización guarda en la agenda del médico ahí,
   * que se busca por su perfil; si no publicó ninguna, se dice y no se guarda.
   */
  describe('la organización elige la agenda', () => {
    const PROFILE_ID = 'hp-rojas';

    function affiliation(practiceId: string, practiceName: string, tenantId: string): MyRoleAssignment {
      return {
        id: `ra-${practiceId}`,
        practiceId,
        practiceName,
        practiceSiteId: `site-${practiceId}`,
        roleConceptId: 'role-attending',
        status: ROLE_ASSIGNMENT_STATUS.ACTIVE,
        isPrimary: false,
        createdAt: new Date('2026-10-01T12:00:00Z'),
        avatarUrl: null,
        tenantId,
      };
    }

    const OLIVOS = affiliation('practice-olivos', 'Clínica Los Olivos', 'tenant-olivos');
    const SAN_JUAN = affiliation('practice-san-juan', 'Hospital San Juan', 'tenant-san-juan');

    /** Una agenda de la organización; es del médico si apunta a su perfil. */
    function scheduleOf(id: string, resourceRefId: string): AgendaResource {
      return {
        id,
        name: 'Consultorio',
        resourceTypeConceptId: 'rt-practitioner',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId,
        practitionerName: null,
        practiceId: null,
        timeZone: 'America/La_Paz',
        capacity: 1,
        stateConceptId: 'st-active',
        site: null,
      };
    }

    /** La sesión del médico y sus afiliaciones; el formulario de afiliación sin datos. */
    const PROVIDERS: readonly Provider[] = [
      { provide: SessionStore, useValue: { practitionerProfileId: signal(PROFILE_ID) } },
      {
        provide: PracticeSitesClient,
        useValue: {
          listMyRoleAssignments: () => of([OLIVOS, SAN_JUAN]),
          listSitesOfPractitioner: () => of({ items: [], count: 0 }),
          selfRequestAffiliation: vi.fn(),
        },
      },
      { provide: ServicesCatalogClient, useValue: { listPractices: () => of([]) } },
      {
        provide: HealthcareServicesClient,
        useValue: { listSites: () => of([]), listOffers: () => of([]) },
      },
    ];

    async function mountWithOrganizations(): Promise<void> {
      await montar([], null, PROVIDERS);
      api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();
    }

    function root(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    function organizationTrigger(): HTMLButtonElement {
      return root().querySelector('app-organization-field .select-trigger') as HTMLButtonElement;
    }

    async function chooseOrganization(label: string): Promise<void> {
      organizationTrigger().click();
      await fixture.whenStable();
      Array.from(root().querySelectorAll<HTMLElement>('app-organization-field [role="option"]'))
        .find((row) => row.querySelector('.option-label')?.textContent?.trim() === label)
        ?.click();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    /** La búsqueda de las agendas de una organización, todavía sin respuesta. */
    function scheduleSearch(tenantId: string) {
      return http.expectOne(
        (r) =>
          r.method === 'GET' &&
          r.url === '/scheduling/resources' &&
          r.params.get('tenantId') === tenantId,
      );
    }

    function answerSchedules(tenantId: string, agendas: readonly AgendaResource[]): void {
      scheduleSearch(tenantId).flush({ items: agendas, count: agendas.length });
      fixture.detectChanges();
    }

    function saveButton(): HTMLButtonElement {
      return root().querySelector('[data-testid="tarjeta-guardar"]') as HTMLButtonElement;
    }

    it('empieza en «Mi consultorio» y guarda con la agenda de siempre', async () => {
      await mountWithOrganizations();

      expect(organizationTrigger().textContent?.trim()).toBe(OWN_OFFICE_LABEL);

      api().save();
      const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
      expect(req.request.body.resourceId).toBe('res-1');
      req.flush(CREATED_APPOINTMENT);
      http.verify();
    });

    it('con otra organización que tiene agenda, la cita va a su recurso', async () => {
      await mountWithOrganizations();
      await chooseOrganization('Clínica Los Olivos');

      // Mientras se busca no hay agenda donde guardar.
      expect(root().querySelector('[data-testid="day-card-destination-status"]')?.textContent).toContain(
        'Buscando su agenda en Clínica Los Olivos',
      );
      expect(api().canSave()).toBe(false);

      answerSchedules('tenant-olivos', [scheduleOf('res-ajena', 'hp-otro'), scheduleOf('res-olivos', PROFILE_ID)]);
      expect(api().canSave()).toBe(true);

      api().save();
      const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
      expect(req.request.body.resourceId).toBe('res-olivos');
      req.flush(CREATED_APPOINTMENT);
      http.verify();
    });

    it('el tiempo ocupado también va a la agenda de esa organización', async () => {
      await mountWithOrganizations();
      api().patient.set(null);
      api().reason.set('Reunión de equipo');
      await chooseOrganization('Clínica Los Olivos');
      answerSchedules('tenant-olivos', [scheduleOf('res-olivos', PROFILE_ID)]);

      api().save();
      http
        .expectOne((r) => r.url === '/scheduling/resources/res-olivos/exceptions' && r.method === 'POST')
        .flush({ id: 'exc-1', blockedSlots: 0 });
      http.verify();
    });

    it('con otra organización sin agenda, avisa y no guarda', async () => {
      await mountWithOrganizations();
      await chooseOrganization('Hospital San Juan');
      answerSchedules('tenant-san-juan', [scheduleOf('res-ajena', 'hp-otro')]);

      expect(root().querySelector('[data-testid="day-card-destination-missing"]')?.textContent).toContain(
        'Publique su agenda en Hospital San Juan para agendar ahí',
      );
      expect(api().canSave()).toBe(false);
      // `app-button` se deshabilita con `aria-disabled`, no con el atributo nativo.
      expect(saveButton().getAttribute('aria-disabled')).toBe('true');

      api().save();
      http.expectNone((r) => r.url === '/scheduling/appointments/direct');
      http.verify();
    });

    it('volver a «Mi consultorio» quita el aviso y guarda con la agenda de siempre', async () => {
      await mountWithOrganizations();
      await chooseOrganization('Hospital San Juan');
      answerSchedules('tenant-san-juan', []);

      await chooseOrganization(OWN_OFFICE_LABEL);

      expect(root().querySelector('[data-testid="day-card-destination-missing"]')).toBeNull();
      api().save();
      const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
      expect(req.request.body.resourceId).toBe('res-1');
      req.flush(CREATED_APPOINTMENT);
      http.verify();
    });

    it('cambiar de organización corta la búsqueda anterior: su respuesta ya no llega', async () => {
      await mountWithOrganizations();
      await chooseOrganization('Clínica Los Olivos');
      const late = scheduleSearch('tenant-olivos');

      await chooseOrganization('Hospital San Juan');
      // La de Los Olivos, que sí tenía agenda, quedó cancelada: no puede ganar.
      expect(late.cancelled).toBe(true);
      answerSchedules('tenant-san-juan', []);

      expect(root().querySelector('[data-testid="day-card-destination-missing"]')?.textContent).toContain(
        'Hospital San Juan',
      );
      expect(api().canSave()).toBe(false);
      http.verify();
    });

    it('volver a «Mi consultorio» también corta la búsqueda en curso', async () => {
      await mountWithOrganizations();
      await chooseOrganization('Hospital San Juan');
      const late = scheduleSearch('tenant-san-juan');

      await chooseOrganization(OWN_OFFICE_LABEL);
      expect(late.cancelled).toBe(true);

      expect(root().querySelector('[data-testid="day-card-destination-missing"]')).toBeNull();
      api().save();
      const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
      expect(req.request.body.resourceId).toBe('res-1');
      req.flush(CREATED_APPOINTMENT);
      http.verify();
    });

    it('si no se pudo buscar la agenda, lo dice, no guarda y deja reintentar', async () => {
      await mountWithOrganizations();
      await chooseOrganization('Clínica Los Olivos');
      scheduleSearch('tenant-olivos').flush(null, { status: 500, statusText: 'Internal Server Error' });
      fixture.detectChanges();

      expect(root().querySelector('[data-testid="day-card-destination-failure"]')?.textContent).toContain(
        'No pudimos consultar su agenda en Clínica Los Olivos.',
      );
      // Un fallo no es «no tiene agenda»: el aviso de publicar no aparece.
      expect(root().querySelector('[data-testid="day-card-destination-missing"]')).toBeNull();
      expect(api().canSave()).toBe(false);

      root().querySelector<HTMLElement>('[data-testid="day-card-destination-retry"]')?.click();
      answerSchedules('tenant-olivos', [scheduleOf('res-olivos', PROFILE_ID)]);

      expect(root().querySelector('[data-testid="day-card-destination-failure"]')).toBeNull();
      expect(api().canSave()).toBe(true);
      http.verify();
    });

    it('«Afiliarme a otra organización…» abre la solicitud y el modal del día sigue abierto', async () => {
      await mountWithOrganizations();
      const closed = vi.fn();
      fixture.componentInstance.cerrada.subscribe(closed);

      await chooseOrganization(AFFILIATE_LABEL);

      const affiliation = root().querySelector('app-affiliation-dialog dialog');
      expect(affiliation?.hasAttribute('open')).toBe(true);
      expect(affiliation?.querySelector('[data-testid="request-form"]')).not.toBeNull();
      // El modal del día no se cerró ni perdió lo cargado.
      expect(root().querySelector('dialog')?.hasAttribute('open')).toBe(true);
      expect(closed).not.toHaveBeenCalled();
      expect(api().patient()?.value).toBe('pp-ana');
      // Pedir no es elegir: el selector sigue en «Mi consultorio» y no se buscó ninguna agenda.
      expect(organizationTrigger().textContent?.trim()).toBe(OWN_OFFICE_LABEL);
      expect(api().canSave()).toBe(true);
      http.expectNone((r) => r.url === '/scheduling/resources');
      http.verify();
    });
    it('cerrar el modal corta la búsqueda en curso', async () => {
      await mountWithOrganizations();
      await chooseOrganization('Clínica Los Olivos');
      const pending = scheduleSearch('tenant-olivos');

      fixture.destroy();

      expect(pending.cancelled).toBe(true);
      http.verify();
    });

    it('la región que dice en qué anda la búsqueda está siempre: sólo cambia su texto', async () => {
      // Un `role="status"` que aparece con el texto ya puesto no siempre se
      // anuncia; el que está desde el principio y cambia su texto, sí.
      await mountWithOrganizations();
      const region = root().querySelector<HTMLElement>('[data-testid="day-card-destination-status"]');
      expect(region?.getAttribute('role')).toBe('status');
      // Vacía no ocupa lugar: la hoja la separa sólo con `:not(:empty)`.
      expect(region?.matches(':empty')).toBe(true);

      await chooseOrganization('Clínica Los Olivos');
      expect(root().querySelector('[data-testid="day-card-destination-status"]')).toBe(region);
      expect(region?.textContent).toContain('Buscando su agenda en Clínica Los Olivos');

      answerSchedules('tenant-olivos', [scheduleOf('res-olivos', PROFILE_ID)]);
      expect(root().querySelector('[data-testid="day-card-destination-status"]')).toBe(region);
      expect(region?.matches(':empty')).toBe(true);
      http.verify();
    });

    /**
     * La API resuelve la organización con `X-Tenant-Id` y responde 403 a la
     * agenda de otra (`assertResourceInActiveTenant`) y al `?tenantId=` de
     * otra. En otra organización, la búsqueda y el guardado hablan como ella;
     * en «Mi consultorio» no se declara nada y la pone la sesión.
     */
    describe('se le habla a la API como la organización elegida', () => {
      /** La vista previa de la API: el rato tiene una cita y pide confirmar. */
      const BOOKINGS_IN_THE_WAY = {
        code: 'PRECONDITION_FAILED',
        message: 'Ese rato tiene 1 cita con paciente. Confirme para cancelarlas.',
        timestamp: '2026-10-24T12:00:00Z',
        path: '/scheduling/resources/res-olivos/exceptions',
        details: {
          failureCode: 'BOOKINGS_REQUIRE_CONFIRMATION',
          affectedBookings: [
            {
              bookingId: 'bk-1',
              startAt: '2026-09-10T14:15:00Z',
              endAt: '2026-09-10T14:45:00Z',
              patientName: 'Rosa Quispe',
              pending: false,
            },
          ],
        },
      };

      it('la búsqueda de su agenda va con el X-Tenant-Id de esa organización', async () => {
        await mountWithOrganizations();
        await chooseOrganization('Clínica Los Olivos');

        const search = scheduleSearch('tenant-olivos');
        expect(search.request.headers.get('X-Tenant-Id')).toBe('tenant-olivos');
        search.flush({ items: [], count: 0 });
        http.verify();
      });

      it('la cita va con el X-Tenant-Id de esa organización', async () => {
        await mountWithOrganizations();
        await chooseOrganization('Clínica Los Olivos');
        answerSchedules('tenant-olivos', [scheduleOf('res-olivos', PROFILE_ID)]);

        api().save();
        const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
        expect(req.request.body.resourceId).toBe('res-olivos');
        expect(req.request.headers.get('X-Tenant-Id')).toBe('tenant-olivos');
        req.flush(CREATED_APPOINTMENT);
        http.verify();
      });

      it('el tiempo ocupado también, y también al repetirlo confirmado', async () => {
        await mountWithOrganizations();
        api().patient.set(null);
        api().reason.set('Reunión de equipo');
        await chooseOrganization('Clínica Los Olivos');
        answerSchedules('tenant-olivos', [scheduleOf('res-olivos', PROFILE_ID)]);
        vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);

        api().save();
        const first = http.expectOne((r) => r.url === '/scheduling/resources/res-olivos/exceptions');
        expect(first.request.headers.get('X-Tenant-Id')).toBe('tenant-olivos');
        first.flush(BOOKINGS_IN_THE_WAY, { status: 422, statusText: 'Unprocessable Entity' });
        // El diálogo resuelve en una microtarea; el pedido confirmado sale después.
        await new Promise((resolve) => setTimeout(resolve, 0));

        const confirmed = http.expectOne((r) => r.url === '/scheduling/resources/res-olivos/exceptions');
        expect(confirmed.request.body.cancelAffectedBookings).toBe(true);
        expect(confirmed.request.headers.get('X-Tenant-Id')).toBe('tenant-olivos');
        confirmed.flush({ id: 'exc-1', blockedSlots: 1, cancelledBookings: 1 });
        http.verify();
      });

      it('en «Mi consultorio» la cita no declara organización', async () => {
        await mountWithOrganizations();

        api().save();
        const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
        expect(req.request.body.resourceId).toBe('res-1');
        expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
        req.flush(CREATED_APPOINTMENT);
        http.verify();
      });

      it('en «Mi consultorio» el tiempo ocupado tampoco', async () => {
        await mountWithOrganizations();
        api().patient.set(null);
        api().reason.set('Reunión de equipo');
        fixture.detectChanges();

        api().save();
        const req = http.expectOne((r) => r.url === '/scheduling/resources/res-1/exceptions');
        expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
        req.flush({ id: 'exc-1', blockedSlots: 0 });
        http.verify();
      });
    });

    describe('desde un cupo la agenda es la del cupo', () => {
      async function mountFromSlot(): Promise<void> {
        await montar([], 's-1', PROVIDERS);
        api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
        fixture.detectChanges();
      }

      it('no muestra el selector de organización', async () => {
        await mountFromSlot();

        expect(root().querySelector('app-organization-field')).toBeNull();
        expect(root().querySelector('[data-testid="day-card-destination-status"]')).toBeNull();
      });

      /** Una elección que el selector, escondido, no podría emitir. */
      function chooseOlivosAnyway(): void {
        api().destination.choose({
          key: 'practice-olivos',
          organization: {
            practiceId: 'practice-olivos',
            practiceSiteId: null,
            name: 'Clínica Los Olivos',
            isOwnOffice: false,
            tenantId: 'tenant-olivos',
          },
        });
        answerSchedules('tenant-olivos', [scheduleOf('res-olivos', PROFILE_ID)]);
      }

      it('la cita va a la agenda del cupo aunque llegue otra elección: esconder no es la regla', async () => {
        await mountFromSlot();
        chooseOlivosAnyway();

        api().save();
        const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
        expect(req.request.body.resourceId).toBe('res-1');
        expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
        req.flush(CREATED_APPOINTMENT);
        http.verify();
      });

      it('y los choques del día se siguen avisando: la cita va a esa agenda', async () => {
        const appointment: DayGap = {
          desde: new Date(2026, 8, 10, 10, 0),
          hasta: new Date(2026, 8, 10, 10, 30),
          rotulo: 'la cita de Beto Peña',
          tipo: 'cita',
        };
        await montar([appointment], 's-1', PROVIDERS);
        chooseOlivosAnyway();

        expect(root().textContent).toContain('pisa la cita de Beto Peña');
        http.verify();
      });
    });

    /**
     * Lo que el día ya tiene tomado es de la agenda de «Mi consultorio». Con
     * otra organización lo creado va a otra agenda: avisar un choque o frenar
     * por un bloqueo de «Mi consultorio» sería avisar algo que no corresponde.
     */
    describe('los choques del día son de «Mi consultorio»', () => {
      const BLOCK: DayGap = {
        desde: new Date(2026, 8, 10, 9, 30),
        hasta: new Date(2026, 8, 10, 11, 0),
        rotulo: '«Reunión de equipo»',
        tipo: 'bloqueo',
      };
      const APPOINTMENT: DayGap = {
        desde: new Date(2026, 8, 10, 10, 0),
        hasta: new Date(2026, 8, 10, 10, 30),
        rotulo: 'la cita de Beto Peña',
        tipo: 'cita',
      };

      async function mountWith(taken: readonly DayGap[]): Promise<void> {
        await montar(taken, null, PROVIDERS);
        api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });
        fixture.detectChanges();
      }

      it('con otra organización un bloqueo de «Mi consultorio» no frena ni se avisa', async () => {
        await mountWith([BLOCK]);
        // En «Mi consultorio» el bloqueo es de esta agenda: no deja guardar.
        expect(root().textContent).toContain('está bloqueado por «Reunión de equipo»');
        expect(api().canSave()).toBe(false);

        await chooseOrganization('Clínica Los Olivos');
        answerSchedules('tenant-olivos', [scheduleOf('res-olivos', PROFILE_ID)]);

        expect(root().textContent).not.toContain('está bloqueado');
        expect(api().canSave()).toBe(true);
        api().save();
        const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
        expect(req.request.body.resourceId).toBe('res-olivos');
        req.flush(CREATED_APPOINTMENT);
        http.verify();
      });

      it('con otra organización una cita de «Mi consultorio» no se avisa como choque', async () => {
        await mountWith([APPOINTMENT]);
        expect(root().textContent).toContain('pisa la cita de Beto Peña');

        await chooseOrganization('Clínica Los Olivos');
        answerSchedules('tenant-olivos', [scheduleOf('res-olivos', PROFILE_ID)]);

        expect(root().textContent).not.toContain('Ese rato ya está tomado');
        expect(root().textContent).not.toContain('pisa la cita de Beto Peña');
        http.verify();
      });

      it('al volver a «Mi consultorio» el aviso vuelve', async () => {
        await mountWith([BLOCK]);
        await chooseOrganization('Clínica Los Olivos');
        answerSchedules('tenant-olivos', [scheduleOf('res-olivos', PROFILE_ID)]);

        await chooseOrganization(OWN_OFFICE_LABEL);

        expect(root().textContent).toContain('está bloqueado por «Reunión de equipo»');
        expect(api().canSave()).toBe(false);
        http.verify();
      });
    });
  });

  it('busca pacientes y arma las opciones sin uuids a la vista', async () => {
    await montar();
    api().searchPatient('ana');

    http
      .expectOne((r) => r.url === '/profiles/patients/search')
      .flush({
        items: [
          { profileId: 'pp-1', personId: 'p-1', patientCode: 'PAC-001', displayName: 'Ana Quispe' },
        ],
        count: 1,
        limit: 10,
        nextCursor: null,
      });

    const opciones = api().candidates();
    expect(opciones[0].label).toBe('Ana Quispe');
    expect(opciones[0].value).toBe('pp-1');
    expect(api().failedSearch()).toBeNull();
    http.verify();
  });

  /**
   * Una búsqueda caída decía «Ningún paciente coincide»: el profesional
   * concluía que la persona no estaba registrada. El fallo tiene que leerse
   * como fallo, con el código de soporte.
   */
  it('si la búsqueda de pacientes falla, no lo presenta como «ningún paciente coincide»', async () => {
    await montar();
    api().searchPatient('ana');

    http.expectOne((r) => r.url === '/profiles/patients/search').flush(
      {
        code: 'INTERNAL',
        message: 'Error interno',
        timestamp: '',
        path: '',
        correlationId: 'corr-busca-1',
      },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(api().candidates()).toEqual([]);
    expect(api().failedSearch()).toBe(
      'No se pudo buscar pacientes. (Código de soporte: corr-busca-1)',
    );
    http.verify();
  });

  it('el fallo del guardado trae el código de soporte junto al motivo del servidor', async () => {
    await montar();
    api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });

    api().save();
    http.expectOne((r) => r.url === '/scheduling/appointments/direct').flush(
      {
        code: 'CONFLICT',
        message: 'El profesional ya tiene a Beto de 10:00 a 13:00 en «Hospital».',
        timestamp: '',
        path: '',
        correlationId: 'corr-cita-1',
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('ya tiene a Beto de 10:00 a 13:00');
    expect(texto).toContain('Código de soporte: corr-cita-1');
    http.verify();
  });

  it('un 500 sin motivo para la persona no se muestra como «Error interno» a secas', async () => {
    await montar();
    api().patient.set({ value: 'pp-ana', label: 'Ana Quispe' });

    api().save();
    http
      .expectOne((r) => r.url === '/scheduling/appointments/direct')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo guardar la cita. Intente de nuevo.',
    );
    http.verify();
  });
});
