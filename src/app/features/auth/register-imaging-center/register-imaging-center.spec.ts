import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { MAX_CAMPOS_POR_PAGINA } from '../../../shared/forms/paginated/paginated-form.types';
import { NEVER, of } from 'rxjs';

import { ReverseGeocodingClient } from '../../../core/data-access/geo/reverse-geocoding.client';
import { BoMunicipalitiesCatalog } from '../../../core/data-access/terminology/bo-municipalities.service';
import {
  MapLocationPicker,
  type LocalityFromPoint,
} from '../shared-registration/map-location-picker/map-location-picker';
import { DIAGNOSIS_CODES } from '../shared-registration/diagnostic-center-enrollment';
import {
  altaPendiente,
  atenderSubida,
  idDeConcepto,
  responderCatalogos,
} from '../../../../testing/alta-de-centro-diagnostico';
import {
  MODALIDADES,
  RegisterImagingCenter,
  TIPOS_DE_SOCIEDAD,
} from './register-imaging-center';

/* ============================================================================
    Lo que esta pantalla promete, y por lo tanto lo que se prueba:

    1. Que pregunta los dieciocho puntos del módulo de análisis médicos y
       ninguno inventado — con el agregado de los estudios (que frena). La
       radioprotección salió del alta: la API no tiene dónde guardarla.
    2. Que frena lo que sin ello no hay centro publicable, y NO frena el resto
       — sobre todo los cargos, que el propietario pidió opcionales.
    3. Que el envío es real: lee el catálogo, sube los PDF en serie y llama a
       `register-organization` con `tenantType: 'DIAGNOSTIC_CENTER'`, con las
       modalidades como conceptos.
    ========================================================================== */

/** Un archivo de verdad: la subida lo mete en un `FormData`, que no acepta un doble. */
function archivo(nombre: string, tipo: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}


const PDF = () => archivo('sedes.pdf', 'application/pdf', 120_000);

/** El punto confirmado de la central en las pruebas. */
const PUNTO_CENTRAL = { lat: -17.7833, lng: -63.1821 };

/** Lo que `app-map-location-picker` emite por `localidad`. */
function localidad(calle: string | null, zona: string | null = null): LocalityFromPoint {
  return { punto: PUNTO_CENTRAL, calle, calleSola: calle, zona, municipioConceptId: null };
}

describe('RegisterImagingCenter', () => {
  let fixture: ComponentFixture<RegisterImagingCenter>;
  let component: RegisterImagingCenter;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterImagingCenter],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Router real: la plantilla tiene `routerLink` y necesita su contexto.
        provideRouter([]),
        // El selector de ubicación pide la calle y el catálogo de municipios;
        // acá no responden: lo deducido se emite a mano por `localidad`.
        { provide: ReverseGeocodingClient, useValue: { streetAt: () => NEVER } },
        { provide: BoMunicipalitiesCatalog, useValue: { listar: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterImagingCenter);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    // Ninguna petición queda sin atender: está en el `afterEach` a propósito, así
    // vale para todas las pruebas de este archivo.
    http.verify();
  });

  /** Deja el formulario en el mínimo con el que se puede enviar. */
  function completarLoObligatorio(tipo = 'UNIPERSONAL'): void {
    component.form.patchValue({
      legalName: 'Centro de Imagenología del Oriente S.R.L.',
      companyType: tipo,
      taxId: '1023456789',
      modalidades: ['Tomografía computarizada', 'Resonancia magnética'],
      addressLines: 'Av. Cañoto esq. Ballivián 234',
      legalRepName: { name: 'Ana', lastName: 'Paz', motherLastName: 'Rojas' },
      legalRepEmail: 'ana.paz@imagenoriente.test',
      legalRepIdNumber: '4872190',
      password: 'secreto12',
    });
    component.updateAttachment('nitFile', [archivo('nit.pdf', 'application/pdf', 10)]);
    component.updateAttachment('seprecFile', [archivo('seprec.pdf', 'application/pdf', 10)]);
    component.updateAttachment('licenciaFile', [archivo('licencia.pdf', 'application/pdf', 10)]);
    component.updateAttachment('sedesFile', [archivo('sedes.pdf', 'application/pdf', 10)]);
    // El punto de la central es obligatorio (pedido del cliente del 26/10/2026).
    component.fijarGpsCentral(PUNTO_CENTRAL);
  }

  /** Atiende el envío completo: catálogo, una subida por papel y el alta. */
  function atenderElEnvio(papeles: number, respuesta: object = { tenantId: 't', code: 'c' }) {
    responderCatalogos(http);
    for (let i = 0; i < papeles; i += 1) {
      atenderSubida(http);
    }
    const alta = altaPendiente(http);
    alta.flush({
      ownerUserId: 'u',
      status: 's',
      emailVerificationSent: true,
      diagnosticUnitId: 'du',
      ...respuesta,
    });
    return { cuerpo: alta.request.body };
  }

  /* --- lo que pregunta --------------------------------------------------- */

  it('ofrece los ocho tipos de sociedad del proceso, para elegir y no para escribir', () => {
    // 1.1.1 los enumera y dice para qué: poder contar cuántos proveedores hay
    // de cada tipo. Con un campo de texto libre ese conteo no existe.
    expect(TIPOS_DE_SOCIEDAD.map((t) => t.value)).toEqual([
      'UNIPERSONAL',
      'SRL',
      'LTDA',
      'SA',
      'SOCIEDAD_COLECTIVA',
      'COMANDITA_SIMPLE',
      'COMANDITA_ACCIONES',
      'SUCURSAL_EXTRANJERA',
    ]);
  });

  it('ofrece las modalidades que el módulo nombra, empezando por rayos X y resonancia', () => {
    // El módulo se llama «RAYOS X, RESONANCIA, ETC.»: si alguna de esas dos se
    // cayera de la lista, el alta dejaría de servir para lo que se pidió.
    const valores = MODALIDADES.map((m) => m.value);

    expect(valores).toContain('Rayos X');
    expect(valores).toContain('Resonancia magnética');
    expect(valores).toContain('Ecografía');
  });

  it('los estudios se marcan de a varios: un centro hace más de uno', () => {
    const campo = component.paginas
      .flatMap((pagina) => pagina.campos)
      .find((c) => c.key === 'modalidades');

    expect(campo?.control).toBe('checkboxes');
    // Sin «Otro» con texto libre: una modalidad fuera de la lista no tiene
    // concepto en la API (responde 422), así que el alta no la ofrece.
    expect(campo?.otro).toBeUndefined();
  });

  it('pregunta los seis papeles del alta y ninguno más: la radioprotección salió', () => {
    // La API no tiene dónde guardarla (`legalDocuments` no la declara): ofrecer
    // un papel que se tira es peor que no pedirlo. Se pide desde el panel.
    const papeles = Object.keys(component.form.controls).filter((clave) => clave.endsWith('File'));

    expect(papeles.sort()).toEqual([
      'constitucionFile',
      'licenciaFile',
      'nitFile',
      'poderFile',
      'sedesFile',
      'seprecFile',
    ]);
  });

  it('ninguna página supera el tope de campos del motor', () => {
    // La invariante del formulario por partes. Se comprueba acá además de en el
    // motor porque una página de cinco campos no rompe nada: sólo se ve como
    // una pared, que es lo que hace abandonar un alta a la mitad.
    for (const pagina of component.paginas) {
      expect(pagina.campos.length).toBeLessThanOrEqual(MAX_CAMPOS_POR_PAGINA);
    }
  });

  /* --- qué frena y qué no ------------------------------------------------ */

  it('no se envía vacío', () => {
    component.submit();

    expect(component.enviada()).toBe(false);
  });

  it('se envía con lo obligatorio y nada más', () => {
    completarLoObligatorio();

    component.submit();
    atenderElEnvio(4);

    expect(component.form.valid).toBe(true);
    expect(component.enviada()).toBe(true);
  });

  /* --- el envío real ----------------------------------------------------- */

  it('manda DIAGNOSTIC_CENTER de imágenes, con las modalidades como conceptos y sin `payer`', () => {
    completarLoObligatorio();

    component.submit();
    const { cuerpo } = atenderElEnvio(4);

    expect(cuerpo.organization).toMatchObject({
      tenantType: 'DIAGNOSTIC_CENTER',
      legalEntityType: 'UNIPERSONAL',
      countryConceptId: idDeConcepto(DIAGNOSIS_CODES.pais),
      diagnosticUnit: {
        diagnosticUnitTypeConceptId: idDeConcepto(DIAGNOSIS_CODES.imagenes),
        modalityConceptIds: [
          idDeConcepto(DIAGNOSIS_CODES.modalidades.tomografia),
          idDeConcepto(DIAGNOSIS_CODES.modalidades.resonancia),
        ],
      },
    });
    expect(cuerpo.organization.payer).toBeUndefined();
    // La central viaja con su dirección y su punto, que es obligatorio.
    expect(cuerpo.organization.diagnosticUnit.primarySite.address).toEqual({
      lines: ['Av. Cañoto esq. Ballivián 234'],
      latitude: -17.7833,
      longitude: -63.1821,
    });
  });

  it('sin el punto de la central no sale', () => {
    completarLoObligatorio();
    component.fijarGpsCentral(null);

    component.submit();

    // `http.verify()` del `afterEach` prueba que no salió nada.
    expect(component.enviada()).toBe(false);
    expect(component.form.controls.gpsCentral.invalid).toBe(true);
  });

  it.each(Object.entries({
    'Rayos X': 'rayosX',
    Ecografía: 'ecografia',
    'Tomografía computarizada': 'tomografia',
    'Resonancia magnética': 'resonancia',
    Mamografía: 'mamografia',
    'Densitometría ósea': 'densitometria',
  }))('la modalidad «%s» viaja como su concepto', (etiqueta, clave) => {
    completarLoObligatorio();
    component.form.controls.modalidades.setValue([etiqueta]);

    component.submit();
    const { cuerpo } = atenderElEnvio(4);

    expect(cuerpo.organization.diagnosticUnit.modalityConceptIds).toEqual([
      idDeConcepto(
        DIAGNOSIS_CODES.modalidades[clave as keyof typeof DIAGNOSIS_CODES.modalidades],
      ),
    ]);
  });

  it('cada modalidad de la lista tiene su concepto en el catálogo', () => {
    // Si una etiqueta nueva entra en la lista sin código, el envío diría
    // «catálogo incompleto» en producción: acá falla antes.
    expect(MODALIDADES.map((m) => m.value)).toEqual([
      'Rayos X',
      'Ecografía',
      'Tomografía computarizada',
      'Resonancia magnética',
      'Mamografía',
      'Densitometría ósea',
    ]);
  });

  it('una SRL sin constitución ni poder no sale', () => {
    completarLoObligatorio('SRL');

    component.submit();

    expect(component.form.controls.constitucionFile.invalid).toBe(true);
    expect(component.enviada()).toBe(false);
  });

  it('si el catálogo no trae una modalidad, no sube ni manda nada', () => {
    completarLoObligatorio();

    component.submit();
    responderCatalogos(http, [DIAGNOSIS_CODES.modalidades.resonancia]);

    http.expectNone((p) => p.url.endsWith('/iam/auth/upload-registration-document'));
    http.expectNone((p) => p.url.endsWith('/iam/auth/register-organization'));
    expect(component.enviada()).toBe(false);
    expect(component.mensajeDeError()).toContain('No pudimos cargar los catálogos');
  });

  it('una subida sin confirmar frena el alta y dice por qué', () => {
    completarLoObligatorio();

    component.submit();
    responderCatalogos(http);
    atenderSubida(http, true);

    http.expectNone((p) => p.url.endsWith('/iam/auth/register-organization'));
    expect(component.enviada()).toBe(false);
    expect(component.mensajeDeError()).toContain('No pudimos confirmar la carga del PDF');
  });

  it('sin ningún estudio marcado no hay centro que ofrecer: frena el alta', () => {
    // Es lo único que distingue este alta de la del laboratorio de sangre. Sin
    // esto el centro no puede aparecer en ninguna orden, que es todo lo que el
    // módulo hace.
    completarLoObligatorio();
    component.form.controls.modalidades.setValue([]);

    component.submit();

    expect(component.enviada()).toBe(false);
  });

  it.each(['seprecFile', 'licenciaFile', 'sedesFile'] as const)(
    'sin %s no hay centro publicable: frena el alta',
    (clave) => {
      completarLoObligatorio();
      component.form.controls[clave].setValue(null);

      component.submit();

      expect(component.enviada()).toBe(false);
    },
  );

  it.each(['constitucionFile', 'poderFile'] as const)(
    '%s no frena: una unipersonal no tiene constitución ni poder',
    (clave) => {
      completarLoObligatorio();
      component.form.controls[clave].setValue(null);

      component.submit();
      atenderElEnvio(4);

      expect(component.enviada()).toBe(true);
    },
  );

  it('el poder se pide en la página del representante, no con la constitución', () => {
    const pagina = (clave: string) => component.paginas.find((p) => p.clave === clave);

    // El documento de identidad lo exige la API (`legalRepresentative.idNumber`).
    expect(pagina('representante')?.campos.map((c) => c.key)).toEqual([
      'legalRepName',
      'legalRepIdNumber',
      'legalRepEmail',
      'poderFile',
    ]);
    expect(pagina('radioproteccion')?.campos.map((c) => c.key)).not.toContain('poderFile');
  });

  it('el NIT en PDF frena el alta: viaja junto con los otros papeles', () => {
    completarLoObligatorio();
    component.updateAttachment('nitFile', []);

    component.submit();

    expect(component.enviada()).toBe(false);
  });

  it('el documento del representante es obligatorio: la API lo exige', () => {
    completarLoObligatorio();
    component.form.controls.legalRepIdNumber.setValue('');

    component.submit();

    expect(component.enviada()).toBe(false);
  });

  it('los datos de los tres cargos son opcionales', () => {
    completarLoObligatorio();

    component.submit();
    atenderElEnvio(4);

    // Ninguno de los nueve campos de gerencia se tocó, y el alta sale igual.
    expect(component.form.controls.generalManagerName.value.name).toBe('');
    expect(component.form.controls.salesManagerEmail.value).toBe('');
    expect(component.form.controls.marketingManagerPhone.value).toBe('');
    expect(component.enviada()).toBe(true);
  });

  it('opcional no es «cualquier cosa»: un correo de gerente mal escrito frena', () => {
    completarLoObligatorio();
    component.form.controls.salesManagerEmail.setValue('esto-no-es-un-correo');

    component.submit();

    expect(component.enviada()).toBe(false);
  });

  it('el NIT sólo acepta números', () => {
    completarLoObligatorio();
    component.form.controls.taxId.setValue('NIT-ABC');

    component.submit();

    expect(component.enviada()).toBe(false);
  });

  /* --- los adjuntos ------------------------------------------------------ */

  it('guarda el archivo elegido con su nombre y su peso', () => {
    component.updateAttachment('sedesFile', [PDF()]);

    expect(component.adjuntoDe('sedesFile')).toEqual({
      archivo: 'sedes.pdf',
      pesoBytes: 120_000,
    });
    expect(component.errorAdjunto()).toBeNull();
  });

  it('quitar un adjunto lo saca', () => {
    component.updateAttachment('sedesFile', [PDF()]);

    component.updateAttachment('sedesFile', []);

    expect(component.adjuntoDe('sedesFile')).toBeNull();
    expect(component.errorAdjunto()).toBeNull();
  });

  // El rechazo por formato y por peso, el vaciado del `<input>` y el peso
  // legible se probaban acá sobre métodos que ninguna plantilla llamaba desde
  // que los adjuntos pasaron a `app-file-input`. Esas pruebas se retiraron con
  // ese código: quien rechaza y quien formatea el peso es la molécula, y lo
  // prueba su propio spec.

  /* --- sucursales -------------------------------------------------------- */

  it('las sucursales se agregan, se editan y se quitan', () => {
    component.agregarSucursal();
    component.agregarSucursal();
    const [primera, segunda] = component.sucursales();

    component.escribirNombreDeSucursal(primera!.id, 'Equipetrol');
    // La dirección no se escribe: sale de lo deducido del punto.
    component.escribirLocalidadDeSucursal(primera!.id, localidad('Av. San Martín 456'));
    component.fijarGpsDeSucursal(primera!.id, { lat: -17.78, lng: -63.18 });
    component.quitarSucursal(segunda!.id);

    expect(component.sucursales()).toEqual([
      {
        id: primera!.id,
        nombre: 'Equipetrol',
        descripcion: '',
        urlUbicacion: '',
        direccion: 'Av. San Martín 456',
        gps: { lat: -17.78, lng: -63.18 },
      },
    ]);
  });

  it('cada sucursal lleva su propio pin: confirmar una no confirma otra', () => {
    component.agregarSucursal();
    component.agregarSucursal();
    const [primera, segunda] = component.sucursales();

    expect(component.idsDeSucursal(primera!.id).mapa).not.toBe(
      component.idsDeSucursal(segunda!.id).mapa,
    );
  });

  it('quitar una sucursal no renumera las demás por dentro', () => {
    // El identificador es la atadura entre la fila y su pin en el mapa: si se
    // reasignara al borrar, el punto confirmado de una sucursal aparecería en
    // otra.
    component.agregarSucursal();
    component.agregarSucursal();
    const [primera, segunda] = component.sucursales();
    component.quitarSucursal(primera!.id);
    component.agregarSucursal();

    const ids = component.sucursales().map((s) => s.id);
    expect(ids[0]).toBe(segunda!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /* --- la pantalla ------------------------------------------------------- */

  it('al enviarse muestra que quedó una solicitud pendiente de aprobación', async () => {
    completarLoObligatorio();

    component.submit();
    atenderElEnvio(4);
    await fixture.whenStable();
    fixture.detectChanges();

    const exito = fixture.debugElement.query(By.css('[data-testid="registro-imagen-exito"]'));
    expect(exito).not.toBeNull();
    // Dice «solicitud» porque la cuenta queda pendiente de verificación: ya existe
    // pero el centro no se publica hasta aprobarla.
    expect((exito.nativeElement as HTMLElement).textContent).toContain('solicitud');
  });

  it('mientras no se envía, el formulario está a la vista', () => {
    const form = fixture.debugElement.query(By.css('[data-testid="registro-form-imagenologia"]'));

    expect(form).not.toBeNull();
  });

  /* --- la ubicación de la central: sólo el punto (26/10/2026) ------------ */

  describe('la ubicación de la central sale del punto', () => {
    /** Avanza el asistente hasta la página cuyo título contiene `fragmento`. */
    function avanzarHasta(fragmento: string): void {
      for (let paso = 0; paso < 12; paso += 1) {
        const titulo =
          fixture.nativeElement.querySelector('.paginated-form__titulo')?.textContent ?? '';
        if (titulo.includes(fragmento)) return;
        fixture.nativeElement.querySelector('[data-testid="paginated-form-continuar"]')?.click();
        fixture.detectChanges();
      }
      throw new Error(`No se alcanzó una página con título que contenga «${fragmento}»`);
    }

    function irALaUbicacion(): void {
      fixture.detectChanges();
      completarLoObligatorio();
      component.fijarGpsCentral(null);
      fixture.detectChanges();
      avanzarHasta('Dónde está la central');
    }

    function selector(): MapLocationPicker {
      return fixture.debugElement.query(By.directive(MapLocationPicker))
        .componentInstance as MapLocationPicker;
    }

    it('el mapa es el primer campo de su página, obligatorio, y la dirección ya no se escribe', () => {
      const pagina = component.paginas.find((p) => p.clave === 'ubicacion')!;
      expect(pagina.campos[0]).toMatchObject({ key: 'gpsCentral', control: 'custom', required: true });
      expect(pagina.campos.map((c) => c.key)).not.toContain('addressLines');

      irALaUbicacion();
      expect(fixture.nativeElement.querySelector('[data-testid="registro-imagen-direccion"]')).toBeNull();
    });

    it('sin el punto confirmado no deja pasar, y lo dice', () => {
      irALaUbicacion();

      fixture.nativeElement.querySelector('[data-testid="paginated-form-continuar"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.paginated-form__titulo').textContent).toContain(
        'Dónde está la central',
      );
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Marque el lugar en el mapa y pulse «Confirmar dirección actual».',
      );
    });

    it('confirmar el punto en el mapa llena el control obligatorio', () => {
      irALaUbicacion();

      selector().confirmado.emit(PUNTO_CENTRAL);

      expect(component.form.controls.gpsCentral.value).toEqual(PUNTO_CENTRAL);
      expect(component.gpsCentral()).toEqual(PUNTO_CENTRAL);
    });

    it('lo deducido del punto escribe la dirección legal; sin calle, la zona o el punto', () => {
      irALaUbicacion();

      selector().localidad.emit(localidad('Calle Guapay 3861, Equipetrol', 'Equipetrol'));
      expect(component.form.controls.addressLines.value).toBe('Calle Guapay 3861, Equipetrol');

      selector().localidad.emit(localidad(null, 'Equipetrol'));
      expect(component.form.controls.addressLines.value).toBe('Equipetrol');

      selector().localidad.emit(localidad(null));
      expect(component.form.controls.addressLines.value).toBe('Punto GPS -17.78330, -63.18210');
    });
  });

  describe('persistencia de borrador (onboarding draft)', () => {
    afterEach(() => {
      localStorage.removeItem('alovida.onboarding.draft.imaging-center');
    });

    it('guarda el avance en localStorage al cambiar de paso', () => {
      component.form.patchValue({
        legalName: 'Centro Radiológico La Paz',
        taxId: '1023456789',
      });
      component.guardarBorrador();
      const raw = localStorage.getItem('alovida.onboarding.draft.imaging-center');
      expect(raw).not.toBeNull();
      const draft = JSON.parse(raw!);
      expect(draft.data.legalName).toBe('Centro Radiológico La Paz');
      expect(draft.data.taxId).toBe('1023456789');
    });

    it('restaura el borrador guardado', () => {
      const mockDraft = {
        id: 'draft-img-1',
        formType: 'imaging-center',
        stepIndex: 1,
        stepKey: 'modalidades',
        stepTitle: 'Estudios que realiza',
        totalSteps: 6,
        data: {
          legalName: 'Resonancia Magnética Los Andes',
          taxId: '987654321',
        },
        extraData: {
          gpsCentral: { lat: -16.5, lng: -68.15 },
        },
        lastSavedAt: new Date().toISOString(),
      };
      localStorage.setItem('alovida.onboarding.draft.imaging-center', JSON.stringify(mockDraft));

      component.restaurarBorrador();

      expect(component.form.controls.legalName.value).toBe('Resonancia Magnética Los Andes');
      expect(component.form.controls.taxId.value).toBe('987654321');
      expect(component.gpsCentral()).toEqual({ lat: -16.5, lng: -68.15 });
      expect(component.form.controls.gpsCentral.value).toEqual({ lat: -16.5, lng: -68.15 });
      expect(component.pasoGuardado()).toBe(1);
    });

    it('limpia el borrador al descartarlo', () => {
      localStorage.setItem('alovida.onboarding.draft.imaging-center', '{"id":"draft-1"}');
      component.descartarBorrador();
      expect(localStorage.getItem('alovida.onboarding.draft.imaging-center')).toBeNull();
    });
  });
});
