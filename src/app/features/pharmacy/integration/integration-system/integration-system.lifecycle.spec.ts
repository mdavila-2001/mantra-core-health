import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';

import { BASE, SYSTEM_URL, WITH_SYSTEM, integrationSystemHarness } from '../../../../../testing/pharmacy/integration-system.harness';
import { PROBE_OK_TEXT, REMOVED_TEXT } from './integration-system.texts';

/**
 * El sistema de la farmacia (FAR-C9 · C9-4), ya guardado: sus datos sin la clave,
 * probar, cambiar y quitar; y qué pasa con lo escrito y lo que está en vuelo al
 * cambiar de conexión.
 */
describe('IntegrationSystem · con sistema y al cambiar de conexión', () => {
  const h = integrationSystemHarness();

  it('con sistema: sus datos, sin la clave', () => {
    h.mount(WITH_SYSTEM);
    expect(h.byTestId('integration-system-form')).toBeNull();
    const shown = h.root().textContent ?? '';
    expect(shown).toContain('Cadena simulada');
    expect(shown).toContain('http://simulador:4100/simulated-chain/api/v2');
    expect(shown).toContain('CHAIN-1');
    expect(shown).toContain('Guardada');
  });

  it('«Probar conexión» dice quién respondió', () => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-probe').click();
    h.http
      .expectOne((r) => r.method === 'POST' && r.url === `${SYSTEM_URL}/test`)
      .flush({ status: 'OK', source: 'PHARMACY' });
    h.fixture.detectChanges();
    expect(h.text('integration-system-probe-ok')).toContain(PROBE_OK_TEXT);
  });

  it('«Cambiar» trae lo guardado menos la clave, que hay que escribir otra vez', () => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-edit').click();
    h.fixture.detectChanges();
    expect((h.root().querySelector('input[data-testid="integration-system-url"]') as HTMLInputElement).value).toBe(
      'http://simulador:4100/simulated-chain/api/v2',
    );
    expect((h.root().querySelector('input[data-testid="integration-system-key"]') as HTMLInputElement).value).toBe('');
    h.button('integration-system-save').click();
    h.fixture.detectChanges();
    h.http.expectNone((r) => r.url === SYSTEM_URL);
    h.button('integration-system-cancel').click();
    h.fixture.detectChanges();
    expect(h.byTestId('integration-system-form')).toBeNull();
  });

  it('«Quitar» confirma, borra con DELETE y pide releer', async () => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-remove').click();
    await h.fixture.whenStable();
    expect(h.confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true, confirmLabel: 'Quitar' }));
    h.http.expectOne((r) => r.method === 'DELETE' && r.url === SYSTEM_URL).flush(null, { status: 204, statusText: 'No Content' });
    h.fixture.detectChanges();
    expect(h.changed).toBe(1);
  });

  it('si no confirma, no quita nada', async () => {
    h.confirm.mockResolvedValue(false);
    h.mount(WITH_SYSTEM);
    h.button('integration-system-remove').click();
    await h.fixture.whenStable();
    h.http.expectNone((r) => r.url === SYSTEM_URL);
    expect(h.changed).toBe(0);
  });

  it('si «Probar conexión» falla, lo dice con el ID de la petición', () => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-probe').click();
    h.http
      .expectOne((r) => r.method === 'POST' && r.url === `${SYSTEM_URL}/test`)
      .flush(
        { reason: 'PHARMACY_INTEGRATION_UNAVAILABLE', correlationId: 'req-7' },
        { status: 502, statusText: 'Bad Gateway' },
      );
    h.fixture.detectChanges();
    expect(h.text('integration-system-error')).toContain('No pudimos hablar con el sistema de la farmacia');
    expect(h.text('integration-system-error')).toContain('req-7');
    expect(h.byTestId('integration-system-probe-ok')).toBeNull();
  });

  it('si «Quitar» falla, lo dice y no pide releer', async () => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-remove').click();
    await h.fixture.whenStable();
    h.http
      .expectOne((r) => r.method === 'DELETE' && r.url === SYSTEM_URL)
      .flush({ code: 'INTERNAL', correlationId: 'req-8' }, { status: 500, statusText: 'Server Error' });
    h.fixture.detectChanges();
    expect(h.text('integration-system-error')).not.toBe('');
    expect(h.changed).toBe(0);
  });

  it('otra conexión: borra lo escrito y el error', () => {
    h.mount(BASE);
    h.fill();
    h.button('integration-system-save').click();
    h.http
      .expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL)
      .flush({ reason: 'PHARMACY_INTEGRATION_HOST_NOT_ALLOWED' }, { status: 422, statusText: 'Unprocessable' });
    h.fixture.detectChanges();
    expect(h.byTestId('integration-system-error')).not.toBeNull();

    h.fixture.componentRef.setInput('connection', { ...BASE, id: 'otra-conexion' });
    h.fixture.detectChanges();
    expect(h.value('integration-system-url')).toBe('');
    expect(h.value('integration-system-key')).toBe('');
    expect(h.byTestId('integration-system-error')).toBeNull();
  });

  it('la misma conexión releída (otro objeto) no borra lo que se está escribiendo', () => {
    h.mount(BASE);
    h.fill();
    h.fixture.componentRef.setInput('connection', { ...BASE });
    h.fixture.detectChanges();
    // `type="url"` limpia los espacios del borde al redibujar; lo escrito sigue ahí.
    expect(h.value('integration-system-url').trim()).toBe('http://simulador:4100/alovida-standard');
    expect(h.value('integration-system-key')).toBe('k-secreta');
  });

  it('cambiar de conexión con un guardado en vuelo lo corta: su respuesta no cae sobre la otra', () => {
    h.mount(BASE);
    h.fill();
    h.button('integration-system-save').click();
    const request = h.http.expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL);

    h.fixture.componentRef.setInput('connection', { ...BASE, id: 'otra-conexion' });
    h.fixture.detectChanges();

    expect(request.cancelled).toBe(true);
    expect(h.byTestId('integration-system-save')?.getAttribute('aria-busy')).not.toBe('true');
    expect(h.byTestId('integration-system-error')).toBeNull();
    // El PUT pudo aplicarse en la API aunque se cortó: la pestaña relee.
    expect(h.changed).toBe(1);
  });

  it('cortar una prueba en vuelo no pide releer: probar no cambia nada', () => {
    h.mount(WITH_SYSTEM);
    h.button('integration-system-probe').click();
    const request = h.http.expectOne((r) => r.method === 'POST' && r.url === `${SYSTEM_URL}/test`);

    h.fixture.componentRef.setInput('connection', { ...WITH_SYSTEM, id: 'otra-conexion' });
    h.fixture.detectChanges();

    expect(request.cancelled).toBe(true);
    expect(h.byTestId('integration-system-probe-ok')).toBeNull();
    expect(h.changed).toBe(0);
  });

  it('guardar y después quitar deja un solo aviso: el nuevo reemplaza al anterior (#1866)', async () => {
    const toasts = TestBed.inject(ToastService);
    h.mount(BASE);
    h.fill();
    h.button('integration-system-save').click();
    h.http
      .expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL)
      .flush({ system: WITH_SYSTEM.system, probe: 'OK' });
    // La pestaña relee y le pasa la conexión con su sistema.
    h.fixture.componentRef.setInput('connection', WITH_SYSTEM);
    h.fixture.detectChanges();

    h.button('integration-system-remove').click();
    await h.fixture.whenStable();
    h.http.expectOne((r) => r.method === 'DELETE' && r.url === SYSTEM_URL).flush(null, { status: 204, statusText: 'No Content' });

    expect(toasts.toasts().map((toast) => toast.message)).toEqual([REMOVED_TEXT]);
  });
});
