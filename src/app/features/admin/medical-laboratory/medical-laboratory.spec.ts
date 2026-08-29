import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { MedicalLaboratory } from './medical-laboratory';
import { TarifariosRecordados } from './tarifarios-recordados';

/**
 * Consola de administración del laboratorio (CARRIL 16) contra
 * `GET /diagnostic-units/administration` y `/:id/administration`.
 *
 * Lo que estas pruebas fijan es la diferencia con el directorio: acá entran los
 * borradores, los cronogramas internos y el personal con sus permisos.
 */
const RUTA = '/administration/medical-laboratory';

const CONCEPTO = (code: string, display: string) => ({ code, display });

const RESUMEN = {
  id: 'unit-1',
  code: 'LAB-CENTRAL',
  name: 'Laboratorio Central',
  type: CONCEPTO('DU_TYPE_LAB', 'Laboratorio clínico'),
  status: CONCEPTO('DU_UNIT_ACTIVE', 'Activa'),
  verificationStatus: CONCEPTO('DU_VERIF_PENDING', 'Pendiente'),
  publiclyListed: false,
  siteCount: 1,
  studyCount: 1,
  equipmentCount: 1,
  acceptsExternalOrders: true,
  walkInAvailable: true,
  homeCollectionAvailable: false,
};

function ficha(overrides: Record<string, unknown> = {}) {
  return {
    ...RESUMEN,
    sites: [],
    equipment: [],
    studies: [],
    accreditations: [],
    staff: [],
    ...overrides,
  };
}

/** Un estudio del catálogo, tal como lo devuelve la ficha administrativa. */
function estudio(overrides: Record<string, unknown> = {}) {
  return {
    id: 'of-1',
    code: 'HEM',
    name: 'Hemograma completo',
    description: null,
    siteId: null,
    modality: null,
    specimenType: null,
    preparationInstructions: null,
    expectedDurationMinutes: null,
    expectedTurnaroundMinutes: null,
    requiresMedicalOrder: null,
    requiresPriorAuthorization: null,
    homeCollectionEligible: null,
    status: CONCEPTO('DU_OFFER_ACTIVE', 'Activa'),
    prices: [],
    ...overrides,
  };
}

/** Una versión de precio dentro de un tarifario. */
function precio(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pr-1',
    scheduleId: 'sch-1',
    scheduleCode: 'PUBLICO',
    schedulePublic: true,
    versionNumber: 1,
    baseAmount: '120.00',
    patientAmount: null,
    insurerAmount: null,
    currency: CONCEPTO('DU_CUR_BOB', 'Bs'),
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    status: CONCEPTO('DU_PRICE_ACTIVE', 'Vigente'),
    ...overrides,
  };
}

/** El catálogo de estudios que puebla el selector de la oferta. */
const CATALOGO = {
  code: 'service-request-code',
  name: 'Códigos de estudio',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [
    {
      conceptId: 'concepto-hemograma',
      code: 'CBC',
      display: 'Complete blood count',
      ordinal: 1,
      isDefault: false,
    },
  ],
};

describe('MedicalLaboratory', () => {
  let harness: RouterTestingHarness;
  let componente: MedicalLaboratory;
  let http: HttpTestingController;

  /** Lo que se le preguntó a la persona, en orden. */
  let confirmaciones: { title: string; message: string }[];

  /** Qué contesta el diálogo. Se cambia por prueba. */
  let confirmar: boolean;

  beforeEach(async () => {
    confirmaciones = [];
    confirmar = true;
    try {
      // Los tarifarios recordados se espejan en la pestaña. jsdom corre con
      // origen opaco y no expone `sessionStorage`, pero si algún día lo
      // expusiera, lo que recuerde una prueba no puede llegar a la siguiente.
      sessionStorage.clear();
    } catch {
      // No hay almacenamiento que limpiar, que es el caso normal acá.
    }
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/medical-laboratory', component: MedicalLaboratory },
        ]),
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
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, MedicalLaboratory);
  });

  afterEach(() => http.verify());

  /**
   * Responde el catálogo de estudios, que la pantalla pide al construirse.
   *
   * Se resuelve con `catalogo = null` para el caso en que el binding no exista:
   * ahí el formulario tiene que avisar y no dejar publicar, en vez de ofrecer un
   * selector vacío.
   */
  function responderCatalogo(catalogo: object | null = CATALOGO): void {
    const req = http.expectOne((r) => r.url === '/system-context/dynamic-enums');
    if (catalogo === null) {
      req.flush({ message: 'sin binding' }, { status: 404, statusText: 'Not Found' });
      return;
    }
    req.flush(catalogo);
  }

  function cargar(datos: object = ficha(), catalogo: object | null = CATALOGO): void {
    http
      .expectOne('/diagnostic-units/administration')
      .flush({ items: [RESUMEN], count: 1 });
    harness.detectChanges();
    responderCatalogo(catalogo);
    http.expectOne('/diagnostic-units/unit-1/administration').flush(datos);
    harness.detectChanges();
  }

  /** Abre una pestaña por su rótulo: el panel inactivo no está en el DOM. */
  function abrirPestana(label: string): void {
    const boton = [...(harness.routeNativeElement?.querySelectorAll('[role="tab"]') ?? [])].find(
      (candidato) => candidato.textContent?.trim() === label,
    );
    expect(boton, `pestaña «${label}»`).toBeDefined();
    (boton as HTMLButtonElement).click();
    harness.detectChanges();
  }

  /** Los botones dibujados con ese rótulo. Vacío si la acción no se ofrece. */
  function botonesRotulados(rotulo: string): HTMLButtonElement[] {
    return [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])].filter(
      (boton) => boton.textContent?.trim() === rotulo,
    );
  }

  it('pide la consola y no el directorio', () => {
    cargar();

    // `/diagnostic-units` a secas filtra a publicadas y verificadas: pedirlo
    // dejaría al administrador sin ver su propio borrador.
    expect(harness.routeNativeElement?.textContent).toContain('Laboratorio Central');
  });

  it('dice que la unidad todavía no se ve en el directorio', () => {
    cargar();

    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Todavía no se publica');
  });

  it('marca como visible la unidad que el directorio sí publica', () => {
    http
      .expectOne('/diagnostic-units/administration')
      .flush({ items: [{ ...RESUMEN, publiclyListed: true }], count: 1 });
    harness.detectChanges();
    responderCatalogo();
    http
      .expectOne('/diagnostic-units/unit-1/administration')
      .flush(ficha({ publiclyListed: true }));
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Visible para pacientes');
  });

  it('avisa cuando nadie puede validar resultados', () => {
    cargar(
      ficha({
        staff: [
          {
            id: 'asg-1',
            practitionerRoleAssignmentId: 'rol-1',
            practitionerProfileId: 'perfil-1',
            practitionerName: 'Téc. Ana Salas',
            siteId: null,
            assignmentRole: CONCEPTO('DU_ASSIGN_SPECIALIST', 'Técnica'),
            specialty: null,
            mayValidateResults: false,
            maySignReports: false,
            validFrom: null,
            validTo: null,
            status: CONCEPTO('DU_ASSIGN_ACTIVE', 'Activa'),
          },
        ],
      }),
    );

    // Sin nadie habilitado ningún resultado se puede dar por definitivo: es una
    // condición de operación, no un detalle de configuración.
    expect(componente['validadores']()).toHaveLength(0);
    expect(harness.routeNativeElement?.textContent).toContain(
      'Ningún integrante del personal tiene permiso para validar resultados',
    );
  });

  it('no avisa cuando hay al menos un validador', () => {
    cargar(
      ficha({
        staff: [
          {
            id: 'asg-1',
            practitionerRoleAssignmentId: 'rol-1',
            practitionerProfileId: 'perfil-1',
            practitionerName: 'Dra. Quispe',
            siteId: null,
            assignmentRole: CONCEPTO('DU_ASSIGN_SPECIALIST', 'Bioquímica'),
            specialty: null,
            mayValidateResults: true,
            maySignReports: true,
            validFrom: '2026-01-01',
            validTo: null,
            status: CONCEPTO('DU_ASSIGN_ACTIVE', 'Activa'),
          },
        ],
      }),
    );

    expect(componente['validadores']()).toHaveLength(1);
    expect(harness.routeNativeElement?.textContent).not.toContain(
      'Ningún integrante del personal tiene permiso para validar resultados',
    );
  });

  it('muestra también los precios de cronogramas internos', () => {
    cargar(
      ficha({
        studies: [
          {
            id: 'of-1',
            code: 'HEM',
            name: 'Hemograma completo',
            description: null,
            siteId: null,
            modality: null,
            specimenType: null,
            preparationInstructions: null,
            expectedDurationMinutes: null,
            expectedTurnaroundMinutes: null,
            requiresMedicalOrder: true,
            requiresPriorAuthorization: null,
            homeCollectionEligible: null,
            status: CONCEPTO('DU_OFFER_ACTIVE', 'Activa'),
            prices: [
              {
                id: 'pr-1',
                scheduleId: 'sch-1',
                scheduleCode: 'PUBLICO',
                schedulePublic: true,
                versionNumber: 1,
                baseAmount: '120.00',
                patientAmount: null,
                insurerAmount: null,
                currency: CONCEPTO('DU_CUR_BOB', 'Bs'),
                effectiveFrom: '2026-01-01T00:00:00.000Z',
                effectiveTo: null,
                status: CONCEPTO('DU_PRICE_ACTIVE', 'Vigente'),
              },
              {
                id: 'pr-2',
                scheduleId: 'sch-2',
                scheduleCode: 'ASEGURADORA-A',
                schedulePublic: false,
                versionNumber: 1,
                baseAmount: '85.00',
                patientAmount: null,
                insurerAmount: '85.00',
                currency: CONCEPTO('DU_CUR_BOB', 'Bs'),
                effectiveFrom: '2026-01-01T00:00:00.000Z',
                effectiveTo: null,
                status: CONCEPTO('DU_PRICE_ACTIVE', 'Vigente'),
              },
            ],
          },
        ],
      }),
    );

    // El panel inactivo no se oculta: no se renderiza. Hay que abrir la pestaña
    // para poder afirmar sobre su contenido.
    abrirPestana('Estudios');

    const texto = harness.routeNativeElement?.textContent ?? '';
    // El directorio sólo publica el primero; sin el segundo no habría manera de
    // administrar el convenio con la aseguradora.
    expect(texto).toContain('PUBLICO');
    expect(texto).toContain('ASEGURADORA-A');
    expect(texto).toContain('interno');
  });

  it('traduce los plazos en palabras y con la severidad que corresponde', () => {
    cargar();

    expect(componente['plazoEnPalabras'](-3, 'vencida')).toBe('vencida hace 3 días');
    expect(componente['plazoEnPalabras'](0)).toBe('vence hoy');
    expect(componente['plazoEnPalabras'](7)).toBe('en 7 días');
    expect(componente['plazoEnPalabras'](null)).toBe('sin fecha declarada');

    expect(componente['varianteDePlazo'](-1)).toBe('error');
    expect(componente['varianteDePlazo'](5)).toBe('warning');
    expect(componente['varianteDePlazo'](365)).toBe('success');
    expect(componente['varianteDePlazo'](null)).toBe('info');
  });

  it('cuenta los equipos con la calibración vencida o próxima', () => {
    cargar(
      ficha({
        equipment: [
          {
            id: 'eq-1',
            siteId: 'sede-1',
            type: CONCEPTO('DU_EQ_ANALYZER', 'Analizador'),
            manufacturer: 'Demo',
            model: 'A1',
            serialNumber: 'SN-1',
            modality: null,
            operationalStatus: CONCEPTO('DU_EQ_OPERATIONAL', 'Operativo'),
            lastCalibrationAt: null,
            nextCalibrationDueAt: '2026-08-20T00:00:00.000Z',
            daysToCalibration: 5,
          },
          {
            id: 'eq-2',
            siteId: 'sede-1',
            type: CONCEPTO('DU_EQ_ANALYZER', 'Analizador'),
            manufacturer: 'Demo',
            model: 'A2',
            serialNumber: 'SN-2',
            modality: null,
            operationalStatus: CONCEPTO('DU_EQ_OPERATIONAL', 'Operativo'),
            lastCalibrationAt: null,
            nextCalibrationDueAt: null,
            daysToCalibration: null,
          },
        ],
      }),
    );

    // El que no declara calibración no cuenta como alerta: no hay plazo que
    // vencer, y contarlo sería una alarma inventada.
    expect(componente['equiposPorCalibrar']()).toHaveLength(1);
  });

  it('dice que no hay laboratorio cuando el tenant no tiene ninguno', () => {
    http.expectOne('/diagnostic-units/administration').flush({ items: [], count: 0 });
    harness.detectChanges();
    responderCatalogo();

    expect(harness.routeNativeElement?.textContent).toContain(
      'todavía no tiene ninguna unidad de laboratorio o imagen dada de alta',
    );
  });

  it('un fallo de la ficha se puede reintentar sin recargar la página', () => {
    http
      .expectOne('/diagnostic-units/administration')
      .flush({ items: [RESUMEN], count: 1 });
    harness.detectChanges();
    responderCatalogo();
    http
      .expectOne('/diagnostic-units/unit-1/administration')
      .flush({ message: 'Falló' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(componente['ficha']().status).toBe('error');

    componente['recargar']();
    http.expectOne('/diagnostic-units/unit-1/administration').flush(ficha());
    harness.detectChanges();

    expect(componente['ficha']().status).toBe('ready');
  });

  /* == Publicar =========================================================== */

  /** Espera a que la confirmación resuelva y vuelve a pintar. */
  async function tras(accion: Promise<void>): Promise<void> {
    await accion;
    harness.detectChanges();
  }

  /** El botón de publicar de la ficha, por su texto. `null` si no está. */
  function botonDePublicar(): HTMLButtonElement | null {
    const botones = [...(harness.routeNativeElement?.querySelectorAll('button') ?? [])];
    return (botones.find((boton) => boton.textContent?.includes('Verificar y publicar')) ??
      null) as HTMLButtonElement | null;
  }

  it('ofrece publicar sólo mientras la unidad no esté en el directorio', () => {
    cargar();

    expect(botonDePublicar()).not.toBeNull();
  });

  it('no ofrece publicar lo que ya está publicado', () => {
    http
      .expectOne('/diagnostic-units/administration')
      .flush({ items: [{ ...RESUMEN, publiclyListed: true }], count: 1 });
    harness.detectChanges();
    responderCatalogo();
    http
      .expectOne('/diagnostic-units/unit-1/administration')
      .flush(ficha({ publiclyListed: true }));
    harness.detectChanges();

    // Ofrecer la acción sobre algo ya publicado sería un botón sin efecto.
    expect(botonDePublicar()).toBeNull();
  });

  it('publicar avisa antes, y al lograrlo relee la ficha del servidor', async () => {
    cargar();

    await tras(componente['publicar']());

    // Publicar cambia lo que ve gente de afuera: se pregunta antes.
    expect(confirmaciones).toHaveLength(1);
    expect(confirmaciones[0].message).toContain('directorio público');

    http.expectOne('/diagnostic-units/unit-1/verify-and-publish').flush({
      id: 'unit-1',
      code: 'LAB-CENTRAL',
      name: 'Laboratorio Central',
      verificationStatus: 'concepto-verificada',
      status: 'concepto-activa',
      siteCount: 1,
      accreditationCount: 0,
    });
    harness.detectChanges();

    // La respuesta del POST trae los estados como identificador crudo: no se
    // pinta, se relee la ficha, que los trae con su etiqueta.
    http
      .expectOne('/diagnostic-units/unit-1/administration')
      .flush(ficha({ publiclyListed: true }));
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Visible para pacientes');
  });

  it('no publica si la persona se arrepiente', async () => {
    cargar();
    confirmar = false;

    await tras(componente['publicar']());

    http.expectNone('/diagnostic-units/unit-1/verify-and-publish');
  });

  it('muestra el motivo que da el servidor cuando la unidad no se puede publicar', async () => {
    cargar();

    await tras(componente['publicar']());
    // La API responde 422 con `PRECONDITION_FAILED`: lo que importa es el
    // cuerpo, no el número. Su mensaje dice qué falta; el nuestro sólo diría
    // que no se pudo.
    http.expectOne('/diagnostic-units/unit-1/verify-and-publish').flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'La unidad no tiene ningún sitio activo para publicar',
        timestamp: '2026-08-29T00:00:00.000Z',
        path: '/diagnostic-units/unit-1/verify-and-publish',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain(
      'La unidad no tiene ningún sitio activo para publicar',
    );
  });

  it('cae a un texto propio cuando el fallo no trae cuerpo de la API', async () => {
    cargar();

    await tras(componente['publicar']());
    http
      .expectOne('/diagnostic-units/unit-1/verify-and-publish')
      .flush('<html>502</html>', { status: 502, statusText: 'Bad Gateway' });
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('No pudimos publicar la unidad');
  });

  /* == Ofertas de estudio ================================================= */

  it('manda el concepto del catálogo, y no lo que se escribió a mano', () => {
    cargar();

    componente['elegirEstudio']('concepto-hemograma');
    componente['codigoDelEstudio'].set('HEM');
    componente['requiereOrdenMedica'].set(true);
    componente['crearOferta']();

    const req = http.expectOne('/diagnostic-units/unit-1/study-offerings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      studyCode: 'HEM',
      studyConceptId: 'concepto-hemograma',
      // El nombre visible se propone con el término del catálogo: sin él la
      // oferta viajaría sin un campo que la API exige.
      displayName: 'Complete blood count',
      requiresMedicalOrder: true,
    });
    req.flush({ id: 'of-9', studyCode: 'HEM', status: 'concepto-activa', componentCount: 0 });

    http.expectOne('/diagnostic-units/unit-1/administration').flush(ficha());
  });

  it('no pisa el nombre visible que ya se había escrito', () => {
    cargar();

    componente['nombreVisible'].set('Hemograma completo');
    componente['elegirEstudio']('concepto-hemograma');

    expect(componente['nombreVisible']()).toBe('Hemograma completo');
  });

  it('sin catálogo de estudios avisa y no deja publicar la oferta', () => {
    cargar(ficha(), null);
    componente['alternarFormularioDeOferta']();
    abrirPestana('Estudios');

    expect(componente['catalogoFallo']()).toBe(true);
    // Deshabilitado y dicho, nunca degradado a texto libre: un concepto
    // tecleado a mano es un dato que la API rechaza, o uno de otro conjunto
    // que acepta.
    expect(componente['ofertaEsValida']()).toBe(false);
    expect(harness.routeNativeElement?.textContent).toContain(
      'El catálogo de estudios no está disponible',
    );

    componente['crearOferta']();
    http.expectNone('/diagnostic-units/unit-1/study-offerings');
  });

  it('exige código y nombre antes de dejar publicar la oferta', () => {
    cargar();

    componente['elegirEstudio']('concepto-hemograma');
    expect(componente['ofertaEsValida']()).toBe(false);

    componente['codigoDelEstudio'].set('HEM');
    expect(componente['ofertaEsValida']()).toBe(true);

    componente['codigoDelEstudio'].set('H'.repeat(61));
    expect(componente['ofertaEsValida']()).toBe(false);
  });

  it('quitar un estudio pregunta antes, y no lo quita si se cancela', async () => {
    cargar(ficha({ studies: [estudio()] }));
    confirmar = false;

    await tras(componente['quitarOferta'](estudio() as never));

    expect(confirmaciones).toHaveLength(1);
    expect(confirmaciones[0].title).toContain('Hemograma completo');
    http.expectNone('/diagnostic-study-offerings/of-1');
  });

  it('quitar un estudio confirmado lo retira y relee la ficha', async () => {
    cargar(ficha({ studies: [estudio()] }));

    await tras(componente['quitarOferta'](estudio() as never));

    const req = http.expectOne('/diagnostic-study-offerings/of-1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });

    http.expectOne('/diagnostic-units/unit-1/administration').flush(ficha());
  });

  it('no ofrece quitar una oferta que ya está retirada', () => {
    cargar();

    const retirada = estudio({ status: CONCEPTO('DU_OFFER_RETIRED', 'Retirada') });
    expect(componente['sePuedeQuitar'](retirada as never)).toBe(false);
    expect(componente['sePuedeQuitar'](estudio() as never)).toBe(true);
  });

  it('tampoco la ofrece cuando el estado llega con el código del paquete', () => {
    cargar(
      ficha({
        studies: [estudio({ status: CONCEPTO('diagnostic_units:OFFERING_RETIRED', 'Retirada') })],
      }),
    );
    abrirPestana('Estudios');

    // Mismo concepto —mismo uuid— con el código que siembra el paquete de
    // datos en vez del que declara la API. Ofrecer «Quitar» acá termina en un
    // rechazo del servidor: una oferta no se retira dos veces.
    expect(botonesRotulados('Quitar')).toHaveLength(0);
  });

  it('pinta igual el estado venga con el código del paquete o con el de la API', () => {
    cargar();

    const delPaquete = componente['varianteDe'](CONCEPTO('diagnostic_units:UNIT_ACTIVE', 'Activa'));
    expect(delPaquete).toBe(componente['varianteDe'](CONCEPTO('DU_UNIT_ACTIVE', 'Activa')));
    // Y no porque los dos caigan al tono neutro, que era el defecto.
    expect(delPaquete).toBe('success');
  });

  /* == Tarifarios y precios =============================================== */

  it('deduce los tarifarios de los precios que trae la ficha', () => {
    cargar(
      ficha({
        studies: [
          estudio({
            prices: [
              precio(),
              precio({
                id: 'pr-2',
                scheduleId: 'sch-2',
                scheduleCode: 'CONVENIO-A',
                schedulePublic: false,
              }),
            ],
          }),
        ],
      }),
    );

    // No hay lectura de tarifarios en la API: los que existen se deducen de los
    // precios de cada estudio.
    expect(componente['tarifarios']().map((fila) => fila.code)).toEqual([
      'CONVENIO-A',
      'PUBLICO',
    ]);

    abrirPestana('Tarifarios');
    expect(harness.routeNativeElement?.textContent).toContain('CONVENIO-A');
  });

  it('recuerda el tarifario recién creado, que todavía no tiene precios', () => {
    cargar();

    componente['codigoDelTarifario'].set('PUBLICO');
    componente['visibleAlPublico'].set(true);
    componente['crearTarifario']();

    const req = http.expectOne('/diagnostic-units/unit-1/price-schedules');
    expect(req.request.body).toEqual({ code: 'PUBLICO', publicVisibility: true });
    req.flush({ id: 'sch-9', code: 'PUBLICO', status: 'concepto-activo' });
    harness.detectChanges();

    // Sin esta memoria desaparecería justo después de crearlo: la ficha no lo
    // menciona hasta que tenga su primer precio.
    expect(componente['tarifarios']()).toHaveLength(1);
    expect(componente['tarifarios']()[0].cantidadDePrecios).toBe(0);
  });

  it('un tarifario recordado sigue estando al volver a cargar la ficha', () => {
    TestBed.inject(TarifariosRecordados).recordar('unit-1', {
      id: 'sch-7',
      code: 'TARIFA-QA-2026',
      esPublico: true,
      cantidadDePrecios: 0,
    });

    cargar();

    // El defecto que esto impide: el tarifario existía en el servidor, la
    // ficha no lo mencionaba —no tiene ningún precio del que deducirlo— y la
    // persona quedaba trabada, sin poder cargarle el primero ni reusar su
    // código.
    abrirPestana('Tarifarios');
    expect(harness.routeNativeElement?.textContent).toContain('TARIFA-QA-2026');
    expect(componente['opcionesDeTarifario']().map((opcion) => opcion.value)).toContain('sch-7');
  });

  it('el precio viaja al tarifario, con el importe como cadena de dos decimales', () => {
    cargar(ficha({ studies: [estudio({ prices: [precio()] })] }));

    componente['abrirFormularioDePrecio'](estudio() as never);
    componente['tarifarioDelPrecio'].set('sch-1');
    componente['importeBase'].set(120);
    componente['crearPrecio']();

    const req = http.expectOne('/price-schedules/sch-1/study-prices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      diagnosticStudyOfferingId: 'of-1',
      baseAmount: '120.00',
    });
    req.flush({
      id: 'pr-9',
      versionNumber: 2,
      status: 'concepto-vigente',
      effectiveFrom: '2026-08-29T00:00:00.000Z',
    });

    http.expectOne('/diagnostic-units/unit-1/administration').flush(ficha());
  });

  it('sin tarifario elegido no manda el precio', () => {
    cargar(ficha({ studies: [estudio({ prices: [precio()] })] }));

    componente['abrirFormularioDePrecio'](estudio() as never);
    componente['importeBase'].set(120);

    expect(componente['precioEsValido']()).toBe(false);
    componente['crearPrecio']();
    http.expectNone('/price-schedules/sch-1/study-prices');
  });

  it('rechaza un importe negativo y un descuento fuera de rango', () => {
    cargar(ficha({ studies: [estudio({ prices: [precio()] })] }));

    componente['abrirFormularioDePrecio'](estudio() as never);
    componente['tarifarioDelPrecio'].set('sch-1');
    componente['importeBase'].set(-1);
    expect(componente['precioEsValido']()).toBe(false);

    // El cero es un precio válido —un estudio bonificado—, así que no puede
    // caer con la misma regla que el negativo.
    componente['importeBase'].set(0);
    expect(componente['precioEsValido']()).toBe(true);

    componente['factorDeDescuento'].set(1.5);
    expect(componente['precioEsValido']()).toBe(false);

    componente['factorDeDescuento'].set(0.1);
    expect(componente['precioEsValido']()).toBe(true);
  });

  it('sólo deja cerrar la versión de precio que todavía rige', () => {
    cargar();

    // Sin fecha de fin es vigente y abierta: el servidor escribe `effectiveTo`
    // tanto al cerrar la versión como al superarla con una nueva, así que la
    // versión superada siempre trae fecha.
    expect(componente['sePuedeCerrar'](precio() as never)).toBe(true);
    expect(
      componente['sePuedeCerrar'](precio({ effectiveTo: '2026-08-01T00:00:00.000Z' }) as never),
    ).toBe(false);
    expect(
      componente['sePuedeCerrar'](
        precio({
          status: CONCEPTO('DU_PRICE_SUPERSEDED', 'Superado'),
          effectiveTo: '2026-08-01T00:00:00.000Z',
        }) as never,
      ),
    ).toBe(false);
  });

  it('ofrece cerrar el precio que rige aunque su estado venga con el código del paquete', () => {
    cargar(
      ficha({
        studies: [
          estudio({
            prices: [
              precio({
                status: CONCEPTO('diagnostic_units:PRICE_ACTIVE', 'Vigente'),
                effectiveTo: null,
              }),
            ],
          }),
        ],
      }),
    );
    abrirPestana('Estudios');

    // El defecto que esto impide: el botón no aparecía sobre el precio vigente
    // y no había manera de cerrarlo desde la pantalla.
    expect(botonesRotulados('Cerrar')).toHaveLength(1);
  });

  it('no ofrece cerrar una versión que ya tiene fecha de fin', () => {
    cargar(
      ficha({
        studies: [
          estudio({
            prices: [precio({ effectiveTo: '2026-08-29T07:36:27.658Z' })],
          }),
        ],
      }),
    );
    abrirPestana('Estudios');

    expect(botonesRotulados('Cerrar')).toHaveLength(0);
  });

  it('cerrar un precio pregunta antes y después relee la ficha', async () => {
    cargar(ficha({ studies: [estudio({ prices: [precio()] })] }));

    await tras(componente['cerrarPrecio'](precio() as never));

    expect(confirmaciones).toHaveLength(1);
    const req = http.expectOne('/study-prices/pr-1/close');
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });

    http.expectOne('/diagnostic-units/unit-1/administration').flush(ficha());
  });

  it('cambiar de unidad olvida los tarifarios recordados de la anterior', () => {
    cargar();

    componente['codigoDelTarifario'].set('PUBLICO');
    componente['crearTarifario']();
    http
      .expectOne('/diagnostic-units/unit-1/price-schedules')
      .flush({ id: 'sch-9', code: 'PUBLICO', status: 'concepto-activo' });
    harness.detectChanges();
    expect(componente['tarifarios']()).toHaveLength(1);

    // Arrastrarlos ofrecería cargar un precio en el tarifario de otro
    // laboratorio, que es una clave foránea a otra unidad.
    componente['elegirUnidad']('unit-2');
    http.expectOne('/diagnostic-units/unit-2/administration').flush(ficha({ id: 'unit-2' }));
    harness.detectChanges();

    expect(componente['tarifarios']()).toHaveLength(0);
  });
});
