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
 * navega** el acceso desde una fila de la tabla.
 */
@Component({ selector: 'app-expediente-doble', template: '' })
class ExpedienteDoble {}

/** La petición del catálogo de departamentos que dispara el constructor. */
const CATALOGO_DEPARTAMENTOS = '/terminology/value-sets?code=VS_BO_DEPARTMENT';

/**
 * La puerta al expediente. Lo que estas pruebas fijan (TAREA-07, 2026-09-02):
 *
 * 1. **La búsqueda ya no es exclusiva de un rol.** `GET /profiles/patients`
 *    se abrió a `CLINICIAN`/`PRACTITIONER` acotado a su tenant; esta pantalla
 *    no distingue roles, sólo pinta lo que el backend responde.
 * 2. **Un 403 lo resuelve `app-data-table` por su cuenta**, con el estado
 *    `forbidden` del M34 — no hay una rama especial en el componente.
 * 3. **«Abrir por identificador» ya no existe** (AC-07-5): la búsqueda por
 *    documento es ahora el camino de quien atiende.
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

  /**
   * El catálogo de departamentos se pide en paralelo, en la misma tanda del
   * constructor. Se resuelve vacío por defecto: la mayoría de estas pruebas no
   * hablan de él, y el campo de documento tiene que seguir usable sin catálogo.
   */
  function resolverCatalogoDeDepartamentosVacio() {
    http.expectOne(CATALOGO_DEPARTAMENTOS).flush({ items: [] });
  }

  it('al entrar pide el padrón sin mandar `q` vacío', () => {
    const req = peticion();
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('nationalId')).toBe(false);
    expect(req.request.params.get('limit')).toBe('25');

    req.flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();
    expect(estado().status).toBe('ready');
  });

  it('buscar publica el texto en la URL y vuelve a pedir con `q`', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();

    interno<(texto: string) => void>('buscar')('peña');
    await harness.fixture.whenStable();

    const req = peticion();
    expect(req.request.params.get('q')).toBe('peña');
    req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
  });

  /**
   * El defecto que esto fija: antes un 403 era la respuesta NORMAL para un rol
   * clínico —el padrón era de `SECURITY_ADMIN` a secas— y esta pantalla
   * escondía la tabla para no asustar con «No tenés acceso a esta sección».
   * Ahora que la búsqueda está abierta (acotada a tenant) a los roles que
   * llegan acá, un 403 vuelve a ser lo que ese texto describe: un error
   * genuino. No hay rama especial: `app-data-table` lo resuelve con el estado
   * `forbidden` del M34, como cualquier otra lectura de la aplicación.
   */
  it('un 403 (ya excepcional) lo pinta `app-data-table` con su estado `forbidden`', async () => {
    peticion().flush(
      { code: 'FORBIDDEN', message: 'Rol insuficiente', timestamp: '', path: '' },
      { status: 403, statusText: 'Forbidden' },
    );
    resolverCatalogoDeDepartamentosVacio();
    await harness.fixture.whenStable();

    expect(estado().status).toBe('forbidden');
    const html = harness.fixture.nativeElement as HTMLElement;
    // La tabla sigue montada: es ella quien resuelve el estado, no un `@if` del componente.
    expect(html.querySelector('app-data-table')).not.toBeNull();
    expect(html.textContent).toContain('No tenés acceso a esta sección');
  });

  it('el buscador por nombre y el de documento están siempre disponibles', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();
    await harness.fixture.whenStable();

    const html = harness.fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-search-field')).not.toBeNull();
    expect(html.querySelector('app-data-table')).not.toBeNull();
    // AC-07-5: el botón «Abrir expediente» ya no está en la pantalla.
    expect(html.textContent).not.toContain('Abrir expediente');
    expect(html.textContent).not.toContain('Abrir por identificador');
  });

  /** AC-07-1: encuentra por documento exacto, aunque el nombre no coincida. */
  it('buscar por documento publica `nationalId` en la URL y en la petición', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();

    const router = TestBed.inject(Router);
    interno<(valor: string) => void>('fijarDocumento')('  1234567  ');
    interno<() => void>('buscarPorDocumento')();
    await harness.fixture.whenStable();

    expect(router.url).toContain('nationalId=1234567');
    // El documento se recorta: un espacio pegado de más no cambia la búsqueda.
    const req = peticion();
    expect(req.request.params.get('nationalId')).toBe('1234567');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
  });

  /**
   * AC-07-2: un mismo número expedido en otro departamento no es la misma
   * persona. El select del departamento viaja como
   * `issuerAdministrativeAreaConceptId`.
   */
  it('el departamento elegido viaja junto al documento', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();

    interno<(valor: string) => void>('fijarDocumento')('1234567');
    // `interno()` liga la señal a `componente` para los casos de función; una
    // señal escribible pierde su `.set` al ligarse, así que este acceso va
    // directo, sin pasar por ese helper.
    (
      componente as unknown as { departamentoElegido: { set(valor: string | null): void } }
    ).departamentoElegido.set('area-sc');
    interno<() => void>('buscarPorDocumento')();
    await harness.fixture.whenStable();

    const req = peticion();
    expect(req.request.params.get('issuerAdministrativeAreaConceptId')).toBe('area-sc');
    req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
  });

  /**
   * Documento y nombre son dos formas de encontrar a la misma persona, no dos
   * filtros que se combinan: buscar por documento limpia `q` de la URL.
   */
  it('buscar por documento limpia el filtro por nombre', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();

    interno<(texto: string) => void>('buscar')('peña');
    await harness.fixture.whenStable();
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });

    interno<(valor: string) => void>('fijarDocumento')('1234567');
    interno<() => void>('buscarPorDocumento')();
    await harness.fixture.whenStable();

    const router = TestBed.inject(Router);
    expect(router.url).not.toContain('q=');
    const req = peticion();
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
  });

  it('buscar por documento con el campo vacío no navega ni pide de nuevo', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();

    const router = TestBed.inject(Router);
    interno<() => void>('buscarPorDocumento')();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/medical-records');
  });

  it('sin filtro, el vacío dice que no hay pacientes registrados', () => {
    peticion().flush({ items: [], count: 0, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('Todavía no hay pacientes');
  });

  it('con filtro por nombre, el vacío nombra el texto que no encontró', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();

    interno<(texto: string) => void>('buscar')('inexistente');
    await harness.fixture.whenStable();
    peticion().flush({ items: [], count: 0, limit: 25, nextCursor: null });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inexistente');
  });

  it('con filtro por documento, el vacío nombra el documento buscado', async () => {
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    resolverCatalogoDeDepartamentosVacio();

    interno<(valor: string) => void>('fijarDocumento')('0000000');
    interno<() => void>('buscarPorDocumento')();
    await harness.fixture.whenStable();
    peticion().flush({ items: [], count: 0, limit: 25, nextCursor: null });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('0000000');
  });
});
