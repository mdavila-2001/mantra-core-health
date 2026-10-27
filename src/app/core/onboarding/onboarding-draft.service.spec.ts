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

  it('elimina el borrador al invocar clearDraft, con el secreto que dio la API', () => {
    service.saveProgress('patient', 0, 'inicio', 'Paso 1', { name: 'Juan' });
    localStorage.setItem('alovida.onboarding.draft_secret.patient', 'secreto-1');
    expect(service.detectDraft('patient')).not.toBeNull();

    service.clearDraft('patient', { immediate: true });
    expect(service.detectDraft('patient')).toBeNull();
    expect(localStorage.getItem('alovida.onboarding.draft_secret.patient')).toBeNull();

    const req = http.expectOne(
      (r) => r.method === 'DELETE' && r.url.includes('/iam/onboarding-drafts/patient/'),
    );
    expect(req.request.headers.get('x-onboarding-draft-secret')).toBe('secreto-1');
    req.flush({ ok: true });
  });

  it('sin secreto no pide borrar nada: la API respondería 404', () => {
    service.saveProgress('patient', 0, 'inicio', 'Paso 1', { name: 'Juan' });
    service.clearDraft('patient', { immediate: true });
    expect(service.detectDraft('patient')).toBeNull();
    http.expectNone((r) => r.method === 'DELETE');
  });

  it('el primer guardado crea, guarda el secreto y el siguiente lo manda', () => {
    vi.useFakeTimers();
    service.saveProgress('practitioner', 0, 'name', 'Paso 1', { name: 'Ana' });
    vi.advanceTimersByTime(500);
    const crear = http.expectOne((r) => r.method === 'PUT');
    expect(crear.request.headers.has('x-onboarding-draft-secret')).toBe(false);
    crear.flush({ ok: true, savedAt: 'x', draftSecret: 'secreto-2' });

    service.saveProgress('practitioner', 1, 'access', 'Paso 2', { name: 'Ana' });
    vi.advanceTimersByTime(500);
    const actualizar = http.expectOne((r) => r.method === 'PUT');
    expect(actualizar.request.headers.get('x-onboarding-draft-secret')).toBe('secreto-2');
    actualizar.flush({ ok: true, savedAt: 'y' });
    vi.useRealTimers();
  });

  it('ante un 404 empieza otro borrador remoto en vez de insistir con el mismo id', () => {
    vi.useFakeTimers();
    const idViejo = service.getOrCreateDraftId('practitioner');
    service.saveProgress('practitioner', 0, 'name', 'Paso 1', { name: 'Ana' });
    vi.advanceTimersByTime(500);
    http
      .expectOne((r) => r.method === 'PUT' && r.url.endsWith(idViejo))
      .flush({ message: 'Borrador no encontrado' }, { status: 404, statusText: 'Not Found' });

    const idNuevo = service.getOrCreateDraftId('practitioner');
    expect(idNuevo).not.toBe(idViejo);
    vi.useRealTimers();
  });

  it('no guarda las imágenes en base64: una foto superaba el tope de 64 KiB (413)', () => {
    const foto = 'data:image/png;base64,' + 'A'.repeat(100_000);
    service.saveProgress('practitioner', 0, 'practice', 'Foto', {
      name: 'Ana',
      profilePhotoBase64: foto,
      signatureImageBase64: foto,
    });
    const detectado = service.detectDraft('practitioner');
    expect(detectado?.data['name']).toBe('Ana');
    expect(detectado?.data['profilePhotoBase64']).toBeUndefined();
    expect(detectado?.data['signatureImageBase64']).toBeUndefined();
  });
});
