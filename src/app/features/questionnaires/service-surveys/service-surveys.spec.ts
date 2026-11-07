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
  let confirmAnswer: boolean;
  const confirmations: { title: string; message: string }[] = [];

  beforeEach(() => {
    confirmAnswer = true;
    confirmations.length = 0;
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
              confirmations.push(config);
              return Promise.resolve(confirmAnswer);
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

  const root = (): HTMLElement => {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const q = (selector: string): HTMLElement | null => root().querySelector(selector);
  /** Modals mount in a native `<dialog>`; query the document. */
  const inModal = (selector: string): HTMLElement | null => document.querySelector(selector);

  function respond(assignments: object = SERVICE_ASSIGNMENTS, catalog: object = STANDARD_CATALOG): void {
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/service-assignments').flush(assignments);
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/standard-catalog').flush(catalog);
    fixture.detectChanges();
  }

  it('S2 mientras viaja: esqueleto, sin lista', () => {
    expect(q('[data-testid="service-surveys-loading"]')).not.toBeNull();
    expect(q('[data-testid="service-surveys-list"]')).toBeNull();
    respond();
  });

  it('la cita médica va primero, fija: del sistema, sin «Cambiar» ni «Quitar»', () => {
    respond();

    const rows = [...root().querySelectorAll('[data-testid="service-surveys-list"] > li')];
    expect(rows[0]?.getAttribute('data-testid')).toBe('service-surveys-appointment');
    const appointment = rows[0] as HTMLElement;
    expect(appointment.textContent).toContain('Cita médica');
    expect(appointment.textContent).toContain('12 preguntas');
    expect(appointment.textContent).toContain('obligatoria');
    expect(appointment.querySelector('[data-testid="service-surveys-appointment-view"]')).not.toBeNull();
    expect(appointment.textContent).not.toContain('Cambiar');
    expect(appointment.textContent).not.toContain('Quitar');
    expect(appointment.textContent).not.toContain('Importar');
  });

  it('un renglón por servicio: sin propia dice que usa la base; con propia, su título', () => {
    respond();

    const eco = q('[data-testid="service-survey-svc-eco"]')!;
    expect(eco.textContent).toContain('Sin encuesta propia (se usa la base de servicios)');
    expect(eco.querySelector('[data-testid="service-survey-import-svc-eco"]')).not.toBeNull();
    expect(eco.querySelector('[data-testid="service-survey-remove-svc-eco"]')).toBeNull();

    const ecg = q('[data-testid="service-survey-svc-ecg"]')!;
    expect(ecg.textContent).toContain('Procedimientos y estudios');
    expect(ecg.querySelector('[data-testid="service-survey-change-svc-ecg"]')).not.toBeNull();
    expect(ecg.querySelector('[data-testid="service-survey-remove-svc-ecg"]')).not.toBeNull();
  });

  it('una asociación vieja hecha a mano (catalogCode null) no es la encuesta del servicio', () => {
    const legacy = {
      serviceId: 'svc-tele',
      serviceName: 'Teleconsulta',
      assignment: { assignmentId: 'a-0', catalogCode: null, title: 'Experiencia de teleconsulta', templateId: 't-0', versionId: 'v-0', assignedAt: '2026-09-01T10:00:00.000Z' },
    };
    respond({ ...SERVICE_ASSIGNMENTS, services: [...SERVICE_ASSIGNMENTS.services, legacy] });

    const row = q('[data-testid="service-survey-svc-tele"]')!;
    expect(row.textContent).toContain('Sin encuesta propia (se usa la base de servicios)');
    expect(row.textContent).not.toContain('Experiencia de teleconsulta');
    expect(row.textContent).not.toContain('Estándar');
    expect(row.textContent).not.toContain('Importada el');
    expect(row.querySelector('[data-testid="service-survey-import-svc-tele"]')).not.toBeNull();
    expect(row.querySelector('[data-testid="service-survey-remove-svc-tele"]')).toBeNull();
  });

  it('S3 sin servicios: la cita sigue y la próxima acción es «Mis servicios»', () => {
    respond({ ...SERVICE_ASSIGNMENTS, services: [] });

    expect(q('[data-testid="service-surveys-appointment"]')).not.toBeNull();
    const emptyState = q('[data-testid="service-surveys-no-services"]');
    expect(emptyState).not.toBeNull();
    expect(emptyState?.querySelector('a')?.getAttribute('href')).toBe('/my-services');
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
      respond();
      q('[data-testid="service-survey-import-svc-eco"]')!.click();
      root();

      const options = [...document.querySelectorAll('[data-testid^="standard-catalog-option-"]')].map((o) =>
        o.getAttribute('data-testid'),
      );
      // «Ecocardiograma» is imaging: the imaging survey comes first even though the server sent it second.
      expect(options).toEqual(['standard-catalog-option-STD_IMAGING_V1', 'standard-catalog-option-STD_PROCEDURE_V1']);
      expect(inModal('[data-testid="standard-catalog-option-STD_IMAGING_V1"]')?.textContent).toContain('Recomendada');
      const preview = inModal('[data-testid="standard-catalog-preview"]')!;
      expect(preview.textContent).toContain('Estudios por imágenes');
      expect(inModal('[data-testid="standard-catalog-source"]')?.textContent).toContain(
        'Ítems adaptados de CG-CAHPS 4.0 — Dominio público (AHRQ); PSQ-18 — Uso libre (RAND)',
      );
      expect(preview.textContent).toContain('¿Se respetó su privacidad?');
    });

    it('elegir sólo cambia la vista previa; «Importar» manda el código elegido y la fila usa la respuesta', () => {
      respond();
      q('[data-testid="service-survey-import-svc-eco"]')!.click();
      root();
      inModal('[data-testid="standard-catalog-option-STD_PROCEDURE_V1"]')!.click();
      root();
      http.expectNone((r) => r.method === 'PUT');
      expect(inModal('[data-testid="standard-catalog-preview"]')?.textContent).toContain('¿Le explicaron el procedimiento?');

      inModal('[data-testid="standard-catalog-import"]')!.click();
      const put = http.expectOne((r) => r.method === 'PUT' && r.url === '/surveys/service-assignments/svc-eco');
      expect(put.request.body).toEqual({ catalogCode: 'STD_PROCEDURE_V1' });
      put.flush({
        serviceId: 'svc-eco',
        serviceName: 'Ecocardiograma Doppler',
        assignment: { assignmentId: 'a-9', catalogCode: 'STD_PROCEDURE_V1', title: 'Procedimientos y estudios', templateId: 't', versionId: 'v', assignedAt: '2026-11-06T10:00:00.000Z' },
      });
      root();

      expect(inModal('[data-testid="standard-catalog"]')).toBeNull();
      const eco = q('[data-testid="service-survey-svc-eco"]')!;
      expect(eco.textContent).toContain('Procedimientos y estudios');
      expect(eco.textContent).not.toContain('Sin encuesta propia');
    });

    it('«Cambiar» arranca en la que está en uso y no deja reimportarla', () => {
      respond();
      q('[data-testid="service-survey-change-svc-ecg"]')!.click();
      root();

      expect(inModal('[data-testid="standard-catalog-option-STD_PROCEDURE_V1"]')?.getAttribute('aria-checked')).toBe('true');
      expect(inModal('[data-testid="standard-catalog-option-STD_PROCEDURE_V1"]')?.textContent).toContain('En uso');
      const importButton = inModal('[data-testid="standard-catalog-import"]')!;
      expect(importButton.getAttribute('aria-disabled')).toBe('true');
      importButton.click();
      http.expectNone((r) => r.method === 'PUT');
    });

    it('un 404 del catálogo se explica en el modal, que queda abierto, y relee el catálogo', () => {
      respond();
      q('[data-testid="service-survey-import-svc-eco"]')!.click();
      root();
      inModal('[data-testid="standard-catalog-import"]')!.click();
      http
        .expectOne((r) => r.method === 'PUT')
        .flush(
          { statusCode: 404, code: 'NOT_FOUND', reason: 'SURVEY_CATALOG_CODE_UNKNOWN', message: 'x', timestamp: '', path: '' },
          { status: 404, statusText: 'Not Found' },
        );
      // The catalog changed under the person: it is read again.
      http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/standard-catalog').flush(STANDARD_CATALOG);
      root();

      expect(inModal('[data-testid="standard-catalog-error"]')?.textContent).toContain('ya no está en el catálogo');
      expect(inModal('[data-testid="standard-catalog"]')).not.toBeNull();
      expect(q('[data-testid="service-survey-svc-eco"]')?.textContent).toContain('Sin encuesta propia');
    });
  });

  describe('Quitar → DELETE', () => {
    it('pide confirmación y, confirmada, el servicio vuelve a la base', async () => {
      respond();
      q('[data-testid="service-survey-remove-svc-ecg"]')!.click();
      await fixture.whenStable();

      expect(confirmations[0]?.message).toContain('encuesta base de servicios');
      const deletion = http.expectOne((r) => r.method === 'DELETE' && r.url === '/surveys/service-assignments/svc-ecg');
      deletion.flush(null, { status: 204, statusText: 'No Content' });
      root();

      expect(q('[data-testid="service-survey-svc-ecg"]')?.textContent).toContain('Sin encuesta propia');
    });

    it('si no se confirma, no manda nada y la fila queda como estaba', async () => {
      confirmAnswer = false;
      respond();
      q('[data-testid="service-survey-remove-svc-ecg"]')!.click();
      await fixture.whenStable();

      http.expectNone((r) => r.method === 'DELETE');
      expect(q('[data-testid="service-survey-svc-ecg"]')?.textContent).toContain('Procedimientos y estudios');
    });
  });

  it('«Ver preguntas» de la cita sin lista del servidor dice cuántas son, sin inventarlas', () => {
    respond();
    q('[data-testid="service-surveys-appointment-view"]')!.click();
    root();

    expect(document.body.textContent).toContain('Tiene 12 preguntas');
    expect(inModal('[data-testid="service-surveys-questions"]')).toBeNull();
  });
});
