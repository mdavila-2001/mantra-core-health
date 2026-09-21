import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Signal, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { TarjetaDelDia, type RatoDelDia } from './tarjeta-del-dia';
import type { ModalidadDeAtencion } from '../../../../core/data-access/scheduling/scheduling.types';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';

const DIA = new Date(2026, 8, 10);
const DESDE = new Date(2026, 8, 10, 10, 0);
const HASTA = new Date(2026, 8, 10, 10, 45);

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
  let fixture: ComponentFixture<TarjetaDelDia>;
  let http: HttpTestingController;

  async function montar(
    ratosTomados: readonly RatoDelDia[] = [],
    cupoId: string | null = null,
  ): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TarjetaDelDia],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TarjetaDelDia);
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
    readonly desde: WritableSignal<string>;
    readonly hasta: WritableSignal<string>;
    readonly motivo: WritableSignal<string>;
    readonly paciente: WritableSignal<ReferenceOption | null>;
    readonly modalidad: WritableSignal<ModalidadDeAtencion>;
    readonly puedeGuardar: Signal<boolean>;
    /**
     * El buscador de pacientes y sus resultados.
     *
     * Llegaron después de que este accesor pasara a tipado, y el hueco no lo vio
     * ningún merge: git no ve un conflicto entre «tipar una interfaz» y «usar un
     * miembro que no declara». Se descubrió compilando.
     */
    readonly candidatos: Signal<readonly ReferenceOption[]>;
    /** Si hay algo que se perdería al cerrar: decide si `Escape` pregunta (C-10). */
    readonly hayAlgoEscrito: Signal<boolean>;
    /** Si el alta salió de un cupo ya programado: la franja no se pregunta (C-10). */
    readonly desdeUnCupo: Signal<boolean>;
    buscarPaciente(texto: string): void;
    guardar(): void;
  }

  function api(): Testable {
    return fixture.componentInstance as unknown as Testable;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('el rato tocado prellena desde y hasta', async () => {
    await montar();

    expect(api().desde()).toBe('10:00');
    expect(api().hasta()).toBe('10:45');
  });

  it('sin paciente ni motivo no deja guardar: falta la única cosa', async () => {
    await montar();

    expect(api().puedeGuardar()).toBe(false);
  });

  it('con PACIENTE infiere cita puntual, y lo dice antes de guardar', async () => {
    // La inferencia visible: que la campana al paciente no sea una sorpresa.
    await montar();
    api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('le avisamos al paciente');

    api().guardar();
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
   * La modalidad de la atención — la teleconsulta desde la pantalla.
   *
   * La API la acepta desde la PR #251, pero hasta acá ninguna pantalla podía
   * mandarla: un doctor no tenía cómo declarar que atiende por video. Estas
   * pruebas fijan las tres mitades — que el control aparece cuando tiene
   * sentido, que el valor VIAJA (el cliente arma el cuerpo campo por campo y
   * descarta en silencio lo que no nombra), y que se dice antes de guardar.
   */
  describe('la modalidad de la atención', () => {
    it('no se ofrece sin paciente: un rato tuyo no se atiende por videollamada', async () => {
      await montar();
      api().motivo.set('Reunión de equipo');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.tarjeta__modalidad')).toBeNull();
    });

    it('aparece al elegir paciente, con presencial marcado', async () => {
      await montar();
      api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.tarjeta__modalidad')).not.toBeNull();
      expect(api().modalidad()).toBe('PRESENCIAL');
    });

    it('la teleconsulta VIAJA en el cuerpo de la petición', async () => {
      // Lo que el cliente descartaría si alguien olvidara nombrarla: el POST
      // saldría sin `channel` y nada fallaría — la cita quedaría presencial.
      await montar();
      api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
      api().modalidad.set('TELECONSULTA');
      fixture.detectChanges();

      api().guardar();
      const req = http.expectOne(
        (r) => r.url === '/scheduling/appointments/direct' && r.method === 'POST',
      );
      expect(req.request.body.channel).toBe('TELECONSULTA');
      req.flush({
        bookingId: 'bk-1',
        bookableSlotId: 's-1',
        statusConceptId: 'c',
        retractedSlots: 0,
      });
      http.verify();
    });

    it('presencial también viaja: elegirlo no es lo mismo que no decir nada', async () => {
      await montar();
      api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      api().guardar();
      const req = http.expectOne(
        (r) => r.url === '/scheduling/appointments/direct' && r.method === 'POST',
      );
      expect(req.request.body.channel).toBe('PRESENCIAL');
      req.flush({
        bookingId: 'bk-1',
        bookableSlotId: 's-1',
        statusConceptId: 'c',
        retractedSlots: 0,
      });
      http.verify();
    });

    it('avisa la videollamada antes de guardar, y no repite lo de siempre', async () => {
      // Lo que se sale de la norma se dice; «en el consultorio» en cada cita
      // presencial sería ruido.
      //
      // Se mira SÓLO la frase de inferencia y no la pantalla entera: los
      // rótulos de las tres opciones también dicen «videollamada», así que
      // aseverar sobre todo el texto probaría que el control existe, no que la
      // frase cambió.
      const inferencia = () =>
        (fixture.nativeElement.querySelector('.tarjeta__inferencia')?.textContent ?? '') as string;

      await montar();
      api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();
      expect(inferencia()).toContain('le avisamos al paciente');
      expect(inferencia()).not.toContain('videollamada');

      api().modalidad.set('TELECONSULTA');
      fixture.detectChanges();
      expect(inferencia()).toContain('Va por videollamada');

      api().modalidad.set('DOMICILIO');
      fixture.detectChanges();
      expect(inferencia()).toContain('Vas a su domicilio');
    });
  });

  it('con solo MOTIVO infiere tiempo ocupado, y lo dice', async () => {
    await montar();
    api().motivo.set('Reunión de equipo');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El paciente no ve nada');

    api().guardar();
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
    api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
    api().motivo.set('Cirugía de implante');

    api().guardar();
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
    api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });

    api().guardar();
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
    api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });

    api().guardar();
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
      api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
      // El campo ya no se dibuja, pero su señal existe: si el guardado la
      // mirara, esto mandaría la cita a las 08:00. La prueba es que no la mira.
      api().desde.set('08:00');
      api().hasta.set('08:15');
      fixture.detectChanges();

      api().guardar();
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
      expect(api().hayAlgoEscrito()).toBe(false);

      api().motivo.set('Control');
      fixture.detectChanges();
      expect(api().hayAlgoEscrito()).toBe(true);
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
    const BLOQUEO: RatoDelDia = {
      desde: new Date(2026, 8, 10, 9, 30),
      hasta: new Date(2026, 8, 10, 11, 0),
      rotulo: '«Reunión de equipo»',
      tipo: 'bloqueo',
    };

    it('con un bloqueo encima no se puede guardar, aunque esté todo completo', async () => {
      await montar([BLOQUEO]);
      api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      expect(api().puedeGuardar()).toBe(false);
    });

    it('y dice qué lo bloquea y qué hacer, no sólo que está tomado', async () => {
      await montar([BLOQUEO]);
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('está bloqueado por «Reunión de equipo»');
      expect(texto).toContain('quitá el bloqueo primero');
    });

    it('llamar a guardar igual NO manda nada: la regla no es el botón', async () => {
      // El botón deshabilitado no es una regla: `guardar()` se alcanza por
      // teclado, por el `submit` del formulario y desde acá.
      await montar([BLOQUEO]);
      api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      api().guardar();

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
      api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('pisa la cita de Beto');
      expect(api().puedeGuardar()).toBe(true);
    });
  });

  /**
   * C-21 (2026-09-20) — las opciones excluyentes son alternancia, no radios.
   */
  it('la modalidad se elige con el control segmentado, sin un solo radio', async () => {
    await montar();
    api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="tarjeta-modalidad"]')).not.toBeNull();
    expect(raiz.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    // Se anuncia como grupo y con su pregunta: un grupo sin nombre no se lee.
    const grupo = raiz.querySelector('[role="radiogroup"]');
    expect(grupo?.getAttribute('aria-label')).toBe('¿Cómo lo atendés?');
  });

  it('un rango invertido no deja guardar', async () => {
    await montar();
    api().paciente.set({ value: 'pp-ana', label: 'Ana Quispe' });
    api().desde.set('11:00');
    api().hasta.set('10:00');

    expect(api().puedeGuardar()).toBe(false);
  });

  it('busca pacientes y arma las opciones sin uuids a la vista', async () => {
    await montar();
    api().buscarPaciente('ana');

    http
      .expectOne((r) => r.url === '/profiles/patients')
      .flush({
        items: [
          { profileId: 'pp-1', personId: 'p-1', patientCode: 'PAC-001', displayName: 'Ana Quispe' },
        ],
        count: 1,
        limit: 10,
        nextCursor: null,
      });

    const opciones = api().candidatos();
    expect(opciones[0].label).toBe('Ana Quispe');
    expect(opciones[0].value).toBe('pp-1');
    http.verify();
  });
});
