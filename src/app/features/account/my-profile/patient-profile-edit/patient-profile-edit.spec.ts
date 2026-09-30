import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import type { FormControl } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';

import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { PatientProfileEdit } from './patient-profile-edit';
import { UbicacionPicker } from '../../../auth/registro-compartido/ubicacion-picker/ubicacion-picker';

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
 * 4. **Perder un catálogo no es perder el formulario**: se avisa en su bloque,
 *    se ofrece reintentar y el resto se sigue pudiendo corregir.
 * 5. **El editor ofrece exactamente lo que ofrece el alta**: la ocupación como
 *    concepto del catálogo, el teléfono compuesto con su país y el género en
 *    dos opciones. Un editor que admite más de lo que el alta admite convierte
 *    «corregir mis datos» en una segunda puerta con otras reglas.
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
  occupationConceptId: 'oc-docente',
  phone: '+591 70055555',
  residenceMunicipalityConceptId: 'mun-sacaba',
  identityVerified: false,
};

/** El mensaje que el alta muestra cuando el número no está completo. */
const TELEFONO_INCOMPLETO = 'El número está incompleto para el país elegido.';

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

/** Dos ocupaciones del catálogo `VS_BO_OCCUPATION`, con sus conceptos reales. */
const OCUPACIONES = [
  {
    conceptId: 'oc-docente',
    code: 'occupation:TEACHER',
    display: 'Docente',
    codeSystemVersionId: 'csv-1',
  },
  {
    conceptId: 'oc-albanil',
    code: 'occupation:BUILDER',
    display: 'Albañil',
    codeSystemVersionId: 'csv-1',
  },
];

describe('PatientProfileEdit', () => {
  let fixture: ComponentFixture<PatientProfileEdit>;
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
    http
      .expectOne((r) => r.url.includes(`/terminology/value-sets/${id}/$expand`))
      .flush({
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

  /** El catálogo de ocupaciones, que la pantalla pide junto con el árbol. */
  function responderOcupaciones(): void {
    responderConjunto('VS_BO_OCCUPATION', 'vs-oc', OCUPACIONES);
  }

  /** Los dos catálogos de la pantalla, que es lo que pide al montarse. */
  function responderCatalogos(): void {
    responderMunicipios();
    responderOcupaciones();
  }

  /**
   * Tumba el árbol de municipios haciendo fallar el primero de sus dos
   * catálogos.
   *
   * El segundo **no se responde con un error**: el `forkJoin` que arma el árbol
   * cancela al hermano en cuanto uno falla, y a una petición cancelada no se le
   * puede contestar («Cannot return an error for a cancelled request»). Se
   * drena con `match`, que la saca de las abiertas sin inventarle una
   * respuesta que el navegador tampoco le daría. Se acota al conjunto de
   * municipios: el de ocupaciones sale de la misma ruta y no tiene nada que ver
   * con este fallo.
   */
  function caerseElCatalogo(): void {
    pedidoDeConjunto('VS_BO_DEPARTMENT').error(new ProgressEvent('error'), { status: 500 });
    http.match(
      (r) => r.url === '/terminology/value-sets' && r.params.get('code') === 'VS_BO_MUNICIPALITY',
    );
  }

  /** Tumba el catálogo de ocupaciones, que es una sola lectura. */
  function caerseElCatalogoDeOcupaciones(): void {
    pedidoDeConjunto('VS_BO_OCCUPATION').error(new ProgressEvent('error'), { status: 500 });
  }

  function montar(): void {
    fixture = TestBed.createComponent(PatientProfileEdit);
    componente = fixture.componentInstance;
  }

  function montarYCargar(perfil: object = {}): void {
    montar();
    http.expectOne('/profiles/patients/me').flush({ ...PERFIL_BASE, ...perfil });
    responderCatalogos();
  }

  /** Lo mismo, pero además pintando la pantalla: para lo que hay que ver dibujado. */
  function montarPintadoYCargado(perfil: object = {}): void {
    montarYCargar(perfil);
    fixture.detectChanges();
  }

  /**
   * Abre la pestaña donde vive un campo.
   *
   * El formulario es UNA tarjeta con pestañas (pedido del 09/09/2026) y
   * `app-tab` no dibuja el panel cerrado: para teclear el teléfono hay que
   * estar en «Contacto», igual que la persona. Los valores viven en señales
   * del componente, así que cambiar de pestaña no pierde lo tecleado.
   */
  function abrirPestana(indice: number): void {
    const pestanas = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    );
    const pestana = pestanas[indice];
    if (pestana === undefined) {
      throw new Error(`No hay pestaña ${indice} en la pantalla.`);
    }
    if (pestana.getAttribute('aria-selected') !== 'true') {
      pestana.click();
      fixture.detectChanges();
    }
  }

  /** En qué pestaña está cada campo, por su `data-testid`. */
  function pestanaDe(testId: string): number {
    if (/^perfil-(telefono|municipio|domicilio|trabajo|correo)/.test(testId)) {
      return 1;
    }
    if (/^perfil-(nit|razon-social)/.test(testId)) {
      return 2;
    }
    return 0;
  }

  /** El `<select>` real de un campo, que vive dentro del átomo. */
  function desplegable(testId: string): HTMLSelectElement | null {
    abrirPestana(pestanaDe(testId));
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      `[data-testid="${testId}"] select`,
    );
  }

  /** Las etiquetas que ofrece un desplegable, marcador incluido. */
  function opcionesDe(testId: string): readonly string[] {
    return [...(desplegable(testId)?.options ?? [])].map((opcion) => opcion.text.trim());
  }

  /** El `<input>` real del teléfono, que vive dentro de `app-phone-input`. */
  function campoDeTelefono(): HTMLInputElement {
    abrirPestana(pestanaDe('perfil-telefono'));
    const campo = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-testid="perfil-telefono"]',
    );
    if (campo === null) {
      throw new Error('El campo de teléfono no está en la pantalla.');
    }
    return campo;
  }

  /** Teclea en el campo de teléfono, que es como se cambia de verdad. */
  function teclearTelefono(digitos: string): void {
    const campo = campoDeTelefono();
    campo.value = digitos;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** El texto del campo que envuelve a un control, sea ayuda o error. */
  function notaDelCampo(testId: string, clase: string): string {
    abrirPestana(pestanaDe(testId));
    const campo = (fixture.nativeElement as HTMLElement)
      .querySelector(`[data-testid="${testId}"]`)
      ?.closest('app-form-field');
    return campo?.querySelector(clase)?.textContent?.trim() ?? '';
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

  /**
   * El control del teléfono.
   *
   * Es lo único que no va en una señal: `app-phone-input` es un
   * `ControlValueAccessor`, así que escribir el teléfono es escribir su control
   * —igual que hace el campo cuando alguien teclea—.
   */
  function telefono(): FormControl<string> {
    return (componente as unknown as Record<string, FormControl<string>>)['telefonoControl'];
  }

  /** El `PATCH` de los datos propios, que es el único de esta pantalla. */
  function pedidoDeGuardado() {
    return http.expectOne('/profiles/patients/me');
  }

  /**
   * N-03: «Mis puntos» es la billetera del programa de fidelidad, no un dato
   * declarado, y no hay nada que editar ahí. Desde el 25/09/2026 (pedido del
   * propietario) el editor ya no la muestra apagada: la saca de la tira.
   */
  it('no lleva «Mis puntos» en la tira: no hay nada que editar ahí', () => {
    montarPintadoYCargado();

    const pestanas = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    );
    expect([...pestanas].map((p) => p.textContent?.trim())).not.toContain('Mis puntos');
  });

  /**
   * Pedido del propietario del 25/09/2026: una cobertura es el resultado de
   * una integración posterior —la aseguradora la declara, no la persona—, así
   * que nunca se corrige desde este formulario. No es el caso de «Tutores»,
   * que sí puede cambiar y por eso sigue siendo una pestaña utilizable. El
   * mismo día se corrigió: en vez de apagada, «Seguros» se saca de la tira
   * del editor, igual que «Mis puntos».
   */
  it('«Seguros» no está en la tira del editor; «Tutores» sigue abierta', () => {
    montarPintadoYCargado({
      coverages: [{ carrierName: 'Alianza Vida Seguros', planName: 'AFI Gold' }],
      guardians: [{ displayName: 'Carlos Mamani', phone: '+591 70055443' }],
    });

    const pestanas = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ];
    expect(pestanas.map((p) => p.textContent?.trim())).toEqual([
      'Datos personales',
      'Contacto',
      'Facturación',
      'Tutores',
    ]);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Alianza Vida Seguros');

    expect(pestanas[3].disabled).toBe(false);
    abrirPestana(3);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Carlos Mamani');
  });

  it('siembra el formulario con lo ya guardado, en las cuatro partes del nombre', () => {
    montarYCargar();

    expect(señal<string>('nombre')()).toBe('Ana');
    expect(señal<string>('segundoNombre')()).toBe('Lucía');
    expect(señal<string>('apellidoPaterno')()).toBe('Quispe');
    expect(señal<string>('apellidoMaterno')()).toBe('Mamani');
    expect(señal<string | null>('ocupacionConceptId')()).toBe('oc-docente');
    expect(telefono().value).toBe('+591 70055555');
    expect(señal<string>('telefono')()).toBe('+591 70055555');
    expect(señal<string | null>('sexoAlNacer')()).toBe('FEMALE');
  });

  /**
   * Quien tiene cuatro o cinco nombres los declaró en casillas separadas al
   * registrarse, y la base los guarda en una sola columna separados por
   * espacio. El editor tiene que deshacer esa unión: si no, se abren apretados
   * dentro de «Segundo nombre» y corregir el cuarto obliga a reescribir todos.
   */
  it('reparte en casillas los nombres que están guardados como un solo texto', () => {
    montarYCargar({ middleName: 'Lucía María Belén Sofía' });

    expect(señal<string>('segundoNombre')()).toBe('Lucía');
    expect(señal<string>('tercerNombre')()).toBe('María');
    expect(señal<readonly string[]>('nombresExtra')()).toEqual(['Belén', 'Sofía']);
  });

  it('un solo nombre adicional deja las demás casillas vacías', () => {
    montarYCargar();

    expect(señal<string>('segundoNombre')()).toBe('Lucía');
    expect(señal<string>('tercerNombre')()).toBe('');
    expect(señal<readonly string[]>('nombresExtra')()).toEqual([]);
  });

  it('los nombres agregados vuelven a viajar como un solo texto', () => {
    montarYCargar();

    señal<string>('tercerNombre').set('María');
    señal<readonly string[]>('nombresExtra').set(['Belén']);
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ middleName: 'Lucía María Belén' });
    req.flush({ ...PERFIL_BASE, middleName: 'Lucía María Belén' });
  });

  it('quitar una casilla del medio no deja un espacio doble', () => {
    montarYCargar({ middleName: 'Lucía María Belén' });

    // Se quita «María», que estaba en la casilla del tercer nombre.
    señal<string>('tercerNombre').set('');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ middleName: 'Lucía Belén' });
    req.flush({ ...PERFIL_BASE, middleName: 'Lucía Belén' });
  });

  it('sin tocar los nombres no se manda ningún cambio, aunque sean varios', () => {
    montarYCargar({ middleName: 'Lucía María Belén' });

    interno<() => void>('guardar')();

    http.expectNone('/profiles/patients/me');
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
    const arbol =
      interno<() => readonly { label: string; items: readonly object[] }[]>('arbolMunicipios')();
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
    expect(telefono().value).toBe('');
    expect(señal<string | null>('municipio')()).toBeNull();
  });

  /* ---- el punto en el mapa de cada dirección ------------------------------ */

  /**
   * El GPS del domicilio y el del trabajo — lo que el alta ya preguntaba y el
   * perfil no dejaba tocar.
   *
   * Hasta acá el contrato sólo aceptaba el TEXTO de la dirección; su propio
   * comentario decía que «las coordenadas las conserva el backend de la
   * dirección anterior», que es otra forma de decir que quien se mudaba se
   * quedaba con el punto de la casa vieja para siempre.
   */
  describe('la ubicación en el mapa (como en una app de pedidos)', () => {
    /** Un perfil con las dos direcciones y sólo el domicilio ubicado. */
    const CON_DIRECCIONES = {
      homeAddress: { lines: 'Av. Banzer 3er anillo', latitude: -17.78, longitude: -63.18 },
      workAddress: { lines: 'Calle Ayacucho 241' },
    };

    it('siembra el mapa con el punto ya guardado, y deja vacío el que no lo tiene', () => {
      // Sin esto, abrir «editar» mostraría el bloque vacío y quien guardara sin
      // tocar el mapa perdería su ubicación.
      montarYCargar(CON_DIRECCIONES);

      expect(señal<unknown>('gpsDomicilioGuardado')()).toEqual({ lat: -17.78, lng: -63.18 });
      expect(señal<unknown>('gpsTrabajoGuardado')()).toBeNull();
    });

    it('media coordenada no ubica nada: no siembra el mapa', () => {
      montarYCargar({ homeAddress: { lines: 'Av. Banzer', latitude: -17.78 } });

      expect(señal<unknown>('gpsDomicilioGuardado')()).toBeNull();
    });

    it('no tocar el mapa no manda coordenadas', () => {
      // Mandar el punto actual «por las dudas» convertiría cualquier guardado
      // en una reescritura de la ubicación.
      montarYCargar(CON_DIRECCIONES);

      señal<string>('nombre').set('Ana María');
      interno<() => void>('guardar')();

      const req = pedidoDeGuardado();
      expect(req.request.body).toEqual({ name: 'Ana María' });
      req.flush({ ...PERFIL_BASE, ...CON_DIRECCIONES });
    });

    it('confirmar un punto lo manda como par', () => {
      montarYCargar(CON_DIRECCIONES);

      señal<unknown>('gpsDomicilio').set({ lat: -16.5, lng: -68.15 });
      interno<() => void>('guardar')();

      const req = pedidoDeGuardado();
      expect(req.request.body).toEqual({ homeLatitude: -16.5, homeLongitude: -68.15 });
      req.flush({ ...PERFIL_BASE, ...CON_DIRECCIONES });
    });

    it('quitar el punto lo manda como null en los dos extremos', () => {
      // `null` es «lo quité» y ausente es «no lo toqué»: son dos cosas
      // distintas, y confundirlas borraría la ubicación de quien sólo vino a
      // cambiar el teléfono.
      montarYCargar(CON_DIRECCIONES);

      señal<unknown>('gpsDomicilio').set(null);
      interno<() => void>('guardar')();

      const req = pedidoDeGuardado();
      expect(req.request.body).toEqual({ homeLatitude: null, homeLongitude: null });
      req.flush({ ...PERFIL_BASE, ...CON_DIRECCIONES });
    });

    it('el trabajo tiene su propio punto, independiente del domicilio', () => {
      montarYCargar(CON_DIRECCIONES);

      señal<unknown>('gpsTrabajo').set({ lat: -17.8, lng: -63.2 });
      interno<() => void>('guardar')();

      const req = pedidoDeGuardado();
      expect(req.request.body).toEqual({ workLatitude: -17.8, workLongitude: -63.2 });
      req.flush({ ...PERFIL_BASE, ...CON_DIRECCIONES });
    });

    /**
     * D-06: tocar el mapa deja la dirección escrita en blanco y lo dice al
     * lado del campo, porque el punto nuevo ya no es esa calle.
     */
    it('tocar el mapa vacía la dirección escrita y lo dice junto al campo', () => {
      montarPintadoYCargado(CON_DIRECCIONES);
      abrirPestana(pestanaDe('perfil-domicilio'));
      fixture.detectChanges();
      const raiz = fixture.nativeElement as HTMLElement;
      const [domicilio, trabajo] = fixture.debugElement
        .queryAll(By.directive(UbicacionPicker))
        .map((el) => el.componentInstance as UbicacionPicker);
      expect(señal<string>('domicilio')()).toBe('Av. Banzer 3er anillo');

      domicilio.fijarPunto({ lat: -17.79, lng: -63.19 });
      fixture.detectChanges();

      expect(señal<string>('domicilio')()).toBe('');
      expect(raiz.querySelector('[data-testid="perfil-domicilio-reescribir"]')?.textContent).toContain(
        'Volvé a escribir la dirección para este punto',
      );
      // El trabajo no se entera: cada mapa vacía sólo su campo.
      expect(señal<string>('direccionTrabajo')()).toBe('Calle Ayacucho 241');
      expect(raiz.querySelector('[data-testid="perfil-trabajo-reescribir"]')).toBeNull();

      // Volver a escribir se lleva el aviso: acompaña al campo vacío.
      señal<string>('domicilio').set('Av. Banzer, 4to anillo');
      fixture.detectChanges();
      expect(raiz.querySelector('[data-testid="perfil-domicilio-reescribir"]')).toBeNull();

      trabajo.fijarPunto({ lat: -17.8, lng: -63.2 });
      fixture.detectChanges();
      expect(señal<string>('direccionTrabajo')()).toBe('');
      expect(raiz.querySelector('[data-testid="perfil-trabajo-reescribir"]')).not.toBeNull();
    });

    it('los dos mapas se dibujan en la pestaña de ubicación', () => {
      montarPintadoYCargado(CON_DIRECCIONES);
      // Los mapas viven con las direcciones, en «Ubicación y contacto».
      abrirPestana(pestanaDe('perfil-domicilio'));
      fixture.detectChanges();

      const mapas = (fixture.nativeElement as HTMLElement).querySelectorAll(
        'app-ubicacion-picker',
      );
      expect(mapas).toHaveLength(2);
    });
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

    expect(toasts.toasts().at(-1)?.message).toBe('No pudimos guardar los cambios. Probá de nuevo.');
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

  /**
   * El campo compone el número, así que lo único que puede fallar es que esté
   * incompleto para el país elegido — y se dice **con las palabras del alta**:
   * dos redacciones del mismo rechazo se leen como dos reglas distintas.
   */
  it('un teléfono incompleto no llega a la API, y lo dice como lo dice el alta', () => {
    montarPintadoYCargado();

    telefono().setValue('+591 7005');
    expect(interno<() => boolean>('telefonoMalEscrito')()).toBe(true);
    expect(interno<() => boolean>('puedeGuardar')()).toBe(false);

    fixture.detectChanges();
    expect(notaDelCampo('perfil-telefono', '.form-field-error')).toBe(TELEFONO_INCOMPLETO);

    interno<() => void>('guardar')();
    http.expectNone('/profiles/patients/me');
  });

  it('vaciar el teléfono sí es válido, y viaja en blanco para borrarlo', () => {
    montarYCargar();

    telefono().setValue('');
    expect(interno<() => boolean>('puedeGuardar')()).toBe(true);
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ phone: '' });
    req.flush({ ...PERFIL_BASE, phone: undefined });
  });

  /** Un número completo viaja con el prefijo del país delante, no a secas. */
  it('un teléfono completo viaja compuesto con su prefijo', () => {
    montarYCargar();

    telefono().setValue('+591 70012345');
    expect(interno<() => boolean>('telefonoMalEscrito')()).toBe(false);
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ phone: '+591 70012345' });
    req.flush({ ...PERFIL_BASE, phone: '+591 70012345' });
  });

  /* ---- el teléfono guardado en formatos viejos ---------------------------- */

  /**
   * En la base conviven tres formas del mismo número —el `@Matches` del backend
   * las acepta todas y el alta anterior dejaba escribirlo a mano—. El campo las
   * pinta todas igual, pero `telefonoCompleto` sólo acepta la compuesta: sembrar
   * el dato crudo dejaba el editor **abierto en inválido**, con «Guardar
   * cambios» deshabilitado, y entonces no se podía corregir ni el nombre.
   */
  it.each([
    ['+591 700 22222', '7002 2222'],
    ['70012345', '7001 2345'],
  ])('un teléfono guardado como «%s» abre el editor válido y editable', (guardado, visible) => {
    montarPintadoYCargado({ phone: guardado });

    expect(campoDeTelefono().value).toBe(visible);
    expect(interno<() => boolean>('telefonoMalEscrito')()).toBe(false);
    expect(interno<() => boolean>('puedeGuardar')()).toBe(true);
    expect(notaDelCampo('perfil-telefono', '.form-field-error')).toBe('');
  });

  /**
   * Y no viaja solo. Normalizar en silencio lo que nadie tocó cerraría el
   * contacto vigente y abriría otro sin que la persona hiciera nada: es una
   * decisión suya, no de una pantalla que se abrió.
   */
  it.each(['+591 700 22222', '70012345'])(
    'el teléfono heredado «%s» no viaja si nadie lo tocó',
    (guardado) => {
      montarYCargar({ phone: guardado });

      señal<string>('nombre').set('Ana María');
      interno<() => void>('guardar')();

      const req = pedidoDeGuardado();
      expect(req.request.body).toEqual({ name: 'Ana María' });
      req.flush({ ...PERFIL_BASE, name: 'Ana María', phone: guardado });
    },
  );

  it('vaciar un teléfono heredado sí viaja, y lo borra', () => {
    montarPintadoYCargado({ phone: '+591 700 22222' });

    teclearTelefono('');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ phone: '' });
    req.flush({ ...PERFIL_BASE, phone: undefined });
  });

  it('teclear encima de un teléfono heredado manda la forma compuesta', () => {
    montarPintadoYCargado({ phone: '70012345' });

    teclearTelefono('71234567');
    expect(campoDeTelefono().value).toBe('7123 4567');

    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ phone: '+591 71234567' });
    req.flush({ ...PERFIL_BASE, phone: '+591 71234567' });
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
    responderOcupaciones();

    expect(interno<() => boolean>('catalogoMunicipiosCaido')()).toBe(true);
    expect(interno<() => readonly unknown[]>('arbolMunicipios')()).toHaveLength(0);
    expect(señal<string>('nombre')()).toBe('Ana');
  });

  it('reintentar el catálogo vuelve a tocar la red: el fallo cacheado no dura la sesión', () => {
    montar();
    http.expectOne('/profiles/patients/me').flush(PERFIL_BASE);
    caerseElCatalogo();
    responderOcupaciones();

    interno<() => void>('reintentarMunicipios')();
    responderMunicipios();

    expect(interno<() => boolean>('catalogoMunicipiosCaido')()).toBe(false);
    expect(interno<() => readonly unknown[]>('arbolMunicipios')()).toHaveLength(1);
  });

  it('un fallo de lectura del perfil deja la pantalla en estado de error con reintento', () => {
    montar();
    http.expectOne('/profiles/patients/me').error(new ProgressEvent('error'), { status: 500 });
    responderCatalogos();

    expect(interno<() => { status: string }>('perfil')().status).toBe('error');

    interno<() => void>('recargar')();
    http.expectOne('/profiles/patients/me').flush(PERFIL_BASE);

    expect(interno<() => { status: string }>('perfil')().status).toBe('ready');
  });

  /* ---- la ocupación, que ahora es un concepto del catálogo ---------------- */

  /**
   * **La ocupación se busca escribiendo, no se recorre.**
   *
   * El registro de procesos pide «una lupa de buscar» para las ocupaciones
   * (PACIENTE §1.4.2) porque son cientos. El alta ya la tenía; este editor
   * había quedado con un `<select>` nativo, que con el catálogo entero es una
   * tira sin filtro. Por eso esta prueba ya no cuenta `<option>`: mira lo que
   * el combobox ofrece, y sobre todo que **filtre**.
   */
  it('ofrece el catálogo de ocupaciones en una lupa', () => {
    montarPintadoYCargado();

    const host = fixture.nativeElement as HTMLElement;
    const lupa = host.querySelector('[data-testid="perfil-ocupacion"]');
    expect(lupa).toBeTruthy();
    expect(lupa?.querySelector('input')).toBeTruthy();
  });

  it('escribir filtra las ocupaciones que se parecen', () => {
    montarPintadoYCargado();

    señal<string>('busquedaOcupacion').set('alba');

    const filtradas = interno<() => readonly { label: string }[]>('ocupacionesFiltradas')();
    expect(filtradas.map((o) => o.label)).toEqual(['Albañil']);
  });

  /** Sin nada escrito se ofrecen todas: la lupa no esconde el catálogo. */
  it('sin búsqueda ofrece el catálogo entero', () => {
    montarPintadoYCargado();

    const todas = interno<() => readonly { label: string }[]>('ocupacionesFiltradas')();
    expect(todas.map((o) => o.label)).toEqual(['Docente', 'Albañil']);
  });

  /**
   * El uuid es el dato y la etiqueta es presentación. Mandar «Docente» dejaría
   * la ocupación fuera de todo lo que se puede agrupar o buscar por concepto.
   */
  it('elegir una ocupación manda su concepto, nunca su etiqueta', () => {
    montarYCargar();

    señal<string | null>('ocupacionConceptId').set('oc-albanil');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ occupationConceptId: 'oc-albanil' });
    req.flush({ ...PERFIL_BASE, occupationConceptId: 'oc-albanil' });
  });

  /** Volver a «Sin especificar» es quitarse la ocupación, y el backend la borra con `''`. */
  it('volver a «Sin especificar» vacía la ocupación con la cadena vacía', () => {
    montarYCargar();

    señal<string | null>('ocupacionConceptId').set(null);
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ occupationConceptId: '' });
    req.flush({ ...PERFIL_BASE, occupationConceptId: undefined });
  });

  /**
   * Las altas anteriores al catálogo guardaron texto libre. El desplegable no
   * puede preseleccionarlo —no es un concepto— y dejarlo mudo haría creer que
   * la persona nunca declaró su ocupación, así que la ayuda del campo lo dice.
   */
  it('la ocupación escrita antes del catálogo se dice en la ayuda del campo', () => {
    montarPintadoYCargado({ occupationConceptId: undefined, occupationFreeText: 'Panadera' });

    expect(señal<string | null>('ocupacionConceptId')()).toBeNull();
    expect(notaDelCampo('perfil-ocupacion', '.form-field-hint')).toBe(
      'Registrada como «Panadera». Elegí una opción del catálogo para reemplazarla.',
    );
  });

  /** Y no se manda sola: quien no toca el desplegable conserva su texto libre. */
  it('el texto libre heredado no viaja como cambio si nadie eligió un concepto', () => {
    montarYCargar({ occupationConceptId: undefined, occupationFreeText: 'Panadera' });

    señal<string>('nombre').set('Ana María');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ name: 'Ana María' });
    req.flush({ ...PERFIL_BASE, name: 'Ana María' });
  });

  it('si el catálogo de ocupaciones se cae lo dice, y reintentar vuelve a tocar la red', () => {
    montar();
    http.expectOne('/profiles/patients/me').flush(PERFIL_BASE);
    responderMunicipios();
    caerseElCatalogoDeOcupaciones();
    fixture.detectChanges();

    expect(interno<() => boolean>('catalogoOcupacionesCaido')()).toBe(true);
    const aviso = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="perfil-ocupaciones-caido"]',
    );
    expect(aviso?.textContent).toContain('No pudimos traer el catálogo de ocupaciones.');
    // El resto del formulario no se cayó con él: el campo es opcional.
    expect(señal<string>('nombre')()).toBe('Ana');

    interno<() => void>('reintentarOcupaciones')();
    responderOcupaciones();
    fixture.detectChanges();

    expect(interno<() => boolean>('catalogoOcupacionesCaido')()).toBe(false);
    // Ya no hay `<option>` que contar: la ocupación es una lupa. Lo que importa
    // del reintento es que el catálogo volvió a estar disponible para buscar.
    const recuperadas = interno<() => readonly { label: string }[]>('ocupacionesFiltradas')();
    expect(recuperadas.map((o) => o.label)).toEqual(['Docente', 'Albañil']);
  });

  /* ---- el sexo, con las mismas opciones que el alta ----------------------- */

  /**
   * Dos opciones, las del alta. Ofrecer más acá dejaría corregir los datos con
   * un valor que el alta no admite, y esa diferencia no la explica nada.
   */
  it('el sexo se ofrece con las dos opciones del alta', () => {
    montarPintadoYCargado();

    expect(opcionesDe('perfil-genero')).toEqual(['Elegí una opción', 'Masculino', 'Femenino']);
  });

  /** Un valor heredado que ya no está en la lista se conserva: no se manda nada. */
  it('un sexo heredado fuera de la lista no se pisa al guardar otra cosa', () => {
    montarYCargar({ sexAtBirth: 'INTERSEX' });

    señal<string>('nombre').set('Ana María');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ name: 'Ana María' });
    req.flush({ ...PERFIL_BASE, name: 'Ana María', sexAtBirth: 'INTERSEX' });
  });

  /**
   * Ahora es obligatorio: sin ninguno de los dos valores vigentes elegido,
   * `guardar()` no manda nada — mismo criterio que el nombre y el apellido.
   */
  it('sin sexo elegido, no se guarda', () => {
    montarYCargar({ sexAtBirth: undefined });

    señal<string>('nombre').set('Ana María');
    interno<() => void>('guardar')();

    expect(interno<() => boolean>('puedeGuardar')()).toBe(false);
    http.expectNone('/profiles/patients/me');
  });

  /* ---- el departamento que emitió el documento (ID-22) -------------------- */

  it('el departamento emisor se corrige y viaja sólo si cambió; el número nunca', () => {
    montarYCargar({ nationalId: '5414404', issuerAdministrativeAreaConceptId: 'dep-scz' });

    señal<string | null>('departamentoEmisor').set('dep-lpz');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ issuerAdministrativeAreaConceptId: 'dep-lpz' });
    expect(Object.keys(req.request.body as Record<string, unknown>)).not.toContain('nationalId');
    req.flush({ ...PERFIL_BASE, issuerAdministrativeAreaConceptId: 'dep-lpz' });
  });

  it('sin tocar el departamento emisor, no viaja', () => {
    montarYCargar({ issuerAdministrativeAreaConceptId: 'dep-scz' });

    señal<string>('nombre').set('Ana María');
    interno<() => void>('guardar')();

    const req = pedidoDeGuardado();
    expect(req.request.body).toEqual({ name: 'Ana María' });
    req.flush({ ...PERFIL_BASE, name: 'Ana María' });
  });
});
