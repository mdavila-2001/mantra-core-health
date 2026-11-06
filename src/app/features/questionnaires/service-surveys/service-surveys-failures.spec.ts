import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../../core/data-access/api';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ServiceSurveys } from './service-surveys';
import { SERVICE_ASSIGNMENTS, STANDARD_CATALOG } from './service-surveys.fixtures';
import { SurveyCatalogPicker } from './survey-catalog-picker';

/* Failure paths of «Encuestas por servicio»: GET errors, PUT 409/late errors,
   DELETE errors, an empty catalog and closing the picker mid-save. */

/** The server's own text must never reach the screen. */
const RAW = 'RAW_BACKEND_TEXT';
const apiError = (status: number, code: string, reason?: string) => ({
  body: { statusCode: status, code, ...(reason ? { reason } : {}), message: RAW, timestamp: '', path: '', correlationId: 'corr-123' },
  init: { status, statusText: 'x' },
});

describe('ServiceSurveys · fallos', () => {
  let fixture: ComponentFixture<ServiceSurveys>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ServiceSurveys],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: '' },
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(true) } },
        { provide: ToastService, useValue: { success: () => undefined } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ServiceSurveys);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const root = (): HTMLElement => {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const q = (selector: string): HTMLElement | null => root().querySelector(selector);
  const inModal = (selector: string): HTMLElement | null => document.querySelector(selector);
  const listRequest = () => http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/service-assignments');
  const catalogRequest = () => http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/standard-catalog');

  /** The S9 anatomy: our title and message, support code, «Copiar código», «Reintentar»; never the server's text. */
  function expectS9(container: Element | null, text: string): void {
    expect(container).not.toBeNull();
    const content = container!.textContent ?? '';
    expect(content).toContain(text);
    expect(content).toContain('corr-123');
    expect(content).toContain('Copiar código');
    expect(content).toContain('Reintentar');
    expect(content).not.toContain(RAW);
  }

  function respond(catalog: object = STANDARD_CATALOG): void {
    listRequest().flush(SERVICE_ASSIGNMENTS);
    catalogRequest().flush(catalog);
    fixture.detectChanges();
  }

  function openImportAndSend(): ReturnType<HttpTestingController['expectOne']> {
    respond();
    q('[data-testid="service-survey-import-svc-eco"]')!.click();
    root();
    inModal('[data-testid="standard-catalog-import"]')!.click();
    return http.expectOne((r) => r.method === 'PUT' && r.url === '/surveys/service-assignments/svc-eco');
  }

  for (const [status, code] of [
    [403, 'FORBIDDEN'],
    [412, 'PRECONDITION_FAILED'],
  ] as const) {
    it(`GET con ${status}: estado de error, sin lista ni filas a medias`, () => {
      const e = apiError(status, code);
      listRequest().flush(e.body, e.init);
      catalogRequest().flush(STANDARD_CATALOG);
      root();
      expect(q('[data-testid="service-surveys-list"]')).toBeNull();
      expect(q('[data-testid="service-surveys-loading"]')).toBeNull();
      expect(q('app-view-state-host')?.textContent?.trim().length).toBeGreaterThan(0);
    });
  }

  it('catálogo vacío: S3 explicado en vez de botones mudos', () => {
    respond({ items: [] });
    expect(q('[data-testid="service-surveys-catalog-empty"]')?.textContent).toContain('Todavía no hay encuestas estándar');
    expect(q('[data-testid="service-surveys-catalog-error"]')).toBeNull();
    expect(q('[data-testid="service-survey-import-svc-eco"]')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('PUT 409 ASSIGNMENT_ALREADY_ACTIVE: cierra el selector, lo dice y relee la lista', () => {
    const e = apiError(409, 'CONFLICT', 'ASSIGNMENT_ALREADY_ACTIVE');
    openImportAndSend().flush(e.body, e.init);
    root();
    expect(inModal('[data-testid="standard-catalog"]')).toBeNull();
    listRequest().flush(SERVICE_ASSIGNMENTS);
    root();
    expect(q('[data-testid="service-surveys-list"]')).not.toBeNull();
    expectS9(q('[data-testid="service-surveys-write-error"]'), 'otra sesión');
  });

  it('mientras guarda: no se cierra por fondo/Escape y «Cancelar» queda inhabilitado', () => {
    const put = openImportAndSend();
    root();
    expect(inModal('[data-testid="standard-catalog-cancel"]')?.getAttribute('aria-disabled')).toBe('true');
    inModal('[data-testid="standard-catalog-cancel"]')!.click();
    root();
    expect(inModal('[data-testid="standard-catalog"]')).not.toBeNull();
    put.flush({ serviceId: 'svc-eco', serviceName: 'Ecocardiograma Doppler', assignment: null });
  });

  it('la ✕ no cierra mientras guarda; si igual se cierra, no queda trabado y el error tardío va a un aviso', () => {
    const put = openImportAndSend();
    root();
    inModal('app-survey-catalog-picker [data-testid="content-dialog-close"]')!.click();
    root();
    expect(inModal('[data-testid="standard-catalog"]')).not.toBeNull();

    // Any other close path (the host tearing the modal down) still clears the selection.
    const picker = fixture.debugElement.query(By.directive(SurveyCatalogPicker)).componentInstance as SurveyCatalogPicker;
    picker.closed.emit();
    root();
    expect(inModal('[data-testid="standard-catalog"]')).toBeNull();

    const e = apiError(500, 'INTERNAL');
    put.flush(e.body, e.init);
    root();
    expectS9(q('[data-testid="service-surveys-write-error"]'), 'No se pudo importar');
    expect(inModal('[data-testid="standard-catalog"]')).toBeNull();

    // «Importar» works again: the selection was cleared.
    q('[data-testid="service-survey-import-svc-eco"]')!.click();
    root();
    expect(inModal('[data-testid="standard-catalog"]')).not.toBeNull();
    expect(inModal('[data-testid="standard-catalog-error"]')).toBeNull();
  });

  it('DELETE que falla: la fila queda como estaba, S9 propio y «Reintentar» vuelve a quitar sin preguntar', async () => {
    respond();
    q('[data-testid="service-survey-remove-svc-ecg"]')!.click();
    await fixture.whenStable();
    const e = apiError(412, 'PRECONDITION_FAILED');
    http.expectOne((r) => r.method === 'DELETE' && r.url === '/surveys/service-assignments/svc-ecg').flush(e.body, e.init);
    root();
    expectS9(q('[data-testid="service-surveys-write-error"]'), 'perfil profesional');
    expect(q('[data-testid="service-surveys-write-error"]')?.textContent).toContain('No se pudo quitar la encuesta');
    expect(q('[data-testid="service-survey-svc-ecg"]')?.textContent).toContain('Procedimientos y estudios');

    [...root().querySelectorAll<HTMLButtonElement>('[data-testid="service-surveys-write-error"] button')].find((b) => b.textContent?.includes('Reintentar'))!.click();
    await fixture.whenStable();
    http.expectOne((r) => r.method === 'DELETE' && r.url === '/surveys/service-assignments/svc-ecg').flush(null, { status: 204, statusText: 'No Content' });
    root();
    expect(q('[data-testid="service-surveys-write-error"]')).toBeNull();
    expect(q('[data-testid="service-survey-svc-ecg"]')?.textContent).toContain('Sin encuesta propia');
  });

  it('DELETE 404/409: la fila cambió en otra parte, relee la lista', async () => {
    respond();
    q('[data-testid="service-survey-remove-svc-ecg"]')!.click();
    await fixture.whenStable();
    const e = apiError(404, 'NOT_FOUND');
    http.expectOne((r) => r.method === 'DELETE').flush(e.body, e.init);
    root();
    listRequest().flush(SERVICE_ASSIGNMENTS);
    root();
    expectS9(q('[data-testid="service-surveys-write-error"]'), 'ya había cambiado');
  });

  it('el catálogo que falla usa la misma anatomía S9, con su propio texto', () => {
    listRequest().flush(SERVICE_ASSIGNMENTS);
    const e = apiError(500, 'INTERNAL');
    catalogRequest().flush(e.body, e.init);
    root();
    expectS9(q('[data-testid="service-surveys-catalog-error"]'), 'No se pudo cargar el catálogo de encuestas');
  });

  it('un PUT que falla con el selector abierto: S9 dentro del selector, sin el texto del servidor', () => {
    const e = apiError(500, 'INTERNAL');
    openImportAndSend().flush(e.body, e.init);
    root();
    expectS9(inModal('[data-testid="standard-catalog-error"]'), 'No se pudo importar la encuesta');
  });
});
