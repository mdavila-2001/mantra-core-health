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
 * La puerta al expediente. Lo que estas pruebas fijan (TAREA-07, P-07-10,
 * 2026-09-02):
 *
 * 1. **La búsqueda ve el padrón entero, sin acotar por tenant.** La primera
 *    versión de hoy acotaba a `CLINICIAN`/`PRACTITIONER` por actividad;
 *    Marcelo la revirtió porque la búsqueda también sirve para registrar a
 *    quien nunca se atendió.
 * 2. **Sin criterio no se pide nada.** Antes esta pantalla pedía la primera
 *    página al montar, con `q`/`nationalId` vacíos; ahora, sin acotamiento,
 *    eso sería enumerar el padrón. Al montar sin filtro no sale ninguna
 *    petición a `/profiles/patients`: se muestra un vacío que invita a
 *    escribir.
 * 3. **Un 403 lo resuelve `app-data-table` por su cuenta**, con el estado
 *    `forbidden` del M34 — no hay una rama especial en el componente.
 * 4. **«Abrir por identificador» ya no existe** (AC-07-5): la búsqueda por
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
   * constructor, sin importar si hay criterio de búsqueda o no.
   */
  function resolverCatalogoDeDepartamentosVacio() {
    http.expectOne(CATALOGO_DEPARTAMENTOS).flush({ items: [] });
  }

  it('al montar sin criterio no pide el padrón: muestra un vacío que invita a buscar', () => {
    resolverCatalogoDeDepartamentosVacio();
    http.verify();

    const actual = estado();
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('Buscá por nombre, código o documento');
  });

  it('el buscador por nombre y el de documento están siempre disponibles, aun sin criterio', () => {
    resolverCatalogoDeDepartamentosVacio();

    const html = harness.fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-search-field')).not.toBeNull();
    expect(html.querySelector('app-data-table')).not.toBeNull();
    // AC-07-5: el botón «Abrir expediente» ya no está en la pantalla.
    expect(html.textContent).not.toContain('Abrir expediente');
    expect(html.textContent).not.toContain('Abrir por identificador');
  });

  /**
   * Propietario, 19/09/2026: el médico no reconoce a nadie por un uuid ni por
   * el código interno. En su lugar, el carnet y el celular.
   */
  it('la tabla muestra documento y teléfono, no el código ni el uuid del perfil', async () => {
    resolverCatalogoDeDepartamentosVacio();

    interno<(texto: string) => void>('buscar')('peña');
    await harness.fixture.whenStable();
    peticion().flush({
      items: [{ ...PACIENTE, nationalId: '5123456', phone: '+591 70011223' }],
      count: 1,
      limit: 25,
      nextCursor: null,
    });
    harness.detectChanges();

    const html = harness.fixture.nativeElement as HTMLElement;
    const texto = html.textContent ?? '';
    expect(texto).toContain('5123456');
    expect(texto).toContain('+591 70011223');
    expect(texto).not.toContain('PAC-00001');
    expect(texto).not.toContain('p-001');
    // El teléfono se puede tocar para llamar desde el móvil.
    expect(html.querySelector('a[href="tel:+591 70011223"]')).not.toBeNull();
  });

  it('dice con palabras cuando falta el documento o el teléfono', async () => {
    resolverCatalogoDeDepartamentosVacio();

    interno<(texto: string) => void>('buscar')('peña');
    await harness.fixture.whenStable();
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
    harness.detectChanges();

    const texto = (harness.fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Sin documento registrado');
    expect(texto).toContain('Sin teléfono registrado');
  });

  it('buscar publica el texto en la URL y pide con `q`', async () => {
    resolverCatalogoDeDepartamentosVacio();

    interno<(texto: string) => void>('buscar')('peña');
    await harness.fixture.whenStable();

    const req = peticion();
    expect(req.request.params.get('q')).toBe('peña');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });

    expect(estado().status).toBe('ready');
  });

  /**
   * El defecto que esto fija: antes un 403 era la respuesta NORMAL para un rol
   * clínico —el padrón era de `SECURITY_ADMIN` a secas— y esta pantalla
   * escondía la tabla para no asustar con «No tenés acceso a esta sección».
   * Ahora que la búsqueda está abierta a los cuatro roles que llegan acá, un
   * 403 vuelve a ser lo que ese texto describe: un error genuino. No hay rama
   * especial: `app-data-table` lo resuelve con el estado `forbidden` del M34,
   * como cualquier otra lectura de la aplicación.
   */
  it('un 403 (ya excepcional) lo pinta `app-data-table` con su estado `forbidden`', async () => {
    resolverCatalogoDeDepartamentosVacio();

    interno<(texto: string) => void>('buscar')('peña');
    await harness.fixture.whenStable();
    peticion().flush(
      { code: 'FORBIDDEN', message: 'Rol insuficiente', timestamp: '', path: '' },
      { status: 403, statusText: 'Forbidden' },
    );
    await harness.fixture.whenStable();

    expect(estado().status).toBe('forbidden');
    const html = harness.fixture.nativeElement as HTMLElement;
    // La tabla sigue montada: es ella quien resuelve el estado, no un `@if` del componente.
    expect(html.querySelector('app-data-table')).not.toBeNull();
    expect(html.textContent).toContain('No tenés acceso a esta sección');
  });

  /** AC-07-1: encuentra por documento exacto, aunque el nombre no coincida. */
  it('buscar por documento publica `nationalId` en la URL y en la petición', async () => {
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

  /**
   * El defecto que esto fija (19/09/2026), visto en el navegador: **buscar por
   * documento se deshacía solo** si antes se había buscado por nombre.
   *
   * La cadena: el botón publica el documento y limpia `q` → el campo de nombre
   * está atado a `q`, así que se vacía de rebote → al vaciarse avisa con texto
   * vacío → y ese aviso escribía el mapa de parámetros ENTERO, borrando el
   * `nationalId` recién puesto. En pantalla se veía como que el botón no hacía
   * nada: la URL quedaba pelada y la tabla volvía al vacío inicial.
   */
  it('el rebote del buscador por nombre al vaciarse no borra el documento', async () => {
    resolverCatalogoDeDepartamentosVacio();

    interno<(texto: string) => void>('buscar')('peña');
    await harness.fixture.whenStable();
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });

    interno<(valor: string) => void>('fijarDocumento')('1234567');
    interno<() => void>('buscarPorDocumento')();
    await harness.fixture.whenStable();
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });

    // Esto es exactamente lo que emite `app-search-field` cuando `q`
    // desaparece de la URL y su campo se vacía solo.
    interno<(texto: string) => void>('buscar')('');
    await harness.fixture.whenStable();

    const router = TestBed.inject(Router);
    expect(router.url).toContain('nationalId=1234567');
    expect(estado().status).toBe('ready');
  });

  /** Y al revés: escribir un nombre sí deja sin efecto al documento. */
  it('buscar por nombre limpia el documento de la URL', async () => {
    resolverCatalogoDeDepartamentosVacio();

    interno<(valor: string) => void>('fijarDocumento')('1234567');
    interno<() => void>('buscarPorDocumento')();
    await harness.fixture.whenStable();
    peticion().flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });

    interno<(texto: string) => void>('buscar')('peña');
    await harness.fixture.whenStable();

    const router = TestBed.inject(Router);
    expect(router.url).not.toContain('nationalId');
    const req = peticion();
    expect(req.request.params.get('q')).toBe('peña');
    expect(req.request.params.has('nationalId')).toBe(false);
    req.flush({ items: [PACIENTE], count: 1, limit: 25, nextCursor: null });
  });

  it('buscar por documento con el campo vacío no navega ni pide nada', async () => {
    resolverCatalogoDeDepartamentosVacio();

    const router = TestBed.inject(Router);
    interno<() => void>('buscarPorDocumento')();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/medical-records');
    expect(estado().status).toBe('empty');
  });

  it('con filtro por nombre, el vacío nombra el texto que no encontró', async () => {
    resolverCatalogoDeDepartamentosVacio();

    interno<(texto: string) => void>('buscar')('inexistente');
    await harness.fixture.whenStable();
    peticion().flush({ items: [], count: 0, limit: 25, nextCursor: null });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inexistente');
    // P-07-10: el padrón ya no está acotado por actividad — un vacío ya no
    // le dice a quien pregunta que busque «en tu organización».
    expect(actual.message).not.toContain('organización');
  });

  it('con filtro por documento, el vacío nombra el documento buscado', async () => {
    resolverCatalogoDeDepartamentosVacio();

    interno<(valor: string) => void>('fijarDocumento')('0000000');
    interno<() => void>('buscarPorDocumento')();
    await harness.fixture.whenStable();
    peticion().flush({ items: [], count: 0, limit: 25, nextCursor: null });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('0000000');
    expect(actual.message).not.toContain('organización');
  });
});
