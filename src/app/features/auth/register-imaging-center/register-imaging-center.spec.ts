import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { MAX_CAMPOS_POR_PAGINA } from '../../../shared/forms/paginated/paginated-form.types';
import { UbicacionPicker } from '../registro-compartido/ubicacion-picker/ubicacion-picker';
import { CODIGOS_DE_DIAGNOSTICO } from '../registro-compartido/alta-de-centro-diagnostico';
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
      legalRepName: 'Ana Paz Rojas',
      legalRepEmail: 'ana.paz@imagenoriente.test',
      legalRepIdNumber: '4872190',
      password: 'secreto12',
    });
    component.updateAttachment('nitFile', [archivo('nit.pdf', 'application/pdf', 10)]);
    component.updateAttachment('seprecFile', [archivo('seprec.pdf', 'application/pdf', 10)]);
    component.updateAttachment('licenciaFile', [archivo('licencia.pdf', 'application/pdf', 10)]);
    component.updateAttachment('sedesFile', [archivo('sedes.pdf', 'application/pdf', 10)]);
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
      countryConceptId: idDeConcepto(CODIGOS_DE_DIAGNOSTICO.pais),
      diagnosticUnit: {
        diagnosticUnitTypeConceptId: idDeConcepto(CODIGOS_DE_DIAGNOSTICO.imagenes),
        modalityConceptIds: [
          idDeConcepto(CODIGOS_DE_DIAGNOSTICO.modalidades.tomografia),
          idDeConcepto(CODIGOS_DE_DIAGNOSTICO.modalidades.resonancia),
        ],
      },
    });
    expect(cuerpo.organization.payer).toBeUndefined();
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
        CODIGOS_DE_DIAGNOSTICO.modalidades[clave as keyof typeof CODIGOS_DE_DIAGNOSTICO.modalidades],
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
    responderCatalogos(http, [CODIGOS_DE_DIAGNOSTICO.modalidades.resonancia]);

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
    expect(component.form.controls.generalManagerName.value).toBe('');
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
    component.escribirDireccionDeSucursal(primera!.id, 'Av. San Martín 456');
    component.fijarGpsDeSucursal(primera!.id, { lat: -17.78, lng: -63.18 });
    component.quitarSucursal(segunda!.id);

    expect(component.sucursales()).toEqual([
      {
        id: primera!.id,
        nombre: 'Equipetrol',
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

  /* --- el mapa vacía la dirección de la central (D-06) ------------------- */

  describe('el mapa vacía la dirección de la central', () => {
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

    /** La dirección escrita y dejada: tocada, como la deja quien la escribió. */
    function direccionEscritaYDejada(): HTMLInputElement {
      fixture.detectChanges();
      completarLoObligatorio();
      fixture.detectChanges();
      avanzarHasta('Dónde está la central');
      const campo: HTMLInputElement = fixture.nativeElement.querySelector(
        '[data-testid="registro-imagen-direccion"]',
      );
      campo.dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();
      return campo;
    }

    function tocarElMapa(): void {
      const mapa = fixture.debugElement.query(By.directive(UbicacionPicker));
      (mapa.componentInstance as UbicacionPicker).puntoElegido.emit({ lat: -17.7833, lng: -63.1821 });
      fixture.detectChanges();
    }

    function errorDe(campo: HTMLElement): string {
      return campo.closest('app-form-field')?.querySelector('.form-field-error')?.textContent?.trim() ?? '';
    }

    it('la deja vacía sin marcarla en rojo, aunque la persona ya la hubiera tocado', () => {
      const campo = direccionEscritaYDejada();
      expect(component.form.controls.addressLines.touched).toBe(true);

      tocarElMapa();

      expect(campo.value).toBe('');
      expect(errorDe(campo)).toBe('');
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-imagen-direccion-reescribir"]'),
      ).not.toBeNull();
    });

    it('tocarla después sí la marca, y el aviso sigue a su lado', () => {
      const campo = direccionEscritaYDejada();
      tocarElMapa();

      campo.dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();

      expect(errorDe(campo)).toBe('Escribí la dirección legal de la central.');
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-imagen-direccion-reescribir"]'),
      ).not.toBeNull();
    });

    it('intentar avanzar sin reescribirla la marca y no deja pasar', () => {
      const campo = direccionEscritaYDejada();
      tocarElMapa();

      fixture.nativeElement.querySelector('[data-testid="paginated-form-continuar"]').click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.paginated-form__titulo').textContent).toContain(
        'Dónde está la central',
      );
      expect(errorDe(campo)).toBe('Escribí la dirección legal de la central.');
    });
  });
});
