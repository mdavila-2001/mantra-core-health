import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { MAX_CAMPOS_POR_PAGINA } from '../../../shared/forms/paginated/paginated-form.types';
import { UbicacionPicker } from '../registro-compartido/ubicacion-picker/ubicacion-picker';
import { RegisterLaboratory, TIPOS_DE_SOCIEDAD } from './register-laboratory';

/* ============================================================================
    Lo que esta pantalla promete, y por lo tanto lo que se prueba:

    1. Que pregunta los dieciocho puntos del proceso 4.1 y ninguno inventado.
    2. Que frena lo que sin ello no hay laboratorio publicable, y NO frena el
       resto — sobre todo los cargos, que el propietario pidió opcionales.
    3. Que es la maqueta: no sale una sola petición a la red.

    Los tres son afirmaciones que se rompen solas si alguien cambia una regla
    sin darse cuenta, que es para lo que sirve una prueba.
    ========================================================================== */

/** Un archivo, con lo único que el componente le mira. */
function archivo(nombre: string, tipo: string, bytes: number): File {
  return { name: nombre, type: tipo, size: bytes } as unknown as File;
}

const PDF = () => archivo('sedes.pdf', 'application/pdf', 120_000);

describe('RegisterLaboratory', () => {
  let fixture: ComponentFixture<RegisterLaboratory>;
  let component: RegisterLaboratory;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterLaboratory],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Router real: la plantilla tiene `routerLink` y necesita su contexto.
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterLaboratory);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    // La afirmación central de la maqueta: NINGUNA petición salió. Está en el
    // `afterEach` a propósito, así vale para todas las pruebas de este archivo
    // y no sólo para la que se acuerde de escribirla.
    http.verify();
  });

  /** Deja el formulario en el mínimo con el que se puede enviar. */
  function completarLoObligatorio(): void {
    component.form.patchValue({
      legalName: 'Laboratorio Clínico del Sur S.R.L.',
      companyType: 'SRL',
      taxId: '1023456789',
      addressLines: 'Av. Cañoto esq. Ballivián 234',
      legalRepName: 'Ana Paz Rojas',
      legalRepEmail: 'ana.paz@labsur.test',
      password: 'secreto12',
    });
    component.form.controls.seprecFile.setValue({ archivo: 'seprec.pdf', pesoBytes: 1000 });
    component.form.controls.licenciaFile.setValue({ archivo: 'licencia.pdf', pesoBytes: 1000 });
    component.form.controls.sedesFile.setValue({ archivo: 'sedes.pdf', pesoBytes: 1000 });
  }

  /* --- lo que pregunta --------------------------------------------------- */

  it('ofrece los ocho tipos de sociedad del proceso, para elegir y no para escribir', () => {
    // 4.1.1.1 los enumera y dice para qué: poder contar cuántos proveedores hay
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

  it('pregunta los seis papeles del proceso, ni uno más', () => {
    const papeles = Object.keys(component.form.controls).filter((clave) =>
      clave.endsWith('File'),
    );

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

    expect(component.form.valid).toBe(true);
    expect(component.enviada()).toBe(true);
  });

  it.each(['seprecFile', 'licenciaFile', 'sedesFile'] as const)(
    'sin %s no hay laboratorio publicable: frena el alta',
    (clave) => {
      completarLoObligatorio();
      component.form.controls[clave].setValue(null);

      component.submit();

      expect(component.enviada()).toBe(false);
    },
  );

  it.each(['constitucionFile', 'nitFile', 'poderFile'] as const)(
    '%s no frena: una unipersonal no tiene constitución ni poder',
    (clave) => {
      completarLoObligatorio();
      component.form.controls[clave].setValue(null);

      component.submit();

      expect(component.enviada()).toBe(true);
    },
  );

  it('los datos de los tres cargos son opcionales', () => {
    completarLoObligatorio();

    component.submit();

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

  it('al enviarse muestra que quedó una solicitud, no una cuenta creada', async () => {
    completarLoObligatorio();

    component.submit();
    await fixture.whenStable();

    const exito = fixture.debugElement.query(By.css('[data-testid="registro-lab-exito"]'));
    expect(exito).not.toBeNull();
    // El texto no puede prometer una cuenta: todavía no hay backend que la cree.
    expect((exito.nativeElement as HTMLElement).textContent).toContain('solicitud');
  });

  it('mientras no se envía, el formulario está a la vista', () => {
    const form = fixture.debugElement.query(
      By.css('[data-testid="registro-form-laboratorio"]'),
    );

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
        '[data-testid="registro-lab-direccion"]',
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
        fixture.nativeElement.querySelector('[data-testid="registro-lab-direccion-reescribir"]'),
      ).not.toBeNull();
    });

    it('tocarla después sí la marca, y el aviso sigue a su lado', () => {
      const campo = direccionEscritaYDejada();
      tocarElMapa();

      campo.dispatchEvent(new FocusEvent('blur'));
      fixture.detectChanges();

      expect(errorDe(campo)).toBe('Escribí la dirección legal de la central.');
      expect(
        fixture.nativeElement.querySelector('[data-testid="registro-lab-direccion-reescribir"]'),
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
