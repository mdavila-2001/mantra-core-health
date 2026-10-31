import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { MfaClient } from '../../../core/data-access/iam/mfa.client';
import { TokenRefreshService } from '../../../core/http/token-refresh.service';
import type { MfaStatus } from '../../../core/data-access/iam/mfa.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { MfaEnrollment } from './mfa-enrollment';
import { QR_DRAWER } from './qr-drawer';

const SIN_FACTOR: MfaStatus = { required: true, enrolled: false, enrollmentRequired: true, factors: [] };
const CON_FACTOR: MfaStatus = {
  required: true,
  enrolled: true,
  enrollmentRequired: false,
  factors: [{ id: 'f-0', type: 'TOTP', state: 'VERIFIED', label: 'Teléfono personal', verifiedAt: new Date('2026-09-01T10:00:00Z'), createdAt: new Date('2026-09-01T09:00:00Z') }],
};
const ALTA = { factorId: 'f-1', secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/Alovida:ana?secret=JBSWY3DPEHPK3PXP' };

const reautenticacion = (reason: string): HttpErrorResponse =>
  new HttpErrorResponse({ status: 422, error: { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'x', details: { reason }, timestamp: '', path: '' } });

/** El token de alcance limitado: sin roles ni organizaciones y con `mfaEnrollment`. */
function tokenLimitado(): string {
  const codificar = (valor: object): string => btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${codificar({ alg: 'none' })}.${codificar({ sub: 'u-1', roles: [], tenants: [], mfaEnrollment: true, deniedTenants: { 't-1': 'MFA_ENROLLMENT_REQUIRED' } })}.firma`;
}

const codigoInvalido = (): HttpErrorResponse =>
  new HttpErrorResponse({ status: 422, error: { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'MFA_CODE_INVALID' }, timestamp: '', path: '' } });

describe('MfaEnrollment', () => {
  let fixture: ComponentFixture<MfaEnrollment>;
  let getStatus: ReturnType<typeof vi.fn>;
  let startTotp: ReturnType<typeof vi.fn>;
  let confirmTotp: ReturnType<typeof vi.fn>;
  let revokeFactor: ReturnType<typeof vi.fn>;
  let refresh: ReturnType<typeof vi.fn>;
  let dibujarQr: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const clic = async (id: string): Promise<void> => {
    (byId(id) as HTMLElement).click();
    await refrescar();
  };
  const escribirCodigo = async (valor: string): Promise<void> => {
    const input = byId('mfa-codigo') as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await refrescar();
  };

  /** Escribe la contraseña actual y la envía, en el formulario de reautenticación que se abre con id `prefijo`. */
  const reautenticar = async (prefijo: string, contrasena = 'mi-clave'): Promise<void> => {
    const input = byId(`${prefijo}-contrasena`) as HTMLInputElement;
    input.value = contrasena;
    input.dispatchEvent(new Event('input'));
    await refrescar();
    await clic(`${prefijo}-enviar`);
  };
  /** «Activar»: pide la reautenticación y, con la contraseña, el factor. */
  const activar = async (contrasena = 'mi-clave'): Promise<void> => {
    await clic('mfa-empezar');
    await reautenticar('reauth', contrasena);
  };

  async function abrir(estado: MfaStatus, returnUrl: string | null = '/agenda', limitado = false): Promise<void> {
    getStatus = vi.fn(() => of(estado));
    startTotp = vi.fn(() => of(ALTA));
    confirmTotp = vi.fn(() => of({ verified: true, factorId: 'f-1', verifiedAt: new Date() }));
    revokeFactor = vi.fn(() => of({ revoked: true, remainingVerified: 0 }));
    refresh = vi.fn(() => of({}));
    dibujarQr = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MfaClient, useValue: { getStatus, startTotp, confirmTotp, revokeFactor } },
        { provide: TokenRefreshService, useValue: { refresh } },
        { provide: QR_DRAWER, useValue: dibujarQr },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(returnUrl === null ? {} : { returnUrl }) } } },
      ],
    });
    if (limitado) TestBed.inject(SessionStore).start({ accessToken: tokenLimitado(), refreshToken: 'r' });
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(MfaEnrollment);
    fixture.detectChanges();
    await refrescar();
  }

  it('sin factor y con la organización exigiéndolo: lo dice, ofrece activar y no muestra el secreto todavía', async () => {
    await abrir(SIN_FACTOR);
    expect(byId('mfa-obligatorio')!.textContent).toContain('no puede usar el resto de la aplicación');
    expect(byId('mfa-obligatorio')!.textContent).toContain('el servidor también lo exige');
    expect(byId('mfa-inactiva')).not.toBeNull();
    expect(byId('mfa-secreto')).toBeNull();
    expect(byId('mfa-empezar')!.textContent).toContain('Activar la verificación en dos pasos');
  });

  it('con el token de alcance limitado la sesión sigue restringida hasta confirmar; con un token completo no se restringe nada', async () => {
    await abrir(SIN_FACTOR, '/agenda', true);
    expect(TestBed.inject(SessionStore).mfaEnrollment()).toBe('required');
    TestBed.resetTestingModule();
    await abrir(SIN_FACTOR);
    expect(TestBed.inject(SessionStore).mfaEnrollment()).toBe('done');
  });

  it('quien ya la tiene lo ve: factores activos y ningún aviso de obligación', async () => {
    await abrir(CON_FACTOR);
    expect(byId('mfa-obligatorio')).toBeNull();
    expect(byId('mfa-activada')!.textContent).toContain('está activada');
    expect(byId('mfa-factor')!.textContent).toContain('Teléfono personal');
    expect(byId('mfa-empezar')!.textContent).toContain('Configurar otra aplicación');
    expect(TestBed.inject(SessionStore).mfaEnrollment()).toBe('done');
  });

  it('no poder leer el estado se dice y se puede reintentar', async () => {
    getStatus = vi.fn();
    await abrir(SIN_FACTOR);
    getStatus.mockReturnValueOnce(throwError(() => new Error('x')));
    fixture.componentInstance['cargar']();
    await refrescar();
    expect(byId('mfa-error')!.textContent).toContain('No pudimos revisar');
    expect(byId('mfa-reintentar')).not.toBeNull();
  });

  it('activar pide el factor y muestra el QR y el código escrito en grupos de cuatro, una sola vez', async () => {
    await abrir(SIN_FACTOR);
    await activar();
    // La API exige reautenticar: la contraseña actual viaja con el pedido.
    expect(startTotp).toHaveBeenCalledWith({ currentPassword: 'mi-clave' });
    expect(startTotp).toHaveBeenCalledTimes(1);
    expect(byId('mfa-qr')).not.toBeNull();
    // El QR se dibuja en el navegador con el `otpauth://` de la API: el secreto no sale a ningún servicio.
    expect(dibujarQr).toHaveBeenCalledWith(byId('mfa-qr'), ALTA.otpauthUri, 200);
    expect(byId('mfa-secreto')!.textContent!.trim()).toBe('JBSW Y3DP EHPK 3PXP');
    expect(byId('mfa-pasos')!.textContent).toContain('se muestra una sola vez');
  });

  it('confirmar con un código de forma inválida no llama a la API y lo explica', async () => {
    await abrir(SIN_FACTOR);
    await activar();
    await escribirCodigo('12');
    await clic('mfa-confirmar');
    expect(confirmTotp).not.toHaveBeenCalled();
    expect(host().textContent).toContain('Escriba los 6 dígitos');
  });

  it('con el código bueno confirma el factor correcto, pide el token completo y ofrece continuar', async () => {
    await abrir(SIN_FACTOR, '/agenda', true);
    await activar();
    await escribirCodigo('123 456');
    await clic('mfa-confirmar');
    expect(confirmTotp).toHaveBeenCalledWith('f-1', '123456');
    // El refresco reemite el token completo al confirmar el factor: sin él la sesión seguiría siendo la limitada.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(byId('mfa-listo')!.textContent).toContain('quedó activada');
    expect(TestBed.inject(SessionStore).mfaEnrollment()).toBe('done');
    expect(byId('mfa-secreto')).toBeNull();
    await clic('mfa-continuar');
    expect(navigateByUrl).toHaveBeenCalledWith('/agenda');
  });

  it('sin una ruta de vuelta, continuar lleva al panel; una ruta externa se ignora', async () => {
    await abrir(SIN_FACTOR, 'https://otro.sitio');
    await activar();
    await escribirCodigo('123456');
    await clic('mfa-confirmar');
    await clic('mfa-continuar');
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('un código equivocado (422) lo dice, vacía el campo y deja volver a probar sin perder el QR', async () => {
    await abrir(SIN_FACTOR, '/agenda', true);
    await activar();
    confirmTotp.mockReturnValueOnce(throwError(codigoInvalido));
    await escribirCodigo('000000');
    await clic('mfa-confirmar');
    expect(byId('mfa-codigo-error')!.textContent).toContain('no es correcto o ya venció');
    expect((byId('mfa-codigo') as HTMLInputElement).value).toBe('');
    expect(byId('mfa-secreto')).not.toBeNull();
    expect(byId('mfa-listo')).toBeNull();
    expect(TestBed.inject(SessionStore).mfaEnrollment()).toBe('required');
    // Y con el bueno, entra.
    await escribirCodigo('123456');
    await clic('mfa-confirmar');
    expect(byId('mfa-listo')).not.toBeNull();
  });

  it('empezar de nuevo pide otro secreto y limpia el código escrito', async () => {
    await abrir(SIN_FACTOR);
    await activar();
    startTotp.mockReturnValueOnce(of({ factorId: 'f-2', secret: 'MFRGGZDFMZTWQ2LK', otpauthUri: 'otpauth://totp/x?secret=MFRGGZDFMZTWQ2LK' }));
    await escribirCodigo('123456');
    // Empezar de nuevo vuelve a pedir quién es: la API lo exige en cada alta.
    await clic('mfa-reempezar');
    expect(byId('reauth-form')).not.toBeNull();
    await reautenticar('reauth');
    expect(startTotp).toHaveBeenCalledTimes(2);
    expect(byId('mfa-secreto')!.textContent!.trim()).toBe('MFRG GZDF MZTW Q2LK');
    expect((byId('mfa-codigo') as HTMLInputElement).value).toBe('');
  });

  it('si no se pudo preparar la activación, lo dice y se queda en el inicio', async () => {
    await abrir(SIN_FACTOR);
    startTotp.mockReturnValueOnce(throwError(() => new Error('x')));
    await activar();
    // Se queda pidiendo la confirmación de identidad, con el motivo, y no muestra ningún secreto.
    expect(byId('reauth-error')!.textContent).toContain('No pudimos completar la operación');
    expect(byId('mfa-secreto')).toBeNull();
  });

  it('cancelar vuelve al inicio sin confirmar nada', async () => {
    await abrir(SIN_FACTOR);
    await activar();
    await clic('mfa-cancelar');
    expect(byId('mfa-secreto')).toBeNull();
    expect(byId('mfa-empezar')).not.toBeNull();
    expect(confirmTotp).not.toHaveBeenCalled();
  });

  describe('reautenticación', () => {
    it('no deja pasar sin contraseña: pide escribirla y no llama a la API', async () => {
      await abrir(SIN_FACTOR);
      await clic('mfa-empezar');
      await clic('reauth-enviar');
      expect(startTotp).not.toHaveBeenCalled();
      expect(host().textContent).toContain('Escriba su contraseña actual');
    });

    it('una contraseña equivocada (422 MFA_REAUTH_FAILED) lo dice, no muestra el QR y deja volver a probar', async () => {
      await abrir(SIN_FACTOR);
      startTotp.mockReturnValueOnce(throwError(() => reautenticacion('MFA_REAUTH_FAILED')));
      await activar('mala');
      expect(byId('reauth-error')!.textContent).toContain('no son correctos');
      expect(byId('mfa-secreto')).toBeNull();
      await reautenticar('reauth', 'buena');
      expect(startTotp).toHaveBeenLastCalledWith({ currentPassword: 'buena' });
      expect(byId('mfa-secreto')).not.toBeNull();
    });

    it('quien ya tiene un método puede probar con el código de su aplicación', async () => {
      await abrir(CON_FACTOR);
      await clic('mfa-empezar');
      await clic('reauth-modo-codigo');
      const input = byId('reauth-codigo') as HTMLInputElement;
      input.value = '123 456';
      input.dispatchEvent(new Event('input'));
      await refrescar();
      await clic('reauth-enviar');
      expect(startTotp).toHaveBeenCalledWith({ mfaCode: '123456' });
    });

    it('quien no tiene método no ve la opción del código: solo la contraseña', async () => {
      await abrir(SIN_FACTOR);
      await clic('mfa-empezar');
      expect(byId('reauth-modo-codigo')).toBeNull();
    });
  });

  describe('quitar un método', () => {
    it('pide confirmar quién es, avisa que es el único y que la organización lo exige, y lo quita con la reautenticación', async () => {
      await abrir(CON_FACTOR);
      await clic('mfa-quitar');
      expect(byId('mfa-quitar-aviso')!.textContent).toContain('Es su único método');
      expect(byId('mfa-quitar-aviso')!.textContent).toContain('no podrá entrar a esa organización');
      getStatus.mockReturnValue(of({ required: true, enrolled: false, enrollmentRequired: true, factors: [] }));
      await reautenticar('quitar');
      expect(revokeFactor).toHaveBeenCalledWith('f-0', { currentPassword: 'mi-clave' });
      // Se vuelve a leer lo que queda: ya no hay método y la organización lo sigue exigiendo.
      expect(byId('mfa-inactiva')).not.toBeNull();
      expect(byId('mfa-obligatorio')).not.toBeNull();
    });

    it('una reautenticación fallida no quita nada y lo explica', async () => {
      await abrir(CON_FACTOR);
      revokeFactor.mockReturnValueOnce(throwError(() => reautenticacion('MFA_REAUTH_FAILED')));
      await clic('mfa-quitar');
      await reautenticar('quitar', 'mala');
      expect(byId('quitar-error')!.textContent).toContain('no son correctos');
      expect(byId('mfa-activada')).not.toBeNull();
    });

    it('cancelar cierra el panel sin llamar a la API', async () => {
      await abrir(CON_FACTOR);
      await clic('mfa-quitar');
      await clic('quitar-cancelar');
      expect(byId('mfa-quitar-panel')).toBeNull();
      expect(revokeFactor).not.toHaveBeenCalled();
    });
  });
});
