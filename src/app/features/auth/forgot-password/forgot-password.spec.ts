import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ForgotPassword } from './forgot-password';

/** Mensaje neutro real del backend: idéntico exista o no la cuenta. */
const MENSAJE_NEUTRO =
  'Si la cuenta existe, te enviamos un correo con las instrucciones para continuar.';

describe('ForgotPassword', () => {
  let fixture: ComponentFixture<ForgotPassword>;
  let backend: HttpTestingController;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function campo(): HTMLInputElement {
    const input = root().querySelector<HTMLInputElement>('app-input input');
    if (input === null) {
      throw new Error('no se encontró el campo');
    }
    return input;
  }

  async function enviar(valor: string): Promise<void> {
    const input = campo();
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ForgotPassword);
    await fixture.whenStable();
  });

  afterEach(() => {
    backend.verify();
  });

  it('manda un solo campo `identifier`, sin distinguir correo de documento', async () => {
    await enviar('  admin@redesa.test  ');

    const peticion = backend.expectOne('/iam/auth/forgot-password');
    expect(peticion.request.body).toEqual({ identifier: 'admin@redesa.test' });

    peticion.flush({ message: MENSAJE_NEUTRO });
  });

  it('acepta un documento por el mismo campo', async () => {
    await enviar('1234567');

    const peticion = backend.expectOne('/iam/auth/forgot-password');
    expect(peticion.request.body).toEqual({ identifier: '1234567' });

    peticion.flush({ message: MENSAJE_NEUTRO });
  });

  it('el formulario vacío no llega a la API', async () => {
    root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    // `backend.verify()` del afterEach falla si hubiera salido alguna petición.
  });

  it('muestra el mensaje del backend tal cual, sin agregarle nada', async () => {
    await enviar('admin@redesa.test');
    backend.expectOne('/iam/auth/forgot-password').flush({ message: MENSAJE_NEUTRO });
    await fixture.whenStable();

    expect(root().textContent).toContain(MENSAJE_NEUTRO);
  });

  it('la pantalla no dice en ningún caso si la cuenta existe', async () => {
    await enviar('nadie@ejemplo.test');
    backend.expectOne('/iam/auth/forgot-password').flush({ message: MENSAJE_NEUTRO });
    await fixture.whenStable();

    const texto = (root().textContent ?? '').toLowerCase();
    // El backend se cuida de no confirmar registros; la pantalla no puede deshacer ese cuidado.
    expect(texto).not.toContain('no existe');
    expect(texto).not.toContain('no encontramos');
    expect(texto).not.toContain('no está registrad');
  });

  it('tras enviar, el formulario desaparece: son 5 solicitudes por minuto', async () => {
    await enviar('admin@redesa.test');
    backend.expectOne('/iam/auth/forgot-password').flush({ message: MENSAJE_NEUTRO });
    await fixture.whenStable();

    expect(root().querySelector('form')).toBeNull();
  });

  it('el 429 dice cuánto esperar, no solo que falló', async () => {
    await enviar('admin@redesa.test');

    backend.expectOne('/iam/auth/forgot-password').flush(
      { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes.' },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '60' } },
    );
    await fixture.whenStable();

    expect(root().textContent).toContain('60 segundos');
    // Y el formulario sigue en pantalla, porque el envío no llegó a ocurrir.
    expect(root().querySelector('form')).not.toBeNull();
  });

  it('un servidor inalcanzable se explica', async () => {
    await enviar('admin@redesa.test');
    backend
      .expectOne('/iam/auth/forgot-password')
      .error(new ProgressEvent('error'), { status: 0 });
    await fixture.whenStable();

    expect(root().textContent).toContain('No se pudo contactar al servidor');
  });
});
