import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationConnection } from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import {
  IntegrationSystem,
  NO_SYSTEM_TEXT,
  PROBE_OK_TEXT,
  SAVE_UNAVAILABLE_TEXT,
  SERVER_SYSTEM_TEXT,
} from './integration-system';

/**
 * El sistema de la farmacia de una conexión (FAR-C9 · C9-4): cargarlo con su
 * clave, que la API prueba antes de guardar; ver sus datos sin la clave;
 * probarlo; cambiarlo pidiendo la clave otra vez; y quitarlo con confirmación.
 */
const PHARMACY = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';
const BASE: IntegrationConnection = {
  id: 'c1f20f08-4bbf-47f2-8e8e-7a238cde42ba',
  pharmacySiteId: null,
  siteName: null,
  integrationMode: 'BATCH',
  supportsStockQuery: true,
  status: 'ACTIVE',
  providerConfigured: false,
  system: null,
  createdAt: '2026-10-30T02:51:26.935Z',
};
const WITH_SYSTEM: IntegrationConnection = {
  ...BASE,
  providerConfigured: true,
  system: {
    format: 'SIMULATED_CHAIN',
    baseUrl: 'http://simulador:4100/simulated-chain/api/v2',
    externalPharmacyCode: 'CHAIN-1',
    apiKeyConfigured: true,
    configuredAt: '2026-11-01T04:19:57.180Z',
  },
};
const SYSTEM_URL = `/pharmacies/${PHARMACY}/integration-connections/${BASE.id}/external-system`;

describe('IntegrationSystem', () => {
  let fixture: ComponentFixture<IntegrationSystem>;
  let http: HttpTestingController;
  let confirm: ReturnType<typeof vi.spyOn>;
  let changed: number;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const text = (id: string): string => byTestId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const button = (id: string): HTMLButtonElement =>
    (byTestId(id)?.querySelector('button') ?? byTestId(id)) as HTMLButtonElement;

  function type(id: string, value: string): void {
    const field = root().querySelector(`input[data-testid="${id}"]`) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const value = (id: string): string =>
    (root().querySelector(`input[data-testid="${id}"]`) as HTMLInputElement | null)?.value ?? '';

  function mount(connection: IntegrationConnection): void {
    fixture = TestBed.createComponent(IntegrationSystem);
    fixture.componentRef.setInput('pharmacyId', PHARMACY);
    fixture.componentRef.setInput('connection', connection);
    changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    fixture.detectChanges();
  }

  function fill(): void {
    type('integration-system-url', ' http://simulador:4100/alovida-standard ');
    type('integration-system-code', 'FARM-1');
    type('integration-system-key', 'k-secreta');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('sin sistema ni del servidor: el formulario y que hace falta cargarlo', () => {
    mount(BASE);
    expect(byTestId('integration-system-form')).not.toBeNull();
    expect(text('integration-system-none')).toBe(NO_SYSTEM_TEXT);
  });

  it('sin sistema propio pero con el del servidor: lo dice', () => {
    mount({ ...BASE, providerConfigured: true });
    expect(text('integration-system-none')).toBe(SERVER_SYSTEM_TEXT);
  });

  it('no manda nada con campos vacíos y marca cuáles faltan', () => {
    mount(BASE);
    button('integration-system-save').click();
    fixture.detectChanges();
    http.expectNone((r) => r.url === SYSTEM_URL);
    expect(root().textContent).toContain('Escriba la dirección del sistema.');
    expect(root().textContent).toContain('Escriba la clave.');
  });

  it('«Guardar y probar» manda la clave solo en el cuerpo y pide releer la conexión', () => {
    mount(BASE);
    fill();
    button('integration-system-save').click();
    const request = http.expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL);
    expect(request.request.body).toEqual({
      format: 'ALOVIDA_STANDARD',
      baseUrl: 'http://simulador:4100/alovida-standard',
      externalPharmacyCode: 'FARM-1',
      apiKey: 'k-secreta',
    });
    expect(request.request.urlWithParams).not.toContain('k-secreta');
    request.flush({ system: WITH_SYSTEM.system, probe: 'OK' });
    fixture.detectChanges();
    expect(changed).toBe(1);
    // La clave no queda en el estado después de guardar.
    expect(value('integration-system-key')).toBe('');
  });

  it('si el sistema no responde con esa clave, lo dice y conserva lo escrito', () => {
    mount(BASE);
    fill();
    button('integration-system-save').click();
    http
      .expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL)
      .flush(
        { code: 'DEPENDENCY_UNAVAILABLE', reason: 'PHARMACY_INTEGRATION_UNAVAILABLE', correlationId: 'req-9' },
        { status: 502, statusText: 'Bad Gateway' },
      );
    fixture.detectChanges();
    expect(text('integration-system-error')).toContain(SAVE_UNAVAILABLE_TEXT);
    expect(text('integration-system-error')).toContain('(petición req-9)');
    expect((root().querySelector('input[data-testid="integration-system-key"]') as HTMLInputElement).value).toBe(
      'k-secreta',
    );
    expect(changed).toBe(0);
  });

  it('una dirección que la plataforma no llama se explica', () => {
    mount(BASE);
    fill();
    button('integration-system-save').click();
    http
      .expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL)
      .flush({ reason: 'PHARMACY_INTEGRATION_HOST_NOT_ALLOWED' }, { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();
    expect(text('integration-system-error')).toContain('no tiene permitido llamar a esa dirección');
  });

  it('con sistema: sus datos, sin la clave', () => {
    mount(WITH_SYSTEM);
    expect(byTestId('integration-system-form')).toBeNull();
    const shown = root().textContent ?? '';
    expect(shown).toContain('Cadena simulada');
    expect(shown).toContain('http://simulador:4100/simulated-chain/api/v2');
    expect(shown).toContain('CHAIN-1');
    expect(shown).toContain('Guardada');
  });

  it('«Probar conexión» dice quién respondió', () => {
    mount(WITH_SYSTEM);
    button('integration-system-probe').click();
    http
      .expectOne((r) => r.method === 'POST' && r.url === `${SYSTEM_URL}/test`)
      .flush({ status: 'OK', source: 'PHARMACY' });
    fixture.detectChanges();
    expect(text('integration-system-probe-ok')).toContain(PROBE_OK_TEXT);
  });

  it('«Cambiar» trae lo guardado menos la clave, que hay que escribir otra vez', () => {
    mount(WITH_SYSTEM);
    button('integration-system-edit').click();
    fixture.detectChanges();
    expect((root().querySelector('input[data-testid="integration-system-url"]') as HTMLInputElement).value).toBe(
      'http://simulador:4100/simulated-chain/api/v2',
    );
    expect((root().querySelector('input[data-testid="integration-system-key"]') as HTMLInputElement).value).toBe('');
    button('integration-system-save').click();
    fixture.detectChanges();
    http.expectNone((r) => r.url === SYSTEM_URL);
    button('integration-system-cancel').click();
    fixture.detectChanges();
    expect(byTestId('integration-system-form')).toBeNull();
  });

  it('«Quitar» confirma, borra con DELETE y pide releer', async () => {
    mount(WITH_SYSTEM);
    button('integration-system-remove').click();
    await fixture.whenStable();
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true, confirmLabel: 'Quitar' }));
    http.expectOne((r) => r.method === 'DELETE' && r.url === SYSTEM_URL).flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();
    expect(changed).toBe(1);
  });

  it('si no confirma, no quita nada', async () => {
    confirm.mockResolvedValue(false);
    mount(WITH_SYSTEM);
    button('integration-system-remove').click();
    await fixture.whenStable();
    http.expectNone((r) => r.url === SYSTEM_URL);
    expect(changed).toBe(0);
  });

  it('una dirección inválida se explica (400)', () => {
    mount(BASE);
    fill();
    button('integration-system-save').click();
    http
      .expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL)
      .flush({ reason: 'PHARMACY_INTEGRATION_URL_INVALID' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(text('integration-system-error')).toContain('La dirección no es válida');
  });

  it('si «Probar conexión» falla, lo dice con el ID de la petición', () => {
    mount(WITH_SYSTEM);
    button('integration-system-probe').click();
    http
      .expectOne((r) => r.method === 'POST' && r.url === `${SYSTEM_URL}/test`)
      .flush(
        { reason: 'PHARMACY_INTEGRATION_UNAVAILABLE', correlationId: 'req-7' },
        { status: 502, statusText: 'Bad Gateway' },
      );
    fixture.detectChanges();
    expect(text('integration-system-error')).toContain('No pudimos hablar con el sistema de la farmacia');
    expect(text('integration-system-error')).toContain('req-7');
    expect(byTestId('integration-system-probe-ok')).toBeNull();
  });

  it('si «Quitar» falla, lo dice y no pide releer', async () => {
    mount(WITH_SYSTEM);
    button('integration-system-remove').click();
    await fixture.whenStable();
    http
      .expectOne((r) => r.method === 'DELETE' && r.url === SYSTEM_URL)
      .flush({ code: 'INTERNAL', correlationId: 'req-8' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text('integration-system-error')).not.toBe('');
    expect(changed).toBe(0);
  });

  it('otra conexión: borra lo escrito y el error', () => {
    mount(BASE);
    fill();
    button('integration-system-save').click();
    http
      .expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL)
      .flush({ reason: 'PHARMACY_INTEGRATION_HOST_NOT_ALLOWED' }, { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();
    expect(byTestId('integration-system-error')).not.toBeNull();

    fixture.componentRef.setInput('connection', { ...BASE, id: 'otra-conexion' });
    fixture.detectChanges();
    expect(value('integration-system-url')).toBe('');
    expect(value('integration-system-key')).toBe('');
    expect(byTestId('integration-system-error')).toBeNull();
  });

  it('la misma conexión releída (otro objeto) no borra lo que se está escribiendo', () => {
    mount(BASE);
    fill();
    fixture.componentRef.setInput('connection', { ...BASE });
    fixture.detectChanges();
    // `type="url"` limpia los espacios del borde al redibujar; lo escrito sigue ahí.
    expect(value('integration-system-url').trim()).toBe('http://simulador:4100/alovida-standard');
    expect(value('integration-system-key')).toBe('k-secreta');
  });

  it('cambiar de conexión con un guardado en vuelo lo corta: su respuesta no cae sobre la otra', () => {
    mount(BASE);
    fill();
    button('integration-system-save').click();
    const request = http.expectOne((r) => r.method === 'PUT' && r.url === SYSTEM_URL);

    fixture.componentRef.setInput('connection', { ...BASE, id: 'otra-conexion' });
    fixture.detectChanges();

    expect(request.cancelled).toBe(true);
    expect(byTestId('integration-system-save')?.getAttribute('aria-busy')).not.toBe('true');
    expect(byTestId('integration-system-error')).toBeNull();
    expect(changed).toBe(0);
  });
});
