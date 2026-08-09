import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { UserRegistration } from './user-registration';

/**
 * El alta de usuario es **la única que fija una contraseña desde afuera**, así
 * que lo que se fija acá es que el cuerpo que sale sea exactamente el del
 * contrato, que no se pueda enviar dos veces y que la pantalla diga lo que hay
 * que hacer con esa clave.
 */
describe('UserRegistration', () => {
  let fixture: ComponentFixture<UserRegistration>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserRegistration],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(UserRegistration);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  /**
   * El nombre va con espacios de sobra a propósito —se espera que se recorte—,
   * pero el correo NO: `Validators.email` rechaza un valor con espacios, así que
   * un correo padeado nunca llegaría a enviarse y la prueba estaría comprobando
   * otra cosa.
   */
  function completarFormulario() {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({
      displayName: '  Bruno Díaz  ',
      email: 'bruno@mantra.test',
      password: 'secreto12',
      phone: '',
    });
  }

  function enviar() {
    interno<() => void>('submit')();
  }

  it('un formulario incompleto no llega a la API', () => {
    enviar();

    // Sin `expectNone` explícito: `http.verify()` del afterEach falla si salió algo.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('manda el cuerpo del contrato, con el nombre recortado', () => {
    completarFormulario();
    enviar();

    const req = http.expectOne('/iam/users');
    expect(req.request.body).toEqual({
      displayName: 'Bruno Díaz',
      email: 'bruno@mantra.test',
      password: 'secreto12',
    });

    req.flush({
      id: 'u-1',
      displayName: 'Bruno Díaz',
      status: 'c-1',
      createdAt: '2026-08-04T10:00:00Z',
    });
  });

  it('el rol USER no viaja: es con lo que el backend completa', () => {
    completarFormulario();
    interno<(rol: string | null) => void>('cambiarRol')('USER');
    enviar();

    const req = http.expectOne('/iam/users');
    expect(req.request.body).not.toHaveProperty('initialRole');

    req.flush({ id: 'u-1', displayName: 'B', status: 'c-1', createdAt: '2026-08-04T10:00:00Z' });
  });

  it('el rol de administrador sí viaja, porque cambia lo que la cuenta puede hacer', () => {
    completarFormulario();
    interno<(rol: string | null) => void>('cambiarRol')('SECURITY_ADMIN');
    enviar();

    const req = http.expectOne('/iam/users');
    expect((req.request.body as { initialRole: string }).initialRole).toBe('SECURITY_ADMIN');

    req.flush({ id: 'u-1', displayName: 'B', status: 'c-1', createdAt: '2026-08-04T10:00:00Z' });
  });

  it('un rol desconocido cae en USER en vez de viajar tal cual', () => {
    completarFormulario();
    // El grupo de radios modela «sin elección» con null; y nadie debería poder
    // colar un rol que el backend no acepta.
    interno<(rol: string | null) => void>('cambiarRol')(null);
    enviar();

    const req = http.expectOne('/iam/users');
    expect(req.request.body).not.toHaveProperty('initialRole');

    req.flush({ id: 'u-1', displayName: 'B', status: 'c-1', createdAt: '2026-08-04T10:00:00Z' });
  });

  it('mientras la petición está en vuelo, un segundo envío no dispara otra', () => {
    completarFormulario();
    enviar();
    // Esto es lo que evita la cuenta duplicada: el doble click del trackpad.
    enviar();

    const req = http.expectOne('/iam/users');
    req.flush({ id: 'u-1', displayName: 'B', status: 'c-1', createdAt: '2026-08-04T10:00:00Z' });
  });

  it('al crearse, avisa qué hacer con la contraseña', () => {
    completarFormulario();
    enviar();
    http
      .expectOne('/iam/users')
      .flush({
        id: 'u-1',
        displayName: 'Bruno Díaz',
        status: 'c-1',
        createdAt: '2026-08-04T10:00:00Z',
      });
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('La cuenta quedó creada');
    // La clave no la eligió su dueño: hay que decir qué hacer con eso.
    expect(texto).toContain('canal seguro');
    expect(texto).toContain('u-1');
  });

  it('un correo repetido se muestra como el problema que es, no como error inesperado', () => {
    completarFormulario();
    enviar();

    http.expectOne('/iam/users').flush(
      {
        code: 'CONFLICT',
        message: 'Ya existe una cuenta con ese correo.',
        timestamp: '2026-08-04T10:00:00Z',
        path: '/iam/users',
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(interno<() => string | null>('errorMessage')()).toContain('Ya existe una cuenta');
    // El formulario sigue en pantalla con lo cargado: corregir el correo no
    // debería costar volver a escribir todo.
    expect(fixture.nativeElement.querySelector('[data-testid="alta-usuario-form"]')).not.toBeNull();
  });

  it('empezar otra alta limpia la contraseña anterior', () => {
    completarFormulario();
    enviar();
    http
      .expectOne('/iam/users')
      .flush({ id: 'u-1', displayName: 'B', status: 'c-1', createdAt: '2026-08-04T10:00:00Z' });

    interno<() => void>('altaNueva')();

    // Si quedara cargada, la cuenta siguiente nacería con la clave de la
    // anterior sin que nadie lo note.
    const form = interno<{ getRawValue: () => { password: string } }>('form');
    expect(form.getRawValue().password).toBe('');
  });
});
