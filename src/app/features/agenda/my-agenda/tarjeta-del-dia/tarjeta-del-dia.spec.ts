import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TarjetaDelDia, type RatoDelDia } from './tarjeta-del-dia';

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

  async function montar(ratosTomados: readonly RatoDelDia[] = []): Promise<void> {
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
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function api(): Record<string, any> {
    return fixture.componentInstance as unknown as Record<string, any>;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('el rato tocado prellena desde y hasta', async () => {
    await montar();

    expect(api()['desde']()).toBe('10:00');
    expect(api()['hasta']()).toBe('10:45');
  });

  it('sin paciente ni motivo no deja guardar: falta la única cosa', async () => {
    await montar();

    expect(api()['puedeGuardar']()).toBe(false);
  });

  it('con PACIENTE infiere cita puntual, y lo dice antes de guardar', async () => {
    // La inferencia visible: que la campana al paciente no sea una sorpresa.
    await montar();
    api()['paciente'].set({ value: 'pp-ana', label: 'Ana Quispe' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('le avisamos al paciente');

    api()['guardar']();
    const req = http.expectOne(
      (r) => r.url === '/scheduling/appointments/direct' && r.method === 'POST',
    );
    expect(req.request.body.patientProfileId).toBe('pp-ana');
    expect(req.request.body.durationMinutes).toBe(45);
    req.flush({ bookingId: 'bk-1', bookableSlotId: 's-1', statusConceptId: 'c', retractedSlots: 0 });
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
      api()['motivo'].set('Reunión de equipo');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.tarjeta__modalidad')).toBeNull();
    });

    it('aparece al elegir paciente, con presencial marcado', async () => {
      await montar();
      api()['paciente'].set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.tarjeta__modalidad')).not.toBeNull();
      expect(api()['modalidad']()).toBe('PRESENCIAL');
    });

    it('la teleconsulta VIAJA en el cuerpo de la petición', async () => {
      // Lo que el cliente descartaría si alguien olvidara nombrarla: el POST
      // saldría sin `channel` y nada fallaría — la cita quedaría presencial.
      await montar();
      api()['paciente'].set({ value: 'pp-ana', label: 'Ana Quispe' });
      api()['modalidad'].set('TELECONSULTA');
      fixture.detectChanges();

      api()['guardar']();
      const req = http.expectOne(
        (r) => r.url === '/scheduling/appointments/direct' && r.method === 'POST',
      );
      expect(req.request.body.channel).toBe('TELECONSULTA');
      req.flush({ bookingId: 'bk-1', bookableSlotId: 's-1', statusConceptId: 'c', retractedSlots: 0 });
      http.verify();
    });

    it('presencial también viaja: elegirlo no es lo mismo que no decir nada', async () => {
      await montar();
      api()['paciente'].set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();

      api()['guardar']();
      const req = http.expectOne(
        (r) => r.url === '/scheduling/appointments/direct' && r.method === 'POST',
      );
      expect(req.request.body.channel).toBe('PRESENCIAL');
      req.flush({ bookingId: 'bk-1', bookableSlotId: 's-1', statusConceptId: 'c', retractedSlots: 0 });
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
        (fixture.nativeElement.querySelector('.tarjeta__inferencia')?.textContent ??
          '') as string;

      await montar();
      api()['paciente'].set({ value: 'pp-ana', label: 'Ana Quispe' });
      fixture.detectChanges();
      expect(inferencia()).toContain('le avisamos al paciente');
      expect(inferencia()).not.toContain('videollamada');

      api()['modalidad'].set('TELECONSULTA');
      fixture.detectChanges();
      expect(inferencia()).toContain('Va por videollamada');

      api()['modalidad'].set('DOMICILIO');
      fixture.detectChanges();
      expect(inferencia()).toContain('Vas a su domicilio');
    });
  });

  it('con solo MOTIVO infiere tiempo ocupado, y lo dice', async () => {
    await montar();
    api()['motivo'].set('Reunión de equipo');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('El paciente no ve nada');

    api()['guardar']();
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
    api()['paciente'].set({ value: 'pp-ana', label: 'Ana Quispe' });
    api()['motivo'].set('Cirugía de implante');

    api()['guardar']();
    const req = http.expectOne((r) => r.url === '/scheduling/appointments/direct');
    expect(req.request.body.reasonText).toBe('Cirugía de implante');
    req.flush({ bookingId: 'bk-1', bookableSlotId: 's-1', statusConceptId: 'c', retractedSlots: 0 });
    http.verify();
  });

  it('el choque con lo ya cargado se avisa EN VIVO, antes de guardar', async () => {
    await montar([
      {
        desde: new Date(2026, 8, 10, 10, 15),
        hasta: new Date(2026, 8, 10, 10, 45),
        rotulo: 'la cita de Beto Peña',
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
      },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Beto Peña');
  });

  it('el 422 del servidor se muestra TAL CUAL: ya está escrito para una persona', async () => {
    // La regla madre responde con qué, cuándo y dónde; reescribirlo acá sería
    // perder la mitad de la información.
    await montar();
    api()['paciente'].set({ value: 'pp-ana', label: 'Ana Quispe' });

    api()['guardar']();
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
    api()['paciente'].set({ value: 'pp-ana', label: 'Ana Quispe' });

    api()['guardar']();
    http
      .expectOne((r) => r.url === '/scheduling/appointments/direct')
      .flush({ bookingId: 'bk-1', bookableSlotId: 's-1', statusConceptId: 'c', retractedSlots: 3 });

    // El toast informa; acá alcanza con que el guardado emitió `creada`.
    http.verify();
  });

  it('un rango invertido no deja guardar', async () => {
    await montar();
    api()['paciente'].set({ value: 'pp-ana', label: 'Ana Quispe' });
    api()['desde'].set('11:00');
    api()['hasta'].set('10:00');

    expect(api()['puedeGuardar']()).toBe(false);
  });

  it('busca pacientes y arma las opciones sin uuids a la vista', async () => {
    await montar();
    api()['buscarPaciente']('ana');

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

    const opciones = api()['candidatos']();
    expect(opciones[0].label).toBe('Ana Quispe');
    expect(opciones[0].value).toBe('pp-1');
    http.verify();
  });
});
