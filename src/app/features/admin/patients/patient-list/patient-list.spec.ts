import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PatientList } from './patient-list';

/**
 * El listado es la primera vista de Fase 0 que se puede cerrar completa: el
 * backend ya expone `GET /profiles/patients`. Estas pruebas fijan lo que
 * distingue a esta pantalla de una tabla cualquiera.
 *
 * Se monta con `RouterTestingHarness` y no con `TestBed.createComponent`
 * porque **el filtro vive en la URL**: sin un router de verdad, `buscar()`
 * navegaría al vacío y el efecto que recarga no se enteraría nunca. Es la
 * diferencia entre probar la pantalla y probar una maqueta suya.
 */
const RUTA = '/administracion/pacientes';

const FILA = {
  profileId: 'pp-1',
  personId: 'p-1',
  patientCode: 'PAC-1',
  displayName: 'Ana Salas',
  birthDate: '1985-03-14',
  deceased: false,
};

function pagina(items: unknown[], nextCursor: string | null) {
  return { items, count: items.length, limit: 25, nextCursor };
}

describe('PatientList', () => {
  let harness: RouterTestingHarness;
  let componente: PatientList;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administracion/pacientes', component: PatientList }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, PatientList);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /** La petición en vuelo, sea la del arranque o la de un cambio de filtro. */
  function peticion() {
    return http.expectOne((r) => r.url === '/profiles/patients');
  }

  function responder(items: unknown[], nextCursor: string | null = null) {
    peticion().flush(pagina(items, nextCursor));
    harness.detectChanges();
  }

  function estado() {
    return interno<() => { status: string }>('listado')();
  }

  it('pide la primera página al entrar, con el tope de la pantalla', () => {
    const req = peticion();

    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush(pagina([FILA], null));
  });

  it('con filas queda en `ready`', () => {
    responder([FILA]);

    expect(estado().status).toBe('ready');
  });

  /**
   * Los dos vacíos son distintos y la persona los vive distinto: ofrecerle
   * «registrá el primero» cuando en realidad se equivocó de apellido la empuja
   * a crear un duplicado.
   */
  it('sin pacientes y sin filtro, el vacío ofrece registrar el primero', () => {
    responder([]);

    const vacio = estado() as { status: string; nextAction: { route?: string } };
    expect(vacio.status).toBe('empty');
    expect(vacio.nextAction.route).toBe('/administracion/pacientes/nuevo');
  });

  it('sin resultados pero con filtro, el vacío ofrece volver a la lista completa', async () => {
    responder([]);

    await harness.navigateByUrl(`${RUTA}?q=salas`);
    responder([]);

    const vacio = estado() as { status: string; nextAction: { route?: string }; message?: string };
    expect(vacio.status).toBe('empty');
    // Una salida que de verdad funciona: sin ruta, el host la pinta como texto
    // inerte y la persona queda encerrada en su propio filtro.
    expect(vacio.nextAction.route).toBe('/administracion/pacientes');
    expect(vacio.message).toContain('salas');
  });

  it('buscar publica el texto en la URL y vuelve a pedir la primera página', async () => {
    responder([FILA]);

    interno<(t: string) => void>('buscar')('salas');
    await harness.fixture.whenStable();
    harness.detectChanges();

    const req = peticion();
    expect(req.request.params.get('q')).toBe('salas');
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush(pagina([FILA], null));
  });

  it('avanzar manda el cursor que devolvió la página anterior', () => {
    responder([FILA], 'cur-2');

    interno<(c: string) => void>('mover')('cur-2');

    const req = peticion();
    expect(req.request.params.get('cursor')).toBe('cur-2');

    req.flush(pagina([FILA], null));
  });

  /**
   * El contrato solo entrega `nextCursor`: volver no existe del lado del
   * backend. La pantalla recuerda el camino, y en la primera página no hay
   * «Anterior» que ofrecer.
   */
  it('en la primera página no se ofrece volver', () => {
    responder([FILA], 'cur-2');

    expect(interno<() => { prevCursor: string | null }>('cursor')().prevCursor).toBeNull();
  });

  it('volver reusa el cursor visitado, no uno inventado', () => {
    responder([FILA], 'cur-2');
    interno<(c: string) => void>('mover')('cur-2');
    responder([FILA], 'cur-3');

    expect(interno<() => { prevCursor: string | null }>('cursor')().prevCursor).toBe('anterior');

    interno<(c: string) => void>('mover')('anterior');

    const req = peticion();
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush(pagina([FILA], 'cur-2'));
  });

  it('un fallo de red se traduce a S8, no a una tabla vacía', () => {
    peticion().error(new ProgressEvent('error'), { status: 0 });
    harness.detectChanges();

    expect(estado().status).toBe('offline');
  });

  it('reintentar repite la página en la que quedó, no la primera', () => {
    responder([FILA], 'cur-2');
    interno<(c: string) => void>('mover')('cur-2');
    responder([FILA], null);

    interno<() => void>('recargar')();

    const req = peticion();
    expect(req.request.params.get('cursor')).toBe('cur-2');

    req.flush(pagina([FILA], null));
  });
});
