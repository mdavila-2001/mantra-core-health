import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { IdentityVerification } from './identity-verification';

/**
 * Es el destino de la puerta del estado **S5**: cuando la API responde
 * `IDENTITY_VERIFICATION_REQUIRED`, `errorToViewState` ofrece «Verificar
 * identidad» y esta pantalla la atiende.
 *
 * Lo que estas pruebas fijan es lo que un refactor rompería en silencio: que la
 * evidencia se sube como **PHI**, y que las dos peticiones van encadenadas.
 */
describe('IdentityVerification', () => {
  let fixture: ComponentFixture<IdentityVerification>;
  let component: IdentityVerification;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentityVerification],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(IdentityVerification);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);

    // Al construirse, la pantalla pide el historial de casos del titular: es lo
    // que responde «¿esto ya lo mandé?» a quien vuelve. Se responde vacío acá
    // para que cada prueba hable del envío, que es lo suyo; la prueba del
    // historial lo responde con datos por su cuenta.
    http.expectOne('/identity/me/verification-cases').flush([]);
  });

  afterEach(() => {
    http.verify();
  });

  /**
   * Los miembros son `protected`: la plantilla los usa, la prueba también.
   *
   * Los métodos se devuelven **ligados** —sin `this`, `logout()` no encuentra
   * `this.auth`— pero las señales **no**: una señal ES una función, y ligarla
   * devuelve una copia sin `.set` ni `.update`. Se distinguen por eso mismo.
   */
  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;

    const esSenal = 'set' in valor || 'update' in valor || 'asReadonly' in valor;
    return (esSenal ? valor : valor.bind(component)) as T;
  }

  function elegirArchivo(nombre = 'documento.pdf') {
    const archivo = new File(['contenido'], nombre, { type: 'application/pdf' });
    interno<{ set: (v: readonly File[]) => void }>('evidencia').set([archivo]);
    return archivo;
  }

  function subir() {
    interno<() => void>('enviar')();
  }

  it('no deja enviar sin archivo', () => {
    expect(interno<() => boolean>('puedeEnviar')()).toBe(false);

    subir();
    // `http.verify()` en `afterEach` comprueba que no salió ninguna petición.
  });

  it('con un archivo elegido, deja enviar', () => {
    elegirArchivo();
    expect(interno<() => boolean>('puedeEnviar')()).toBe(true);
  });

  /**
   * La aserción central. `PHI` cambia cómo se guarda el archivo y quién puede
   * descargarlo: es un documento de identidad, no una imagen cualquiera.
   */
  it('sube la evidencia marcada como PHI, no como NORMAL', () => {
    elegirArchivo();
    subir();

    const peticion = http.expectOne((r) => r.url.endsWith('/common/files/upload'));
    const cuerpo = peticion.request.body as FormData;

    expect(cuerpo.get('sensitivity')).toBe('PHI');
    expect(cuerpo.get('category')).toBe('DOCUMENT');
    // El campo se llama `file`: lo espera así el backend.
    expect(cuerpo.get('file')).toBeInstanceOf(File);

    peticion.flush({ id: 'f-1' });
    http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification')).flush({
      caseId: 'c-1',
      checkId: 'ch-1',
      status: 'PENDING',
    });
  });

  it('el `Content-Type` no se fija a mano: el navegador pone el boundary', () => {
    elegirArchivo();
    subir();

    const peticion = http.expectOne((r) => r.url.endsWith('/common/files/upload'));
    expect(peticion.request.headers.get('Content-Type')).toBeNull();

    peticion.flush({ id: 'f-1' });
    http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification')).flush({
      caseId: 'c-1',
      checkId: 'ch-1',
      status: 'PENDING',
    });
  });

  it('encadena la apertura del caso con el identificador de la subida', () => {
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-42' });

    const caso = http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification'));
    expect(caso.request.body).toEqual({ evidenceFileId: 'f-42' });

    caso.flush({ caseId: 'c-1', checkId: 'ch-1', status: 'PENDING' });

    expect(interno<() => { id: string; status: string } | null>('caso')()).toEqual({
      id: 'c-1',
      status: 'PENDING',
    });
  });

  it('la petición NO lleva a quién se verifica: lo resuelve el backend', () => {
    // Ninguna ruta de `identity` recibe el sujeto, justamente para que nadie
    // pueda pedir la verificación de otro.
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-1' });

    const caso = http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification'));
    expect(Object.keys(caso.request.body as object)).toEqual(['evidenceFileId']);

    caso.flush({ caseId: 'c-1', checkId: 'ch-1', status: 'PENDING' });
  });

  it('un fallo de la subida se traduce a un estado del M34, no a una excepción', () => {
    elegirArchivo();
    subir();

    http
      .expectOne((r) => r.url.endsWith('/common/files/upload'))
      .flush(
        { code: 'PAYLOAD_TOO_LARGE', message: 'Muy grande', timestamp: 't', path: '/p' },
        { status: 413, statusText: 'Payload Too Large' },
      );

    expect(interno<() => { status: string }>('state')().status).toBe('validation');
    expect(interno<() => string | null>('errorMessage')()).toContain('grande');
  });

  it('un fallo de red se traduce a S8', () => {
    elegirArchivo();
    subir();

    http
      .expectOne((r) => r.url.endsWith('/common/files/upload'))
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(interno<() => { status: string }>('state')().status).toBe('offline');
  });

  it('traduce el rechazo del componente a algo accionable', () => {
    interno<(r: readonly { file: File; reason: string }[]) => void>('alRechazar')([
      { file: new File([''], 'enorme.pdf'), reason: 'tamaño' },
    ]);

    expect(interno<() => string | null>('rechazo')()).toContain('10 MB');
  });

  /**
   * El estado no se muestra como UUID: el sello lo traduce a una palabra. El
   * mapeo completo lo fija `case-status.spec.ts`; acá se fija la integración.
   */
  it('con el caso CASE_ASSERTED el sello muestra «Aprobado», no el UUID', () => {
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-1' });
    http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification')).flush({
      caseId: 'c-1',
      checkId: 'ch-1',
      status: 'd41fde09-6752-5bb6-8237-b786fe062ab2', // CASE_ASSERTED
    });

    fixture.detectChanges();

    const sello = (fixture.nativeElement as HTMLElement).querySelector('app-status-seal');
    expect(sello).not.toBeNull();
    expect(sello?.textContent).toContain('Aprobado');
    expect(sello?.textContent).not.toContain('d41fde09');
  });

  it('actualizar el caso vuelve a consultarlo', () => {
    elegirArchivo();
    subir();
    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-1' });
    http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification')).flush({
      caseId: 'c-1',
      checkId: 'ch-1',
      status: 'PENDING',
    });

    interno<() => void>('actualizarCaso')();

    http
      .expectOne((r) => r.url.endsWith('/identity/me/verification-cases/c-1'))
      .flush({ id: 'c-1', status: 'APPROVED' });

    expect(interno<() => { status: string } | null>('caso')()?.status).toBe('APPROVED');
  });
});
