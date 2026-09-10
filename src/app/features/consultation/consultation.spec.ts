import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Consultation } from './consultation';

/**
 * **Consulta médica** después de la fase 1 del plan de atención.
 *
 * Lo que estas pruebas fijan es lo que la pantalla **dejó de hacer**: atender
 * nace sólo de «Mis citas», así que acá no hay ningún botón que abra una
 * consulta ni el campo donde se pegaba un identificador de perfil para entrar
 * a atender sin cita.
 *
 * Se monta sin sesión a propósito: sin perfil ni organización la pantalla
 * resuelve su estado vacío sin pedirle nada a la red, que es todo lo que hace
 * falta para mirar lo que ofrece —y lo que ya no—.
 */
describe('Consultation', () => {
  let harness: RouterTestingHarness;
  let componente: Consultation;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'consultation', component: Consultation }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/consultation', Consultation);
    harness.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function html(): string {
    return harness.fixture.nativeElement.innerHTML as string;
  }

  it('sin sesión resuelve el vacío sin pedirle nada a la red', () => {
    // El `http.verify()` del afterEach es la mitad de esta afirmación.
    expect(interno<() => { status: string }>('estado')().status).toBe('empty');
  });

  it('ya no ofrece abrir la consulta: eso vive en «Mis citas»', () => {
    expect(html()).not.toContain('Abrir consulta');
  });

  /**
   * Era el camino que entraba a atender **sin cita ni rastro** de por qué se
   * abrió esa consulta. Se fue con su campo y con su método.
   */
  it('ya no deja atender pegando un identificador de perfil', () => {
    expect(html()).not.toContain('app-input');
    expect(interno<unknown>('abrirPorIdentificador')).toBeUndefined();
    expect(interno<unknown>('identificador')).toBeUndefined();
  });

  it('ofrece el camino de quien llega sin turno: darle el turno de mostrador', () => {
    expect(interno<string>('rutaDelTurnoDeMostrador')).toBe('/schedule/appointment/new');
    expect(html()).toContain('Registrar turno de mostrador');
  });

  it('manda a «Mis citas», que es el único origen de la atención', () => {
    expect(interno<string>('rutaDeMisCitas')).toBe('/schedule');
  });
});
