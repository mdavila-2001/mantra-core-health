import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { CarePlanBlock, TARGET_INTENCION } from './care-plan-block';

/** Una expansión de catálogo con la forma que sirve `system-context`. */
const CATALOGO = {
  code: 'care-plan-intent',
  name: 'Intención',
  description: '',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  versionId: 'v-1',
  cacheToken: 'v1',
  allowCustomValue: false,
  options: [{ conceptId: 'intent-plan', code: 'CP-INTENT-PLAN', display: 'Plan', ordinal: 1 }],
};

const RESPUESTA = {
  id: 'cp-1',
  statusConceptId: 'st-activo',
  activityCount: 1,
  createdAt: '2026-09-10T10:00:00.000Z',
};

/**
 * La pestaña «Planes de cuidados» sabía listar y nada más, mientras
 * `POST /charts/care-plans` estaba publicado desde UC-15-10. Estas pruebas
 * fijan lo que el alta nueva tiene que respetar: la meta se exige aunque el
 * contrato la acepte vacía, los pasos sin detalle no viajan, y las fechas
 * salen como día local y no como instante UTC.
 */
describe('CarePlanBlock', () => {
  let fixture: ComponentFixture<CarePlanBlock>;
  let componente: CarePlanBlock;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarePlanBlock],
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

    fixture = TestBed.createComponent(CarePlanBlock);
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

  it('pide el catálogo de intenciones por su target', () => {
    fixture.detectChanges();
    const req = http.expectOne((r) => r.params.get('target') === TARGET_INTENCION);
    req.flush(CATALOGO);
    fixture.detectChanges();
  });

  /**
   * El contrato sólo exige el paciente. Un plan sin objetivo escrito es un
   * registro que nadie sabe para qué se creó: no se evalúa, no se cierra y no
   * dice qué esperar.
   */
  it('la meta se exige aunque el contrato la acepte vacía', () => {
    dibujar();
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);

    señal<string>('meta').set('Presión por debajo de 130/80 en seis meses.');
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(true);
  });

  it('el fin no puede caer antes del inicio', () => {
    dibujar();
    señal<string>('meta').set('Bajar la presión.');
    señal<Date | null>('desde').set(new Date(2026, 8, 10));
    señal<Date | null>('hasta').set(new Date(2026, 8, 1));

    expect(interno<() => boolean>('vigenciaInvalida')()).toBe(true);
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);
  });

  /**
   * El detalle es lo que hace útil a una actividad: una fila vacía no es un
   * paso sin fecha, es nada.
   */
  it('los pasos sin detalle no viajan', () => {
    dibujar();
    señal<string>('meta').set('Bajar la presión.');
    interno<() => void>('agregarActividad')();
    const primera = interno<() => readonly { clave: number }[]>('actividades')()[0]!;
    interno<(clave: number, v: string) => void>('fijarDetalle')(primera.clave, '  Caminar 30 min  ');

    interno<() => void>('registrar')();

    const req = http.expectOne('/charts/care-plans');
    expect(req.request.body.activities).toEqual([{ detailText: 'Caminar 30 min' }]);
    req.flush(RESPUESTA);
  });

  it('sin ningún paso con detalle, `activities` se omite', () => {
    dibujar();
    señal<string>('meta').set('Bajar la presión.');

    interno<() => void>('registrar')();

    const req = http.expectOne('/charts/care-plans');
    expect('activities' in req.request.body).toBe(false);
    req.flush(RESPUESTA);
  });

  /**
   * `startDate` es `format: 'date'` en el DTO. Con `toISOString()` todo lo
   * elegido después de las 20:00 en Bolivia se habría guardado el día anterior.
   */
  it('las fechas viajan como día local, no como instante UTC', () => {
    dibujar();
    señal<string>('meta').set('Bajar la presión.');
    señal<Date | null>('desde').set(new Date(2026, 8, 10, 22, 30));

    interno<() => void>('registrar')();

    const req = http.expectOne('/charts/care-plans');
    expect(req.request.body.startDate).toBe('2026-09-10');
    req.flush(RESPUESTA);
  });

  it('los opcionales sin elegir se omiten, no viajan en null', () => {
    dibujar();
    señal<string>('meta').set('Bajar la presión.');

    interno<() => void>('registrar')();

    const req = http.expectOne('/charts/care-plans');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'authorProfileId',
      'goalText',
      'patientProfileId',
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
    señal<string>('meta').set('Bajar la presión.');
    señal<string | null>('citaElegida').set('enc-9');

    interno<() => void>('registrar')();

    const req = http.expectOne('/charts/care-plans');
    expect(req.request.body.encounterId).toBe('enc-9');
    req.flush(RESPUESTA);
  });

  it('tras abrir el plan, el formulario queda vacío', () => {
    dibujar();
    señal<string>('meta').set('Bajar la presión.');

    interno<() => void>('registrar')();
    http.expectOne('/charts/care-plans').flush(RESPUESTA);
    fixture.detectChanges();

    expect(señal<string>('meta')()).toBe('');
    expect(interno<() => readonly unknown[]>('actividades')().length).toBe(1);
  });

  describe('tieneCambiosPendientes — contrato de DraftBlock', () => {
    it('recién montado no tiene cambios pendientes', () => {
      dibujar();
      expect(componente.tieneCambiosPendientes()).toBe(false);
    });

    it('con la meta escrita tiene cambios pendientes', () => {
      dibujar();
      señal<string>('meta').set('Bajar la presión');
      expect(componente.tieneCambiosPendientes()).toBe(true);
    });

    it('una fila de actividad vacía agregada no cuenta como pendiente', () => {
      dibujar();
      interno<() => void>('agregarActividad')();
      expect(componente.tieneCambiosPendientes()).toBe(false);
    });

    it('una fila de actividad con detalle sí cuenta', () => {
      dibujar();
      interno<(clave: number, valor: string) => void>('fijarDetalle')(0, 'Caminar 30 minutos');
      expect(componente.tieneCambiosPendientes()).toBe(true);
    });
  });
});
