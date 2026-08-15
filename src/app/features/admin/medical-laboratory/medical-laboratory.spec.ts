import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { MedicalLaboratory } from './medical-laboratory';

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

describe('MedicalLaboratory', () => {
  let harness: RouterTestingHarness;
  let componente: MedicalLaboratory;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/medical-laboratory', component: MedicalLaboratory },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, MedicalLaboratory);
  });

  afterEach(() => http.verify());

  function cargar(datos: object = ficha()): void {
    http
      .expectOne('/diagnostic-units/administration')
      .flush({ items: [RESUMEN], count: 1 });
    harness.detectChanges();
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

    expect(harness.routeNativeElement?.textContent).toContain(
      'todavía no tiene ninguna unidad de laboratorio o imagen dada de alta',
    );
  });

  it('un fallo de la ficha se puede reintentar sin recargar la página', () => {
    http
      .expectOne('/diagnostic-units/administration')
      .flush({ items: [RESUMEN], count: 1 });
    harness.detectChanges();
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
});
