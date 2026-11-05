import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { NewDeviceAlert } from '../../../core/auth/new-device-alert';
import { AccountSecurityClient } from '../../../core/data-access/iam/account-security.client';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { NewDeviceBanner } from './new-device-banner';

describe('NewDeviceBanner', () => {
  let fixture: ComponentFixture<NewDeviceBanner>;
  let alerta: NewDeviceAlert;
  let confirmDevice: ReturnType<typeof vi.fn>;
  let reportDeviceNotMe: ReturnType<typeof vi.fn>;
  let requestDeviceCode: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const clic = async (id: string): Promise<void> => {
    (byId(id) as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    confirmDevice = vi.fn(() => of({ confirmed: true, deviceId: 'd-1' }));
    reportDeviceNotMe = vi.fn(() => of({ revokedSessions: 2, deviceId: 'd-1' }));
    requestDeviceCode = vi.fn(() => of({ sent: true, sentTo: 'l***@alovida.mock' }));
    confirm = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AccountSecurityClient, useValue: { confirmDevice, reportDeviceNotMe, requestDeviceCode } },
        { provide: DialogService, useValue: { confirm } },
      ],
    });
    alerta = TestBed.inject(NewDeviceAlert);
    fixture = TestBed.createComponent(NewDeviceBanner);
    fixture.detectChanges();
  });

  const avisar = (): void => {
    alerta.show({ deviceId: 'd-1', label: 'Chrome en Windows', ip: '190.129.77.12', occurredAt: new Date('2026-10-30T13:12:00Z') });
    fixture.detectChanges();
  };

  it('sin aviso no dibuja nada', () => {
    expect(byId('aviso-dispositivo')).toBeNull();
  });

  it('dice qué dispositivo, desde qué IP y ofrece las dos respuestas', () => {
    avisar();
    expect(byId('aviso-dispositivo-detalle')!.textContent).toContain('Chrome en Windows');
    expect(byId('aviso-dispositivo-detalle')!.textContent).toContain('IP 190.129.77.12');
    expect(byId('aviso-dispositivo-fui-yo')!.textContent).toContain('Fui yo');
    expect(byId('aviso-dispositivo-no-fui-yo')!.textContent).toContain('No fui yo, cerrar otras sesiones');
  });

  it('«Fui yo» confirma ese dispositivo y el aviso se va', async () => {
    avisar();
    await clic('aviso-dispositivo-fui-yo');
    expect(confirmDevice).toHaveBeenCalledWith('d-1');
    expect(alerta.notice()).toBeNull();
    expect(byId('aviso-dispositivo')).toBeNull();
  });

  it('si no se pudo guardar la respuesta, el aviso sigue y lo dice', async () => {
    confirmDevice.mockReturnValueOnce(throwError(() => new Error('x')));
    avisar();
    await clic('aviso-dispositivo-fui-yo');
    expect(alerta.notice()).not.toBeNull();
    expect(byId('aviso-dispositivo-fallo')!.textContent).toContain('No pudimos guardar');
  });

  it('«No fui yo» pide confirmación, cierra las otras sesiones y manda a cambiar la contraseña', async () => {
    avisar();
    await clic('aviso-dispositivo-no-fui-yo');
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    // La ruta atómica de la API, con el dispositivo del aviso: no listar y revocar de a una.
    expect(reportDeviceNotMe).toHaveBeenCalledTimes(1);
    expect(reportDeviceNotMe).toHaveBeenCalledWith('d-1');
    expect(byId('aviso-dispositivo-resultado')!.textContent).toContain('Se cerraron 2 sesiones');
    expect(byId('aviso-dispositivo-cambiar-clave')).not.toBeNull();
    await clic('aviso-dispositivo-entendido');
    expect(alerta.notice()).toBeNull();
  });

  it('si la API no pudo cerrar las otras sesiones, lo dice y deja el aviso', async () => {
    reportDeviceNotMe.mockReturnValueOnce(throwError(() => new Error('x')));
    avisar();
    await clic('aviso-dispositivo-no-fui-yo');
    expect(byId('aviso-dispositivo-fallo')!.textContent).toContain('No pudimos cerrar las otras sesiones');
    expect(alerta.notice()).not.toBeNull();
  });

  it('si cancela la confirmación no se cierra nada', async () => {
    confirm.mockResolvedValueOnce(false);
    avisar();
    await clic('aviso-dispositivo-no-fui-yo');
    expect(reportDeviceNotMe).not.toHaveBeenCalled();
    expect(alerta.notice()).not.toBeNull();
  });

  it('«Más tarde» lo oculta sin responder nada', async () => {
    avisar();
    await clic('aviso-dispositivo-despues');
    expect(confirmDevice).not.toHaveBeenCalled();
    expect(byId('aviso-dispositivo')).toBeNull();
  });

  describe('«Fui yo» con código del correo', () => {
    const razon = (reason: string, details: Record<string, unknown> = {}): HttpErrorResponse =>
      new HttpErrorResponse({ status: 422, error: { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'x', details: { ...details, reason }, timestamp: '', path: '' } });
    const escribir = async (id: string, valor: string): Promise<void> => {
      const input = byId(id) as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const pedirCodigo = async (): Promise<void> => {
      confirmDevice.mockReturnValueOnce(throwError(() => razon('DEVICE_CONFIRM_CODE_REQUIRED', { canRequestCode: true })));
      avisar();
      await clic('aviso-dispositivo-fui-yo');
    };

    it('si la API pide el código (DEVICE_CONFIRM_CODE_REQUIRED), abre el paso del código sin confirmar nada', async () => {
      await pedirCodigo();
      expect(byId('aviso-dispositivo-codigo-paso')).not.toBeNull();
      expect(alerta.notice()).not.toBeNull();
      expect(byId('aviso-dispositivo-fui-yo')).toBeNull();
    });

    it('«Enviarme el código» lo pide y dice a qué dirección enmascarada salió', async () => {
      await pedirCodigo();
      await clic('aviso-dispositivo-pedir-codigo');
      expect(requestDeviceCode).toHaveBeenCalledWith('d-1');
      expect(byId('aviso-dispositivo-enviado')!.textContent).toContain('l***@alovida.mock');
      expect(byId('aviso-dispositivo-pedir-codigo')!.textContent).toContain('Enviar otro código');
    });

    it('escribe los 8 dígitos y confirma: el aviso se va', async () => {
      await pedirCodigo();
      await clic('aviso-dispositivo-pedir-codigo');
      await escribir('aviso-dispositivo-codigo', '1234 5678');
      await clic('aviso-dispositivo-confirmar-codigo');
      expect(confirmDevice).toHaveBeenLastCalledWith('d-1', '12345678');
      expect(alerta.notice()).toBeNull();
    });

    it('un código que no tiene 8 dígitos no se envía y lo explica', async () => {
      await pedirCodigo();
      await escribir('aviso-dispositivo-codigo', '123');
      await clic('aviso-dispositivo-confirmar-codigo');
      expect(confirmDevice).toHaveBeenCalledTimes(1);
      expect(host().textContent).toContain('Escriba los 8 dígitos');
    });

    it('un código malo o ya usado (DEVICE_CONFIRM_CODE_INVALID) lo dice, vacía el campo y deja pedir otro', async () => {
      await pedirCodigo();
      confirmDevice.mockReturnValueOnce(throwError(() => razon('DEVICE_CONFIRM_CODE_INVALID')));
      await escribir('aviso-dispositivo-codigo', '00000000');
      await clic('aviso-dispositivo-confirmar-codigo');
      expect(byId('aviso-dispositivo-fallo')!.textContent).toContain('ya se usó');
      expect((byId('aviso-dispositivo-codigo') as HTMLInputElement).value).toBe('');
      expect(alerta.notice()).not.toBeNull();
    });

    it('sin correo verificado (DEVICE_CONFIRM_NO_VERIFIED_EMAIL) explica qué hacer en lugar de un error genérico', async () => {
      await pedirCodigo();
      requestDeviceCode.mockReturnValueOnce(throwError(() => razon('DEVICE_CONFIRM_NO_VERIFIED_EMAIL')));
      await clic('aviso-dispositivo-pedir-codigo');
      expect(byId('aviso-dispositivo-fallo')!.textContent).toContain('correo verificado');
      expect(byId('aviso-dispositivo-fallo')!.textContent).toContain('No fui yo');
    });

    it('«Volver» deja el aviso como estaba y «No fui yo» sigue igual', async () => {
      await pedirCodigo();
      await clic('aviso-dispositivo-volver');
      expect(byId('aviso-dispositivo-fui-yo')).not.toBeNull();
      await clic('aviso-dispositivo-no-fui-yo');
      expect(reportDeviceNotMe).toHaveBeenCalledWith('d-1');
    });
  });
});
