import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../data-access/api';
import { OnboardingDraftService } from './onboarding-draft.service';

describe('OnboardingDraftService', () => {
  let service: OnboardingDraftService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    service = TestBed.inject(OnboardingDraftService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.clear();
    http.verify();
  });

  it('genera y persiste un draftId para el tipo de formulario', () => {
    const id1 = service.getOrCreateDraftId('patient');
    expect(id1).toBeTruthy();
    const id2 = service.getOrCreateDraftId('patient');
    expect(id2).toBe(id1);
  });

  it('la telemetría no explota sin crypto.randomUUID (HTTP sin TLS)', () => {
    vi.useFakeTimers();
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: original.getRandomValues.bind(original) });
    expect(() => service.trackEvent('start', 'patient', 0)).not.toThrow();
    vi.advanceTimersByTime(1000);
    http.expectOne((r) => r.method === 'POST').flush({});
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('la telemetría no lleva el draftId del borrador', () => {
    vi.useFakeTimers();
    const draftId = service.getOrCreateDraftId('patient');
    service.trackEvent('start', 'patient', 0);
    vi.advanceTimersByTime(1000);
    const req = http.expectOne((r) => r.method === 'POST' && r.body !== undefined);
    const enviado = JSON.stringify(req.request.body);
    expect(enviado).not.toContain(draftId);
    req.flush({});
    vi.useRealTimers();
  });

  it('guarda el borrador en localStorage y lo detecta', () => {
    expect(service.detectDraft('patient')).toBeNull();

    service.saveProgress(
      'patient',
      1,
      'contacto',
      'Datos de contacto',
      { name: 'Juan', password: 'secret-password-should-not-be-saved' },
      undefined,
      4,
    );

    const detectado = service.detectDraft('patient');
    expect(detectado).not.toBeNull();
    expect(detectado?.stepIndex).toBe(1);
    expect(detectado?.stepKey).toBe('contacto');
    expect(detectado?.data['name']).toBe('Juan');
    // La contraseña nunca se persiste en el borrador
    expect(detectado?.data['password']).toBeUndefined();
  });

  it('elimina el borrador al invocar clearDraft', () => {
    service.saveProgress('patient', 0, 'inicio', 'Paso 1', { name: 'Juan' });
    expect(service.detectDraft('patient')).not.toBeNull();

    service.clearDraft('patient', { immediate: true });
    expect(service.detectDraft('patient')).toBeNull();

    const req = http.expectOne((r) => r.method === 'DELETE' && r.url.includes('/iam/onboarding-drafts/patient/'));
    req.flush({ ok: true });
  });
});
