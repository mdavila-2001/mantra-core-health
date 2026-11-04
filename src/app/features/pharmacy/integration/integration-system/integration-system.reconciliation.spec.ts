import { describe, expect, it } from 'vitest';
import {
  BASE, SYSTEM_URL, WITH_SYSTEM, integrationSystemHarness,
} from '../../../../../testing/pharmacy/integration-system.harness';
import { SERVER_SYSTEM_TEXT } from './integration-system.texts';

describe('IntegrationSystem · contrato y ámbito reconciliados', () => {
  const h = integrationSystemHarness();
  const system = WITH_SYSTEM.system!;
  const text = () => h.root().textContent ?? '';
  const update = (patch: object) => {
    h.fixture.componentRef.setInput('connection', { ...WITH_SYSTEM, ...patch });
    h.fixture.detectChanges();
  };

  it('histórico configurado conserva estado desconocido y nunca expone una clave', () => {
    h.mount(WITH_SYSTEM);
    expect(h.text('integration-system-last-check')).toContain('no hay una comprobación');
    expect(h.text('integration-system-last-check')).not.toContain('Activa');
    h.button('integration-system-edit').click(); h.fixture.detectChanges();
    expect(h.value('integration-system-key')).toBe('');
    expect(h.root().querySelector('input[type="password"]')).not.toBeNull();
  });

  it.each(['AUTH_REJECTED', 'UNREACHABLE'] as const)('muestra último error %s sin desactivar configuración', (reason) => {
    h.mount({ ...WITH_SYSTEM, system: { ...system, lastCheck: {
      status: 'ERROR', errorReason: reason, checkedAt: '2026-11-01T14:37:00Z',
    } } });
    expect(h.text('integration-system-last-check')).toContain('Con error');
    expect(h.text('integration-system-last-check')).toContain(reason === 'AUTH_REJECTED' ? 'clave rechazada' : 'no responde');
    expect(h.text('integration-system-last-check')).toContain('01/11/2026');
    expect(h.button('integration-system-probe').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('una propuesta fallida conserva resumen/estado y campos no secretos, limpiando clave', () => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-edit').click(); h.fixture.detectChanges(); h.fill();
    h.button('integration-system-save').click();
    h.http.expectOne({ method: 'PUT', url: SYSTEM_URL }).flush({
      reason: 'PHARMACY_INTEGRATION_UNAVAILABLE', correlationId: 'request-synthetic',
      details: { errorReason: 'AUTH_REJECTED' },
    }, { status: 502, statusText: 'Bad Gateway' });
    h.fixture.detectChanges();
    expect(text()).toContain(system.baseUrl);
    expect(h.text('integration-system-last-check')).toContain('no hay una comprobación');
    expect(h.text('integration-system-error')).toContain('rechazó la clave');
    expect(h.text('integration-system-error')).toContain('request-synthetic');
    expect(h.value('integration-system-code')).toBe('FARM-1');
    expect(h.value('integration-system-key')).toBe('');
    expect(h.changed).toBe(0);
  });

  it('una relectura de lastCheck no borra el borrador ni lo presenta como guardado', () => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-edit').click(); h.fixture.detectChanges(); h.fill();
    update({ system: { ...system, lastCheck: {
      status: 'ACTIVE', errorReason: null, checkedAt: '2026-11-01T14:37:00Z',
    } } });
    expect(h.value('integration-system-code')).toBe('FARM-1');
    expect(h.value('integration-system-key')).toBe('k-secreta');
    expect(h.text('integration-system-last-check')).toContain('Activa');
    expect(text()).toContain(system.externalPharmacyCode);
  });

  it.each(['pharmacy', 'connection', 'credential'])('cambio de %s cancela prueba previa y limpia clave', (scope) => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-probe').click();
    const request = h.http.expectOne({ method: 'POST', url: `${SYSTEM_URL}/test` });
    expect(request.request.body).toEqual({});
    if (scope === 'pharmacy') h.fixture.componentRef.setInput('pharmacyId', 'other-pharmacy');
    else if (scope === 'connection') h.fixture.componentRef.setInput('connection', { ...WITH_SYSTEM, id: 'other' });
    else h.fixture.componentRef.setInput('connection', { ...WITH_SYSTEM, system: { ...system, configuredAt: '2026-11-02T00:00:00Z' } });
    h.fixture.detectChanges();
    expect(request.cancelled).toBe(true);
    expect(h.byTestId('integration-system-probe-ok')).toBeNull();
    h.button('integration-system-edit').click(); h.fixture.detectChanges();
    expect(h.value('integration-system-key')).toBe('');
  });

  it('un diálogo abierto no quita una configuración reemplazada mientras esperaba', async () => {
    let confirm!: (answer: boolean) => void;
    h.confirm.mockImplementation(() => new Promise<boolean>((resolve) => { confirm = resolve; }));
    h.mount(WITH_SYSTEM);
    h.button('integration-system-remove').click();
    update({ system: { ...system, configuredAt: '2026-11-02T00:00:00Z' } });
    confirm(true); await h.fixture.whenStable();
    h.http.expectNone({ method: 'DELETE', url: SYSTEM_URL });
    expect(h.changed).toBe(0);
  });

  it.each([401, 403, 404])('el error de acceso %s usa estados M34 y oculta configuración', (status) => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-probe').click();
    h.http.expectOne({ method: 'POST', url: `${SYSTEM_URL}/test` }).flush({
      code: status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'UNAUTHENTICATED',
      message: 'Mensaje sintético', correlationId: 'access-request',
    }, { status, statusText: 'Access denied' });
    h.fixture.detectChanges();
    expect(text()).not.toContain(system.baseUrl);
    expect(h.byTestId('integration-system-save')).toBeNull();
    expect(h.byTestId('integration-system-probe')).toBeNull();
  });

  it.each(['ftp://system.test', 'https://user:password@system.test', 'https://system.test?secret=x'])('la dirección %s no se envía', (url) => {
    h.mount(BASE); h.fill(); h.type('integration-system-url', url);
    h.button('integration-system-save').click(); h.fixture.detectChanges();
    h.http.expectNone({ method: 'PUT', url: SYSTEM_URL });
    expect(text()).toContain('sin credenciales, consulta ni fragmento');
  });

  it('sin sistema propio distingue sincronización del servidor y confirmación manual de pedidos', () => {
    h.mount({ ...BASE, providerConfigured: true });
    expect(h.text('integration-system-none')).toBe(SERVER_SYSTEM_TEXT);
    expect(h.text('integration-system-manual')).toContain('confirmación manual');
  });
});
