import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { AccountSecurity } from './security';

const SESIONES = [
  { id: 's-actual', createdAt: '2026-09-26T08:00:00.000Z', expiresAt: '2026-10-26T08:00:00.000Z', ip: '10.0.0.1', current: true },
  { id: 's-otra', createdAt: '2026-09-25T18:00:00.000Z', expiresAt: '2026-10-25T18:00:00.000Z', current: false },
];

/**
 * ID-24 / CV-22 · Seguridad de la cuenta: cambiar la contraseña, ver las sesiones
 * y cerrarlas. Cambio de contraseña: UI → request → response → recarga de la
 * lista → UI.
 */
describe('AccountSecurity (ID-24)', () => {
  let fixture: ComponentFixture<AccountSecurity>;
  let componente: AccountSecurity;
  let http: HttpTestingController;
  const avisos: string[] = [];
  let confirmar: boolean;

  beforeEach(() => {
    avisos.length = 0;
    confirmar = true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmar) } },
        {
          provide: ToastService,
          useValue: {
            success: (texto: string) => avisos.push(texto),
            warning: (texto: string) => avisos.push(texto),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AccountSecurity);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/iam/me/sessions').flush(SESIONES);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function llenar(actual: string, nueva: string, confirmacion: string): void {
    interno<{ setValue: (valor: unknown) => void }>('form').setValue({
      currentPassword: actual,
      newPassword: nueva,
      confirmation: confirmacion,
    });
  }

  it('lista las sesiones marcando la actual, y sólo las otras se pueden cerrar', () => {
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Este dispositivo');
    expect(texto).toContain('Otro dispositivo');
    expect(fixture.nativeElement.querySelectorAll('.sesion button').length).toBe(1);
  });

  it('cambiar la contraseña manda actual y nueva, avisa cuántas sesiones se cerraron y relee la lista', () => {
    llenar('vieja-1234', 'nueva-5678', 'nueva-5678');
    interno<() => void>('cambiarContrasena')();

    const pedido = http.expectOne('/iam/auth/change-password');
    expect(pedido.request.body).toEqual({ currentPassword: 'vieja-1234', newPassword: 'nueva-5678' });
    pedido.flush({ revokedSessions: 1 });

    // Se relee la lista: la otra sesión ya no figura.
    http.expectOne('/iam/me/sessions').flush([SESIONES[0]]);
    fixture.detectChanges();
    expect(avisos[0]).toContain('cerramos 1 sesión');
    expect(fixture.nativeElement.querySelectorAll('.sesion').length).toBe(1);
  });

  it('una contraseña actual incorrecta (422) se explica en el formulario y no cierra la sesión', () => {
    llenar('mala', 'nueva-5678', 'nueva-5678');
    interno<() => void>('cambiarContrasena')();

    http.expectOne('/iam/auth/change-password').flush(
      { code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'CURRENT_PASSWORD_INVALID' } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="seguridad-error"]')?.textContent).toContain(
      'La contraseña actual no es correcta',
    );
  });

  it('las dos contraseñas nuevas tienen que coincidir: no se manda nada', () => {
    llenar('vieja-1234', 'nueva-5678', 'otra-cosa-1');
    interno<() => void>('cambiarContrasena')();

    http.expectNone('/iam/auth/change-password');
    expect(interno<() => boolean>('noCoincide')()).toBe(true);
  });

  it('cerrar otra sesión llama a su ruta y relee', () => {
    interno<(s: unknown) => void>('cerrarSesion')({ id: 's-otra', current: false });

    const cierre = http.expectOne('/iam/me/sessions/s-otra/revoke');
    expect(cierre.request.method).toBe('POST');
    cierre.flush({ revoked: true });
    http.expectOne('/iam/me/sessions').flush([SESIONES[0]]);
  });

  it('«cerrar sesión en todos lados» confirma, llama a logout-all y lleva al login', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await interno<() => Promise<void>>('cerrarTodas')();
    http.expectOne('/iam/auth/logout-all').flush({ revokedSessions: 2 });

    expect(navegar).toHaveBeenCalledWith('/auth');
  });

  it('si se cancela la confirmación, no se cierra nada', async () => {
    confirmar = false;

    await interno<() => Promise<void>>('cerrarTodas')();

    http.expectNone('/iam/auth/logout-all');
  });
});
