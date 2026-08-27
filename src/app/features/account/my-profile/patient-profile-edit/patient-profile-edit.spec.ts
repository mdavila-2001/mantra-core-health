import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { PatientProfileEdit } from './patient-profile-edit';

/**
 * Editar los datos propios del paciente.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **El formulario arranca con lo que ya hay guardado**, incluido el
 *    municipio, que se preselecciona por su identificador de concepto.
 * 2. **Sólo viaja lo que cambió**, y un campo **vaciado también es un cambio**:
 *    es como se borra un segundo nombre que nunca se tuvo.
 * 3. **Sin cambios no se llama a la API.** Un `PATCH` vacío es válido en el
 *    contrato, pero pedirlo por nada ensucia la auditoría del backend.
 * 4. **Perder el catálogo de municipios no es perder el formulario**: se avisa
 *    en su bloque y el resto se sigue pudiendo corregir.
 */

/** Lo que responde `GET /profiles/patients/me`: los opcionales llegan ausentes. */
const PERFIL_BASE = {
  personId: 'per-1',
  patientProfileId: 'pp-1',
  name: 'Ana',
  middleName: 'Lucía',
  lastName: 'Quispe',
  motherLastName: 'Mamani',
  displayName: 'Ana Lucía Quispe Mamani',
  birthDate: '1985-03-14',
  sexAtBirth: 'FEMALE',
  occupationFreeText: 'Docente',
  phone: '+591 70055555',
  residenceMunicipalityConceptId: 'mun-sacaba',
  identityVerified: false,
};

/** Un departamento y dos municipios: lo justo para que el árbol tenga forma. */
const DEPARTAMENTOS = [
  {
    conceptId: 'dep-cb',
    code: 'geo:bo:department:CB',
    display: 'Cochabamba',
    codeSystemVersionId: 'csv-1',
  },
];

const MUNICIPIOS = [
  {
    conceptId: 'mun-sacaba',
    code: 'geo:bo:municipality:030201',
    display: 'Sacaba',
    codeSystemVersionId: 'csv-1',
  },
  {
    conceptId: 'mun-quillacollo',
    code: 'geo:bo:municipality:030301',
    display: 'Quillacollo',
    codeSystemVersionId: 'csv-1',
  },
];

describe('PatientProfileEdit', () => {
  let componente: PatientProfileEdit;
  let http: HttpTestingController;
  let toasts: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => {
    http.verify();
  });

  /**
   * La lectura de un conjunto por su **código interno**.
   *
   * Discrimina por `?code=` y no sólo por la URL porque el árbol de municipios
   * lee dos conjuntos de la misma ruta —departamentos y municipios— y un
   * `expectOne` por URL encuentra las dos peticiones y falla.
   */
  function pedidoDeConjunto(codigo: string) {
    return http.expectOne(
      (r) => r.url === '/terminology/value-sets' && r.params.get('code') === codigo,
    );
  }

  /** Resuelve un conjunto por su código y después su expansión. */
  function responderConjunto(codigo: string, id: string, opciones: readonly object[]): void {
    pedidoDeConjunto(codigo).flush({
      items: [{ id, internalCode: codigo, name: codigo, defaultVersionId: 'v1' }],
      count: 1,
      limit: 50,
      nextCursor: null,
    });
    http.expectOne((r) => r.url.includes(`/terminology/value-sets/${id}/$expand`)).flush({
      valueSetId: id,
      items: opciones,
      count: opciones.length,
      limit: 200,
      nextCursor: null,
    });
  }

  /** El árbol completo, que son dos catálogos: departamentos y municipios. */
  function responderMunicipios(): void {
    responderConjunto('VS_BO_DEPARTMENT', 'vs-dep', DEPARTAMENTOS);
    responderConjunto('VS_BO_MUNICIPALITY', 'vs-mun', MUNICIPIOS);
  }

  /**
   * Tumba el árbol de municipios haciendo fallar el primero de sus dos
   * catálogos.
   *
   * El segundo **no se responde con un error**: el `forkJoin` que arma el árbol
   * cancela al hermano en cuanto uno falla, y a una petición cancelada no se le
   * puede contestar («Cannot return an error for a cancelled request»). Se
   * drena con `match`, que la saca de las abiertas sin inventarle una
   * respuesta que el navegador tampoco le daría.
   */
  function caerseElCatalogo(): void {
    pedidoDeConjunto('VS_BO_DEPARTMENT').error(new ProgressEvent('error'), { status: 500 });
    http.match((r) => r.url === '/terminology/value-sets');
  }

  function montar(): void {
    componente = TestBed.createComponent(PatientProfileEdit).componentInstance;
  }

  function montarYCargar(perfil: object = {}): void {
    montar();
    http.expectOne('/profiles/patients/me').flush({ ...PERFIL_BASE, ...perfil });
    responderMunicipios();
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * Una señal escribible, **sin `bind`**: `interno` liga las funciones, y una
   * señal ligada se puede leer pero pierde su `.set`.
   */
  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  /** El `PATCH` de los datos propios, que es el único de esta pantalla. */
  function pedidoDeGuardado() {
    return http.expectOne('/profiles/patients/me');
  }

  it('siembra el formulario con lo ya guardado, en las cuatro partes del nombre', () => {
    montarYCargar();

    expect(señal<string>('nombre')()).toBe('Ana');
    expect(señal<string>('segundoNombre')()).toBe('Lucía');
    expect(señal<string>('apellidoPaterno')()).toBe('Quispe');
    expect(señal<string>('apellidoMaterno')()).toBe('Mamani');
    expect(señal<string>('ocupacion')()).toBe('Docente');
    expect(señal<string>('telefono')()).toBe('+591 70055555');
    expect(señal<string | null>('sexoAlNacer')()).toBe('FEMALE');
  });

  /**
   * La fecha llega como `format: 'date'` y se ancla a medianoche **local**:
   * anclada a UTC, un 14 de marzo se lee como 13 al oeste de Greenwich.
   */
  it('la fecha sembrada es el mismo día que declaró el alta, en hora local', () => {
    montarYCargar();

    const fecha = señal<Date | null>('fechaNacimiento')();
    expect(fecha?.getFullYear()).toBe(1985);
    expect(fecha?.getMonth()).toBe(2);
    expect(fecha?.getDate()).toBe(14);
  });

  /** El municipio se preselecciona por su concepto, no por su nombre. */
  it('preselecciona el municipio guardado y ofrece el árbol del catálogo', () => {
    montarYCargar();

    expect(señal<string | null>('municipio')()).toBe('mun-sacaba');
    const arbol = interno<() => readonly { label: string; items: readonly object[] }[]>(
      'arbolMunicipios',
    )();
    expect(arbol.map((rama) => rama.label)).toEqual(['Cochabamba']);
    expect(arbol[0]?.items).toHaveLength(2);
  });

  it('los campos que el alta no declaró arrancan vacíos, no en «undefined»', () => {
    montarYCargar({
      middleName: undefined,
      motherLastName: undefined,
      phone: undefined,
      residenceMunicipalityConceptId: undefined,
    });

    expect(señal<string>('segundoNombre')()).toBe('');
    expect(señal<string>('apellidoMaterno')()).toBe('');
    expect(señal<string>('telefono')()).toBe('');
    expect(señal<string | null>('municipio')()).toBeNull();
  });

  /* ---- el diff: sólo lo que cambió ---------------------------------------- */

  it('guardar manda sólo el campo que cambió', () => {
    montarYCargar();

    señal<string>('nombre').set('Ana María');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Ana María' });
    req.flush({ ...PERFIL_BASE, name: 'Ana María' });
  });

  /**
   * Vaciar no es «no tocar». El segundo nombre y el apellido materno se vacían
   * cuando la persona descubre que no lleva ninguno, y el backend los borra con
   * la cadena vacía.
   */
  it('un campo vaciado también cuenta como cambio y viaja en blanco', () => {
    montarYCargar();

    señal<string>('segundoNombre').set('');
    señal<string>('apellidoMaterno').set('');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ middleName: '', motherLastName: '' });
    req.flush({ ...PERFIL_BASE, middleName: undefined, motherLastName: undefined });
  });

  it('la fecha de nacimiento viaja como YYYY-MM-DD, no como instante', () => {
    montarYCargar();

    señal<Date | null>('fechaNacimiento').set(new Date(1990, 10, 2));
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ birthDate: '1990-11-02' });
    req.flush({ ...PERFIL_BASE, birthDate: '1990-11-02' });
  });

  it('cambiar el municipio manda el concepto, nunca el nombre del municipio', () => {
    montarYCargar();

    señal<string | null>('municipio').set('mun-quillacollo');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ residenceMunicipalityConceptId: 'mun-quillacollo' });
    req.flush({ ...PERFIL_BASE, residenceMunicipalityConceptId: 'mun-quillacollo' });
  });

  it('sin cambios no llama a la API, y lo dice', () => {
    montarYCargar();

    interno<() => void>('guardar')();

    http.expectNone('/profiles/patients/me');
    expect(toasts.toasts().at(-1)?.message).toBe('No había ningún cambio para guardar.');
  });

  it('guardado exitoso re-siembra con la respuesta y avisa', () => {
    montarYCargar();

    señal<string>('nombre').set('Ana María');
    interno<() => void>('guardar')();
    pedidoDeGuardado().flush({
      ...PERFIL_BASE,
      name: 'Ana María',
      displayName: 'Ana María Quispe Mamani',
    });

    expect(señal<string>('nombre')()).toBe('Ana María');
    expect(interno<() => boolean>('guardando')()).toBe(false);
    expect(toasts.toasts().at(-1)?.message).toBe('Tus datos quedaron actualizados.');
  });

  it('si el guardado falla lo dice y deja el formulario intacto para reintentar', () => {
    montarYCargar();

    señal<string>('nombre').set('Ana María');
    interno<() => void>('guardar')();
    pedidoDeGuardado().error(new ProgressEvent('error'), { status: 500 });

    expect(toasts.toasts().at(-1)?.message).toBe(
      'No pudimos guardar los cambios. Probá de nuevo.',
    );
    expect(interno<() => boolean>('guardando')()).toBe(false);
    expect(señal<string>('nombre')()).toBe('Ana María');
  });

  /* ---- validación mínima --------------------------------------------------- */

  it('sin nombre o sin apellido paterno no se puede guardar: el backend los exige', () => {
    montarYCargar();

    señal<string>('nombre').set('   ');
    expect(interno<() => boolean>('puedeGuardar')()).toBe(false);

    interno<() => void>('guardar')();
    http.expectNone('/profiles/patients/me');
  });

  it('un teléfono con letras no llega a la API; vaciarlo sí es válido', () => {
    montarYCargar();

    señal<string>('telefono').set('no tengo');
    expect(interno<() => boolean>('puedeGuardar')()).toBe(false);

    señal<string>('telefono').set('');
    expect(interno<() => boolean>('puedeGuardar')()).toBe(true);
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ phone: '' });
    req.flush({ ...PERFIL_BASE, phone: undefined });
  });

  /* ---- salidas y catálogo -------------------------------------------------- */

  it('Cancelar vuelve a «Mi perfil» sin guardar nada', () => {
    montarYCargar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    señal<string>('nombre').set('Ana María');
    interno<() => void>('cancelar')();

    expect(navegar).toHaveBeenCalledWith(['/my-account']);
    http.expectNone('/profiles/patients/me');
  });

  it('si el catálogo de municipios se cae, el resto del formulario sigue vivo', () => {
    montar();
    http.expectOne('/profiles/patients/me').flush(PERFIL_BASE);
    caerseElCatalogo();

    expect(interno<() => boolean>('catalogoMunicipiosCaido')()).toBe(true);
    expect(interno<() => readonly unknown[]>('arbolMunicipios')()).toHaveLength(0);
    expect(señal<string>('nombre')()).toBe('Ana');
  });

  it('reintentar el catálogo vuelve a tocar la red: el fallo cacheado no dura la sesión', () => {
    montar();
    http.expectOne('/profiles/patients/me').flush(PERFIL_BASE);
    caerseElCatalogo();

    interno<() => void>('reintentarMunicipios')();
    responderMunicipios();

    expect(interno<() => boolean>('catalogoMunicipiosCaido')()).toBe(false);
    expect(interno<() => readonly unknown[]>('arbolMunicipios')()).toHaveLength(1);
  });

  it('un fallo de lectura del perfil deja la pantalla en estado de error con reintento', () => {
    montar();
    http.expectOne('/profiles/patients/me').error(new ProgressEvent('error'), { status: 500 });
    responderMunicipios();

    expect(interno<() => { status: string }>('perfil')().status).toBe('error');

    interno<() => void>('recargar')();
    http.expectOne('/profiles/patients/me').flush(PERFIL_BASE);

    expect(interno<() => { status: string }>('perfil')().status).toBe('ready');
  });
});
