import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { resolverEstadosDeCaso } from '../../../testing/case-status';
import { IdentityVerification } from './identity-verification';

/** base64url sobre UTF-8, como el token real (ver `shell-layout.spec.ts`). */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

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

    // La pantalla **inyecta** el catálogo de estados, así que al construirse ya
    // pide los conceptos: no hace falta pedírselo al inyector desde acá.
    //
    // `dev` había resuelto esta misma prueba haciendo el `TestBed.inject` en el
    // arnés, con el argumento de que la pantalla lee el catálogo «por una
    // función pura». Eso hacía pasar la prueba y dejaba el defecto en pie: en la
    // aplicación real nadie construía el catálogo, y quien entra por la puerta
    // del estado S5 —que lleva directo a esta pantalla— veía «Desconocido»
    // sobre su propio trámite. Se arregló donde estaba: en el componente.
    resolverEstadosDeCaso(http);
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

  /**
   * Abrir un caso —y actualizar su estado— relee el historial: es la columna de
   * al lado, que no se oculta al enviar. Toda prueba que llega al alta tiene que
   * responder ese pedido, porque `http.verify()` no perdona una petición sin
   * atender. Que aparezca en tantas pruebas es la señal de que la recarga
   * existe, no ruido.
   */
  function responderHistorial(casos: readonly unknown[] = []) {
    http.expectOne('/identity/me/verification-cases').flush(casos);
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
    responderHistorial();
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
    responderHistorial();
  });

  it('encadena la apertura del caso con el identificador de la subida', () => {
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-42' });

    const caso = http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification'));
    expect(caso.request.body).toEqual({ evidenceFileId: 'f-42' });

    caso.flush({ caseId: 'c-1', checkId: 'ch-1', status: 'PENDING' });
    responderHistorial();

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
    responderHistorial();
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
    // El catálogo ya quedó resuelto en el `beforeEach`. Esta prueba fallaba
    // porque la pantalla **no inyectaba** `CaseStatusCatalog`: nadie llenaba el
    // mapa, y el sello del titular decía «Desconocido» sobre su propio trámite.
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-1' });
    http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification')).flush({
      caseId: 'c-1',
      checkId: 'ch-1',
      status: 'd41fde09-6752-5bb6-8237-b786fe062ab2', // CASE_ASSERTED
    });
    responderHistorial();

    fixture.detectChanges();

    const sello = (fixture.nativeElement as HTMLElement).querySelector('app-status-seal');
    expect(sello).not.toBeNull();
    expect(sello?.textContent).toContain('Aprobado');
    expect(sello?.textContent).not.toContain('d41fde09');
  });

  it('el historial se ordena del más nuevo al más viejo, junto al formulario', () => {
    // El formulario del trámite y el historial conviven: uno no desplaza al
    // otro. Se crea una instancia propia para responderle el historial con
    // datos en vez del vacío del `beforeEach`.
    const propia = TestBed.createComponent(IdentityVerification);
    http.expectOne('/identity/me/verification-cases').flush([
      { id: 'viejo', status: 'PENDING', openedAt: '2026-08-01T10:00:00.000Z' },
      {
        id: 'nuevo',
        status: 'd41fde09-6752-5bb6-8237-b786fe062ab2', // CASE_ASSERTED
        openedAt: '2026-07-20T10:00:00.000Z',
        completedAt: '2026-08-05T10:00:00.000Z',
      },
    ]);
    propia.detectChanges();

    const filas = Array.from(
      (propia.nativeElement as HTMLElement).querySelectorAll('.verificar__historial-fila'),
    );
    expect(filas.length).toBe(2);
    // El cierre manda sobre la apertura: el caso resuelto ayer es más reciente
    // que el abierto después y todavía en trámite.
    expect(filas[0]?.textContent).toContain('Resuelto el');
    expect(filas[1]?.textContent).toContain('Abierto el');
    expect(
      (propia.nativeElement as HTMLElement).querySelector('app-radio-group'),
    ).not.toBeNull();
  });

  function elegirTramite(tramite: string) {
    interno<(v: unknown) => void>('alElegirTramite')(tramite);
  }

  it('el trámite de profesional va a su endpoint, con el mismo flujo', () => {
    elegirTramite('practitioner');
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-7' });

    const caso = http.expectOne((r) =>
      r.url.endsWith('/identity/me/practitioner/identity-verification'),
    );
    expect(caso.request.body).toEqual({ evidenceFileId: 'f-7' });

    caso.flush({ caseId: 'c-1', checkId: 'ch-1', status: 'PENDING' });
    responderHistorial();
  });

  it('la matrícula no inventa la jurisdicción: el cuerpo solo lleva la evidencia', () => {
    // No hay endpoint para buscar matrículas: omitida, el backend usa la única
    // del profesional. Cuando exista el buscador, esta prueba cambia con él.
    elegirTramite('license');
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-8' });

    const caso = http.expectOne((r) =>
      r.url.endsWith('/identity/me/practitioner/license-verification'),
    );
    expect(Object.keys(caso.request.body as object)).toEqual(['evidenceFileId']);

    caso.flush({ caseId: 'c-1', checkId: 'ch-1', status: 'PENDING' });
    responderHistorial();
  });

  it('verificar una organización exige elegir cuál', () => {
    elegirTramite('tenant');
    elegirArchivo();

    // Sin organización elegida no sale ninguna petición.
    expect(interno<() => boolean>('puedeEnviar')()).toBe(false);
    subir();

    interno<{ set: (v: string | null) => void }>('organizacionId').set('t-9');
    expect(interno<() => boolean>('puedeEnviar')()).toBe(true);
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-9' });
    http
      .expectOne((r) => r.url.endsWith('/identity/me/tenants/t-9/verification'))
      .flush({ caseId: 'c-1', checkId: 'ch-1', status: 'PENDING' });
    responderHistorial();
  });

  it('con una sola organización en el token, queda elegida sola', () => {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: [], tenants: ['t-1'] }),
      refreshToken: 'r',
    });

    expect(interno<() => string | null>('organizacionId')()).toBe('t-1');
  });

  it('el selector solo acepta trámites reales', () => {
    elegirTramite('license');
    expect(interno<() => string>('tramite')()).toBe('license');

    // Un valor que no es un trámite no cambia nada: viene de `unknown`.
    elegirTramite('superadmin');
    expect(interno<() => string>('tramite')()).toBe('license');
  });

  it('«iniciar otro trámite» vuelve al formulario y descarta la evidencia', () => {
    elegirArchivo();
    subir();
    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-1' });
    http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification')).flush({
      caseId: 'c-1',
      checkId: 'ch-1',
      status: 'PENDING',
    });
    responderHistorial();

    interno<() => void>('nuevaSolicitud')();

    expect(interno<() => unknown>('caso')()).toBeNull();
    // Cada trámite lleva su propio documento: el anterior no se reutiliza.
    expect(interno<() => readonly File[]>('evidencia')()).toEqual([]);
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
    responderHistorial();

    interno<() => void>('actualizarCaso')();

    http
      .expectOne((r) => r.url.endsWith('/identity/me/verification-cases/c-1'))
      .flush({ id: 'c-1', status: 'APPROVED' });
    responderHistorial();

    expect(interno<() => { status: string } | null>('caso')()?.status).toBe('APPROVED');
  });

  /**
   * El caso recién abierto y el historial se ven **a la vez**: el panel de la
   * izquierda y la columna de contexto de la derecha. Sin releer, la pantalla
   * anuncia «tu solicitud quedó registrada» mientras «tus trámites anteriores»
   * no la incluye — se contradice a sí misma en el mismo pantallazo.
   */
  it('al abrir un caso relee el historial, que muestra el trámite recién enviado', () => {
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-1' });
    http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification')).flush({
      caseId: 'c-nuevo',
      checkId: 'ch-1',
      status: 'PENDING',
    });

    // La relectura es la que trae las fechas: el alta sólo devuelve id y estado.
    responderHistorial([{ id: 'c-nuevo', status: 'PENDING', openedAt: '2026-08-10T10:00:00.000Z' }]);
    fixture.detectChanges();

    const filas = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.verificar__historial-fila',
    );
    expect(filas.length).toBe(1);
    expect(filas[0]?.textContent).toContain('Abierto el');
  });

  /**
   * El momento de la demo: el estado pasa de pendiente a verificado. Sin releer,
   * el sello del panel cambia y el de la fila del historial se queda con el
   * estado viejo — dos sellos distintos del mismo trámite, uno al lado del otro.
   */
  it('al actualizar el estado relee el historial, y los dos sellos coinciden', () => {
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'f-1' });
    http.expectOne((r) => r.url.endsWith('/identity/me/identity-verification')).flush({
      caseId: 'c-1',
      checkId: 'ch-1',
      status: 'PENDING',
    });
    responderHistorial([{ id: 'c-1', status: 'PENDING', openedAt: '2026-08-10T10:00:00.000Z' }]);

    interno<() => void>('actualizarCaso')();

    const aprobado = 'd41fde09-6752-5bb6-8237-b786fe062ab2'; // CASE_ASSERTED
    http
      .expectOne((r) => r.url.endsWith('/identity/me/verification-cases/c-1'))
      .flush({ id: 'c-1', status: aprobado });
    responderHistorial([{ id: 'c-1', status: aprobado, openedAt: '2026-08-10T10:00:00.000Z' }]);
    fixture.detectChanges();

    const sellos = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('app-status-seal'),
    );
    // El del panel y el de la fila del historial: ninguno quedó atrás.
    expect(sellos.length).toBe(2);
    for (const sello of sellos) {
      expect(sello.textContent).toContain('Aprobado');
    }
  });
});
