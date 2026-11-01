import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, vi } from 'vitest';

import type { IntegrationConnection } from '../../app/core/data-access/pharmacy/pharmacy-integration.types';
import { IntegrationSystem } from '../../app/features/pharmacy/integration/integration-system/integration-system';
import { DialogService } from '../../app/shared/components/molecules/dialog/dialog-service';

/**
 * Lo que comparten las pruebas de «Sistema de la farmacia» (FAR-C9 · C9-4):
 * dos conexiones de ejemplo y el armado del componente con la API simulada.
 * Vive aparte para que cada spec quede por debajo de las 300 líneas.
 */
export const PHARMACY = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';

export const BASE: IntegrationConnection = {
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

export const WITH_SYSTEM: IntegrationConnection = {
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

export const SYSTEM_URL = `/pharmacies/${PHARMACY}/integration-connections/${BASE.id}/external-system`;

/** El banco de pruebas: registra `beforeEach`/`afterEach` y devuelve los ayudantes. */
export function integrationSystemHarness() {
  let fixture: ComponentFixture<IntegrationSystem>;
  let http: HttpTestingController;
  let confirm: ReturnType<typeof vi.spyOn>;
  let changed = 0;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const input = (id: string): HTMLInputElement | null =>
    root().querySelector(`input[data-testid="${id}"]`) as HTMLInputElement | null;

  const harness = {
    get fixture(): ComponentFixture<IntegrationSystem> {
      return fixture;
    },
    get http(): HttpTestingController {
      return http;
    },
    get confirm(): ReturnType<typeof vi.spyOn> {
      return confirm;
    },
    /** Cuántas veces el componente pidió releer la conexión. */
    get changed(): number {
      return changed;
    },
    root,
    byTestId,
    text: (id: string): string => byTestId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    button: (id: string): HTMLButtonElement =>
      (byTestId(id)?.querySelector('button') ?? byTestId(id)) as HTMLButtonElement,
    value: (id: string): string => input(id)?.value ?? '',
    /** Escribe en un campo como una persona: evento `input` sobre el `<input>` real. */
    type(id: string, value: string): void {
      const field = input(id) as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    },
    mount(connection: IntegrationConnection): void {
      fixture = TestBed.createComponent(IntegrationSystem);
      fixture.componentRef.setInput('pharmacyId', PHARMACY);
      fixture.componentRef.setInput('connection', connection);
      changed = 0;
      fixture.componentInstance.changed.subscribe(() => changed++);
      fixture.detectChanges();
    },
    fill(): void {
      harness.type('integration-system-url', ' http://simulador:4100/alovida-standard ');
      harness.type('integration-system-code', 'FARM-1');
      harness.type('integration-system-key', 'k-secreta');
    },
  };
  return harness;
}
