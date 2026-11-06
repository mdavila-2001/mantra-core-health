import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../../core/data-access/api';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ServiceSurveys } from './service-surveys';
import { SERVICE_ASSIGNMENTS, STANDARD_CATALOG } from './service-surveys.fixtures';

describe('ServiceSurveys · «Encuestas por servicio»', () => {
  let fixture: ComponentFixture<ServiceSurveys>;
  let http: HttpTestingController;
  let confirmar: boolean;
  const confirmaciones: { title: string; message: string }[] = [];

  beforeEach(() => {
    confirmar = true;
    confirmaciones.length = 0;
    TestBed.configureTestingModule({
      imports: [ServiceSurveys],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: '' },
        {
          provide: DialogService,
          useValue: {
            confirm: (config: { title: string; message: string }) => {
              confirmaciones.push(config);
              return Promise.resolve(confirmar);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ServiceSurveys);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const raiz = (): HTMLElement => {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const q = (selector: string): HTMLElement | null => raiz().querySelector(selector);
  /** Modals mount in a native `<dialog>`; query the document. */
  const enModal = (selector: string): HTMLElement | null => document.querySelector(selector);

  function responder(asignaciones: object = SERVICE_ASSIGNMENTS, catalogo: object = STANDARD_CATALOG): void {
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/service-assignments').flush(asignaciones);
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/standard-catalog').flush(catalogo);
    fixture.detectChanges();
  }

  it('S2 mientras viaja: esqueleto, sin lista', () => {
    expect(q('[data-testid="service-surveys-loading"]')).not.toBeNull();
    expect(q('[data-testid="service-surveys-list"]')).toBeNull();
    responder();
  });

  it('la cita médica va primero, fija: del sistema, sin «Cambiar» ni «Quitar»', () => {
    responder();

    const filas = [...raiz().querySelectorAll('[data-testid="service-surveys-list"] > li')];
    expect(filas[0]?.getAttribute('data-testid')).toBe('service-surveys-appointment');
    const cita = filas[0] as HTMLElement;
    expect(cita.textContent).toContain('Cita médica');
    expect(cita.textContent).toContain('12 preguntas');
    expect(cita.textContent).toContain('obligatoria');
    expect(cita.querySelector('[data-testid="service-surveys-appointment-view"]')).not.toBeNull();
    expect(cita.textContent).not.toContain('Cambiar');
    expect(cita.textContent).not.toContain('Quitar');
    expect(cita.textContent).not.toContain('Importar');
  });

  it('un renglón por servicio: sin propia dice que usa la base; con propia, su título', () => {
    responder();

    const eco = q('[data-testid="service-survey-svc-eco"]')!;
    expect(eco.textContent).toContain('Sin encuesta propia (se usa la base de servicios)');
    expect(eco.querySelector('[data-testid="service-survey-import-svc-eco"]')).not.toBeNull();
    expect(eco.querySelector('[data-testid="service-survey-remove-svc-eco"]')).toBeNull();

    const ecg = q('[data-testid="service-survey-svc-ecg"]')!;
    expect(ecg.textContent).toContain('Procedimientos y estudios');
    expect(ecg.querySelector('[data-testid="service-survey-change-svc-ecg"]')).not.toBeNull();
    expect(ecg.querySelector('[data-testid="service-survey-remove-svc-ecg"]')).not.toBeNull();
  });

  it('S3 sin servicios: la cita sigue y la próxima acción es «Mis servicios»', () => {
    responder({ ...SERVICE_ASSIGNMENTS, services: [] });

    expect(q('[data-testid="service-surveys-appointment"]')).not.toBeNull();
    const vacio = q('[data-testid="service-surveys-no-services"]');
    expect(vacio).not.toBeNull();
    expect(vacio?.querySelector('a')?.getAttribute('href')).toBe('/my-services');
  });

  it('si el catálogo falla, la lista se ve pero no se puede importar', () => {
    http.expectOne((r) => r.url === '/surveys/service-assignments').flush(SERVICE_ASSIGNMENTS);
    http
      .expectOne((r) => r.url === '/surveys/standard-catalog')
      .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'x' });
    fixture.detectChanges();

    expect(q('[data-testid="service-surveys-list"]')).not.toBeNull();
    expect(q('[data-testid="service-surveys-catalog-error"]')).not.toBeNull();
    expect(q('[data-testid="service-survey-import-svc-eco"]')?.getAttribute('aria-disabled')).toBe('true');
  });

  describe('Importar → PUT', () => {
    it('abre el catálogo con la recomendada para el servicio primero y su vista previa', () => {
      responder();
      q('[data-testid="service-survey-import-svc-eco"]')!.click();
      raiz();

      const opciones = [...document.querySelectorAll('[data-testid^="standard-catalog-option-"]')].map((o) =>
        o.getAttribute('data-testid'),
      );
      // «Ecocardiograma» is imaging: the imaging survey comes first even though the server sent it second.
      expect(opciones).toEqual(['standard-catalog-option-STD_IMAGING_V1', 'standard-catalog-option-STD_PROCEDURE_V1']);
      expect(enModal('[data-testid="standard-catalog-option-STD_IMAGING_V1"]')?.textContent).toContain('Recomendada');
      const vista = enModal('[data-testid="standard-catalog-preview"]')!;
      expect(vista.textContent).toContain('Estudios por imágenes');
      expect(enModal('[data-testid="standard-catalog-source"]')?.textContent).toContain(
        'Ítems adaptados de CG-CAHPS 4.0 — Dominio público (AHRQ); PSQ-18 — Uso libre (RAND)',
      );
      expect(vista.textContent).toContain('¿Se respetó su privacidad?');
    });

    it('elegir sólo cambia la vista previa; «Importar» manda el código elegido y la fila usa la respuesta', () => {
      responder();
      q('[data-testid="service-survey-import-svc-eco"]')!.click();
      raiz();
      enModal('[data-testid="standard-catalog-option-STD_PROCEDURE_V1"]')!.click();
      raiz();
      http.expectNone((r) => r.method === 'PUT');
      expect(enModal('[data-testid="standard-catalog-preview"]')?.textContent).toContain('¿Le explicaron el procedimiento?');

      enModal('[data-testid="standard-catalog-import"]')!.click();
      const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/surveys/service-assignments/svc-eco');
      expect(put.request.body).toEqual({ catalogCode: 'STD_PROCEDURE_V1' });
      put.flush({
        serviceId: 'svc-eco',
        serviceName: 'Ecocardiograma Doppler',
        assignment: { assignmentId: 'a-9', catalogCode: 'STD_PROCEDURE_V1', title: 'Procedimientos y estudios', templateId: 't', versionId: 'v', assignedAt: '2026-11-06T10:00:00.000Z' },
      });
      raiz();

      expect(enModal('[data-testid="standard-catalog"]')).toBeNull();
      const eco = q('[data-testid="service-survey-svc-eco"]')!;
      expect(eco.textContent).toContain('Procedimientos y estudios');
      expect(eco.textContent).not.toContain('Sin encuesta propia');
    });

    it('«Cambiar» arranca en la que está en uso y no deja reimportarla', () => {
      responder();
      q('[data-testid="service-survey-change-svc-ecg"]')!.click();
      raiz();

      expect(enModal('[data-testid="standard-catalog-option-STD_PROCEDURE_V1"]')?.getAttribute('aria-checked')).toBe('true');
      expect(enModal('[data-testid="standard-catalog-option-STD_PROCEDURE_V1"]')?.textContent).toContain('En uso');
      const importar = enModal('[data-testid="standard-catalog-import"]')!;
      expect(importar.getAttribute('aria-disabled')).toBe('true');
      importar.click();
      http.expectNone((r) => r.method === 'PUT');
    });

    it('un 404 del catálogo se explica en el modal, que queda abierto, y relee el catálogo', () => {
      responder();
      q('[data-testid="service-survey-import-svc-eco"]')!.click();
      raiz();
      enModal('[data-testid="standard-catalog-import"]')!.click();
      http
        .expectOne((r) => r.method === 'PUT')
        .flush(
          { statusCode: 404, code: 'NOT_FOUND', reason: 'SURVEY_CATALOG_CODE_UNKNOWN', message: 'x', timestamp: '', path: '' },
          { status: 404, statusText: 'Not Found' },
        );
      // The catalog changed under the person: it is read again.
      http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/standard-catalog').flush(STANDARD_CATALOG);
      raiz();

      expect(enModal('[data-testid="standard-catalog-error"]')?.textContent).toContain('ya no está en el catálogo');
      expect(enModal('[data-testid="standard-catalog"]')).not.toBeNull();
      expect(q('[data-testid="service-survey-svc-eco"]')?.textContent).toContain('Sin encuesta propia');
    });
  });

  describe('Quitar → DELETE', () => {
    it('pide confirmación y, confirmada, el servicio vuelve a la base', async () => {
      responder();
      q('[data-testid="service-survey-remove-svc-ecg"]')!.click();
      await fixture.whenStable();

      expect(confirmaciones[0]?.message).toContain('encuesta base de servicios');
      const deletion = http.expectOne((r) => r.method === 'DELETE' && r.url === '/surveys/service-assignments/svc-ecg');
      deletion.flush(null, { status: 204, statusText: 'No Content' });
      raiz();

      expect(q('[data-testid="service-survey-svc-ecg"]')?.textContent).toContain('Sin encuesta propia');
    });

    it('si no se confirma, no manda nada y la fila queda como estaba', async () => {
      confirmar = false;
      responder();
      q('[data-testid="service-survey-remove-svc-ecg"]')!.click();
      await fixture.whenStable();

      http.expectNone((r) => r.method === 'DELETE');
      expect(q('[data-testid="service-survey-svc-ecg"]')?.textContent).toContain('Procedimientos y estudios');
    });
  });

  it('«Ver preguntas» de la cita sin lista del servidor dice cuántas son, sin inventarlas', () => {
    responder();
    q('[data-testid="service-surveys-appointment-view"]')!.click();
    raiz();

    expect(document.body.textContent).toContain('Tiene 12 preguntas');
    expect(enModal('[data-testid="service-surveys-questions"]')).toBeNull();
  });
});
