import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ClinicalRecord } from './clinical-record';

/**
 * Doble del expediente, que en la aplicación real es un componente diferido.
 *
 * Se usa uno mudo y no el verdadero porque lo que se prueba acá es **a dónde
 * navega** el acceso directo. Montar el expediente real dispararía sus tres
 * lecturas y la prueba pasaría a hablar de otra pantalla.
 */
@Component({ selector: 'app-expediente-doble', template: '' })
class ExpedienteDoble {}

/**
 * La puerta al expediente. Lo que estas pruebas fijan:
 *
 * 1. **El buscador prohibido no cierra la pantalla.** `GET /profiles/patients`
 *    pide `SECURITY_ADMIN`, y el rol clínico —el único que puede leer el
 *    expediente— no lo tiene. Si el 403 vaciara la pantalla, el archivo clínico
 *    sería inútil justo para quien lo necesita.
 * 2. **El acceso por identificador no valida el uuid a mano.** El backend
 *    responde 400 al mal formado y 404 al inexistente; repetir la validación
 *    acá sólo agregaría un segundo lugar donde equivocarse.
 */

const PACIENTE = {
  profileId: 'p-001',
  personId: 'per-001',
  patientCode: 'PAC-00001',
  displayName: 'Andrea Peña Rojas',
  personStatusConceptId: 'c-act',
  deceased: false,
};

describe('ClinicalRecord', () => {
  let harness: RouterTestingHarness;
  let componente: ClinicalRecord;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'medical-records', component: ClinicalRecord },
          // El expediente cuelga de acá. Se declara para que la prueba del
          // acceso directo navegue de verdad y no contra una ruta inexistente.
          { path: 'medical-records/:profileId', component: ExpedienteDoble },
        ]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/medical-records', ClinicalRecord);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function peticion() {
    return http.expectOne((r) => r.url === '/profiles/patients');
  }

  function estado() {
    return interno<() => { status: string; message?: string }>('resultados')();
  }

  it('al entrar pide el padrón sin mandar `q` vacío', () => {
    const req = peticion();
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.get('limit')).toBe('25');

    req.flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    expect(estado().status).toBe('ready');
  });

  it('buscar publica el texto en la URL y vuelve a pedir con `q`', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });

    interno<(texto: string) => void>('buscar')('peña');
    await harness.fixture.whenStable();

    const req = peticion();
    expect(req.request.params.get('q')).toBe('peña');
    req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
  });

  /**
   * El caso que justifica que el campo de identificador exista: para el rol
   * clínico esta es la respuesta normal, no una excepción.
   */
  it('un 403 del padrón enciende el acceso directo, que es el camino del rol clínico', () => {
    peticion().flush(
      { code: 'FORBIDDEN', message: 'Rol insuficiente', timestamp: '', path: '' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(estado().status).toBe('forbidden');
    expect(interno<() => boolean>('buscadorProhibido')()).toBe(true);
  });

  /**
   * **El defecto que esto fija.** La tabla delega sus estados en
   * `ViewStateHost`, y su S5 dice «No tenés acceso a esta sección» — un texto
   * escrito para una sección entera. El médico entraba al archivo clínico y leía
   * que no era suyo, cuando **sí lo es y funciona**: sólo el listado del padrón
   * es de administración, y para su rol ese 403 es la respuesta normal.
   *
   * Un rojo en el lugar más visible de la pantalla, para una condición
   * esperada, no informa: asusta y hace creer que la sección está rota.
   */
  it('con el padrón prohibido no se pinta ningún error: ni la tabla ni el buscador', async () => {
    peticion().flush(
      { code: 'FORBIDDEN', message: 'Rol insuficiente', timestamp: '', path: '' },
      { status: 403, statusText: 'Forbidden' },
    );
    await harness.fixture.whenStable();

    const html = harness.fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-data-table')).toBeNull();
    expect(html.querySelector('app-search-field')).toBeNull();
    expect(html.textContent).not.toContain('No tenés acceso a esta sección');
    // Y el camino que sí es suyo sigue ahí, que es lo que no puede perderse.
    expect(html.textContent).toContain('Abrir por identificador');
  });

  /** Con permiso, el buscador se ofrece: no se le quita a quien sí puede usarlo. */
  it('con el padrón permitido, el buscador y la tabla se ofrecen', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    await harness.fixture.whenStable();

    const html = harness.fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-search-field')).not.toBeNull();
    expect(html.querySelector('app-data-table')).not.toBeNull();
  });

  it('abrir por identificador navega al expediente de esa persona', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });

    const router = TestBed.inject(Router);
    interno<(valor: string) => void>('fijarIdentificador')('  p-001  ');
    interno<() => void>('abrirPorIdentificador')();
    await harness.fixture.whenStable();

    // El identificador se recorta antes de navegar: un espacio pegado de más no
    // debería producir una ruta distinta.
    expect(router.url).toBe('/medical-records/p-001');
  });

  it('abrir por identificador con el campo vacío no navega', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });

    const router = TestBed.inject(Router);
    interno<() => void>('abrirPorIdentificador')();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/medical-records');
  });

  it('sin filtro, el vacío dice que no hay pacientes registrados', () => {
    peticion().flush({ items: [], count: 0, limit: 25, nextCursor: null });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('Todavía no hay pacientes');
  });

  it('con filtro, el vacío nombra el texto que no encontró', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });

    interno<(texto: string) => void>('buscar')('inexistente');
    await harness.fixture.whenStable();
    peticion().flush({ items: [], count: 0, limit: 25, nextCursor: null });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inexistente');
  });
});
