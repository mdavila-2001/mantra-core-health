import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

import { MAX_CAMPOS_POR_PAGINA } from '../../../shared/forms/paginated/paginated-form.types';
import {
  MODALIDADES,
  RegisterImagingCenter,
  TIPOS_DE_SOCIEDAD,
} from './register-imaging-center';

/* ============================================================================
    Lo que esta pantalla promete, y por lo tanto lo que se prueba:

    1. Que pregunta los dieciocho puntos del módulo de análisis médicos y
       ninguno inventado — con los dos agregados declarados y probados COMO
       agregados: los estudios (que frenan) y la radioprotección (que no).
    2. Que frena lo que sin ello no hay centro publicable, y NO frena el resto
       — sobre todo los cargos, que el propietario pidió opcionales.
    3. Que es la maqueta: no sale una sola petición a la red.
    ========================================================================== */

/** Un archivo, con lo único que el componente le mira. */
function archivo(nombre: string, tipo: string, bytes: number): File {
  return { name: nombre, type: tipo, size: bytes } as unknown as File;
}

/** El evento de un `<input type="file">` al que se le eligió un archivo. */
function eventoDeArchivo(elegido: File | null): { evento: Event; entrada: { value: string } } {
  const entrada = { files: elegido === null ? [] : [elegido], value: 'C:\\fakepath\\algo.pdf' };
  return { evento: { target: entrada } as unknown as Event, entrada };
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
    // La afirmación central de la maqueta: NINGUNA petición salió. Está en el
    // `afterEach` a propósito, así vale para todas las pruebas de este archivo
    // y no sólo para la que se acuerde de escribirla.
    http.verify();
  });

  /** Deja el formulario en el mínimo con el que se puede enviar. */
  function completarLoObligatorio(): void {
    component.form.patchValue({
      legalName: 'Centro de Imagenología del Oriente S.R.L.',
      companyType: 'SRL',
      taxId: '1023456789',
      modalidades: ['Rayos X', 'Ecografía'],
      addressLines: 'Av. Cañoto esq. Ballivián 234',
      legalRepName: 'Ana Paz Rojas',
      legalRepEmail: 'ana.paz@imagenoriente.test',
      password: 'secreto12',
    });
    component.form.controls.seprecFile.setValue({ archivo: 'seprec.pdf', pesoBytes: 1000 });
    component.form.controls.licenciaFile.setValue({ archivo: 'licencia.pdf', pesoBytes: 1000 });
    component.form.controls.sedesFile.setValue({ archivo: 'sedes.pdf', pesoBytes: 1000 });
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
    // «Otro» con texto libre: la lista tiene seis y hay más estudios que seis.
    expect(campo?.otro).toBe(true);
  });

  it('pregunta los seis papeles del proceso más la radioprotección, y ninguno más', () => {
    const papeles = Object.keys(component.form.controls).filter((clave) => clave.endsWith('File'));

    expect(papeles.sort()).toEqual([
      'constitucionFile',
      'licenciaFile',
      'nitFile',
      'poderFile',
      'radioproteccionFile',
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

  it.each(['constitucionFile', 'nitFile', 'poderFile'] as const)(
    '%s no frena: una unipersonal no tiene constitución ni poder',
    (clave) => {
      completarLoObligatorio();
      component.form.controls[clave].setValue(null);

      component.submit();

      expect(component.enviada()).toBe(true);
    },
  );

  it('la radioprotección no frena: un centro de ecografía y resonancia no irradia', () => {
    // Y además es un agregado: no sale de los dieciocho puntos de la fuente, y
    // un agregado no puede frenar un alta hasta que el propietario lo decida.
    completarLoObligatorio();
    component.form.controls.modalidades.setValue(['Ecografía', 'Resonancia magnética']);
    component.form.controls.radioproteccionFile.setValue(null);

    component.submit();

    expect(component.enviada()).toBe(true);
  });

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
    const { evento } = eventoDeArchivo(PDF());

    component.adjuntar('radioproteccionFile', evento);

    expect(component.adjuntoDe('radioproteccionFile')).toEqual({
      archivo: 'sedes.pdf',
      pesoBytes: 120_000,
    });
    expect(component.errorAdjunto()).toBeNull();
  });

  it('rechaza lo que no es PDF, JPG o PNG', () => {
    const { evento } = eventoDeArchivo(archivo('planilla.xlsx', 'application/vnd.ms-excel', 1000));

    component.adjuntar('sedesFile', evento);

    expect(component.adjuntoDe('sedesFile')).toBeNull();
    expect(component.errorAdjunto()).toContain('PDF');
  });

  it('rechaza un archivo de más de 5 MB', () => {
    const { evento } = eventoDeArchivo(archivo('sedes.pdf', 'application/pdf', 6 * 1024 * 1024));

    component.adjuntar('sedesFile', evento);

    expect(component.adjuntoDe('sedesFile')).toBeNull();
    expect(component.errorAdjunto()).toContain('5 MB');
  });

  it('vacía el input después de elegir, para que el mismo archivo se pueda volver a elegir', () => {
    // Sin esto, quien corrige un rechazo con el mismo papel no ve pasar nada:
    // el `change` no se dispara dos veces con el mismo valor.
    const { evento, entrada } = eventoDeArchivo(PDF());

    component.adjuntar('sedesFile', evento);

    expect(entrada.value).toBe('');
  });

  it('quitar un adjunto lo saca y borra el error anterior', () => {
    component.adjuntar('sedesFile', eventoDeArchivo(archivo('x.txt', 'text/plain', 10)).evento);
    component.adjuntar('sedesFile', eventoDeArchivo(PDF()).evento);

    component.quitarAdjunto('sedesFile');

    expect(component.adjuntoDe('sedesFile')).toBeNull();
    expect(component.errorAdjunto()).toBeNull();
  });

  it('dice el peso en la unidad que se lee de un vistazo', () => {
    expect(component.pesoLegible(2 * 1024 * 1024)).toBe('2.0 MB');
    expect(component.pesoLegible(120_000)).toBe('117 kB');
    expect(component.pesoLegible(null)).toBe('');
  });

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

    const exito = fixture.debugElement.query(By.css('[data-testid="registro-imagen-exito"]'));
    expect(exito).not.toBeNull();
    // El texto no puede prometer una cuenta: todavía no hay backend que la cree.
    expect((exito.nativeElement as HTMLElement).textContent).toContain('solicitud');
  });

  it('mientras no se envía, el formulario está a la vista', () => {
    const form = fixture.debugElement.query(By.css('[data-testid="registro-form-imagenologia"]'));

    expect(form).not.toBeNull();
  });
});
