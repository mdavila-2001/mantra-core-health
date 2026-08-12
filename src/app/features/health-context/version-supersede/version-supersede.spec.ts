import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { VersionSupersede } from './version-supersede';

const VERSION = '55555555-5555-4555-8555-555555555555';
const REEMPLAZO = '66666666-6666-4666-8666-666666666666';

/**
 * La sutileza de esta pantalla es la obligatoriedad condicional: el reemplazo
 * se exige con `SUPERSEDED` y **no viaja** con `EXPIRED` aunque esté cargado.
 */
describe('VersionSupersede', () => {
  let fixture: ComponentFixture<VersionSupersede>;
  let component: VersionSupersede;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VersionSupersede],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(VersionSupersede);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;
    const esSenal = 'set' in valor || 'update' in valor || 'asReadonly' in valor;
    return (esSenal ? valor : valor.bind(component)) as T;
  }

  function completar(campos: { versionId?: string; replacementVersionId?: string }): void {
    interno<{ patchValue: (v: object) => void }>('form').patchValue(campos);
  }

  it('con SUPERSEDED y sin reemplazo, no manda nada', () => {
    completar({ versionId: VERSION });
    interno<{ set: (v: string) => void }>('mode').set('SUPERSEDED');
    interno<{ set: (v: string) => void }>('reason').set('desactualizada');

    interno<() => void>('submit')();

    expect(interno<() => boolean>('exigeReemplazo')()).toBe(true);
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('sin motivo no se retira: un retiro sin por qué no se puede auditar', () => {
    completar({ versionId: VERSION, replacementVersionId: REEMPLAZO });
    interno<{ set: (v: string) => void }>('mode').set('SUPERSEDED');

    interno<() => void>('submit')();
  });

  it('con SUPERSEDED viaja el reemplazo', () => {
    completar({ versionId: VERSION, replacementVersionId: REEMPLAZO });
    interno<{ set: (v: string) => void }>('mode').set('SUPERSEDED');
    interno<{ set: (v: string) => void }>('reason').set('boletín nuevo');

    interno<() => void>('submit')();

    const req = http.expectOne(`/health-context/versions/${VERSION}/supersede`);
    expect(req.request.body).toEqual({
      mode: 'SUPERSEDED',
      reason: 'boletín nuevo',
      replacementVersionId: REEMPLAZO,
    });
    req.flush({
      id: VERSION,
      statusConceptId: 'c-superseded',
      contextStatusConceptId: 'c-active',
      currentVersionId: REEMPLAZO,
    });
  });

  it('con EXPIRED el reemplazo NO viaja aunque haya quedado escrito', () => {
    completar({ versionId: VERSION, replacementVersionId: REEMPLAZO });
    interno<{ set: (v: string) => void }>('mode').set('EXPIRED');
    interno<{ set: (v: string) => void }>('reason').set('venció el período');

    interno<() => void>('submit')();

    const req = http.expectOne(`/health-context/versions/${VERSION}/supersede`);
    // Mandarlo con EXPIRED contradiría el modo; el backend decide qué hacer y
    // acá no se le manda un dato que el modo elegido declara inexistente.
    expect(req.request.body).toEqual({ mode: 'EXPIRED', reason: 'venció el período' });
    req.flush({
      id: VERSION,
      statusConceptId: 'c-expired',
      contextStatusConceptId: 'c-stale',
      currentVersionId: null,
    });
  });

  it('el selector acepta el valor del contrato y rechaza lo desconocido', () => {
    interno<(v: unknown) => void>('elegirModo')('EXPIRED');
    expect(interno<() => string | null>('mode')()).toBe('EXPIRED');

    interno<(v: unknown) => void>('elegirModo')('CUALQUIER_COSA');
    // Un valor fuera del contrato no pisa nada.
    expect(interno<() => string | null>('mode')()).toBeNull();
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otroRetiro')();
    expect(interno<() => unknown>('superseded')()).toBeNull();
  });
});
