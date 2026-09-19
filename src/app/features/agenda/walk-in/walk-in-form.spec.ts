import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WalkInForm, type TurnoDeMostrador } from './walk-in-form';

const RECURSO = '33333333-3333-3333-3333-333333333333';

/**
 * **INGRESO POR MOSTRADOR** — AC-C3-03.
 *
 * *«Botón "Ingreso Mostrador" en cabecera de agenda abre modal reactivo que
 * busca paciente por CI o nombre y crea la cita inmediata.»*
 *
 * Lo que estas pruebas fijan es la bifurcación, que es donde se rompe: el
 * paciente registrado va por `appointments/direct` y el que no está en el
 * sistema por `appointments/walk-in`, que es el único que crea persona y
 * atención en la misma transacción. Y que el 409 —«ese documento ya está
 * registrado»— no deje a nadie tecleando la cédula de nuevo.
 */
describe('WalkInForm', () => {
  let fixture: ComponentFixture<WalkInForm>;
  let http: HttpTestingController;
  let emitidos: TurnoDeMostrador[];

  function crear(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(WalkInForm);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('resourceId', RECURSO);
    emitidos = [];
    fixture.componentInstance.creado.subscribe((t) => emitidos.push(t));
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  /** Lo protegido, que es lo que la plantilla ve. */
  function instancia(): {
    paciente: { set(v: { value: string; label: string } | null): void };
    buscarPaciente(texto: string): void;
    registrarNuevo(): void;
    volverABuscar(): void;
    guardar(): void;
    puedeGuardar(): boolean;
    nuevoNombre: { set(v: string): void };
    nuevoApellido: { set(v: string): void };
    nuevoDocumento: { set(v: string): void; (): string };
    nuevoTelefono: { set(v: string): void };
    motivo: { set(v: string): void };
  } {
    return fixture.componentInstance as never;
  }

  /** Completa la filiación mínima que la API exige. */
  function completarAlta(): void {
    const c = instancia();
    c.nuevoNombre.set('Rosa');
    c.nuevoApellido.set('Ticona');
    c.nuevoDocumento.set('8123456');
    c.nuevoTelefono.set('+591 71234567');
    fixture.detectChanges();
  }

  /* -- La búsqueda ---------------------------------------------------------- */

  it('una cédula se busca por documento y un nombre por texto libre', () => {
    // `q` es texto libre sobre el nombre y el código: una cédula por ahí no
    // encuentra a nadie, y el mostrador concluiría que hay que darla de alta.
    crear();

    instancia().buscarPaciente('8123456');
    const porDocumento = http.expectOne((r) => r.url === '/profiles/patients');
    expect(porDocumento.request.params.get('nationalId')).toBe('8123456');
    expect(porDocumento.request.params.get('q')).toBeNull();
    porDocumento.flush({ items: [], count: 0, limit: 10, nextCursor: null });

    instancia().buscarPaciente('Rosa Ticona');
    const porNombre = http.expectOne((r) => r.url === '/profiles/patients');
    expect(porNombre.request.params.get('q')).toBe('Rosa Ticona');
    expect(porNombre.request.params.get('nationalId')).toBeNull();
    porNombre.flush({ items: [], count: 0, limit: 10, nextCursor: null });
  });

  it('si la búsqueda falla, el mostrador sigue pudiendo dar de alta', () => {
    // Que la lista no cargue no puede dejar a alguien esperando de pie.
    crear();
    instancia().buscarPaciente('Rosa');
    http
      .expectOne((r) => r.url === '/profiles/patients')
      .flush({ message: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    instancia().registrarNuevo();
    completarAlta();
    expect(instancia().puedeGuardar()).toBe(true);
  });

  /* -- Paciente ya registrado ----------------------------------------------- */

  it('con alguien elegido agenda la cita puntual y no toca el walk-in', () => {
    crear();
    instancia().paciente.set({ value: 'pac-1', label: 'Rosa Ticona' });
    instancia().motivo.set('Dolor de garganta');
    fixture.detectChanges();
    instancia().guardar();

    http.expectNone('/scheduling/appointments/walk-in');
    const cita = http.expectOne('/scheduling/appointments/direct');
    expect(cita.request.method).toBe('POST');
    expect(cita.request.body.patientProfileId).toBe('pac-1');
    expect(cita.request.body.resourceId).toBe(RECURSO);
    expect(cita.request.body.reasonText).toBe('Dolor de garganta');
    cita.flush({
      bookingId: 'book-1',
      bookableSlotId: 'slot-1',
      statusConceptId: 'st-1',
      retractedSlots: 2,
    });

    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].bookingId).toBe('book-1');
    expect(emitidos[0].esAltaNueva).toBe(false);
    // La cita puntual no abre encuentro; sólo el walk-in lo trae.
    expect(emitidos[0].encounterId).toBeNull();
    expect(emitidos[0].retractedSlots).toBe(2);
  });

  it('elegido alguien, pasar a «paciente nuevo» no agenda con el de antes', () => {
    // La bifurcación mira el PASO, no si quedó alguien en la lista.
    crear();
    instancia().paciente.set({ value: 'pac-1', label: 'Rosa Ticona' });
    instancia().registrarNuevo();
    completarAlta();
    instancia().guardar();

    http.expectNone('/scheduling/appointments/direct');
    http
      .expectOne('/scheduling/appointments/walk-in')
      .flush({}, { status: 500, statusText: 'Server Error' });
  });

  /* -- Paciente sin ficha ---------------------------------------------------- */

  it('registra y atiende en una sola petición, con la filiación adentro', () => {
    crear();
    instancia().registrarNuevo();
    completarAlta();
    instancia().guardar();

    const turno = http.expectOne('/scheduling/appointments/walk-in');
    expect(turno.request.method).toBe('POST');
    expect(turno.request.body.patient.name).toBe('Rosa');
    expect(turno.request.body.patient.lastName).toBe('Ticona');
    expect(turno.request.body.patient.nationalId).toBe('8123456');
    expect(turno.request.body.patient.phone).toBe('+591 71234567');
    // Los opcionales vacíos NO se mandan: `forbidNonWhitelisted` no distingue
    // «sin dato» de «dato vacío», y una clave de más rebota la petición entera.
    expect('middleName' in turno.request.body.patient).toBe(false);
    expect('birthDate' in turno.request.body.patient).toBe(false);
    expect('guardianName' in turno.request.body.patient).toBe(false);
    expect('reasonText' in turno.request.body).toBe(false);
    expect(turno.request.body.resourceId).toBe(RECURSO);

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

    expect(emitidos[0].esAltaNueva).toBe(true);
    expect(emitidos[0].patientCode).toBe('PAC-99');
    expect(emitidos[0].encounterId).toBe('enc-1');
  });

  it('no deja registrar sin nombre, apellido, cédula y teléfono', () => {
    // Son exactamente los cuatro que `WalkInPatientDto` declara obligatorios.
    crear();
    const c = instancia();
    c.registrarNuevo();
    fixture.detectChanges();
    expect(c.puedeGuardar()).toBe(false);

    c.nuevoNombre.set('Rosa');
    c.nuevoApellido.set('Ticona');
    c.nuevoDocumento.set('8123456');
    expect(c.puedeGuardar()).toBe(false);

    c.nuevoTelefono.set('+591 71234567');
    expect(c.puedeGuardar()).toBe(true);
  });

  it('pasar al alta arrastra la cédula que ya se había tecleado', () => {
    // Pedirla de nuevo dos renglones más abajo es trabajo repetido.
    crear();
    instancia().buscarPaciente('8123456');
    http
      .expectOne((r) => r.url === '/profiles/patients')
      .flush({ items: [], count: 0, limit: 10, nextCursor: null });

    instancia().registrarNuevo();
    fixture.detectChanges();
    expect(instancia().nuevoDocumento()).toBe('8123456');
  });

  /* -- Los rechazos ---------------------------------------------------------- */

  it('el 409 devuelve a la búsqueda y dice por qué, sin crear nada', () => {
    crear();
    instancia().registrarNuevo();
    completarAlta();
    instancia().guardar();

    http
      .expectOne('/scheduling/appointments/walk-in')
      .flush(
        { code: 'CONFLICT', message: 'Ya hay un paciente con esa cédula.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    const aviso = fixture.nativeElement.querySelector('[data-testid="mostrador-error"]');
    expect(aviso?.textContent).toContain('ya está registrado');
    // Volvió al buscador: el modal no deja a nadie en un callejón.
    expect(fixture.nativeElement.querySelector('[data-testid="mostrador-paciente"]')).not.toBeNull();
    expect(emitidos).toHaveLength(0);
  });

  it('el 422 del choque de horario se muestra tal como lo redactó el servidor', () => {
    // Ese texto ya está escrito para una persona —con qué, cuándo y dónde—, y
    // reescribirlo acá sólo podría empeorarlo o mentir.
    crear();
    instancia().paciente.set({ value: 'pac-1', label: 'Rosa Ticona' });
    fixture.detectChanges();
    instancia().guardar();

    http.expectOne('/scheduling/appointments/direct').flush(
      {
        code: 'CONFLICT',
        message: 'Ya tenés una consulta a las 10:00 en Consultorio Centro.',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    const aviso = fixture.nativeElement.querySelector('[data-testid="mostrador-error"]');
    expect(aviso?.textContent).toContain('Consultorio Centro');
    expect(emitidos).toHaveLength(0);
  });
});
