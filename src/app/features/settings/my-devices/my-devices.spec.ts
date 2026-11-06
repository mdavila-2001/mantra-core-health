import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccountSecurityClient } from '../../../core/data-access/iam/account-security.client';
import type { MyDevice } from '../../../core/data-access/iam/iam-new-device';
import { MyDevices } from './my-devices';

const DEVICES: readonly MyDevice[] = [
  { id: 'd-1', name: 'Chrome en Windows', platform: 'WEB', trusted: false, current: true, activeSessions: 1, createdAt: new Date('2026-11-01T10:00:00Z'), lastSeenAt: new Date('2026-11-04T09:00:00Z') },
  { id: 'd-2', name: 'Safari en iOS', platform: 'IOS', trusted: true, current: false, activeSessions: 0, createdAt: new Date('2026-10-01T10:00:00Z') },
  { id: 'd-3', name: 'Chrome en Android', trusted: true, current: false, activeSessions: 0, createdAt: new Date('2026-10-01T10:00:00Z') },
];

describe('MyDevices', () => {
  let fixture: ComponentFixture<MyDevices>;
  let listMyDevices: ReturnType<typeof vi.fn>;
  let requestDeviceCode: ReturnType<typeof vi.fn>;
  let confirmDevice: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string, root: ParentNode = host()): HTMLElement | null => root.querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const click = async (id: string, root?: ParentNode): Promise<void> => {
    byId(id, root)!.click();
    await settle();
  };
  const type = async (id: string, value: string): Promise<void> => {
    const input = (byId(id)!.querySelector('input') ?? byId(id)) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  beforeEach(async () => {
    listMyDevices = vi.fn(() => of(DEVICES));
    requestDeviceCode = vi.fn(() => of({ sent: true, sentTo: 'l***@alovida.bo' }));
    confirmDevice = vi.fn(() => of({ confirmed: true, deviceId: 'd-1' }));
    TestBed.configureTestingModule({
      providers: [{ provide: AccountSecurityClient, useValue: { listMyDevices, requestDeviceCode, confirmDevice } }],
    });
    fixture = TestBed.createComponent(MyDevices);
    fixture.detectChanges();
    await settle();
  });

  it('lists the devices with the current one and their verification state', () => {
    const first = byId('device-d-1')!;
    expect(first.textContent).toContain('Chrome en Windows');
    expect(first.textContent).toContain('Este dispositivo');
    expect(byId('device-estado', first)!.textContent).toContain('Sin verificar');
    expect(byId('device-estado', byId('device-d-2')!)!.textContent).toContain('Verificado');
    expect(byId('device-verificar', byId('device-d-2')!)).toBeNull();
  });

  it('verifies a device with the e-mailed code and reloads the list from the API', async () => {
    await click('device-verificar', byId('device-d-1')!);
    await click('device-verify-enviar');
    expect(requestDeviceCode).toHaveBeenCalledWith('d-1');
    expect(byId('device-verify-enviado')!.textContent).toContain('l***@alovida.bo');

    listMyDevices.mockReturnValueOnce(of([{ ...DEVICES[0], trusted: true }, DEVICES[1]]));
    await type('device-verify-codigo', '1234 5678');
    await click('device-verify-confirmar');

    expect(confirmDevice).toHaveBeenCalledWith('d-1', '12345678');
    expect(listMyDevices).toHaveBeenCalledTimes(2);
    expect(byId('device-verify')).toBeNull();
    expect(byId('device-estado', byId('device-d-1')!)!.textContent).toContain('Verificado');
  });

  it('does not send a malformed code and says why a wrong one failed', async () => {
    await click('device-verificar', byId('device-d-1')!);
    await click('device-verify-enviar');
    await type('device-verify-codigo', '123');
    await click('device-verify-confirmar');
    expect(confirmDevice).not.toHaveBeenCalled();

    confirmDevice.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 422, error: { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'DEVICE_CONFIRM_CODE_INVALID' }, timestamp: '', path: '' } })),
    );
    await type('device-verify-codigo', '00000000');
    await click('device-verify-confirmar');
    expect(byId('device-verify-fallo')!.textContent).toContain('El código no es correcto');
  });

  it('offers a retry when the list cannot be loaded', async () => {
    listMyDevices.mockReturnValueOnce(throwError(() => new Error('offline')));
    fixture = TestBed.createComponent(MyDevices);
    fixture.detectChanges();
    await settle();
    expect(byId('my-devices-retry')).not.toBeNull();
    await click('my-devices-retry');
    expect(byId('device-d-1')).not.toBeNull();
  });

  it('draws one icon per device: a phone for mobile, a screen for the rest', () => {
    const icon = (id: string): string => {
      const icons = byId(id)!.querySelectorAll('app-nav-icon');
      expect(icons.length).toBe(1);
      return icons[0].innerHTML;
    };
    // d-2 declares IOS; d-3 has no platform and is told apart by its name.
    expect(icon('device-d-3')).toBe(icon('device-d-2'));
    expect(icon('device-d-1')).not.toBe(icon('device-d-2'));
  });
});
