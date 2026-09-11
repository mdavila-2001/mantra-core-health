import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import {
  ObservationBlock,
  TARGET_MEDICION,
  TARGET_TIPO_DE_EJECUTANTE,
} from './observation-block';

/** Una expansión de catálogo con la forma que sirve `system-context`. */
function catalogo(opciones: readonly { conceptId: string; code: string }[]) {
  return {
    code: 'obs',
    name: 'Catálogo',
    description: '',
    definitionId: 'def-1',
    valueSetId: 'vs-1',
    versionId: 'v-1',
    cacheToken: 'v1',
    allowCustomValue: false,
    options: opciones.map((o, i) => ({ ...o, display: o.code, ordinal: i + 1 })),
  };
}

const EJECUTANTES = catalogo([
  { conceptId: 'tipo-lab', code: 'OBSP-LAB' },
  { conceptId: 'tipo-profesional', code: 'OBSP-PRACTITIONER' },
]);

const GENERICO = catalogo([{ conceptId: 'obs-sistolica', code: 'OBS-BP-SYS' }]);

const RESPUESTA = {
  id: 'obs-1',
  patientProfileId: 'p-1',
  status: 'FINAL',
  componentIds: [],
  rowVersion: 1,
  createdAt: '2026-09-10T10:00:00.000Z',
};

/**
 * El contrato de la observación estaba entero y **ninguna pantalla lo usaba**:
 * la presión que el médico acababa de tomar sólo llegaba a la historia si la
 * había cargado el seed. Estas pruebas fijan lo que el formulario nuevo tiene
 * que respetar: un valor y no dos, el ejecutante resuelto y no preguntado, y
 * los opcionales omitidos en vez de viajar en `null`.
 */
describe('ObservationBlock', () => {
  let fixture: ComponentFixture<ObservationBlock>;
  let componente: ObservationBlock;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObservationBlock],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            activeTenantId: signal<string | null>('t-1'),
            roles: signal<readonly string[]>(['PRACTITIONER']),
            practitionerProfileId: signal<string | null>('hp-1'),
            displayName: signal<string | null>('Dra. Rojas'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ObservationBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    for (const pendiente of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      pendiente.flush(GENERICO);
    }
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  /** Dibuja y resuelve los catálogos; el del ejecutante, con sus dos códigos. */
  function dibujar(conEjecutante = true): void {
    fixture.detectChanges();
    for (const pendiente of http.match(
      (r) => r.params.get('target') === TARGET_TIPO_DE_EJECUTANTE,
    )) {
      if (conEjecutante) {
        pendiente.flush(EJECUTANTES);
      } else {
        pendiente.flush(catalogo([]));
      }
    }
    for (const pendiente of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      pendiente.flush(GENERICO);
    }
    fixture.detectChanges();
  }

  /** Lo mínimo para poder registrar: la medición y un valor. */
  function completar(): void {
    señal<string | null>('medicion').set('obs-sistolica');
    señal<string | number | null>('valorNumerico').set('128');
  }

  it('pide el catálogo de mediciones por su target', () => {
    fixture.detectChanges();
    const req = http.expectOne((r) => r.params.get('target') === TARGET_MEDICION);
    req.flush(GENERICO);
    fixture.detectChanges();
  });

  /**
   * El contrato sólo exige la medición. El valor lo pide la pantalla: una
   * observación registrada sin decir cuánto dio es una fila que nadie sabe leer.
   */
  it('exige la medición y algún valor', () => {
    dibujar();
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);

    señal<string | null>('medicion').set('obs-sistolica');
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);

    señal<string>('valorEnPalabras').set('Ruidos cardíacos rítmicos');
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(true);
  });

  it('lo que no es un número se señala y bloquea el envío', () => {
    dibujar();
    señal<string | null>('medicion').set('obs-sistolica');
    señal<string | number | null>('valorNumerico').set('128 mmHg');

    expect(interno<() => boolean>('numeroInvalido')()).toBe(true);
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);
  });

  /**
   * Las seis familias de valor del contrato son **excluyentes**: con número
   * viaja el número, y el texto queda para la medición cualitativa.
   */
  it('manda el número con su unidad y no el texto', () => {
    dibujar();
    completar();
    señal<string | null>('unidad').set('unidad-mmhg');
    señal<string>('valorEnPalabras').set('esto no debería viajar');

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/observations');
    expect(req.request.body.quantityValue).toBe(128);
    expect(req.request.body.quantityUnitConceptId).toBe('unidad-mmhg');
    expect('valueText' in req.request.body).toBe(false);
    req.flush(RESPUESTA);
  });

  it('sin número manda el texto, que es la medición cualitativa', () => {
    dibujar();
    señal<string | null>('medicion').set('obs-sistolica');
    señal<string>('valorEnPalabras').set('  Ruidos rítmicos, sin soplos  ');

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/observations');
    expect(req.request.body.valueText).toBe('Ruidos rítmicos, sin soplos');
    expect('quantityValue' in req.request.body).toBe(false);
    req.flush(RESPUESTA);
  });

  /** La coma decimal es como se escribe un número en castellano. */
  it('acepta la coma como separador decimal', () => {
    dibujar();
    señal<string | null>('medicion').set('obs-sistolica');
    señal<string | number | null>('valorNumerico').set('36,7');

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/observations');
    expect(req.request.body.quantityValue).toBe(36.7);
    req.flush(RESPUESTA);
  });

  /**
   * Quién la tomó lo sabe la sesión y de qué clase es sale del catálogo:
   * preguntarlo sería pedirle a quien mide que declare lo que ya sabemos.
   */
  it('resuelve el ejecutante del catálogo, sin preguntarlo', () => {
    dibujar();
    completar();

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/observations');
    expect(req.request.body.performers).toEqual([
      { performerTypeConceptId: 'tipo-profesional', performerId: 'hp-1' },
    ]);
    req.flush(RESPUESTA);
  });

  /**
   * Sin conjunto publicado para la columna del tipo de ejecutante, la
   * observación viaja **sin autor** en vez de con un uuid inventado: entre
   * registrarla sin autor y registrarla con uno falso, lo primero es lo honesto.
   */
  it('sin catálogo de ejecutante, la observación viaja sin autor', () => {
    dibujar(false);
    completar();

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/observations');
    expect('performers' in req.request.body).toBe(false);
    req.flush(RESPUESTA);
  });

  it('los opcionales sin elegir se omiten, no viajan en null', () => {
    dibujar(false);
    completar();

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/observations');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'codeConceptId',
      'custodianTenantId',
      'patientProfileId',
      'quantityValue',
    ]);
    req.flush(RESPUESTA);
  });

  /** La cita elegida gana sobre el encuentro que pase el anfitrión. */
  it('manda la cita elegida y no el encuentro en curso', () => {
    fixture.componentRef.setInput('encounterId', 'enc-en-curso');
    fixture.componentRef.setInput('citas', [
      { id: 'enc-9', etiqueta: '7 sept 2026 · Control', enCurso: false },
    ]);
    dibujar();
    completar();
    señal<string | null>('citaElegida').set('enc-9');

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/observations');
    expect(req.request.body.encounterId).toBe('enc-9');
    req.flush(RESPUESTA);
  });

  /** Registrada, el formulario queda limpio: la siguiente medición arranca de cero. */
  it('tras registrar, el formulario queda vacío', () => {
    dibujar();
    completar();

    interno<() => void>('registrar')();
    http.expectOne('/clinical/observations').flush(RESPUESTA);
    fixture.detectChanges();

    expect(señal<string | null>('medicion')()).toBeNull();
    expect(señal<string | number | null>('valorNumerico')()).toBe('');
  });
});
