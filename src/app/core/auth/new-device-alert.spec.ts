import { TestBed } from '@angular/core/testing';

import { NewDeviceAlert } from './new-device-alert';

describe('NewDeviceAlert', () => {
  it('arranca sin aviso, lo muestra y lo apaga', () => {
    const alerta = TestBed.inject(NewDeviceAlert);
    expect(alerta.notice()).toBeNull();
    alerta.show({ deviceId: 'd-1', label: 'Chrome en Windows', occurredAt: new Date('2026-10-30T09:00:00Z') });
    expect(alerta.notice()?.deviceId).toBe('d-1');
    alerta.dismiss();
    expect(alerta.notice()).toBeNull();
  });
});
