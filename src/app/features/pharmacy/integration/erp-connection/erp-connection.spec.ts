import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { FormGroup } from '@angular/forms';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ErpConnection } from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { PharmacyErpConnection } from './erp-connection';

const BASE = '/pharmacies/pharmacy/erp-connection';
const CONNECTION: ErpConnection = {
  pharmacyId: 'pharmacy',
  mode: 'CONNECTED',
  status: 'ACTIVE',
  errorReason: null,
  checkedAt: null,
  systemCode: 'ALOVIDA_STANDARD',
  baseUrl: 'http://127.0.0.1:4100/alovida-standard',
  pharmacyCode: 'FARM-1',
  keyHint: '••••1234',
  encryptionConfigured: true,
  integrationConnectionId: 'connection',
  sites: [{ siteId: 'site', siteName: 'Centro', platformCode: 'CENTRO', externalCode: 'SUC-1' }],
};

describe('PharmacyErpConnection (component with HTTP test doubles)', () => {
  let fixture: ComponentFixture<PharmacyErpConnection>;
  let http: HttpTestingController;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const form = (): FormGroup => (fixture.componentInstance as unknown as { form: FormGroup }).form;
  const click = (label: string) => {
    const button = [...root().querySelectorAll('button')].find(
      (element) => element.textContent?.trim() === label,
    );
    expect(button).toBeDefined();
    button!.click();
    fixture.detectChanges();
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PharmacyErpConnection);
    fixture.componentRef.setInput('pharmacyId', 'pharmacy');
    fixture.detectChanges();
    http.expectOne(BASE).flush(CONNECTION);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('shows a masked key and does not confuse ACTIVE with a successful check', () => {
    expect(root().textContent).toContain('••••1234');
    expect(root().textContent).toContain('sin comprobar');
    expect(root().querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe('');
  });
  it('requires testing the edited draft before saving', () => {
    click('Guardar');
    expect(root().textContent).toContain('Pruebe la conexión con estos datos');
    http.expectNone((request) => request.method === 'PUT');
  });
  it.each([
    'http://user:synthetic@farmacia.test/std',
    'http://farmacia.test/std?apiKey=synthetic',
    'http://farmacia.test/std#synthetic',
  ])('rejects credentials or secret-bearing URL components before HTTP: %s', (baseUrl) => {
    form().patchValue({ baseUrl });
    click('Probar conexión');
    expect(root().textContent).toContain('sin credenciales, consulta ni fragmento');
    http.expectNone((request) => request.method === 'POST' || request.method === 'PUT');
  });
  it('tests, saves without exposing the stored key, and reloads canonical configuration', () => {
    click('Probar conexión');
    const test = http.expectOne(`${BASE}/test`);
    expect(test.request.body).not.toHaveProperty('apiKey');
    test.flush({ result: 'OK' });
    fixture.detectChanges();
    click('Guardar');
    const save = http.expectOne(BASE);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body.siteCodes).toEqual([{ siteId: 'site', externalCode: 'SUC-1' }]);
    expect(save.request.body).not.toHaveProperty('apiKey');
    save.flush(CONNECTION);
    fixture.detectChanges();
    click('Volver a cargar');
    http.expectOne(BASE).flush(CONNECTION);
    fixture.detectChanges();
    expect(form().get('apiKey')?.value).toBe('');
  });
  it.each(['AUTH_REJECTED', 'UNREACHABLE'] as const)(
    'describes %s without marking the draft as tested',
    (result) => {
      click('Probar conexión');
      http.expectOne(`${BASE}/test`).flush({ result });
      fixture.detectChanges();
      expect(root().textContent).toContain(
        result === 'AUTH_REJECTED' ? 'Clave rechazada' : 'No responde',
      );
      click('Guardar');
      http.expectNone((request) => request.method === 'PUT');
    },
  );
  it('invalidates the successful check after a destination change', () => {
    click('Probar conexión');
    http.expectOne(`${BASE}/test`).flush({ result: 'OK' });
    form().patchValue({ baseUrl: 'http://127.0.0.1:4101' });
    fixture.detectChanges();
    click('Guardar');
    http.expectNone((request) => request.method === 'PUT');
  });
  it('switches to manual without replacing credentials', () => {
    form().patchValue({ mode: 'MANUAL' });
    click('Guardar');
    const request = http.expectOne(BASE);
    expect(request.request.body).toEqual({ mode: 'MANUAL' });
    request.flush({ ...CONNECTION, mode: 'MANUAL', status: 'MANUAL' });
  });
  it('checking saved configuration does not discard edits', () => {
    form().patchValue({ pharmacyCode: 'EDITED' });
    click('Probar conexión guardada');
    http.expectOne(`${BASE}/test-saved`).flush({ result: 'OK', connection: CONNECTION });
    expect(form().get('pharmacyCode')?.value).toBe('EDITED');
  });

  it('publishes the ERP link on reload so mappings use the same connection', () => {
    const links: (string | null)[] = [];
    fixture.componentInstance.connectionLoaded.subscribe((id) => links.push(id));
    click('Volver a cargar');
    http.expectOne(BASE).flush(CONNECTION);
    expect(links).toEqual(['connection']);
  });
  it('clears resource data and the draft secret when authorization is denied', () => {
    form().patchValue({ apiKey: 'synthetic-secret' });
    click('Probar conexión');
    http
      .expectOne(`${BASE}/test`)
      .flush({ message: 'Denied' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(root().textContent).not.toContain('••••1234');
    expect(form().get('apiKey')?.value).toBe('');
  });
});
