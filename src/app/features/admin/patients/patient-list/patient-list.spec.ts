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
const RUTA = '/administration/patients';

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
        provideRouter([{ path: 'administration/patients', component: PatientList }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, PatientList);
    flushCatalogos();
  });

  afterEach(() => http.verify());

  /**
   * Los tres catálogos de filtro se piden una sola vez, al montar. Sin
   * responderlos acá, cualquier test que no los necesite explícitamente
   * dejaría peticiones abiertas y `http.verify()` fallaría.
   */
  function flushCatalogos(): void {
    const enumeracion = (target: string, opciones: readonly [string, string][]) => ({
      code: target,
      name: target,
      definitionId: `def-${target}`,
      valueSetId: `vs-${target}`,
      cacheToken: 'v1',
      options: opciones.map(([conceptId, display]) => ({ conceptId, code: conceptId, display })),
    });

    http
      .expectOne((r) => r.url === '/system-context/dynamic-enums' && r.params.get('target') === 'profiles.patient_profiles.abo_group_concept_id')
      .flush(
        enumeracion('abo', [
          ['abo-o', 'O'],
          ['abo-a', 'A'],
        ]),
      );
    http
      .expectOne((r) => r.url === '/system-context/dynamic-enums' && r.params.get('target') === 'profiles.patient_profiles.rh_factor_concept_id')
      .flush(enumeracion('rh', [['rh-pos', 'Rh positivo']]));
    http
      .expectOne((r) => r.url === '/system-context/dynamic-enums' && r.params.get('target') === 'profiles.patient_profiles.clinical_language_concept_id')
      .flush(enumeracion('idioma', [['lang-ay', 'Aymara']]));
    harness.detectChanges();
  }

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

  function texto(): string {
    return harness.routeNativeElement?.textContent ?? '';
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
   * Documento y teléfono los pidió el propietario el 19/09/2026 y el contrato
   * ya los declara en `PatientListItem`; el corte estaba sólo en que la tabla
   * no los mostraba. Los tres niveles del contrato: con dato, sin dato, y dato
   * vacío tratado como ausente.
   */
  it('con documento y teléfono en la fila, la tabla los muestra', () => {
    responder([{ ...FILA, nationalId: '1234567 LP', phone: '+591 70011223' }]);

    expect(texto()).toContain('1234567 LP');
    expect(texto()).toContain('+591 70011223');
  });

  it('sin documento ni teléfono en la fila, la celda lo declara en vez de dejar el hueco', () => {
    responder([FILA]);

    expect(harness.routeNativeElement?.querySelector('[aria-label="Sin documento en el listado"]')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('[aria-label="Sin teléfono en el listado"]')).toBeTruthy();
  });

  it('documento vacío se trata como ausente, no como una celda en blanco', () => {
    responder([{ ...FILA, nationalId: '', phone: '' }]);

    expect(harness.routeNativeElement?.querySelector('[aria-label="Sin documento en el listado"]')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('[aria-label="Sin teléfono en el listado"]')).toBeTruthy();
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
    expect(vacio.nextAction.route).toBe('/administration/patients/new');
  });

  it('sin resultados pero con filtro, el vacío ofrece volver a la lista completa', async () => {
    responder([]);

    await harness.navigateByUrl(`${RUTA}?q=salas`);
    responder([]);

    const vacio = estado() as { status: string; nextAction: { route?: string }; message?: string };
    expect(vacio.status).toBe('empty');
    // Una salida que de verdad funciona: sin ruta, el host la pinta como texto
    // inerte y la persona queda encerrada en su propio filtro.
    expect(vacio.nextAction.route).toBe('/administration/patients');
    expect(vacio.message).toContain('salas');
  });

  /**
   * La búsqueda la publica `app-filter-bar` en la URL — el componente no tiene
   * un método propio para eso desde que dejó de tener su propio campo. Se
   * prueba navegando, igual que el test de «sin resultados… con filtro».
   */
  it('un cambio de `q` en la URL vuelve a pedir la primera página', async () => {
    responder([FILA]);

    await harness.navigateByUrl(`${RUTA}?q=salas`);

    const req = peticion();
    expect(req.request.params.get('q')).toBe('salas');
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush(pagina([FILA], null));
  });

  /**
   * Grupo ABO, factor Rh e idioma clínico: mismo mecanismo que documento y
   * teléfono, y misma pregunta — con dato se muestra, sin dato la celda lo
   * declara. Se prueban juntos porque son el mismo camino de código repetido
   * tres veces (`aOpciones` + `etiquetaXxx` + `celdaXxx`).
   */
  it('con los tres conceptos en la fila, las columnas muestran la etiqueta del catálogo, no el uuid', () => {
    responder([{ ...FILA, aboGroupConceptId: 'abo-o', rhFactorConceptId: 'rh-pos', clinicalLanguageConceptId: 'lang-ay' }]);

    expect(texto()).toContain('O');
    expect(texto()).toContain('Rh positivo');
    expect(texto()).toContain('Aymara');
    // Nunca el conceptId crudo en pantalla.
    expect(texto()).not.toContain('abo-o');
  });

  it('sin los tres conceptos en la fila, cada celda lo declara en vez de dejar el hueco', () => {
    responder([FILA]);

    expect(harness.routeNativeElement?.querySelector('[aria-label="Sin grupo sanguíneo registrado"]')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('[aria-label="Sin factor Rh registrado"]')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('[aria-label="Sin idioma clínico registrado"]')).toBeTruthy();
  });

  /**
   * Los tres filtros viajan a la consulta con la misma clave que
   * `PatientSearchQuery` declara — es lo que permite compartir el enlace ya
   * filtrado (§10.2 del contrato del organismo: la URL es la fuente).
   */
  it('elegir un filtro de catálogo viaja a la consulta con su clave real', async () => {
    responder([FILA]);

    await harness.navigateByUrl(`${RUTA}?aboGroupConceptId=abo-o&rhFactorConceptId=rh-pos&clinicalLanguageConceptId=lang-ay`);

    const req = peticion();
    expect(req.request.params.get('aboGroupConceptId')).toBe('abo-o');
    expect(req.request.params.get('rhFactorConceptId')).toBe('rh-pos');
    expect(req.request.params.get('clinicalLanguageConceptId')).toBe('lang-ay');

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
