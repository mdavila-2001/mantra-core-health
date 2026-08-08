import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { PatientMerge } from './patient-merge';

/**
 * Fusionar dos pacientes es la operación de más consecuencia de todo el módulo:
 * une dos historias clínicas y sólo se puede deshacer mientras dure esta
 * pantalla. Las pruebas cubren lo que se rompe callado —el orden de los dos
 * perfiles, el deshacer que se pierde al salir— y no el maquetado.
 */
const PACIENTE_A = {
  profileId: 'pp-A',
  personId: 'p-A',
  patientCode: 'PAC-A',
  displayName: 'Ana Salas',
  birthDate: '1985-03-14',
  deceased: false,
};

const PACIENTE_B = {
  profileId: 'pp-B',
  personId: 'p-B',
  patientCode: 'PAC-B',
  displayName: 'Ana Salas',
  deceased: false,
};

const EVENTO = {
  id: 'ev-1',
  survivingPatientProfileId: 'pp-A',
  mergedPatientProfileId: 'pp-B',
  decisionStatus: 'concepto-aplicada',
  recordedAt: '2026-08-08T02:00:00.000Z',
};

describe('PatientMerge', () => {
  let fixture: ComponentFixture<PatientMerge>;
  let http: HttpTestingController;
  let confirmaciones: { title: string; message: string }[];
  let confirmar: boolean;

  beforeEach(async () => {
    confirmaciones = [];
    confirmar = true;

    await TestBed.configureTestingModule({
      imports: [PatientMerge],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: DialogService,
          useValue: {
            confirm: (config: { title: string; message: string }) => {
              confirmaciones.push(config);
              return Promise.resolve(confirmar);
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PatientMerge);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function crudo<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, unknown>)[nombre] as T;
  }

  function elegir(lado: 'sobreviviente' | 'absorbido', value: string, label = 'Ana Salas') {
    crudo<{ set: (v: unknown) => void }>(lado).set({ value, label });
  }

  function busquedaDe(texto: string) {
    return http.expectOne((r) => r.url === '/profiles/patients' && r.params.get('q') === texto);
  }

  /* ---- búsqueda de candidatos -------------------------------------------- */

  it('no consulta con el campo vacío: sería pedir el padrón entero', () => {
    interno<(t: string) => void>('buscarSobreviviente')('');

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => readonly unknown[]>('candidatosSobreviviente')()).toEqual([]);
  });

  /**
   * Se está buscando un duplicado, así que dos filas con el mismo nombre es lo
   * esperable, no la excepción. Sin algo que las distinga, la pantalla invitaría
   * a fusionar la equivocada.
   */
  it('cada candidato lleva su código para poder distinguir homónimos', () => {
    interno<(t: string) => void>('buscarSobreviviente')('salas');
    busquedaDe('salas').flush({ items: [PACIENTE_A, PACIENTE_B], count: 2, limit: 10, nextCursor: null });

    const opciones = interno<() => readonly { label: string; hint?: string }[]>(
      'candidatosSobreviviente',
    )();

    expect(opciones).toHaveLength(2);
    expect(opciones[0]?.label).toBe('Ana Salas');
    expect(opciones[0]?.hint).toContain('PAC-A');
    // Los dos se llaman igual: el hint es lo único que los separa.
    expect(opciones[1]?.hint).toContain('PAC-B');
    expect(opciones[0]?.hint).not.toBe(opciones[1]?.hint);
  });

  it('un paciente sin nombre igual se puede elegir: el rótulo cae al código', () => {
    interno<(t: string) => void>('buscarAbsorbido')('PAC');
    busquedaDe('PAC').flush({
      items: [{ ...PACIENTE_A, displayName: undefined }],
      count: 1,
      limit: 10,
      nextCursor: null,
    });

    expect(interno<() => readonly { label: string }[]>('candidatosAbsorbido')()[0]?.label).toContain(
      'PAC-A',
    );
  });

  it('si la búsqueda falla, el combobox queda sin opciones y la pantalla sin error general', () => {
    interno<(t: string) => void>('buscarSobreviviente')('salas');
    busquedaDe('salas').error(new ProgressEvent('error'), { status: 500 });

    expect(interno<() => readonly unknown[]>('candidatosSobreviviente')()).toEqual([]);
    // El error general se reserva para el envío, que es lo que la persona vino a hacer.
    expect(interno<() => string | null>('errorMessage')()).toBeNull();
  });

  /* ---- reglas del formulario --------------------------------------------- */

  it('sin los dos perfiles no se puede fusionar', () => {
    expect(interno<() => boolean>('puedeFusionar')()).toBe(false);

    elegir('sobreviviente', 'pp-A');
    expect(interno<() => boolean>('puedeFusionar')()).toBe(false);
  });

  it('el mismo paciente dos veces se detecta antes de salir a la red', () => {
    elegir('sobreviviente', 'pp-A');
    elegir('absorbido', 'pp-A');

    expect(interno<() => boolean>('mismoPaciente')()).toBe(true);
    expect(interno<() => boolean>('puedeFusionar')()).toBe(false);
  });

  /* ---- confirmación ------------------------------------------------------- */

  /**
   * Una confirmación que dice «¿confirmás la acción?» no confirma nada: tiene
   * que nombrar a los dos y decir cuál sobrevive.
   */
  it('la confirmación nombra a los dos y dice cuál sobrevive', async () => {
    elegir('sobreviviente', 'pp-A', 'Ana Salas');
    elegir('absorbido', 'pp-B', 'Ana Salas Duplicada');

    await interno<() => Promise<void>>('fusionar')();

    expect(confirmaciones).toHaveLength(1);
    expect(confirmaciones[0]?.message).toContain('Ana Salas Duplicada');
    expect(confirmaciones[0]?.message).toContain('Ana Salas');
    expect(confirmaciones[0]?.message).toContain('sobrevive');

    http.expectOne('/profiles/patients/merge').flush(EVENTO);
  });

  it('si no se confirma, no se fusiona nada', async () => {
    confirmar = false;
    elegir('sobreviviente', 'pp-A');
    elegir('absorbido', 'pp-B');

    await interno<() => Promise<void>>('fusionar')();

    // `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  /* ---- fusionar ----------------------------------------------------------- */

  it('manda los dos perfiles con su papel, no como un par cualquiera', async () => {
    elegir('sobreviviente', 'pp-A');
    elegir('absorbido', 'pp-B');

    await interno<() => Promise<void>>('fusionar')();

    const req = http.expectOne('/profiles/patients/merge');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      survivingPatientProfileId: 'pp-A',
      mergedPatientProfileId: 'pp-B',
    });

    req.flush(EVENTO);
  });

  it('el motivo no viaja: es un campo de catálogo sin conjunto de valores (B1)', async () => {
    elegir('sobreviviente', 'pp-A');
    elegir('absorbido', 'pp-B');

    await interno<() => Promise<void>>('fusionar')();

    const req = http.expectOne('/profiles/patients/merge');
    expect(Object.keys(req.request.body as object)).not.toContain('reasonConceptId');

    req.flush(EVENTO);
  });

  /* ---- deshacer ----------------------------------------------------------- */

  /**
   * El identificador del evento sólo existe en la respuesta que acaba de
   * llegar: el backend no expone listado de eventos de fusión. Si el deshacer
   * no lo usara, la fusión sería irreversible desde el minuto cero.
   */
  it('deshacer usa el identificador del evento que devolvió la fusión', async () => {
    elegir('sobreviviente', 'pp-A');
    elegir('absorbido', 'pp-B');
    await interno<() => Promise<void>>('fusionar')();
    http.expectOne('/profiles/patients/merge').flush(EVENTO);
    fixture.detectChanges();

    interno<() => void>('deshacer')();

    const req = http.expectOne('/profiles/patients/merge/ev-1/reverse');
    expect(req.request.method).toBe('POST');

    req.flush({ ...EVENTO, id: 'ev-2', reversalOfEventId: 'ev-1' });
    expect(interno<() => boolean>('deshecha')()).toBe(true);
  });

  it('no se deshace dos veces', async () => {
    elegir('sobreviviente', 'pp-A');
    elegir('absorbido', 'pp-B');
    await interno<() => Promise<void>>('fusionar')();
    http.expectOne('/profiles/patients/merge').flush(EVENTO);

    interno<() => void>('deshacer')();
    http.expectOne('/profiles/patients/merge/ev-1/reverse').flush({ ...EVENTO, id: 'ev-2' });

    interno<() => void>('deshacer')();
    // `verify()` del afterEach falla si salió una segunda petición.
  });

  it('sin fusión previa, deshacer no hace nada', () => {
    interno<() => void>('deshacer')();
    // Sin evento no hay identificador que revertir: `verify()` lo comprueba.
  });

  it('«fusionar otro par» suelta el evento: ya no se puede deshacer el anterior', async () => {
    elegir('sobreviviente', 'pp-A');
    elegir('absorbido', 'pp-B');
    await interno<() => Promise<void>>('fusionar')();
    http.expectOne('/profiles/patients/merge').flush(EVENTO);

    interno<() => void>('otraFusion')();

    expect(interno<() => unknown>('resultado')()).toBeNull();
    interno<() => void>('deshacer')();
    // `verify()` comprueba que no salió ninguna reversión.
  });

  /* ---- errores ------------------------------------------------------------ */

  it('un 404 dice que alguno de los dos perfiles ya no está', async () => {
    elegir('sobreviviente', 'pp-A');
    elegir('absorbido', 'pp-B');
    await interno<() => Promise<void>>('fusionar')();

    http
      .expectOne('/profiles/patients/merge')
      .flush({ code: 'NOT_FOUND', message: 'no existe' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(interno<() => string | null>('errorMessage')()).toContain('ya no existe');
  });

  it('al crearse la fusión se ofrece ir a la ficha que sobrevivió', async () => {
    const router = TestBed.inject(Router);
    const navegado: string[] = [];
    vi.spyOn(router, 'navigateByUrl').mockImplementation((url) => {
      navegado.push(String(url));
      return Promise.resolve(true);
    });

    elegir('sobreviviente', 'pp-A');
    elegir('absorbido', 'pp-B');
    await interno<() => Promise<void>>('fusionar')();
    http.expectOne('/profiles/patients/merge').flush(EVENTO);

    interno<() => void>('verSobreviviente')();

    expect(navegado).toEqual(['/administracion/pacientes/pp-A']);
  });
});
