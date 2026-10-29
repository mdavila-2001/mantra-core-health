import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';

import type { AdmissionAllowedAction } from '@core/data-access/admissions/admissions.types';
import { wireDetail, wireRequirement } from '../../../../../testing/admissions';
import { AdmissionDetail } from './admission-detail';

@Component({ template: '' })
class Vacia {}

const PERMITE = (...codes: AdmissionAllowedAction['code'][]): AdmissionAllowedAction[] =>
  codes.map((code) => ({ code, allowed: true }));

const VERIFICADOS = [
  wireRequirement({ id: 'req-1', code: 'NATIONAL_ID', label: 'Cédula de identidad', status: 'VERIFIED' }),
  wireRequirement({ id: 'req-2', code: 'PROFESSIONAL_LICENSE', label: 'Matrícula profesional', status: 'VERIFIED' }),
  wireRequirement({ id: 'req-3', code: 'SEDES_REGISTRATION', label: 'Registro del SEDES', mandatory: false, status: 'PENDING', documents: [] }),
];

describe('AdmissionDetail', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/admissions/:admissionId', component: AdmissionDetail },
          { path: 'administration/admissions', component: Vacia },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Las pruebas que abren la pestaña de documentos dejan pedidos los accesos a los archivos.
    http.match((r) => r.url.includes('/documents/')).forEach((r) => r.flush({}, { status: 404, statusText: 'x' }));
    http.verify();
  });

  const el = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const q = <T extends HTMLElement = HTMLElement>(testid: string): T | null => el().querySelector<T>(`[data-testid="${testid}"]`);
  const texto = (): string => el().textContent ?? '';
  const settle = async (): Promise<void> => {
    await harness.fixture.whenStable();
    harness.detectChanges();
  };

  async function abrir(detalle = wireDetail({ allowedActions: PERMITE('REQUEST_INFO', 'REVIEW_REQUIREMENT') })): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/administration/admissions/adm-1', AdmissionDetail);
    http.expectOne('/admissions/adm-1').flush(detalle);
    await settle();
  }

  const pestana = async (nombre: RegExp): Promise<void> => {
    const boton = [...el().querySelectorAll<HTMLElement>('[role="tab"]')].find((b) => nombre.test(b.textContent ?? ''))!;
    boton.click();
    await settle();
  };

  const clic = async (el2: HTMLElement | null): Promise<void> => {
    expect(el2).not.toBeNull();
    el2!.click();
    await settle();
  };

  const elegir = async (testid: string, valor: string): Promise<void> => {
    const s = q<HTMLSelectElement>(testid)!;
    s.value = valor;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  };

  const escribirMotivo = async (valor: string): Promise<void> => {
    const t = el().querySelector<HTMLTextAreaElement>('app-admission-review-dialog textarea')!;
    t.value = valor;
    t.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  };

  const boton = (nombre: RegExp, dentro: ParentNode = el()): HTMLButtonElement =>
    [...dentro.querySelectorAll<HTMLButtonElement>('button')].find((b) => nombre.test(b.textContent ?? '' ) || nombre.test(b.getAttribute('aria-label') ?? ''))!;

  const POST = (url: string): TestRequest => http.expectOne((r) => r.method === 'POST' && r.url === url);

  describe('la ficha', () => {
    it('es UNA tarjeta con las cinco pestañas, con el estado, el avance y el plazo a la vista', async () => {
      await abrir();
      expect(el().querySelectorAll('app-card')).toHaveLength(1);
      const nombres = [...el().querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
      expect(nombres).toEqual(['Resumen', 'Requisitos', 'Documentos (2)', 'Formulario llenado', 'Historial']);
      expect(q('admission-status')?.textContent).toContain('En revisión');
      expect(q('admission-progress')?.textContent).toContain('1 de 3 requisitos verificados');
      expect(texto()).toContain('Valeria Rojas Mendoza');
    });

    it('la cédula completa y los contactos solo se ven en la ficha; el encabezado la lleva enmascarada', async () => {
      await abrir();
      expect(texto()).toContain('****890');
      expect(texto()).toContain('valeria@correo.mock');
    });

    it('«Vencida hace N días» con palabras', async () => {
      await abrir(wireDetail({ overdue: true, dueAt: new Date(Date.now() - 2 * 86_400_000).toISOString() }));
      expect(q('admission-overdue')?.textContent).toContain('Vencida hace 2 días');
    });

    it('S6: una admisión que no existe no revela nada', async () => {
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/administration/admissions/nada', AdmissionDetail);
      http.expectOne('/admissions/nada').flush({ code: 'NOT_FOUND', message: 'No existe nada con id 123' }, { status: 404, statusText: 'Not Found' });
      await settle();
      expect(texto()).toContain('No encontramos lo que busca');
      expect(texto()).not.toContain('123');
    });

    it('S5: quien es el propio profesional ve «No puede revisar su propia solicitud» y nada más', async () => {
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/administration/admissions/adm-1', AdmissionDetail);
      http.expectOne('/admissions/adm-1').flush(
        { code: 'FORBIDDEN', message: 'No puede revisar su propia solicitud.', details: { reason: 'ADMISSION_SELF_ACCESS' } },
        { status: 403, statusText: 'Forbidden' },
      );
      await settle();
      expect(texto()).toContain('No puede revisar su propia solicitud');
      expect(texto()).toContain('Volver a las admisiones');
      expect(q('admission-card')).toBeNull();
      // No se piden datos de otras vistas para completar la pantalla.
      http.expectNone(() => true);
    });

    it('S5: un 403 por rol nombra el rol que falta', async () => {
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/administration/admissions/adm-1', AdmissionDetail);
      http.expectOne('/admissions/adm-1').flush(
        { code: 'FORBIDDEN', details: { reason: 'ADMISSION_ROLE_REQUIRED', requiredRole: 'ADMISSIONS_REVIEWER' } },
        { status: 403, statusText: 'Forbidden' },
      );
      await settle();
      expect(texto()).toContain('«Revisión de admisiones»');
    });

    it('S9: un error inesperado deja reintentar', async () => {
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/administration/admissions/adm-1', AdmissionDetail);
      http.expectOne('/admissions/adm-1').flush({ code: 'INTERNAL', correlationId: 'rq-9' }, { status: 500, statusText: 'x' });
      await settle();
      expect(texto()).toContain('rq-9');
      await clic(boton(/Reintentar/));
      http.expectOne('/admissions/adm-1').flush(wireDetail());
      await settle();
      expect(q('admission-card')).not.toBeNull();
    });
  });

  describe('las acciones según lo que la API permite', () => {
    it('una admisión enviada se toma con «Tomar revisión», mandando la versión vista', async () => {
      await abrir(wireDetail({ status: { code: 'SUBMITTED', label: 'Enviada' }, rowVersion: 7, allowedActions: PERMITE('CLAIM') }));
      expect(q('admission-action-claim')?.textContent).toContain('Tomar revisión');
      await clic(q('admission-action-claim'));
      const req = POST('/admissions/adm-1/claim');
      expect(req.request.body).toEqual({ expectedRowVersion: 7 });
      req.flush(wireDetail({ rowVersion: 8, allowedActions: PERMITE('REQUEST_INFO') }));
      await settle();
      expect(q('admission-status')?.textContent).toContain('En revisión');
      expect(q('admission-live')?.textContent).toContain('Tomó la revisión');
    });

    it('un doble clic manda una sola petición', async () => {
      await abrir(wireDetail({ status: { code: 'SUBMITTED', label: 'Enviada' }, allowedActions: PERMITE('CLAIM') }));
      const b = q<HTMLButtonElement>('admission-action-claim')!;
      b.click();
      b.click();
      b.click();
      await settle();
      const req = POST('/admissions/adm-1/claim');
      req.flush(wireDetail());
      await settle();
    });

    it('sin el permiso de tomarla, el botón está deshabilitado', async () => {
      await abrir(wireDetail({ status: { code: 'SUBMITTED', label: 'Enviada' }, allowedActions: [{ code: 'CLAIM', allowed: false, reasonCode: 'ROLE', message: 'Requiere el rol «Revisión de admisiones».' }] }));
      expect(q('admission-action-claim')?.getAttribute('aria-disabled')).toBe('true');
    });

    it('«Verificar al profesional» está deshabilitado con obligatorios sin verificar y dice cuáles faltan', async () => {
      await abrir(wireDetail({ allowedActions: PERMITE('DECIDE', 'REQUEST_INFO') }));
      expect(q('admission-action-verify')?.getAttribute('aria-disabled')).toBe('true');
      expect(q('admission-blockers')?.textContent).toContain('Falta verificar: Cédula de identidad, Matrícula profesional.');
      expect(q('admission-action-verify')?.getAttribute('aria-describedby')).toBe('admision-bloqueos');
    });

    it('con todos los obligatorios verificados se habilita', async () => {
      await abrir(wireDetail({ requirements: VERIFICADOS, requirementsSummary: { total: 3, verified: 2, rejected: 0, pending: 1 }, allowedActions: PERMITE('DECIDE') }));
      expect(q('admission-action-verify')?.getAttribute('aria-disabled')).toBe('false');
      expect(q('admission-blockers')).toBeNull();
    });

    it('cuatro ojos: a quien revisó se le explica por qué no puede aprobar, con las palabras de la API', async () => {
      await abrir(wireDetail({
        requirements: VERIFICADOS,
        allowedActions: [{ code: 'DECIDE', allowed: false, reasonCode: 'FOUR_EYES', message: 'Otra persona debe aprobar: usted revisó esta admisión.' }],
      }));
      expect(q('admission-action-verify')?.getAttribute('aria-disabled')).toBe('true');
      expect(q('admission-blockers')?.textContent).toContain('Otra persona debe aprobar');
      expect(q('admission-action-reject')).toBeNull();
    });

    it('«Liberar» y «Reasignar» aparecen solo si la API los permite', async () => {
      await abrir(wireDetail({ allowedActions: PERMITE('RELEASE', 'REASSIGN'), assignableReviewers: [{ id: 'u2', name: 'Rosario Quispe' }] }));
      expect(q('admission-action-release')).not.toBeNull();
      expect(q('admission-action-reassign')).not.toBeNull();
      await clic(q('admission-action-reassign'));
      await elegir('admission-review-assignee', 'u2');
      await clic(q('admission-review-confirm'));
      const req = POST('/admissions/adm-1/reassign');
      expect(req.request.body).toMatchObject({ assigneeId: 'u2', expectedRowVersion: 3 });
      req.flush(wireDetail({ assignedTo: { id: 'u2', name: 'Rosario Quispe' } }));
      await settle();
      expect(texto()).toContain('Rosario Quispe');
    });

    it('liberar devuelve la revisión a la cola', async () => {
      await abrir(wireDetail({ allowedActions: PERMITE('RELEASE') }));
      await clic(q('admission-action-release'));
      await clic(q('admission-review-confirm'));
      const req = POST('/admissions/adm-1/release');
      expect(req.request.body).toEqual({ expectedRowVersion: 3 });
      req.flush(wireDetail({ status: { code: 'SUBMITTED', label: 'Enviada' }, assignedTo: null }));
      await settle();
      expect(q('admission-status')?.textContent).toContain('Enviada');
    });

    it('el estado verificado ofrece suspender y el suspendido, reponer', async () => {
      await abrir(wireDetail({ status: { code: 'VERIFIED', label: 'Verificada' }, allowedActions: PERMITE('SUSPEND') }));
      expect(q('admission-action-suspend')).not.toBeNull();
      expect(q('admission-action-verify')).toBeNull();
    });

    it('sin ninguna acción posible, una nota en vez de botones muertos', async () => {
      await abrir(wireDetail({ status: { code: 'VERIFIED', label: 'Verificada' }, allowedActions: [{ code: 'SUSPEND', allowed: false, message: 'Requiere el rol «Aprobación de admisiones».' }] }));
      expect(q('admission-actions')).toBeNull();
      expect(q('admission-no-actions')?.textContent).toContain('Aprobación de admisiones');
    });
  });

  describe('verificar un requisito, documento por documento', () => {
    async function abrirVerificar(): Promise<void> {
      await abrir();
      await pestana(/Requisitos/);
      await clic(q('requirement-verify'));
    }

    it('pide la fuente y manda tipo, referencia, fecha, huella y la versión vista', async () => {
      await abrirVerificar();
      await clic(q('admission-review-confirm'));
      http.expectNone(() => true);
      expect(texto()).toContain('Elija de dónde obtuvo el dato.');
      await elegir('admission-review-source-type', 'MINSALUD_REGISTRY');
      await clic(q('admission-review-confirm'));
      const req = POST('/admissions/adm-1/items/req-1/review');
      expect(req.request.body).toMatchObject({
        decision: 'VERIFIED', sourceType: 'MINSALUD_REGISTRY', evidenceSha256: 'a'.repeat(64), expectedRowVersion: 3,
      });
      expect(req.request.body.sourceConsultedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect('reason' in req.request.body).toBe(false);
      req.flush(wireDetail({
        rowVersion: 4,
        requirements: [wireRequirement({ id: 'req-1', code: 'NATIONAL_ID', label: 'Cédula de identidad', status: 'VERIFIED', source: { type: { code: 'MINSALUD_REGISTRY', label: 'Registro del Ministerio de Salud' }, ref: null, consultedAt: '2026-10-29T12:00:00Z' } })],
        requirementsSummary: { total: 3, verified: 2, rejected: 0, pending: 1 },
      }));
      await settle();
      expect(q('requirement-status')?.textContent).toContain('Verificado');
      expect(q('requirement-source')?.textContent).toContain('Registro del Ministerio de Salud');
      expect(q('admission-progress')?.textContent).toContain('2 de 3');
      expect(q('admission-review-form')).toBeNull();
    });

    it('rechazar exige código y texto; manda el motivo estructurado y la nota interna aparte', async () => {
      await abrir();
      await pestana(/Requisitos/);
      await clic(q('requirement-reject'));
      await clic(q('admission-review-confirm'));
      http.expectNone(() => true);
      await elegir('admission-review-reason-code', 'ILLEGIBLE');
      await escribirMotivo('El documento está cortado.');
      await clic(q('admission-review-confirm'));
      const req = POST('/admissions/adm-1/items/req-1/review');
      expect(req.request.body).toMatchObject({ decision: 'REJECTED', reasonCode: 'ILLEGIBLE', reason: 'El documento está cortado.', expectedRowVersion: 3 });
      expect('internalNote' in req.request.body).toBe(false);
      req.flush(wireDetail());
      await settle();
    });

    it('un 412 se muestra dentro del diálogo y no lo cierra', async () => {
      await abrirVerificar();
      await elegir('admission-review-source-type', 'SEDES');
      await clic(q('admission-review-confirm'));
      POST('/admissions/adm-1/items/req-1/review').flush(
        { code: 'PRECONDITION_FAILED', message: 'La fuente no es válida para este requisito.', details: { reason: 'ADMISSION_ITEM_REQUIRES_SOURCE' } },
        { status: 412, statusText: 'Precondition Failed' },
      );
      await settle();
      expect(q('admission-review-error')?.textContent).toContain('La fuente no es válida');
      expect(q('admission-review-form')).not.toBeNull();
    });

    it('un 403 por rol dice cuál falta', async () => {
      await abrirVerificar();
      await elegir('admission-review-source-type', 'SEDES');
      await clic(q('admission-review-confirm'));
      POST('/admissions/adm-1/items/req-1/review').flush({ code: 'FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
      await settle();
      expect(q('admission-review-error')?.textContent).toContain('«Revisión de admisiones»');
    });

    it('409 versión vieja: conserva lo escrito, «Ver cambios» recarga y la segunda confirmación manda la versión nueva con la MISMA huella vista', async () => {
      await abrir();
      await pestana(/Requisitos/);
      await clic(q('requirement-reject'));
      await elegir('admission-review-reason-code', 'NAME_MISMATCH');
      await escribirMotivo('El nombre no coincide.');
      await clic(q('admission-review-confirm'));
      POST('/admissions/adm-1/items/req-1/review').flush(
        { code: 'CONFLICT', details: { reason: 'ADMISSION_STALE', currentRowVersion: 9 } }, { status: 409, statusText: 'Conflict' },
      );
      await settle();
      expect(q('admission-review-stale')).not.toBeNull();
      expect(el().querySelector<HTMLTextAreaElement>('app-admission-review-dialog textarea')!.value).toBe('El nombre no coincide.');
      await clic(q('admission-review-reload'));
      http.expectOne('/admissions/adm-1').flush(wireDetail({ rowVersion: 9, requirements: [wireRequirement({ id: 'req-1', evidenceSha256: 'c'.repeat(64) })] }));
      await settle();
      expect(q('admission-review-stale')).toBeNull();
      await clic(q('admission-review-confirm'));
      const req = POST('/admissions/adm-1/items/req-1/review');
      expect(req.request.body).toMatchObject({ reasonCode: 'NAME_MISMATCH', reason: 'El nombre no coincide.', expectedRowVersion: 9 });
      // No se adopta en silencio la huella nueva: decide sobre lo que se miró.
      expect(req.request.body.evidenceSha256).toBe('a'.repeat(64));
      req.flush(wireDetail({ rowVersion: 10 }));
      await settle();
    });

    it('409 evidencia cambiada: se cierra el formulario, se avisa y se recarga lo nuevo; no se decide a ciegas', async () => {
      await abrirVerificar();
      await elegir('admission-review-source-type', 'SEDES');
      await clic(q('admission-review-confirm'));
      POST('/admissions/adm-1/items/req-1/review').flush(
        { code: 'CONFLICT', message: 'x', details: { reason: 'ADMISSION_EVIDENCE_CHANGED' } }, { status: 409, statusText: 'Conflict' },
      );
      await settle();
      http.expectOne('/admissions/adm-1').flush(wireDetail({ requirements: [wireRequirement({ id: 'req-1', evidenceSha256: 'd'.repeat(64) })] }));
      await settle();
      expect(q('admission-review-form')).toBeNull();
      expect(q('admission-notice')?.textContent).toContain('El profesional cambió este documento; revíselo de nuevo.');
      // Para verificar hay que abrir el formulario otra vez, ya con la huella nueva.
      await pestana(/Requisitos/);
      await clic(q('requirement-verify'));
      await elegir('admission-review-source-type', 'SEDES');
      await clic(q('admission-review-confirm'));
      expect(POST('/admissions/adm-1/items/req-1/review').request.body.evidenceSha256).toBe('d'.repeat(64));
    });

    it('un 404 al decidir cierra todo y muestra «no encontrado»', async () => {
      await abrirVerificar();
      await elegir('admission-review-source-type', 'SEDES');
      await clic(q('admission-review-confirm'));
      POST('/admissions/adm-1/items/req-1/review').flush({}, { status: 404, statusText: 'x' });
      await settle();
      expect(texto()).toContain('No encontramos lo que busca');
      expect(q('admission-review-form')).toBeNull();
    });

    it('el doble clic en «Confirmar» manda una sola petición', async () => {
      await abrirVerificar();
      await elegir('admission-review-source-type', 'SEDES');
      const b = q<HTMLButtonElement>('admission-review-confirm')!;
      b.click();
      b.click();
      await settle();
      POST('/admissions/adm-1/items/req-1/review').flush(wireDetail());
      await settle();
    });
  });

  describe('la decisión final', () => {
    it('verificar al profesional pide confirmar con un resumen y NO manda ítems', async () => {
      await abrir(wireDetail({ requirements: VERIFICADOS, requirementsSummary: { total: 3, verified: 2, rejected: 0, pending: 1 }, allowedActions: PERMITE('DECIDE') }));
      await clic(q('admission-action-verify'));
      expect(q('admission-review-warning')?.textContent).toContain('decisión final');
      expect(q('admission-review-summary')?.textContent).toContain('2 de 3 requisitos verificados');
      await clic(q('admission-review-confirm'));
      const req = POST('/admissions/adm-1/decision');
      expect(req.request.body).toEqual({ decision: 'VERIFIED', expectedRowVersion: 3 });
      req.flush(wireDetail({ status: { code: 'VERIFIED', label: 'Verificada' }, allowedActions: PERMITE('SUSPEND') }));
      await settle();
      expect(q('admission-status')?.textContent).toContain('Verificada');
      expect(q('admission-action-suspend')).not.toBeNull();
    });

    it('un 412 porque la API ve obligatorios pendientes se muestra en el diálogo', async () => {
      await abrir(wireDetail({ requirements: VERIFICADOS, allowedActions: PERMITE('DECIDE') }));
      await clic(q('admission-action-verify'));
      await clic(q('admission-review-confirm'));
      POST('/admissions/adm-1/decision').flush(
        { code: 'PRECONDITION_FAILED', message: 'Faltan 1 requisito(s) obligatorio(s) por verificar.', details: { reason: 'ADMISSION_REQUIREMENTS_PENDING' } },
        { status: 412, statusText: 'x' },
      );
      await settle();
      expect(q('admission-review-error')?.textContent).toContain('Faltan 1 requisito');
    });

    it('un 403 de cuatro ojos se dice con las palabras de la API', async () => {
      await abrir(wireDetail({ requirements: VERIFICADOS, allowedActions: PERMITE('DECIDE') }));
      await clic(q('admission-action-verify'));
      await clic(q('admission-review-confirm'));
      POST('/admissions/adm-1/decision').flush(
        { code: 'FORBIDDEN', message: 'Otra persona debe aprobar.', details: { reason: 'ADMISSION_FOUR_EYES' } }, { status: 403, statusText: 'x' },
      );
      await settle();
      expect(q('admission-review-error')?.textContent).toContain('Otra persona debe aprobar.');
    });

    it('rechazar la admisión es destructivo, pide código y motivo, y manda el motivo para el médico', async () => {
      await abrir(wireDetail({ allowedActions: PERMITE('DECIDE') }));
      await clic(q('admission-action-reject'));
      await elegir('admission-review-reason-code', 'NOT_IN_REGISTRY');
      await escribirMotivo('La matrícula no figura en el registro.');
      await clic(q('admission-review-confirm'));
      const req = POST('/admissions/adm-1/decision');
      expect(req.request.body).toEqual({
        decision: 'REJECTED', reasonCode: 'NOT_IN_REGISTRY', reason: 'La matrícula no figura en el registro.', expectedRowVersion: 3,
      });
      req.flush(wireDetail({ status: { code: 'REJECTED', label: 'Rechazada' }, decisionReasonText: 'La matrícula no figura en el registro.' }));
      await settle();
      expect(q('admission-decision-reason')?.textContent).toContain('no figura');
    });

    it('pedir información manda código, texto y nota', async () => {
      await abrir();
      await clic(q('admission-action-info'));
      await elegir('admission-review-reason-code', 'INCOMPLETE_DOCUMENT');
      await escribirMotivo('Falta el reverso de la cédula.');
      await clic(q('admission-review-confirm'));
      const req = POST('/admissions/adm-1/request-info');
      expect(req.request.body).toMatchObject({ reasonCode: 'INCOMPLETE_DOCUMENT', reason: 'Falta el reverso de la cédula.', expectedRowVersion: 3 });
      req.flush(wireDetail({ status: { code: 'INFO_REQUESTED', label: 'Información requerida' }, infoRequestedText: 'Falta el reverso de la cédula.' }));
      await settle();
      expect(q('admission-status')?.textContent).toContain('Información requerida');
    });
  });

  describe('el carrusel y el formulario llenado', () => {
    it('la pestaña de documentos abre el carrusel con el contador «1 de 2»', async () => {
      await abrir();
      await pestana(/Documentos/);
      expect(q('gallery-counter')?.textContent?.trim()).toBe('1 de 2');
      expect(q('gallery-requirement')?.textContent).toContain('Cédula de identidad');
      http.match((r) => r.url.startsWith('/admissions/adm-1/documents')).forEach((r) => r.flush({}, { status: 404, statusText: 'x' }));
    });

    it('verificar desde el carrusel abre el mismo formulario y, al terminar, avanza al siguiente pendiente', async () => {
      await abrir();
      await pestana(/Documentos/);
      http.match((r) => r.url.startsWith('/admissions/adm-1/documents')).forEach((r) => r.flush({}, { status: 404, statusText: 'x' }));
      await clic(q('gallery-verify'));
      await elegir('admission-review-source-type', 'PROVIDED_DOCUMENT');
      await clic(q('admission-review-confirm'));
      const req = POST('/admissions/adm-1/items/req-1/review');
      req.flush(wireDetail({
        rowVersion: 4,
        requirements: [wireRequirement({ id: 'req-1', code: 'NATIONAL_ID', label: 'Cédula de identidad', status: 'VERIFIED' }), wireDetail().requirements![1]!, wireDetail().requirements![2]!],
      }));
      await settle();
      http.match((r) => r.url.startsWith('/admissions/adm-1/documents')).forEach((r) => r.flush({}, { status: 404, statusText: 'x' }));
      await settle();
      expect(q('gallery-counter')?.textContent?.trim()).toBe('2 de 2');
      expect(q('gallery-requirement')?.textContent).toContain('Matrícula profesional');
    });

    it('el formulario llenado marca el dato obligatorio que falta sin inventarlo y enlaza a la evidencia', async () => {
      await abrir();
      await pestana(/Formulario llenado/);
      expect(q('form-missing')?.textContent).toContain('Fecha de nacimiento');
      expect(texto()).toContain('Falta este dato obligatorio');
      await clic(q('form-view-evidence'));
      http.match((r) => r.url.startsWith('/admissions/adm-1/documents')).forEach((r) => r.flush({}, { status: 404, statusText: 'x' }));
      expect(q('gallery-requirement')?.textContent).toContain('Cédula de identidad');
    });

    it('desde el carrusel se llega al campo del formulario', async () => {
      await abrir();
      await pestana(/Documentos/);
      http.match((r) => r.url.startsWith('/admissions/adm-1/documents')).forEach((r) => r.flush({}, { status: 404, statusText: 'x' }));
      await clic(q('gallery-show-field'));
      expect(q('admission-submitted-form')).not.toBeNull();
      expect(el().querySelector('.vinculo--resaltado')).not.toBeNull();
    });
  });

  describe('el historial', () => {
    it('lista los eventos con quién y cuándo, y rotula la nota interna', async () => {
      const ev = wireDetail().events[0]!;
      await abrir(wireDetail({ events: [ev, { ...ev, id: 'ev-2', type: 'ITEM_REJECTED', reasonCode: 'ILLEGIBLE', reasonText: 'No se lee.', internalNote: 'Sospecho del escaneo.', actor: { id: 'u', name: 'Marcelo Dávila' } }] }));
      await pestana(/Historial/);
      const t = q('admission-history')?.textContent ?? '';
      expect(t).toContain('Solicitud enviada');
      expect(t).toContain('Requisito rechazado');
      expect(t).toContain('Ilegible o cortado');
      expect(t).toContain('Nota interna: no la ve el profesional');
      expect(t).toContain('Marcelo Dávila');
    });
  });

  it('la región viva anuncia el resultado de cada acción', async () => {
    await abrir(wireDetail({ status: { code: 'SUBMITTED', label: 'Enviada' }, allowedActions: PERMITE('CLAIM') }));
    expect(q('admission-live')?.getAttribute('aria-live')).toBe('polite');
    await clic(q('admission-action-claim'));
    POST('/admissions/adm-1/claim').flush({}, { status: 403, statusText: 'x' });
    await settle();
    expect(q('admission-live')?.textContent).toContain('Revisión de admisiones');
    expect(q('admission-notice')?.textContent).toContain('«Revisión de admisiones»');
  });

  it('una ficha sin requisitos no se puede verificar', async () => {
    await abrir(wireDetail({ requirements: [], allowedActions: PERMITE('DECIDE') }));
    expect(q('admission-action-verify')?.getAttribute('aria-disabled')).toBe('true');
    vi.useRealTimers();
  });
});
