import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PatientChart } from './patient-chart';

/**
 * El expediente de una persona. Lo que estas pruebas fijan:
 *
 * 1. **Las dos lecturas son obligatorias.** Media historia clínica no se
 *    distingue de una completa sin antecedentes, y esa confusión en clínica no
 *    es cosmética.
 * 2. **El nombre es opcional.** `GET /profiles/patients/:id` pide
 *    `SECURITY_ADMIN`; un 403 ahí no puede llevarse puesto el expediente.
 * 3. **Lo recortado se dice.** `truncated` nombra bloques, y callarlo se lee
 *    como «no hay antecedentes».
 * 4. **Ningún uuid llega a la pantalla.** Todo `*ConceptId` se traduce, y lo que
 *    el catálogo no conozca se muestra como ausencia, no como identificador.
 */

const RESUMEN = {
  patientProfileId: 'p-1',
  conditions: [
    {
      id: 'c-1',
      codeConceptId: 'con-diabetes',
      clinicalStatusConceptId: 'st-activa',
      createdAt: '2026-01-03T00:00:00.000Z',
    },
  ],
  allergies: [],
  medicationRequests: [],
  observations: [
    {
      id: 'o-1',
      codeConceptId: 'obs-peso',
      statusConceptId: 'st-final',
      quantityValue: '78.5',
      quantityUnitConceptId: 'u-kg',
    },
  ],
  encounters: [],
  limit: 50,
  truncated: [],
};

const CHART = {
  patientProfileId: 'p-1',
  notes: [],
  carePlans: [],
  documents: [],
  limit: 50,
  truncated: [],
};

const CONCEPTOS = {
  items: [
    {
      conceptId: 'con-diabetes',
      code: 'E11',
      display: 'Diabetes tipo 2',
      codeSystemVersionId: 'v1',
    },
    { conceptId: 'st-activa', code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'v1' },
    { conceptId: 'obs-peso', code: '29463-7', display: 'Peso corporal', codeSystemVersionId: 'v1' },
    { conceptId: 'st-final', code: 'FINAL', display: 'Final', codeSystemVersionId: 'v1' },
    { conceptId: 'u-kg', code: 'kg', display: 'kg', codeSystemVersionId: 'v1' },
  ],
  count: 5,
  limit: 200,
};

describe('PatientChart', () => {
  let harness: RouterTestingHarness;
  let componente: PatientChart;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'clinico/:profileId', component: PatientChart }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/clinico/p-1', PatientChart);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function estado() {
    return interno<() => { status: string }>('expediente')();
  }

  /** Responde el nombre del paciente. Es la lectura cosmética y va aparte. */
  function responderNombre(prohibido = false): void {
    const req = http.expectOne((r) => r.url === '/profiles/patients/p-1');
    if (prohibido) {
      req.flush(
        { code: 'FORBIDDEN', message: 'Rol insuficiente', timestamp: '', path: '' },
        { status: 403, statusText: 'Forbidden' },
      );
      return;
    }
    req.flush({
      profileId: 'p-1',
      personId: 'per-1',
      patientCode: 'PAC-1',
      displayName: 'Andrea Peña Rojas',
      relatedPersons: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }

  function responderExpediente(
    opciones: { resumen?: object; chart?: object; conceptos?: object } = {},
  ): void {
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({ ...RESUMEN, ...opciones.resumen });
    http
      .expectOne((r) => r.url === '/charts/patients/p-1/chart')
      .flush({ ...CHART, ...opciones.chart });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(opciones.conceptos ?? CONCEPTOS);
  }

  it('pide las dos lecturas con el tope por bloque', () => {
    responderNombre();

    const resumen = http.expectOne((r) => r.url === '/clinical/patients/p-1/summary');
    expect(resumen.request.params.get('limit')).toBe('50');
    resumen.flush(RESUMEN);

    const chart = http.expectOne((r) => r.url === '/charts/patients/p-1/chart');
    expect(chart.request.params.get('limit')).toBe('50');
    chart.flush(CHART);

    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);

    expect(estado().status).toBe('ready');
  });

  it('traduce los conceptos: ningún uuid queda en pantalla', () => {
    responderNombre();
    responderExpediente();

    const diagnostico = interno<() => readonly Record<string, unknown>[]>('diagnosticos')()[0];
    expect(diagnostico['principal']).toBe('Diabetes tipo 2');
    expect(diagnostico['estado']).toBe('Activa');
  });

  /**
   * Cinco caminos excluyentes para el valor de una observación. Con cantidad y
   * unidad, la unidad acompaña al número — mostrarlos separados obligaría a
   * leer dos columnas para saber si son 78 kilos o 78 libras.
   */
  it('la observación con cantidad muestra el número con su unidad', () => {
    responderNombre();
    responderExpediente();

    const observacion = interno<() => readonly Record<string, unknown>[]>('observaciones')()[0];
    expect(observacion['secundario']).toBe('78.5 kg');
  });

  it('un 403 al leer el nombre no tumba el expediente', () => {
    responderNombre(true);
    responderExpediente();

    expect(estado().status).toBe('ready');
    expect(interno<() => string>('titulo')()).toBe('Expediente clínico');
  });

  it('con nombre leído, el encabezado lo usa', () => {
    responderNombre();
    responderExpediente();

    expect(interno<() => string>('titulo')()).toBe('Andrea Peña Rojas');
  });

  it('un fallo del catálogo degrada las etiquetas pero no el expediente', () => {
    responderNombre();
    http.expectOne((r) => r.url === '/clinical/patients/p-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/charts/patients/p-1/chart').flush(CHART);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(estado().status).toBe('ready');
    expect(
      interno<() => readonly Record<string, unknown>[]>('diagnosticos')()[0]['principal'],
    ).toBe('Sin registrar');
  });

  /**
   * El `forkJoin` cancela la lectura hermana en cuanto una falla, así que la
   * del expediente narrativo queda abortada y **no se responde**: intentarlo
   * fallaría con «Cannot flush a cancelled request». Es el comportamiento
   * correcto —media historia no sirve— y por eso la prueba lo refleja en vez de
   * forzar la respuesta.
   */
  it('un 403 en el expediente sí es S5: es lo que se vino a ver', () => {
    responderNombre(true);
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush(
        { code: 'FORBIDDEN', message: 'Rol insuficiente', timestamp: '', path: '' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(estado().status).toBe('forbidden');
    http.expectOne((r) => r.url === '/charts/patients/p-1/chart');
  });

  it('nombra en palabras los bloques que quedaron recortados', () => {
    responderNombre();
    responderExpediente({
      resumen: { truncated: ['observations'] },
      chart: { truncated: ['notes'] },
    });

    expect(interno<() => string>('recorte')()).toBe('observaciones, notas');
  });

  it('sin recorte no dice nada', () => {
    responderNombre();
    responderExpediente();

    expect(interno<() => string>('recorte')()).toBe('');
  });

  it('un bloque vacío ofrece salida, no un vacío mudo', () => {
    responderNombre();
    responderExpediente();

    const vacio = interno<
      (
        filas: readonly unknown[],
        titulo: string,
      ) => { status: string; nextAction?: { label: string } }
    >('estadoDe')([], 'Alergias');
    expect(vacio.status).toBe('empty');
    expect(vacio.nextAction?.label).toBe('Elegir otra persona');
  });
});
