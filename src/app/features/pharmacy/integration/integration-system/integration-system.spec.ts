import { describe, expect, it } from 'vitest';

import { BASE, SYSTEM_URL, WITH_SYSTEM, integrationSystemHarness } from '../../../../../testing/pharmacy/integration-system.harness';
import { NO_SYSTEM_TEXT, SAVE_UNAVAILABLE_TEXT, SERVER_SYSTEM_TEXT } from './integration-system.texts';

/**
 * El sistema de la farmacia (FAR-C9 · C9-4), sin sistema guardado: el formulario, la
 * clave solo en el cuerpo, la prueba antes de guardar y cada error de la API.
 */
describe('IntegrationSystem · cargar el sistema', () => {
  const h = integrationSystemHarness();

  it('sin sistema ni del servidor: el formulario y que hace falta cargarlo', () => {
    h.mount(BASE);
    expect(h.byTestId('integration-system-form')).not.toBeNull();
    expect(h.text('integration-system-none')).toBe(NO_SYSTEM_TEXT);
  });

  it('sin sistema propio pero con el del servidor: lo dice', () => {
    h.mount({ ...BASE, providerConfigured: true });
    expect(h.text('integration-system-none')).toBe(SERVER_SYSTEM_TEXT);
  });

  it('no manda nada con campos vacíos y marca cuáles faltan', () => {
    h.mount(BASE);
    h.button('integration-system-save').click();
    h.fixture.detectChanges();
    h.http.expectNone((r) => r.url === SYSTEM_URL);
    expect(h.root().textContent).toContain('Escriba la dirección del sistema.');
    expect(h.root().textContent).toContain('Escriba la clave.');
  });

  it('«Guardar y probar» manda la clave solo en el cuerpo y pide releer la conexión', () => {
    h.mount(BASE);
    h.fill();
    h.button('integration-system-save').click();
    const request = h.http.expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL);
    expect(request.request.body).toEqual({
      format: 'ALOVIDA_STANDARD',
      baseUrl: 'http://simulador:4100/alovida-standard',
      externalPharmacyCode: 'FARM-1',
      apiKey: 'k-secreta',
    });
    expect(request.request.urlWithParams).not.toContain('k-secreta');
    request.flush({ system: WITH_SYSTEM.system, probe: 'OK' });
    h.fixture.detectChanges();
    expect(h.changed).toBe(1);
    // La clave no queda en el estado después de guardar.
    expect(h.value('integration-system-key')).toBe('');
  });

  it('si el sistema no responde con esa clave, lo dice y conserva lo escrito', () => {
    h.mount(BASE);
    h.fill();
    h.button('integration-system-save').click();
    h.http
      .expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL)
      .flush(
        { code: 'DEPENDENCY_UNAVAILABLE', reason: 'PHARMACY_INTEGRATION_UNAVAILABLE', correlationId: 'req-9' },
        { status: 502, statusText: 'Bad Gateway' },
      );
    h.fixture.detectChanges();
    expect(h.text('integration-system-error')).toContain(SAVE_UNAVAILABLE_TEXT);
    expect(h.text('integration-system-error')).toContain('(petición req-9)');
    expect((h.root().querySelector('input[data-testid="integration-system-key"]') as HTMLInputElement).value).toBe(
      'k-secreta',
    );
    expect(h.changed).toBe(0);
  });

  it('una dirección que la plataforma no llama se explica', () => {
    h.mount(BASE);
    h.fill();
    h.button('integration-system-save').click();
    h.http
      .expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL)
      .flush({ reason: 'PHARMACY_INTEGRATION_HOST_NOT_ALLOWED' }, { status: 422, statusText: 'Unprocessable' });
    h.fixture.detectChanges();
    expect(h.text('integration-system-error')).toContain('no tiene permitido llamar a esa dirección');
  });

  it('una dirección inválida se explica (400)', () => {
    h.mount(BASE);
    h.fill();
    h.button('integration-system-save').click();
    h.http
      .expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL)
      .flush({ reason: 'PHARMACY_INTEGRATION_URL_INVALID' }, { status: 400, statusText: 'Bad Request' });
    h.fixture.detectChanges();
    expect(h.text('integration-system-error')).toContain('La dirección no es válida');
  });
});
