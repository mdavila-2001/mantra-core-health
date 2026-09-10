import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { AllergyBlock, TARGET_SUSTANCIA } from './allergy-block';

/** Una expansión de catálogo, con la forma que sirve `system-context`. */
const CATALOGO = {
  code: 'allergy-substance',
  name: 'Sustancia',
  description: '',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  versionId: 'v-1',
  cacheToken: 'v1',
  allowCustomValue: false,
  options: [
    { conceptId: 'sub-penicilina', code: 'ALG_SUB_PENICILLIN', display: 'Penicilina', ordinal: 1 },
  ],
};

const RESPUESTA = {
  id: 'al-1',
  patientProfileId: 'p-1',
  clinicalStatus: 'ACTIVE',
  reactionIds: ['r-1'],
  createdAt: '2026-09-10T10:00:00.000Z',
};

/**
 * El contrato de la alergia estaba entero y **ninguna pantalla lo usaba**.
 * Estas pruebas fijan lo que el formulario nuevo tiene que respetar: la
 * sustancia es lo único obligatorio, las reacciones van en plural, y las filas
 * a medio cargar no viajan.
 */
describe('AllergyBlock', () => {
  let fixture: ComponentFixture<AllergyBlock>;
  let componente: AllergyBlock;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AllergyBlock],
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

    fixture = TestBed.createComponent(AllergyBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    for (const pendiente of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      pendiente.flush(CATALOGO);
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

  function dibujar(): void {
    fixture.detectChanges();
    for (const pendiente of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      pendiente.flush(CATALOGO);
    }
    fixture.detectChanges();
  }

  it('la sustancia es lo único obligatorio', () => {
    dibujar();
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);

    señal<string | null>('sustancia').set('sub-penicilina');
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(true);
  });

  it('pide el catálogo de sustancias por su target', () => {
    fixture.detectChanges();
    const req = http.expectOne((r) => r.params.get('target') === TARGET_SUSTANCIA);
    req.flush(CATALOGO);
    fixture.detectChanges();
  });

  /**
   * Una misma sustancia produce más de una cosa: urticaria **y**
   * broncoespasmo no son dos alergias.
   */
  it('admite varias reacciones y las manda todas', () => {
    dibujar();
    señal<string | null>('sustancia').set('sub-penicilina');

    interno<(clave: number, v: string | null) => void>('fijarManifestacion')(0, 'man-urticaria');
    interno<() => void>('agregarReaccion')();
    const segunda = interno<() => readonly { clave: number }[]>('reacciones')()[1]!;
    interno<(clave: number, v: string | null) => void>('fijarManifestacion')(
      segunda.clave,
      'man-anafilaxia',
    );
    interno<(clave: number, v: string) => void>('fijarDescripcion')(segunda.clave, '  A los 10 min ');

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/allergy-intolerances');
    expect(req.request.body.reactions).toEqual([
      { manifestationConceptId: 'man-urticaria' },
      { manifestationConceptId: 'man-anafilaxia', description: 'A los 10 min' },
    ]);
    req.flush(RESPUESTA);
  });

  /**
   * Una fila sin manifestación **no es una reacción sin gravedad, es nada**: la
   * manifestación es lo obligatorio de una reacción según el contrato.
   */
  it('las reacciones a medio cargar no viajan', () => {
    dibujar();
    señal<string | null>('sustancia').set('sub-penicilina');
    interno<() => void>('agregarReaccion')();

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/allergy-intolerances');
    expect('reactions' in req.request.body).toBe(false);
    req.flush(RESPUESTA);
  });

  it('los opcionales sin elegir se omiten, no viajan en null', () => {
    dibujar();
    señal<string | null>('sustancia').set('sub-penicilina');

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/allergy-intolerances');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'custodianTenantId',
      'patientProfileId',
      'substanceConceptId',
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
    señal<string | null>('sustancia').set('sub-penicilina');
    señal<string | null>('citaElegida').set('enc-9');

    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/allergy-intolerances');
    expect(req.request.body.encounterId).toBe('enc-9');
    req.flush(RESPUESTA);
  });

  /** Registrada, ofrece adjuntarle archivos: antes no había dónde ligarlos. */
  it('tras registrar ofrece adjuntar archivos a ESA alergia', () => {
    dibujar();
    señal<string | null>('sustancia').set('sub-penicilina');

    interno<() => void>('registrar')();
    http.expectOne('/clinical/allergy-intolerances').flush(RESPUESTA);
    fixture.detectChanges();

    expect(interno<() => string | null>('alergiaRecienRegistrada')()).toBe('al-1');
  });
});
